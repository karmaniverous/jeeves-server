/**
 * Export service for PDF and DOCX generation
 */

import fs from 'node:fs';

import HtmlToDocx from '@turbodocx/html-to-docx';
import type { Browser, Page } from 'puppeteer-core';
import puppeteer from 'puppeteer-core';

import { getConfig } from '../config/index.js';

export type ExportFormat = 'pdf' | 'docx';

export interface ExportOptions {
  url: string;
  fileName: string;
  format: ExportFormat;
}

/**
 * Launch Puppeteer browser
 */
async function launchBrowser(): Promise<Browser> {
  const { chromePath } = getConfig();
  return await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

/**
 * Add print styles to page for export
 */
async function addPrintStyles(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      .header, .header-actions, .panzoom-container, .panzoom-hint { display: none !important; }
      .toc { position: static !important; height: auto !important; page-break-after: always; }
      .toc-spacer { display: none !important; }
      .layout { display: block !important; }
      body { background: #fff !important; font-size: 10pt !important; line-height: 1.5 !important; }
      .content { font-size: 10pt !important; }
      h1 { font-size: 18pt !important; }
      h2 { font-size: 14pt !important; }
      h3 { font-size: 12pt !important; }
      h4, h5, h6 { font-size: 10pt !important; }
      code { font-size: 9pt !important; }
      pre, pre code { font-size: 8pt !important; }
      table { font-size: 10pt !important; }
      a.anchor { display: none !important; }
      img, svg, .svg-container, .zoomable-svg { 
        max-width: 190mm !important; 
        max-height: 250mm !important; 
        width: auto !important; 
        height: auto !important;
        display: block !important;
        page-break-inside: avoid !important; 
      }
      img { object-fit: contain !important; }
    `,
  });
}

/**
 * Export page as PDF
 */
export async function exportPDF(options: ExportOptions): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.goto(options.url, { waitUntil: 'networkidle0' });
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
 * Export page as DOCX
 */
export async function exportDOCX(options: ExportOptions): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    await page.goto(options.url, { waitUntil: 'networkidle0' });

    // Get SVG bounding boxes for screenshots
    interface SVGInfo {
      index: number;
      x: number;
      y: number;
      width: number;
      height: number;
    }

    const svgInfos = await page.evaluate(() => {
      const svgContainers = document.querySelectorAll(
        '.svg-container, .zoomable-svg',
      );
      return Array.from(svgContainers)
        .map((container, i) => {
          const svg = container.querySelector('svg');
          if (!svg) return null;
          const rect = svg.getBoundingClientRect();
          return {
            index: i,
            x: Math.floor(rect.x),
            y: Math.floor(rect.y),
            width: Math.ceil(rect.width),
            height: Math.ceil(rect.height),
          };
        })
        .filter(Boolean);
    });

    // Screenshot each SVG as PNG
    interface SVGPngData {
      index: number;
      dataUrl: string;
      width: number;
      height: number;
    }

    const svgPngDataUrls: SVGPngData[] = [];
    for (const info of svgInfos as SVGInfo[]) {
      if (info.width > 0 && info.height > 0) {
        const pngBuffer = await page.screenshot({
          clip: {
            x: info.x,
            y: info.y,
            width: info.width,
            height: info.height,
          },
          type: 'png',
        });
        svgPngDataUrls.push({
          index: info.index,
          dataUrl: `data:image/png;base64,${Buffer.from(pngBuffer).toString('base64')}`,
          width: info.width,
          height: info.height,
        });
      }
    }

    // Max bounds for images in DOCX
    const MAX_WIDTH_PX = 576; // 6 inches at 96dpi
    const MAX_HEIGHT_PX = 768; // 8 inches at 96dpi

    // Get processed HTML with SVGs replaced by PNGs
    const processedHtml = await page.evaluate(
      (pngUrls: SVGPngData[], maxW: number, maxH: number) => {
        function calcScaled(
          origW: number,
          origH: number,
        ): { width: number; height: number } {
          let w = origW;
          let h = origH;
          if (w > maxW) {
            const scale = maxW / w;
            w = maxW;
            h = Math.round(h * scale);
          }
          if (h > maxH) {
            const scale = maxH / h;
            h = maxH;
            w = Math.round(w * scale);
          }
          return { width: w, height: h };
        }

        const content = document.querySelector('.content');
        if (!content) return '<p>No content</p>';

        const contentClone = content.cloneNode(true) as HTMLElement;

        // Remove anchor links
        contentClone.querySelectorAll('a.anchor').forEach((el) => el.remove());

        // Replace SVG containers with PNG images
        const svgContainers = contentClone.querySelectorAll(
          '.svg-container, .zoomable-svg',
        );
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
            const placeholder = document.createElement('p');
            placeholder.textContent = '[Diagram]';
            placeholder.style.fontStyle = 'italic';
            container.replaceWith(placeholder);
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

        // Apply inline styles for tables
        contentClone.querySelectorAll('table').forEach((table) => {
          table.setAttribute('border', '1');
          (table as HTMLElement).style.borderCollapse = 'collapse';
          (table as HTMLElement).style.width = '100%';
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

        // Apply inline styles for code blocks
        contentClone.querySelectorAll('pre').forEach((pre) => {
          (pre as HTMLElement).style.fontFamily = 'Consolas, monospace';
          (pre as HTMLElement).style.fontSize = '9pt';
          (pre as HTMLElement).style.backgroundColor = '#f5f5f5';
          (pre as HTMLElement).style.padding = '12px';
          (pre as HTMLElement).style.border = '1px solid #ddd';
          pre.innerHTML = pre.innerHTML.replace(/\n/g, '<br>');
        });
        contentClone.querySelectorAll('code').forEach((code) => {
          (code as HTMLElement).style.fontFamily = 'Consolas, monospace';
        });

        return contentClone.innerHTML;
      },
      svgPngDataUrls,
      MAX_WIDTH_PX,
      MAX_HEIGHT_PX,
    );

    await browser.close();

    // Build clean HTML document
    const fullHtml = `<!DOCTYPE html>
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
${processedHtml}
</body>
</html>`;

    // Convert HTML to DOCX
    const baseName = options.fileName.replace(/\.md$/i, '');
    const docxBuffer = await HtmlToDocx(fullHtml, null, {
      title: baseName,
      creator: 'Jeeves Server',
      table: {
        row: {
          cantSplit: true,
        },
      },
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
 * Export page based on format
 */
export async function exportPage(
  options: ExportOptions,
): Promise<Buffer> {
  if (options.format === 'pdf') {
    return await exportPDF(options);
  } else {
    return await exportDOCX(options);
  }
}
