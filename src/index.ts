import { renderDashboard, renderSettings, renderEmailPrompts } from "./renderHtml";

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

    // Email prompts page (HTML) - must come before API routes
    if (path === "/email-prompts" && request.method === "GET") {
      return getEmailPromptsPage(env);
    }

    // Email prompts API endpoints
    if (path === "/api/email-prompts" && request.method === "GET") {
      return getEmailPrompts(env);
    }

    if (path === "/email-prompts" && request.method === "POST") {
      return createEmailPrompt(request, env);
    }

    if (path.startsWith("/email-prompts/") && request.method === "PUT") {
      const id = path.split("/")[2];
      return updateEmailPrompt(request, env, id);
    }

    if (path.startsWith("/email-prompts/") && request.method === "DELETE") {
      const id = path.split("/")[2];
      return deleteEmailPrompt(env, id);
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
    
    // Track processing time from the moment we receive the email
    const processingStartTime = Date.now();

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

    // Extract the Rally email address that received this message
    const rallyEmailAddress = postmarkData.OriginalRecipient || postmarkData.ToFull?.[0]?.Email || postmarkData.To;

    // Store message in D1
    await env.DB.prepare(`
      INSERT INTO messages (
        id, received_at, subject, message_id, in_reply_to, references_header,
        from_name, from_email, raw_text, raw_html,
        postmark_message_id, has_attachments, direction, email_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      'inbound',
      rallyEmailAddress
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
    const llmResponse = await processWithOpenAI(env, internalId, postmarkData, rallyEmailAddress);

    // Calculate total processing time (from receipt to reply sent)
    const processingEndTime = Date.now();
    const processingTimeMs = processingEndTime - processingStartTime;

    // Send reply email via Postmark
    let sentAt: string | null = null;
    if (llmResponse.reply) {
      sentAt = await sendReplyEmail(env, postmarkData, llmResponse.reply, internalId, {
        tokensInput: llmResponse.tokensInput,
        tokensOutput: llmResponse.tokensOutput,
        processingTimeMs: processingTimeMs,
        aiResponseTimeMs: llmResponse.aiResponseTimeMs,
      });
    }

    // Update message with LLM response, token usage, and performance metrics
    await env.DB.prepare(`
      UPDATE messages
      SET llm_summary = ?, llm_reply = ?, tokens_input = ?, tokens_output = ?, 
          processing_time_ms = ?, ai_response_time_ms = ?, sent_at = ?
      WHERE id = ?
    `).bind(
      llmResponse.summary, 
      llmResponse.reply, 
      llmResponse.tokensInput || null,
      llmResponse.tokensOutput || null,
      processingTimeMs,
      llmResponse.aiResponseTimeMs || null,
      sentAt,
      internalId
    ).run();

    return new Response(JSON.stringify({
      success: true,
      messageId: internalId,
      llm: llmResponse,
      processingTimeMs,
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
 * Fetches thread history from D1 and builds it into the input prompt for better context.
 * Uses email-specific prompts when available, falls back to default prompt.
 */
async function processWithOpenAI(env: Env, messageId: string, postmarkData: PostmarkInboundMessage, rallyEmailAddress: string): Promise<{ 
  summary: string; 
  reply: string; 
  tokensInput?: number; 
  tokensOutput?: number;
  aiResponseTimeMs?: number;
}> {
  try {
    // Get email-specific prompt first
    const emailPromptResult = await env.DB.prepare(
      "SELECT system_prompt FROM email_prompts WHERE email_address = ? LIMIT 1"
    ).bind(rallyEmailAddress).first();

    let systemPrompt: string;
    if (emailPromptResult?.system_prompt) {
      systemPrompt = emailPromptResult.system_prompt as string;
      console.log(`Using email-specific prompt for ${rallyEmailAddress}`);
    } else {
      // Fall back to default project settings
      const settingsResult = await env.DB.prepare(
        "SELECT * FROM project_settings WHERE project_slug = 'default' LIMIT 1"
      ).first();
      systemPrompt = settingsResult?.system_prompt as string || "You are Rally, an intelligent email assistant.";
      console.log(`Using default prompt for ${rallyEmailAddress}`);
    }

    // Fetch thread history: Get up to 5 previous messages in the chain
    // Use recursive CTE to traverse the thread via in_reply_to
    const threadQuery = `
      WITH RECURSIVE thread_chain AS (
        SELECT id, raw_text, llm_reply, direction, received_at, in_reply_to
        FROM messages
        WHERE id = ?
        UNION ALL
        SELECT m.id, m.raw_text, m.llm_reply, m.direction, m.received_at, m.in_reply_to
        FROM messages m
        JOIN thread_chain tc ON m.id = tc.in_reply_to
      )
      SELECT * FROM thread_chain
      ORDER BY received_at ASC
      LIMIT 6  -- Current + 5 previous
    `;
    
    const threadStmt = env.DB.prepare(threadQuery).bind(messageId);
    const { results: threadResults } = await threadStmt.all();
    
    // Build conversation history string
    let history = '';
    threadResults.forEach((msg: any, index: number) => {
      if (index > 0) { // Skip the current message for history
        if (msg.direction === 'inbound') {
          history += `\n\nPrevious User Message (${msg.received_at}):\n${msg.raw_text || ''}`;
        } else if (msg.direction === 'outbound' && msg.llm_reply) {
          history += `\n\nPrevious Assistant Reply (${msg.received_at}):\n${msg.llm_reply}`;
        }
      }
    });

    // Get current email content
    let emailContent = postmarkData.TextBody || postmarkData.StrippedTextReply || "";
    if (!emailContent.trim() && postmarkData.HtmlBody) {
      emailContent = stripHtmlToText(postmarkData.HtmlBody);
    }
    if (!emailContent.trim()) {
      emailContent = "(No body content)";
    }

    // Truncate if too long
    const MAX_CONTENT_LENGTH = 50000;
    if (emailContent.length > MAX_CONTENT_LENGTH) {
      emailContent = emailContent.substring(0, MAX_CONTENT_LENGTH) + "\n\n[... truncated ...]";
    }

    // Build full input prompt
    const input = `${systemPrompt}\n\nConversation History:${history}\n\nCurrent Email:\nFrom: ${postmarkData.FromFull?.Name} <${postmarkData.FromFull?.Email}>\nSubject: ${postmarkData.Subject}\n\n${emailContent}\n\nProvide a brief summary and a helpful reply.`;

    // API parameters
    const reasoningEffort = "low";
    const verbosity = "low";

    const requestPayload = {
      model: "gpt-5",
      input,
      reasoning: { effort: reasoningEffort },
      text: { verbosity: verbosity },
    };

    // Call OpenAI Responses API
    const aiStartTime = Date.now();
    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI error: ${await openaiResponse.text()}`);
    }

    const data = await openaiResponse.json() as any;
    const aiEndTime = Date.now();
    const aiResponseTimeMs = aiEndTime - aiStartTime;

    // Extract response - assuming output_text is the main content
    const assistantMessage = data.output_text || data.output?.find((item: any) => item.type === "message")?.content?.[0]?.text || "";

    if (!assistantMessage) {
      throw new Error("No valid response from OpenAI");
    }

    const tokensInput = data.usage?.input_tokens || data.usage?.prompt_tokens;
    const tokensOutput = data.usage?.output_tokens || data.usage?.completion_tokens;

    return {
      summary: assistantMessage.substring(0, 500),
      reply: assistantMessage,
      tokensInput,
      tokensOutput,
      aiResponseTimeMs,
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
 * Returns the timestamp when the email was sent
 */
async function sendReplyEmail(env: Env, originalMessage: PostmarkInboundMessage, replyBody: string, replyToMessageId: string, metrics?: {
  tokensInput?: number;
  tokensOutput?: number;
  processingTimeMs?: number;
  aiResponseTimeMs?: number;
}): Promise<string> {
  try {
    // Build the References header properly for email threading
    // It should include the entire chain of message IDs from the thread
    const originalReferences = originalMessage.Headers?.find((h: any) => h.Name === "References")?.Value || "";
    const referencesValue = originalReferences 
      ? `${originalReferences} ${originalMessage.MessageID}`
      : originalMessage.MessageID;

    // Set Reply-To to the original Rally address that received the email
    // This way, replies go back to that specific Rally inbox
    const replyToAddress = originalMessage.OriginalRecipient || originalMessage.ToFull?.[0]?.Email || originalMessage.To;

    // Detect if the reply contains HTML (look for common HTML tags)
    const isHtml = /<(p|div|br|h[1-6]|ul|ol|li|table|strong|em|a)\b[^>]*>/i.test(replyBody);
    
    // Add metrics to the reply body if available
    let finalReplyBody = replyBody;
    if (metrics && (metrics.tokensInput || metrics.tokensOutput || metrics.processingTimeMs)) {
      const metricsText = [];
      if (metrics.tokensInput || metrics.tokensOutput) {
        const totalTokens = (metrics.tokensInput || 0) + (metrics.tokensOutput || 0);
        metricsText.push(`Tokens: ${totalTokens} (${metrics.tokensInput || 0} in, ${metrics.tokensOutput || 0} out)`);
      }
      if (metrics.processingTimeMs) {
        const seconds = (metrics.processingTimeMs / 1000).toFixed(1);
        metricsText.push(`Processing time: ${seconds}s`);
      }
      
      if (metricsText.length > 0) {
        if (isHtml) {
          finalReplyBody += `<br><br><small style="color: #666; font-size: 0.8em;">Rally Stats: ${metricsText.join(' • ')}</small>`;
        } else {
          finalReplyBody += `\n\nRally Stats: ${metricsText.join(' • ')}`;
        }
      }
    }
    
    // Prepare email body - if HTML, send both HTML and plain text versions
    const emailBody: any = {
      From: "rally@rallycollab.com",
      ReplyTo: replyToAddress,
      To: originalMessage.FromFull?.Email || originalMessage.From,
      Subject: `Re: ${originalMessage.Subject}`,
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
    };

    if (isHtml) {
      // Send as HTML with plain text fallback
      emailBody.HtmlBody = finalReplyBody;
      emailBody.TextBody = stripHtmlToText(finalReplyBody);
    } else {
      // Send as plain text only
      emailBody.TextBody = finalReplyBody;
    }

    const response = await fetch(env.POSTMARK_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": env.POSTMARK_TOKEN,
      },
      body: JSON.stringify(emailBody),
    });

    const sentAt = new Date().toISOString();
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Postmark send error:", response.status, errorText);
      return sentAt; // Return timestamp even on error
    }
    
    console.log("Reply sent successfully");
    
    // Store the outbound message in D1
    const outboundId = crypto.randomUUID();
    
    // Get the email address from the original message
    const originalEmailAddress = await env.DB.prepare(
      "SELECT email_address FROM messages WHERE id = ?"
    ).bind(replyToMessageId).first();

    await env.DB.prepare(`
      INSERT INTO messages (
        id, sent_at, received_at, subject, message_id, in_reply_to,
        from_name, from_email, raw_text, direction, reply_to_message_id, email_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      outboundId,
      sentAt,
      sentAt, // Use sent_at for received_at to maintain compatibility
      `Re: ${originalMessage.Subject}`,
      null, // Will be set by Postmark after sending
      originalMessage.MessageID,
      "Rally",
      "rally@rallycollab.com",
      finalReplyBody,
      'outbound',
      replyToMessageId,
      originalEmailAddress?.email_address || null
    ).run();
    
    return sentAt;
  } catch (error) {
    console.error("Error sending reply:", error);
    return new Date().toISOString(); // Return timestamp even on error
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
 * Get email prompts page
 */
async function getEmailPromptsPage(env: Env): Promise<Response> {
  const stmt = env.DB.prepare("SELECT * FROM email_prompts ORDER BY email_address");
  const { results } = await stmt.all();

  return new Response(renderEmailPrompts(results as any[]), {
    headers: { "content-type": "text/html" },
  });
}

/**
 * Get all email prompts (API)
 */
async function getEmailPrompts(env: Env): Promise<Response> {
  const stmt = env.DB.prepare("SELECT * FROM email_prompts ORDER BY email_address");
  const { results } = await stmt.all();

  return new Response(JSON.stringify(results, null, 2), {
    headers: { "content-type": "application/json" },
  });
}

/**
 * Create a new email prompt
 */
async function createEmailPrompt(request: Request, env: Env): Promise<Response> {
  try {
    const data = await request.json() as { email_address: string; system_prompt: string };

    if (!data.email_address || !data.system_prompt) {
      return new Response(JSON.stringify({ error: "Email address and system prompt are required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    await env.DB.prepare(`
      INSERT INTO email_prompts (email_address, system_prompt)
      VALUES (?, ?)
    `).bind(data.email_address, data.system_prompt).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { "content-type": "application/json" },
    });

  } catch (error) {
    console.error("Error creating email prompt:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

/**
 * Update an existing email prompt
 */
async function updateEmailPrompt(request: Request, env: Env, id: string): Promise<Response> {
  try {
    const data = await request.json() as { email_address: string; system_prompt: string };

    if (!data.email_address || !data.system_prompt) {
      return new Response(JSON.stringify({ error: "Email address and system prompt are required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    await env.DB.prepare(`
      UPDATE email_prompts 
      SET email_address = ?, system_prompt = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(data.email_address, data.system_prompt, id).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { "content-type": "application/json" },
    });

  } catch (error) {
    console.error("Error updating email prompt:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

/**
 * Delete an email prompt
 */
async function deleteEmailPrompt(env: Env, id: string): Promise<Response> {
  try {
    await env.DB.prepare("DELETE FROM email_prompts WHERE id = ?").bind(id).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { "content-type": "application/json" },
    });

  } catch (error) {
    console.error("Error deleting email prompt:", error);
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
