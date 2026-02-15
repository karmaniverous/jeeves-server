/**
 * Drive enumeration and listing for Windows
 */

import { execSync } from 'node:child_process';

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AccessMode } from '../../config/types.js';
import {
  renderHeader,
  renderShareScript,
  renderThemeScript,
} from '../../templates/layout.js';
import {
  renderHeaderStyles,
  renderThemeStyles,
} from '../../templates/styles.js';
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
  const linkKey = isInsider ? insiderKey : null;

  let rows = '';
  for (const drive of drives) {
    const drivePath = `${drive.letter}:\\`;
    const urlPath = `/${drive.letter.toLowerCase()}`;
    const key = linkKey || computePathKey(apiKey, urlPath);
    const labelText = drive.label ? ` (${drive.label})` : '';
    rows += `<tr><td>💾 <a href="/path${urlPath}?key=${key}">${drivePath}</a>${labelText}</td><td>Drive</td></tr>`;
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
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <title>Drives</title>
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
  </style>
</head>
<body>
  ${headerHtml}
  <div class="container">
    <table>
      <thead><tr><th>Drive</th><th>Type</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <script>
    ${renderShareScript(true)}
  </script>
</body>
</html>`;

  reply.type('text/html').send(html);
}
