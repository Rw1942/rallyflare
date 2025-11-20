import { SHARED_STYLES } from './styles';

export function renderLayout(
  title: string,
  content: string,
  activePath: string,
  scripts: string = ''
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${title}</title>
  <style>${SHARED_STYLES}</style>
</head>
<body>
  <div class="app-shell">
    <header class="header">
      <div class="header-content">
        <a href="/" class="logo">
          <span>⚡️ Rally</span>
        </a>
        <button class="menu-toggle" onclick="toggleMenu()" aria-label="Toggle Menu">☰</button>
        <nav class="nav-menu" id="navMenu">
          <a href="/" class="nav-link ${activePath === '/' ? 'active' : ''}">Activity</a>
          <a href="/messages" class="nav-link ${activePath === '/messages' ? 'active' : ''}">Messages</a>
          <a href="/users" class="nav-link ${activePath === '/users' ? 'active' : ''}">Users</a>
          <a href="/personas" class="nav-link ${activePath === '/personas' ? 'active' : ''}">Personas</a>
          <a href="/settings" class="nav-link ${activePath === '/settings' ? 'active' : ''}">Settings</a>
        </nav>
      </div>
    </header>

    <main class="container">
      ${content}
    </main>
  </div>

  <script>
    function toggleMenu() {
      document.getElementById('navMenu').classList.toggle('active');
    }
    
    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
      const nav = document.getElementById('navMenu');
      const toggle = document.querySelector('.menu-toggle');
      if (!nav.contains(e.target) && !toggle.contains(e.target) && nav.classList.contains('active')) {
        nav.classList.remove('active');
      }
    });

    // Localize timestamps
    document.addEventListener('DOMContentLoaded', function() {
      document.querySelectorAll('[data-timestamp]').forEach(function(el) {
        const ts = el.getAttribute('data-timestamp');
        if (ts) {
          const date = new Date(ts);
          if (!isNaN(date.getTime())) {
            el.textContent = date.toLocaleString();
          }
        }
      });
    });
    
    ${scripts}
  </script>
</body>
</html>`;
}

