/**
 * `diagram` (`GET /api/diagram/:type/:hash`): an embedded diagram rendered to SVG from its cached source. The type is validated by the catalog; the hash (with an optional `.svg`) here.
 *
 * @packageDocumentation
 */

import { ExportFailed, InvalidRequest, NotFound } from '../../api/errors.js';
import { type HandlersFor, ok } from '../../api/handlerTypes.js';
import {
  getDiagramSource,
  renderDiagramToSvg,
} from '../../services/embeddedDiagrams.js';

/** The diagram handler. */
export const diagramsHandlers: HandlersFor<'diagram'> = {
  diagram: async ({ params }) => {
    const hash = params.hash.replace(/\.svg$/, '');
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new InvalidRequest('Invalid hash');

    const entry = getDiagramSource(hash);
    if (!entry)
      throw new NotFound('Diagram source not found (may have expired)');

    const svg = await renderDiagramToSvg(params.type, entry.source);
    if (!svg) throw new ExportFailed('Renderer returned empty result');

    return ok(svg, {
      'content-type': 'image/svg+xml',
      'cache-control': 'public, max-age=86400, immutable',
    });
  },
};
