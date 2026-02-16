/**
 * Directory listing handler
 */

import fs from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';

import type { FastifyReply, FastifyRequest } from 'fastify';

import { _pathMatchesScopes } from '../../auth/keys.js';
import { getConfig } from '../../config/index.js';
import type { AccessMode } from '../../config/types.js';
import {
  buildBreadcrumbs,
  renderHeader,
  renderPageShell,
} from '../../templates/layout.js';
import { computeInsiderKey, computePathKey } from '../../util/crypto.js';
import { formatSize } from '../../util/formatters.js';

/**
 * Recursively calculate total size of a directory in bytes
 */
function getDirSize(dirPath: string): number {
  let totalSize = 0;
  
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      try {
        if (entry.isDirectory()) {
          totalSize += getDirSize(entryPath);
        } else {
          const stats = fs.statSync(entryPath);
          totalSize += stats.size;
        }
      } catch {
        // Skip inaccessible entries
      }
    }
  } catch {
    // Skip inaccessible directories
  }
  
  return totalSize;
}

/**
 * Handle directory listing
 */
export function handleDirectory(
  request: FastifyRequest,
  reply: FastifyReply,
  resolved: string,
  reqPath: string,
  query: { key: string; exp?: string; export?: string },
  apiKey: string,
): void {
  const isInsider =
    (request as { accessMode?: AccessMode }).accessMode === 'insider';

  // Handle ZIP export
  if (query.export === 'zip' && isInsider) {
    const config = getConfig();
    const totalSize = getDirSize(resolved);
    const maxSizeBytes = config.maxZipSizeMb * 1024 * 1024;
    
    if (totalSize > maxSizeBytes) {
      reply.code(413).send({
        error: `Directory too large for ZIP export (${Math.round(totalSize / 1024 / 1024)}MB, max ${config.maxZipSizeMb}MB)`,
      });
      return;
    }
    
    const dirName = path.basename(resolved);
    const archive = archiver('zip', { zlib: { level: 6 } });
    
    reply.header('Content-Type', 'application/zip');
    reply.header('Content-Disposition', `attachment; filename="${dirName}.zip"`);
    reply.send(archive);
    
    archive.directory(resolved, dirName);
    void archive.finalize();
    return;
  }

  const breadcrumbs = buildBreadcrumbs(
    resolved,
    query.key,
    (request as { accessMode?: AccessMode }).accessMode!,
    computeInsiderKey(apiKey),
    (request as { shareRoot?: string | null }).shareRoot,
  );
  const insiderKey = computeInsiderKey(apiKey);

  const allEntries = fs.readdirSync(resolved, { withFileTypes: true });

  // Filter by insider scopes if session-based auth
  const insiderEmail = (request as { insiderEmail?: string }).insiderEmail;
  const config = getConfig();
  const insiderScopes = insiderEmail
    ? (config.resolvedInsiders.find(
        (i) => i.email.toLowerCase() === insiderEmail.toLowerCase(),
      )?.scopes ?? null)
    : null;

  const entries = insiderScopes
    ? allEntries.filter((entry) => {
        const entryPath = path.join(resolved, entry.name);
        const entryUrlPath = `/${entryPath.replace(/\\/g, '/').replace(/^([A-Z]):/, (_m: string, d: string) => d.toLowerCase())}`;
        // For directories, check if any scoped path starts with this dir
        if (entry.isDirectory()) {
          return insiderScopes.some((scope) => {
            const s = scope.toLowerCase().replace(/\/+$/, '');
            const p = entryUrlPath.toLowerCase();
            return (
              p.startsWith(s.replace(/\/\*$/, '')) ||
              s.replace(/\/\*$/, '').startsWith(p)
            );
          });
        }
        return _pathMatchesScopes(entryUrlPath, insiderScopes);
      })
    : allEntries;

  // Sort: directories first, then files, alphabetically
  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  // Extensions that render a page view (not just raw file serving)
  const pageExtensions = new Set([
    '.md',
    '.svg',
    '.txt',
    '.json',
    '.yaml',
    '.yml',
    '.html',
    '.css',
    '.js',
    '.ts',
    '.xml',
    '.csv',
    '.jsonl',
    '.log',
    '.mmd',
    '.ps1',
    '.bat',
    '.cmd',
    '.sh',
    '.py',
    '.rb',
    '.go',
    '.rs',
    '.java',
    '.c',
    '.cpp',
    '.h',
    '.hpp',
  ]);

  let rows = '';
  for (const entry of sorted) {
    const entryPath = path.join(resolved, entry.name);
    const entryUrlPath = `/${entryPath.replace(/\\/g, '/').replace(/^([A-Z]):/, (m: string, d: string) => d.toLowerCase())}`;
    const entryKey = isInsider ? null : computePathKey(apiKey, entryUrlPath);

    let type: string;
    let size: string;
    let mtime: string;
    try {
      const entryStats = fs.statSync(entryPath);
      mtime = entryStats.mtime.toISOString().split('T')[0];
      if (entry.isDirectory()) {
        type = 'Directory';
        size = '-';
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        type = ext ? ext.slice(1).toUpperCase() : 'File';
        size = formatSize(entryStats.size);
      }
    } catch {
      type = '?';
      size = '-';
      mtime = '-';
    }

    const nameCell = entryKey
      ? `<a href="/path${entryUrlPath}?key=${entryKey}">${entry.name}</a>`
      : `<a href="/path${entryUrlPath}">${entry.name}</a>`;

    const icon = entry.isDirectory() ? '📁' : '📄';

    // Share icons for insiders
    let shareCell = '';
    if (isInsider) {
      const ext = path.extname(entry.name).toLowerCase();
      const hasPage = entry.isDirectory() || pageExtensions.has(ext);
      const hasRaw = !entry.isDirectory();

      const pageBtn = hasPage
        ? `<button class="share-icon" data-path="${entryUrlPath}" data-type="page" title="Copy page link">🔗</button>`
        : '';
      const rawBtn = hasRaw
        ? `<button class="share-icon" data-path="${entryUrlPath}" data-type="raw" title="Copy raw link">⬇</button>`
        : '';

      shareCell = `<td class="share-cell">${pageBtn}${rawBtn}</td>`;
    }

    rows += `<tr><td>${icon} ${nameCell}</td><td>${type}</td><td>${size}</td><td>${mtime}</td>${shareCell}</tr>`;
  }

  const dirName = path.basename(resolved) || resolved;
  const currentPath = `/${reqPath}`;
  const expiry = query.exp ? parseInt(query.exp, 10) : null;

  const headerHtml = renderHeader({
    isInsider,
    breadcrumbs,
    fileName: null,
    queryKey: query.key,
    currentPath,
    insiderKey,
    expiry,
    showRaw: false,
    actions: isInsider ? [
      `<button class="export-btn" data-format="zip" data-lucide-icon="cloud-download" data-url="?export=zip" title="Download as ZIP"><span class="export-icon"><i data-lucide="cloud-download"></i></span> ZIP</button>`,
    ] : [],
    eventInScope: (request as { eventInScope?: boolean }).eventInScope,
    keyAge: (request as { keyAge?: string | null }).keyAge,
    showShareUi: true,
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
    .count { color: var(--text-secondary); font-size: 13px; margin-bottom: 1rem; }
    .share-cell { white-space: nowrap; text-align: center; }
    .share-icon { background: none; border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; padding: 2px 6px; margin: 0 2px; font-size: 13px; color: var(--text-secondary); transition: border-color 0.2s; }
    .share-icon:hover { border-color: var(--link-color); }
    .share-icon.copied { border-color: #3fb950; }
    .share-expiry-select { padding: 2px 4px; font-size: 11px; border: 1px solid var(--border-color); border-radius: 3px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer; }
  `;

  const bodyContent = `
  <div class="container">
    <div class="count">${String(entries.length)} items</div>
    <table>
      <thead><tr><th>Name</th><th>Type</th><th>Size</th><th>Modified</th>${isInsider ? `<th>Share <select id="dir-share-expiry" class="share-expiry-select" title="Link expiry"><option value="">never</option><option value="1h">1h</option><option value="1d">1d</option><option value="7d">1w</option><option value="30d">1m</option><option value="365d">1y</option></select></th>` : ''}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  `;

  const pageScripts = isInsider ? renderDirectoryShareScript(insiderKey) : '';

  const html = renderPageShell({
    title: dirName,
    headerHtml,
    bodyContent,
    pageStyles,
    pageScripts,
    shareScript: { isInsider },
  });

  reply.type('text/html').send(html);
}

/**
 * Client-side JS for per-row share icon buttons in directory listings
 */
function renderDirectoryShareScript(insiderKey: string): string {
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
          const linkType = this.dataset.type;
          const insiderKey = '${insiderKey}';

          try {
            const resp = await fetch('/share?path=' + encodeURIComponent(targetPath) + '&key=' + insiderKey + expParam);
            const data = await resp.json();
            if (data.url) {
              let fullUrl = window.location.origin + data.url;
              if (linkType === 'raw') fullUrl += (fullUrl.includes('?') ? '&' : '?') + 'raw=1';
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
