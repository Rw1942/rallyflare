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
            purpose: "user_data" // Recommended for files passed as input_file to Responses API
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
     * Fire a single request to OpenAI Responses API.
     * Returns parsed JSON on success, or null on failure (caller decides retry strategy).
     */
    private async callOpenAI(payload: any): Promise<any | null> {
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
            console.error(`AI: OpenAI API Error: ${resp.status} - ${errorText}`);
            return null;
        }

        const json = await resp.json() as any;
        console.log("AI: OpenAI Response received");
        return json;
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
            // Use top-level `instructions` for system prompt (cleaner Responses API semantics)
            const payload: any = {
                model: request.model,
                instructions: request.systemPrompt,
                input: [{ role: "user", content: userMessageContent }],
                max_output_tokens: request.maxOutputTokens,
                store: false, // Don't persist email content on OpenAI's side
            };

            if (request.reasoningEffort) payload.reasoning = { effort: request.reasoningEffort };
            if (request.textVerbosity) payload.text = { verbosity: request.textVerbosity };

            // Conditionally enable web search tool (GA version)
            const webSearchRequested = !!request.webSearchEnabled;
            if (webSearchRequested) {
                const webSearchTool: any = { type: "web_search" };
                if (request.webSearchContextSize) {
                    webSearchTool.search_context_size = request.webSearchContextSize;
                }
                payload.tools = [webSearchTool];
                // Request source URLs so we can count them for observability
                payload.include = ["web_search_call.action.sources"];
                console.log(`AI: Web search enabled (context_size: ${request.webSearchContextSize || 'medium'})`);
            }

            const aiStartTime = Date.now();
            let json = await this.callOpenAI(payload);

            // Fallback: if the request with web search failed, retry without it
            if (!json && webSearchRequested) {
                console.warn("AI: Web search request failed, retrying without web search tool");
                delete payload.tools;
                delete payload.include;
                json = await this.callOpenAI(payload);
            }

            if (!json) {
                throw new Error("OpenAI API returned no parseable response after all attempts");
            }

            const aiEndTime = Date.now();
            const aiResponseTimeMs = aiEndTime - aiStartTime;

            // Extract text from all completed assistant message items in the output array.
            // The output can contain reasoning items, web_search_call items, tool calls, and
            // multiple messages; we aggregate every output_text part and detect refusals.
            let assistantMessage = "";
            let refusalMessage = "";
            let webSearchUsed = false;
            let webSearchSourceCount = 0;

            if (json.output && Array.isArray(json.output)) {
                const outputTypes = json.output.map((item: any) => item.type);
                console.log("AI: Output item types:", outputTypes.join(", "));

                for (const item of json.output) {
                    // Track web search tool usage
                    if (item.type === "web_search_call") {
                        webSearchUsed = true;
                        // Sources are attached to the action when include param is set
                        const sources = item.action?.sources;
                        if (Array.isArray(sources)) {
                            webSearchSourceCount += sources.length;
                        }
                    }

                    if (item.type !== "message" || !Array.isArray(item.content)) continue;
                    for (const part of item.content) {
                        if (part.type === "output_text" && part.text) {
                            assistantMessage += (assistantMessage ? "\n" : "") + part.text;
                        } else if (part.type === "refusal" && part.refusal) {
                            refusalMessage = part.refusal;
                        }
                    }
                }
            }

            // Fallback: SDK-style top-level convenience field
            if (!assistantMessage && json.output_text) {
                assistantMessage = json.output_text;
            }

            if (!assistantMessage) {
                if (refusalMessage) {
                    console.warn("AI: Model refused the request:", refusalMessage);
                    assistantMessage = `I'm unable to process this request. Reason: ${refusalMessage}`;
                } else {
                    console.error("AI: No text in response. Output:", JSON.stringify(json.output));
                    throw new Error(`No valid response from OpenAI. Response id: ${json.id}`);
                }
            }

            if (webSearchUsed) {
                console.log(`AI: Web search used, ${webSearchSourceCount} source(s) retrieved`);
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
                model: json.model || request.model,
                serviceTier: json.service_tier,
                reasoningEffort: json.reasoning?.effort,
                textVerbosity: json.text?.verbosity,
                webSearchUsed,
                webSearchSourceCount: webSearchUsed ? webSearchSourceCount : undefined,
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
