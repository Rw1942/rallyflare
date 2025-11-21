// Common types used across all Email2ChatGPT services

/**
 * Postmark inbound webhook payload structure.
 * This is what we receive when someone emails a Rally address.
 */
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
        ContentID?: string;
    }[];
}

