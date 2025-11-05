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
  processing_time_ms?: number;
  ai_response_time_ms?: number;
  tokens_input?: number;
  tokens_output?: number;
  email_address?: string;
}

// Shared CSS - one place to maintain consistency
const SHARED_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
            color: #2d3748;
            line-height: 1.6;
            min-height: 100vh;
            padding: 2rem;
          }
          
  .container { max-width: 1400px; margin: 0 auto; }
  header { margin-bottom: 3rem; text-align: center; }
          
          .logo {
            font-size: 2.5rem;
            font-weight: 700;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 0.5rem;
          }
          
  .tagline { color: #718096; font-size: 1rem; font-weight: 400; }
  
  .nav { display: flex; justify-content: center; gap: 1rem; margin-top: 2rem; }
          
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
          
  .nav-button.active { background: #667eea; color: white; border-color: #667eea; }
  
  .card {
            background: white;
            border-radius: 16px;
            padding: 1.5rem;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
            border: 1px solid #e2e8f0;
            transition: all 0.2s ease;
          }
          
  .card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
            border-color: #667eea;
          }
          
  .btn {
    padding: 0.875rem 2rem;
    border: none;
    border-radius: 12px;
            font-weight: 600;
            font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    text-decoration: none;
    display: inline-block;
    text-align: center;
  }
  
  .btn-primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }
  
  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
  }
  
  .btn-secondary { background: white; color: #4a5568; border: 2px solid #e2e8f0; }
  .btn-secondary:hover { background: #f7fafc; border-color: #cbd5e0; }
  .btn-danger { background: #e53e3e; color: white; padding: 0.5rem 1rem; font-size: 0.875rem; }
  .btn-danger:hover { background: #c53030; }
  
  .form-group { margin-bottom: 1.5rem; }
  .form-label { display: block; font-weight: 600; color: #2d3748; margin-bottom: 0.5rem; font-size: 0.95rem; }
  
  .form-input, .form-textarea {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    font-family: inherit;
    font-size: 0.95rem;
    transition: border-color 0.2s ease;
  }
  
  .form-textarea { padding: 1rem; line-height: 1.6; resize: vertical; min-height: 150px; }
  .form-input:focus, .form-textarea:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
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
          
          .empty-state {
            text-align: center;
            padding: 4rem 2rem;
            background: white;
            border-radius: 16px;
            border: 2px dashed #e2e8f0;
          }
          
  .empty-icon { font-size: 3rem; margin-bottom: 1rem; opacity: 0.5; }
  .empty-text { color: #718096; font-size: 1rem; }
  
  .modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
  }
  
  .modal.show { display: flex; align-items: center; justify-content: center; }
  
  .modal-content {
    background: white;
    border-radius: 16px;
    padding: 2rem;
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }
  
  .modal-title { font-size: 1.5rem; font-weight: 600; color: #2d3748; }
  .modal-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #a0aec0; }
  .modal-close:hover { color: #4a5568; }
  
  @media (max-width: 768px) {
    body { padding: 1rem; }
    .logo { font-size: 2rem; }
  }
`;

// Header component with navigation
function renderHeader(activePage: string, tagline: string): string {
  const pages = ['/', '/settings', '/email-prompts', '/users', '/requests'];
  const labels = ['Activity', 'Settings', 'Email Prompts', 'Users', 'Requests'];
  
  return `
        <header>
            <h1 class="logo">Rally</h1>
      <p class="tagline">${tagline}</p>
            <nav class="nav">
        ${pages.map((page, i) => 
          `<a href="${page}" class="nav-button ${activePage === page ? 'active' : ''}">${labels[i]}</a>`
        ).join('')}
            </nav>
        </header>
  `;
}

// Layout wrapper for all pages
function renderLayout(title: string, activePage: string, tagline: string, content: string, extraStyles = '', extraScripts = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>${SHARED_STYLES}${extraStyles}</style>
  </head>
  <body>
    <div class="container">
      ${renderHeader(activePage, tagline)}
      ${content}
            </div>
    ${extraScripts}
  </body>
</html>`;
}

// Dashboard page
export function renderDashboard(messages: Message[]) {
  const inbound = messages.filter(m => m.direction !== 'outbound');
  const outbound = messages.filter(m => m.direction === 'outbound');
  
  const content = `
    <div class="stats">
      <div class="stat-card"><div class="stat-label">Total Messages</div><div class="stat-value">${messages.length}</div></div>
      <div class="stat-card"><div class="stat-label">Received</div><div class="stat-value">${inbound.length}</div></div>
      <div class="stat-card"><div class="stat-label">Sent Replies</div><div class="stat-value">${outbound.length}</div></div>
      <div class="stat-card"><div class="stat-label">AI Processed</div><div class="stat-value">${messages.filter(m => m.llm_summary).length}</div></div>
    </div>
          <div class="section">
      <div class="section-header"><div class="section-icon inbound">📨</div><h2 class="section-title">Incoming Messages</h2></div>
      <div class="messages-grid">${inbound.length > 0 ? inbound.map(msg => renderMessageCard(msg, 'inbound')).join('') : renderEmptyState('No incoming messages yet', '📭')}</div>
            </div>
          <div class="section">
      <div class="section-header"><div class="section-icon outbound">📤</div><h2 class="section-title">Outgoing Replies</h2></div>
      <div class="messages-grid">${outbound.length > 0 ? outbound.map(msg => renderMessageCard(msg, 'outbound')).join('') : renderEmptyState('No replies sent yet', '✉️')}</div>
            </div>
  `;
  
  const styles = `
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; margin-bottom: 3rem; }
    .stat-card { background: white; padding: 1.5rem; border-radius: 16px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04); border: 1px solid rgba(102, 126, 234, 0.1); }
    .stat-label { color: #718096; font-size: 0.875rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
    .stat-value { font-size: 2.5rem; font-weight: 700; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .section { margin-bottom: 3rem; }
    .section-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; }
    .section-icon { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; }
    .section-icon.inbound { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .section-icon.outbound { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
    .section-title { font-size: 1.5rem; font-weight: 600; color: #2d3748; }
    .messages-grid { display: grid; gap: 1rem; }
    .message-card { background: white; border-radius: 16px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04); border: 1px solid #e2e8f0; transition: all 0.2s ease; cursor: pointer; }
    .message-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08); border-color: #667eea; }
    .message-header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem; }
    .message-from { flex: 1; }
    .message-name { font-weight: 600; color: #2d3748; font-size: 1rem; margin-bottom: 0.25rem; }
    .message-email { color: #718096; font-size: 0.875rem; }
    .message-time { color: #a0aec0; font-size: 0.875rem; white-space: nowrap; margin-left: 1rem; }
    .message-subject { font-size: 1.125rem; font-weight: 600; color: #2d3748; margin-bottom: 0.5rem; }
    .message-email-address { font-size: 0.75rem; color: #a0aec0; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; margin-bottom: 0.75rem; background: #f7fafc; padding: 0.25rem 0.5rem; border-radius: 6px; display: inline-block; }
    .message-preview { color: #718096; font-size: 0.875rem; line-height: 1.5; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .message-footer { display: flex; gap: 0.75rem; margin-top: 1rem; flex-wrap: wrap; }
    .badge.has-attachment { background: #fef5e7; color: #d68910; }
    .badge.ai-processed { background: #e8f4f8; color: #0e7490; }
    .badge.replied { background: #dcfce7; color: #15803d; }
    .badge.performance { background: #f0f9ff; color: #0369a1; }
    .badge.tokens { background: #faf5ff; color: #7c3aed; }
    @media (max-width: 768px) {
      .stats { grid-template-columns: 1fr; }
      .message-header { flex-direction: column; }
      .message-time { margin-left: 0; margin-top: 0.5rem; }
    }
  `;
  
  const scripts = `<script>
          document.querySelectorAll('.message-card').forEach(card => {
            card.addEventListener('click', function() {
        window.location.href = '/messages/' + this.dataset.messageId;
            });
          });
  </script>`;
  
  return renderLayout('Rally - Email Activity', '/', 'Your intelligent email assistant, working invisibly', content, styles, scripts);
}

function renderMessageCard(msg: Message, type: 'inbound' | 'outbound'): string {
  const time = msg.received_at || msg.sent_at || '';
  const displayTime = formatTime(time);
  const hasAttachment = msg.has_attachments === 1;
  const aiProcessed = !!msg.llm_summary;
  const hasReply = !!msg.llm_reply;
  const processingTimeDisplay = msg.processing_time_ms ? formatProcessingTime(msg.processing_time_ms) : null;
  const aiResponseTimeDisplay = msg.ai_response_time_ms ? formatProcessingTime(msg.ai_response_time_ms) : null;
  const tokenDisplay = (msg.tokens_input && msg.tokens_output) ? `${formatNumber(msg.tokens_input + msg.tokens_output)} tokens` : null;
  
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
      ${msg.email_address ? `<div class="message-email-address">To: ${escapeHtml(msg.email_address)}</div>` : ''}
      <div class="message-preview">${escapeHtml(msg.llm_summary || msg.llm_reply || 'No preview available')}</div>
      <div class="message-footer">
        ${hasAttachment ? '<span class="badge has-attachment">📎 Attachment</span>' : ''}
        ${aiProcessed ? '<span class="badge ai-processed">✨ AI Processed</span>' : ''}
        ${hasReply && type === 'inbound' ? '<span class="badge replied">✓ Replied</span>' : ''}
        ${processingTimeDisplay && type === 'inbound' ? `<span class="badge performance">⚡ Total: ${processingTimeDisplay}</span>` : ''}
        ${aiResponseTimeDisplay && type === 'inbound' ? `<span class="badge performance">🤖 AI: ${aiResponseTimeDisplay}</span>` : ''}
        ${tokenDisplay && type === 'inbound' ? `<span class="badge tokens">🔢 ${tokenDisplay}</span>` : ''}
      </div>
    </div>
  `;
}

function renderEmptyState(text: string, icon: string): string {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><div class="empty-text">${text}</div></div>`;
}

// Settings page
export function renderSettings(settings: { system_prompt: string; temperature?: number; max_tokens?: number } | null, postmarkStatus: PostmarkStatus) {
  const currentPrompt = settings?.system_prompt || 'You are Rally, an intelligent email assistant.';
  const currentMaxTokens = settings?.max_tokens || 500;
  
  const content = `
    <div class="card settings-card">
            <div class="settings-header">
              <h2 class="settings-title">AI Settings</h2>
              <p class="settings-subtitle">Control how Rally processes and responds to incoming emails</p>
            </div>
      <div id="successMessage" class="success-message">Settings saved successfully! Changes will apply to all new incoming emails.</div>
            <div class="info-box">
              <p><strong>Model:</strong> Using GPT-5 (OpenAI's most intelligent model, optimized for coding, instruction following, and reasoning)</p>
              <p style="margin-top: 0.5rem;"><strong>Configuration:</strong> Low reasoning effort + Low verbosity for fast, concise email responses</p>
            </div>
            <form id="settingsForm" method="POST" action="/settings">
              <div class="form-group">
                <label class="form-label" for="system_prompt">System Prompt</label>
          <span class="form-help">This tells Rally how to behave when processing emails. Be specific about tone, format, and what actions Rally should take.</span>
          <textarea class="form-textarea" id="system_prompt" name="system_prompt" required placeholder="e.g., You are Rally, a professional email assistant...">${escapeHtml(currentPrompt)}</textarea>
              </div>
              <div class="form-group">
                <label class="form-label" for="max_tokens">Max Response Tokens</label>
                <span class="form-help">Limits the length of the AI's reply. Lower values produce shorter responses. (Default: 500)</span>
                <input type="number" class="form-input" id="max_tokens" name="max_tokens" value="${currentMaxTokens}" min="50" max="4000" required>
              </div>
              <div class="button-group">
                <button type="submit" class="btn btn-primary">Save Settings</button>
          <a href="/" class="btn btn-secondary">Cancel</a>
              </div>
            </form>
          </div>

          <div class="card status-card">
            <div class="settings-header">
              <h2 class="settings-title">Postmark Inbound Status</h2>
              <p class="settings-subtitle">Verify that Postmark is successfully sending emails to your Rally worker.</p>
            </div>
            <div class="status-indicator status-${postmarkStatus.status}">
              <span class="status-icon">${postmarkStatus.status === 'ok' ? '✅' : postmarkStatus.status === 'warning' ? '⚠️' : '❌'}</span>
              <span class="status-text">${postmarkStatus.message}</span>
            </div>
            ${postmarkStatus.last_inbound_message_at ? `
              <p class="status-detail">Last inbound message received: <strong>${formatTime(postmarkStatus.last_inbound_message_at)}</strong></p>
            ` : ''}
            ${postmarkStatus.status !== 'ok' ? `
              <div class="info-box" style="margin-top: 1.5rem;">
                <p><strong>Troubleshooting Tips:</strong></p>
                <ul>
                  <li>Ensure your Postmark inbound webhook URL is correctly configured and pointing to <code>/postmark/inbound</code> on your worker.</li>
                  <li>Check your Cloudflare Worker logs (<code>npx wrangler tail</code>) for any errors.</li>
                  <li>Send a test email to your Postmark inbound address to trigger a new webhook.</li>
                </ul>
              </div>
            ` : ''}
          </div>
  `;
  
  const styles = `
    .container { max-width: 900px; }
    .settings-card, .status-card { padding: 2rem; margin-bottom: 2rem; }
    .settings-header { margin-bottom: 2rem; }
    .settings-title { font-size: 1.75rem; font-weight: 600; color: #2d3748; margin-bottom: 0.5rem; }
    .settings-subtitle { color: #718096; font-size: 0.95rem; }
    .form-help { display: block; color: #718096; font-size: 0.85rem; margin-bottom: 0.75rem; }
    .form-textarea { min-height: 200px; }
    .info-box { background: #e8f4f8; border-left: 4px solid #0e7490; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; }
    .info-box p { color: #0e7490; font-size: 0.9rem; margin: 0; }
    .button-group { display: flex; gap: 1rem; margin-top: 2rem; }
    .success-message { background: #dcfce7; color: #15803d; padding: 1rem; border-radius: 12px; margin-bottom: 2rem; display: none; }
    .success-message.show { display: block; }

    .status-indicator { display: flex; align-items: center; gap: 0.75rem; padding: 1rem 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; }
    .status-indicator.status-ok { background: #dcfce7; color: #15803d; }
    .status-indicator.status-warning { background: #fffbe6; color: #b45309; }
    .status-indicator.status-error { background: #fee2e2; color: #dc2626; }
    .status-icon { font-size: 1.5rem; }
    .status-text { font-size: 1.125rem; font-weight: 600; }
    .status-detail { color: #4a5568; font-size: 0.95rem; margin-top: 1rem; }
    .status-detail strong { font-weight: 700; }
    .info-box ul { list-style-type: disc; margin-left: 1.25rem; margin-top: 0.5rem; }
    .info-box li { margin-bottom: 0.5rem; }
  `;
  
  const scripts = `<script>
          document.getElementById('settingsForm').addEventListener('submit', async (e) => {
            e.preventDefault();
      const data = {
        system_prompt: new FormData(e.target).get('system_prompt'),
        max_tokens: parseInt(new FormData(e.target).get('max_tokens') as string),
      };
            try {
              const response = await fetch('/settings', {
                method: 'POST',
          headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
              });
              if (response.ok) {
                document.getElementById('successMessage').classList.add('show');
          setTimeout(() => document.getElementById('successMessage').classList.remove('show'), 5000);
              } else {
                alert('Error saving settings. Please try again.');
              }
            } catch (error) {
              alert('Error saving settings. Please try again.');
            }
          });
  </script>`;
  
  return renderLayout('Rally - Settings', '/settings', 'Configure how Rally understands and responds to emails', content, styles, scripts);
}

// Email Prompts page
export function renderEmailPrompts(emailPrompts: any[] = []) {
  const content = `
          <div class="page-header">
            <h2 class="page-title">Email-Specific Prompts</h2>
            <button class="btn btn-primary" onclick="openAddModal()">Add Email Prompt</button>
          </div>
    <div id="successMessage" class="success-message">Email prompt saved successfully!</div>
    <div id="errorMessage" class="error-message">Error saving email prompt. Please try again.</div>
          <div class="prompts-grid">
            ${emailPrompts.map(prompt => renderPromptCard(prompt)).join('')}
            <div class="add-prompt-card" onclick="openAddModal()">
              <div class="add-prompt-icon">+</div>
              <div class="add-prompt-text">Add New Email Prompt</div>
            </div>
          </div>
        <div id="promptModal" class="modal">
          <div class="modal-content">
            <div class="modal-header">
              <h3 class="modal-title" id="modalTitle">Add Email Prompt</h3>
              <button class="modal-close" onclick="closeModal()">&times;</button>
            </div>
            <form id="promptForm">
              <div class="form-group">
                <label class="form-label" for="email_address">Email Address</label>
            <input type="email" class="form-input" id="email_address" name="email_address" required placeholder="support@rallycollab.com" />
              </div>
              <div class="form-group">
                <label class="form-label" for="system_prompt">System Prompt</label>
            <textarea class="form-textarea" id="system_prompt" name="system_prompt" required placeholder="You are Rally, a customer support assistant..."></textarea>
              </div>
              <div class="button-group">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Prompt</button>
              </div>
            </form>
          </div>
        </div>
  `;
  
  const styles = `
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    .page-title { font-size: 2rem; font-weight: 600; color: #2d3748; }
    .prompts-grid { display: grid; gap: 1.5rem; margin-bottom: 2rem; }
    .prompt-card { background: white; border-radius: 16px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04); border: 1px solid #e2e8f0; transition: all 0.2s ease; }
    .prompt-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08); border-color: #667eea; }
    .prompt-header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem; }
    .prompt-email { font-size: 1.125rem; font-weight: 600; color: #2d3748; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; }
    .prompt-actions { display: flex; gap: 0.5rem; }
    .prompt-preview { color: #718096; font-size: 0.875rem; line-height: 1.5; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; margin-bottom: 1rem; }
    .prompt-meta { display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: #a0aec0; }
    .add-prompt-card { background: white; border-radius: 16px; padding: 2rem; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04); border: 2px dashed #e2e8f0; text-align: center; transition: all 0.2s ease; cursor: pointer; }
    .add-prompt-card:hover { border-color: #667eea; background: #f7fafc; }
    .add-prompt-icon { font-size: 2rem; margin-bottom: 1rem; color: #667eea; }
    .add-prompt-text { color: #4a5568; font-weight: 500; }
    .button-group { display: flex; gap: 1rem; justify-content: flex-end; }
    .success-message { background: #dcfce7; color: #15803d; padding: 1rem; border-radius: 12px; margin-bottom: 1rem; display: none; }
    .success-message.show { display: block; }
    .error-message { background: #fef2f2; color: #dc2626; padding: 1rem; border-radius: 12px; margin-bottom: 1rem; display: none; }
    .error-message.show { display: block; }
  `;
  
  const scripts = `<script>
          let currentPromptId = null;
          let prompts = ${JSON.stringify(emailPrompts)};
          
          function openAddModal() {
            currentPromptId = null;
            document.getElementById('modalTitle').textContent = 'Add Email Prompt';
            document.getElementById('email_address').value = '';
            document.getElementById('system_prompt').value = '';
            document.getElementById('promptModal').classList.add('show');
          }
          
          function openEditModal(promptId) {
            const prompt = prompts.find(p => p.id === promptId);
            if (!prompt) return;
            currentPromptId = promptId;
            document.getElementById('modalTitle').textContent = 'Edit Email Prompt';
            document.getElementById('email_address').value = prompt.email_address;
            document.getElementById('system_prompt').value = prompt.system_prompt;
            document.getElementById('promptModal').classList.add('show');
          }
          
          function closeModal() {
            document.getElementById('promptModal').classList.remove('show');
            currentPromptId = null;
          }
          
          function deletePrompt(promptId) {
            if (!confirm('Are you sure you want to delete this email prompt?')) return;
      fetch(\`/email-prompts/\${promptId}\`, { method: 'DELETE' })
            .then(response => response.json())
        .then(data => data.success ? location.reload() : showError('Error deleting prompt'))
        .catch(() => showError('Error deleting prompt'));
          }
          
          function showSuccess(message) {
            const el = document.getElementById('successMessage');
            el.textContent = message;
            el.classList.add('show');
            setTimeout(() => el.classList.remove('show'), 3000);
          }
          
          function showError(message) {
            const el = document.getElementById('errorMessage');
            el.textContent = message;
            el.classList.add('show');
            setTimeout(() => el.classList.remove('show'), 3000);
          }
          
          document.getElementById('promptForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = {
              email_address: formData.get('email_address'),
              system_prompt: formData.get('system_prompt')
            };
            try {
              const url = currentPromptId ? \`/email-prompts/\${currentPromptId}\` : '/email-prompts';
              const method = currentPromptId ? 'PUT' : 'POST';
              const response = await fetch(url, {
                method: method,
          headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
              });
              const result = await response.json();
              if (response.ok && result.success) {
                showSuccess('Email prompt saved successfully!');
                closeModal();
                setTimeout(() => location.reload(), 1000);
              } else {
                showError(result.error || 'Error saving prompt');
              }
            } catch (error) {
              showError('Error saving prompt');
            }
          });
          
          document.getElementById('promptModal').addEventListener('click', (e) => {
      if (e.target.id === 'promptModal') closeModal();
    });
  </script>`;
  
  return renderLayout('Rally - Email Prompts', '/email-prompts', 'Configure AI prompts for specific email addresses', content, styles, scripts);
}

function renderPromptCard(prompt: any): string {
  const preview = prompt.system_prompt.length > 150 ? prompt.system_prompt.substring(0, 150) + '...' : prompt.system_prompt;
  const createdDate = new Date(prompt.created_at).toLocaleDateString();
  const updatedDate = prompt.updated_at && prompt.updated_at !== prompt.created_at ? new Date(prompt.updated_at).toLocaleDateString() : null;
  
  return `
    <div class="prompt-card">
      <div class="prompt-header">
        <div class="prompt-email">${escapeHtml(prompt.email_address)}</div>
        <div class="prompt-actions">
          <button class="btn btn-secondary" onclick="openEditModal(${prompt.id})">Edit</button>
          <button class="btn btn-danger" onclick="deletePrompt(${prompt.id})">Delete</button>
        </div>
      </div>
      <div class="prompt-preview">${escapeHtml(preview)}</div>
      <div class="prompt-meta">
        <span>Created: ${createdDate}</span>
        ${updatedDate ? `<span>Updated: ${updatedDate}</span>` : ''}
      </div>
    </div>
  `;
}

// Users page
export function renderUsersPage(users: any[]): string {
  const totalUsers = users.length;
  const activeUsers = users.filter(u => !u.opt_out).length;
  const optedOutUsers = users.filter(u => u.opt_out).length;
  
  const content = `
    <div class="stats">
      <div class="stat-card"><div class="stat-label">Total Users</div><div class="stat-value">${totalUsers}</div></div>
      <div class="stat-card"><div class="stat-label">Active Users</div><div class="stat-value">${activeUsers}</div></div>
      <div class="stat-card"><div class="stat-label">Opted Out</div><div class="stat-value">${optedOutUsers}</div></div>
    </div>
    <div class="card">
      <h2 class="section-title">All Users</h2>
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>First Seen</th>
            <th>Last Seen</th>
            <th>Messages</th>
            <th>Consent</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(user => `
            <tr>
              <td><a href="/users/${encodeURIComponent(user.email)}" class="email-link">${user.email}</a></td>
              <td>${user.name || '<em>Unknown</em>'}</td>
              <td>${new Date(user.first_seen_at).toLocaleDateString()}</td>
              <td>${new Date(user.last_seen_at).toLocaleDateString()}</td>
              <td>↑ ${user.total_messages_sent} / ↓ ${user.total_messages_received}</td>
              <td>
                ${user.consent_email ? '<span class="compliance-icon compliance-yes" title="Email consent"></span>' : '<span class="compliance-icon compliance-no" title="No email consent"></span>'}
                ${user.consent_data_processing ? '<span class="compliance-icon compliance-yes" title="Data processing consent"></span>' : '<span class="compliance-icon compliance-no" title="No data processing consent"></span>'}
              </td>
              <td>${user.opt_out ? '<span class="badge badge-opted-out">Opted Out</span>' : '<span class="badge badge-active">Active</span>'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  
  const styles = `
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
    .stat-card { background: white; padding: 1.5rem; border-radius: 16px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04); border: 1px solid rgba(102, 126, 234, 0.1); }
    .stat-label { color: #718096; font-size: 0.875rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
    .stat-value { font-size: 2.5rem; font-weight: 700; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .section-title { font-size: 1.5rem; font-weight: 600; color: #2d3748; margin-bottom: 1.5rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th { text-align: left; padding: 12px; background: #f8f9fa; color: #666; font-weight: 600; font-size: 14px; border-bottom: 2px solid #e9ecef; }
    td { padding: 12px; border-bottom: 1px solid #e9ecef; font-size: 14px; }
    tr:hover { background: #f8f9fa; }
    .badge.badge-active { background: #d4edda; color: #155724; }
    .badge.badge-opted-out { background: #f8d7da; color: #721c24; }
    .email-link { color: #667eea; text-decoration: none; font-weight: 500; }
    .email-link:hover { text-decoration: underline; }
    .compliance-icon { display: inline-block; width: 16px; height: 16px; border-radius: 50%; margin-left: 4px; }
    .compliance-yes { background: #28a745; }
    .compliance-no { background: #dc3545; }
  `;
  
  return renderLayout('Rally - Users & Compliance', '/users', 'Track all email contacts with GDPR-compliant data collection', content, styles);
}

// Requests page
export function renderRequestsPage(requests: any[]) {
  const activeRequests = requests.filter((r: any) => r.status === 'active');
  const closedRequests = requests.filter((r: any) => r.status !== 'active');
  
  const content = `
          <div class="stats">
      <div class="stat-card"><div class="stat-label">Total Requests</div><div class="stat-value">${requests.length}</div></div>
      <div class="stat-card"><div class="stat-label">Active Requests</div><div class="stat-value">${activeRequests.length}</div></div>
      <div class="stat-card"><div class="stat-label">Closed Requests</div><div class="stat-value">${closedRequests.length}</div></div>
            </div>
          ${activeRequests.length > 0 ? `
            <div class="section">
        <div class="section-header"><h2 class="section-title">🔄 Active Requests</h2></div>
        <div class="requests-grid">${activeRequests.map((req: any) => renderRequestCard(req)).join('')}</div>
            </div>
          ` : ''}
          ${closedRequests.length > 0 ? `
            <div class="section">
        <div class="section-header"><h2 class="section-title">✅ Closed Requests</h2></div>
        <div class="requests-grid">${closedRequests.map((req: any) => renderRequestCard(req)).join('')}</div>
            </div>
          ` : ''}
    ${requests.length === 0 ? '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">No requests yet. Send an email to Rally with "please respond by..." to start tracking</div></div>' : ''}
  `;
  
  const styles = `
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; margin-bottom: 3rem; }
    .stat-card { background: white; padding: 1.5rem; border-radius: 16px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04); border: 1px solid rgba(102, 126, 234, 0.1); }
    .stat-label { color: #718096; font-size: 0.875rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
    .stat-value { font-size: 2.5rem; font-weight: 700; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .section { margin-bottom: 3rem; }
    .section-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; }
    .section-title { font-size: 1.5rem; font-weight: 600; color: #2d3748; }
    .requests-grid { display: grid; gap: 1rem; }
    .request-card { background: white; border-radius: 16px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04); border: 1px solid #e2e8f0; transition: all 0.2s ease; cursor: pointer; }
    .request-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08); border-color: #667eea; }
    .request-header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem; }
    .request-title { font-size: 1.125rem; font-weight: 600; color: #2d3748; margin-bottom: 0.5rem; }
    .request-meta { color: #718096; font-size: 0.875rem; }
    .request-footer { display: flex; gap: 0.75rem; margin-top: 1rem; flex-wrap: wrap; align-items: center; }
    .progress-bar { flex: 1; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; min-width: 150px; }
    .progress-fill { height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); transition: width 0.3s ease; }
    .progress-text { font-size: 0.875rem; font-weight: 600; color: #4a5568; }
    .status-badge { display: inline-flex; align-items: center; padding: 0.375rem 0.75rem; border-radius: 8px; font-size: 0.75rem; font-weight: 500; }
    .status-badge.active { background: #dcfce7; color: #15803d; }
    .status-badge.closed { background: #e2e8f0; color: #4a5568; }
  `;
  
  const scripts = `<script>
          document.querySelectorAll('.request-card').forEach(card => {
            card.addEventListener('click', function() {
        window.location.href = '/requests/' + this.dataset.requestId;
            });
          });
  </script>`;
  
  return renderLayout('Rally - Requests', '/requests', 'Track data collection requests and responses', content, styles, scripts);
}

function renderRequestCard(req: any): string {
  const responseCount = req.response_count || 0;
  const expectedCount = req.expected_count || 0;
  const progress = expectedCount > 0 ? (responseCount / expectedCount) * 100 : 0;
  const createdDate = formatTime(req.created_at);
  
  return `
    <div class="request-card" data-request-id="${req.id}">
      <div class="request-header">
        <div>
          <div class="request-title">${escapeHtml(req.title || 'Untitled Request')}</div>
          <div class="request-meta">Created ${createdDate} by ${escapeHtml(req.created_by_email || 'Unknown')}</div>
        </div>
        <span class="status-badge ${req.status}">${req.status?.toUpperCase() || 'ACTIVE'}</span>
      </div>
      ${req.description ? `<div class="request-meta">${escapeHtml(req.description)}</div>` : ''}
      <div class="request-footer">
        <div class="progress-bar"><div class="progress-fill" style="width: ${progress}%"></div></div>
        <span class="progress-text">${responseCount}/${expectedCount} responses</span>
      </div>
    </div>
  `;
}

// Request Detail page
export function renderRequestDetail(request: any, responses: any[]) {
  const expectedParticipants = JSON.parse(request.expected_participants || '[]');
  const respondedEmails = responses.map((r: any) => r.responder_email);
  const missingParticipants = expectedParticipants.filter((email: string) => !respondedEmails.includes(email));
  const progress = expectedParticipants.length > 0 ? (responses.length / expectedParticipants.length) * 100 : 0;
  
  const content = `
          <a href="/requests" class="back-button">← Back to Requests</a>
    <div class="card header-card">
            <h1 class="request-title">${escapeHtml(request.title || 'Untitled Request')}</h1>
            <div class="request-meta">Created ${formatTime(request.created_at)} by ${escapeHtml(request.created_by_email || 'Unknown')}</div>
            ${request.deadline ? `<div class="request-meta">Deadline: ${new Date(request.deadline).toLocaleString()}</div>` : ''}
            <div class="progress-section">
              <div class="progress-header">
                <span class="progress-label">Response Progress</span>
                <span class="progress-count">${responses.length}/${expectedParticipants.length}</span>
              </div>
        <div class="progress-bar"><div class="progress-fill" style="width: ${progress}%"></div></div>
              </div>
            </div>
          ${responses.length > 0 ? `
            <div class="section">
              <h2 class="section-title">✅ Responses Received (${responses.length})</h2>
              ${responses.map((resp: any) => renderResponseCard(resp)).join('')}
            </div>
          ` : ''}
          ${missingParticipants.length > 0 ? `
            <div class="section">
              <h2 class="section-title">⏳ Waiting On (${missingParticipants.length})</h2>
              <div class="missing-list">
          <ul>${missingParticipants.map((email: string) => `<li>• ${escapeHtml(email)}</li>`).join('')}</ul>
              </div>
            </div>
          ` : ''}
    ${responses.length === 0 && expectedParticipants.length === 0 ? '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">No responses yet</div></div>' : ''}
  `;
  
  const styles = `
    .back-button { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.5rem; background: white; border: 2px solid #e2e8f0; border-radius: 12px; color: #4a5568; text-decoration: none; font-weight: 500; transition: all 0.2s ease; margin-bottom: 2rem; }
    .back-button:hover { background: #667eea; color: white; border-color: #667eea; }
    .header-card { padding: 2rem; margin-bottom: 2rem; }
    .request-title { font-size: 2rem; font-weight: 700; color: #2d3748; margin-bottom: 1rem; }
    .request-meta { color: #718096; font-size: 0.95rem; margin-bottom: 0.5rem; }
    .progress-section { margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid #e2e8f0; }
    .progress-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
    .progress-label { font-weight: 600; color: #2d3748; }
    .progress-count { font-size: 1.25rem; font-weight: 700; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .progress-bar { height: 12px; background: #e2e8f0; border-radius: 6px; overflow: hidden; }
    .progress-fill { height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); transition: width 0.3s ease; }
    .section { margin-bottom: 2rem; }
    .section-title { font-size: 1.25rem; font-weight: 600; color: #2d3748; margin-bottom: 1rem; }
    .response-card { background: white; border-radius: 12px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04); border: 1px solid #e2e8f0; margin-bottom: 1rem; }
    .response-header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem; }
    .responder-name { font-weight: 600; color: #2d3748; font-size: 1rem; }
    .responder-email { color: #718096; font-size: 0.875rem; }
    .response-time { color: #a0aec0; font-size: 0.875rem; }
    .response-data { background: #f7fafc; border-radius: 8px; padding: 1rem; margin-top: 1rem; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; font-size: 0.875rem; color: #2d3748; }
    .missing-list { background: #fef5e7; border-radius: 12px; padding: 1.5rem; border: 1px solid #f9e79f; }
    .missing-list ul { list-style: none; padding: 0; }
    .missing-list li { padding: 0.5rem 0; color: #856404; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; font-size: 0.875rem; }
  `;
  
  return renderLayout(`Rally - ${escapeHtml(request.title)}`, '/requests', '', content, styles);
}

function renderResponseCard(resp: any): string {
  const extractedData = resp.extracted_data ? JSON.parse(resp.extracted_data) : null;
  
  return `
    <div class="response-card">
      <div class="response-header">
        <div>
          <div class="responder-name">${escapeHtml(resp.responder_name || 'Unknown')}</div>
          <div class="responder-email">${escapeHtml(resp.responder_email || '')}</div>
        </div>
        <div class="response-time">${formatTime(resp.responded_at)}</div>
      </div>
      ${resp.raw_text ? `<div>${escapeHtml(resp.raw_text.substring(0, 200))}${resp.raw_text.length > 200 ? '...' : ''}</div>` : ''}
      ${extractedData ? `
        <div class="response-data">
          <strong>Extracted Data:</strong><br>
          ${Object.entries(extractedData).map(([key, value]) => `${key}: ${value}`).join('<br>')}
        </div>
      ` : ''}
    </div>
  `;
}

// Utility functions
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
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatProcessingTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatNumber(num: number): string {
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
}

// Legacy function for backwards compatibility
export function renderHtml(content: string) {
  return renderDashboard([]);
}
