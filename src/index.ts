import { renderDashboard } from "./renderHtml";

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Route handling
    if (path === "/postmark/inbound" && request.method === "POST") {
      return handlePostmarkInbound(request, env);
    }

    if (path === "/messages" && request.method === "GET") {
      return listMessages(env);
    }

    if (path.startsWith("/messages/") && request.method === "GET") {
      const id = path.split("/")[2];
      return getMessageDetail(env, id);
    }

    // Default route - show dashboard with recent messages
    const stmt = env.DB.prepare("SELECT * FROM messages ORDER BY received_at DESC LIMIT 50");
    const { results } = await stmt.all();

    return new Response(renderDashboard(results as any[]), {
      headers: {
        "content-type": "text/html",
      },
    });
  },
} satisfies ExportedHandler<Env>;

/**
 * Handle Postmark inbound webhook
 * Postmark sends JSON payload with email data
 */
async function handlePostmarkInbound(request: Request, env: Env): Promise<Response> {
  try {
    const postmarkData = await request.json() as PostmarkInboundMessage;

    console.log("Received inbound email:", {
      from: postmarkData.FromFull?.Email,
      subject: postmarkData.Subject,
      messageId: postmarkData.MessageID,
    });

    // Generate our internal ID
    const internalId = crypto.randomUUID();
    const receivedAt = new Date().toISOString();

    // Parse participants
    const toList = postmarkData.ToFull || [];
    const ccList = postmarkData.CcFull || [];

    // Store message in D1
    await env.DB.prepare(`
      INSERT INTO messages (
        id, received_at, subject, message_id, in_reply_to, references_header,
        from_name, from_email, raw_text, raw_html,
        postmark_message_id, has_attachments, direction
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      internalId,
      receivedAt,
      postmarkData.Subject || "(no subject)",
      postmarkData.MessageID,
      postmarkData.Headers?.find((h: any) => h.Name === "In-Reply-To")?.Value || null,
      postmarkData.Headers?.find((h: any) => h.Name === "References")?.Value || null,
      postmarkData.FromFull?.Name || "",
      postmarkData.FromFull?.Email || postmarkData.From,
      postmarkData.TextBody || "",
      postmarkData.HtmlBody || "",
      postmarkData.MessageID,
      (postmarkData.Attachments?.length || 0) > 0 ? 1 : 0,
      'inbound'
    ).run();

    // Store participants (To)
    for (const recipient of toList) {
      await env.DB.prepare(`
        INSERT INTO participants (message_id, kind, name, email)
        VALUES (?, 'to', ?, ?)
      `).bind(internalId, recipient.Name || "", recipient.Email).run();
    }

    // Store participants (Cc)
    for (const recipient of ccList) {
      await env.DB.prepare(`
        INSERT INTO participants (message_id, kind, name, email)
        VALUES (?, 'cc', ?, ?)
      `).bind(internalId, recipient.Name || "", recipient.Email).run();
    }

    // Store attachments metadata (if any)
    if (postmarkData.Attachments && postmarkData.Attachments.length > 0) {
      for (const attachment of postmarkData.Attachments) {
        await env.DB.prepare(`
          INSERT INTO attachments (message_id, filename, mime, size_bytes, r2_key)
          VALUES (?, ?, ?, ?, ?)
        `).bind(
          internalId,
          attachment.Name,
          attachment.ContentType,
          attachment.ContentLength || 0,
          null // R2 upload not implemented yet
        ).run();
      }
    }

    // Process with OpenAI
    const llmResponse = await processWithOpenAI(env, internalId, postmarkData);

    // Update message with LLM response
    await env.DB.prepare(`
      UPDATE messages
      SET llm_summary = ?, llm_reply = ?
      WHERE id = ?
    `).bind(llmResponse.summary, llmResponse.reply, internalId).run();

    // Send reply email via Postmark
    if (llmResponse.reply) {
      await sendReplyEmail(env, postmarkData, llmResponse.reply, internalId);
    }

    return new Response(JSON.stringify({
      success: true,
      messageId: internalId,
      llm: llmResponse,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  } catch (error) {
    console.error("Error handling Postmark webhook:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

/**
 * Process email content with OpenAI
 */
async function processWithOpenAI(env: Env, messageId: string, postmarkData: PostmarkInboundMessage): Promise<{ summary: string; reply: string }> {
  try {
    // Get project settings
    const settingsResult = await env.DB.prepare(
      "SELECT * FROM project_settings WHERE project_slug = 'default' LIMIT 1"
    ).first();

    const model = settingsResult?.model as string || "gpt-4o-mini";
    const systemPrompt = settingsResult?.system_prompt as string || "You are Rally, an intelligent email assistant.";
    const temperature = settingsResult?.temperature as number || 0.2;

    const emailContent = postmarkData.TextBody || postmarkData.StrippedTextReply || "";

    // Call OpenAI API
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: `Please provide a brief summary and a helpful reply to this email:\n\nFrom: ${postmarkData.FromFull?.Name} <${postmarkData.FromFull?.Email}>\nSubject: ${postmarkData.Subject}\n\n${emailContent}`,
          },
        ],
      }),
    });

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const data = await openaiResponse.json() as any;
    const assistantMessage = data.choices?.[0]?.message?.content || "No response generated";

    return {
      summary: assistantMessage.substring(0, 500), // First 500 chars as summary
      reply: assistantMessage,
    };

  } catch (error) {
    console.error("OpenAI processing error:", error);
    return {
      summary: "Error processing with AI",
      reply: "Thank you for your email. We've received it and will respond shortly.",
    };
  }
}

/**
 * Send reply email via Postmark
 */
async function sendReplyEmail(env: Env, originalMessage: PostmarkInboundMessage, replyBody: string, replyToMessageId: string): Promise<void> {
  try {
    const response = await fetch(env.POSTMARK_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": env.POSTMARK_TOKEN,
      },
      body: JSON.stringify({
        From: "requests@rallycollab.com",
        To: originalMessage.FromFull?.Email || originalMessage.From,
        Subject: `Re: ${originalMessage.Subject}`,
        TextBody: replyBody,
        MessageStream: "outbound",
        Headers: [
          {
            Name: "In-Reply-To",
            Value: originalMessage.MessageID,
          },
          {
            Name: "References",
            Value: originalMessage.MessageID,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Postmark send error:", response.status, errorText);
    } else {
      console.log("Reply sent successfully");
      
      // Store the outbound message in D1
      const outboundId = crypto.randomUUID();
      const sentAt = new Date().toISOString();
      
      await env.DB.prepare(`
        INSERT INTO messages (
          id, sent_at, received_at, subject, message_id, in_reply_to,
          from_name, from_email, raw_text, direction, reply_to_message_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        outboundId,
        sentAt,
        sentAt, // Use sent_at for received_at to maintain compatibility
        `Re: ${originalMessage.Subject}`,
        null, // Will be set by Postmark after sending
        originalMessage.MessageID,
        "Rally",
        "requests@rallycollab.com",
        replyBody,
        'outbound',
        replyToMessageId
      ).run();
    }
  } catch (error) {
    console.error("Error sending reply:", error);
  }
}

/**
 * List all messages (for console)
 */
async function listMessages(env: Env): Promise<Response> {
  const stmt = env.DB.prepare("SELECT * FROM messages ORDER BY received_at DESC LIMIT 50");
  const { results } = await stmt.all();

  return new Response(JSON.stringify(results, null, 2), {
    headers: { "content-type": "application/json" },
  });
}

/**
 * Get message detail (for console)
 */
async function getMessageDetail(env: Env, id: string): Promise<Response> {
  const message = await env.DB.prepare("SELECT * FROM messages WHERE id = ?").bind(id).first();

  if (!message) {
    return new Response(JSON.stringify({ error: "Message not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const participants = await env.DB.prepare("SELECT * FROM participants WHERE message_id = ?").bind(id).all();
  const attachments = await env.DB.prepare("SELECT * FROM attachments WHERE message_id = ?").bind(id).all();

  return new Response(JSON.stringify({
    message,
    participants: participants.results,
    attachments: attachments.results,
  }, null, 2), {
    headers: { "content-type": "application/json" },
  });
}

/**
 * Postmark Inbound Message Type
 * Based on Postmark's webhook payload format
 */
interface PostmarkInboundMessage {
  FromName: string;
  MessageStream: string;
  From: string;
  FromFull?: {
    Email: string;
    Name: string;
    MailboxHash: string;
  };
  To: string;
  ToFull?: Array<{
    Email: string;
    Name: string;
    MailboxHash: string;
  }>;
  Cc?: string;
  CcFull?: Array<{
    Email: string;
    Name: string;
    MailboxHash: string;
  }>;
  Bcc?: string;
  BccFull?: Array<{
    Email: string;
    Name: string;
    MailboxHash: string;
  }>;
  OriginalRecipient: string;
  Subject: string;
  MessageID: string;
  ReplyTo?: string;
  MailboxHash: string;
  Date: string;
  TextBody?: string;
  HtmlBody?: string;
  StrippedTextReply?: string;
  Tag?: string;
  Headers?: Array<{
    Name: string;
    Value: string;
  }>;
  Attachments?: Array<{
    Name: string;
    Content: string;
    ContentType: string;
    ContentLength: number;
  }>;
}
