/**
 * Email Formatting Utilities
 * Handles content transformation and footer generation for outbound emails
 */

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
 * Convert markdown table to HTML table
 */
function convertMarkdownTable(tableText: string): string {
  const lines = tableText.trim().split('\n');
  if (lines.length < 3) return tableText;
  
  const headerLine = lines[0];
  const dataLines = lines.slice(2); // Skip separator line
  const headers = headerLine.split('|').map(h => h.trim()).filter(h => h);
  
  let html = '<table style="border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 13px;">';
  
  // Header row
  html += '<thead><tr>';
  headers.forEach(header => {
    html += `<th style="border: 1px solid #ddd; padding: 8px; background: #f8f9fa; text-align: left; font-weight: 600;">${header}</th>`;
  });
  html += '</tr></thead>';
  
  // Data rows
  html += '<tbody>';
  dataLines.forEach(line => {
    const cells = line.split('|').map(c => c.trim()).filter(c => c);
    if (cells.length === 0) return;
    
    html += '<tr>';
    cells.forEach(cell => {
      html += `<td style="border: 1px solid #ddd; padding: 8px;">${cell}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  
  return html;
}

/**
 * Convert markdown to email-safe HTML
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
    return `<pre style="background: #f4f4f4; padding: 12px; border-radius: 4px; overflow-x: auto; font-family: monospace; font-size: 12px; margin: 12px 0; line-height: 1.4;">${code}</pre>`;
  });
  
  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size: 16px; font-weight: 600; color: #333; margin: 16px 0 8px;">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-size: 18px; font-weight: 600; color: #333; margin: 18px 0 10px;">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 style="font-size: 20px; font-weight: 600; color: #333; margin: 20px 0 12px;">$1</h1>');
  
  // Bold and italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight: 600;">$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 12px;">$1</code>');
  
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #007bff; text-decoration: none;">$1</a>');
  
  // Lists
  html = html.replace(/^(\s*)[-*+]\s+(.+)$/gm, '$1• $2');
  html = html.replace(/^(\s*)(\d+)\.\s+(.+)$/gm, '$1$2. $3');
  
  // Paragraphs
  const paragraphs = html.split('\n\n');
  html = paragraphs.map(para => {
    para = para.trim();
    if (!para) return '';
    if (para.startsWith('<table') || para.startsWith('<h') || para.startsWith('<pre')) {
      return para;
    }
    return `<p style="margin: 0 0 12px; line-height: 1.6; color: #333;">${para.replace(/\n/g, '<br>')}</p>`;
  }).join('');
  
  return html;
}

/**
 * Main formatter: Converts AI response to email-compatible HTML
 */
export function formatForEmail(aiResponse: string): string {
  if (!aiResponse) return '';
  
  if (isHtml(aiResponse)) {
    return aiResponse;
  }
  
  if (isMarkdown(aiResponse)) {
    return markdownToHtml(aiResponse);
  }
  
  // Plain text fallback
  return '<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; white-space: pre-wrap;">' + 
    aiResponse.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + 
    '</div>';
}

// ============ Email Footer (Processing Metrics) ============

/**
 * Generate email footer with processing metrics
 * Returns both text and HTML versions for email client compatibility
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
    ? `${(totalTimeMs / 1000).toFixed(2)} seconds`
    : `${totalTimeMs}ms`;

  // Build bullet list of processing steps
  const bullets: string[] = [`Received and parsed your email: ${ingestTimeMs}ms`];
  
  if (attachmentTimeMs > 0) {
    bullets.push(`Saved attachments to storage: ${attachmentTimeMs}ms`);
  }
  
  if (openaiUploadTimeMs > 0) {
    bullets.push(`Uploaded files for AI analysis: ${openaiUploadTimeMs}ms`);
  }
  
  bullets.push(`AI generated response: ${aiTimeMs}ms`);

  // Token usage breakdown
  let tokenUsage = `read ${inputTokens.toLocaleString()} tokens`;
  if (cachedTokens && cachedTokens > 0) {
    tokenUsage += ` (${cachedTokens.toLocaleString()} cached)`;
  }
  tokenUsage += `, generated ${outputTokens.toLocaleString()} tokens`;
  if (reasoningTokens && reasoningTokens > 0) {
    tokenUsage += ` (${reasoningTokens.toLocaleString()} reasoning)`;
  }

  // AI configuration
  const aiConfig: string[] = [];
  if (model) aiConfig.push(model);
  if (reasoningEffort) aiConfig.push(`${reasoningEffort} effort`);
  if (serviceTier) aiConfig.push(serviceTier);
  const aiConfigStr = aiConfig.length > 0 ? ` • ${aiConfig.join(', ')}` : '';

  // Plain text version
  const text = `\n\n---\nRally processed this email in ${totalTimeDisplay}:\n` +
    bullets.map(b => `• ${b}`).join('\n') +
    `\n\nAI Usage: $${costInDollars.toFixed(4)} (${tokenUsage})${aiConfigStr}`;

  // HTML version
  const html = `
<div style="margin-top: 24px;">
<table style="padding-top: 12px; border-top: 1px solid #e0e0e0; font-family: Arial, sans-serif; font-size: 11px; color: #888888; width: 100%;">
  <tr>
    <td colspan="2" style="padding-bottom: 8px; font-weight: 600; color: #666666;">Rally processed this email in ${totalTimeDisplay}:</td>
  </tr>
  ${bullets.map(b => `<tr><td style="padding: 2px 0; padding-left: 8px; vertical-align: top;">&bull;</td><td style="padding: 2px 0;">${b}</td></tr>`).join('')}
  <tr>
    <td colspan="2" style="padding-top: 8px; font-weight: 600; color: #666666;">AI Usage: <span style="font-weight: 400; color: #888888;">$${costInDollars.toFixed(4)} (${tokenUsage})${aiConfigStr}</span></td>
  </tr>
</table>
</div>
`;

  return { text, html };
}

