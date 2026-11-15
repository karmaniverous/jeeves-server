/**
 * Chooses the print style of a PDF export (#316) from a document's
 * `jeeves.print` directive and builds its `page.pdf()` options. Export
 * never fails because of a style: an unknown or invalid name, or a style
 * that fails to load, gives the default style and a log line.
 *
 * @packageDocumentation
 */

import {
  PRINT_PAPER_FORMATS,
  type PrintPageConfig,
} from '@karmaniverous/jeeves-server-core';
import type { PDFOptions } from 'puppeteer-core';

import { getConfig } from '../config/index.js';
import { DEFAULT_PRINT_STYLE, type PrintStyleKey } from './exportCacheKey.js';
import { type LoadedPrintStyle, loadPrintStyle } from './printStyleLoader.js';

/** The `page.pdf()` options of a PDF without a named style (as in 3.15.0). */
export const DEFAULT_PDF_OPTIONS: Readonly<PDFOptions> = {
  format: 'A4',
  margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
  printBackground: true,
};

/** Template for the unset half of a header/footer pair (Chromium's is a date and title). */
const EMPTY_TEMPLATE = '<span></span>';

/** The style a PDF export renders with. */
export interface ResolvedPrintStyle extends PrintStyleKey {
  /** CSS injected after the default print CSS; none for the default. */
  css?: string;
  /** `page.pdf()` options. */
  pdf: PDFOptions;
}

/** The default style. */
const DEFAULT_STYLE: ResolvedPrintStyle = {
  ...DEFAULT_PRINT_STYLE,
  pdf: DEFAULT_PDF_OPTIONS,
};

/** (file, name) pairs whose unknown name has been logged. */
const warnedNames = new Set<string>();

/** Load failures logged, by style name and message. */
const loggedFailures = new Set<string>();

/**
 * Expand a CSS margin shorthand (one to four lengths).
 *
 * @param margin - The shorthand.
 * @returns Top, right, bottom and left.
 */
export function expandMargin(
  margin: string,
): NonNullable<PDFOptions['margin']> {
  const [top, right = top, bottom = top, left = right] = margin
    .trim()
    .split(/\s+/);
  return { top, right, bottom, left };
}

/** Page size and margins for a named style (A4 and 1 cm unless set). */
function pageOptions(page: PrintPageConfig = {}): PDFOptions {
  const format = PRINT_PAPER_FORMATS.find(
    (f) => f === page.format?.toLowerCase(),
  );
  const size: PDFOptions =
    page.width !== undefined && page.height !== undefined
      ? { width: page.width, height: page.height }
      : { format: format ?? 'a4' };
  return {
    ...size,
    margin:
      page.margin === undefined
        ? DEFAULT_PDF_OPTIONS.margin
        : expandMargin(page.margin),
  };
}

/**
 * The `page.pdf()` options of a named style: page size, margins,
 * `preferCSSPageSize` (so `@page` can also size the page) and, with a
 * template, the header and footer.
 *
 * @param style - The loaded style.
 * @returns The options.
 */
export function pdfOptionsFor(style: LoadedPrintStyle): PDFOptions {
  const templated =
    style.headerTemplate !== undefined || style.footerTemplate !== undefined;
  return {
    ...pageOptions(style.page),
    printBackground: true,
    preferCSSPageSize: true,
    ...(templated && {
      displayHeaderFooter: true,
      headerTemplate: style.headerTemplate ?? EMPTY_TEMPLATE,
      footerTemplate: style.footerTemplate ?? EMPTY_TEMPLATE,
    }),
  };
}

/** Log once per (file, name) that a document named no usable style. */
function warnUnknown(fsPath: string, name: unknown): void {
  const label = typeof name === 'string' ? name : JSON.stringify(name);
  const key = `${fsPath}\0${label}`;
  if (warnedNames.has(key)) return;
  warnedNames.add(key);
  console.warn(
    `Print style ${label} is not registered; default styling: ${fsPath}`,
  );
}

/**
 * The print style a document's PDF export uses.
 *
 * @param directives - The document's `jeeves` mapping, if any.
 * @param fsPath - The document's path (for logs).
 * @returns The named style when registered and loadable, else the default.
 */
export function resolvePrintStyle(
  directives: Record<string, unknown> | null,
  fsPath: string,
): ResolvedPrintStyle {
  const name = directives?.print;
  if (name === undefined) return DEFAULT_STYLE;
  const styles = getConfig().printStyles ?? {};
  if (typeof name !== 'string' || !Object.hasOwn(styles, name)) {
    warnUnknown(fsPath, name);
    return DEFAULT_STYLE;
  }
  try {
    const style = loadPrintStyle(name, styles[name]);
    for (const key of loggedFailures)
      if (key.startsWith(`${name}\0`)) loggedFailures.delete(key);
    return {
      name,
      fingerprint: style.fingerprint,
      css: style.css,
      pdf: pdfOptionsFor(style),
    };
  } catch (err) {
    const message = (err as Error).message;
    if (!loggedFailures.has(`${name}\0${message}`)) {
      loggedFailures.add(`${name}\0${message}`);
      console.error(
        `Print style "${name}" failed to load; default styling: ${message}`,
      );
    }
    return DEFAULT_STYLE;
  }
}
