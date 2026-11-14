/**
 * Approved wire departures for document titles (#262): each departing scenario, what the branch base sent, and the decision that allows the change. Pure data.
 *
 * @packageDocumentation
 */

import type { WireDeparture } from './departuresCommon.js';

/** #262: the file API and the SPA shell carry the document title. */
export const D262 =
  '#262 (Document titles): the file API response gains title; the SPA fallback for a gated /browse/<path> puts it in <title> and og:title';

/** `fileContent` scenarios whose 200 body gains `title` (nothing else). */
const FILE_CONTENT_TITLED = [
  'markdown',
  'markdown raw',
  'json',
  'csv',
  'csv raw',
  'png',
  'pdf',
  'mermaid cached',
  'mermaid raw',
  'plantuml unrenderable',
  'embedded diagram',
  'percent name',
  'machine key',
  'path share',
  'expiring share',
  'deep share',
  'tree share of root',
  'path share legacy key param',
  'percent name path share',
  'shared scoped session',
  'shared scoped machine key',
  'shared share by scoped insider',
  'private share',
] as const;

/** Departures of the document title scenarios. */
export const DEPARTURES_DOCUMENTS: Readonly<Record<string, WireDeparture>> = {
  ...Object.fromEntries(
    FILE_CONTENT_TITLED.map((name) => [
      `fileContent ${name}`,
      {
        before: '200, the same body without title',
        allowedBy: `${D262}: front matter title, else the file name`,
        status: 200,
      },
    ]),
  ),
  'spa browse session': {
    before: '200 the index.html shell as built (<title>wire spa</title>)',
    allowedBy: `${D262}: <title>Wire Document - Wire</title> and og:title`,
    status: 200,
  },
  'spa browse path share': {
    before: '200 the index.html shell as built (<title>wire spa</title>)',
    allowedBy: `${D262}: a request that passed the gate with a share key`,
    status: 200,
  },
};
