/**
 * SVG file viewer handler
 */

import fs from 'node:fs';
import path from 'node:path';

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AccessMode } from '../../config/types.js';
import { buildBreadcrumbs, renderPageShell } from '../../templates/layout.js';
import { computeInsiderKey } from '../../util/crypto.js';

/**
 * Handle SVG file rendering
 */
export function handleSVGFile(
  request: FastifyRequest,
  reply: FastifyReply,
  resolved: string,
  reqPath: string,
  query: { key: string },
  apiKey: string,
): void {
  const svgContent = fs
    .readFileSync(resolved, 'utf8')
    .replace(/<svg([^>]*)\s+width="100%"/, '<svg$1')
    .replace(
      /<svg([^>]*)\s+style="[^"]*max-width:\s*[\d.]+px;?[^"]*"/,
      '<svg$1',
    );

  const fileName = path.basename(resolved);
  const breadcrumbs = buildBreadcrumbs(
    resolved,
    query.key,
    (request as { accessMode?: AccessMode }).accessMode!,
    computeInsiderKey(apiKey),
    (request as { shareRoot?: string | null }).shareRoot,
  );

  // SVG viewer has a custom dark-only design
  const pageStyles = `
    body { background: #1e1e1e !important; color: #ccc !important; }
    .header {
      background: #161b22;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #30363d;
      font-size: 13px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .header a { color: #58a6ff; text-decoration: none; }
    .header a:hover { text-decoration: underline; }
    .header .actions { font-size: 12px; color: #8b949e; }
    .svg-wrapper {
      padding: 1rem;
      overflow: auto;
      text-align: center;
    }
    .svg-wrapper svg {
      max-width: 100% !important;
      max-height: calc(100vh - 80px);
      width: auto !important;
      height: auto !important;
      background: #fff;
      border-radius: 4px;
      display: inline-block;
    }
  `;

  const bodyContent = `
  <div class="header">
    <div class="breadcrumb">${breadcrumbs}</div>
    <div class="actions"><a href="?${query.key ? `key=${query.key}&amp;` : ''}raw=1">View Raw</a></div>
  </div>
  <div class="svg-wrapper">
    ${svgContent}
  </div>
  `;

  const html = renderPageShell({
    title: fileName,
    headerHtml: '', // SVG viewer uses its own custom header in bodyContent
    bodyContent,
    pageStyles,
    shareScript: null, // No share UI for SVG viewer
  });

  reply.type('text/html').send(html);
}
