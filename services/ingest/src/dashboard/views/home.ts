import { renderLayout } from '../layout';

export interface HomeStats {
  total24h: number;
  inbound24h: number;
  outbound24h: number;
  aiProcessed24h: number;
}

export function renderHome(stats: HomeStats): string {
  const content = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${stats.total24h}</div>
        <div class="stat-label">Messages (24h)</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.inbound24h}</div>
        <div class="stat-label">Inbound (24h)</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.outbound24h}</div>
        <div class="stat-label">Replies (24h)</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.aiProcessed24h}</div>
        <div class="stat-label">AI Processed (24h)</div>
      </div>
    </div>
  `;

  return renderLayout('Rally Dashboard', content, '/');
}
