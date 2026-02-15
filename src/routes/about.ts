/**
 * About page endpoint
 */

import fs from 'node:fs';
import path from 'node:path';

import type { FastifyPluginAsync } from 'fastify';

import { getConfig } from '../config/index.js';
import { type ExportFormat, exportPage } from '../services/export.js';
import { generateTOC, parseMarkdown } from '../services/markdown.js';
import { renderThemeScript } from '../templates/layout.js';
import { renderHeaderStyles, renderThemeStyles } from '../templates/styles.js';
import { computeInsiderKey } from '../util/crypto.js';
import { formatRelativeTime } from '../util/formatters.js';
import { getKeyRotationTimestamp } from '../util/state.js';

// eslint-disable-next-line @typescript-eslint/require-await
export const aboutRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/about', async (request, reply) => {
    const query = request.query as {
      key?: string;
      raw?: string;
      export?: string;
    };
    const config = getConfig();

    // Determine if insider (no auth required for about page, but features enabled if key provided)
    const queryKey = query.key || '';
    let isInsider = false;
    let insiderKey = '';

    // Check if provided key matches any seed's insider key
    for (const rk of config.resolvedKeys) {
      const seedInsiderKey = computeInsiderKey(rk.seed);
      if (queryKey && queryKey === seedInsiderKey) {
        isInsider = true;
        insiderKey = seedInsiderKey;
        break;
      }
      // Use the first seed's insider key for links (if not authenticated)
      if (!insiderKey) {
        insiderKey = seedInsiderKey;
      }
    }

    // Find about.md in the server directory (E:\jeeves-server or E:\dev\karmaniverous\jeeves-server)
    const aboutPath = path.join(process.cwd(), 'about.md');
    if (!fs.existsSync(aboutPath)) {
      return reply.code(404).send('About page not found');
    }

    const markdown = fs.readFileSync(aboutPath, 'utf8');

    // Raw download
    if (query.raw === '1') {
      reply
        .header('Content-Type', 'text/markdown; charset=utf-8')
        .header('Content-Disposition', 'attachment; filename="about.md"')
        .send(markdown);
      return;
    }

    // Handle exports
    if (query.export === 'pdf' || query.export === 'docx') {
      const exportUrl = `http://localhost:${String(config.port)}/about`;
      try {
        const buffer = await exportPage({
          url: exportUrl,
          fileName: 'about.md',
          format: query.export as ExportFormat,
        });

        const contentType =
          query.export === 'pdf'
            ? 'application/pdf'
            : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        const fileExt = query.export === 'pdf' ? 'pdf' : 'docx';

        reply
          .header('Content-Type', contentType)
          .header(
            'Content-Disposition',
            `attachment; filename="about.${fileExt}"`,
          )
          .header('Content-Length', buffer.length)
          .send(buffer);
        return;
      } catch (err) {
        reply.code(500).send({
          error: `${query.export.toUpperCase()} export failed`,
          details: String(err),
        });
        return;
      }
    }

    // Parse markdown
    const { html: htmlContent, headings } = parseMarkdown(markdown);

    // Generate TOC
    const tocHtml = generateTOC(headings);

    // Build header
    const breadcrumbHtml = isInsider
      ? `<a href="/path?key=${insiderKey}" class="home-icon" title="Jeeves Server">🎩</a> About`
      : '<span class="home-icon" title="Jeeves Server">🎩</span> About';

    let headerActions = '';
    if (isInsider) {
      const rotationTs = getKeyRotationTimestamp();
      const rotationAge = formatRelativeTime(rotationTs);
      const ageHtml = rotationAge
        ? `<span class="key-rotation-age">${rotationAge}</span>`
        : '';
      headerActions = `
        <div class="info-btn-group">
          <a href="/about?key=${insiderKey}" class="theme-toggle" title="About Jeeves Server" style="text-decoration:none;font-weight:bold;">?</a>
        </div>
        <div class="key-rotation-group">
          <button id="rotate-key-btn" class="theme-toggle" title="Rotate API Key" data-insider-key="${insiderKey}">🔑</button>
          ${ageHtml}
        </div>
      `;
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <title>About — Jeeves Server</title>
  <script>${renderThemeScript()}</script>
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
    .layout { display: flex; min-height: calc(100vh - 42px); }
    .toc {
      width: 260px;
      flex-shrink: 0;
      background: var(--bg-secondary);
      border-right: 1px solid var(--border-color);
      padding: 1.5rem 1rem;
      position: fixed;
      top: 42px;
      left: 0;
      height: calc(100vh - 42px);
      overflow-y: auto;
    }
    .toc-title { font-weight: 600; margin-bottom: 0.8em; padding-top: 1rem; color: var(--text-primary); }
    .toc ul { margin: 0; padding-left: 0; list-style: none; }
    .toc li { margin: 0.4em 0; font-size: 0.9em; }
    .toc a { color: var(--text-secondary); }
    .toc a:hover { color: var(--link-color); }
    .toc-spacer { width: 260px; flex-shrink: 0; }
    .content {
      flex: 1;
      max-width: 900px;
      padding: 2rem 3rem;
    }
    h1, h2, h3, h4, h5, h6 { color: var(--text-primary); margin-top: 1.5em; scroll-margin-top: 80px; }
    h1 { border-bottom: 2px solid var(--border-color); padding-bottom: 0.3em; }
    h2 { border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; }
    code { background: var(--code-bg); padding: 0.2em 0.4em; border-radius: 3px; font-family: 'SF Mono', Consolas, monospace; font-size: 0.9em; color: var(--text-primary); }
    pre { background: #282c34; color: #abb2bf; padding: 1rem; border-radius: 6px; overflow-x: auto; }
    pre code { background: none; color: inherit; padding: 0; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid var(--border-color); padding: 0.6em 1em; text-align: left; }
    th { background: var(--table-header-bg); }
    a { color: var(--link-color); text-decoration: none; }
    a:hover { text-decoration: underline; }
    a.anchor { color: var(--text-muted); margin-right: 0.3em; font-weight: normal; }
    a.anchor:hover { color: var(--link-color); }
    hr { border: none; border-top: 1px solid var(--border-color); margin: 2em 0; }
    @media (max-width: 900px) {
      .toc { display: none; }
      .content { padding: 1.5rem; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="breadcrumb">${breadcrumbHtml}</div>
    <div class="header-actions">
      ${headerActions}
      <a href="/about${isInsider ? `?key=${insiderKey}&` : '?'}raw=1" download="about.md" title="Download raw file">⬇ Raw</a>
      <a href="/about${isInsider ? `?key=${insiderKey}&` : '?'}export=pdf" title="Export as PDF">📄 PDF</a>
      <a href="/about${isInsider ? `?key=${insiderKey}&` : '?'}export=docx" title="Export as Word document">📝 DOCX</a>
      <button id="theme-toggle" class="theme-toggle" onclick="toggleTheme()" title="Toggle dark/light theme">🌙</button>
    </div>
  </div>
  <div class="layout">
    ${tocHtml}
    <div class="toc-spacer"></div>
    <main class="content">
${htmlContent}
    </main>
  </div>
  ${
    isInsider
      ? `<script>
    document.getElementById('rotate-key-btn')?.addEventListener('click', async function() {
      if (!confirm('⚠️ Rotate API Key?\\n\\nThis will INVALIDATE all existing links and shares.\\n\\nYou will be redirected to the new insider link for this page.')) return;
      const insiderKey = this.getAttribute('data-insider-key');
      try {
        const res = await fetch('/rotate-key?key=' + insiderKey, { method: 'POST' });
        const data = await res.json();
        if (data.ok && data.insiderKey) {
          window.location.href = '/about?key=' + data.insiderKey;
        } else {
          alert('Rotation failed: ' + (data.error || 'Unknown error'));
        }
      } catch (e) {
        alert('Rotation failed: ' + e.message);
      }
    });
  </script>`
      : ''
  }
</body>
</html>`;

    reply.type('text/html').send(html);
  });
};
