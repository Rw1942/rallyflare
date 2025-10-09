interface Message {
  id: string;
  received_at: string;
  sent_at?: string;
  subject: string;
  from_name: string;
  from_email: string;
  direction?: string;
  llm_summary?: string;
  llm_reply?: string;
  has_attachments?: number;
  reply_to_message_id?: string;
}

export function renderDashboard(messages: Message[]) {
  const inbound = messages.filter(m => m.direction !== 'outbound');
  const outbound = messages.filter(m => m.direction === 'outbound');
  
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Rally - Email Activity</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
            color: #2d3748;
            line-height: 1.6;
            min-height: 100vh;
            padding: 2rem;
          }
          
          .container {
            max-width: 1400px;
            margin: 0 auto;
          }
          
          header {
            margin-bottom: 3rem;
            text-align: center;
          }
          
          .logo {
            font-size: 2.5rem;
            font-weight: 700;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 0.5rem;
          }
          
          .tagline {
            color: #718096;
            font-size: 1rem;
            font-weight: 400;
          }
          
          .nav {
            display: flex;
            justify-content: center;
            gap: 1rem;
            margin-top: 2rem;
          }
          
          .nav-button {
            padding: 0.75rem 1.5rem;
            background: white;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            color: #4a5568;
            text-decoration: none;
            font-weight: 500;
            transition: all 0.2s ease;
            cursor: pointer;
          }
          
          .nav-button:hover {
            background: #667eea;
            color: white;
            border-color: #667eea;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
          }
          
          .nav-button.disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          
          .nav-button.disabled:hover {
            background: white;
            color: #4a5568;
            border-color: #e2e8f0;
            transform: none;
            box-shadow: none;
          }
          
          .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 1.5rem;
            margin-bottom: 3rem;
          }
          
          .stat-card {
            background: white;
            padding: 1.5rem;
            border-radius: 16px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
            border: 1px solid rgba(102, 126, 234, 0.1);
          }
          
          .stat-label {
            color: #718096;
            font-size: 0.875rem;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 0.5rem;
          }
          
          .stat-value {
            font-size: 2.5rem;
            font-weight: 700;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          
          .section {
            margin-bottom: 3rem;
          }
          
          .section-header {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 1.5rem;
          }
          
          .section-icon {
            width: 40px;
            height: 40px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.25rem;
          }
          
          .section-icon.inbound {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          
          .section-icon.outbound {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          }
          
          .section-title {
            font-size: 1.5rem;
            font-weight: 600;
            color: #2d3748;
          }
          
          .messages-grid {
            display: grid;
            gap: 1rem;
          }
          
          .message-card {
            background: white;
            border-radius: 16px;
            padding: 1.5rem;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
            border: 1px solid #e2e8f0;
            transition: all 0.2s ease;
            cursor: pointer;
          }
          
          .message-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
            border-color: #667eea;
          }
          
          .message-header {
            display: flex;
            justify-content: space-between;
            align-items: start;
            margin-bottom: 1rem;
          }
          
          .message-from {
            flex: 1;
          }
          
          .message-name {
            font-weight: 600;
            color: #2d3748;
            font-size: 1rem;
            margin-bottom: 0.25rem;
          }
          
          .message-email {
            color: #718096;
            font-size: 0.875rem;
          }
          
          .message-time {
            color: #a0aec0;
            font-size: 0.875rem;
            white-space: nowrap;
            margin-left: 1rem;
          }
          
          .message-subject {
            font-size: 1.125rem;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 0.75rem;
          }
          
          .message-preview {
            color: #718096;
            font-size: 0.875rem;
            line-height: 1.5;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }
          
          .message-footer {
            display: flex;
            gap: 0.75rem;
            margin-top: 1rem;
            flex-wrap: wrap;
          }
          
          .badge {
            display: inline-flex;
            align-items: center;
            padding: 0.375rem 0.75rem;
            border-radius: 8px;
            font-size: 0.75rem;
            font-weight: 500;
            gap: 0.375rem;
          }
          
          .badge.has-attachment {
            background: #fef5e7;
            color: #d68910;
          }
          
          .badge.ai-processed {
            background: #e8f4f8;
            color: #0e7490;
          }
          
          .badge.replied {
            background: #dcfce7;
            color: #15803d;
          }
          
          .empty-state {
            text-align: center;
            padding: 4rem 2rem;
            background: white;
            border-radius: 16px;
            border: 2px dashed #e2e8f0;
          }
          
          .empty-icon {
            font-size: 3rem;
            margin-bottom: 1rem;
            opacity: 0.5;
          }
          
          .empty-text {
            color: #718096;
            font-size: 1rem;
          }
          
          @media (max-width: 768px) {
            body {
              padding: 1rem;
            }
            
            .logo {
              font-size: 2rem;
            }
            
            .stats {
              grid-template-columns: 1fr;
            }
            
            .message-header {
              flex-direction: column;
            }
            
            .message-time {
              margin-left: 0;
              margin-top: 0.5rem;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
        <header>
            <h1 class="logo">Rally</h1>
            <p class="tagline">Your intelligent email assistant, working invisibly</p>
            <nav class="nav">
              <a href="/" class="nav-button">Activity</a>
              <button class="nav-button disabled" disabled>Settings (Coming Soon)</button>
              <button class="nav-button disabled" disabled>AI Prompts (Coming Soon)</button>
            </nav>
        </header>
          
          <div class="stats">
            <div class="stat-card">
              <div class="stat-label">Total Messages</div>
              <div class="stat-value">${messages.length}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Received</div>
              <div class="stat-value">${inbound.length}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Sent Replies</div>
              <div class="stat-value">${outbound.length}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">AI Processed</div>
              <div class="stat-value">${messages.filter(m => m.llm_summary).length}</div>
            </div>
          </div>
          
          <div class="section">
            <div class="section-header">
              <div class="section-icon inbound">📨</div>
              <h2 class="section-title">Incoming Messages</h2>
            </div>
            <div class="messages-grid">
              ${inbound.length > 0 ? inbound.map(msg => renderMessageCard(msg, 'inbound')).join('') : renderEmptyState('No incoming messages yet', '📭')}
            </div>
          </div>
          
          <div class="section">
            <div class="section-header">
              <div class="section-icon outbound">📤</div>
              <h2 class="section-title">Outgoing Replies</h2>
            </div>
            <div class="messages-grid">
              ${outbound.length > 0 ? outbound.map(msg => renderMessageCard(msg, 'outbound')).join('') : renderEmptyState('No replies sent yet', '✉️')}
            </div>
          </div>
        </div>
        
        <script>
          // Add click handlers for message cards
          document.querySelectorAll('.message-card').forEach(card => {
            card.addEventListener('click', function() {
              const messageId = this.dataset.messageId;
              window.location.href = '/messages/' + messageId;
            });
          });
        </script>
      </body>
    </html>
`;
}

function renderMessageCard(msg: Message, type: 'inbound' | 'outbound'): string {
  const time = msg.received_at || msg.sent_at || '';
  const displayTime = formatTime(time);
  const hasAttachment = msg.has_attachments === 1;
  const aiProcessed = !!msg.llm_summary;
  const hasReply = !!msg.llm_reply;
  
  return `
    <div class="message-card" data-message-id="${msg.id}">
      <div class="message-header">
        <div class="message-from">
          <div class="message-name">${escapeHtml(msg.from_name || 'Unknown')}</div>
          <div class="message-email">${escapeHtml(msg.from_email || '')}</div>
        </div>
        <div class="message-time">${displayTime}</div>
      </div>
      <div class="message-subject">${escapeHtml(msg.subject || '(no subject)')}</div>
      <div class="message-preview">${escapeHtml(msg.llm_summary || msg.llm_reply || 'No preview available')}</div>
      <div class="message-footer">
        ${hasAttachment ? '<span class="badge has-attachment">📎 Attachment</span>' : ''}
        ${aiProcessed ? '<span class="badge ai-processed">✨ AI Processed</span>' : ''}
        ${hasReply && type === 'inbound' ? '<span class="badge replied">✓ Replied</span>' : ''}
      </div>
    </div>
  `;
}

function renderEmptyState(text: string, icon: string): string {
  return `
    <div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <div class="empty-text">${text}</div>
    </div>
  `;
}

function formatTime(isoString: string): string {
  if (!isoString) return '';
  
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  } catch {
    return isoString;
  }
}

function escapeHtml(text: string): string {
  const div = { textContent: text };
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Legacy function for backwards compatibility
export function renderHtml(content: string) {
  return renderDashboard([]);
}
