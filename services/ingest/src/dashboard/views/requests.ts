import { renderLayout } from '../layout';

export function renderRequests(requests: any[]): string {
  const content = `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Requests</h2>
      </div>
      <div class="card-body">
        <p class="text-muted">Request tracking is currently under maintenance.</p>
      </div>
    </div>
  `;
  return renderLayout('Rally Requests', content, '/requests');
}

export function renderRequestDetail(request: any, responses: any[]): string {
   const content = `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Request Detail</h2>
      </div>
      <div class="card-body">
        <p class="text-muted">Request detail is currently under maintenance.</p>
      </div>
    </div>
  `;
  return renderLayout('Rally Request Detail', content, '/requests');
}

