import { WorkerEntrypoint } from "cloudflare:workers";
import { AiRequest, AiResponse } from "shared/types";
import { buildMultipart } from "./multipart";

export interface Env {
    OPENAI_API_KEY: string;
}

export default class AiService extends WorkerEntrypoint<Env> {
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

            let emailContent = request.postmarkData.TextBody || "(No body content)";
            const MAX_CONTENT_LENGTH = 50000;
            if (emailContent.length > MAX_CONTENT_LENGTH) {
                emailContent = emailContent.substring(0, MAX_CONTENT_LENGTH) + "\n\n[... truncated ...]";
            }

            let prompt = `${request.systemPrompt}\n\nConversation History:${historyStr}\n\nCurrent Email:\nFrom: ${request.postmarkData.FromFull?.Name} <${request.postmarkData.FromFull?.Email}>\nSubject: ${request.postmarkData.Subject}\n\n${emailContent}`;

            if (request.requestContext) {
                prompt += `\n\n---\nREQUEST CONTEXT:\n${JSON.stringify(request.requestContext)}`;
            }

            // 2. Prepare Request Body (JSON or Multipart)
            let body: any;
            let headers: Record<string, string> = {
                "Authorization": `Bearer ${this.env.OPENAI_API_KEY}`
            };

            const payload: any = {
                model: request.model,
                input: [{ role: "user", content: prompt }],
                max_output_tokens: request.maxOutputTokens,
            };

            if (request.reasoningEffort) payload.reasoning = { effort: request.reasoningEffort };
            if (request.textVerbosity) payload.text = { verbosity: request.textVerbosity };

            // Check for Attachments
            // We will take the FIRST attachment if available, to keep it simple per instructions.
            const attachment = request.postmarkData.Attachments?.[0];

            if (attachment) {
                console.log(`AI: Processing attachment: ${attachment.Name}`);
                
                // Convert Base64 to Uint8Array
                const binaryString = atob(attachment.Content);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                
                // Create File object (standard in Workers)
                const file = new File([bytes], attachment.Name, {
                    type: attachment.ContentType
                });

                // Use multipart helper
                const { body: multipartBody, boundary } = buildMultipart({
                    ...payload,
                    file // Attach the file
                });

                body = multipartBody;
                headers["Content-Type"] = `multipart/form-data; boundary=${boundary}`;
            } else {
                // Standard JSON request
                body = JSON.stringify(payload);
                headers["Content-Type"] = "application/json";
            }

            const aiStartTime = Date.now();

            // 3. Call OpenAI API via REST (gpt-5.1)
            const resp = await fetch("https://api.openai.com/v1/responses", {
                method: "POST",
                headers,
                body
            });

            if (!resp.ok) {
                const errorText = await resp.text();
                throw new Error(`OpenAI API Error: ${resp.status} - ${errorText}`);
            }

            const json = await resp.json() as any;
            console.log("AI: OpenAI Response:", JSON.stringify(json));
            
            const aiEndTime = Date.now();
            const aiResponseTimeMs = aiEndTime - aiStartTime;

            // Parse response from new format (output array) or fallback to old format (output_text)
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

            return {
                summary: assistantMessage.substring(0, 500),
                reply: assistantMessage,
                tokensInput: json.usage?.input_tokens,
                tokensOutput: json.usage?.output_tokens,
                aiResponseTimeMs,
                openaiResponseId: json.id,
            };

        } catch (error) {
            console.error("AI: Error generating reply:", error);
            return {
                summary: "Error processing with AI",
                reply: "Thank you for your email. We encountered an issue processing it with AI. We'll get back to you soon.",
                aiResponseTimeMs: 0,
            };
        }
    }

    async fetch(request: Request): Promise<Response> {
        return new Response("AI Service Running");
    }
}
