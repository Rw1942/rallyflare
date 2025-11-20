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
  tokens_input?: number;
  tokens_output?: number;
  cost_dollars?: number;
  email_address?: string;
}

export interface PostmarkStatus {
  status: 'ok' | 'warning' | 'error';
  message?: string;
  last_inbound_message_at?: string;
}

// Mobile-first CSS with clean, minimal design
const SHARED_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f8fafc;
    color: #1e293b;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  .app {
    max-width: 100%;
    min-height: 100vh;
  }

  .header {
    background: white;
    border-bottom: 1px solid #e2e8f0;
    padding: 1rem;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .header-content {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .logo {
    font-size: 1.25rem;
    font-weight: 600;
    color: #0f172a;
  }

  .nav {
    display: flex;
    gap: 0.5rem;
  }

  .nav-button {
    padding: 0.5rem 1rem;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    color: #475569;
    text-decoration: none;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.15s ease;
  }

  .nav-button:hover {
    background: #e2e8f0;
    color: #334155;
  }

  .nav-button.active {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
  }

  .main {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1rem;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    background: white;
    padding: 1rem;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    text-align: center;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #3b82f6;
    margin-bottom: 0.25rem;
  }

  .stat-label {
    font-size: 0.75rem;
    color: #64748b;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .section {
    margin-bottom: 2rem;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .section-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
  }

  .section-icon.inbound { background: #dbeafe; }
  .section-icon.outbound { background: #dcfce7; }

  .section-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1e293b;
  }

  .message-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .message-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 1rem;
    transition: all 0.15s ease;
    cursor: pointer;
  }

  .message-card:hover {
    border-color: #3b82f6;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
  }

  .message-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.5rem;
  }

  .message-sender {
    flex: 1;
    min-width: 0;
  }

  .message-name {
    font-weight: 600;
    color: #1e293b;
    font-size: 0.875rem;
    margin-bottom: 0.125rem;
  }

  .message-email {
    color: #64748b;
    font-size: 0.75rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .message-time {
    color: #94a3b8;
    font-size: 0.75rem;
    flex-shrink: 0;
    margin-left: 1rem;
  }

  .message-subject {
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 0.5rem;
    line-height: 1.4;
  }

  .message-preview {
    color: #64748b;
    font-size: 0.875rem;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .message-badges {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
    flex-wrap: wrap;
  }

  .badge {
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .badge.attachment { background: #fef3c7; color: #92400e; }
  .badge.ai { background: #dbeafe; color: #1e40af; }
  .badge.replied { background: #dcfce7; color: #166534; }
  .badge.metrics { background: #f1f5f9; color: #475569; }

  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: #64748b;
  }

  .empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .empty-text {
    font-size: 1rem;
    margin-bottom: 0.5rem;
  }

  .empty-subtext {
    font-size: 0.875rem;
    color: #94a3b8;
  }

  /* Mobile-first responsive design */
  @media (max-width: 640px) {
    .header-content {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }

    .nav {
      justify-content: center;
    }

    .stats {
      grid-template-columns: repeat(2, 1fr);
    }

    .message-header {
      flex-direction: column;
      gap: 0.5rem;
    }

    .message-time {
      margin-left: 0;
      align-self: flex-start;
    }
  }

  @media (max-width: 480px) {
    .main {
      padding: 0.75rem;
    }

    .stats {
      grid-template-columns: 1fr;
    }

    .message-card {
      padding: 0.875rem;
    }
  }
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
  
  .form-group { margin-bottom: 1rem; }
  .form-label { display: block; font-weight: 600; color: #2d3748; margin-bottom: 0.5rem; font-size: 0.95rem; }

  .form-input, .form-textarea {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    font-family: inherit;
    font-size: 0.95rem;
    transition: border-color 0.2s ease;
  }

  .form-textarea { padding: 0.75rem; line-height: 1.5; resize: vertical; min-height: 120px; }
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
  const navItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/settings', label: 'Settings' }
  ];

  return `
    <header class="header">
      <div class="header-content">
        <div class="logo">Rally</div>
        <nav class="nav">
          ${navItems.map(item =>
            `<a href="${item.path}" class="nav-button ${activePage === item.path ? 'active' : ''}">${item.label}</a>`
          ).join('')}
        </nav>
      </div>
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
    <div class="app">
      ${renderHeader(activePage, tagline)}
      <main class="main">
        ${content}
      </main>
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
      <div class="stat-card">
        <div class="stat-value">${messages.length}</div>
        <div class="stat-label">Total</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${inbound.length}</div>
        <div class="stat-label">Received</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${outbound.length}</div>
        <div class="stat-label">Sent</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${messages.filter(m => m.llm_summary).length}</div>
        <div class="stat-label">AI Processed</div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <div class="section-icon inbound">📨</div>
        <h2 class="section-title">Recent Messages</h2>
      </div>
      <div class="message-list">
        ${messages.length > 0
          ? messages.slice(0, 20).map(msg => renderMessageCard(msg)).join('')
          : renderEmptyState('No messages yet', '📭', 'Messages will appear here as they\'re processed')
        }
      </div>
    </div>
  `;

  const scripts = `
    <script>
      document.querySelectorAll('.message-card').forEach(card => {
        card.addEventListener('click', function() {
          window.location.href = '/messages/' + this.dataset.messageId;
        });
      });
    </script>
  `;

  return renderLayout('Rally - Dashboard', '/', 'Email automation made simple', content, '', scripts);
}

function renderMessageCard(msg: Message): string {
  const time = msg.received_at || msg.sent_at || '';
  const displayTime = formatTime(time);
  const isInbound = msg.direction !== 'outbound';
  const hasAttachment = msg.has_attachments === 1;
  const aiProcessed = !!msg.llm_summary;
  const hasReply = !!msg.llm_reply;

  // Simple badges - only the most important ones
  const badges = [];
  if (hasAttachment) badges.push('<span class="badge attachment">📎</span>');
  if (aiProcessed) badges.push('<span class="badge ai">🤖</span>');
  if (hasReply && isInbound) badges.push('<span class="badge replied">✅</span>');

  // Show processing time for recent inbound messages
  if (isInbound && msg.processing_time_ms && msg.processing_time_ms < 10000) {
    badges.push(`<span class="badge metrics">${formatProcessingTime(msg.processing_time_ms)}</span>`);
  }

  const preview = isInbound
    ? (msg.llm_summary || msg.subject || '').substring(0, 120)
    : (msg.llm_reply || msg.subject || '').substring(0, 120);

  return `
    <div class="message-card" data-message-id="${msg.id}">
      <div class="message-header">
        <div class="message-sender">
          <div class="message-name">${escapeHtml(msg.from_name || 'Unknown')}</div>
          <div class="message-email">${escapeHtml(msg.from_email || '')}</div>
        </div>
        <div class="message-time">${displayTime}</div>
      </div>
      <div class="message-subject">${escapeHtml(msg.subject || '(no subject)')}</div>
      <div class="message-preview">${escapeHtml(preview || 'Processing...')}</div>
      ${badges.length > 0 ? `<div class="message-badges">${badges.join('')}</div>` : ''}
    </div>
  `;
}

function renderEmptyState(title: string, icon: string, subtitle?: string): string {
  return `
    <div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <div class="empty-text">${title}</div>
      ${subtitle ? `<div class="empty-subtext">${subtitle}</div>` : ''}
    </div>
  `;
}

// Settings page - Simplified for mobile-first design
export function renderSettings(settings: {
  system_prompt: string;
  model: string;
  reasoning_effort: "minimal" | "low" | "medium" | "high";
  text_verbosity: "low" | "medium" | "high";
  max_output_tokens: number;
  cost_input_per_1m?: number;
  cost_output_per_1m?: number;
} | null, postmarkStatus: PostmarkStatus) {
  const currentPrompt = settings?.system_prompt || 'You are Rally, an intelligent email assistant.';
  const currentModel = settings?.model || 'gpt-5.1';

  const content = `
    <div class="section">
      <div class="section-header">
        <div class="section-icon outbound">⚙️</div>
        <h2 class="section-title">AI Settings</h2>
      </div>

      <div class="card">
        <div id="successMessage" style="display: none; background: #dcfce7; color: #166534; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
          Settings saved successfully!
        </div>

        <form id="settingsForm">
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; font-weight: 600; margin-bottom: 0.5rem;">System Prompt</label>
            <textarea
              name="system_prompt"
              rows="4"
              style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-family: inherit;"
              placeholder="Tell Rally how to behave when processing emails..."
            >${escapeHtml(currentPrompt)}</textarea>
          </div>

          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; font-weight: 600; margin-bottom: 0.5rem;">AI Model</label>
            <select name="model" style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px;">
              <option value="gpt-5.1" ${currentModel === 'gpt-5.1' ? 'selected' : ''}>GPT-5.1 (Advanced)</option>
              <option value="gpt-5-mini" ${currentModel === 'gpt-5-mini' ? 'selected' : ''}>GPT-5 Mini (Fast & Cheap)</option>
            </select>
          </div>

          <div style="display: flex; gap: 1rem;">
            <button type="submit" style="flex: 1; background: #3b82f6; color: white; border: none; padding: 0.75rem; border-radius: 6px; font-weight: 500;">
              Save Settings
            </button>
            <a href="/" style="flex: 1; background: #f3f4f6; color: #374151; border: none; padding: 0.75rem; border-radius: 6px; text-decoration: none; text-align: center; font-weight: 500;">
              Cancel
            </a>
          </div>
        </form>
      </div>
    </div>
  `;

  const scripts = `
    <script>
      document.getElementById('settingsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
          system_prompt: formData.get('system_prompt'),
          model: formData.get('model'),
          reasoning_effort: 'low',
          text_verbosity: 'medium',
          max_output_tokens: 4000,
          cost_input_per_1m: 2.50,
          cost_output_per_1m: 10.00,
        };

        try {
          const response = await fetch('/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });

          if (response.ok) {
            document.getElementById('successMessage').style.display = 'block';
            setTimeout(() => window.location.href = '/', 1500);
          } else {
            alert('Error saving settings. Please try again.');
          }
        } catch (error) {
          alert('Error saving settings. Please try again.');
        }
      });
    </script>
  `;

  return renderLayout('Rally - Settings', '/settings', 'Configure how Rally understands and responds to emails', content, '', scripts);
}

// Utility functions
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  const date = new Date(timeStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatProcessingTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
