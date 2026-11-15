/**
 * File content API route: returns a file's content and, where supported,
 * its rendered form (Markdown, Mermaid, PlantUML, CSV, watcher-rendered text).
 *
 * Handler: `fileContent` (GET /api/file/*; writes: fileWrite.ts, mutations: fileMutations.ts)
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import path from 'node:path';

import { NotAFile, NotFound } from '../../api/errors.js';
import { type HandlersFor, ok } from '../../api/handlerTypes.js';
import { getConfig } from '../../config/index.js';
import { csvToHtmlTable } from '../../services/csv.js';
import { getOrRenderDiagram } from '../../services/diagramCache.js';
import { parseFrontMatter } from '../../services/frontMatter.js';
import {
  documentTitle,
  isNativeMarkdown,
  loadMarkdownDocument,
} from '../../services/markdownDocument.js';
import { renderMermaidSvg } from '../../services/mermaid.js';
import { renderPlantUmlSvg } from '../../services/plantuml.js';
import { filterBreadcrumbsForOutsider } from '../../util/breadcrumbs.js';
import { looksLikeText, PLANTUML_EXTS } from '../../util/fileDetection.js';
import { breadcrumbParts, getRoots } from '../../util/platform.js';
import { renderMarkdownContent } from './fileRender.js';
import { fsPathOf, NOT_FOUND_MESSAGE, requirePath } from './routePath.js';

/** Image extensions recognized for type detection. */
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico'];

/** `fileContent`: a file's content and, where supported, its rendering. */
export const fileContentHandlers: HandlersFor<'fileContent'> = {
  fileContent: async ({ params, query }, request) => {
    const rawOnly = query.raw === '1';
    const reqPath = requirePath(params['*']);
    const roots = getRoots(getConfig().roots);
    const resolved = fsPathOf(reqPath, roots);
    if (!fs.existsSync(resolved)) throw new NotFound(NOT_FOUND_MESSAGE);

    const stats = fs.statSync(resolved);
    if (stats.isDirectory())
      throw new NotAFile('Use /api/path/ for directories');

    const ext = path.extname(resolved).toLowerCase();
    const isInsider = request.accessMode === 'insider';
    const fileName = path.basename(resolved);
    // Fields common to every response shape; Markdown documents replace
    // `title` with the document's own (#262).
    const base = {
      fileName,
      title: fileName,
      breadcrumbs: filterBreadcrumbsForOutsider(
        breadcrumbParts(resolved, roots),
        isInsider,
        request.authMatchedPath ?? null,
        false,
      ),
      isInsider,
    };

    // Native Markdown, raw: no rendering (rendered below with the loader).
    const native = isNativeMarkdown(resolved);
    if (native && rawOnly) {
      const content = fs.readFileSync(resolved, 'utf8');
      const { data } = parseFrontMatter(content).frontMatter;
      return ok({
        type: 'markdown' as const,
        content,
        ...base,
        title: documentTitle(data, fileName),
      });
    }

    // Diagrams
    const diagramType: 'mermaid' | 'plantuml' | null =
      ext === '.mmd'
        ? 'mermaid'
        : PLANTUML_EXTS.includes(ext)
          ? 'plantuml'
          : null;
    if (diagramType) {
      const content = fs.readFileSync(resolved, 'utf8');
      if (rawOnly) return ok({ type: diagramType, content, ...base });
      const html = await getOrRenderDiagram(diagramType, content, () =>
        diagramType === 'mermaid'
          ? renderMermaidSvg(resolved)
          : renderPlantUmlSvg(resolved),
      );
      return ok({ type: diagramType, content, html, ...base });
    }

    // SVG
    if (ext === '.svg') {
      const content = fs.readFileSync(resolved, 'utf8');
      return ok({ type: 'svg' as const, content, ...base });
    }

    // CSV
    if (ext === '.csv') {
      const content = fs.readFileSync(resolved, 'utf8');
      if (rawOnly) return ok({ type: 'text' as const, content, ...base });
      const html = csvToHtmlTable(content);
      return ok({ type: 'csv' as const, content, html, ...base });
    }

    // Markdown documents (native, or text rendered by jeeves-watcher)
    const buffer = fs.readFileSync(resolved);
    if (native || looksLikeText(buffer)) {
      const content = buffer.toString('utf8');
      const doc = rawOnly ? null : await loadMarkdownDocument(resolved);
      if (doc) {
        const rendered = await renderMarkdownContent(
          doc.source,
          request,
          resolved,
          reqPath,
          isInsider,
        );
        return ok({
          type: 'markdown' as const,
          content,
          ...rendered,
          ...base,
          title: doc.title,
          mtime: stats.mtimeMs,
          // Watcher documents only (undefined fields are not sent).
          renderAs: doc.renderAs,
          matchedRules: doc.matchedRules,
        });
      }
      return ok({ type: 'text' as const, content, ...base });
    }

    // Images
    if (IMAGE_EXTS.includes(ext)) {
      return ok({ type: 'image' as const, ...base });
    }

    // Binary
    return ok({ type: 'binary' as const, size: stats.size, ...base });
  },
};
