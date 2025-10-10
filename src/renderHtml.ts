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
            margin-bottom: 0.5rem;
          }
          
          .message-email-address {
            font-size: 0.75rem;
            color: #a0aec0;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            margin-bottom: 0.75rem;
            background: #f7fafc;
            padding: 0.25rem 0.5rem;
            border-radius: 6px;
            display: inline-block;
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
          
          .badge.performance {
            background: #f0f9ff;
            color: #0369a1;
          }
          
          .badge.tokens {
            background: #faf5ff;
            color: #7c3aed;
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
              <a href="/settings" class="nav-button">Settings</a>
              <a href="/email-prompts" class="nav-button">Email Prompts</a>
              <a href="/users" class="nav-button">Users</a>
              <a href="/requests" class="nav-button">Requests</a>
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
  
  // Format performance metrics
  const processingTimeDisplay = msg.processing_time_ms 
    ? formatProcessingTime(msg.processing_time_ms) 
    : null;
  
  const aiResponseTimeDisplay = msg.ai_response_time_ms
    ? formatProcessingTime(msg.ai_response_time_ms)
    : null;
  
  const tokenDisplay = (msg.tokens_input && msg.tokens_output)
    ? `${formatNumber(msg.tokens_input + msg.tokens_output)} tokens`
    : null;
  
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

function formatProcessingTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}

function formatNumber(num: number): string {
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`;
  }
  return num.toString();
}

// Settings page for editing system prompt and email-specific prompts
export function renderSettings(settings: { system_prompt: string; temperature?: number } | null) {
  const currentPrompt = settings?.system_prompt || 'You are Rally, an intelligent email assistant.';
  
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Rally - Settings</title>
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
            max-width: 900px;
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
          
          .settings-card {
            background: white;
            border-radius: 16px;
            padding: 2rem;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
            border: 1px solid #e2e8f0;
          }
          
          .settings-header {
            margin-bottom: 2rem;
          }
          
          .settings-title {
            font-size: 1.75rem;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 0.5rem;
          }
          
          .settings-subtitle {
            color: #718096;
            font-size: 0.95rem;
          }
          
          .form-group {
            margin-bottom: 2rem;
          }
          
          .form-label {
            display: block;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 0.5rem;
            font-size: 0.95rem;
          }
          
          .form-help {
            display: block;
            color: #718096;
            font-size: 0.85rem;
            margin-bottom: 0.75rem;
          }
          
          .form-textarea {
            width: 100%;
            padding: 1rem;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            font-family: inherit;
            font-size: 0.95rem;
            line-height: 1.6;
            resize: vertical;
            min-height: 200px;
            transition: border-color 0.2s ease;
          }
          
          .form-textarea:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          }
          
          .form-input {
            width: 100%;
            max-width: 200px;
            padding: 0.75rem 1rem;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            font-family: inherit;
            font-size: 0.95rem;
            transition: border-color 0.2s ease;
          }
          
          .form-input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          }
          
          .info-box {
            background: #e8f4f8;
            border-left: 4px solid #0e7490;
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 2rem;
          }
          
          .info-box p {
            color: #0e7490;
            font-size: 0.9rem;
            margin: 0;
          }
          
          .button-group {
            display: flex;
            gap: 1rem;
            margin-top: 2rem;
          }
          
          .btn {
            padding: 0.875rem 2rem;
            border: none;
            border-radius: 12px;
            font-weight: 600;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          
          .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          
          .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
          }
          
          .btn-secondary {
            background: white;
            color: #4a5568;
            border: 2px solid #e2e8f0;
          }
          
          .btn-secondary:hover {
            background: #f7fafc;
            border-color: #cbd5e0;
          }
          
          .success-message {
            background: #dcfce7;
            color: #15803d;
            padding: 1rem;
            border-radius: 12px;
            margin-bottom: 2rem;
            display: none;
          }
          
          .success-message.show {
            display: block;
          }
          
          @media (max-width: 768px) {
            body {
              padding: 1rem;
            }
            
            .settings-card {
              padding: 1.5rem;
            }
            
            .button-group {
              flex-direction: column;
            }
            
            .btn {
              width: 100%;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <header>
            <h1 class="logo">Rally</h1>
            <p class="tagline">Configure how Rally understands and responds to emails</p>
            <nav class="nav">
              <a href="/" class="nav-button">Activity</a>
              <a href="/settings" class="nav-button" style="background: #667eea; color: white; border-color: #667eea;">Settings</a>
              <a href="/email-prompts" class="nav-button">Email Prompts</a>
              <a href="/users" class="nav-button">Users</a>
              <a href="/requests" class="nav-button">Requests</a>
            </nav>
          </header>
          
          <div class="settings-card">
            <div class="settings-header">
              <h2 class="settings-title">AI Settings</h2>
              <p class="settings-subtitle">Control how Rally processes and responds to incoming emails</p>
            </div>
            
            <div id="successMessage" class="success-message">
              Settings saved successfully! Changes will apply to all new incoming emails.
            </div>
            
            <div class="info-box">
              <p><strong>Model:</strong> Using GPT-5 (OpenAI's most intelligent model, optimized for coding, instruction following, and reasoning)</p>
              <p style="margin-top: 0.5rem;"><strong>Configuration:</strong> Low reasoning effort + Low verbosity for fast, concise email responses</p>
            </div>
            
            <form id="settingsForm" method="POST" action="/settings">
              <div class="form-group">
                <label class="form-label" for="system_prompt">System Prompt</label>
                <span class="form-help">
                  This tells Rally how to behave when processing emails. Be specific about tone, format, and what actions Rally should take.
                  GPT-5 will use this as context for understanding and responding to every incoming email.
                </span>
                <textarea 
                  class="form-textarea" 
                  id="system_prompt" 
                  name="system_prompt" 
                  required
                  placeholder="e.g., You are Rally, a professional email assistant. Provide concise summaries and helpful responses..."
                >${escapeHtml(currentPrompt)}</textarea>
              </div>
              
              <div class="button-group">
                <button type="submit" class="btn btn-primary">Save Settings</button>
                <a href="/" class="btn btn-secondary" style="text-decoration: none; display: inline-block; text-align: center;">Cancel</a>
              </div>
            </form>
          </div>
        </div>
        
        <script>
          // Handle form submission with fetch to show success message
          document.getElementById('settingsForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const data = {
              system_prompt: formData.get('system_prompt')
            };
            
            try {
              const response = await fetch('/settings', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
              });
              
              if (response.ok) {
                document.getElementById('successMessage').classList.add('show');
                setTimeout(() => {
                  document.getElementById('successMessage').classList.remove('show');
                }, 5000);
              } else {
                alert('Error saving settings. Please try again.');
              }
            } catch (error) {
              alert('Error saving settings. Please try again.');
            }
          });
        </script>
      </body>
    </html>
  `;
}

// Email prompts management page
export function renderEmailPrompts(emailPrompts: any[] = []) {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Rally - Email Prompts</title>
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
            max-width: 1200px;
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
          
          .nav-button.active {
            background: #667eea;
            color: white;
            border-color: #667eea;
          }
          
          .page-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2rem;
          }
          
          .page-title {
            font-size: 2rem;
            font-weight: 600;
            color: #2d3748;
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
          
          .btn-danger {
            background: #e53e3e;
            color: white;
            padding: 0.5rem 1rem;
            font-size: 0.875rem;
          }
          
          .btn-danger:hover {
            background: #c53030;
            transform: translateY(-1px);
          }
          
          .btn-secondary {
            background: #4a5568;
            color: white;
            padding: 0.5rem 1rem;
            font-size: 0.875rem;
          }
          
          .btn-secondary:hover {
            background: #2d3748;
            transform: translateY(-1px);
          }
          
          .prompts-grid {
            display: grid;
            gap: 1.5rem;
            margin-bottom: 2rem;
          }
          
          .prompt-card {
            background: white;
            border-radius: 16px;
            padding: 1.5rem;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
            border: 1px solid #e2e8f0;
            transition: all 0.2s ease;
          }
          
          .prompt-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
            border-color: #667eea;
          }
          
          .prompt-header {
            display: flex;
            justify-content: space-between;
            align-items: start;
            margin-bottom: 1rem;
          }
          
          .prompt-email {
            font-size: 1.125rem;
            font-weight: 600;
            color: #2d3748;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          }
          
          .prompt-actions {
            display: flex;
            gap: 0.5rem;
          }
          
          .prompt-preview {
            color: #718096;
            font-size: 0.875rem;
            line-height: 1.5;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            margin-bottom: 1rem;
          }
          
          .prompt-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.75rem;
            color: #a0aec0;
          }
          
          .add-prompt-card {
            background: white;
            border-radius: 16px;
            padding: 2rem;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
            border: 2px dashed #e2e8f0;
            text-align: center;
            transition: all 0.2s ease;
            cursor: pointer;
          }
          
          .add-prompt-card:hover {
            border-color: #667eea;
            background: #f7fafc;
          }
          
          .add-prompt-icon {
            font-size: 2rem;
            margin-bottom: 1rem;
            color: #667eea;
          }
          
          .add-prompt-text {
            color: #4a5568;
            font-weight: 500;
          }
          
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
          
          .modal.show {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
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
          
          .modal-title {
            font-size: 1.5rem;
            font-weight: 600;
            color: #2d3748;
          }
          
          .modal-close {
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: #a0aec0;
          }
          
          .modal-close:hover {
            color: #4a5568;
          }
          
          .form-group {
            margin-bottom: 1.5rem;
          }
          
          .form-label {
            display: block;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 0.5rem;
            font-size: 0.95rem;
          }
          
          .form-input {
            width: 100%;
            padding: 0.75rem 1rem;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            font-family: inherit;
            font-size: 0.95rem;
            transition: border-color 0.2s ease;
          }
          
          .form-input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          }
          
          .form-textarea {
            width: 100%;
            padding: 1rem;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            font-family: inherit;
            font-size: 0.95rem;
            line-height: 1.6;
            resize: vertical;
            min-height: 150px;
            transition: border-color 0.2s ease;
          }
          
          .form-textarea:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          }
          
          .button-group {
            display: flex;
            gap: 1rem;
            justify-content: flex-end;
          }
          
          .success-message {
            background: #dcfce7;
            color: #15803d;
            padding: 1rem;
            border-radius: 12px;
            margin-bottom: 1rem;
            display: none;
          }
          
          .success-message.show {
            display: block;
          }
          
          .error-message {
            background: #fef2f2;
            color: #dc2626;
            padding: 1rem;
            border-radius: 12px;
            margin-bottom: 1rem;
            display: none;
          }
          
          .error-message.show {
            display: block;
          }
          
          @media (max-width: 768px) {
            body {
              padding: 1rem;
            }
            
            .page-header {
              flex-direction: column;
              gap: 1rem;
              align-items: stretch;
            }
            
            .prompt-header {
              flex-direction: column;
              gap: 1rem;
            }
            
            .prompt-actions {
              align-self: flex-start;
            }
            
            .modal-content {
              padding: 1.5rem;
            }
            
            .button-group {
              flex-direction: column;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <header>
            <h1 class="logo">Rally</h1>
            <p class="tagline">Configure AI prompts for specific email addresses</p>
            <nav class="nav">
              <a href="/" class="nav-button">Activity</a>
              <a href="/settings" class="nav-button">Settings</a>
              <a href="/email-prompts" class="nav-button active">Email Prompts</a>
              <a href="/users" class="nav-button">Users</a>
              <a href="/requests" class="nav-button">Requests</a>
            </nav>
          </header>
          
          <div class="page-header">
            <h2 class="page-title">Email-Specific Prompts</h2>
            <button class="btn btn-primary" onclick="openAddModal()">Add Email Prompt</button>
          </div>
          
          <div id="successMessage" class="success-message">
            Email prompt saved successfully!
          </div>
          
          <div id="errorMessage" class="error-message">
            Error saving email prompt. Please try again.
          </div>
          
          <div class="prompts-grid">
            ${emailPrompts.map(prompt => renderPromptCard(prompt)).join('')}
            <div class="add-prompt-card" onclick="openAddModal()">
              <div class="add-prompt-icon">+</div>
              <div class="add-prompt-text">Add New Email Prompt</div>
            </div>
          </div>
        </div>
        
        <!-- Add/Edit Modal -->
        <div id="promptModal" class="modal">
          <div class="modal-content">
            <div class="modal-header">
              <h3 class="modal-title" id="modalTitle">Add Email Prompt</h3>
              <button class="modal-close" onclick="closeModal()">&times;</button>
            </div>
            
            <form id="promptForm">
              <div class="form-group">
                <label class="form-label" for="email_address">Email Address</label>
                <input 
                  type="email" 
                  class="form-input" 
                  id="email_address" 
                  name="email_address" 
                  required
                  placeholder="support@rallycollab.com"
                />
              </div>
              
              <div class="form-group">
                <label class="form-label" for="system_prompt">System Prompt</label>
                <textarea 
                  class="form-textarea" 
                  id="system_prompt" 
                  name="system_prompt" 
                  required
                  placeholder="You are Rally, a customer support assistant..."
                ></textarea>
              </div>
              
              <div class="button-group">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Prompt</button>
              </div>
            </form>
          </div>
        </div>
        
        <script>
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
            
            fetch(\`/email-prompts/\${promptId}\`, {
              method: 'DELETE'
            })
            .then(response => response.json())
            .then(data => {
              if (data.success) {
                location.reload();
              } else {
                showError('Error deleting prompt');
              }
            })
            .catch(error => {
              showError('Error deleting prompt');
            });
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
                headers: {
                  'Content-Type': 'application/json',
                },
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
          
          // Close modal when clicking outside
          document.getElementById('promptModal').addEventListener('click', (e) => {
            if (e.target.id === 'promptModal') {
              closeModal();
            }
          });
        </script>
      </body>
    </html>
  `;
}

function renderPromptCard(prompt: any): string {
  const preview = prompt.system_prompt.length > 150 
    ? prompt.system_prompt.substring(0, 150) + '...'
    : prompt.system_prompt;
  
  const createdDate = new Date(prompt.created_at).toLocaleDateString();
  const updatedDate = prompt.updated_at && prompt.updated_at !== prompt.created_at 
    ? new Date(prompt.updated_at).toLocaleDateString()
    : null;
  
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

// Requests tracking page
export function renderRequestsPage(requests: any[]) {
  const activeRequests = requests.filter((r: any) => r.status === 'active');
  const closedRequests = requests.filter((r: any) => r.status !== 'active');

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Rally - Requests</title>
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
          
          .section-title {
            font-size: 1.5rem;
            font-weight: 600;
            color: #2d3748;
          }
          
          .requests-grid {
            display: grid;
            gap: 1rem;
          }
          
          .request-card {
            background: white;
            border-radius: 16px;
            padding: 1.5rem;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
            border: 1px solid #e2e8f0;
            transition: all 0.2s ease;
            cursor: pointer;
          }
          
          .request-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
            border-color: #667eea;
          }
          
          .request-header {
            display: flex;
            justify-content: space-between;
            align-items: start;
            margin-bottom: 1rem;
          }
          
          .request-title {
            font-size: 1.125rem;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 0.5rem;
          }
          
          .request-meta {
            color: #718096;
            font-size: 0.875rem;
          }
          
          .request-footer {
            display: flex;
            gap: 0.75rem;
            margin-top: 1rem;
            flex-wrap: wrap;
            align-items: center;
          }
          
          .progress-bar {
            flex: 1;
            height: 8px;
            background: #e2e8f0;
            border-radius: 4px;
            overflow: hidden;
            min-width: 150px;
          }
          
          .progress-fill {
            height: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            transition: width 0.3s ease;
          }
          
          .progress-text {
            font-size: 0.875rem;
            font-weight: 600;
            color: #4a5568;
          }
          
          .status-badge {
            display: inline-flex;
            align-items: center;
            padding: 0.375rem 0.75rem;
            border-radius: 8px;
            font-size: 0.75rem;
            font-weight: 500;
          }
          
          .status-badge.active {
            background: #dcfce7;
            color: #15803d;
          }
          
          .status-badge.closed {
            background: #e2e8f0;
            color: #4a5568;
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
        </style>
      </head>
      <body>
        <div class="container">
          <header>
            <h1 class="logo">Rally</h1>
            <p class="tagline">Track data collection requests and responses</p>
            <nav class="nav">
              <a href="/" class="nav-button">Activity</a>
              <a href="/settings" class="nav-button">Settings</a>
              <a href="/email-prompts" class="nav-button">Email Prompts</a>
              <a href="/users" class="nav-button">Users</a>
              <a href="/requests" class="nav-button" style="background: #667eea; color: white; border-color: #667eea;">Requests</a>
            </nav>
          </header>
          
          <div class="stats">
            <div class="stat-card">
              <div class="stat-label">Total Requests</div>
              <div class="stat-value">${requests.length}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Active Requests</div>
              <div class="stat-value">${activeRequests.length}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Closed Requests</div>
              <div class="stat-value">${closedRequests.length}</div>
            </div>
          </div>
          
          ${activeRequests.length > 0 ? `
            <div class="section">
              <div class="section-header">
                <h2 class="section-title">🔄 Active Requests</h2>
              </div>
              <div class="requests-grid">
                ${activeRequests.map((req: any) => renderRequestCard(req)).join('')}
              </div>
            </div>
          ` : ''}
          
          ${closedRequests.length > 0 ? `
            <div class="section">
              <div class="section-header">
                <h2 class="section-title">✅ Closed Requests</h2>
              </div>
              <div class="requests-grid">
                ${closedRequests.map((req: any) => renderRequestCard(req)).join('')}
              </div>
            </div>
          ` : ''}
          
          ${requests.length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">📋</div>
              <div class="empty-text">No requests yet. Send an email to Rally with "please respond by..." to start tracking</div>
            </div>
          ` : ''}
        </div>
        
        <script>
          document.querySelectorAll('.request-card').forEach(card => {
            card.addEventListener('click', function() {
              const requestId = this.dataset.requestId;
              window.location.href = '/requests/' + requestId;
            });
          });
        </script>
      </body>
    </html>
  `;
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
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progress}%"></div>
        </div>
        <span class="progress-text">${responseCount}/${expectedCount} responses</span>
      </div>
    </div>
  `;
}

// Request detail page
export function renderRequestDetail(request: any, responses: any[]) {
  const expectedParticipants = JSON.parse(request.expected_participants || '[]');
  const respondedEmails = responses.map((r: any) => r.responder_email);
  const missingParticipants = expectedParticipants.filter((email: string) => 
    !respondedEmails.includes(email)
  );
  
  const progress = expectedParticipants.length > 0 
    ? (responses.length / expectedParticipants.length) * 100 
    : 0;

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Rally - ${escapeHtml(request.title)}</title>
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
            max-width: 1200px;
            margin: 0 auto;
          }
          
          .back-button {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1.5rem;
            background: white;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            color: #4a5568;
            text-decoration: none;
            font-weight: 500;
            transition: all 0.2s ease;
            margin-bottom: 2rem;
          }
          
          .back-button:hover {
            background: #667eea;
            color: white;
            border-color: #667eea;
          }
          
          .header-card {
            background: white;
            border-radius: 16px;
            padding: 2rem;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
            border: 1px solid #e2e8f0;
            margin-bottom: 2rem;
          }
          
          .request-title {
            font-size: 2rem;
            font-weight: 700;
            color: #2d3748;
            margin-bottom: 1rem;
          }
          
          .request-meta {
            color: #718096;
            font-size: 0.95rem;
            margin-bottom: 0.5rem;
          }
          
          .progress-section {
            margin-top: 1.5rem;
            padding-top: 1.5rem;
            border-top: 1px solid #e2e8f0;
          }
          
          .progress-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.75rem;
          }
          
          .progress-label {
            font-weight: 600;
            color: #2d3748;
          }
          
          .progress-count {
            font-size: 1.25rem;
            font-weight: 700;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          
          .progress-bar {
            height: 12px;
            background: #e2e8f0;
            border-radius: 6px;
            overflow: hidden;
          }
          
          .progress-fill {
            height: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            transition: width 0.3s ease;
          }
          
          .section {
            margin-bottom: 2rem;
          }
          
          .section-title {
            font-size: 1.25rem;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 1rem;
          }
          
          .response-card {
            background: white;
            border-radius: 12px;
            padding: 1.5rem;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
            border: 1px solid #e2e8f0;
            margin-bottom: 1rem;
          }
          
          .response-header {
            display: flex;
            justify-content: space-between;
            align-items: start;
            margin-bottom: 1rem;
          }
          
          .responder-name {
            font-weight: 600;
            color: #2d3748;
            font-size: 1rem;
          }
          
          .responder-email {
            color: #718096;
            font-size: 0.875rem;
          }
          
          .response-time {
            color: #a0aec0;
            font-size: 0.875rem;
          }
          
          .response-data {
            background: #f7fafc;
            border-radius: 8px;
            padding: 1rem;
            margin-top: 1rem;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.875rem;
            color: #2d3748;
          }
          
          .missing-list {
            background: #fef5e7;
            border-radius: 12px;
            padding: 1.5rem;
            border: 1px solid #f9e79f;
          }
          
          .missing-list ul {
            list-style: none;
            padding: 0;
          }
          
          .missing-list li {
            padding: 0.5rem 0;
            color: #856404;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.875rem;
          }
          
          .empty-state {
            text-align: center;
            padding: 3rem 2rem;
            background: white;
            border-radius: 12px;
            border: 2px dashed #e2e8f0;
          }
          
          .empty-icon {
            font-size: 2.5rem;
            margin-bottom: 1rem;
            opacity: 0.5;
          }
          
          .empty-text {
            color: #718096;
            font-size: 0.95rem;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <a href="/requests" class="back-button">← Back to Requests</a>
          
          <div class="header-card">
            <h1 class="request-title">${escapeHtml(request.title || 'Untitled Request')}</h1>
            <div class="request-meta">Created ${formatTime(request.created_at)} by ${escapeHtml(request.created_by_email || 'Unknown')}</div>
            ${request.deadline ? `<div class="request-meta">Deadline: ${new Date(request.deadline).toLocaleString()}</div>` : ''}
            
            <div class="progress-section">
              <div class="progress-header">
                <span class="progress-label">Response Progress</span>
                <span class="progress-count">${responses.length}/${expectedParticipants.length}</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress}%"></div>
              </div>
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
                <ul>
                  ${missingParticipants.map((email: string) => `<li>• ${escapeHtml(email)}</li>`).join('')}
                </ul>
              </div>
            </div>
          ` : ''}
          
          ${responses.length === 0 && expectedParticipants.length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">📭</div>
              <div class="empty-text">No responses yet</div>
            </div>
          ` : ''}
        </div>
      </body>
    </html>
  `;
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
          ${Object.entries(extractedData).map(([key, value]) => 
            `${key}: ${value}`
          ).join('<br>')}
        </div>
      ` : ''}
    </div>
  `;
}

// Legacy function for backwards compatibility
export function renderHtml(content: string) {
  return renderDashboard([]);
}
