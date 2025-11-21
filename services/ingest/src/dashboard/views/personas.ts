import { renderLayout } from '../layout';
import { renderMessageRow, messageScripts, renderPagination } from './shared';

export function renderPersonas(personas: any[]): string {
  const content = `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Email Personas (${personas.length})</h2>
        <a href="/personas/new" class="btn btn-primary">+ New Persona</a>
      </div>
      <div class="card-body">
        <div class="message-list">
          ${personas.map(renderPersonaRow).join('')}
          ${personas.length === 0 ? '<p class="text-muted text-center">No personas configured yet. <a href="/personas/new">Create one</a></p>' : ''}
        </div>
      </div>
    </div>
  `;

  return renderLayout('Email Personas', content, '/personas');
}

function renderPersonaRow(persona: any): string {
  const promptPreview = persona.system_prompt 
    ? persona.system_prompt.substring(0, 100).replace(/\s+/g, ' ').trim() + (persona.system_prompt.length > 100 ? '...' : '')
    : 'No prompt set';
  
  const messageCount = persona.message_count || 0;
  
  return `
    <a href="/personas/${encodeURIComponent(persona.email_address)}" class="persona-item" style="display: block; padding: 1rem; border-bottom: 1px solid #eee; text-decoration: none; color: inherit; transition: background 0.2s;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="font-weight: 600;">${escapeHtml(persona.email_address)}</div>
        <span class="badge badge-success">${messageCount} messages</span>
      </div>
      ${persona.model ? `<div class="text-sm text-muted">Model: ${escapeHtml(persona.model)}</div>` : ''}
      <div class="text-sm text-muted" style="font-style: italic; margin-top: 0.5rem;">${escapeHtml(promptPreview)}</div>
    </a>
  `;
}

export function renderPersonaEdit(persona: any | null, isNew: boolean = false): string {
  const formAction = isNew ? '/personas' : `/personas/${encodeURIComponent(persona.email_address)}/edit`;
  const emailAddress = persona?.email_address || '';
  const systemPrompt = persona?.system_prompt || '';
  const model = persona?.model || '';
  const reasoningEffort = persona?.reasoning_effort || '';
  const textVerbosity = persona?.text_verbosity || '';
  const maxOutputTokens = persona?.max_output_tokens || '';

  const content = `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">${isNew ? 'New' : 'Edit'} Persona</h2>
        <a href="/personas" class="text-sm text-muted">&larr; Back</a>
      </div>
      <div class="card-body">
        <form method="POST" action="${formAction}">
          <div class="form-group">
            <label for="email_address" class="form-label">Email Address</label>
            <input 
              type="email" 
              id="email_address" 
              name="email_address" 
              class="form-input" 
              value="${escapeHtml(emailAddress)}"
              ${isNew ? '' : 'readonly style="background: #f5f5f5; cursor: not-allowed;"'}
              required
              placeholder="jeeves@email2chatgpt.com"
            >
            ${isNew ? '<p class="text-sm text-muted" style="margin-top: 0.25rem;">The email address this persona will respond from</p>' : ''}
          </div>

          <div class="form-group">
            <label for="system_prompt" class="form-label">System Prompt</label>
            <textarea 
              id="system_prompt" 
              name="system_prompt" 
              class="form-textarea" 
              rows="12"
              required
              placeholder="You are Jeeves, a distinguished British butler. Respond with impeccable manners, dry wit, and sophisticated vocabulary."
              style="font-family: 'Monaco', 'Menlo', 'Consolas', monospace; font-size: 14px; line-height: 1.5; min-height: 300px;"
            >${escapeHtml(systemPrompt)}</textarea>
            <p class="text-sm text-muted" style="margin-top: 0.25rem;">Define the personality and behavior for this email address</p>
          </div>

          <div class="form-group">
            <label for="model" class="form-label">Model (optional)</label>
            <select id="model" name="model" class="form-select">
              <option value="">Use default</option>
              <option value="gpt-5.1" ${model === 'gpt-5.1' ? 'selected' : ''}>GPT-5.1</option>
            </select>
          </div>

          <div class="form-group">
            <label for="reasoning_effort" class="form-label">Reasoning Effort (optional)</label>
            <select id="reasoning_effort" name="reasoning_effort" class="form-select">
              <option value="">Use default</option>
              <option value="low" ${reasoningEffort === 'low' ? 'selected' : ''}>Low</option>
              <option value="medium" ${reasoningEffort === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="high" ${reasoningEffort === 'high' ? 'selected' : ''}>High</option>
            </select>
          </div>

          <div class="form-group">
            <label for="text_verbosity" class="form-label">Text Verbosity (optional)</label>
            <select id="text_verbosity" name="text_verbosity" class="form-select">
              <option value="">Use default</option>
              <option value="low" ${textVerbosity === 'low' ? 'selected' : ''}>Low</option>
              <option value="medium" ${textVerbosity === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="high" ${textVerbosity === 'high' ? 'selected' : ''}>High</option>
            </select>
          </div>

          <div class="form-group">
            <label for="max_output_tokens" class="form-label">Max Output Tokens (optional)</label>
            <input 
              type="number" 
              id="max_output_tokens" 
              name="max_output_tokens" 
              class="form-input" 
              value="${escapeHtml(String(maxOutputTokens))}"
              placeholder="4000"
              min="100"
              max="16000"
            >
          </div>

          <div style="display: flex; gap: 0.5rem;">
            <button type="submit" class="btn btn-primary">${isNew ? 'Create' : 'Save'} Persona</button>
            ${!isNew ? `<button type="button" onclick="deletePersona('${escapeHtml(emailAddress)}')" class="btn btn-danger">Delete</button>` : ''}
          </div>
        </form>
      </div>
    </div>
  `;

  const scripts = `
    function deletePersona(email) {
      if (confirm('Are you sure you want to delete this persona? This cannot be undone.')) {
        fetch('/personas/' + encodeURIComponent(email), {
          method: 'DELETE'
        }).then(res => {
          if (res.ok) {
            window.location.href = '/personas';
          } else {
            alert('Failed to delete persona');
          }
        });
      }
    }
  `;

  return renderLayout(isNew ? 'New Persona' : 'Edit Persona', content, '/personas', scripts);
}

export function renderPersonaDetail(persona: any, history: any[], pagination?: { page: number, totalPages: number, baseUrl: string }): string {
  const content = `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Persona: ${escapeHtml(persona.email_address)}</h2>
        <a href="/personas/${encodeURIComponent(persona.email_address)}/edit" class="btn btn-primary">Edit Settings</a>
      </div>
      <div class="card-body">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${history.length}</div>
            <div class="stat-label">Messages</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${persona.model || 'Default'}</div>
            <div class="stat-label">Model</div>
          </div>
        </div>
        ${persona.system_prompt ? `
          <div class="form-group" style="margin-top: 1rem;">
            <label class="form-label">System Prompt</label>
            <div class="form-input" style="background: #f9fafb; white-space: pre-wrap;">${escapeHtml(persona.system_prompt)}</div>
          </div>
        ` : ''}
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Message History</h2>
      </div>
      <div class="card-body">
        <div class="message-list">
          ${history.length > 0 ? history.map(renderMessageRow).join('') : '<p class="text-muted text-center">No messages yet for this persona.</p>'}
        </div>
        ${pagination ? renderPagination(pagination.page, pagination.totalPages, pagination.baseUrl) : ''}
      </div>
    </div>
  `;

  return renderLayout(`Persona: ${persona.email_address}`, content, '/personas', messageScripts);
}

function escapeHtml(text: string): string {
  return (text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
