/**
 * Email Formatting Utilities
 * Handles content transformation and footer generation for outbound emails.
 *
 * Design intent: keep emails as plain as possible. We still convert markdown
 * to HTML so clients render headings/lists/tables/code readably, but we emit
 * bare semantic tags with NO inline CSS. The recipient's mail client decides
 * how things look. The footer carries stats only — no branding.
 */

import type { PostmarkInboundMessage } from "shared/types";

// ============ Address Formatting ============

export interface EmailContact {
  Email: string;
  Name?: string;
}

/**
 * Format "Name" <email> or just email
 */
export function formatAddress(contact: EmailContact): string {
  if (!contact) return "";
  if (contact.Name && contact.Name.trim().length > 0) {
    return `"${contact.Name}" <${contact.Email}>`;
  }
  return contact.Email;
}

/**
 * Helper to normalize email for deduping
 */
export function normalizeEmail(email: string | undefined | null): string {
  return (email || "").trim().toLowerCase();
}

/**
 * Calculates "Reply All" recipients based on the inbound message.
 * 
 * @param postmarkData The full inbound message object
 * @param rallyEmailAddress The email address of the current Rally instance (to remove from recipients)
 * @param originalSenderEmail The normalized email of the original sender (the person who wrote the email)
 * @returns An object containing `to` and `cc` strings ready for the mailer
 */
export function calculateReplyRecipients(
  postmarkData: PostmarkInboundMessage, 
  rallyEmailAddress: string,
  originalSenderEmail: string
): { to: string; cc: string | undefined } {
  const from = postmarkData.FromFull;
  const toList = postmarkData.ToFull || [];
  const ccList = postmarkData.CcFull || [];

  const allParticipantsMap = new Map<string, EmailContact>();

  function addContact(contact?: EmailContact) {
    if (!contact || !contact.Email) return;
    const key = normalizeEmail(contact.Email);
    if (!key) return;
    if (!allParticipantsMap.has(key)) {
      allParticipantsMap.set(key, contact);
    }
  }

  addContact(from);
  for (const t of toList) addContact(t);
  for (const c of ccList) addContact(c);

  // Remove Rally's own sending address
  const rallyKey = normalizeEmail(rallyEmailAddress);
  if (rallyKey) allParticipantsMap.delete(rallyKey);

  // Remove OriginalRecipient if different (and not the rally address itself)
  const originalRecipientKey = normalizeEmail(postmarkData.OriginalRecipient);
  if (originalRecipientKey && originalRecipientKey !== rallyKey) {
    allParticipantsMap.delete(originalRecipientKey);
  }

  // To: Original Sender
  const originalSenderKey = normalizeEmail(originalSenderEmail);
  
  // Try to get the best contact info for the original sender from our map
  // Fallback to constructing a simple contact if FromFull was missing but we have the email string
  const originalSender = allParticipantsMap.get(originalSenderKey) || 
    (from ? from : { Email: originalSenderEmail, Name: "" });
    
  // Remove sender from the "everyone else" list
  allParticipantsMap.delete(originalSenderKey);

  const toHeader = formatAddress(originalSender);
  const ccHeader = Array.from(allParticipantsMap.values())
    .map(formatAddress)
    .filter(Boolean)
    .join(", ");

  return { 
    to: toHeader, 
    cc: ccHeader || undefined 
  };
}

// ============ Content Formatting (AI response → Email HTML) ============

/**
 * Detect if text contains markdown formatting
 */
function isMarkdown(text: string): boolean {
  const markdownPatterns = [
    /^#{1,6}\s/m,           // Headers: # ## ###
    /\*\*[^*]+\*\*/,         // Bold: **text**
    /\*[^*]+\*/,             // Italic: *text*
    /^\s*[-*+]\s/m,         // Unordered lists: - item
    /^\s*\d+\.\s/m,         // Ordered lists: 1. item
    /```[\s\S]*?```/,       // Code blocks: ```code```
    /`[^`]+`/,              // Inline code: `code`
    /\[([^\]]+)\]\(([^)]+)\)/, // Links: [text](url)
    /\|.*\|/,               // Tables: | col | col |
  ];
  
  return markdownPatterns.some(pattern => pattern.test(text));
}

/**
 * Detect if text is HTML
 */
function isHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

/**
 * Escape HTML so plain text doesn't accidentally render as markup.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Convert a markdown table block to a bare semantic HTML <table>.
 */
function convertMarkdownTable(tableText: string): string {
  const lines = tableText.trim().split('\n');
  if (lines.length < 3) return tableText;

  const headerLine = lines[0];
  const dataLines = lines.slice(2); // Skip separator line
  const headers = headerLine.split('|').map(h => h.trim()).filter(h => h);

  let html = '<table border="1" cellpadding="6" cellspacing="0">';

  html += '<thead><tr>';
  for (const header of headers) {
    html += `<th>${header}</th>`;
  }
  html += '</tr></thead><tbody>';

  for (const line of dataLines) {
    const cells = line.split('|').map(c => c.trim()).filter(c => c);
    if (cells.length === 0) continue;
    html += '<tr>';
    for (const cell of cells) html += `<td>${cell}</td>`;
    html += '</tr>';
  }
  html += '</tbody></table>';

  return html;
}

/**
 * Convert markdown to bare semantic HTML (no inline CSS).
 * Email clients have sensible defaults for these tags.
 */
function markdownToHtml(text: string): string {
  let html = text;

  // Tables first (before other processing)
  html = html.replace(/^(\|.+\|)\n(\|[\s:-]+\|)\n((?:\|.+\|\n?)+)/gm, (match) => {
    return convertMarkdownTable(match);
  });

  // Code blocks before inline code
  html = html.replace(/```[\s\S]*?```/g, (match) => {
    const code = match.replace(/```/g, '').trim();
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  });

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Lists: convert consecutive bullet/numbered lines to <ul>/<ol>
  html = convertLists(html);

  // Paragraphs: split on blank lines, wrap non-block segments in <p>
  const paragraphs = html.split(/\n{2,}/);
  html = paragraphs.map(para => {
    para = para.trim();
    if (!para) return '';
    // If it already starts with a block-level tag, leave as-is
    if (/^<(table|h[1-6]|pre|ul|ol|blockquote|hr|div)/i.test(para)) {
      return para;
    }
    return `<p>${para.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');

  return html;
}

/**
 * Group consecutive list-marker lines into proper <ul>/<ol> blocks.
 * Runs after inline markdown so nested formatting is preserved.
 */
function convertLists(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let buffer: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const flush = () => {
    if (listType && buffer.length > 0) {
      out.push(`<${listType}>` + buffer.map(b => `<li>${b}</li>`).join('') + `</${listType}>`);
    }
    buffer = [];
    listType = null;
  };

  for (const line of lines) {
    const ul = line.match(/^\s*[-*+]\s+(.+)$/);
    const ol = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ul) {
      if (listType && listType !== 'ul') flush();
      listType = 'ul';
      buffer.push(ul[1]);
    } else if (ol) {
      if (listType && listType !== 'ol') flush();
      listType = 'ol';
      buffer.push(ol[1]);
    } else {
      flush();
      out.push(line);
    }
  }
  flush();
  return out.join('\n');
}

/**
 * Main formatter: converts AI response to email-compatible HTML.
 * - HTML in → passed through.
 * - Markdown in → converted to bare semantic HTML.
 * - Plain text in → escaped and wrapped in <pre> to preserve line breaks
 *   without imposing any styling.
 */
export function formatForEmail(aiResponse: string): string {
  if (!aiResponse) return '';

  if (isHtml(aiResponse)) {
    return aiResponse;
  }

  if (isMarkdown(aiResponse)) {
    return markdownToHtml(aiResponse);
  }

  return `<pre>${escapeHtml(aiResponse)}</pre>`;
}

// ============ Email Footer (Processing Metrics) ============

/**
 * Generate email footer with processing metrics.
 *
 * Footer is intentionally minimal and unbranded:
 *   - "---" separator
 *   - timing bullets
 *   - cost / token / model summary
 *
 * Returns both text and HTML versions for email-client compatibility.
 */
export function generateEmailFooter(
  totalTimeMs: number,
  ingestTimeMs: number,
  attachmentTimeMs: number,
  openaiUploadTimeMs: number,
  aiTimeMs: number,
  inputTokens: number,
  outputTokens: number,
  costInDollars: number,
  reasoningTokens?: number,
  cachedTokens?: number,
  model?: string,
  serviceTier?: string,
  reasoningEffort?: string
): { text: string; html: string } {

  const totalTimeDisplay = totalTimeMs >= 1000
    ? `${(totalTimeMs / 1000).toFixed(2)}s`
    : `${totalTimeMs}ms`;

  // Timing bullets — only include steps that actually happened.
  const bullets: string[] = [`Parsed email: ${ingestTimeMs}ms`];
  if (attachmentTimeMs > 0) bullets.push(`Saved attachments: ${attachmentTimeMs}ms`);
  if (openaiUploadTimeMs > 0) bullets.push(`Uploaded files to AI: ${openaiUploadTimeMs}ms`);
  bullets.push(`AI response: ${aiTimeMs}ms`);

  // Token usage line
  let tokenUsage = `${inputTokens.toLocaleString()} in`;
  if (cachedTokens && cachedTokens > 0) tokenUsage += ` (${cachedTokens.toLocaleString()} cached)`;
  tokenUsage += `, ${outputTokens.toLocaleString()} out`;
  if (reasoningTokens && reasoningTokens > 0) tokenUsage += ` (${reasoningTokens.toLocaleString()} reasoning)`;

  // Optional model/effort/tier suffix
  const aiConfig: string[] = [];
  if (model) aiConfig.push(model);
  if (reasoningEffort) aiConfig.push(`${reasoningEffort} effort`);
  if (serviceTier) aiConfig.push(serviceTier);

  // Build line-oriented body shared between text and HTML versions
  const lines: string[] = [
    `Total: ${totalTimeDisplay}`,
    ...bullets.map(b => `• ${b}`),
    `Cost: $${costInDollars.toFixed(4)} (${tokenUsage})`,
  ];
  if (aiConfig.length > 0) lines.push(aiConfig.join(' • '));

  const text = `\n\n---\n${lines.join('\n')}`;

  // HTML mirrors the text version: <hr> separator + escaped lines with <br>.
  // No inline CSS — the recipient's client styles it.
  const html = `\n<hr>\n${lines.map(escapeHtml).join('<br>\n')}\n`;

  return { text, html };
}
