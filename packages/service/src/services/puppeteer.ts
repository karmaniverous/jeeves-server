/**
 * Puppeteer browser management and page preparation utilities.
 * Shared by PDF and DOCX export paths.
 *
 * @packageDocumentation
 */

import type { Browser, Page } from 'puppeteer-core';
import puppeteer from 'puppeteer-core';

import { getConfig } from '../config/index.js';

/**
 * Launch Puppeteer browser with configured Chrome path.
 */
export async function launchBrowser(): Promise<Browser> {
  const { chromePath } = getConfig();
  return await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

/** Print CSS — hides chrome, normalizes layout for clean export. */
const PRINT_CSS = `
  /* Hide chrome — works for both legacy server-rendered and SPA */
  .header, .header-actions, .panzoom-container, .panzoom-hint,
  header, nav, .toc-sidebar, [class*="sticky"], [class*="fixed"] { display: none !important; }
  .toc { position: static !important; height: auto !important; page-break-after: always; }
  .toc-spacer { display: none !important; }
  .layout { display: block !important; }
  body { background: #fff !important; font-size: 10pt !important; line-height: 1.5 !important; color: #000 !important; }
  /* SPA layout: remove scroll containers so body grows to full content height */
  html, body, #root { height: auto !important; overflow: visible !important; }
  main, [class*="overflow-y"] { overflow: visible !important; height: auto !important; }
  /* SPA article.prose */
  article.prose { max-width: none !important; border: none !important; padding: 0 !important; }
  .content, article.prose { font-size: 10pt !important; }
  /* Hide tab bar and other SPA controls */
  [role="tablist"], button { display: none !important; }
  main { padding-top: 0 !important; }
  /* Inline SVG Panzoom & Embedded Diagrams: strip container chrome, show SVGs cleanly */
  .inline-svg-panzoom, .embedded-diagram-panzoom, .embedded-diagram-rendered { 
    position: static !important; 
    background: white !important; 
    border: none !important; 
    overflow: visible !important;
    cursor: default !important;
    padding: 0 !important;
    margin: 1em 0 !important;
  }
  .inline-svg-panzoom button, .embedded-diagram-panzoom button { display: none !important; }
  .inline-svg-panzoom .text-xs, .embedded-diagram-panzoom .text-xs { display: none !important; }
  .inline-svg-panzoom svg, .embedded-diagram-panzoom svg, .embedded-diagram-rendered svg {
    max-width: 190mm !important;
    max-height: 250mm !important;
    width: auto !important;
    height: auto !important;
    display: block !important;
    page-break-inside: avoid !important;
  }
  h1 { font-size: 18pt !important; }
  h2 { font-size: 14pt !important; }
  h3 { font-size: 12pt !important; }
  h4, h5, h6 { font-size: 10pt !important; }
  code { font-size: 9pt !important; }
  pre { font-size: 8pt !important; background: #f5f5f5 !important; border: 1px solid #e0e0e0 !important; border-radius: 4px !important; padding: 8px !important; overflow-wrap: break-word !important; white-space: pre-wrap !important; }
  pre code { font-size: 8pt !important; }
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
`;

/**
 * Intercept requests matching `/api/raw/` and append an auth key.
 *
 * Must be called **before** `page.goto()` so the interception is active
 * when the browser fetches sub-resources (images, etc.).
 */
export async function setupAuthInterception(
  page: Page,
  authKey: string,
): Promise<void> {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.pathname.startsWith('/api/raw/')) {
      url.searchParams.set('key', authKey);
      void req.continue({ url: url.toString() });
    } else {
      void req.continue();
    }
  });
}

/**
 * Add print styles to a Puppeteer page.
 */
export async function addPrintStyles(page: Page): Promise<void> {
  await page.addStyleTag({ content: PRINT_CSS });
}

/**
 * Wait for SPA content to fully render, including async SVG fetches.
 */
export async function waitForSpaContent(page: Page): Promise<void> {
  await page
    .waitForSelector('article.prose', { timeout: 15_000 })
    .catch(() => {});
  await page
    .waitForFunction(
      () => {
        const containers = document.querySelectorAll('.inline-svg-panzoom');
        if (containers.length === 0) return true;
        return Array.from(containers).every(
          (c) => !c.textContent.includes('Loading SVG'),
        );
      },
      { timeout: 15_000 },
    )
    .catch(() => {});
  // Wait for CM6 code blocks to mount
  await page
    .waitForFunction(
      () => {
        const article = document.querySelector('article.prose');
        if (!article) return true;
        // If there are no code blocks, or CM6 has signaled ready
        const codeBlocks = article.querySelectorAll('.cm6-embedded-code');
        if (codeBlocks.length === 0) return true;
        return article.getAttribute('data-cm6-ready') === 'true';
      },
      { timeout: 15_000 },
    )
    .catch(() => {});
  await new Promise((r) => setTimeout(r, 1000));
}

/** SVG container selectors used across export paths. */
export const SVG_CONTAINER_SELECTORS =
  '.svg-container, .zoomable-svg, .inline-svg-panzoom, .embedded-diagram-panzoom, .embedded-diagram-rendered';

/**
 * Capture each SVG in a page as a high-quality PNG screenshot.
 * Returns array of \{ index, dataUrl, width, height \}.
 */
export async function captureSvgsAsPng(
  browser: Browser,
  page: Page,
): Promise<
  { index: number; dataUrl: string; width: number; height: number }[]
> {
  const svgContents = await page.evaluate((selectors: string) => {
    const containers = document.querySelectorAll(selectors);
    return Array.from(containers).map((container, i) => {
      const svg = container.querySelector('svg');
      return { index: i, svgHtml: svg ? svg.outerHTML : null };
    });
  }, SVG_CONTAINER_SELECTORS);

  const results: {
    index: number;
    dataUrl: string;
    width: number;
    height: number;
  }[] = [];

  for (const { index, svgHtml } of svgContents) {
    if (!svgHtml) continue;

    const svgPage = await browser.newPage();
    await svgPage.setViewport({
      width: 1200,
      height: 2000,
      deviceScaleFactor: 2,
    });
    await svgPage.setContent(
      `<!DOCTYPE html>
<html><head><style>
  body { margin: 0; padding: 0; background: #fff; }
  svg { width: 1152px; height: auto; display: block; }
</style></head><body>${svgHtml}</body></html>`,
      { waitUntil: 'networkidle0' },
    );

    const svgHandle = await svgPage.$('svg');
    if (svgHandle) {
      const screenshot = await svgHandle.screenshot({ type: 'png' });
      const box = await svgHandle.boundingBox();
      if (box && box.width > 0 && box.height > 0) {
        results.push({
          index,
          dataUrl: `data:image/png;base64,${Buffer.from(screenshot).toString('base64')}`,
          width: Math.ceil(box.width),
          height: Math.ceil(box.height),
        });
      }
    }
    await svgPage.close();
  }

  return results;
}
