export const SHARED_STYLES = `
  :root {
    --primary: #6366f1;
    --primary-dark: #4f46e5;
    --bg-body: #f3f4f6;
    --bg-card: #ffffff;
    --text-main: #111827;
    --text-muted: #6b7280;
    --border: #e5e7eb;
    --success: #10b981;
    --warning: #f59e0b;
    --danger: #ef4444;
    --radius: 12px;
    --shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background-color: var(--bg-body);
    color: var(--text-main);
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  a { color: inherit; text-decoration: none; }

  /* Layout */
  .app-shell {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .container {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 1rem;
  }

  /* Header */
  .header {
    background: var(--bg-card);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 64px;
    padding: 0 1rem;
  }

  .logo {
    font-weight: 700;
    font-size: 1.25rem;
    color: var(--primary);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* Navigation */
  .nav-menu {
    display: flex;
    gap: 1.5rem;
  }

  .nav-link {
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--text-muted);
    padding: 0.5rem 0;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
  }

  .nav-link:hover, .nav-link.active {
    color: var(--primary);
    border-bottom-color: var(--primary);
  }

  /* Mobile Nav Trigger */
  .menu-toggle {
    display: none;
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-muted);
  }

  /* Cards */
  .card {
    background: var(--bg-card);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    border: 1px solid var(--border);
    overflow: hidden;
    margin-bottom: 1rem;
  }

  .card-header {
    padding: 1rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .card-title {
    font-weight: 600;
    font-size: 1.1rem;
  }

  .card-body {
    padding: 1rem;
  }

  /* Stats Grid */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .stat-card {
    padding: 1.25rem;
    background: var(--bg-card);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }

  .stat-value {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--primary);
    line-height: 1.2;
  }

  .stat-label {
    font-size: 0.875rem;
    color: var(--text-muted);
    margin-top: 0.25rem;
  }

  /* Messages List */
  .message-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .message-item {
    display: block;
    background: var(--bg-card);
    padding: 1rem;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    transition: transform 0.1s;
  }
  
  .message-item:active {
    transform: scale(0.99);
  }

  .msg-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .msg-sender {
    font-weight: 600;
    font-size: 0.95rem;
  }

  .msg-time {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .msg-subject {
    font-weight: 500;
    margin-bottom: 0.25rem;
  }

  .msg-preview {
    color: var(--text-muted);
    font-size: 0.9rem;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Badges */
  .badge {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .badge-inbound { background: #e0e7ff; color: var(--primary-dark); }
  .badge-outbound { background: #f3e8ff; color: #7e22ce; }
  .badge-success { background: #d1fae5; color: #047857; }
  .badge-error { background: #fee2e2; color: #b91c1c; }

  /* Forms */
  .form-group { margin-bottom: 1.25rem; }
  
  .form-label {
    display: block;
    font-size: 0.9rem;
    font-weight: 500;
    margin-bottom: 0.5rem;
  }

  .form-input, .form-select, .form-textarea {
    width: 100%;
    padding: 0.75rem;
    border-radius: 8px;
    border: 1px solid var(--border);
    font-size: 1rem;
    background: var(--bg-card);
  }

  .form-textarea { min-height: 120px; resize: vertical; }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    font-size: 1rem;
    transition: opacity 0.2s;
  }

  .btn:active { opacity: 0.8; }
  .btn-primary { background: var(--primary); color: white; }
  .btn-danger { background: var(--danger); color: white; }
  .btn-secondary { background: white; border: 1px solid var(--border); color: var(--text-main); }
  .btn-block { width: 100%; }

  /* Utilities */
  .mt-4 { margin-top: 1rem; }
  .flex-between { display: flex; justify-content: space-between; align-items: center; }
  .text-sm { font-size: 0.875rem; }
  .text-muted { color: var(--text-muted); }

  /* Mobile Responsive */
  @media (max-width: 768px) {
    .container { padding: 0.75rem; }
    
    .menu-toggle { display: block; }
    
    .nav-menu {
      display: none;
      position: absolute;
      top: 64px;
      left: 0;
      right: 0;
      background: var(--bg-card);
      flex-direction: column;
      padding: 1rem;
      border-bottom: 1px solid var(--border);
      gap: 0.5rem;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }

    .nav-menu.active { display: flex; }
    
    .nav-link {
      padding: 0.75rem;
      border-radius: 8px;
      background: var(--bg-body);
      border-bottom: none;
    }
    
    .nav-link.active {
      background: #e0e7ff;
      color: var(--primary-dark);
    }

    .stats-grid { grid-template-columns: 1fr; }
  }
`;

