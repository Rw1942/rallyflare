import { renderLayout } from '../layout';
import { renderMessageRow, messageScripts, renderPagination } from './shared';

export function renderMessages(messages: any[], pagination?: { page: number, totalPages: number, baseUrl: string }): string {
  const content = `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">All Messages</h2>
      </div>
      <div class="card-body">
        <div class="message-list">
          ${messages.map(renderMessageRow).join('')}
        </div>
        ${pagination ? renderPagination(pagination.page, pagination.totalPages, pagination.baseUrl) : ''}
      </div>
    </div>
  `;

  return renderLayout('Rally Messages', content, '/messages', messageScripts);
}
