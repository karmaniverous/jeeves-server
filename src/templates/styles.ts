/**
 * CSS styles for the Jeeves Server UI
 */

/**
 * Theme variables (light/dark mode support)
 */
export function renderThemeStyles(): string {
  return `
    :root {
      --bg-primary: #ffffff;
      --bg-secondary: #f6f8fa;
      --bg-tertiary: #fafafa;
      --text-primary: #24292e;
      --text-secondary: #586069;
      --text-muted: #6a737d;
      --border-color: #e1e4e8;
      --link-color: #0366d6;
      --code-bg: #f6f8fa;
      --table-header-bg: #f6f8fa;
      --table-row-hover: #f6f8fa;
    }
    [data-theme="dark"] {
      --bg-primary: #0d1117;
      --bg-secondary: #161b22;
      --bg-tertiary: #0d1117;
      --text-primary: #c9d1d9;
      --text-secondary: #8b949e;
      --text-muted: #6e7681;
      --border-color: #30363d;
      --link-color: #58a6ff;
      --code-bg: #161b22;
      --table-header-bg: #161b22;
      --table-row-hover: #161b22;
    }
  `;
}

/**
 * Header and navigation styles
 */
export function renderHeaderStyles(): string {
  return `
    .header { background: #24292e; color: #fff; padding: 0.75rem 2rem; font-size: 14px; line-height: 1.4; position: sticky; top: 0; z-index: 100; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 0 rgba(255,255,255,0.2); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    [data-theme="dark"] .header { box-shadow: none; }
    .header a { color: #79b8ff; text-decoration: none; }
    .header a:hover { text-decoration: underline; }
    .breadcrumb { display: flex; align-items: center; overflow: hidden; flex: 1; min-width: 0; }
    .breadcrumb a, .breadcrumb-current { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; display: inline-block; vertical-align: middle; }
    .breadcrumb-tail { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: calc(100vw - 400px); display: inline-block; vertical-align: middle; }
    .header-actions { display: flex; gap: 1rem; font-size: 13px; align-items: center; flex-shrink: 0; white-space: nowrap; }
    .header-actions a { color: #8b949e; }
    .header-actions a:hover { color: #79b8ff; }
    .breadcrumb-tail { color: #e1e4e8; }
    .breadcrumb-current { color: #e1e4e8; }
    .home-icon { font-size: 2rem; text-shadow: 0 0 8px rgba(255,255,255,0.8), 0 0 16px rgba(255,255,255,0.5); text-decoration: none !important; padding-right: 1rem; }
    .share-ui { display: flex; align-items: center; gap: 0.5rem; }
    .share-ui input { width: 50px; padding: 2px 6px; border: 1px solid #444; border-radius: 3px; background: #333; color: #fff; font-size: 12px; }
    .share-ui button { padding: 2px 8px; border: 1px solid #444; border-radius: 3px; background: #333; color: #8b949e; cursor: pointer; font-size: 12px; }
    .share-ui button:hover { background: #444; color: #fff; }
    .share-btn-inside, .share-btn-outside { min-width: 55px; }
    .expiry-countdown { color: #8b949e; font-size: 12px; margin-left: 0.5rem; }
    .expiry-countdown.expired { color: #f85149; }
    .theme-toggle { background: none; border: 1px solid #444; border-radius: 3px; padding: 2px 8px; cursor: pointer; font-size: 14px; color: #8b949e; }
    .theme-toggle:hover { background: #444; color: #fff; }
    .key-rotation-group { display: flex; align-items: center; gap: 0.4rem; margin-right: 1rem; }
    .key-rotation-age { color: #6e7681; font-size: 12px; }
    .info-btn-group { margin-right: 1rem; }
  `;
}
