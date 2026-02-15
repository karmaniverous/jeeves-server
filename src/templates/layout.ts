/**
 * HTML layout and header rendering
 */

import type { AccessMode } from '../config/types.js';
import { formatRelativeTime } from '../util/formatters.js';
import { getKeyRotationTimestamp } from '../util/state.js';

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
        if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
      };
      document.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('theme-toggle');
        if (btn) btn.textContent = saved === 'dark' ? '☀️' : '🌙';
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
    
    // Copy link button: generate outsider link for selected type
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', async () => {
        const type = linkType ? linkType.value : 'page';
        const basePath = copyLinkBtn.dataset.path;
        const targetPath = type === 'event' ? '/event' : basePath;
        const insiderKey = copyLinkBtn.dataset.insiderKey;
        const expiryInput = shareExpiry ? shareExpiry.value.trim() : '';
        
        // Validate expiry format
        let expParam = '';
        if (expiryInput) {
          const match = expiryInput.match(/^(\\d+)([mhd])$/i);
          if (!match) {
            shareExpiry.style.borderColor = '#f85149';
            shareExpiry.title = 'Invalid format. Use: 15m, 1h, 7d';
            setTimeout(() => { shareExpiry.style.borderColor = '#444'; }, 2000);
            return;
          }
          const val = parseInt(match[1], 10);
          const unit = match[2].toLowerCase();
          if (val <= 0 || val > 365) {
            shareExpiry.style.borderColor = '#f85149';
            shareExpiry.title = 'Value must be 1-365';
            setTimeout(() => { shareExpiry.style.borderColor = '#444'; }, 2000);
            return;
          }
          const multiplier = { m: 60*1000, h: 60*60*1000, d: 24*60*60*1000 }[unit];
          const expiry = Date.now() + val * multiplier;
          expParam = '&exp=' + expiry;
        }
        
        localStorage.setItem('jeeves-share-expiry', expiryInput);
        
        try {
          const resp = await fetch('/share?path=' + encodeURIComponent(targetPath) + '&key=' + insiderKey + expParam);
          const data = await resp.json();
          if (data.url) {
            let fullUrl = window.location.origin + data.url;
            if (type === 'raw') fullUrl += (fullUrl.includes('?') ? '&' : '?') + 'raw=1';
            await navigator.clipboard.writeText(fullUrl);
            copyLinkBtn.textContent = '✓';
            setTimeout(() => { copyLinkBtn.textContent = '📋'; }, 1500);
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
        shareBtn.textContent = '✓ Copied';
        setTimeout(() => { shareBtn.textContent = '📋 Share'; }, 1500);
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
): string {
  const pathParts = resolvedPath.split('\\').filter((p) => p);

  // Outsiders see top hat branding + filename
  if (mode === 'outsider') {
    const fileName = pathParts[pathParts.length - 1] || '';
    return `<span class="home-icon" title="Jeeves Server">🎩</span> <span class="breadcrumb-tail">${fileName}</span>`;
  }

  // Insiders see full navigable breadcrumbs
  let breadcrumbs = `<a href="/path?key=${insiderKey}" class="home-icon" title="Jeeves Server">🎩</a>`;
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
      breadcrumbs += `${separator}<a href="/path${urlPath}?key=${insiderKey}">${part}</a>`;
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
          `<a href="?key=${queryKey}&amp;raw=1" download="${fileName}" title="Download raw file">⬇ Raw</a>`,
        ]
      : [];
  const allActions = [...defaultActions, ...actions];

  const { eventInScope = false, keyAge = null, hasRaw = false } = options;

  let shareUi;
  if (isInsider) {
    const rawOption = hasRaw ? '<option value="raw">Raw</option>' : '';
    const eventOption = eventInScope
      ? '<option value="event">Event</option>'
      : '';
    shareUi = `
      <div class="share-ui">
        <span style="color:#8b949e">Link:</span>
        <select id="link-type" title="Link type">
          <option value="page">Page</option>
          ${rawOption}
          ${eventOption}
        </select>
        <input type="text" id="share-expiry" placeholder="1h" title="Expiry: 15m, 1h, 7d, or blank for never">
        <button id="copy-link-btn" class="share-btn-outside" data-path="${currentPath}" data-insider-key="${insiderKey}" title="Copy outsider link to clipboard">📋</button>
      </div>
    `;
  } else {
    const expiryHtml = expiry
      ? `<span class="expiry-countdown" data-expiry="${String(expiry)}"></span>`
      : '';
    shareUi = `
      <div class="share-ui">
        <button id="share-btn" data-key="${queryKey}" title="Copy link to clipboard">📋 Share</button>
        ${expiryHtml}
      </div>
    `;
  }

  // Info button
  const infoBtnGroup = `
    <div class="info-btn-group">
      <a href="/about${isInsider ? '?key=' + insiderKey : ''}" class="theme-toggle" title="About Jeeves Server" style="text-decoration:none;font-weight:bold;">?</a>
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
        <button id="rotate-key-btn" class="theme-toggle" title="Rotate key (invalidates all your shares)" data-insider-key="${insiderKey}">🔑</button>
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
        <button id="theme-toggle" class="theme-toggle" onclick="toggleTheme()" title="Toggle dark/light theme">🌙</button>
      </div>
    </div>
  `;
}
