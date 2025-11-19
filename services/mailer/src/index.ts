import { WorkerEntrypoint } from "cloudflare:workers";
import { EmailReply } from "shared/types";

export interface Env {
    POSTMARK_TOKEN: string;
    POSTMARK_URL: string;
}

export default class MailerService extends WorkerEntrypoint<Env> {
    /**
     * Send an email via Postmark
     */
    async sendEmail(reply: EmailReply): Promise<{ success: boolean; sentAt?: string; error?: string }> {
        console.log("Mailer: Sending email to", reply.to);

        try {
            const emailBody = {
                From: "Rally <requests@rallycollab.com>",
                ReplyTo: reply.replyTo,
                To: reply.to,
                Subject: reply.subject,
                MessageStream: "outbound",
                TextBody: reply.textBody,
                HtmlBody: reply.htmlBody,
                Headers: [
                    {
                        Name: "In-Reply-To",
                        Value: reply.inReplyTo,
                    },
                    {
                        Name: "References",
                        Value: reply.references,
                    },
                ],
            };

            const response = await fetch(this.env.POSTMARK_URL, {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "X-Postmark-Server-Token": this.env.POSTMARK_TOKEN,
                },
                body: JSON.stringify(emailBody),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Mailer: Postmark send error:", response.status, errorText);
                return { success: false, error: `Postmark error: ${response.status} ${errorText}` };
            }

            const sentAt = new Date().toISOString();
            console.log("Mailer: Email sent successfully at", sentAt);
            return { success: true, sentAt };

        } catch (error) {
            console.error("Mailer: Internal error:", error);
            return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
        }
    }

    // Default fetch handler for testing/health check
    async fetch(request: Request): Promise<Response> {
        return new Response("Mailer Service Running");
    }
}
