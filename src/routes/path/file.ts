/**
 * Generic file handler (text with highlighting or binary)
 */

import fs from 'node:fs';
import path from 'node:path';

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AccessMode } from '../../config/types.js';
import { highlightCode } from '../../services/highlighting.js';
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
import { computeInsiderKey } from '../../util/crypto.js';
import {
  getContentType,
  isInlineType,
  looksLikeText,
} from '../../util/fileDetection.js';

/**
 * Handle generic file serving (text with highlighting or binary)
 */
export function handleGenericFile(
  request: FastifyRequest,
  reply: FastifyReply,
  resolved: string,
  reqPath: string,
  query: { key: string; raw?: string; exp?: string },
  apiKey: string,
): void {
  const ext = path.extname(resolved).toLowerCase();
  const content = fs.readFileSync(resolved);
  const isTextFile = looksLikeText(content);

  if (query.raw === '1' || !isTextFile) {
    // Serve as binary/raw
    const contentType = getContentType(ext);
    reply.header('Content-Type', contentType);

    if (!isInlineType(contentType)) {
      reply.header(
        'Content-Disposition',
        `attachment; filename="${path.basename(resolved)}"`,
      );
    }

    reply.send(content);
  } else {
    // Render with syntax highlighting
    const textContent = content.toString('utf8');
    const fileName = path.basename(resolved);
    const { highlighted, language } = highlightCode(textContent, ext);

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
    const currentPath = `/${reqPath}`;
    const expiry = query.exp ? parseInt(query.exp, 10) : null;

    const headerHtml = renderHeader({
      isInsider,
      breadcrumbs,
      fileName,
      queryKey: query.key,
      currentPath,
      insiderKey,
      expiry,
      actions: [],
      eventInScope: (request as { eventInScope?: boolean }).eventInScope,
      keyAge: (request as { keyAge?: string | null }).keyAge,
      hasRaw: true,
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <title>${fileName}</title>
  <script>${renderThemeScript()}</script>
  <link id="hljs-theme" rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
  <style>
    ${renderThemeStyles()}
    body {
      font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 13px;
      line-height: 1.5;
      margin: 0;
      padding: 0;
      background: var(--bg-primary);
      color: var(--text-primary);
    }
    pre { margin: 0; padding: 1rem; overflow-x: auto; background: var(--code-bg); }
    code { font-family: inherit; }
    ${renderHeaderStyles()}
  </style>
</head>
<body>
  ${headerHtml}
  <pre><code class="hljs${language ? ` language-${language}` : ''}">${highlighted}</code></pre>
  <script>
    ${renderShareScript(isInsider)}
    function updateHljsTheme() {
      const theme = document.documentElement.getAttribute('data-theme');
      const link = document.getElementById('hljs-theme');
      link.href = theme === 'dark' 
        ? 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css'
        : 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
    }
    updateHljsTheme();
    const origToggle = window.toggleTheme;
    window.toggleTheme = function() { origToggle(); updateHljsTheme(); };
  </script>
</body>
</html>`;

    reply.type('text/html').send(html);
  }
}
