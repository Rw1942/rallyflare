import { WorkerEntrypoint } from "cloudflare:workers";
import { AiRequest, AiResponse } from "shared/types";
import OpenAI from "openai";

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
            const openai = new OpenAI({
                apiKey: this.env.OPENAI_API_KEY,
            });

            // --- 1. Build Conversation History ---
            const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
                { role: "system", content: request.systemPrompt }
            ];

            // Add history (text-only for now)
            request.conversationHistory.forEach((msg) => {
                messages.push({
                    role: msg.role as "user" | "assistant",
                    content: msg.content
                });
            });

            // --- 2. Prepare Current Message Content ---
            let emailBody = request.postmarkData.TextBody || "(No body content)";
            const MAX_CONTENT_LENGTH = 50000;
            if (emailBody.length > MAX_CONTENT_LENGTH) {
                emailBody = emailBody.substring(0, MAX_CONTENT_LENGTH) + "\n\n[... truncated ...]";
            }

            // Construct text part with email metadata
            let textContent = `Current Email:\nFrom: ${request.postmarkData.FromFull?.Name} <${request.postmarkData.FromFull?.Email}>\nSubject: ${request.postmarkData.Subject}\n\n${emailBody}`;

            if (request.requestContext) {
                textContent += `\n\n---\nREQUEST CONTEXT:\n${JSON.stringify(request.requestContext)}`;
            }

            // Handle Attachments
            const contentParts: Array<OpenAI.Chat.ChatCompletionContentPart> = [];
            const nonImageAttachments: string[] = [];

            if (request.postmarkData.Attachments && request.postmarkData.Attachments.length > 0) {
                for (const att of request.postmarkData.Attachments) {
                    // Check if it's an image supported by OpenAI
                    if (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(att.ContentType)) {
                        contentParts.push({
                            type: "image_url",
                            image_url: {
                                // Postmark sends Content as base64
                                url: `data:${att.ContentType};base64,${att.Content}`,
                                detail: "auto"
                            }
                        });
                    } else {
                        nonImageAttachments.push(att.Name);
                    }
                }
            }

            // Add non-image attachments note to text
            if (nonImageAttachments.length > 0) {
                textContent += `\n\n[System Note: The user also attached the following files: ${nonImageAttachments.join(", ")}]`;
            }

            // Add text part first
            contentParts.unshift({ type: "text", text: textContent });

            // Add current message to history
            messages.push({
                role: "user",
                content: contentParts
            });

            const aiStartTime = Date.now();

            // --- 3. Call OpenAI API ---
            // Using gpt-4o for best vision/multimodal support
            const response = await openai.chat.completions.create({
                model: "gpt-4o", 
                messages: messages,
                max_tokens: 1000, // Increased for potentially longer visual descriptions
                temperature: 0.2,
            });

            const aiEndTime = Date.now();
            const aiResponseTimeMs = aiEndTime - aiStartTime;

            const assistantMessage = response.choices[0]?.message?.content || "";

            if (!assistantMessage) {
                throw new Error("No valid response from OpenAI");
            }

            return {
                summary: assistantMessage.substring(0, 500),
                reply: assistantMessage,
                tokensInput: response.usage?.prompt_tokens,
                tokensOutput: response.usage?.completion_tokens,
                aiResponseTimeMs,
                openaiResponseId: response.id,
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
