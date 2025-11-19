import { WorkerEntrypoint } from "cloudflare:workers";
import { AiRequest, AiResponse } from "shared/types";
import { buildMultipart } from "./multipart";

export interface Env {
    OPENAI_API_KEY: string;
}

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

            // 2. Handle document attachments only (skip images - they're already in text as [Image] markers)
            const validAttachments = request.postmarkData.Attachments?.filter(att => {
                if (att.ContentType.startsWith("image/")) {
                    console.log(`AI: Skipping image ${att.Name} (images already represented in text)`);
                    return false;
                }
                // Only include document types that OpenAI supports
                const supportedTypes = [
                    'application/pdf',
                    'text/plain',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/vnd.ms-excel',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'text/csv',
                    'application/json',
                    'text/html',
                    'text/markdown'
                ];
                if (!supportedTypes.includes(att.ContentType)) {
                    console.log(`AI: Skipping unsupported attachment ${att.Name} (${att.ContentType})`);
                    return false;
                }
                return true;
            }) || [];

            const userMessageContent: any[] = [];
            let openaiUploadTimeMs = 0;

            // Upload document attachments to Files API
            if (validAttachments.length > 0) {
                console.log(`AI: Processing ${validAttachments.length} document attachments`);
                const uploadStartTime = Date.now();

                const uploadPromises = validAttachments.map(async (attachment) => {
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

                fileIds.forEach(fileId => {
                    userMessageContent.push({
                        type: "input_file",
                        file_id: fileId
                    });
                });
            }

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

            // 4. Call OpenAI Responses API
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
            console.log("AI: OpenAI Response received");

            const aiEndTime = Date.now();
            const aiResponseTimeMs = aiEndTime - aiStartTime;

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

            const reasoningTokens = json.usage?.output_tokens_details?.reasoning_tokens;
            const cachedTokens = json.usage?.input_tokens_details?.cached_tokens;

            return {
                summary: assistantMessage.substring(0, 500),
                reply: assistantMessage,
                tokensInput: json.usage?.input_tokens,
                tokensOutput: json.usage?.output_tokens,
                reasoningTokens,
                cachedTokens,
                aiResponseTimeMs,
                openaiUploadTimeMs,
                openaiResponseId: json.id,
                serviceTier: json.service_tier,
                reasoningEffort: json.reasoning?.effort,
                temperature: json.temperature,
                textVerbosity: json.text?.verbosity,
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
