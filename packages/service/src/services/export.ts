/**
 * Export service for PDF and DOCX generation.
 *
 * Orchestrates Puppeteer page loading, print styling, and format-specific
 * export logic. Heavy lifting delegated to puppeteer.ts utilities.
 */

import HtmlToDocx from '@turbodocx/html-to-docx';

import {
  addPrintStyles,
  captureSvgsAsPng,
  launchBrowser,
  setupAuthInterception,
  SVG_CONTAINER_SELECTORS,
  waitForSpaContent,
} from './puppeteer.js';

export type ExportFormat = 'pdf' | 'docx';

interface ExportOptions {
  url: string;
  fileName: string;
  format: ExportFormat;
  /** Internal auth key appended to `/api/raw/` sub-resource requests. */
  authKey?: string;
}

// Max bounds for images in DOCX (6 inches × 8 inches at 96dpi)
const MAX_WIDTH_PX = 576;
const MAX_HEIGHT_PX = 768;

/**
 * Export page as PDF.
 */
async function exportPDF(options: ExportOptions): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    if (options.authKey) {
      await setupAuthInterception(page, options.authKey);
    }
    await page.goto(options.url, { waitUntil: 'networkidle0' });
    await waitForSpaContent(page);
    await addPrintStyles(page);

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
      printBackground: true,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

/**
 * Export page as DOCX.
 */
async function exportDOCX(options: ExportOptions): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    if (options.authKey) {
      await setupAuthInterception(page, options.authKey);
    }
    await page.setViewport({ width: 1200, height: 800 });
    await page.goto(options.url, { waitUntil: 'networkidle0' });
    await waitForSpaContent(page);
    await addPrintStyles(page);

    // Capture SVGs as PNGs for DOCX embedding
    const svgPngDataUrls = await captureSvgsAsPng(browser, page);

    // Get processed HTML with SVGs replaced by PNGs
    const processedHtml = await page.evaluate(
      (
        pngUrls: typeof svgPngDataUrls,
        maxW: number,
        maxH: number,
        selectors: string,
      ) => {
        function calcScaled(
          origW: number,
          origH: number,
        ): { width: number; height: number } {
          let w = origW,
            h = origH;
          if (w > maxW) {
            const s = maxW / w;
            w = maxW;
            h = Math.round(h * s);
          }
          if (h > maxH) {
            const s = maxH / h;
            h = maxH;
            w = Math.round(w * s);
          }
          return { width: w, height: h };
        }

        const content =
          document.querySelector('article.prose') ??
          document.querySelector('.content');
        if (!content) return '<p>No content</p>';

        const contentClone = content.cloneNode(true) as HTMLElement;
        contentClone.querySelectorAll('a.anchor').forEach((el) => {
          el.remove();
        });

        // Replace SVG containers with PNG images
        const svgContainers = contentClone.querySelectorAll(selectors);
        svgContainers.forEach((container, i) => {
          const pngInfo = pngUrls.find((p) => p.index === i);
          if (pngInfo) {
            const img = document.createElement('img');
            img.src = pngInfo.dataUrl;
            img.alt = 'Diagram';
            const dims = calcScaled(pngInfo.width, pngInfo.height);
            img.setAttribute('width', String(dims.width));
            img.setAttribute('height', String(dims.height));
            container.replaceWith(img);
          } else {
            const p = document.createElement('p');
            p.textContent = '[Diagram]';
            p.style.fontStyle = 'italic';
            container.replaceWith(p);
          }
        });

        // Fix image URLs and set explicit dimensions
        contentClone.querySelectorAll('img').forEach((img) => {
          if (img.src && !img.src.startsWith('data:')) {
            img.src = new URL(img.src, window.location.origin).href;
          }
          const origW = img.naturalWidth || img.width || 400;
          const origH = img.naturalHeight || img.height || 300;
          const dims = calcScaled(origW, origH);
          img.setAttribute('width', String(dims.width));
          img.setAttribute('height', String(dims.height));
          img.style.maxWidth = '';
          img.style.maxHeight = '';
        });

        // Inline styles for tables
        contentClone.querySelectorAll('table').forEach((t) => {
          t.setAttribute('border', '1');
          (t as HTMLElement).style.borderCollapse = 'collapse';
          (t as HTMLElement).style.width = '100%';
        });
        contentClone.querySelectorAll('th').forEach((th) => {
          (th as HTMLElement).style.backgroundColor = '#f0f0f0';
          (th as HTMLElement).style.fontWeight = 'bold';
          (th as HTMLElement).style.padding = '8px';
          (th as HTMLElement).style.border = '1px solid #999';
        });
        contentClone.querySelectorAll('td').forEach((td) => {
          (td as HTMLElement).style.padding = '8px';
          (td as HTMLElement).style.border = '1px solid #999';
        });

        // Inline styles for code blocks — wrap in single-cell table for
        // consistent block background in DOCX (html-to-docx doesn't support
        // background-color on pre as a block fill)
        contentClone.querySelectorAll('pre').forEach((pre) => {
          const text = pre.textContent || '';
          const table = document.createElement('table');
          table.setAttribute('border', '1');
          table.style.borderCollapse = 'collapse';
          table.style.width = '100%';
          table.style.marginTop = '8px';
          table.style.marginBottom = '8px';
          const tr = document.createElement('tr');
          const td = document.createElement('td');
          td.style.backgroundColor = '#f5f5f5';
          td.style.border = '1px solid #ddd';
          td.style.padding = '12px';
          // Build one <p> per line with monospace styling and &nbsp; for
          // indentation. html-to-docx converts each <p> to a Word paragraph
          // cleanly, without the double-spacing that <br> causes.
          const lines = text.split('\n');
          lines.forEach((line) => {
            const p = document.createElement('p');
            p.style.fontFamily = 'Consolas, monospace';
            p.style.fontSize = '9pt';
            p.style.margin = '0';
            p.style.lineHeight = '1.3';
            // Preserve leading whitespace with &nbsp;
            const leadingSpaces = line.match(/^( +)/);
            if (leadingSpaces) {
              const nbsp = '\u00A0'.repeat(leadingSpaces[1].length);
              p.textContent = nbsp + line.slice(leadingSpaces[1].length);
            } else {
              p.textContent = line || '\u00A0'; // empty lines need content
            }
            td.appendChild(p);
          });
          tr.appendChild(td);
          table.appendChild(tr);
          pre.replaceWith(table);
        });

        return contentClone.innerHTML;
      },
      svgPngDataUrls,
      MAX_WIDTH_PX,
      MAX_HEIGHT_PX,
      SVG_CONTAINER_SELECTORS,
    );

    await browser.close();

    const fullHtml = buildDocxHtml(processedHtml);
    const baseName = options.fileName.replace(/\.md$/i, '');

    const docxBuffer = await HtmlToDocx(fullHtml, null, {
      title: baseName,
      creator: 'Jeeves Server',
      table: { row: { cantSplit: true } },
      imageProcessing: {
        svgHandling: 'native',
        maxRetries: 2,
        downloadTimeout: 15000,
      },
    });

    return Buffer.isBuffer(docxBuffer)
      ? docxBuffer
      : Buffer.from(docxBuffer as ArrayBuffer);
  } finally {
    await browser.close();
  }
}

/**
 * Export page based on format.
 */
export async function exportPage(options: ExportOptions): Promise<Buffer> {
  return options.format === 'pdf' ? exportPDF(options) : exportDOCX(options);
}

/** Build a clean HTML document for DOCX conversion. */
function buildDocxHtml(bodyContent: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Calibri, Arial, sans-serif; font-size: 10pt; line-height: 1.6; }
    h1 { font-size: 18pt; font-weight: bold; color: #1a1a1a; margin-top: 20pt; margin-bottom: 10pt; }
    h2 { font-size: 14pt; font-weight: bold; color: #2a2a2a; margin-top: 16pt; margin-bottom: 8pt; }
    h3 { font-size: 12pt; font-weight: bold; color: #3a3a3a; margin-top: 12pt; margin-bottom: 6pt; }
    h4 { font-size: 10pt; font-weight: bold; color: #4a4a4a; margin-top: 10pt; margin-bottom: 5pt; }
    p { margin: 5pt 0; }
    code { font-family: Consolas, 'Courier New', monospace; font-size: 9pt; background-color: #f4f4f4; padding: 2pt 4pt; }
    pre { font-family: Consolas, 'Courier New', monospace; font-size: 8pt; background-color: #f8f8f8; border: 1pt solid #ddd; padding: 10pt; margin: 10pt 0; white-space: pre-wrap; word-wrap: break-word; }
    pre code { background-color: transparent; padding: 0; }
    table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
    th { background-color: #f0f0f0; font-weight: bold; border: 1pt solid #999; padding: 8pt; text-align: left; }
    td { border: 1pt solid #999; padding: 8pt; text-align: left; }
    tr:nth-child(even) td { background-color: #fafafa; }
    blockquote { border-left: 4pt solid #ddd; margin: 12pt 0; padding: 6pt 12pt; color: #666; }
    ul, ol { margin: 6pt 0; padding-left: 24pt; }
    li { margin: 4pt 0; }
    a { color: #0066cc; }
    img, svg { margin: 12pt 0; display: block; }
  </style>
</head>
<body>
${bodyContent}
</body>
</html>`;
}
