/**
 * Shared Dashboard Components
 * 
 * This file contains reusable UI components and scripts for the server-side rendered dashboard.
 * Primary use is ensuring consistent display of messages across different views (e.g., Messages list, User History).
 */
import { escapeHtml } from "../../utils/index";

export const messageScripts = `
  function toggleMessage(id) {
    const content = document.getElementById('content-' + id);
    if (content.style.display === 'block') {
      content.style.display = 'none';
    } else {
      content.style.display = 'block';
    }
  }
`;

export function renderMessageRow(msg: any): string {
  const isInbound = msg.direction !== 'outbound';
  const rawDate = msg.received_at || msg.sent_at || new Date().toISOString();
  const date = new Date(rawDate).toLocaleString('en-US', { timeZone: 'America/Denver' });
  
  // Determine From and To using actual database fields
  const fromEmail = msg.from_email || 'Unknown';
  const fromName = msg.from_name || fromEmail;
  const toEmail = isInbound ? (msg.email_address || 'Unknown') : (msg.recipient_email || 'Unknown');
  
  // Create preview from text or HTML (strip tags for preview)
  const previewText = msg.raw_text 
    ? msg.raw_text.substring(0, 150).replace(/\s+/g, ' ').trim() + (msg.raw_text.length > 150 ? '...' : '')
    : (msg.raw_html ? 'Click to view HTML content...' : 'No content');
  
  // Full HTML content for expansion
  const htmlContent = msg.raw_html || (msg.raw_text ? `<pre style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(msg.raw_text)}</pre>` : '<p class="text-muted">No content</p>');
  const safeId = msg.id;
  
  return `
    <div class="message-item" style="cursor: pointer; padding: 1rem; border-bottom: 1px solid #eee;" onclick="toggleMessage('${safeId}')">
      <div class="msg-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <span class="badge ${isInbound ? 'badge-inbound' : 'badge-outbound'}">${isInbound ? 'Inbound' : 'Outbound'}</span>
        <span class="msg-time text-sm text-muted" data-timestamp="${rawDate}">${date}</span>
      </div>
      
      <div class="msg-subject" style="font-weight: 600; margin-bottom: 0.5rem;">${escapeHtml(msg.subject || '(No Subject)')}</div>
      
      <div class="msg-participants text-sm text-muted" style="margin-bottom: 0.5rem;">
        <div><strong>From:</strong> ${escapeHtml(fromName)} &lt;${escapeHtml(fromEmail)}&gt;</div>
        <div><strong>To:</strong> ${escapeHtml(toEmail)}</div>
      </div>
      
      <div class="msg-preview text-sm text-muted" style="font-style: italic;">
        ${escapeHtml(previewText)}
      </div>
      
      <div id="content-${safeId}" class="msg-content" style="display: none; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #ddd; background: #fafafa; padding: 1rem; border-radius: 4px; max-height: 600px; overflow-y: auto;" onclick="event.stopPropagation()">
         <div class="email-body" style="background: white; padding: 1rem; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
           ${htmlContent}
         </div>
      </div>
    </div>
  `;
}
