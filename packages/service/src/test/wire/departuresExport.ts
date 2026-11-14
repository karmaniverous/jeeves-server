/**
 * Approved wire departures for exports, export cache, diagram exports, diagrams and public content: each departing scenario, what the branch base sent, and the decision that allows the change. Pure data.
 *
 * @packageDocumentation
 */

import {
  D_DOCUMENT,
  D_VALIDATION,
  D4,
  D4_CHROME,
  D4_EXPORT_FAILED,
  D8,
  type WireDeparture,
} from './departuresCommon.js';

/** #316: every attachment's Content-Disposition is `attachmentDisposition`. */
const D316_DISPOSITION =
  '#316 (Raw downloads): exports send attachmentDisposition, the ASCII filename plus the exact UTF-8 name in filename* (RFC 6266/5987), so a non-ASCII name no longer fails (500) and a quote is never sent raw';

/** Export scenarios whose 200 reply only gains `filename*`. */
const FILENAME_STAR = [
  'export pdf cached',
  'export default format cached',
  'export pdf cached path share',
  'export pdf cached expiring share',
  'export docx cached',
  'export directory zip',
  'export directory tar',
  'diagramExport mermaid svg cached',
  'diagramExport mermaid default cached',
  'diagramExport mermaid path share',
] as const;

/** Departures of the exports, export cache, diagram exports, diagrams and public content scenarios. */
export const DEPARTURES_EXPORT: Readonly<Record<string, WireDeparture>> = {
  ...Object.fromEntries(
    FILENAME_STAR.map((name) => [
      name,
      {
        before:
          '200 with content-disposition attachment; filename="<name>" only',
        allowedBy: D316_DISPOSITION,
        status: 200,
      },
    ]),
  ),
  'export pdf without chrome': {
    before:
      '500 {"error":"PDF export failed","details":"Error: Browser was not found at the configured executablePath ({dir}/no-chrome/chrome)"}',
    allowedBy: D4_CHROME,
    status: 503,
    code: 'SERVER_CHROME_UNAVAILABLE',
  },
  'export docx without chrome': {
    before:
      '500 {"error":"DOCX export failed","details":"Error: Browser was not found at the configured executablePath ({dir}/no-chrome/chrome)"}',
    allowedBy: D4_CHROME,
    status: 503,
    code: 'SERVER_CHROME_UNAVAILABLE',
  },
  'export dot-markdown pdf': {
    before: '400 {"error":"Only markdown files support PDF/DOCX export"}',
    allowedBy: `${D_DOCUMENT}: a .markdown file exports, so the wire app (no Chrome) answers as for .md; ${D4_CHROME}`,
    status: 503,
    code: 'SERVER_CHROME_UNAVAILABLE',
  },
  'export json pdf': {
    before: '400 {"error":"Only markdown files support PDF/DOCX export"}',
    allowedBy: `${D_DOCUMENT}: a text file only the watcher can render, with the watcher unreachable, is SERVER_WATCHER_UNAVAILABLE (502)`,
    status: 502,
    code: 'SERVER_WATCHER_UNAVAILABLE',
  },
  'export file zip': {
    before: '400 {"error":"Files support pdf or docx export"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_EXPORT_UNSUPPORTED',
  },
  'export directory pdf': {
    before: '400 {"error":"Directories only support zip or tar export"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_EXPORT_UNSUPPORTED',
  },
  'export missing': {
    before: '404 {"error":"Not found","path":"{dir}/content/missing.md"}',
    allowedBy: D4,
    status: 404,
    code: 'SERVER_NOT_FOUND',
  },
  'export no root': {
    before: '404 {"error":"Invalid path"}',
    allowedBy: D4,
    status: 404,
    code: 'SERVER_NOT_FOUND',
  },
  'export empty path': {
    before: '400 {"error":"Path required"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_INVALID_PATH',
  },
  'export pdf cached none': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'export pdf cached scoped machine key': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D8,
    status: 403,
    code: 'SERVER_OUT_OF_SCOPE',
  },
  'export directory zip path share': {
    before: '403 {"error":"Archive export requires insider access"}',
    allowedBy: D4,
    status: 403,
    code: 'SERVER_INSIDER_REQUIRED',
  },
  'exportCacheClear path share': {
    before: '403 {"error":"Insider access required"}',
    allowedBy: D4,
    status: 403,
    code: 'SERVER_INSIDER_REQUIRED',
  },
  'exportCacheClear none': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'exportCacheClear no root': {
    before: '404 {"error":"Invalid path"}',
    allowedBy: D4,
    status: 404,
    code: 'SERVER_NOT_FOUND',
  },
  'exportCacheClear empty path': {
    before: '400 {"error":"Path required"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_INVALID_PATH',
  },
  'diagramExport mermaid png without chrome': {
    before: '500 {"error":"Mermaid render failed"}',
    allowedBy: D4_CHROME,
    status: 503,
    code: 'SERVER_CHROME_UNAVAILABLE',
  },
  'diagramExport mermaid not mermaid': {
    before: '404 {"error":"Mermaid file not found"}',
    allowedBy: D4,
    status: 404,
    code: 'SERVER_NOT_FOUND',
  },
  'diagramExport mermaid missing': {
    before: '404 {"error":"Mermaid file not found"}',
    allowedBy: D4,
    status: 404,
    code: 'SERVER_NOT_FOUND',
  },
  'diagramExport mermaid no root': {
    before: '404 {"error":"Invalid path"}',
    allowedBy: D4,
    status: 404,
    code: 'SERVER_NOT_FOUND',
  },
  'diagramExport mermaid empty path': {
    before: '400 {"error":"Path required"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_INVALID_PATH',
  },
  'diagramExport plantuml unrenderable': {
    before: '500 {"error":"Plantuml render failed"}',
    allowedBy: D4_EXPORT_FAILED,
    status: 502,
    code: 'SERVER_EXPORT_FAILED',
  },
  'diagramExport plantuml png unrenderable': {
    before: '500 {"error":"Plantuml render failed"}',
    allowedBy: D4_EXPORT_FAILED,
    status: 502,
    code: 'SERVER_EXPORT_FAILED',
  },
  'diagramExport plantuml not plantuml': {
    before: '404 {"error":"PlantUML file not found"}',
    allowedBy: D4,
    status: 404,
    code: 'SERVER_NOT_FOUND',
  },
  'diagramExport plantuml empty path': {
    before: '400 {"error":"Path required"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_INVALID_PATH',
  },
  'diagramExport mermaid none': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'diagram unknown hash': {
    before: '404 {"error":"Diagram source not found (may have expired)"}',
    allowedBy: D4,
    status: 404,
    code: 'SERVER_NOT_FOUND',
  },
  'diagram invalid type': {
    before: '400 {"error":"Invalid diagram type"}',
    allowedBy: `${D4}; ${D_VALIDATION}`,
    status: 400,
    code: 'FST_ERR_VALIDATION',
  },
  'diagram invalid hash': {
    before: '400 {"error":"Invalid hash"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_INVALID_REQUEST',
  },
  'publicContent unknown': {
    before: '404 {"error":"Not found"}',
    allowedBy: D4,
    status: 404,
    code: 'SERVER_NOT_FOUND',
  },
  'publicContent invalid slug': {
    before: '400 {"error":"Invalid slug"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_INVALID_REQUEST',
  },
};
