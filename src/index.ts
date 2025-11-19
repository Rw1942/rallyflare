import { renderDashboard, renderSettings, renderEmailPrompts, renderRequestsPage, renderRequestDetail, renderUsersPage } from "./renderHtml";
import OpenAI from "openai";

export interface Env {
  DB: D1Database;
  POSTMARK_TOKEN: string;
  OPENAI_API_KEY: string;
  POSTMARK_URL: string;
  WEBHOOK_USERNAME: string;
  WEBHOOK_PASSWORD: string;
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
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
      return updateSettings(request, env, ctx);
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

    // New route for Postmark inbound status
    if (path === "/status/postmark-inbound" && request.method === "GET") {
      return getPostmarkInboundStatus(env);
    }

    // Processing logs route
    if (path === "/logs" && request.method === "GET") {
      return getProcessingLogs(env);
    }

    // API endpoint for logs (JSON)
    if (path === "/api/logs" && request.method === "GET") {
      return getProcessingLogsAPI(env, url.searchParams.get('message_id'));
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
 * Get Postmark inbound webhook status
 * Returns the received_at timestamp of the latest inbound message
 */
async function getPostmarkInboundStatus(env: Env): Promise<Response> {
  try {
    const latestMessage = await env.DB.prepare(
      "SELECT received_at FROM messages WHERE direction = 'inbound' ORDER BY received_at DESC LIMIT 1"
    ).first<{ received_at: string }>();

    if (latestMessage) {
      return new Response(JSON.stringify({
        status: "ok",
        last_inbound_message_at: latestMessage.received_at,
        message: "Successfully received and processed inbound messages."
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    } else {
      return new Response(JSON.stringify({
        status: "warning",
        last_inbound_message_at: null,
        message: "No inbound messages found yet. Webhook might not be configured or no emails received."
      }), {
        status: 200, // Still 200, as the status check itself is working
        headers: { "content-type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Error fetching Postmark inbound status:", error);
    return new Response(JSON.stringify({
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      message: "Failed to retrieve Postmark inbound status due to an internal error."
    }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

/**
 * Log processing events to database for debugging and monitoring
 */
async function logProcessing(
  env: Env, 
  messageId: string | null,
  level: 'info' | 'warning' | 'error' | 'debug',
  stage: string,
  message: string,
  details?: any,
  durationMs?: number
): Promise<void> {
  try {
    await env.DB.prepare(`
      INSERT INTO processing_logs (message_id, level, stage, message, details, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      messageId,
      level,
      stage,
      message,
      details ? JSON.stringify(details) : null,
      durationMs || null
    ).run();
  } catch (error) {
    // Don't let logging errors break the main flow
    console.error('Failed to write processing log:', error);
  }
}

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
 * Convert plain text to HTML by replacing newlines with <br> tags
 * Simple and reliable for email clients
 */
function textToHtml(text: string): string {
  // Escape HTML to prevent injection
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Replace newlines with <br> tags
  return escaped.replace(/\n/g, '<br>');
}

/**
 * Handle Postmark inbound webhook
 * Postmark sends JSON payload with email data
 * 
 * Email tracking in D1:
 * - For INBOUND messages:
 *   - email_address: Rally address that received the email (e.g., chat@email2chatgpt.com)
 *   - recipient_email: NULL (Rally is the recipient)
 *   - from_email: User who sent the email
 * 
 * - For OUTBOUND messages (see sendReplyEmail):
 *   - email_address: Rally address that sent the email (e.g., chat@email2chatgpt.com)
 *   - recipient_email: User who received Rally's reply
 *   - from_email: Rally address
 */
async function handlePostmarkInbound(request: Request, env: Env): Promise<Response> {
  // Implement HTTP Basic Auth
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Postmark Webhook"' } });
  }

  const [scheme, credentials] = authHeader.split(' ');
  if (scheme !== 'Basic' || !credentials) {
    return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Postmark Webhook"' } });
  }

  const decodedCredentials = atob(credentials);
  const [username, password] = decodedCredentials.split(':');

  if (username !== env.WEBHOOK_USERNAME || password !== env.WEBHOOK_PASSWORD) {
    console.warn('Invalid webhook credentials provided.');
    return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Postmark Webhook"' } });
  }

  let internalId: string | null = null;
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
      messageId: postmarkData.MessageID, // Log the raw MessageID from Postmark
      ipAddress: ipAddress,
    });

    // Generate our internal ID
    internalId = crypto.randomUUID();
    const receivedAt = new Date().toISOString();

    // Log email received
    await logProcessing(env, internalId, 'info', 'email_received', 'Inbound email received from Postmark', {
      from: postmarkData.FromFull?.Email,
      subject: postmarkData.Subject,
      hasAttachments: (postmarkData.Attachments?.length || 0) > 0,
      contentLength: (postmarkData.TextBody || postmarkData.HtmlBody || '').length
    });

    // Parse participants
    const toList = postmarkData.ToFull || [];
    const ccList = postmarkData.CcFull || [];

    // Extract the Rally email address that received this message
    // For inbound messages:
    // - email_address: The Rally address that received the email (e.g., chat@email2chatgpt.com)
    // - recipient_email: NULL (Rally is the recipient, already tracked in email_address)
    const rallyEmailAddress = postmarkData.OriginalRecipient || postmarkData.ToFull?.[0]?.Email || postmarkData.To;

    // Store message in D1
    await env.DB.prepare(`
      INSERT INTO messages (
        id, received_at, subject, message_id, in_reply_to, references_header,
        from_name, from_email, raw_text, raw_html,
        postmark_message_id, has_attachments, direction, email_address, recipient_email
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      internalId,
      receivedAt,
      postmarkData.Subject || "(no subject)",
      // Use Postmark's MessageID for threading if it's not the zero UUID, otherwise generate a new one
      postmarkData.MessageID === "00000000-0000-0000-0000-000000000000" ? crypto.randomUUID() : postmarkData.MessageID,
      postmarkData.Headers?.find((h: any) => h.Name === "In-Reply-To")?.Value || null,
      postmarkData.Headers?.find((h: any) => h.Name === "References")?.Value || null,
      postmarkData.FromFull?.Name || "",
      postmarkData.FromFull?.Email || postmarkData.From,
      postmarkData.TextBody || "",
      postmarkData.HtmlBody || "",
      postmarkData.MessageID, // Store Postmark's original MessageID for auditing
      (postmarkData.Attachments?.length || 0) > 0 ? 1 : 0,
      'inbound',
      rallyEmailAddress, // Rally address that received this email
      null // recipient_email is NULL for inbound (Rally is the recipient)
    ).run();

    // Log message stored
    await logProcessing(env, internalId, 'info', 'message_stored', 'Message data saved to database', {
      participantCount: toList.length + ccList.length,
      attachmentCount: postmarkData.Attachments?.length || 0
    });

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

    // Log AI processing start
    const aiStartTime = Date.now();
    await logProcessing(env, internalId, 'info', 'ai_processing_start', 'Starting OpenAI processing', {
      hasRequestContext: !!requestContext,
      emailAddress: rallyEmailAddress
    });

    // Process with OpenAI (including request context if applicable)
    const llmResponse = await processWithOpenAI(env, internalId, postmarkData, rallyEmailAddress, requestContext);

    // Log AI processing complete
    const aiDuration = Date.now() - aiStartTime;
    await logProcessing(env, internalId, 'info', 'ai_processing_complete', 'OpenAI processing completed', {
      tokensInput: llmResponse.tokensInput,
      tokensOutput: llmResponse.tokensOutput,
      hasReply: !!llmResponse.reply
    }, aiDuration);

    // Calculate total processing time (from receipt to reply sent)
    const processingEndTime = Date.now();
    const processingTimeMs = processingEndTime - processingStartTime;

    // Send reply email via Postmark
    let sentAt: string | null = null;
    if (llmResponse.reply) {
      await logProcessing(env, internalId, 'info', 'sending_reply', 'Sending reply via Postmark');
      
      sentAt = await sendReplyEmail(env, postmarkData, llmResponse.reply, internalId, {
        tokensInput: llmResponse.tokensInput,
        tokensOutput: llmResponse.tokensOutput,
        processingTimeMs: processingTimeMs,
        aiResponseTimeMs: llmResponse.aiResponseTimeMs,
      });
      
      await logProcessing(env, internalId, 'info', 'reply_sent', 'Reply email sent successfully', {
        recipient: postmarkData.FromFull?.Email || postmarkData.From
      });
    }

    // Update message with LLM response, token usage, and performance metrics
    await env.DB.prepare(`
      UPDATE messages
      SET llm_summary = ?, llm_reply = ?, tokens_input = ?, tokens_output = ?, 
          processing_time_ms = ?, ai_response_time_ms = ?, sent_at = ?, openai_response_id = ?
      WHERE id = ?
    `).bind(
      llmResponse.summary, 
      llmResponse.reply, 
      llmResponse.tokensInput || null,
      llmResponse.tokensOutput || null,
      processingTimeMs,
      llmResponse.aiResponseTimeMs || null,
      sentAt,
      llmResponse.openaiResponseId || null,
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

    // Log successful completion
    await logProcessing(env, internalId, 'info', 'processing_complete', 'Email processing completed successfully', {
      totalDuration: processingTimeMs,
      replySent: !!sentAt
    }, processingTimeMs);

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
    
    // Log error
    await logProcessing(env, internalId, 'error', 'processing_error', 'Error during email processing', {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    });
    
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
  openaiResponseId?: string; // Added for threading
}> {
  try {
    // Get email-specific prompt first
    const emailPromptResult = await env.DB.prepare(
      "SELECT system_prompt FROM email_prompts WHERE email_address = ? LIMIT 1"
    ).bind(rallyEmailAddress).first();

    let systemPrompt: string;
    let maxOutputTokens: number; // Changed from maxTokens
    let model: string;
    let reasoningEffort: "minimal" | "low" | "medium" | "high" | undefined;
    let verbosity: "low" | "medium" | "high" | undefined;

    if (emailPromptResult?.system_prompt) {
      systemPrompt = emailPromptResult.system_prompt as string;
      // Email-specific prompts don't currently support max_output_tokens, use default
      const settingsResult = await env.DB.prepare(
        "SELECT max_output_tokens, model, reasoning_effort, text_verbosity FROM project_settings WHERE project_slug = 'default' LIMIT 1" // Changed column name
      ).first<{ max_output_tokens: number; model: string; reasoning_effort: "minimal" | "low" | "medium" | "high"; text_verbosity: "low" | "medium" | "high"; }>();
      maxOutputTokens = settingsResult?.max_output_tokens || 500; // Changed from maxTokens
      model = settingsResult?.model || "gpt-5";
      reasoningEffort = settingsResult?.reasoning_effort || "low";
      verbosity = settingsResult?.text_verbosity || "low";
      console.log(`Using email-specific prompt for ${rallyEmailAddress}, default max_output_tokens: ${maxOutputTokens}, model: ${model}, reasoning: ${reasoningEffort}, verbosity: ${verbosity}`);
    } else {
      // Fall back to default project settings
      const settingsResult = await env.DB.prepare(
        "SELECT * FROM project_settings WHERE project_slug = 'default' LIMIT 1"
      ).first<{ system_prompt: string; max_output_tokens: number; model: string; reasoning_effort: "minimal" | "low" | "medium" | "high"; text_verbosity: "low" | "medium" | "high"; }>(); // Changed column name
      systemPrompt = settingsResult?.system_prompt as string || "You are Rally, an intelligent email assistant.";
      maxOutputTokens = settingsResult?.max_output_tokens || 500; // Changed from maxTokens
      model = settingsResult?.model || "gpt-5";
      reasoningEffort = settingsResult?.reasoning_effort || "low";
      verbosity = settingsResult?.text_verbosity || "low";
      console.log(`Using default prompt for ${rallyEmailAddress}, max_output_tokens: ${maxOutputTokens}, model: ${model}, reasoning: ${reasoningEffort}, verbosity: ${verbosity}`);
    }

    // Get previous_response_id for threaded conversations
    // First get the in_reply_to value for the current message
    const currentMessage = await env.DB.prepare(
      "SELECT in_reply_to FROM messages WHERE id = ?"
    ).bind(messageId).first<{ in_reply_to: string | null }>();

    let previousResponseId: string | undefined = undefined;
    
    // If this is a reply, look up the message it's replying to and get its openai_response_id
    if (currentMessage?.in_reply_to) {
      const previousMessage = await env.DB.prepare(
        "SELECT openai_response_id FROM messages WHERE message_id = ? AND openai_response_id IS NOT NULL LIMIT 1"
      ).bind(currentMessage.in_reply_to).first<{ openai_response_id: string }>();
      
      previousResponseId = previousMessage?.openai_response_id || undefined;
      
      console.log(`Threading context: in_reply_to=${currentMessage.in_reply_to}, found_previous_response_id=${!!previousResponseId}`);
    } else {
      console.log('No threading context: this appears to be a new conversation thread');
    }

    // Fetch thread history: Get up to 5 previous messages in the chain
    // Use recursive CTE to traverse the thread via in_reply_to
    const threadQuery = `
      WITH RECURSIVE thread_chain AS (
        SELECT id, raw_text, llm_reply, direction, received_at, in_reply_to, openai_response_id
        FROM messages
        WHERE id = ?
        UNION ALL
        SELECT m.id, m.raw_text, m.llm_reply, m.direction, m.received_at, m.in_reply_to, m.openai_response_id
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

    // Get current email content - use only the plain text body
    let emailContent = postmarkData.TextBody || "(No body content)";

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

    // Initialize OpenAI client
    const openaiClient = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });

    const requestPayload: OpenAI.Responses.ResponseCreateParams = {
      model: model, // Use dynamic model
      input,
      reasoning: { effort: reasoningEffort }, // Use dynamic reasoning
      text: { verbosity: verbosity }, // Use dynamic verbosity
      max_output_tokens: maxOutputTokens, // Changed from max_tokens
      previous_response_id: previousResponseId, // Include for threaded conversations
    };

    // Call OpenAI Responses API
    const aiStartTime = Date.now();
    const openaiResponse = await openaiClient.responses.create(requestPayload);
    const aiEndTime = Date.now();
    const aiResponseTimeMs = aiEndTime - aiStartTime;

    // Extract response - assuming output_text is the main content
    const assistantMessage = openaiResponse.output_text || "";

    if (!assistantMessage) {
      throw new Error("No valid response from OpenAI");
    }

    const tokensInput = openaiResponse.usage?.input_tokens;
    const tokensOutput = openaiResponse.usage?.output_tokens;

    // Try to extract structured data if this is a response
    let extractedData = null;
    if (requestContext?.isResponse) {
      extractedData = extractStructuredData(assistantMessage, emailContent);
    }

    // Return the response, and also the ID for subsequent threaded calls
    return {
      summary: assistantMessage.substring(0, 500),
      reply: assistantMessage,
      tokensInput,
      tokensOutput,
      aiResponseTimeMs,
      extractedData,
      openaiResponseId: openaiResponse.id, // Store this for threading
    };

  } catch (error: unknown) {
    let errorMessage = "Unknown OpenAI error";
    let replyForUser = "Thank you for your email. We've received it and will respond shortly.";

    if (error instanceof OpenAI.APIError) {
      errorMessage = `OpenAI API Error: ${error.status} - ${error.message} (x-request-id: ${error.headers['x-request-id']})`;
      replyForUser = `Thank you for your email. We encountered an issue processing it with AI (${error.status}). We'll get back to you soon.`;
    } else if (error instanceof Error) {
      errorMessage = `OpenAI processing error: ${error.message}`;
    }
    
    console.error(errorMessage, error);

    return {
      summary: `Error processing with AI: ${errorMessage.substring(0, 100)}...`,
      reply: replyForUser,
    };
  }
}

/**
 * Send reply email via Postmark
 * Returns the timestamp when the email was sent
 * 
 * Email tracking in D1 for OUTBOUND messages:
 * - email_address: Rally address sending the reply (e.g., chat@email2chatgpt.com)
 * - recipient_email: User's email who receives the reply (from originalMessage.FromFull.Email)
 * - from_email: Rally address (same as email_address)
 * - To header: Set to recipient_email (user who sent the original question)
 * - ReplyTo header: Set to Rally address (so user's reply comes back to Rally)
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

    // Add metrics footer if available (plain text format)
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
        finalReplyBody += `\n\n${'─'.repeat(40)}\nRally\n${metricsText.map(m => `• ${m}`).join('\n')}`;
      }
    }
    
    // Prepare email body
    const emailBody: any = {
      From: "email2chat <chat@email2chatgpt.com>",
      ReplyTo: replyToAddress,
      To: originalMessage.FromFull?.Email || originalMessage.From,
      Subject: `Re: ${originalMessage.Subject}`,
      MessageStream: "outbound",
      TextBody: finalReplyBody,  // Send as plain text
      HtmlBody: textToHtml(finalReplyBody),  // Also provide HTML version
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

    console.log("Preparing to send reply email:", {
      From: emailBody.From,
      ReplyTo: emailBody.ReplyTo,
      To: emailBody.To,
      Subject: emailBody.Subject,
      InReplyToHeader: originalMessage.MessageID,
      ReferencesHeader: referencesValue,
      originalMessageFrom: originalMessage.From,
      originalMessageFromFullEmail: originalMessage.FromFull?.Email,
      originalMessageOriginalRecipient: originalMessage.OriginalRecipient,
      originalMessageToFullEmail: originalMessage.ToFull?.[0]?.Email,
      originalMessageTo: originalMessage.To,
    });

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
    
    // Email tracking semantics:
    // - email_address: The Rally address that sent this email (chat@email2chatgpt.com)
    // - recipient_email: The user who received this reply (original sender)
    const rallyEmailAddress = "chat@email2chatgpt.com";
    const recipientEmail = originalMessage.FromFull?.Email || originalMessage.From;

    await env.DB.prepare(`
      INSERT INTO messages (
        id, sent_at, received_at, subject, message_id, in_reply_to,
        from_name, from_email, raw_text, direction, reply_to_message_id, email_address, recipient_email
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      outboundId,
      sentAt,
      sentAt, // Use sent_at for received_at to maintain compatibility
      `Re: ${originalMessage.Subject}`,
      null, // Will be set by Postmark after sending
      originalMessage.MessageID,
      "Rally",
      rallyEmailAddress,
      finalReplyBody,
      'outbound',
      replyToMessageId,
      rallyEmailAddress, // Rally address that sent the email
      recipientEmail // User who received the reply
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
interface PostmarkStatus {
  status: string;
  last_inbound_message_at: string | null;
  message: string;
}

async function getSettings(env: Env): Promise<Response> {
  const settings = await env.DB.prepare(
    "SELECT system_prompt, model, reasoning_effort, text_verbosity, max_output_tokens FROM project_settings WHERE project_slug = 'default' LIMIT 1"
  ).first<{ system_prompt: string; model: string; reasoning_effort: string; text_verbosity: string; max_output_tokens: number }>();

  // Get Postmark inbound status
  const postmarkStatusResponse = await getPostmarkInboundStatus(env);
  const postmarkStatus: PostmarkStatus = await postmarkStatusResponse.json();

  return new Response(renderSettings(settings as any, postmarkStatus), {
    headers: { "content-type": "text/html" },
  });
}

/**
 * Update settings
 * Admins can modify how Rally interprets and responds to emails
 * GPT-5 uses fixed reasoning/verbosity settings optimized for email
 */
async function updateSettings(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  try {
    const data = await request.json() as {
      system_prompt: string;
      model: string;
      reasoning_effort: "minimal" | "low" | "medium" | "high";
      text_verbosity: "low" | "medium" | "high";
      max_output_tokens: number;
    };
    
    const { system_prompt, model, reasoning_effort, text_verbosity, max_output_tokens } = data;

    // Validate input
    if (!system_prompt || system_prompt.trim().length === 0) {
      return new Response(JSON.stringify({ error: "System prompt is required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    if (isNaN(max_output_tokens) || max_output_tokens < 50 || max_output_tokens > 4000) {
      return new Response(JSON.stringify({ error: "Max output tokens must be a number between 50 and 4000" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    if (!model || !["gpt-5", "gpt-5-mini", "gpt-5-nano"].includes(model)) {
      return new Response(JSON.stringify({ error: "Invalid model selected." }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    if (!reasoning_effort || !["minimal", "low", "medium", "high"].includes(reasoning_effort)) {
      return new Response(JSON.stringify({ error: "Invalid reasoning effort selected." }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    if (!text_verbosity || !["low", "medium", "high"].includes(text_verbosity)) {
      return new Response(JSON.stringify({ error: "Invalid text verbosity selected." }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // Update settings in D1
    await env.DB.prepare(`
      INSERT INTO project_settings (project_slug, model, system_prompt, max_output_tokens, reasoning_effort, text_verbosity)
      VALUES ('default', ?, ?, ?, ?, ?)
      ON CONFLICT(project_slug) 
      DO UPDATE SET system_prompt = ?, model = ?, max_output_tokens = ?, reasoning_effort = ?, text_verbosity = ?
    `).bind(
      model,
      system_prompt,
      max_output_tokens, // Changed variable name
      reasoning_effort,
      text_verbosity,
      system_prompt,
      model,
      max_output_tokens, // Changed variable name
      reasoning_effort,
      text_verbosity
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
 * Get processing logs page (HTML)
 */
async function getProcessingLogs(env: Env): Promise<Response> {
  const stmt = env.DB.prepare(`
    SELECT * FROM processing_logs 
    ORDER BY timestamp DESC 
    LIMIT 200
  `);
  const { results } = await stmt.all();

  // Render a simple HTML page with logs
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Processing Logs - Rally</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1400px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        h1 { margin: 0 0 20px 0; color: #333; }
        .nav { margin-bottom: 30px; }
        .nav a { color: #0066cc; text-decoration: none; margin-right: 20px; }
        .nav a:hover { text-decoration: underline; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th { background: #f8f9fa; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #dee2e6; position: sticky; top: 0; }
        td { padding: 10px 12px; border-bottom: 1px solid #e9ecef; vertical-align: top; }
        tr:hover { background: #f8f9fa; }
        .level { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
        .level-info { background: #d1ecf1; color: #0c5460; }
        .level-warning { background: #fff3cd; color: #856404; }
        .level-error { background: #f8d7da; color: #721c24; }
        .level-debug { background: #e2e3e5; color: #383d41; }
        .message-id { font-family: monospace; font-size: 11px; color: #666; }
        .timestamp { color: #666; font-size: 12px; white-space: nowrap; }
        .details { font-size: 11px; color: #666; max-width: 400px; overflow: hidden; text-overflow: ellipsis; }
        .duration { color: #28a745; font-weight: 600; }
        .filters { margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; }
        .filters label { margin-right: 15px; }
        .filters select, .filters input { padding: 6px 10px; border: 1px solid #ced4da; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="nav">
          <a href="/">← Dashboard</a>
          <a href="/messages">Messages</a>
          <a href="/settings">Settings</a>
          <a href="/users">Users</a>
          <a href="/logs"><strong>Logs</strong></a>
        </div>
        
        <h1>📋 Processing Logs</h1>
        
        <div class="filters">
          <label>Filter by level:</label>
          <select id="levelFilter" onchange="filterLogs()">
            <option value="">All</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
          </select>
          
          <label style="margin-left: 20px;">Search message ID:</label>
          <input type="text" id="messageIdFilter" placeholder="Enter message ID" onkeyup="filterLogs()" style="width: 300px;">
        </div>
        
        <table id="logsTable">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Level</th>
              <th>Stage</th>
              <th>Message</th>
              <th>Message ID</th>
              <th>Duration</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            ${results.map((log: any) => `
              <tr data-level="${log.level}" data-message-id="${log.message_id || ''}">
                <td class="timestamp">${new Date(log.timestamp).toLocaleString()}</td>
                <td><span class="level level-${log.level}">${log.level}</span></td>
                <td>${log.stage}</td>
                <td>${log.message}</td>
                <td class="message-id">${log.message_id ? log.message_id.substring(0, 8) + '...' : '-'}</td>
                <td>${log.duration_ms ? `<span class="duration">${log.duration_ms}ms</span>` : '-'}</td>
                <td class="details">${log.details || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <script>
          function filterLogs() {
            const levelFilter = document.getElementById('levelFilter').value.toLowerCase();
            const messageIdFilter = document.getElementById('messageIdFilter').value.toLowerCase();
            const rows = document.querySelectorAll('#logsTable tbody tr');
            
            rows.forEach(row => {
              const level = row.getAttribute('data-level');
              const messageId = row.getAttribute('data-message-id');
              
              const levelMatch = !levelFilter || level === levelFilter;
              const messageIdMatch = !messageIdFilter || messageId.includes(messageIdFilter);
              
              row.style.display = (levelMatch && messageIdMatch) ? '' : 'none';
            });
          }
        </script>
      </div>
    </body>
    </html>
  `;

  return new Response(html, {
    headers: { "content-type": "text/html" },
  });
}

/**
 * Get processing logs via API (JSON)
 */
async function getProcessingLogsAPI(env: Env, messageId?: string | null): Promise<Response> {
  let stmt;
  if (messageId) {
    stmt = env.DB.prepare(`
      SELECT * FROM processing_logs 
      WHERE message_id = ?
      ORDER BY timestamp ASC
    `).bind(messageId);
  } else {
    stmt = env.DB.prepare(`
      SELECT * FROM processing_logs 
      ORDER BY timestamp DESC 
      LIMIT 200
    `);
  }
  
  const { results } = await stmt.all();

  return new Response(JSON.stringify(results, null, 2), {
    headers: { "content-type": "application/json" },
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
