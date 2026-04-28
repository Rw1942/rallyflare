import { renderLayout } from '../layout';

export function renderSettings(settings: any): string {
  const content = `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Global AI Settings</h2>
      </div>
      <div class="card-body">
        <form action="/settings" method="POST">
          <div class="form-group">
            <label class="form-label">System Prompt</label>
            <textarea class="form-textarea" name="system_prompt">${escapeHtml(settings?.system_prompt || '')}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Default Model</label>
            <select class="form-select" name="model">
              <option value="gpt-5.5" ${settings?.model === 'gpt-5.5' ? 'selected' : ''}>GPT-5.5 (Recommended)</option>
              <option value="gpt-5.4" ${settings?.model === 'gpt-5.4' ? 'selected' : ''}>GPT-5.4</option>
              <option value="gpt-5.4-mini" ${settings?.model === 'gpt-5.4-mini' ? 'selected' : ''}>GPT-5.4 Mini</option>
              <option value="gpt-5-mini" ${settings?.model === 'gpt-5-mini' ? 'selected' : ''}>GPT-5 Mini (Budget)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Reasoning Effort</label>
            <select class="form-select" name="reasoning_effort">
              <option value="low" ${settings?.reasoning_effort === 'low' ? 'selected' : ''}>Low</option>
              <option value="medium" ${settings?.reasoning_effort === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="high" ${settings?.reasoning_effort === 'high' ? 'selected' : ''}>High</option>
            </select>
          </div>

           <div class="form-group">
            <label class="form-label">Max Tokens</label>
            <input type="number" class="form-input" name="max_output_tokens" value="${settings?.max_output_tokens || 8000}">
          </div>

          <hr style="margin: 1.5rem 0; border-color: var(--border)">

          <div class="form-group">
            <label class="form-label" style="display: flex; align-items: center; gap: 0.5rem;">
              <input type="checkbox" name="web_search_enabled" value="1" ${settings?.web_search_enabled ? 'checked' : ''}>
              Enable Web Search
            </label>
            <div class="text-muted text-sm" style="margin-top: 0.25rem">When enabled, AI can search the web for up-to-date information before replying. On by default.</div>
          </div>

          <div class="form-group">
            <label class="form-label">Web Search Context Size</label>
            <select class="form-select" name="web_search_context_size">
              <option value="low" ${settings?.web_search_context_size === 'low' || !settings?.web_search_context_size ? 'selected' : ''}>Low (fastest, lowest cost)</option>
              <option value="medium" ${settings?.web_search_context_size === 'medium' ? 'selected' : ''}>Medium (balanced)</option>
              <option value="high" ${settings?.web_search_context_size === 'high' ? 'selected' : ''}>High (most comprehensive)</option>
            </select>
          </div>

          <button type="submit" class="btn btn-primary btn-block">Save Global Settings</button>
        </form>
      </div>
    </div>
  `;

  return renderLayout('Rally Settings', content, '/settings');
}

function escapeHtml(text: string): string {
  return (text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

