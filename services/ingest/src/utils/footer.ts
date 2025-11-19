/**
 * Generate email footer with processing metrics
 * Returns both text and HTML versions for email compatibility
 */
export function generateEmailFooter(
  totalTimeMs: number,
  ingestTimeMs: number,
  attachmentTimeMs: number,
  openaiUploadTimeMs: number,
  aiTimeMs: number,
  inputTokens: number,
  outputTokens: number,
  costInDollars: number
): { text: string; html: string } {
  
  const totalTimeDisplay = totalTimeMs >= 1000 
    ? `${(totalTimeMs / 1000).toFixed(2)} seconds`
    : `${totalTimeMs}ms`;

  // Build bullet list conditionally
  const bullets: string[] = [
    `Received and parsed your email: ${ingestTimeMs}ms`
  ];
  
  if (attachmentTimeMs > 0) {
    bullets.push(`Saved attachments to storage: ${attachmentTimeMs}ms`);
  }
  
  if (openaiUploadTimeMs > 0) {
    bullets.push(`Uploaded files for AI analysis: ${openaiUploadTimeMs}ms`);
  }
  
  bullets.push(`AI generated response: ${aiTimeMs}ms`);

  // Plain text version
  const text = `\n\n---\nRally processed this email in ${totalTimeDisplay}:\n` +
    bullets.map(b => `• ${b}`).join('\n') +
    `\n\nAI Usage: $${costInDollars.toFixed(4)} (read ${inputTokens.toLocaleString()} tokens, generated ${outputTokens.toLocaleString()} tokens)`;

  // HTML version - simple table for maximum email client compatibility
  const html = `
<br><br>
<table style="margin-top: 20px; padding-top: 12px; border-top: 1px solid #e0e0e0; font-family: Arial, sans-serif; font-size: 11px; color: #888888; width: 100%;">
  <tr>
    <td colspan="2" style="padding-bottom: 8px; font-weight: 600; color: #666666;">Rally processed this email in ${totalTimeDisplay}:</td>
  </tr>
  ${bullets.map(b => `<tr><td style="padding: 2px 0; padding-left: 8px; vertical-align: top;">&bull;</td><td style="padding: 2px 0;">${b}</td></tr>`).join('')}
  <tr>
    <td colspan="2" style="padding-top: 8px; font-weight: 600; color: #666666;">AI Usage: <span style="font-weight: 400; color: #888888;">$${costInDollars.toFixed(4)} (read ${inputTokens.toLocaleString()} tokens, generated ${outputTokens.toLocaleString()} tokens)</span></td>
  </tr>
</table>
`;

  return { text, html };
}

