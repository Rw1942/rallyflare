import { Service } from "cloudflare:workers";
import type MailerService from "../../mailer/src/index";
import type AiService from "../../ai/src/index";
import type AttachmentsService from "../../attachments/src/index";

export interface Env {
  DB: D1Database;
  MAILER: Service<MailerService>;
  AI: Service<AiService>;
  ATTACHMENTS: Service<AttachmentsService>;
  WEBHOOK_USERNAME: string;
  WEBHOOK_PASSWORD: string;
}

