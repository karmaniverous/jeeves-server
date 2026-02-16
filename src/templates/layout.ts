/**
 * HTML layout and header rendering
 */

import type { AccessMode } from '../config/types.js';
import { formatRelativeTime } from '../util/formatters.js';
import { getKeyRotationTimestamp } from '../util/state.js';
import { renderHeaderStyles, renderThemeStyles } from './styles.js';

export interface HeaderOptions {
  isInsider: boolean;
  breadcrumbs: string;
  fileName: string | null;
  queryKey: string;
  currentPath: string;
  insiderKey: string;
  expiry?: number | null;
  showRaw?: boolean;
  actions?: string[];
  eventInScope?: boolean;
  keyAge?: string | null;
  hasRaw?: boolean;
  showShareUi?: boolean;
}

/**
 * Render theme toggle script (runs on page load)
 */
export function renderThemeScript(): string {
  return `
    (function() {
      const saved = localStorage.getItem('jeeves-theme') || 'light';
      document.documentElement.setAttribute('data-theme', saved);
      window.toggleTheme = function() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('jeeves-theme', next);
        const btn = document.getElementById('theme-toggle');
        if (btn) { btn.innerHTML = next === 'dark' ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>'; if (window.lucide) lucide.createIcons(); }
      };
      document.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('theme-toggle');
        if (btn) { btn.innerHTML = saved === 'dark' ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>'; }
      });
    })();
  `;
}

/**
 * Render share functionality scripts
 */
export function renderShareScript(isInsider: boolean): string {
  if (isInsider) {
    return `
    const copyLinkBtn = document.getElementById('copy-link-btn');
    const linkType = document.getElementById('link-type');
    const shareExpiry = document.getElementById('share-expiry');
    
    // Load saved expiry
    const savedExpiry = localStorage.getItem('jeeves-share-expiry') || '';
    if (shareExpiry) shareExpiry.value = savedExpiry;
    if (shareExpiry) shareExpiry.addEventListener('change', () => localStorage.setItem('jeeves-share-expiry', shareExpiry.value));
    
    // Copy link button: generate outsider link for selected type
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', async () => {
        const type = linkType ? linkType.value : 'page';
        const basePath = copyLinkBtn.dataset.path;
        const targetPath = type === 'event' ? '/event' : basePath;
        const insiderKey = copyLinkBtn.dataset.insiderKey;
        const expiryVal = shareExpiry ? shareExpiry.value : '';
        
        let expParam = '';
        if (expiryVal) {
          const match = expiryVal.match(/^(\\d+)([mhd])$/i);
          if (match) {
            const val = parseInt(match[1], 10);
            const unit = match[2].toLowerCase();
            const multiplier = { m: 60*1000, h: 60*60*1000, d: 24*60*60*1000 }[unit];
            expParam = '&exp=' + (Date.now() + val * multiplier);
          }
        }
        
        try {
          const resp = await fetch('/share?path=' + encodeURIComponent(targetPath) + '&key=' + insiderKey + expParam);
          const data = await resp.json();
          if (data.url) {
            let fullUrl = window.location.origin + data.url;
            if (type === 'raw') fullUrl += (fullUrl.includes('?') ? '&' : '?') + 'raw=1';
            await navigator.clipboard.writeText(fullUrl);
            copyLinkBtn.innerHTML = '<i data-lucide="check"></i>'; lucide.createIcons();
            setTimeout(() => { copyLinkBtn.innerHTML = '<i data-lucide="link"></i>'; lucide.createIcons(); }, 1500);
          }
        } catch (err) { console.error('Share failed:', err); }
      });
    }
    
    // Key rotation button
    const rotateKeyBtn = document.getElementById('rotate-key-btn');
    if (rotateKeyBtn) {
      rotateKeyBtn.addEventListener('click', async () => {
        const confirmed = confirm('⚠️ Rotate API Key?\\n\\nThis will INVALIDATE all existing links and shares.\\n\\nYou will be redirected to the new insider link for this page.');
        if (!confirmed) return;
        
        const insiderKey = rotateKeyBtn.dataset.insiderKey;
        try {
          // Try with insider key first (machine keys), fall back to cookie auth
          const resp = await fetch('/rotate-key?key=' + insiderKey, { method: 'POST', credentials: 'same-origin' });
          const data = await resp.json();
          if (data.ok) {
            if (data.insiderKey) {
              // Machine key rotation: navigate with new key
              const url = new URL(window.location.href);
              url.searchParams.set('key', data.insiderKey);
              window.location.href = url.toString();
            } else {
              // Session-based rotation: just reload
              window.location.reload();
            }
          } else {
            alert('Key rotation failed: ' + (data.error || 'Unknown error'));
          }
        } catch (err) {
          alert('Key rotation failed: ' + err.message);
        }
      });
    }
    `;
  } else {
    return `
    const shareBtn = document.getElementById('share-btn');
    const countdownEl = document.querySelector('.expiry-countdown');
    
    // Share button: copy current page URL
    if (shareBtn) {
      shareBtn.addEventListener('click', async () => {
        await navigator.clipboard.writeText(window.location.href);
        shareBtn.innerHTML = '<i data-lucide="check"></i> Copied'; lucide.createIcons();
        setTimeout(() => { shareBtn.innerHTML = '<i data-lucide="link"></i> Share'; lucide.createIcons(); }, 1500);
      });
    }
    
    // Expiry countdown
    if (countdownEl) {
      const expiry = parseInt(countdownEl.dataset.expiry, 10);
      const update = () => {
        const remaining = expiry - Date.now();
        if (remaining <= 0) {
          countdownEl.textContent = '(expired)';
          countdownEl.classList.add('expired');
          return;
        }
        const mins = Math.floor(remaining / 60000);
        const hours = Math.floor(mins / 60);
        const days = Math.floor(hours / 24);
        let text;
        if (days > 0) text = days + 'd ' + (hours % 24) + 'h';
        else if (hours > 0) text = hours + 'h ' + (mins % 60) + 'm';
        else text = mins + 'm';
        countdownEl.textContent = '(expires in ' + text + ')';
      };
      update();
      setInterval(update, 60000);
    }
    `;
  }
}

/**
 * Build breadcrumb navigation trail
 */
export function buildBreadcrumbs(
  resolvedPath: string,
  apiKey: string,
  mode: AccessMode,
  insiderKey: string,
  shareRoot?: string | null,
): string {
  const pathParts = resolvedPath.split('\\').filter((p) => p);

  // Outsiders with a directory share see navigable breadcrumbs from share root
  if (mode === 'outsider' && shareRoot) {
    // Convert shareRoot (URL path like "/d/projects/foo") to Windows path parts
    const shareRootParts = shareRoot
      .replace(/^\//, '')
      .split('/')
      .filter((p) => p);
    // Find the index where the share root ends in the full path
    const startIdx = shareRootParts.length > 0 ? shareRootParts.length - 1 : 0;

    let breadcrumbs = `<span class="home-icon" title="Jeeves Server">🎩</span>`;
    let accumPath = '';

    for (let i = startIdx; i < pathParts.length; i++) {
      const part = pathParts[i];
      if (i === 0) {
        accumPath = part;
      } else if (accumPath === '') {
        accumPath = part;
      } else {
        accumPath += '\\' + part;
      }
      // Build accumPath from start
      const fullAccum = pathParts.slice(0, i + 1).join('\\');
      const separator = i === startIdx ? '' : ' &nbsp;/&nbsp; ';
      const isLast = i === pathParts.length - 1;
      const urlPath = `/${fullAccum.replace(/\\/g, '/').replace(/^([A-Z]):/, (_m: string, d: string) => d.toLowerCase())}`;
      const queryKey = apiKey;

      if (isLast) {
        breadcrumbs += `${separator}<span class="breadcrumb-current">${part}</span>`;
      } else {
        breadcrumbs += `${separator}<a href="/path${urlPath}?key=${queryKey}">${part}</a>`;
      }
    }
    return breadcrumbs;
  }

  // Outsiders without directory share see top hat + filename only
  if (mode === 'outsider') {
    const fileName = pathParts[pathParts.length - 1] || '';
    return `<span class="home-icon" title="Jeeves Server">🎩</span> <span class="breadcrumb-tail">${fileName}</span>`;
  }

  // Insiders see full navigable breadcrumbs (no key params — cookie auth)
  let breadcrumbs = `<a href="/path" class="home-icon" title="Jeeves Server">🎩</a>`;
  let accumPath = '';

  for (let i = 0; i < pathParts.length; i++) {
    const part = pathParts[i];
    if (i === 0) {
      accumPath = part;
    } else {
      accumPath += '\\' + part;
    }
    const separator = i === 0 ? '' : ' &nbsp;/&nbsp; ';
    const isLast = i === pathParts.length - 1;

    if (isLast) {
      breadcrumbs += `${separator}<span class="breadcrumb-current">${part}</span>`;
    } else {
      const urlPath = `/${accumPath.replace(/\\/g, '/').replace(/^([A-Z]):/, (m: string, d: string) => d.toLowerCase())}`;
      breadcrumbs += `${separator}<a href="/path${urlPath}">${part}</a>`;
    }
  }

  return breadcrumbs;
}

/**
 * Render the page header with breadcrumbs, actions, and share UI
 */
export function renderHeader(options: HeaderOptions): string {
  const {
    isInsider,
    breadcrumbs,
    fileName,
    queryKey,
    currentPath,
    insiderKey,
    actions = [],
    expiry = null,
    showRaw = true,
  } = options;

  const defaultActions =
    showRaw && fileName
      ? [
          isInsider
            ? `<a href="?raw=1" download="${fileName}" title="Download raw file"><i data-lucide="cloud-download"></i> Raw</a>`
            : `<a href="?key=${queryKey}&amp;raw=1" download="${fileName}" title="Download raw file"><i data-lucide="cloud-download"></i> Raw</a>`,
        ]
      : [];
  const allActions = [...defaultActions, ...actions];

  const {
    eventInScope = false,
    keyAge = null,
    hasRaw = false,
    showShareUi = true,
  } = options;

  let shareUi = '';
  if (showShareUi && isInsider) {
    const rawOption = hasRaw ? '<option value="raw">Raw</option>' : '';
    shareUi = `
      <div class="share-ui">
        <span style="color:#8b949e">Link:</span>
        <select id="link-type" title="Link type">
          <option value="page">Page</option>
          ${rawOption}
          <option value="event">Event</option>
        </select>
        <select id="share-expiry" title="Link expiry"><option value="">never</option><option value="1h">1h</option><option value="1d">1d</option><option value="7d">1w</option><option value="30d">1m</option><option value="365d">1y</option></select>
        <button id="copy-link-btn" class="share-btn-outside" data-path="${currentPath}" data-insider-key="${insiderKey}" title="Copy outsider link to clipboard"><i data-lucide="link"></i></button>
      </div>
    `;
  } else if (showShareUi) {
    const expiryHtml = expiry
      ? `<span class="expiry-countdown" data-expiry="${String(expiry)}"></span>`
      : '';
    shareUi = `
      <div class="share-ui">
        <button id="share-btn" data-key="${queryKey}" title="Copy link to clipboard"><i data-lucide="link"></i> Share</button>
        ${expiryHtml}
      </div>
    `;
  }

  // Info button
  const infoBtnGroup = `
    <div class="info-btn-group">
      <a href="/about" class="theme-toggle" title="About Jeeves Server" style="text-decoration:none;font-weight:bold;">?</a>
    </div>
  `;

  // Key rotation button (insider only)
  let keyRotateGroup = '';
  if (isInsider) {
    const ageText = keyAge ?? formatRelativeTime(getKeyRotationTimestamp());
    const ageHtml = ageText
      ? `<span class="key-rotation-age">${ageText}</span>`
      : '';
    keyRotateGroup = `
      <div class="key-rotation-group">
        <button id="rotate-key-btn" class="theme-toggle" title="Rotate key (invalidates all your shares)" data-insider-key="${insiderKey}"><i data-lucide="key-round"></i></button>
        ${ageHtml}
      </div>
    `;
  }

  return `
    <div class="header">
      <div class="breadcrumb">${breadcrumbs}</div>
      <div class="header-actions">
        ${infoBtnGroup}
        ${keyRotateGroup}
        ${allActions.join('\n        ')}
        ${shareUi}
        <button id="theme-toggle" class="theme-toggle" onclick="toggleTheme()" title="Toggle dark/light theme"><i data-lucide="moon"></i></button>
      </div>
    </div>
  `;
}

export interface PageShellOptions {
  title: string;
  headerHtml: string;
  bodyContent: string;
  /** Additional CSS to include in <style> */
  pageStyles?: string;
  /** Additional JS to include before closing </body>. Runs AFTER lucide.createIcons() */
  pageScripts?: string;
  /** Whether page needs share script (insider/outsider) */
  shareScript?: { isInsider: boolean } | null;
  /** Additional <head> elements (e.g. highlight.js theme link) */
  headExtra?: string;
}

/**
 * Render a complete HTML page shell with shared head, theme, and Lucide
 */
export function renderPageShell(options: PageShellOptions): string {
  const { title, headerHtml, bodyContent, pageStyles = '', pageScripts = '', shareScript = null, headExtra = '' } = options;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <script src="/static/lucide.min.js"></script>
  <title>${title}</title>
  <script>${renderThemeScript()}</script>
  ${headExtra}
  <style>
    ${renderThemeStyles()}
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 0;
      color: var(--text-primary);
      background: var(--bg-tertiary);
    }
    ${renderHeaderStyles()}
    [data-lucide] { width: 16px; height: 16px; display: inline-block; vertical-align: middle; }
    .lucide-spin { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    ${pageStyles}
  </style>
</head>
<body>
  ${headerHtml}
  ${bodyContent}
  <script>
    ${shareScript ? renderShareScript(shareScript.isInsider) : ''}
    ${pageScripts}
    // Initialize all Lucide icons
    lucide.createIcons();
  </script>
</body>
</html>`;
}
