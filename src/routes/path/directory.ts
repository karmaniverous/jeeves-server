/**
 * Directory listing handler
 */

import fs from 'node:fs';
import path from 'node:path';

import type { FastifyReply, FastifyRequest } from 'fastify';

import { _pathMatchesScopes } from '../../auth/keys.js';
import { getConfig } from '../../config/index.js';
import type { AccessMode } from '../../config/types.js';
import {
  buildBreadcrumbs,
  renderHeader,
  renderShareScript,
  renderThemeScript,
} from '../../templates/layout.js';
import {
  renderHeaderStyles,
  renderThemeStyles,
} from '../../templates/styles.js';
import { computeInsiderKey, computePathKey } from '../../util/crypto.js';
import { DANGEROUS_EXTENSIONS } from '../../util/fileDetection.js';
import { formatSize } from '../../util/formatters.js';

/**
 * Handle directory listing
 */
export function handleDirectory(
  request: FastifyRequest,
  reply: FastifyReply,
  resolved: string,
  reqPath: string,
  query: { key: string; exp?: string },
  apiKey: string,
): void {
  const breadcrumbs = buildBreadcrumbs(
    resolved,
    query.key,
    (request as { accessMode?: AccessMode }).accessMode!,
    computeInsiderKey(apiKey),
    (request as { shareRoot?: string | null }).shareRoot,
  );
  const isInsider =
    (request as { accessMode?: AccessMode }).accessMode === 'insider';
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

  let rows = '';
  for (const entry of sorted) {
    const entryPath = path.join(resolved, entry.name);
    const entryUrlPath = `/${entryPath.replace(/\\/g, '/').replace(/^([A-Z]):/, (m: string, d: string) => d.toLowerCase())}`;
    const entryKey = isInsider
      ? insiderKey
      : computePathKey(apiKey, entryUrlPath);

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

    const ext = path.extname(entry.name).toLowerCase();
    const isDangerous = DANGEROUS_EXTENSIONS.includes(ext);
    const nameCell =
      isDangerous && !entry.isDirectory()
        ? `${entry.name} <span title="Executable file - not linked for security">⚠️</span>`
        : `<a href="/path${entryUrlPath}?key=${entryKey}">${entry.name}</a>`;

    const icon = entry.isDirectory() ? '📁' : '📄';
    rows += `<tr><td>${icon} ${nameCell}</td><td>${type}</td><td>${size}</td><td>${mtime}</td></tr>`;
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
    actions: [],
    eventInScope: (request as { eventInScope?: boolean }).eventInScope,
    keyAge: (request as { keyAge?: string | null }).keyAge,
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <title>${dirName}</title>
  <script>${renderThemeScript()}</script>
  <style>
    ${renderThemeStyles()}
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: var(--bg-tertiary); color: var(--text-primary); }
    ${renderHeaderStyles()}
    .container { padding: 1.5rem 2rem; }
    table { width: 100%; border-collapse: collapse; background: var(--bg-primary); border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid var(--border-color); }
    th { background: var(--table-header-bg); font-weight: 600; font-size: 13px; color: var(--text-secondary); }
    td { font-size: 14px; }
    tr:hover { background: var(--table-row-hover); }
    a { color: var(--link-color); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .count { color: var(--text-secondary); font-size: 13px; margin-bottom: 1rem; }
  </style>
</head>
<body>
  ${headerHtml}
  <div class="container">
    <div class="count">${String(entries.length)} items</div>
    <table>
      <thead><tr><th>Name</th><th>Type</th><th>Size</th><th>Modified</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <script>
    ${renderShareScript(isInsider)}
  </script>
</body>
</html>`;

  reply.type('text/html').send(html);
}
