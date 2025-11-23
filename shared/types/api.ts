// Service-to-service API contracts
// These define how rally-ingest, rally-ai, rally-mailer, and rally-attachments communicate

import type { PostmarkInboundMessage } from './common';

/**
 * rally-mailer API contract
 * Used by rally-ingest to send outbound emails via Postmark
 */
export interface EmailReply {
    from: string; // The Rally email address that received the original message
    to: string;
    cc?: string;
    subject: string;
    textBody: string;
    htmlBody: string;
    replyTo: string;
    inReplyTo: string;
    references: string;
    originalMessageId: string; // For logging
}

/**
 * rally-ai API contract: Request
 * Sent from rally-ingest to rally-ai for GPT-5.1 processing
 */
export interface AiRequest {
    messageId: string;
    postmarkData: PostmarkInboundMessage;
    rallyEmailAddress: string;
    systemPrompt: string;
    model: string;
    reasoningEffort: string;
    textVerbosity: string;
    maxOutputTokens: number;
    conversationHistory: {
        role: "user" | "assistant";
        content: string;
        receivedAt: string;
    }[];
    requestContext?: any;
    processedTextContent?: string; // The processed text body (flattened HTML + attachment list)
}

/**
 * rally-ai API contract: Response
 * Returned from rally-ai back to rally-ingest with AI-generated content
 */
export interface AiResponse {
    summary: string;
    reply: string; // Plain text only - ingest handles formatting
    tokensInput?: number;
    tokensOutput?: number;
    reasoningTokens?: number; // Tokens used for reasoning (separate from regular output)
    cachedTokens?: number; // Input tokens served from cache (prompt caching)
    aiResponseTimeMs?: number;
    openaiUploadTimeMs?: number;
    extractedData?: any;
    openaiResponseId?: string;
    serviceTier?: string; // OpenAI service tier used (e.g., "default", "auto")
    reasoningEffort?: string; // Reasoning effort level used
    temperature?: number; // Temperature setting used
    textVerbosity?: string; // Text verbosity level used
}

