/**
 * Markdown file rendering with TOC, path linking, and exports
 */

import fs from 'node:fs';
import path from 'node:path';

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AccessMode } from '../../config/types.js';
import { appendEvent } from '../../services/eventQueue.js';
import { type ExportFormat, exportPage } from '../../services/export.js';
import { generateTOC, parseMarkdown } from '../../services/markdown.js';
import { inlineSVGs } from '../../services/svg.js';
import {
  buildBreadcrumbs,
  renderHeader,
  renderShareScript,
  renderThemeScript,
} from '../../templates/layout.js';
import { renderThemeStyles } from '../../templates/styles.js';
import { computeInsiderKey, computePathKey } from '../../util/crypto.js';

/**
 * Handle markdown file rendering
 */
export async function handleMarkdown(
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
  apiKey: string,
  serverPort: number,
): Promise<void> {
  const markdown = fs.readFileSync(resolved, 'utf8');
  const fileName = path.basename(resolved);
  const fileDir = path.dirname(resolved);

  // Handle exports
  if (query.export === 'pdf' || query.export === 'docx') {
    const exportUrl = `http://localhost:${String(serverPort)}${request.url.split('?')[0]}?key=${query.key}&toc=${query.export === 'pdf' ? '1' : '0'}`;
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
  const insiderKey = computeInsiderKey(apiKey);
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
          const key = computePathKey(apiKey, urlPath.replace('/path', ''));
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
    apiKey,
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

function renderHeaderStyles(): string {
  return `
    .header {
      position: sticky;
      top: 0;
      background: var(--header-bg);
      border-bottom: 1px solid var(--border-color);
      padding: 0.5rem 1rem;
      font-size: 13px;
      z-index: 100;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
    }
    .header a { color: var(--link-color); text-decoration: none; }
    .header a:hover { text-decoration: underline; }
    .breadcrumb { flex: 1; display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); }
    .breadcrumb-sep { color: var(--text-tertiary); }
    .header-right { display: flex; align-items: center; gap: 1rem; font-size: 12px; }
    .header-actions { display: flex; gap: 0.75rem; }
    .theme-toggle { cursor: pointer; user-select: none; font-size: 18px; }
  `;
}
