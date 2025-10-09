import { renderDashboard, renderSettings } from "./renderHtml";

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

    // Settings page - where admins configure Rally's AI behavior
    if (path === "/settings" && request.method === "GET") {
      return getSettings(env);
    }

    if (path === "/settings" && request.method === "POST") {
      return updateSettings(request, env);
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
 * Strip HTML tags and decode entities to get plain text
 * Used as fallback when TextBody is empty (common with forwarded HTML emails)
 */
function stripHtmlToText(html: string): string {
  // Remove script and style tags with their content
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Replace common block elements with line breaks
  text = text.replace(/<\/?(div|p|br|tr|h[1-6])[^>]*>/gi, '\n');
  
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');
  
  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  
  // Clean up excessive whitespace
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n'); // Max 2 consecutive newlines
  text = text.replace(/[ \t]+/g, ' '); // Multiple spaces to single space
  
  return text.trim();
}

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
 * Uses GPT-5 with the Responses API for optimal email understanding and generation
 */
async function processWithOpenAI(env: Env, messageId: string, postmarkData: PostmarkInboundMessage): Promise<{ summary: string; reply: string }> {
  try {
    // Get project settings - these control how Rally thinks and responds
    const settingsResult = await env.DB.prepare(
      "SELECT * FROM project_settings WHERE project_slug = 'default' LIMIT 1"
    ).first();

    const systemPrompt = settingsResult?.system_prompt as string || "You are Rally, an intelligent email assistant.";
    
    // GPT-5 uses reasoning effort and verbosity instead of temperature
    // For email: low reasoning = fast responses, low verbosity = concise replies
    const reasoningEffort = "low"; // Fast, suitable for email processing
    const verbosity = "low"; // Concise responses

    // Try multiple sources for email content, including HTML for forwarded emails
    // TextBody = full plain text (best for forwards)
    // StrippedTextReply = only new content in replies (strips quoted text)
    // HtmlBody = fallback for HTML-only emails
    let emailContent = postmarkData.TextBody || postmarkData.StrippedTextReply || "";
    
    // If no text body, try to extract from HTML (common with forwarded emails)
    if (!emailContent.trim() && postmarkData.HtmlBody) {
      console.log("No text body found, extracting from HTML");
      emailContent = stripHtmlToText(postmarkData.HtmlBody);
    }

    // Validate we have content to process
    if (!emailContent.trim()) {
      console.warn("Empty email body received - no TextBody, StrippedTextReply, or HtmlBody");
      console.log("Postmark data fields:", {
        hasTextBody: !!postmarkData.TextBody,
        hasStrippedTextReply: !!postmarkData.StrippedTextReply,
        hasHtmlBody: !!postmarkData.HtmlBody,
        subject: postmarkData.Subject,
      });
      return {
        summary: `Email from ${postmarkData.FromFull?.Email} - Subject: ${postmarkData.Subject}`,
        reply: "Thank you for your email. We've received it and will respond shortly.",
      };
    }

    console.log("Processing email - Length:", emailContent.length, "From:", postmarkData.FromFull?.Email, "Has HTML fallback:", !postmarkData.TextBody && !!postmarkData.HtmlBody);

    // Truncate extremely long emails (forwarded threads can be huge)
    // GPT-5 context window is large, but let's be reasonable with email threads
    const MAX_EMAIL_LENGTH = 50000; // ~50k chars = plenty for email threads
    if (emailContent.length > MAX_EMAIL_LENGTH) {
      console.warn(`Email content truncated from ${emailContent.length} to ${MAX_EMAIL_LENGTH} chars`);
      emailContent = emailContent.substring(0, MAX_EMAIL_LENGTH) + "\n\n[... content truncated due to length ...]";
    }

    // Build the input with system instructions and user content
    const inputPrompt = `${systemPrompt}\n\nPlease provide a brief summary and a helpful reply to this email:\n\nFrom: ${postmarkData.FromFull?.Name} <${postmarkData.FromFull?.Email}>\nSubject: ${postmarkData.Subject}\n\n${emailContent}`;

    const requestPayload = {
      model: "gpt-5",
      input: inputPrompt,
      reasoning: { effort: reasoningEffort },
      text: { verbosity: verbosity },
    };

    console.log("Sending to OpenAI:", {
      model: requestPayload.model,
      inputLength: inputPrompt.length,
      reasoning: requestPayload.reasoning,
      verbosity: requestPayload.text,
    });

    // Call OpenAI Responses API (GPT-5)
    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });

    if (!openaiResponse.ok) {
      const errorBody = await openaiResponse.text();
      console.error("OpenAI API error:", openaiResponse.status, errorBody);
      throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorBody}`);
    }

    const data = await openaiResponse.json() as any;
    
    // Log the full response structure for debugging
    console.log("OpenAI response structure:", JSON.stringify(data, null, 2));
    
    // The Responses API returns output_text at the top level
    // But let's handle multiple possible structures
    const assistantMessage = data.output_text 
      || data.choices?.[0]?.message?.content 
      || data.text 
      || "";

    if (!assistantMessage) {
      console.error("No message found in OpenAI response. Full data:", data);
      throw new Error("No response generated by OpenAI");
    }

    console.log("Generated response length:", assistantMessage.length);

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
    // Build the References header properly for email threading
    // It should include the entire chain of message IDs from the thread
    const originalReferences = originalMessage.Headers?.find((h: any) => h.Name === "References")?.Value || "";
    const referencesValue = originalReferences 
      ? `${originalReferences} ${originalMessage.MessageID}`
      : originalMessage.MessageID;

    // Reply from the same address that received the email
    const replyFromAddress = originalMessage.OriginalRecipient || originalMessage.ToFull?.[0]?.Email || originalMessage.To;

    const response = await fetch(env.POSTMARK_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": env.POSTMARK_TOKEN,
      },
      body: JSON.stringify({
        From: replyFromAddress,
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
            Value: referencesValue,
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
 * Get settings page
 * Shows current system prompt that controls Rally's AI behavior
 */
async function getSettings(env: Env): Promise<Response> {
  const settings = await env.DB.prepare(
    "SELECT system_prompt FROM project_settings WHERE project_slug = 'default' LIMIT 1"
  ).first();

  return new Response(renderSettings(settings as any), {
    headers: { "content-type": "text/html" },
  });
}

/**
 * Update settings
 * Admins can modify how Rally interprets and responds to emails
 * GPT-5 uses fixed reasoning/verbosity settings optimized for email
 */
async function updateSettings(request: Request, env: Env): Promise<Response> {
  try {
    const data = await request.json() as { system_prompt: string };

    // Validate input
    if (!data.system_prompt || data.system_prompt.trim().length === 0) {
      return new Response(JSON.stringify({ error: "System prompt is required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // Update settings in D1
    // GPT-5 doesn't use temperature - reasoning effort and verbosity are set in the code
    await env.DB.prepare(`
      INSERT INTO project_settings (project_slug, model, system_prompt)
      VALUES ('default', 'gpt-5', ?)
      ON CONFLICT(project_slug) 
      DO UPDATE SET system_prompt = ?, model = 'gpt-5'
    `).bind(
      data.system_prompt,
      data.system_prompt
    ).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { "content-type": "application/json" },
    });

  } catch (error) {
    console.error("Error updating settings:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
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
