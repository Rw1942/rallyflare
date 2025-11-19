/**
 * Email Template Builder
 * 
 * Assembles complete email HTML with proper structure for maximum email client compatibility.
 * Handles: content formatting + footer + proper container wrapping.
 */

import { formatForEmail } from './emailFormatter';
import { generateEmailFooter } from './footer';

export interface EmailMetrics {
  totalTimeMs: number;
  ingestTimeMs: number;
  attachmentTimeMs: number;
  openaiUploadTimeMs: number;
  aiTimeMs: number;
  inputTokens: number;
  outputTokens: number;
  costInDollars: number;
}

/**
 * Build complete email HTML with content + footer
 * 
 * Returns both text and HTML versions properly structured.
 * This is the single source of truth for email assembly.
 */
export function buildEmailWithFooter(
  aiResponseContent: string,
  metrics: EmailMetrics
): { textBody: string; htmlBody: string } {
  
  // 1. Generate footer
  const footer = generateEmailFooter(
    metrics.totalTimeMs,
    metrics.ingestTimeMs,
    metrics.attachmentTimeMs,
    metrics.openaiUploadTimeMs,
    metrics.aiTimeMs,
    metrics.inputTokens,
    metrics.outputTokens,
    metrics.costInDollars
  );

  // 2. Text version: simple concatenation
  const textBody = aiResponseContent + footer.text;

  // 3. HTML version: format content, then wrap in proper email container
  const formattedContent = formatForEmail(aiResponseContent);
  
  // Email-safe HTML structure:
  // - Outer container with max-width for readability
  // - Content section
  // - Footer section (already wrapped in its own div)
  // - All styles inline for email client compatibility
  const htmlBody = `
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0; padding: 0; color: #333333;">
  <div style="padding: 20px;">
    ${formattedContent}
  </div>
  ${footer.html}
</div>
`.trim();

  return { textBody, htmlBody };
}

/**
 * Build simple error email (no footer)
 */
export function buildErrorEmail(
  errorMessage: string,
  technicalDetails?: string
): { textBody: string; htmlBody: string } {
  
  const textBody = `Hi there,

We ran into a little hiccup while processing your email. We're sorry about that!

${technicalDetails ? `Error details: ${technicalDetails}\n\n` : ''}Please try again later.

Best,
The Rally Team`;

  const htmlBody = `
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0; padding: 20px; color: #333333;">
  <p>Hi there,</p>
  <p>We ran into a little hiccup while processing your email. We're sorry about that!</p>
  ${technicalDetails ? `
  <p>Here are the technical details of what happened:</p>
  <pre style="background-color: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; font-size: 12px; color: #666666;">
${technicalDetails}
  </pre>
  ` : ''}
  <p>Please try again later.</p>
  <p>Best,<br>The Rally Team</p>
</div>
`.trim();

  return { textBody, htmlBody };
}

/**
 * Build simple text email (like "missing system prompt" error)
 */
export function buildSimpleEmail(message: string): { textBody: string; htmlBody: string } {
  return {
    textBody: message,
    htmlBody: `
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0; padding: 20px; color: #333333;">
  <p>${message}</p>
</div>
`.trim()
  };
}

