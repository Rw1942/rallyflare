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
    /\[([^\]]+)\]\(([^)]+)\)/ // Links: [text](url)
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
 * Convert markdown to email-safe HTML
 * Simple patterns only - no complex parsing
 */
function markdownToHtml(text: string): string {
  let html = text;
  
  // Headers (# Header → <h3>)
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size: 16px; font-weight: 600; color: #333; margin: 16px 0 8px;">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-size: 18px; font-weight: 600; color: #333; margin: 18px 0 10px;">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 style="font-size: 20px; font-weight: 600; color: #333; margin: 20px 0 12px;">$1</h1>');
  
  // Bold **text** → <strong>
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight: 600;">$1</strong>');
  
  // Italic *text* → <em>
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // Inline code `code` → <code>
  html = html.replace(/`([^`]+)`/g, '<code style="background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 12px;">$1</code>');
  
  // Code blocks ```code``` → <pre>
  html = html.replace(/```[\s\S]*?```/g, (match) => {
    const code = match.replace(/```/g, '').trim();
    return `<pre style="background: #f4f4f4; padding: 12px; border-radius: 4px; overflow-x: auto; font-family: monospace; font-size: 12px; margin: 12px 0;">${code}</pre>`;
  });
  
  // Links [text](url) → <a>
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #007bff; text-decoration: none;">$1</a>');
  
  // Unordered lists - * item or - item
  html = html.replace(/^(\s*)[-*+]\s+(.+)$/gm, '$1• $2');
  
  // Ordered lists - 1. item (keep as is, just ensure spacing)
  html = html.replace(/^(\s*)(\d+)\.\s+(.+)$/gm, '$1$2. $3');
  
  // Paragraphs: double newlines become paragraph breaks
  html = html.split('\n\n').map(para => {
    para = para.trim();
    if (!para) return '';
    // Don't wrap if already a block element
    if (para.startsWith('<h') || para.startsWith('<pre') || para.startsWith('<ul') || para.startsWith('<ol')) {
      return para;
    }
    return `<p style="margin: 0 0 12px; line-height: 1.6;">${para}</p>`;
  }).join('');
  
  // Single newlines within paragraphs → <br>
  html = html.replace(/\n/g, '<br>');
  
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

