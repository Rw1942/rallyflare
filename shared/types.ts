
export interface PostmarkInboundMessage {
    From: string;
    FromFull: {
        Email: string;
        Name: string;
        MailboxHash: string;
    };
    To: string;
    ToFull: {
        Email: string;
        Name: string;
        MailboxHash: string;
    }[];
    Cc: string;
    CcFull: {
        Email: string;
        Name: string;
        MailboxHash: string;
    }[];
    Bcc: string;
    BccFull: {
        Email: string;
        Name: string;
        MailboxHash: string;
    }[];
    OriginalRecipient: string;
    Subject: string;
    MessageID: string;
    ReplyTo: string;
    MailboxHash: string;
    Date: string;
    TextBody: string;
    HtmlBody: string;
    StrippedTextReply: string;
    Tag: string;
    Headers: {
        Name: string;
        Value: string;
    }[];
    Attachments: {
        Name: string;
        Content: string;
        ContentType: string;
        ContentLength: number;
    }[];
}

export interface EmailReply {
    to: string;
    subject: string;
    textBody: string;
    htmlBody: string;
    replyTo: string;
    inReplyTo: string;
    references: string;
    originalMessageId: string; // For logging
}

export interface AiRequest {
    messageId: string;
    postmarkData: PostmarkInboundMessage;
    rallyEmailAddress: string;
    systemPrompt: string;
    conversationHistory: {
        role: "user" | "assistant";
        content: string;
        receivedAt: string;
    }[];
    requestContext?: any;
}

export interface AiResponse {
    summary: string;
    reply: string;
    tokensInput?: number;
    tokensOutput?: number;
    aiResponseTimeMs?: number;
    extractedData?: any;
    openaiResponseId?: string;
}
