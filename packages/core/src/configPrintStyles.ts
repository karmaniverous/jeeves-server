/**
 * Config schemas for named PDF print styles (`printStyles`, #316) and the
 * absolute-path check they share with other path settings.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

/**
 * Whether a path is absolute on POSIX (`/…`), Windows (`C:\…`, `C:/…`) or
 * UNC (`\\server\…`), whatever platform validates the config.
 *
 * @param p - The path.
 * @returns `true` when absolute.
 */
export const isAbsolutePath = (p: string): boolean =>
  p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p) || p.startsWith('\\\\');

/**
 * An absolute file system path.
 *
 * @param label - What the path is, for the error message.
 * @returns The schema.
 */
export const absolutePathSchema = (label: string) =>
  z
    .string()
    .min(1)
    .refine(isAbsolutePath, { message: `${label} must be an absolute path` });

/** Paper formats Chromium's `page.pdf()` accepts (any case). */
export const PRINT_PAPER_FORMATS = [
  'letter',
  'legal',
  'tabloid',
  'ledger',
  'a0',
  'a1',
  'a2',
  'a3',
  'a4',
  'a5',
  'a6',
] as const;

/** A page dimension: a CSS length string (`210mm`) or pixels. */
const pageLengthSchema = z.union([z.string().min(1), z.number().positive()]);

/** Page size and margins of a print style. */
export const printPageSchema = z
  .object({
    /** Paper format (`Letter`, `A4`, …); exclusive with width/height. */
    format: z
      .string()
      .refine(
        (f) =>
          (PRINT_PAPER_FORMATS as readonly string[]).includes(f.toLowerCase()),
        { message: `format must be one of ${PRINT_PAPER_FORMATS.join(', ')}` },
      )
      .optional(),
    /** Page width; requires height. */
    width: pageLengthSchema.optional(),
    /** Page height; requires width. */
    height: pageLengthSchema.optional(),
    /** CSS margin shorthand: one to four lengths (`14mm 14mm 16mm 14mm`). */
    margin: z
      .string()
      .regex(/^\s*\S+(?:\s+\S+){0,3}\s*$/, {
        message: 'margin must be one to four CSS lengths',
      })
      .optional(),
  })
  .superRefine((page, ctx) => {
    const sized = page.width !== undefined || page.height !== undefined;
    if (page.format !== undefined && sized)
      ctx.addIssue({
        code: 'custom',
        message: 'Use format or width and height, not both',
        path: ['format'],
      });
    if (sized && (page.width === undefined || page.height === undefined))
      ctx.addIssue({
        code: 'custom',
        message: 'width and height must be given together',
        path: [page.width === undefined ? 'width' : 'height'],
      });
  });

/** One print style: a stylesheet, with optional page options and templates. */
export const printStyleSchema = z.object({
  /** Stylesheet injected after the default print CSS. */
  css: absolutePathSchema('css'),
  /** Page size and margins for `page.pdf()`. */
  page: printPageSchema.optional(),
  /** Chromium header template (HTML). */
  headerTemplate: absolutePathSchema('headerTemplate').optional(),
  /** Chromium footer template (HTML). */
  footerTemplate: absolutePathSchema('footerTemplate').optional(),
  /** Directory whose files the CSS and templates may inline. */
  assets: absolutePathSchema('assets').optional(),
});

/** Print style name: lower-case letters, digits and hyphens. */
export const PRINT_STYLE_NAME = /^[a-z0-9][a-z0-9-]*$/;

/** Named print styles, chosen by documents with `jeeves: { print: <name> }`. */
export const printStylesSchema = z.record(
  z.string().regex(PRINT_STYLE_NAME, {
    message:
      'Print style names are lower-case letters, digits and hyphens, starting with a letter or digit',
  }),
  printStyleSchema,
);

/** A configured print style. */
export type PrintStyleConfig = z.infer<typeof printStyleSchema>;

/** A print style's page options. */
export type PrintPageConfig = z.infer<typeof printPageSchema>;
