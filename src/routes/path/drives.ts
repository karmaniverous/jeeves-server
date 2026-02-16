/**
 * Drive enumeration and listing for Windows
 */

import { execSync } from 'node:child_process';

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AccessMode } from '../../config/types.js';
import {
  renderHeader,
  renderPageShell,
} from '../../templates/layout.js';
import { computeInsiderKey, computePathKey } from '../../util/crypto.js';

export interface DriveInfo {
  letter: string;
  label: string;
}

/**
 * Get list of Windows drives
 */
export function getDrives(): DriveInfo[] {
  try {
    const output = execSync('wmic logicaldisk get name,volumename', {
      encoding: 'utf8',
    });
    const lines = output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line);

    // Skip header line, parse "C:  VolumeName" format
    const drives: DriveInfo[] = [];
    for (const line of lines.slice(1)) {
      const match = line.match(/^([A-Z]:)\s*(.*)?$/);
      if (match) {
        drives.push({
          letter: match[1].replace(':', ''),
          label: (match[2] || '').trim(),
        });
      }
    }
    return drives;
  } catch {
    // Fallback
    return [
      { letter: 'C', label: '' },
      { letter: 'D', label: '' },
      { letter: 'E', label: '' },
    ];
  }
}

/**
 * Render drive listing HTML
 */
export function renderDriveListing(
  request: FastifyRequest,
  reply: FastifyReply,
  apiKey: string,
): void {
  const drives = getDrives();
  const isInsider =
    (request as { accessMode?: AccessMode }).accessMode === 'insider';
  const insiderKey = computeInsiderKey(apiKey);
  const query = request.query as { key: string };
  let rows = '';
  for (const drive of drives) {
    const drivePath = `${drive.letter}:\\`;
    const urlPath = `/${drive.letter.toLowerCase()}`;
    const labelText = drive.label ? ` (${drive.label})` : '';

    let shareCell = '';
    if (isInsider) {
      shareCell = `<td class="share-cell"><button class="share-icon" data-path="${urlPath}" data-type="page" title="Copy page link">🔗</button></td>`;
      rows += `<tr><td>💾 <a href="/path${urlPath}">${drivePath}</a>${labelText}</td><td>Drive</td>${shareCell}</tr>`;
    } else {
      const key = computePathKey(apiKey, urlPath);
      rows += `<tr><td>💾 <a href="/path${urlPath}?key=${key}">${drivePath}</a>${labelText}</td><td>Drive</td></tr>`;
    }
  }

  const headerHtml = renderHeader({
    isInsider: true,
    breadcrumbs: '<span class="home-icon" title="Jeeves Server">🎩</span>',
    fileName: null,
    queryKey: query.key,
    currentPath: '/',
    insiderKey,
    showRaw: false,
    actions: [],
    eventInScope: (request as { eventInScope?: boolean }).eventInScope,
    keyAge: (request as { keyAge?: string | null }).keyAge,
  });

  const pageStyles = `
    .container { padding: 1.5rem 2rem; }
    table { width: 100%; border-collapse: collapse; background: var(--bg-primary); border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid var(--border-color); }
    th { background: var(--table-header-bg); font-weight: 600; font-size: 13px; color: var(--text-secondary); }
    td { font-size: 14px; }
    tr:hover { background: var(--table-row-hover); }
    a { color: var(--link-color); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .share-cell { white-space: nowrap; text-align: center; }
    .share-icon { background: none; border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; padding: 2px 6px; margin: 0 2px; font-size: 13px; color: var(--text-secondary); transition: border-color 0.2s; }
    .share-icon:hover { border-color: var(--link-color); }
    .share-icon.copied { border-color: #3fb950; }
    .share-expiry-select { padding: 2px 4px; font-size: 11px; border: 1px solid var(--border-color); border-radius: 3px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer; }
  `;

  const bodyContent = `
  <div class="container">
    <table>
      <thead><tr><th>Drive</th><th>Type</th>${isInsider ? `<th>Share <select id="dir-share-expiry" class="share-expiry-select" title="Link expiry"><option value="">never</option><option value="1h">1h</option><option value="1d">1d</option><option value="7d">1w</option><option value="30d">1m</option><option value="365d">1y</option></select></th>` : ''}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  `;

  const pageScripts = isInsider ? renderDriveShareScript(insiderKey) : '';

  const html = renderPageShell({
    title: 'Drives',
    headerHtml,
    bodyContent,
    pageStyles,
    pageScripts,
    shareScript: { isInsider: true },
  });

  reply.type('text/html').send(html);
}

/**
 * Client-side JS for per-row share icon buttons on drive listing
 */
function renderDriveShareScript(insiderKey: string): string {
  return `
    (function() {
      const expirySelect = document.getElementById('dir-share-expiry');
      const savedExpiry = localStorage.getItem('jeeves-dir-share-expiry') || '';
      if (expirySelect && savedExpiry) expirySelect.value = savedExpiry;
      if (expirySelect) expirySelect.addEventListener('change', () => localStorage.setItem('jeeves-dir-share-expiry', expirySelect.value));

      function parseExpiry() {
        if (!expirySelect) return '';
        const val = expirySelect.value;
        if (!val) return '';
        const match = val.match(/^(\\d+)([mhd])$/i);
        if (!match) return '';
        const num = parseInt(match[1], 10);
        const unit = match[2].toLowerCase();
        const multiplier = { m: 60*1000, h: 60*60*1000, d: 24*60*60*1000 }[unit];
        return '&exp=' + (Date.now() + num * multiplier);
      }

      document.querySelectorAll('.share-icon').forEach(btn => {
        btn.addEventListener('click', async function() {
          const expParam = parseExpiry();
          if (expParam === null) return;
          const targetPath = this.dataset.path;
          const insiderKey = '${insiderKey}';
          try {
            const resp = await fetch('/share?path=' + encodeURIComponent(targetPath) + '&key=' + insiderKey + expParam);
            const data = await resp.json();
            if (data.url) {
              const fullUrl = window.location.origin + data.url;
              await navigator.clipboard.writeText(fullUrl);
              this.classList.add('copied');
              const orig = this.textContent;
              this.textContent = '✓';
              setTimeout(() => { this.textContent = orig; this.classList.remove('copied'); }, 1500);
            }
          } catch (err) { console.error('Share failed:', err); }
        });
      });
    })();
  `;
}
