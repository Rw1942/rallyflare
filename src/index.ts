import { renderDashboard, renderSettings, renderEmailPrompts, renderRequestsPage, renderRequestDetail } from "./renderHtml";

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

    // Users management routes
    if (path === "/users" && request.method === "GET") {
      return listUsers(env);
    }

    if (path.startsWith("/users/") && request.method === "GET") {
      const email = decodeURIComponent(path.split("/")[2]);
      return getUserDetail(env, email);
    }

    if (path === "/api/users" && request.method === "GET") {
      return getUsersAPI(env);
    }

    // Requests tracking routes
    if (path === "/requests" && request.method === "GET") {
      return listRequests(env);
    }

    if (path.startsWith("/requests/") && request.method === "GET") {
      const id = path.split("/")[2];
      return getRequestDetail(env, id);
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

    // Extract compliance data from request headers
    const ipAddress = request.headers.get('cf-connecting-ip') || 
                     request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || null;
    const userAgent = request.headers.get('user-agent') || null;

    console.log("Received inbound email:", {
      from: postmarkData.FromFull?.Email,
      subject: postmarkData.Subject,
      messageId: postmarkData.MessageID,
      ipAddress: ipAddress,
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

    // Capture user data for compliance tracking
    await captureUser(env, postmarkData.FromFull?.Email || postmarkData.From, {
      name: postmarkData.FromFull?.Name || "",
      ipAddress: ipAddress,
      userAgent: userAgent,
      messageId: internalId,
      interactionType: 'inbound',
    });

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

    // Check if this email is part of a request/response workflow
    const requestContext = await detectRequestContext(env, internalId, postmarkData);

    // Process with OpenAI (including request context if applicable)
    const llmResponse = await processWithOpenAI(env, internalId, postmarkData, rallyEmailAddress, requestContext);

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

    // If we extracted structured data, save it to the response
    if (llmResponse.extractedData && requestContext?.isResponse) {
      await env.DB.prepare(`
        UPDATE responses 
        SET extracted_data = ?
        WHERE message_id = ?
      `).bind(JSON.stringify(llmResponse.extractedData), internalId).run();
    }

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
async function processWithOpenAI(env: Env, messageId: string, postmarkData: PostmarkInboundMessage, rallyEmailAddress: string, requestContext?: any): Promise<{ 
  summary: string; 
  reply: string; 
  tokensInput?: number; 
  tokensOutput?: number;
  aiResponseTimeMs?: number;
  extractedData?: any;
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

    // Build full input prompt with optional request context
    let input = `${systemPrompt}\n\nConversation History:${history}\n\nCurrent Email:\nFrom: ${postmarkData.FromFull?.Name} <${postmarkData.FromFull?.Email}>\nSubject: ${postmarkData.Subject}\n\n${emailContent}`;

    // Add request context if this is part of a request workflow
    if (requestContext) {
      input += `\n\n---\nREQUEST CONTEXT:\n`;
      if (requestContext.isNewRequest) {
        input += `This email appears to be starting a new data collection request. Extract:\n- Request title\n- Expected participants (email addresses)\n- Deadline\n- Required data fields\n\nRespond acknowledging the request has been tracked.`;
      } else if (requestContext.isResponse) {
        input += `This is a response to: "${requestContext.requestTitle}"\n`;
        input += `Status: ${requestContext.totalResponses}/${requestContext.expectedCount} responses received\n`;
        input += `Still waiting on: ${requestContext.missingParticipants?.join(', ') || 'none'}\n\n`;
        input += `Extract any structured data from this response (e.g., budget numbers, headcount, dates) as JSON.\n`;
        input += `Acknowledge receipt and provide status update.`;
      }
    } else {
      input += `\n\nProvide a brief summary and a helpful reply.`;
    }

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

    // Try to extract structured data if this is a response
    let extractedData = null;
    if (requestContext?.isResponse) {
      extractedData = extractStructuredData(assistantMessage, emailContent);
    }

    return {
      summary: assistantMessage.substring(0, 500),
      reply: assistantMessage,
      tokensInput,
      tokensOutput,
      aiResponseTimeMs,
      extractedData,
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
    
    // Track outbound interaction for the recipient
    await captureUser(env, originalMessage.FromFull?.Email || originalMessage.From, {
      name: originalMessage.FromFull?.Name || "",
      messageId: outboundId,
      interactionType: 'outbound',
      ipAddress: null,
      userAgent: null,
    });
    
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
 * List all users (HTML page)
 */
async function listUsers(env: Env): Promise<Response> {
  const stmt = env.DB.prepare(`
    SELECT * FROM users 
    ORDER BY last_seen_at DESC 
    LIMIT 100
  `);
  const { results } = await stmt.all();

  const html = renderUsersPage(results as any[]);
  return new Response(html, {
    headers: { "content-type": "text/html" },
  });
}

/**
 * Get user detail including interaction history
 */
async function getUserDetail(env: Env, email: string): Promise<Response> {
  const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();

  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  // Get interaction history
  const interactions = await env.DB.prepare(`
    SELECT ui.*, m.subject 
    FROM user_interactions ui
    LEFT JOIN messages m ON ui.message_id = m.id
    WHERE ui.user_email = ?
    ORDER BY ui.timestamp DESC
    LIMIT 50
  `).bind(email).all();

  return new Response(JSON.stringify({
    user,
    interactions: interactions.results,
  }, null, 2), {
    headers: { "content-type": "application/json" },
  });
}

/**
 * Get all users (API endpoint)
 */
async function getUsersAPI(env: Env): Promise<Response> {
  const stmt = env.DB.prepare(`
    SELECT * FROM users 
    ORDER BY last_seen_at DESC
  `);
  const { results } = await stmt.all();

  return new Response(JSON.stringify(results, null, 2), {
    headers: { "content-type": "application/json" },
  });
}

/**
 * Render users management page
 */
function renderUsersPage(users: any[]): string {
  const totalUsers = users.length;
  const activeUsers = users.filter(u => !u.opt_out).length;
  const optedOutUsers = users.filter(u => u.opt_out).length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Users - Rally</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      background: white;
      border-radius: 16px;
      padding: 30px;
      margin-bottom: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .header h1 {
      font-size: 32px;
      color: #333;
      margin-bottom: 10px;
    }
    .nav {
      display: flex;
      gap: 20px;
      margin-top: 20px;
    }
    .nav a {
      color: #667eea;
      text-decoration: none;
      font-weight: 500;
      padding: 8px 16px;
      border-radius: 8px;
      transition: background 0.2s;
    }
    .nav a:hover {
      background: #f0f4ff;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }
    .stat-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .stat-card h3 {
      font-size: 14px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
    }
    .stat-card .value {
      font-size: 32px;
      font-weight: 700;
      color: #667eea;
    }
    .users-table {
      background: white;
      border-radius: 16px;
      padding: 30px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .users-table h2 {
      font-size: 24px;
      color: #333;
      margin-bottom: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      text-align: left;
      padding: 12px;
      background: #f8f9fa;
      color: #666;
      font-weight: 600;
      font-size: 14px;
      border-bottom: 2px solid #e9ecef;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e9ecef;
      font-size: 14px;
    }
    tr:hover {
      background: #f8f9fa;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge-active {
      background: #d4edda;
      color: #155724;
    }
    .badge-opted-out {
      background: #f8d7da;
      color: #721c24;
    }
    .email-link {
      color: #667eea;
      text-decoration: none;
      font-weight: 500;
    }
    .email-link:hover {
      text-decoration: underline;
    }
    .compliance-icon {
      display: inline-block;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      margin-left: 4px;
    }
    .compliance-yes {
      background: #28a745;
    }
    .compliance-no {
      background: #dc3545;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>👥 Users & Compliance</h1>
      <p style="color: #666; margin-top: 10px;">Track all email contacts with GDPR-compliant data collection</p>
      <div class="nav">
        <a href="/">← Dashboard</a>
        <a href="/settings">Settings</a>
        <a href="/email-prompts">Email Prompts</a>
      </div>
    </div>

    <div class="stats">
      <div class="stat-card">
        <h3>Total Users</h3>
        <div class="value">${totalUsers}</div>
      </div>
      <div class="stat-card">
        <h3>Active Users</h3>
        <div class="value">${activeUsers}</div>
      </div>
      <div class="stat-card">
        <h3>Opted Out</h3>
        <div class="value">${optedOutUsers}</div>
      </div>
    </div>

    <div class="users-table">
      <h2>All Users</h2>
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>First Seen</th>
            <th>Last Seen</th>
            <th>Messages</th>
            <th>Consent</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(user => `
            <tr>
              <td>
                <a href="/users/${encodeURIComponent(user.email)}" class="email-link">${user.email}</a>
              </td>
              <td>${user.name || '<em>Unknown</em>'}</td>
              <td>${new Date(user.first_seen_at).toLocaleDateString()}</td>
              <td>${new Date(user.last_seen_at).toLocaleDateString()}</td>
              <td>
                ↑ ${user.total_messages_sent} / ↓ ${user.total_messages_received}
              </td>
              <td>
                ${user.consent_email ? '<span class="compliance-icon compliance-yes" title="Email consent"></span>' : '<span class="compliance-icon compliance-no" title="No email consent"></span>'}
                ${user.consent_data_processing ? '<span class="compliance-icon compliance-yes" title="Data processing consent"></span>' : '<span class="compliance-icon compliance-no" title="No data processing consent"></span>'}
              </td>
              <td>
                ${user.opt_out ? '<span class="badge badge-opted-out">Opted Out</span>' : '<span class="badge badge-active">Active</span>'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Detect if email is part of a request/response workflow
 * Returns context for AI to use in generating response
 */
async function detectRequestContext(env: Env, messageId: string, postmarkData: PostmarkInboundMessage): Promise<any> {
  try {
    const subject = postmarkData.Subject?.toLowerCase() || '';
    const body = (postmarkData.TextBody || '').toLowerCase();
    
    // Pattern matching for new requests
    const isNewRequest = (
      (subject.includes('please') && (subject.includes('reply') || subject.includes('respond'))) ||
      body.includes('please reply') ||
      body.includes('please respond') ||
      (body.includes('need') && body.includes('by end of day')) ||
      (body.includes('deadline') || body.includes('due date'))
    );
    
    if (isNewRequest) {
      // Extract participants from To/Cc
      const participants = [];
      if (postmarkData.ToFull) {
        participants.push(...postmarkData.ToFull.map((p: any) => p.Email));
      }
      if (postmarkData.CcFull) {
        participants.push(...postmarkData.CcFull.map((p: any) => p.Email));
      }
      
      // Create new request
      const requestResult = await env.DB.prepare(`
        INSERT INTO requests (title, initial_message_id, expected_participants, created_by_email)
        VALUES (?, ?, ?, ?)
      `).bind(
        postmarkData.Subject || 'Untitled Request',
        messageId,
        JSON.stringify(participants),
        postmarkData.FromFull?.Email || postmarkData.From
      ).run();
      
      return {
        isNewRequest: true,
        requestId: requestResult.meta.last_row_id,
        expectedParticipants: participants,
      };
    }
    
    // Check if this is a response to an existing request
    // Look for In-Reply-To header and match to requests
    const inReplyTo = postmarkData.Headers?.find((h: any) => h.Name === "In-Reply-To")?.Value;
    if (inReplyTo) {
      const request = await env.DB.prepare(`
        SELECT r.*, m.message_id 
        FROM requests r
        JOIN messages m ON r.initial_message_id = m.id
        WHERE m.message_id = ? OR r.initial_message_id IN (
          SELECT id FROM messages WHERE in_reply_to = ?
        )
        LIMIT 1
      `).bind(inReplyTo, inReplyTo).first();
      
      if (request) {
        // Get current response count
        const responseCount = await env.DB.prepare(
          `SELECT COUNT(*) as count FROM responses WHERE request_id = ?`
        ).bind(request.id).first();
        
        const expectedParticipants = JSON.parse(request.expected_participants as string || '[]');
        
        // Get who has already responded
        const existingResponses = await env.DB.prepare(
          `SELECT responder_email FROM responses WHERE request_id = ?`
        ).bind(request.id).all();
        
        const respondedEmails = existingResponses.results.map((r: any) => r.responder_email);
        const missingParticipants = expectedParticipants.filter((email: string) => 
          !respondedEmails.includes(email)
        );
        
        // Record this response
        await env.DB.prepare(`
          INSERT INTO responses (request_id, message_id, responder_email, responder_name)
          VALUES (?, ?, ?, ?)
        `).bind(
          request.id,
          messageId,
          postmarkData.FromFull?.Email || postmarkData.From,
          postmarkData.FromFull?.Name || ''
        ).run();
        
        return {
          isResponse: true,
          requestId: request.id,
          requestTitle: request.title,
          totalResponses: (responseCount?.count as number || 0) + 1,
          expectedCount: expectedParticipants.length,
          missingParticipants,
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error detecting request context:', error);
    return null;
  }
}

/**
 * Extract structured data from AI response and email content
 * Simple pattern matching for common data formats
 */
function extractStructuredData(aiResponse: string, emailContent: string): any {
  try {
    const data: any = {};
    
    // Look for common patterns in the email content
    const patterns = [
      { key: 'headcount', regex: /headcount[:\s]+([+-]?\d+)/i },
      { key: 'opex', regex: /opex[:\s]+[\$~]?([\d,\.]+[KMkm]?)/i },
      { key: 'capex', regex: /capex[:\s]+[\$~]?([\d,\.]+[KMkm]?)/i },
      { key: 'tech_spend', regex: /tech spend[:\s]+[\$~]?([\d,\.]+[KMkm]?)/i },
      { key: 'department', regex: /department[:\s]+([^\n]+)/i },
      { key: 'cost_center', regex: /cost center[:\s]+([^\n]+)/i },
    ];
    
    for (const pattern of patterns) {
      const match = emailContent.match(pattern.regex);
      if (match) {
        data[pattern.key] = match[1].trim();
      }
    }
    
    // Return null if no data found
    return Object.keys(data).length > 0 ? data : null;
  } catch (error) {
    console.error('Error extracting structured data:', error);
    return null;
  }
}

/**
 * List all requests with response counts
 */
async function listRequests(env: Env): Promise<Response> {
  const stmt = env.DB.prepare(`
    SELECT 
      r.*,
      COUNT(resp.id) as response_count,
      json_array_length(r.expected_participants) as expected_count
    FROM requests r
    LEFT JOIN responses resp ON r.id = resp.request_id
    GROUP BY r.id
    ORDER BY r.created_at DESC
    LIMIT 50
  `);
  const { results } = await stmt.all();

  const html = renderRequestsPage(results as any[]);
  return new Response(html, {
    headers: { "content-type": "text/html" },
  });
}

/**
 * Get detailed view of a specific request with all responses
 */
async function getRequestDetail(env: Env, id: string): Promise<Response> {
  const request = await env.DB.prepare("SELECT * FROM requests WHERE id = ?").bind(id).first();

  if (!request) {
    return new Response(JSON.stringify({ error: "Request not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const responses = await env.DB.prepare(`
    SELECT r.*, m.subject, m.raw_text 
    FROM responses r
    LEFT JOIN messages m ON r.message_id = m.id
    WHERE r.request_id = ?
    ORDER BY r.responded_at ASC
  `).bind(id).all();

  const html = renderRequestDetail(request as any, responses.results as any[]);
  return new Response(html, {
    headers: { "content-type": "text/html" },
  });
}

/**
 * Capture or update user information for compliance and tracking
 * Creates new user record or updates existing one with latest interaction data
 */
async function captureUser(env: Env, email: string, data: {
  name?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  messageId: string;
  interactionType: 'inbound' | 'outbound';
}): Promise<void> {
  try {
    // Check if user already exists
    const existingUser = await env.DB.prepare(
      "SELECT email, total_messages_sent, total_messages_received FROM users WHERE email = ?"
    ).bind(email).first();

    if (existingUser) {
      // Update existing user
      const totalSent = (existingUser.total_messages_sent as number || 0) + (data.interactionType === 'inbound' ? 1 : 0);
      const totalReceived = (existingUser.total_messages_received as number || 0) + (data.interactionType === 'outbound' ? 1 : 0);

      await env.DB.prepare(`
        UPDATE users 
        SET last_seen_at = datetime('now'),
            total_messages_sent = ?,
            total_messages_received = ?,
            ip_address = COALESCE(?, ip_address),
            user_agent = COALESCE(?, user_agent),
            name = COALESCE(?, name),
            updated_at = datetime('now')
        WHERE email = ?
      `).bind(totalSent, totalReceived, data.ipAddress, data.userAgent, data.name, email).run();

      console.log(`Updated user: ${email} (sent: ${totalSent}, received: ${totalReceived})`);
    } else {
      // Create new user
      await env.DB.prepare(`
        INSERT INTO users (
          email, name, ip_address, user_agent, 
          total_messages_sent, total_messages_received,
          source, consent_email, consent_data_processing
        ) VALUES (?, ?, ?, ?, ?, ?, 'inbound_email', 1, 1)
      `).bind(
        email,
        data.name || null,
        data.ipAddress,
        data.userAgent,
        data.interactionType === 'inbound' ? 1 : 0,
        data.interactionType === 'outbound' ? 1 : 0
      ).run();

      console.log(`Created new user: ${email}`);
    }

    // Log the interaction for audit trail
    await env.DB.prepare(`
      INSERT INTO user_interactions (
        user_email, message_id, interaction_type, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?)
    `).bind(email, data.messageId, data.interactionType, data.ipAddress, data.userAgent).run();

  } catch (error) {
    console.error("Error capturing user data:", error);
    // Don't throw - we don't want user tracking to break the main flow
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
