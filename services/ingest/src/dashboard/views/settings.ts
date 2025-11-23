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
              <option value="gpt-5.1" ${settings?.model === 'gpt-5.1' ? 'selected' : ''}>GPT-5.1 (Advanced)</option>
              <option value="gpt-5-mini" ${settings?.model === 'gpt-5-mini' ? 'selected' : ''}>GPT-5 Mini (Fast)</option>
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

