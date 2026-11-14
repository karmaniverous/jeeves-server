/**
 * #316: the PDF export applies a print style after the default print CSS
 * (Decision 9) and passes its `page.pdf()` options; without one, the CSS
 * and options are exactly 3.15.0's. Puppeteer is mocked.
 *
 * @packageDocumentation
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as string[]);
const page = vi.hoisted(() => ({
  goto: vi.fn(),
  addStyleTag: vi.fn(({ content }: { content: string }) => {
    calls.push(`style:${content}`);
    return Promise.resolve();
  }),
  pdf: vi.fn((options: unknown) => {
    calls.push(`pdf:${JSON.stringify(options)}`);
    return Promise.resolve(new Uint8Array([37, 80, 68, 70]));
  }),
}));

vi.mock('./puppeteer.js', () => ({
  addPrintStyles: () => {
    calls.push('style:PRINT_CSS');
    return Promise.resolve();
  },
  assertRenderReady: () => Promise.resolve(),
  captureSvgsAsPng: () => Promise.resolve([]),
  launchBrowser: () =>
    Promise.resolve({
      newPage: () => Promise.resolve(page),
      close: () => Promise.resolve(),
    }),
  setupAuthInterception: () => Promise.resolve(),
  SVG_CONTAINER_SELECTORS: '.mermaid',
  waitForSpaContent: () => Promise.resolve(),
}));

const { exportPage } = await import('./export.js');
const { DEFAULT_PDF_OPTIONS } = await import('./printStyles.js');

const pdf = (printStyle?: Parameters<typeof exportPage>[0]['printStyle']) =>
  exportPage({
    url: 'http://x/browse/a.md',
    fileName: 'a.md',
    format: 'pdf',
    printStyle,
  });

beforeEach(() => {
  calls.length = 0;
});

describe('PDF export print style cascade', () => {
  it('injects the style CSS after the default, then prints with its options', async () => {
    const options = { format: 'letter' as const, preferCSSPageSize: true };
    const buffer = await pdf({
      css: 'h1 { color: navy !important; }',
      pdf: options,
    });
    expect(buffer.toString()).toBe('%PDF');
    expect(calls).toEqual([
      'style:PRINT_CSS',
      'style:h1 { color: navy !important; }',
      `pdf:${JSON.stringify(options)}`,
    ]);
  });

  it('injects only the default CSS and prints with the default options without a style', async () => {
    await pdf();
    expect(calls).toEqual([
      'style:PRINT_CSS',
      `pdf:${JSON.stringify(DEFAULT_PDF_OPTIONS)}`,
    ]);
  });

  it('treats the default resolved style like no style', async () => {
    await pdf({ pdf: DEFAULT_PDF_OPTIONS });
    expect(calls).toEqual([
      'style:PRINT_CSS',
      `pdf:${JSON.stringify(DEFAULT_PDF_OPTIONS)}`,
    ]);
  });
});
