import { renderLayout } from '../layout';
import { escapeHtml } from '../../utils/index';
import { renderMessageRow, messageScripts, renderPagination } from './shared';

export function renderUserDetail(user: any, history: any[], settings: any, pagination?: { page: number, totalPages: number, baseUrl: string }): string {
  const content = `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">User Profile</h2>
      </div>
      <div class="card-body">
        <div class="form-group">
          <label class="form-label">Name</label>
          <div class="form-input" style="background: #f9fafb">${escapeHtml(user.name || 'Unknown')}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <div class="form-input" style="background: #f9fafb">${escapeHtml(user.email)}</div>
        </div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${history.length}</div>
            <div class="stat-label">Messages</div>
          </div>
           <div class="stat-card">
            <div class="stat-value">${user.opt_out ? 'No' : 'Yes'}</div>
            <div class="stat-label">Active</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2 class="card-title">User Settings</h2>
      </div>
      <div class="card-body">
        <form action="/email-prompts" method="POST" id="userSettingsForm">
          <input type="hidden" name="email_address" value="${user.email}">
          
          <div class="form-group">
            <label class="form-label">Custom System Prompt</label>
            <textarea class="form-textarea" name="system_prompt" placeholder="Override global prompt for this user...">${escapeHtml(settings?.system_prompt || '')}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Model Override</label>
            <select class="form-select" name="model">
              <option value="" ${!settings?.model ? 'selected' : ''}>Default (Global)</option>
              <option value="gpt-5.1" ${settings?.model === 'gpt-5.1' ? 'selected' : ''}>GPT-5.1</option>
              <option value="gpt-5-mini" ${settings?.model === 'gpt-5-mini' ? 'selected' : ''}>GPT-5 Mini</option>
            </select>
          </div>

          <button type="submit" class="btn btn-primary btn-block">Save User Settings</button>
        </form>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2 class="card-title">History</h2>
      </div>
      <div class="card-body">
        <div class="message-list">
          ${history.map(renderMessageRow).join('')}
        </div>
        ${pagination ? renderPagination(pagination.page, pagination.totalPages, pagination.baseUrl) : ''}
      </div>
    </div>

    <div class="card" style="border-color: var(--danger)">
      <div class="card-header">
        <h2 class="card-title text-danger">GDPR & Data</h2>
      </div>
      <div class="card-body">
        <p class="text-muted text-sm" style="margin-bottom: 1rem">Manage user data rights. These actions are irreversible.</p>
        <div style="display: grid; gap: 0.5rem">
          <a href="/api/users/${encodeURIComponent(user.email)}/export" target="_blank" class="btn btn-secondary btn-block">Export Data (JSON)</a>
          <button onclick="confirmDelete('${user.email}')" class="btn btn-danger btn-block">Delete User & Anonymize Data</button>
        </div>
      </div>
    </div>
  `;

  const scripts = `
    ${messageScripts}

    function confirmDelete(email) {
      if (confirm('Are you sure? This will delete the user and anonymize all their messages forever.')) {
        fetch('/api/users/' + encodeURIComponent(email), { method: 'DELETE' })
          .then(res => {
            if(res.ok) window.location.href = '/users';
            else alert('Error deleting user');
          });
      }
    }
  `;

  return renderLayout(`User: ${user.email}`, content, '/users', scripts);
}
