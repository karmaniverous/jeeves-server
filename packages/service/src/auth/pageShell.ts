/**
 * Shared page-shell utilities for server-rendered auth pages.
 *
 * Provides the standard HTML document structure, header, theme support,
 * dark-mode overrides, and common CSS shared by signInPage, verifyPage,
 * and similar server-rendered pages.
 *
 * @packageDocumentation
 */

/** Options for rendering a standard page shell. */
export interface PageShellOptions {
  /** Page &lt;title&gt; suffix (after brand emoji + name). */
  titleSuffix: string;
  /** Brand name — defaults to 'Jeeves Server'. */
  brandName?: string;
  /** Brand emoji — defaults to '🎩'. */
  brandEmoji?: string;
  /** Additional CSS rules injected after shared styles. */
  extraCss?: string;
  /** Inner HTML rendered inside the `.box` container. */
  bodyContent: string;
  /** Additional &lt;script&gt; content appended before &lt;/body&gt;. */
  footerScript?: string;
}

/**
 * Render a complete HTML page with the standard Jeeves auth-page shell.
 *
 * Includes: theme init script, shared CSS (reset, header, layout, dark mode),
 * branded header with theme toggle, and a centered content box.
 */
export function renderPageShell(options: PageShellOptions): string {
  const brandName = options.brandName ?? 'Jeeves Server';
  const brandEmoji = options.brandEmoji ?? '🎩';
  const safeName = escapeHtml(brandName);
  const safeEmoji = escapeHtml(brandEmoji);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeEmoji} ${safeName} — ${escapeHtml(options.titleSuffix)}</title>
<script>
// Theme: match SPA behavior — read localStorage, fall back to system preference.
(function() {
  var saved = localStorage.getItem('jeeves-theme');
  var theme = saved === 'dark' || saved === 'light' ? saved
    : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  if (theme === 'dark') document.documentElement.classList.add('dark');
})();
</script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: system-ui, -apple-system, sans-serif;
    color: #1a1a1a;
    background: #fff;
  }
  /* Header — matches SPA zinc-800 bar */
  .header {
    background: #27272a;
    color: #fff;
    padding: 0.5rem 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .header-brand {
    font-size: 1.5rem;
    text-decoration: none;
    color: #fff;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .header-brand-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: #d4d4d8;
  }
  .theme-btn {
    background: transparent;
    border: none;
    color: #d4d4d8;
    cursor: pointer;
    padding: 0.375rem;
    border-radius: 0.25rem;
    display: flex;
    align-items: center;
    transition: color 0.15s, background 0.15s;
  }
  .theme-btn:hover { color: #fff; background: rgba(255,255,255,0.1); }
  .theme-btn svg { width: 1rem; height: 1rem; }
  .icon-sun { display: none; }
  .icon-moon { display: block; }
  .dark .icon-sun { display: block; }
  .dark .icon-moon { display: none; }
  /* Content layout */
  .content {
    margin: 60px auto;
    padding: 0 20px;
    text-align: center;
  }
  .box {
    max-width: 400px;
    margin: 0 auto;
  }
  h1 { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.25rem; }
  h2 { font-size: 1rem; font-weight: 400; color: #666; margin-top: 0; margin-bottom: 1.25rem; }
  .btn-primary {
    display: block;
    width: 100%;
    padding: 10px 24px;
    background: #4285f4;
    color: #fff;
    border: none;
    border-radius: 4px;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    text-align: center;
    transition: background 0.15s;
  }
  .btn-primary:hover { background: #3367d6; }
  .error-msg {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: #d93025;
  }
  /* Dark mode overrides (class-based, matches SPA) */
  .dark body { color: #e0e0e0; background: #1a1a1a; }
  .dark h2 { color: #999; }
${options.extraCss ?? ''}
</style>
</head>
<body>
<header class="header">
  <span class="header-brand">${safeEmoji} <span class="header-brand-name">${safeName}</span></span>
  <button class="theme-btn" id="themeToggle" title="Toggle theme">
    <svg class="icon-sun" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
    <svg class="icon-moon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
  </button>
</header>
<div class="content">
<div class="box">
<h1>${safeEmoji} ${safeName}</h1>
${options.bodyContent}
</div>
</div>
<script>
document.getElementById('themeToggle').addEventListener('click', function() {
  var html = document.documentElement;
  var isDark = html.classList.toggle('dark');
  localStorage.setItem('jeeves-theme', isDark ? 'dark' : 'light');
});
</script>
${options.footerScript ? `<script>\n${options.footerScript}\n</script>` : ''}
</body>
</html>`;
}

/** Basic HTML entity escaping for untrusted values in server-rendered pages. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
