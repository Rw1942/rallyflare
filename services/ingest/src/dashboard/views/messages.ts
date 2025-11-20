import { renderLayout } from '../layout';
import { renderMessageRow, messageScripts } from './shared';

export function renderMessages(messages: any[]): string {
  const content = `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">All Messages</h2>
      </div>
      <div class="card-body">
        <div class="message-list">
          ${messages.map(renderMessageRow).join('')}
        </div>
      </div>
    </div>
  `;

  return renderLayout('Rally Messages', content, '/messages', messageScripts);
}
