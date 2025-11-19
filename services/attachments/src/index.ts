import { WorkerEntrypoint } from "cloudflare:workers";

export interface Env {
    // BUCKET: R2Bucket; // R2 disabled for POC
}

export default class AttachmentsService extends WorkerEntrypoint<Env> {
    /**
     * Upload an attachment to R2
     * @param filename The name of the file
     * @param contentBase64 The base64 encoded content
     * @param contentType The MIME type
     */
    async uploadAttachment(filename: string, contentBase64: string, contentType: string): Promise<{ key: string; size: number; url?: string }> {
        console.log("Attachments: Uploading (STUBBED)", filename);

        try {
            // Decode base64 to get size
            const binaryString = atob(contentBase64);
            const size = binaryString.length;
            const key = `stub-${crypto.randomUUID()}-${filename}`;

            // Stubbed upload - no R2 interaction
            console.log("Attachments: Upload stubbed", key);

            return {
                key,
                size,
                url: "https://example.com/stubbed-attachment"
            };

        } catch (error) {
            console.error("Attachments: Error uploading:", error);
            throw error;
        }
    }

    async fetch(request: Request): Promise<Response> {
        return new Response("Attachments Service Running (Stubbed)");
    }
}
