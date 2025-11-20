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
  
  // Determine From and To based on direction
  let fromDisplay, toDisplay;
  if (isInbound) {
    // Inbound: User sent TO Rally persona
    fromDisplay = msg.from_name ? `${msg.from_name} <${msg.from_email}>` : msg.from_email;
    toDisplay = msg.email_address || 'Rally';
  } else {
    // Outbound: Rally persona sent TO User
    fromDisplay = msg.email_address || 'Rally';
    toDisplay = msg.recipient_email || 'User';
  }
  
  // Create preview from text or HTML
  const previewText = msg.raw_text 
    ? msg.raw_text.substring(0, 120).replace(/\s+/g, ' ').trim() + (msg.raw_text.length > 120 ? '...' : '')
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
        <div><strong>From:</strong> ${escapeHtml(fromDisplay)}</div>
        <div><strong>To:</strong> ${escapeHtml(toDisplay)}</div>
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

export function renderPagination(currentPage: number, totalPages: number, baseUrl: string): string {
  if (totalPages <= 1) return '';

  const prevPage = currentPage > 1 ? currentPage - 1 : 1;
  const nextPage = currentPage < totalPages ? currentPage + 1 : totalPages;
  
  // Simple URL construction assuming baseUrl is a path like "/messages"
  // and we don't have other query params to preserve yet.
  const getUrl = (page: number) => `${baseUrl}?page=${page}`;

  return `
    <div class="pagination" style="display: flex; justify-content: center; gap: 1rem; margin-top: 2rem; align-items: center; padding: 1rem;">
      ${currentPage > 1 
        ? `<a href="${getUrl(prevPage)}" class="btn" style="text-decoration: none; padding: 0.5rem 1rem; background: #f0f0f0; border-radius: 4px; color: #333;">&larr; Previous</a>` 
        : `<span class="btn disabled" style="opacity: 0.5; cursor: not-allowed; padding: 0.5rem 1rem; background: #f0f0f0; border-radius: 4px; color: #333;">&larr; Previous</span>`}
      
      <span class="text-muted" style="font-weight: 500;">Page ${currentPage} of ${totalPages}</span>
      
      ${currentPage < totalPages 
        ? `<a href="${getUrl(nextPage)}" class="btn" style="text-decoration: none; padding: 0.5rem 1rem; background: #f0f0f0; border-radius: 4px; color: #333;">Next &rarr;</a>` 
        : `<span class="btn disabled" style="opacity: 0.5; cursor: not-allowed; padding: 0.5rem 1rem; background: #f0f0f0; border-radius: 4px; color: #333;">Next &rarr;</span>`}
    </div>
  `;
}
