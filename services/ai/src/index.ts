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

            // Build history string
            let historyStr = "";
            request.conversationHistory.forEach((msg) => {
                if (msg.role === "user") {
                    historyStr += `\n\nPrevious User Message (${msg.receivedAt}):\n${msg.content}`;
                } else {
                    historyStr += `\n\nPrevious Assistant Reply (${msg.receivedAt}):\n${msg.content}`;
                }
            });

            // Get current email content
            let emailContent = request.postmarkData.TextBody || "(No body content)";
            const MAX_CONTENT_LENGTH = 50000;
            if (emailContent.length > MAX_CONTENT_LENGTH) {
                emailContent = emailContent.substring(0, MAX_CONTENT_LENGTH) + "\n\n[... truncated ...]";
            }

            // Build prompt
            let input = `${request.systemPrompt}\n\nConversation History:${historyStr}\n\nCurrent Email:\nFrom: ${request.postmarkData.FromFull?.Name} <${request.postmarkData.FromFull?.Email}>\nSubject: ${request.postmarkData.Subject}\n\n${emailContent}`;

            // Request context (simplified from original for now, can be expanded)
            if (request.requestContext) {
                input += `\n\n---\nREQUEST CONTEXT:\n${JSON.stringify(request.requestContext)}`;
            }

            const aiStartTime = Date.now();

            // Using GPT-5.1 as per user request and documentation
            const response = await (openai as any).responses.create({
                model: "gpt-5.1",
                input,
                reasoning: { effort: "low" },
                text: { verbosity: "low" },
                max_output_tokens: 500,
            });

            const aiEndTime = Date.now();
            const aiResponseTimeMs = aiEndTime - aiStartTime;

            const assistantMessage = response.output_text || "";

            if (!assistantMessage) {
                throw new Error("No valid response from OpenAI");
            }

            return {
                summary: assistantMessage.substring(0, 500),
                reply: assistantMessage,
                tokensInput: response.usage?.input_tokens,
                tokensOutput: response.usage?.output_tokens,
                aiResponseTimeMs,
                openaiResponseId: response.id,
            };

        } catch (error) {
            console.error("AI: Error generating reply:", error);
            // Return a safe fallback so the system doesn't crash, but indicate error
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
