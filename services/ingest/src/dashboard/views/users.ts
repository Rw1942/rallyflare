import { renderLayout } from '../layout';

export function renderUsers(users: any[]): string {
  const content = `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Users (${users.length})</h2>
      </div>
      <div class="card-body">
        <input type="text" id="userSearch" class="form-input" placeholder="Search users..." onkeyup="filterUsers()" style="margin-bottom: 1rem">
        <div class="message-list" id="userList">
          ${users.map(renderUserRow).join('')}
        </div>
      </div>
    </div>
  `;

  const scripts = `
    function filterUsers() {
      const input = document.getElementById('userSearch');
      const filter = input.value.toLowerCase();
      const list = document.getElementById('userList');
      const items = list.getElementsByClassName('message-item');

      for (let i = 0; i < items.length; i++) {
        const text = items[i].textContent || items[i].innerText;
        if (text.toLowerCase().indexOf(filter) > -1) {
          items[i].style.display = "";
        } else {
          items[i].style.display = "none";
        }
      }
    }
  `;

  return renderLayout('Rally Users', content, '/users', scripts);
}

function renderUserRow(user: any): string {
  const rawDate = user.last_seen_at || new Date().toISOString();
  const lastSeen = new Date(rawDate).toLocaleString('en-US', { timeZone: 'America/Denver' });
  const msgCount = user.message_count !== undefined ? user.message_count : 0;
  
  return `
    <a href="/users/${encodeURIComponent(user.email)}" class="message-item">
      <div class="flex-between">
        <div class="msg-sender">${escapeHtml(user.name || user.email)}</div>
        <span class="badge ${user.opt_out ? 'badge-error' : 'badge-success'}">${user.opt_out ? 'Opted Out' : 'Active'}</span>
      </div>
      <div class="text-sm text-muted">${escapeHtml(user.email)}</div>
      <div class="flex-between" style="margin-top: 0.25rem">
        <div class="text-sm text-muted">Last seen: <span data-timestamp="${rawDate}">${lastSeen}</span></div>
        <div class="text-sm text-muted">Messages: ${msgCount}</div>
      </div>
    </a>
  `;
}

function escapeHtml(text: string): string {
  return (text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
