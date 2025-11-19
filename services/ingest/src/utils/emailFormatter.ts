/**
 * Email Formatter - Converts AI responses to email-safe HTML
 * 
 * Handles 3 input formats:
 * 1. Plain text (most common)
 * 2. Markdown (common from GPT-5.1)
 * 3. HTML (rare, but possible)
 * 
 * Strategy: Detect format, convert to clean HTML with inline styles
 */

/**
 * Detect if text contains markdown formatting
 */
function isMarkdown(text: string): boolean {
  // Look for common markdown patterns
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
  // Simple check: contains HTML tags
  return /<[a-z][\s\S]*>/i.test(text);
}

/**
 * Convert markdown table to HTML table
 * Handles: | Header | Header |\n|---|---|\n| Cell | Cell |
 */
function convertMarkdownTable(tableText: string): string {
  const lines = tableText.trim().split('\n');
  if (lines.length < 3) return tableText; // Not a valid table
  
  // First line = headers, second line = separator (---), rest = rows
  const headerLine = lines[0];
  const dataLines = lines.slice(2); // Skip separator line
  
  // Parse headers
  const headers = headerLine.split('|').map(h => h.trim()).filter(h => h);
  
  // Build HTML table
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
    if (cells.length === 0) return; // Skip empty lines
    
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
 * Handles: headers, bold, italic, code, links, lists, and TABLES
 */
function markdownToHtml(text: string): string {
  let html = text;
  
  // TABLES FIRST (before other processing)
  // Match: line with pipes, followed by separator line, followed by data lines
  html = html.replace(/^(\|.+\|)\n(\|[\s:-]+\|)\n((?:\|.+\|\n?)+)/gm, (match) => {
    return convertMarkdownTable(match);
  });
  
  // Code blocks BEFORE inline code (to avoid double processing)
  html = html.replace(/```[\s\S]*?```/g, (match) => {
    const code = match.replace(/```/g, '').trim();
    return `<pre style="background: #f4f4f4; padding: 12px; border-radius: 4px; overflow-x: auto; font-family: monospace; font-size: 12px; margin: 12px 0; line-height: 1.4;">${code}</pre>`;
  });
  
  // Headers (### before ## before #)
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size: 16px; font-weight: 600; color: #333; margin: 16px 0 8px;">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-size: 18px; font-weight: 600; color: #333; margin: 18px 0 10px;">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 style="font-size: 20px; font-weight: 600; color: #333; margin: 20px 0 12px;">$1</h1>');
  
  // Bold **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight: 600;">$1</strong>');
  
  // Italic *text* (after bold to avoid conflicts)
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // Inline code `code`
  html = html.replace(/`([^`]+)`/g, '<code style="background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 12px;">$1</code>');
  
  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #007bff; text-decoration: none;">$1</a>');
  
  // Unordered lists: - item or * item
  html = html.replace(/^(\s*)[-*+]\s+(.+)$/gm, '$1• $2');
  
  // Ordered lists: 1. item (preserve numbering)
  html = html.replace(/^(\s*)(\d+)\.\s+(.+)$/gm, '$1$2. $3');
  
  // Paragraphs: double newlines → paragraph breaks
  const paragraphs = html.split('\n\n');
  html = paragraphs.map(para => {
    para = para.trim();
    if (!para) return '';
    // Don't wrap block elements (tables, headers, code)
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
  
  // Detect format
  if (isHtml(aiResponse)) {
    // Already HTML - just ensure inline styles (basic cleanup)
    return aiResponse;
  }
  
  if (isMarkdown(aiResponse)) {
    // Convert markdown to HTML
    return markdownToHtml(aiResponse);
  }
  
  // Plain text - wrap in styled div with line breaks
  return '<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; white-space: pre-wrap;">' + 
    aiResponse.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + 
    '</div>';
}

