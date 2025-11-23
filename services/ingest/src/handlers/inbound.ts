import { PostmarkInboundMessage, EmailReply, AiRequest, AiResponse } from "shared/types";
import { hasImages, flattenHtml, appendAttachments, calculateCost } from "../utils/index";
import { formatAddress, normalizeEmail, calculateReplyRecipients } from "../utils/emailFormatting";
import { buildEmailWithFooter, buildErrorEmail, buildSimpleEmail } from "../utils/emailTemplate";
import { mergeSettings, type ProjectSettings, type EmailSettings } from "../utils/settingsMerge";
import type { Env } from "../types";

export async function handlePostmarkInbound(request: Request, env: Env): Promise<Response> {
  // Auth check
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });
  const [scheme, credentials] = authHeader.split(' ');
  if (scheme !== 'Basic' || !credentials) return new Response('Unauthorized', { status: 401 });
  const [username, password] = atob(credentials).split(':');
  if (username !== env.WEBHOOK_USERNAME || password !== env.WEBHOOK_PASSWORD) return new Response('Unauthorized', { status: 401 });

  let internalId: string | null = null;
  let postmarkData: PostmarkInboundMessage | null = null;

  try {
    postmarkData = await request.json() as PostmarkInboundMessage;
    const processingStartTime = Date.now();
    internalId = crypto.randomUUID();
    const receivedAt = new Date().toISOString();

    // 1. Store Message in D1
    const rallyEmailAddress = extractRallyEmailAddress(postmarkData).toLowerCase();
    const senderEmail = (postmarkData.FromFull?.Email || postmarkData.From || "").toLowerCase();

    let textContent = postmarkData.TextBody || "";
    if (hasImages(postmarkData) || !textContent) {
      textContent = flattenHtml(postmarkData.HtmlBody || "", postmarkData.Attachments || []);
    }

    textContent = appendAttachments(textContent, postmarkData.Attachments || []);

    await env.DB.prepare(`
      INSERT INTO messages (
        id, received_at, subject, message_id, in_reply_to, references_header,
        from_name, from_email, raw_text, raw_html,
        postmark_message_id, has_attachments, direction, email_address, recipient_email
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      internalId, receivedAt, postmarkData.Subject || "(no subject)",
      postmarkData.MessageID === "00000000-0000-0000-0000-000000000000" ? crypto.randomUUID() : postmarkData.MessageID,
      postmarkData.Headers?.find((h: any) => h.Name === "In-Reply-To")?.Value || null,
      postmarkData.Headers?.find((h: any) => h.Name === "References")?.Value || null,
      postmarkData.FromFull?.Name || "", senderEmail,
      textContent, postmarkData.HtmlBody || "",
      postmarkData.MessageID, (postmarkData.Attachments?.length || 0) > 0 ? 1 : 0,
      'inbound', rallyEmailAddress, senderEmail
    ).run();

    // 2. Store Participants
    // We need to store all participants to allow looking up history for CC'd users
    const participantsToInsert: { kind: string, name: string, email: string }[] = [];

    if (postmarkData.FromFull) {
      participantsToInsert.push({ kind: 'from', name: postmarkData.FromFull.Name, email: postmarkData.FromFull.Email });
    }
    
    if (postmarkData.ToFull) {
      for (const to of postmarkData.ToFull) {
        participantsToInsert.push({ kind: 'to', name: to.Name, email: to.Email });
      }
    }

    if (postmarkData.CcFull) {
      for (const cc of postmarkData.CcFull) {
        participantsToInsert.push({ kind: 'cc', name: cc.Name, email: cc.Email });
      }
    }

    // Batch insert participants
    if (participantsToInsert.length > 0) {
      const stmt = env.DB.prepare(`
        INSERT INTO participants (message_id, kind, name, email) VALUES (?, ?, ?, ?)
      `);
      await env.DB.batch(
        participantsToInsert.map(p => stmt.bind(internalId, p.kind, p.name, p.email.toLowerCase()))
      );
    }

    // 3. Handle Attachments
    let attachmentTimeMs = 0;
    if (postmarkData.Attachments && postmarkData.Attachments.length > 0) {
      for (const attachment of postmarkData.Attachments) {
        try {
          const uploadResult = await env.ATTACHMENTS.uploadAttachment(attachment.Name, attachment.Content, attachment.ContentType);
          if (uploadResult.uploadTimeMs) attachmentTimeMs += uploadResult.uploadTimeMs;

          await env.DB.prepare(`
            INSERT INTO attachments (message_id, filename, mime, size_bytes, r2_key)
            VALUES (?, ?, ?, ?, ?)
          `).bind(internalId, attachment.Name, attachment.ContentType, uploadResult.size, uploadResult.key).run();
        } catch (e) {
          console.error("Failed to upload attachment", e);
        }
      }
    }

    // 3. Fetch Thread History
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
      SELECT * FROM thread_chain ORDER BY received_at ASC LIMIT 6
    `;
    const { results: threadResults } = await env.DB.prepare(threadQuery).bind(internalId).all();

    const conversationHistory = threadResults.map((msg: any) => {
      if (msg.id === internalId) return null;
      return {
        role: msg.direction === 'inbound' ? 'user' : 'assistant',
        content: msg.direction === 'inbound' ? (msg.raw_text || '') : (msg.llm_reply || ''),
        receivedAt: msg.received_at
      };
    }).filter(Boolean) as any[];

    // 4. Get Settings
    const projectSettings = await env.DB.prepare(
      "SELECT system_prompt, model, reasoning_effort, text_verbosity, max_output_tokens, cost_input_per_1m, cost_output_per_1m FROM project_settings WHERE project_slug = 'default' LIMIT 1"
    ).first<ProjectSettings>();

    const emailSettings = await env.DB.prepare(
      "SELECT system_prompt, model, reasoning_effort, text_verbosity, max_output_tokens FROM email_settings WHERE email_address = ? LIMIT 1"
    ).bind(rallyEmailAddress).first<EmailSettings>();

    const settings = mergeSettings(projectSettings, emailSettings);

    if (!settings.system_prompt) {
      const replyToAddress = rallyEmailAddress;
      const originalReferences = postmarkData.Headers?.find((h: any) => h.Name === "References")?.Value || "";
      const referencesValue = originalReferences ? `${originalReferences} ${postmarkData.MessageID}` : postmarkData.MessageID;

      const { textBody, htmlBody } = buildSimpleEmail(
        "Rally is currently not configured to handle this request. Please contact the administrator to set up the system prompt."
      );

      const errorReply: EmailReply = {
        from: replyToAddress,
        to: senderEmail,
        subject: `Re: ${postmarkData.Subject}`,
        textBody,
        htmlBody,
        replyTo: replyToAddress,
        inReplyTo: postmarkData.MessageID,
        references: referencesValue,
        originalMessageId: internalId
      };

      await env.MAILER.sendEmail(errorReply);
      return new Response(JSON.stringify({ success: false, error: "Missing system prompt" }), { status: 400 });
    }

    // 5. Call AI Service
    const aiRequest: AiRequest = {
      messageId: internalId,
      postmarkData,
      rallyEmailAddress,
      systemPrompt: settings.system_prompt,
      model: settings.model,
      reasoningEffort: settings.reasoningEffort,
      textVerbosity: settings.textVerbosity,
      maxOutputTokens: settings.maxOutputTokens,
      conversationHistory,
      processedTextContent: textContent
    };

    const aiResponse = await env.AI.generateReply(aiRequest);

    // 6. Send Reply
    let sentAt: string | null = null;
    let mailerTimeMs: number | null = null;
    let ingestTimeMs: number = 0;
    let openaiUploadTimeMs: number = 0;
    let costDollars: number = 0;
    let textBody: string | null = null;
    let htmlBody: string | null = null;
    
    if (aiResponse.reply) {
      const replyToAddress = rallyEmailAddress;
      const originalReferences = postmarkData.Headers?.find((h: any) => h.Name === "References")?.Value || "";
      const referencesValue = originalReferences ? `${originalReferences} ${postmarkData.MessageID}` : postmarkData.MessageID;

      // --- Reply All Logic ---
      // Calculate recipients using the helper (encapsulates To/Cc logic and deduplication)
      const recipients = calculateReplyRecipients(postmarkData, rallyEmailAddress, senderEmail);

      // Ensure all recipients (To and Cc) are tracked as users
      // This happens asynchronously to not block the reply
      const allRecipients = [
        ...(postmarkData.ToFull || []),
        ...(postmarkData.CcFull || []),
        postmarkData.FromFull
      ].filter(Boolean);

      for (const contact of allRecipients) {
        if (contact && contact.Email) {
          const email = contact.Email.toLowerCase();
          // Skip if it's the Rally address itself
          if (email === rallyEmailAddress) continue;
          
          // Fire-and-forget user creation (INSERT OR IGNORE style handled by DB trigger/logic if possible, 
          // but here we rely on the users table existing. The trigger only auto-populates on MESSAGE insert.
          // So we might want to explicitly ensure they exist if we want them tracked before they send a message themselves.)
          // However, the requirement is "created as new users". 
          // The current schema has a trigger that auto-populates users when a message is inserted.
          // But that only covers the SENDER. We need to track RECIPIENTS too.
          
          // We'll verify if we need an explicit INSERT for these users.
          // The 'users' table is: email (PK), first_seen, last_seen, stats...
          // Let's add them if they don't exist.
          env.DB.prepare(`
            INSERT INTO users (email, first_seen, last_seen)
            VALUES (?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET last_seen = ?
          `).bind(email, receivedAt, receivedAt, receivedAt).run().catch(err => {
            console.error(`Failed to track user ${email}:`, err);
          });
        }
      }

      const aiTime = aiResponse.aiResponseTimeMs || 0;
      openaiUploadTimeMs = aiResponse.openaiUploadTimeMs || 0;
      const totalTimeSoFar = Date.now() - processingStartTime;
      ingestTimeMs = Math.max(0, totalTimeSoFar - aiTime - attachmentTimeMs - openaiUploadTimeMs);
      
      const inputTokens = aiResponse.tokensInput || 0;
      const outputTokens = aiResponse.tokensOutput || 0;
      costDollars = calculateCost(
        inputTokens, 
        outputTokens, 
        settings.costInputPer1m,
        settings.costOutputPer1m
      );
      
      const builtEmail = buildEmailWithFooter(aiResponse.reply, {
        totalTimeMs: totalTimeSoFar,
        ingestTimeMs,
        attachmentTimeMs,
        openaiUploadTimeMs,
        aiTimeMs: aiTime,
        inputTokens,
        outputTokens,
        costInDollars: costDollars,
        reasoningTokens: aiResponse.reasoningTokens,
        cachedTokens: aiResponse.cachedTokens,
        model: aiRequest.model,
        serviceTier: aiResponse.serviceTier,
        reasoningEffort: aiResponse.reasoningEffort
      });
      
      textBody = builtEmail.textBody;
      htmlBody = builtEmail.htmlBody;
      
      const emailReply: EmailReply = {
        from: replyToAddress,
        to: recipients.to,
        cc: recipients.cc,
        subject: `Re: ${postmarkData.Subject}`,
        textBody,
        htmlBody,
        replyTo: replyToAddress,
        inReplyTo: postmarkData.MessageID,
        references: referencesValue,
        originalMessageId: internalId
      };

      const sendResult = await env.MAILER.sendEmail(emailReply);
      if (sendResult.success) {
        sentAt = sendResult.sentAt || new Date().toISOString();
        mailerTimeMs = sendResult.sendTimeMs || null;
      }
    }

    // 7. Update D1
    const processingTimeMs = Date.now() - processingStartTime;
    await env.DB.prepare(`
      UPDATE messages
      SET llm_summary = ?, llm_reply = ?, tokens_input = ?, tokens_output = ?, 
      processing_time_ms = ?, ai_response_time_ms = ?, sent_at = ?, openai_response_id = ?,
      attachment_time_ms = ?, mailer_time_ms = ?, ingest_time_ms = ?, openai_upload_time_ms = ?, cost_dollars = ?,
      reasoning_tokens = ?, cached_tokens = ?, model = ?, service_tier = ?, reasoning_effort = ?,
      text_verbosity = ?
      WHERE id = ?
    `).bind(
      aiResponse.summary, aiResponse.reply, aiResponse.tokensInput || null, aiResponse.tokensOutput || null,
      processingTimeMs, aiResponse.aiResponseTimeMs || null, sentAt, aiResponse.openaiResponseId || null,
      attachmentTimeMs, mailerTimeMs, ingestTimeMs, openaiUploadTimeMs, costDollars,
      aiResponse.reasoningTokens || null, aiResponse.cachedTokens || null, aiRequest.model,
      aiResponse.serviceTier || null, aiResponse.reasoningEffort || null,
      aiResponse.textVerbosity || null,
      internalId
    ).run();

    if (sentAt) {
      await env.DB.prepare(`
        INSERT INTO messages (
          id, sent_at, received_at, subject, message_id, in_reply_to,
          from_name, from_email, raw_text, raw_html, direction, reply_to_message_id, email_address, recipient_email
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(), sentAt, sentAt, `Re: ${postmarkData.Subject}`,
        crypto.randomUUID(), postmarkData.MessageID,
        "Email2ChatGPT", rallyEmailAddress, textBody, htmlBody,
        'outbound', internalId, rallyEmailAddress, senderEmail
      ).run();
    }

    return new Response(JSON.stringify({ success: true, processingTimeMs }), {
      headers: { "content-type": "application/json" }
    });

  } catch (error) {
    console.error("Ingest Error:", error);
    if (postmarkData && (postmarkData.From || postmarkData.FromFull?.Email)) {
        try {
            const recipient = postmarkData.FromFull?.Email || postmarkData.From;
            const replyToAddress = extractRallyEmailAddress(postmarkData);
            const originalReferences = postmarkData.Headers?.find((h: any) => h.Name === "References")?.Value || "";
            const referencesValue = originalReferences ? `${originalReferences} ${postmarkData.MessageID}` : postmarkData.MessageID;
            
            const { textBody, htmlBody } = buildErrorEmail(
              "We encountered an error processing your email.",
              error instanceof Error ? error.message : String(error)
            );

            const errorReply: EmailReply = {
                from: replyToAddress || "no-reply@rallyflare.com",
                to: recipient,
                subject: `Re: ${postmarkData.Subject || "Your Request"}`,
                textBody,
                htmlBody,
                replyTo: replyToAddress || "no-reply@rallyflare.com",
                inReplyTo: postmarkData.MessageID,
                references: referencesValue,
                originalMessageId: internalId || undefined
            };

            await env.MAILER.sendEmail(errorReply);
            return new Response(JSON.stringify({ success: false, error: String(error), handled: true }), { status: 200 });
        } catch (emailError) {
            console.error("Failed to send error email:", emailError);
        }
    }
    return new Response(JSON.stringify({ success: false, error: String(error) }), { status: 500 });
  }
}

function extractRallyEmailAddress(postmarkData: PostmarkInboundMessage): string {
  return postmarkData.OriginalRecipient || postmarkData.ToFull?.[0]?.Email || postmarkData.To;
}

