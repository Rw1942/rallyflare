import { WorkerEntrypoint } from "cloudflare:workers";

export interface Env {
    BUCKET: R2Bucket;
}

export default class AttachmentsService extends WorkerEntrypoint<Env> {
    /**
     * Upload an attachment to R2
     * @param filename The name of the file
     * @param contentBase64 The base64 encoded content
     * @param contentType The MIME type
     */
    async uploadAttachment(filename: string, contentBase64: string, contentType: string): Promise<{ key: string; size: number; url?: string }> {
        console.log("Attachments: Uploading", filename);

        try {
            // Decode base64
            const binaryString = atob(contentBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            const key = `${crypto.randomUUID()}-${filename}`;

            await this.env.BUCKET.put(key, bytes, {
                httpMetadata: {
                    contentType: contentType,
                },
            });

            console.log("Attachments: Uploaded", key);

            return {
                key,
                size: bytes.length,
                // url: `...` // If we had a public domain, we'd return it here
            };

        } catch (error) {
            console.error("Attachments: Error uploading:", error);
            throw error;
        }
    }

    async fetch(request: Request): Promise<Response> {
        return new Response("Attachments Service Running");
    }
}
