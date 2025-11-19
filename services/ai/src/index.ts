import { WorkerEntrypoint } from "cloudflare:workers";
import { AiRequest, AiResponse } from "shared/types";
import { buildMultipart } from "./multipart";
import { marked } from "marked";

export interface Env {
    OPENAI_API_KEY: string;
}

// Custom renderer for email-safe HTML
const renderer = new marked.Renderer();

// Override heading to add styles
renderer.heading = function(token) {
  const { text, depth } = token as any;
  const sizes = ["24px", "20px", "18px", "16px", "14px", "12px"];
  const size = sizes[depth - 1] || "16px";
  const content = this.parser.parseInline(token.tokens);
  return `<h${depth} style="font-family: sans-serif; color: #333; font-size: ${size}; margin-top: 20px; margin-bottom: 10px;">${content}</h${depth}>`;
};

// Override link to add styles
renderer.link = function(token) {
  const { href, title, text } = token as any;
  const content = this.parser.parseInline(token.tokens);
  return `<a href="${href}" title="${title || ''}" style="color: #007bff; text-decoration: none;">${content}</a>`;
};

// Override paragraph to add styles
renderer.paragraph = function(token) {
  const content = this.parser.parseInline(token.tokens);
  return `<p style="font-family: sans-serif; color: #333; line-height: 1.6; margin-bottom: 15px;">${content}</p>`;
};

// Override list to add styles
renderer.list = function(token) {
  const { ordered, start } = token as any;
  const body = this.parser.parse(token.items);
  const tag = ordered ? "ol" : "ul";
  const startAttr = (ordered && start !== 1) ? ` start="${start}"` : '';
  return `<${tag}${startAttr} style="font-family: sans-serif; color: #333; padding-left: 20px; margin-bottom: 15px;">${body}</${tag}>`;
};

renderer.listitem = function(token) {
  const content = this.parser.parse(token.tokens);
  return `<li style="margin-bottom: 5px;">${content}</li>`;
};

// Override code block to add styles
renderer.code = function(token) {
  const { text, lang } = token as any;
  // Code blocks usually have raw text, no inline parsing needed
  return `<pre style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; font-family: monospace; font-size: 13px; color: #333; margin-bottom: 15px;"><code>${text}</code></pre>`;
};

// Override codespan to add styles
renderer.codespan = function(token) {
  const { text } = token as any;
  return `<code style="background-color: #f4f4f4; padding: 2px 4px; border-radius: 3px; font-family: monospace; font-size: 13px; color: #d63384;">${text}</code>`;
};

// Override blockquote to add styles
renderer.blockquote = function(token) {
  const content = this.parser.parse(token.tokens);
  return `<blockquote style="border-left: 4px solid #ccc; margin: 0; padding-left: 15px; color: #666; font-style: italic; margin-bottom: 15px;">${content}</blockquote>`;
};

// Set options
marked.setOptions({
  renderer: renderer,
  gfm: true,
  breaks: true
});

export default class AiService extends WorkerEntrypoint<Env> {
    /**
     * Helper to upload a file to OpenAI Files API
     */
    private async uploadFileToOpenAI(file: File): Promise<string> {
        console.log(`AI: Uploading file ${file.name} (${file.type}) to OpenAI...`);
        
        const { body, boundary } = buildMultipart({
            file,
            purpose: "assistants" // Required for Responses API usage
        });

        const resp = await fetch("https://api.openai.com/v1/files", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.env.OPENAI_API_KEY}`,
                "Content-Type": `multipart/form-data; boundary=${boundary}`
            },
            body
        });

        if (!resp.ok) {
            const errorText = await resp.text();
            throw new Error(`OpenAI Files API Error: ${resp.status} - ${errorText}`);
        }

        const json = await resp.json() as any;
        console.log(`AI: File uploaded successfully. ID: ${json.id}`);
        return json.id;
    }

    /**
     * Process email with OpenAI
     */
    async generateReply(request: AiRequest): Promise<AiResponse> {
        console.log("AI: Generating reply for message", request.messageId);

        try {
            // 1. Build Prompt / History
            let historyStr = "";
            request.conversationHistory.forEach((msg) => {
                if (msg.role === "user") {
                    historyStr += `\n\nPrevious User Message (${msg.receivedAt}):\n${msg.content}`;
                } else {
                    historyStr += `\n\nPrevious Assistant Reply (${msg.receivedAt}):\n${msg.content}`;
                }
            });
            
            // Use processed text content if available (includes attachment list), otherwise fallback to raw TextBody
            let emailContent = request.processedTextContent || request.postmarkData.TextBody || "(No body content)";
            const MAX_CONTENT_LENGTH = 50000;
            if (emailContent.length > MAX_CONTENT_LENGTH) {
                emailContent = emailContent.substring(0, MAX_CONTENT_LENGTH) + "\n\n[... truncated ...]";
            }

            // Construct the user message content with context
            let userContentText = `Conversation History:${historyStr}\n\nCurrent Email:\nFrom: ${request.postmarkData.FromFull?.Name} <${request.postmarkData.FromFull?.Email}>\nSubject: ${request.postmarkData.Subject}\n\n${emailContent}`;

            if (request.requestContext) {
                userContentText += `\n\n---\nREQUEST CONTEXT:\n${JSON.stringify(request.requestContext)}`;
            }

            // 2. Handle Attachments (Upload to OpenAI Files API first)
            // Filter out small images (< 5KB) to avoid sending noise (icons, signatures).
            // We upload ALL other attachments (PDFs, Docs, large images) regardless of ContentID,
            // because even inline images need to be uploaded for the AI to "see" them.
            const validAttachments = request.postmarkData.Attachments?.filter(att => {
                const isSmallImage = att.ContentType.startsWith("image/") && att.ContentLength < 5000;
                return !isSmallImage;
            }) || [];

            const userMessageContent: any[] = [];
            let openaiUploadTimeMs = 0;

            // Add uploaded files to content array
            if (validAttachments.length > 0) {
                console.log(`AI: Processing ${validAttachments.length} attachments`);
                const uploadStartTime = Date.now();
                
                // Upload files in parallel
                const uploadPromises = validAttachments.map(async (attachment) => {
                    // Convert Base64 to Uint8Array
                    const binaryString = atob(attachment.Content);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    
                    const file = new File([bytes], attachment.Name, {
                        type: attachment.ContentType
                    });

                    return this.uploadFileToOpenAI(file);
                });

                const fileIds = await Promise.all(uploadPromises);
                openaiUploadTimeMs = Date.now() - uploadStartTime;
                
                // Add file references to the message content
                fileIds.forEach(fileId => {
                    userMessageContent.push({
                        type: "input_file",
                        file_id: fileId
                    });
                });
            }

            // Add the text prompt
            userMessageContent.push({
                type: "input_text",
                text: userContentText
            });

            // 3. Prepare Request Body for Responses API
            const messages = [
                { role: "system", content: [{ type: "input_text", text: request.systemPrompt }] },
                { role: "user", content: userMessageContent }
            ];

            const payload: any = {
                model: request.model,
                input: messages,
                max_output_tokens: request.maxOutputTokens,
            };

            if (request.reasoningEffort) payload.reasoning = { effort: request.reasoningEffort };
            if (request.textVerbosity) payload.text = { verbosity: request.textVerbosity };

            const aiStartTime = Date.now();

            // 4. Call OpenAI Responses API (JSON only)
            const resp = await fetch("https://api.openai.com/v1/responses", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (!resp.ok) {
                const errorText = await resp.text();
                throw new Error(`OpenAI API Error: ${resp.status} - ${errorText}`);
            }

            const json = await resp.json() as any;
            console.log("AI: OpenAI Response:", JSON.stringify(json));
            
            const aiEndTime = Date.now();
            const aiResponseTimeMs = aiEndTime - aiStartTime;

            // Parse response
            let assistantMessage = "";
            
            if (json.output && Array.isArray(json.output)) {
                const messageItem = json.output.find((item: any) => item.type === "message");
                const contentItem = messageItem?.content?.find((c: any) => c.type === "output_text");
                assistantMessage = contentItem?.text || "";
            } else {
                assistantMessage = json.output_text || "";
            }

            if (!assistantMessage) {
                console.error("AI: Invalid response format:", json);
                throw new Error(`No valid response from OpenAI. Response: ${JSON.stringify(json)}`);
            }

            // Convert Markdown to HTML with inline styles
            // Fallback to simple HTML with line breaks if marked fails
            let replyHtml: string;
            try {
                replyHtml = await marked.parse(assistantMessage);
            } catch (markdownError) {
                console.warn("AI: Markdown parsing failed, using simple HTML fallback:", markdownError);
                // Simple HTML fallback: escape special chars but keep as valid HTML so footer can be appended
                replyHtml = '<div style="font-family: sans-serif; color: #333; line-height: 1.6; white-space: pre-wrap;">' + 
                    assistantMessage
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;') + 
                    '</div>';
            }

            return {
                summary: assistantMessage.substring(0, 500),
                reply: assistantMessage,
                replyHtml,
                tokensInput: json.usage?.input_tokens,
                tokensOutput: json.usage?.output_tokens,
                aiResponseTimeMs,
                openaiUploadTimeMs,
                openaiResponseId: json.id,
            };

        } catch (error) {
            console.error("AI: Error generating reply:", error);
            throw error;
        }
    }

    async fetch(request: Request): Promise<Response> {
        return new Response("AI Service Running");
    }
}
