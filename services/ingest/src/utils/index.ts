import { PostmarkInboundMessage } from "shared/types";

/**
 * Detects if an email contains images that should trigger HTML flattening.
 * Checks for:
 * 1. Inline attachments (ContentID present)
 * 2. <img> tags in the HTML body
 */
export function hasImages(postmarkData: PostmarkInboundMessage): boolean {
  // Check for inline attachments (Postmark treats embedded images as attachments with ContentID)
  const hasInlineAttachments = postmarkData.Attachments?.some(att => !!att.ContentID) || false;
  
  // Check for linked images in HTML (e.g. <img src="http...">)
  // Simple regex check for <img tag
  const hasImgTags = /<img\s+[^>]*>/i.test(postmarkData.HtmlBody || "");

  return hasInlineAttachments || hasImgTags;
}

/**
 * Flattens HTML to text, preserving image descriptions and structure.
 * Focuses on converting <img> tags to [Image: alt] markers.
 * 
 * @param html The HTML content to flatten
 * @param attachments Optional list of attachments to cross-reference inline images
 */
export function flattenHtml(html: string, attachments: PostmarkInboundMessage['Attachments'] = []): string {
  if (!html) return "";

  let text = html;

  // 1. Replace <img ...> with [Image: ...]
  // We use a regex that captures the whole tag to parse attributes manually
  text = text.replace(/<img([^>]*)>/gi, (match, attributes) => {
    // Extract src
    const srcMatch = /src=["']([^"']*)["']/i.exec(attributes);
    const src = srcMatch ? srcMatch[1] : "";

    // Extract alt
    const altMatch = /alt=["']([^"']*)["']/i.exec(attributes);
    const alt = altMatch ? altMatch[1] : "";

    // Check if it's an inline attachment (cid:)
    if (src.startsWith("cid:")) {
      const contentId = src.substring(4);
      const attachment = attachments.find(a => a.ContentID === contentId || a.ContentID === `<${contentId}>`); // Postmark sometimes wraps ContentID in <>

      if (attachment) {
        // Filter by size: Ignore small images (< 5KB) likely to be icons/tracking pixels
        if (attachment.ContentLength < 5000) {
          return ""; // Skip small images entirely to reduce noise
        }
        return ` [Image: ${alt || attachment.Name} (See Attachment: ${attachment.Name})] `;
      }
    }

    // For external images or unmatched attachments
    if (alt) {
      return ` [Image: ${alt}] `;
    }
    
    return " [Image] ";
  });

  // 2. Replace <br> and </p> and </div> with newlines to preserve structure
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<\/div>/gi, "\n");

  // 3. Replace links <a href="url">text</a> with "text (url)"
  text = text.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (match, url, content) => {
    return `${content.trim()} (${url})`;
  });

  // 4. Strip all remaining HTML tags
  text = text.replace(/<[^>]*>/g, "");

  // 5. Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // 6. Clean up excessive whitespace
  text = text.replace(/\n\s+\n/g, "\n\n"); // Collapse multiple blank lines containing spaces
  text = text.replace(/\n{3,}/g, "\n\n");  // Max 2 newlines
  
  return text.trim();
}

/**
 * Appends a list of non-inline attachments to the text body.
 * This ensures the AI is aware of PDFs, CSVs, etc.
 */
export function appendAttachments(text: string, attachments: PostmarkInboundMessage['Attachments'] = []): string {
  if (!attachments || attachments.length === 0) return text;

  // Filter out inline images (ContentID present) as they are handled by flattenHtml
  // Also filter out small images (< 5KB) to avoid noise
  const regularAttachments = attachments.filter(att => {
    const isInline = !!att.ContentID;
    const isSmallImage = att.ContentType.startsWith("image/") && att.ContentLength < 5000;
    return !isInline && !isSmallImage;
  });

  if (regularAttachments.length === 0) return text;

  const attachmentList = regularAttachments.map(att => {
    const size = formatBytes(att.ContentLength);
    return `- ${att.Name} (${size})`;
  }).join("\n");

  return `${text}\n\n[Attachments]\n${attachmentList}`;
}

/**
 * Helper to format bytes into human-readable string (KB, MB, etc.)
 */
function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Escapes special characters in a string for safe HTML rendering.
 */
export function escapeHtml(text: string): string {
  return (text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --- Cost Calculation Utils ---

export function calculateCost(inputTokens: number, outputTokens: number, inputRate: number, outputRate: number): number {
  const inputCost = (inputTokens / 1_000_000) * inputRate;
  const outputCost = (outputTokens / 1_000_000) * outputRate;

  return inputCost + outputCost;
}
