/**
 * Path endpoint - file serving with markdown rendering, directory listings, etc.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

import { verifyKey } from '../auth/keys.js';
import { getConfig } from '../config/index.js';
import type { AccessMode } from '../config/types.js';
import { appendEvent } from '../services/eventQueue.js';
import { type ExportFormat, exportPage } from '../services/export.js';
import { highlightCode } from '../services/highlighting.js';
import { generateTOC, parseMarkdown } from '../services/markdown.js';
import { inlineSVGs } from '../services/svg.js';
import {
  buildBreadcrumbs,
  renderHeader,
  renderShareScript,
  renderThemeScript,
} from '../templates/layout.js';
import { renderHeaderStyles, renderThemeStyles } from '../templates/styles.js';
import { computeInsiderKey, computePathKey } from '../util/crypto.js';
import {
  DANGEROUS_EXTENSIONS,
  getContentType,
  isInlineType,
  looksLikeText,
} from '../util/fileDetection.js';
import { formatSize } from '../util/formatters.js';

interface DriveInfo {
  letter: string;
  label: string;
}

/**
 * Get list of Windows drives
 */
function getDrives(): DriveInfo[] {
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

// eslint-disable-next-line @typescript-eslint/require-await
export const pathRoute: FastifyPluginAsync = async (fastify) => {
  // Path authentication middleware
  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.url.startsWith('/path')) return;

    const urlPath = request.url.split('?')[0].replace('/path', '');
    const provided = (request.query as { key?: string }).key;
    const expParam = (request.query as { exp?: string }).exp;
    const config = getConfig();

    const authResult = verifyKey(config.apiKey, urlPath, provided, expParam);

    if (!authResult.valid) {
      appendEvent({ kind: 'auth_failed_path', ip: request.ip, path: urlPath });
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }

    (request as { accessMode?: AccessMode }).accessMode =
      authResult.mode ?? undefined;
  });

  // Root path: list all drives
  fastify.get('/path', async (request: FastifyRequest, reply) => {
    const drives = getDrives();
    const isInsider =
      (request as { accessMode?: AccessMode }).accessMode === 'insider';
    const config = getConfig();
    const insiderKey = computeInsiderKey(config.apiKey);
    const query = request.query as { key: string };
    const linkKey = isInsider ? insiderKey : null;

    let rows = '';
    for (const drive of drives) {
      const drivePath = `${drive.letter}:\\`;
      const urlPath = `/${drive.letter.toLowerCase()}`;
      const key = linkKey || computePathKey(config.apiKey, urlPath);
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
  });

  // File/directory serving
  fastify.get<{ Params: { '*': string } }>(
    '/path/*',
    async (request, reply) => {
      const reqPath = request.params['*'];
      if (!reqPath) {
        return reply.redirect('/path');
      }

      // Convert URL path to Windows path: d/foo/bar.md -> D:\foo\bar.md
      let filePath = reqPath;
      if (/^[a-zA-Z]$/.test(filePath)) {
        // Bare drive letter
        filePath = `${filePath.toUpperCase()}:\\`;
      } else if (/^[a-zA-Z]\//.test(filePath)) {
        filePath = `${filePath[0].toUpperCase()}:${filePath.slice(1)}`;
      }
      filePath = filePath.replace(/\//g, '\\');

      const resolved = path.resolve(filePath);
      appendEvent({
        kind: 'path_access',
        ip: request.ip,
        requested: reqPath,
        resolved,
      });

      if (!fs.existsSync(resolved)) {
        return reply
          .code(404)
          .send({ error: 'File not found', path: resolved });
      }

      const stats = fs.statSync(resolved);
      const query = request.query as {
        key: string;
        raw?: string;
        export?: string;
        exp?: string;
        toc?: string;
      };

      if (stats.isDirectory()) {
        handleDirectory(request, reply, resolved, reqPath, query);
        return;
      } else {
        return handleFile(request, reply, resolved, reqPath, query);
      }
    },
  );

  /**
   * Handle directory listing
   */
  function handleDirectory(
    request: FastifyRequest,
    reply: FastifyReply,
    resolved: string,
    reqPath: string,
    query: { key: string; exp?: string },
  ): void {
    const config = getConfig();
    const breadcrumbs = buildBreadcrumbs(
      resolved,
      config.apiKey,
      (request as { accessMode?: AccessMode }).accessMode!,
      computeInsiderKey(config.apiKey),
    );
    const isInsider =
      (request as { accessMode?: AccessMode }).accessMode === 'insider';
    const insiderKey = computeInsiderKey(config.apiKey);

    const entries = fs.readdirSync(resolved, { withFileTypes: true });

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
        : computePathKey(config.apiKey, entryUrlPath);

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

  /**
   * Handle file serving
   */
  async function handleFile(
    request: FastifyRequest,
    reply: FastifyReply,
    resolved: string,
    reqPath: string,
    query: {
      key: string;
      raw?: string;
      export?: string;
      exp?: string;
      toc?: string;
    },
  ): Promise<void> {
    const ext = path.extname(resolved).toLowerCase();

    if (ext === '.md') {
      return handleMarkdownFile(request, reply, resolved, reqPath, query);
    } else if (ext === '.svg' && query.raw !== '1') {
      handleSVGFile(request, reply, resolved, reqPath, query);
    } else {
      handleGenericFile(request, reply, resolved, reqPath, query);
    }
  }

  /**
   * Handle markdown file rendering
   */
  async function handleMarkdownFile(
    request: FastifyRequest,
    reply: FastifyReply,
    resolved: string,
    reqPath: string,
    query: {
      key: string;
      raw?: string;
      export?: string;
      exp?: string;
      toc?: string;
    },
  ): Promise<void> {
    const markdown = fs.readFileSync(resolved, 'utf8');
    const fileName = path.basename(resolved);
    const fileDir = path.dirname(resolved);
    const config = getConfig();

    // Handle exports
    if (query.export === 'pdf' || query.export === 'docx') {
      const exportUrl = `http://localhost:${String(config.port)}${request.url.split('?')[0]}?key=${query.key}&toc=${query.export === 'pdf' ? '1' : '0'}`;
      const baseName = fileName.replace(/\.md$/i, '');

      try {
        const buffer = await exportPage({
          url: exportUrl,
          fileName,
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
            `attachment; filename="${baseName}.${fileExt}"`,
          )
          .header('Content-Length', buffer.length)
          .send(buffer);
        return;
      } catch (err) {
        appendEvent({
          kind: `${query.export}_export_error`,
          error: String(err),
        });
        reply.code(500).send({
          error: `${query.export.toUpperCase()} export failed`,
          details: String(err),
        });
        return;
      }
    }

    // Raw download
    if (query.raw === '1') {
      reply
        .header('Content-Type', 'text/markdown; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="${fileName}"`)
        .send(markdown);
      return;
    }

    // Parse markdown
    const { html: htmlContent, headings } = parseMarkdown(markdown, {
      linkWindowsPaths: true,
    });

    // Post-process: fix relative links and inline SVGs
    const isInsider =
      (request as { accessMode?: AccessMode }).accessMode === 'insider';
    const insiderKey = computeInsiderKey(config.apiKey);
    let processedHtml = htmlContent;

    // Fix relative links
    processedHtml = processedHtml.replace(
      /(href|src)="([^"]+)"/g,
      (match: string, attr: string, url: string) => {
        if (
          url.startsWith('http://') ||
          url.startsWith('https://') ||
          url.startsWith('#') ||
          url.startsWith('//')
        ) {
          return match;
        }

        let urlPath: string;
        if (url.startsWith('/path/')) {
          urlPath = url.split('?')[0];
        } else {
          let targetPath: string;
          if (url.startsWith('/')) {
            targetPath = `D:${url}`;
          } else {
            targetPath = path.resolve(fileDir, url);
          }
          urlPath = `/path/${targetPath.replace(/\\/g, '/').replace(/^([A-Z]):/, (m: string, d: string) => d.toLowerCase())}`;
        }

        if (isInsider) {
          return `${attr}="${urlPath}?key=${insiderKey}"`;
        } else {
          if (attr === 'src') {
            const key = computePathKey(
              config.apiKey,
              urlPath.replace('/path', ''),
            );
            return `${attr}="${urlPath}?key=${key}"`;
          } else {
            return `${attr}="__STRIP_LINK__"`;
          }
        }
      },
    );

    // Strip internal links for outsiders
    if (!isInsider) {
      processedHtml = processedHtml.replace(
        /<a\s+href="__STRIP_LINK__"[^>]*>([^<]*)<\/a>/g,
        '$1',
      );
    }

    // Inline SVGs
    processedHtml = inlineSVGs(processedHtml, fileDir);

    // Generate TOC
    const showToc = query.toc !== '0' && headings.length > 0;
    const tocHtml = showToc ? generateTOC(headings) : '';

    const breadcrumbs = buildBreadcrumbs(
      resolved,
      config.apiKey,
      (request as { accessMode?: AccessMode }).accessMode!,
      insiderKey,
    );
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
      actions: [
        `<a href="?key=${query.key}&amp;export=pdf" title="Export as PDF">📄 PDF</a>`,
        `<a href="?key=${query.key}&amp;export=docx" title="Export as Word document">📝 DOCX</a>`,
      ],
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
    .no-toc .content { margin: 0 auto; }
    h1, h2, h3, h4, h5, h6 { color: var(--text-primary); margin-top: 1.5em; scroll-margin-top: 80px; }
    h1 { border-bottom: 2px solid var(--border-color); padding-bottom: 0.3em; }
    h2 { border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; }
    code { background: var(--code-bg); padding: 0.2em 0.4em; border-radius: 3px; font-family: 'SF Mono', Consolas, monospace; font-size: 0.9em; color: var(--text-primary); }
    pre { background: #282c34; color: #abb2bf; padding: 1rem; border-radius: 6px; overflow-x: auto; }
    pre code { background: none; color: inherit; padding: 0; }
    blockquote { border-left: 4px solid var(--border-color); margin: 1em 0; padding: 0.5em 1em; color: var(--text-muted); background: var(--bg-secondary); }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid var(--border-color); padding: 0.6em 1em; text-align: left; }
    th { background: var(--table-header-bg); }
    a { color: var(--link-color); text-decoration: none; }
    a:hover { text-decoration: underline; }
    a.anchor { color: var(--text-muted); margin-right: 0.3em; font-weight: normal; }
    a.anchor:hover { color: var(--link-color); }
    code a { color: inherit; text-decoration: underline; text-decoration-style: dotted; }
    code a:hover { text-decoration-style: solid; }
    hr { border: none; border-top: 1px solid var(--border-color); margin: 2em 0; }
    img { max-width: 100%; height: auto; }
    img.zoomable { cursor: zoom-in; }
    .svg-container { max-width: 100%; overflow: hidden; }
    .svg-container svg.inline-svg { max-width: 100%; height: auto; display: block; }
    .zoomable-svg { cursor: zoom-in; }
    .panzoom-container { 
      position: fixed; 
      top: 0; left: 0; right: 0; bottom: 0; 
      background: rgba(0,0,0,0.9); 
      z-index: 1000; 
      display: none;
      cursor: grab;
    }
    .panzoom-container.active { display: flex; align-items: center; justify-content: center; }
    .panzoom-container:active { cursor: grabbing; }
    .panzoom-container img { max-width: none; max-height: none; }
    .panzoom-svg-holder { display: none; width: 100%; height: 100%; overflow: hidden; }
    .panzoom-svg-holder .pz-svg-inner { display: block; background: #fff; position: relative; }
    .panzoom-svg-holder svg { display: block; background: #fff; }
    .panzoom-close { 
      position: fixed; 
      top: 20px; right: 20px; 
      color: #fff; 
      font-size: 32px; 
      cursor: pointer; 
      z-index: 1001;
      background: rgba(0,0,0,0.5);
      width: 44px; height: 44px;
      border-radius: 22px;
      display: flex; align-items: center; justify-content: center;
    }
    .panzoom-close:hover { background: rgba(255,255,255,0.2); }
    .panzoom-hint {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      color: #aaa;
      font-size: 13px;
      z-index: 1001;
    }
    ul, ol { padding-left: 2em; }
    li { margin: 0.25em 0; }
    @media (max-width: 900px) {
      .toc { display: none; }
      .content { padding: 1.5rem; }
    }
  </style>
</head>
<body>
  ${headerHtml}
  <div class="layout${showToc ? '' : ' no-toc'}">
    ${tocHtml}
    ${showToc ? '<div class="toc-spacer"></div>' : ''}
    <main class="content">
${processedHtml}
    </main>
  </div>
  <div class="panzoom-container" id="panzoom-overlay">
    <span class="panzoom-close" id="panzoom-close">×</span>
    <img id="panzoom-img" src="" alt="">
    <div id="panzoom-svg" class="panzoom-svg-holder"></div>
    <div class="panzoom-hint">Scroll to zoom • Drag to pan • Click or Esc to close</div>
  </div>
  <script src="https://unpkg.com/@panzoom/panzoom@4.5.1/dist/panzoom.min.js"></script>
  <script>
    // Panzoom setup (same as original)
    document.querySelectorAll('.content img').forEach(img => {
      const check = () => {
        if (img.naturalWidth > img.clientWidth || img.naturalHeight > img.clientHeight) {
          img.classList.add('zoomable');
          img.title = 'Click to zoom';
        }
      };
      if (img.complete) check();
      else img.onload = check;
    });

    document.querySelectorAll('.zoomable-svg').forEach(container => {
      container.title = 'Click to zoom (vector)';
    });

    const overlay = document.getElementById('panzoom-overlay');
    const pzImg = document.getElementById('panzoom-img');
    const pzSvgContainer = document.getElementById('panzoom-svg');
    const closeBtn = document.getElementById('panzoom-close');
    let pz = null;

    document.addEventListener('click', e => {
      if (e.target.classList.contains('zoomable')) {
        pzImg.src = e.target.src;
        pzImg.style.display = 'block';
        pzSvgContainer.style.display = 'none';
        overlay.classList.add('active');
        pz = Panzoom(pzImg, { maxScale: 10, contain: 'outside' });
        pzImg.parentElement.addEventListener('wheel', pz.zoomWithWheel);
        return;
      }
      
      const svgContainer = e.target.closest('.zoomable-svg');
      if (svgContainer) {
        const svg = svgContainer.querySelector('svg');
        if (svg) {
          pzSvgContainer.innerHTML = '<div class="pz-svg-inner">' + svg.outerHTML + '</div>';
          pzSvgContainer.style.display = 'flex';
          pzImg.style.display = 'none';
          overlay.classList.add('active');
          const inner = pzSvgContainer.querySelector('.pz-svg-inner');
          const clonedSvg = inner.querySelector('svg');
          clonedSvg.removeAttribute('style');
          clonedSvg.removeAttribute('width');
          clonedSvg.removeAttribute('height');
          const vb = clonedSvg.getAttribute('viewBox');
          const maxW = window.innerWidth * 0.9;
          const maxH = window.innerHeight * 0.85;
          const containerW = window.innerWidth;
          const containerH = window.innerHeight;
          let innerW = maxW, innerH = maxH;
          if (vb) {
            const parts = vb.split(/[\\s,]+/).map(Number);
            const svgW = parts[2], svgH = parts[3];
            const scale = Math.min(maxW / svgW, maxH / svgH);
            innerW = svgW * scale;
            innerH = svgH * scale;
          }
          inner.style.width = innerW + 'px';
          inner.style.height = innerH + 'px';
          inner.style.marginLeft = ((containerW - innerW) / 2) + 'px';
          inner.style.marginTop = ((containerH - innerH) / 2) + 'px';
          clonedSvg.style.width = '100%';
          clonedSvg.style.height = '100%';
          pz = Panzoom(inner, { maxScale: 20, overflow: 'visible' });
          pz.reset({ animate: false });
          inner.addEventListener('wheel', pz.zoomWithWheel);
        }
      }
    });

    function closePanzoom() {
      overlay.classList.remove('active');
      if (pz) { pz.destroy(); pz = null; }
      pzImg.src = '';
      pzImg.style.display = 'block';
      pzSvgContainer.innerHTML = '';
      pzSvgContainer.style.display = 'none';
    }

    closeBtn.addEventListener('click', closePanzoom);
    overlay.addEventListener('click', e => { if (e.target === overlay || e.target === pzSvgContainer) closePanzoom(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay.classList.contains('active')) closePanzoom(); });

    ${renderShareScript(isInsider)}
  </script>
</body>
</html>`;

    reply.type('text/html').send(html);
  }

  /**
   * Handle SVG file rendering
   */
  function handleSVGFile(
    request: FastifyRequest,
    reply: FastifyReply,
    resolved: string,
    reqPath: string,
    query: { key: string },
  ): void {
    const svgContent = fs
      .readFileSync(resolved, 'utf8')
      .replace(/<svg([^>]*)\s+width="100%"/, '<svg$1')
      .replace(
        /<svg([^>]*)\s+style="[^"]*max-width:\s*[\d.]+px;?[^"]*"/,
        '<svg$1',
      );

    const fileName = path.basename(resolved);
    const config = getConfig();
    const breadcrumbs = buildBreadcrumbs(
      resolved,
      config.apiKey,
      (request as { accessMode?: AccessMode }).accessMode!,
      computeInsiderKey(config.apiKey),
    );

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>${fileName}</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #1e1e1e; color: #ccc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
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
  </style>
</head>
<body>
  <div class="header">
    <div class="breadcrumb">${breadcrumbs}</div>
    <div class="actions"><a href="?key=${query.key}&amp;raw=1">View Raw</a></div>
  </div>
  <div class="svg-wrapper">
    ${svgContent}
  </div>
</body>
</html>`;

    reply.type('text/html').send(html);
  }

  /**
   * Handle generic file serving (text with highlighting or binary)
   */
  function handleGenericFile(
    request: FastifyRequest,
    reply: FastifyReply,
    resolved: string,
    reqPath: string,
    query: { key: string; raw?: string; exp?: string },
  ): void {
    const ext = path.extname(resolved).toLowerCase();
    const content = fs.readFileSync(resolved);
    const isTextFile = looksLikeText(content);
    const config = getConfig();

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
        config.apiKey,
        (request as { accessMode?: AccessMode }).accessMode!,
        computeInsiderKey(config.apiKey),
      );
      const isInsider =
        (request as { accessMode?: AccessMode }).accessMode === 'insider';
      const insiderKey = computeInsiderKey(config.apiKey);
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
};
