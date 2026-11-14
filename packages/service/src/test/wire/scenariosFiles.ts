/**
 * Wire scenarios for exports (PDF, DOCX, archives, Mermaid, PlantUML), the export cache, embedded diagrams and public content. Pure data.
 *
 * @packageDocumentation
 */

import { D, matrix, P } from './scenariosContent.js';
import { EMBEDDED_HASH } from './wireFixture.js';
import {
  CRED,
  get,
  scenario,
  shareCred,
  table,
  type WireCred,
  type WireScenario,
  withCred,
} from './wireTypes.js';

/** `GET /api/export/*`. */
const EXPORT: WireScenario[] = [
  ...[
    ['pdf cached', `${P.doc}?format=pdf`],
    ['default format cached', P.doc],
    ['docx cached', `${P.doc}?format=docx`],
    ['pdf without chrome', `${P.shared}?format=pdf`],
    ['docx without chrome', `${P.shared}?format=docx`],
    ['dot-markdown pdf', `${P.markdown}?format=pdf`],
    ['json pdf', `${P.json}?format=pdf`],
    ['file zip', `${P.doc}?format=zip`],
    ['directory zip', `${P.subDir}?format=zip`],
    ['directory tar', `${P.subDir}?format=tar`],
    ['directory pdf', `${P.subDir}?format=pdf`],
    ['missing', `${P.missing}?format=pdf`],
    ['no root', `${P.noRoot}?format=pdf`],
  ].map(([suffix, url]) =>
    get(`export ${suffix}`, `/api/export/${url}`, { cred: CRED.session }),
  ),
  get('export empty path', '/api/export/', { cred: CRED.session }),
  ...matrix('export pdf cached', `/api/export/${P.doc}?format=pdf`, {
    none: undefined,
    'path share': shareCred('path', D.doc),
    'expiring share': shareCred('expiring', D.doc),
    'scoped machine key': CRED.scopedMachine,
  }),
  get('export directory zip path share', `/api/export/${P.subDir}?format=zip`, {
    cred: shareCred('path', D.subDir),
  }),
];

/** `DELETE /api/export-cache/*`. */
const EXPORT_CACHE: WireScenario[] = [
  ...table<[string, string, WireCred | undefined]>(
    ['session', P.doc, CRED.session],
    ['mermaid', P.mmd, CRED.session],
    ['uncached', P.shared, CRED.session],
    ['machine key', P.doc, CRED.machine],
    ['path share', P.doc, shareCred('path', D.doc)],
    ['none', P.doc, undefined],
    ['no root', P.noRoot, CRED.session],
  ).map(([suffix, path, cred]) =>
    scenario(
      `exportCacheClear ${suffix}`,
      'DELETE',
      `/api/export-cache/${path}`,
      withCred(cred),
    ),
  ),
  scenario('exportCacheClear empty path', 'DELETE', '/api/export-cache/', {
    cred: CRED.session,
  }),
];

/** Standalone diagram exports. */
const DIAGRAM_EXPORT: WireScenario[] = [
  ...[
    ['mermaid svg cached', `mermaid-export/${P.mmd}`],
    ['mermaid default cached', `mermaid-export/${P.mmd}?format=bogus`],
    ['mermaid png without chrome', `mermaid-export/${P.mmd}?format=png`],
    ['mermaid not mermaid', `mermaid-export/${P.doc}`],
    ['mermaid missing', `mermaid-export/{root}/missing.mmd`],
    ['mermaid no root', `mermaid-export/zz-no-root/flow.mmd`],
    ['mermaid empty path', 'mermaid-export/'],
    ['plantuml unrenderable', `plantuml-export/${P.puml}`],
    ['plantuml png unrenderable', `plantuml-export/${P.puml}?format=png`],
    ['plantuml not plantuml', `plantuml-export/${P.doc}`],
    ['plantuml empty path', 'plantuml-export/'],
  ].map(([suffix, url]) =>
    get(`diagramExport ${suffix}`, `/api/${url}`, { cred: CRED.session }),
  ),
  ...matrix('diagramExport mermaid', `/api/mermaid-export/${P.mmd}`, {
    none: undefined,
    'path share': shareCred('path', '/{root}/flow.mmd'),
  }),
];

/** `GET /api/diagram/:type/:hash` (public). */
const DIAGRAM: WireScenario[] = [
  get(
    'diagram registered and cached',
    `/api/diagram/mermaid/${EMBEDDED_HASH}`,
    {
      before: [
        { method: 'GET', url: `/api/file/${P.embedded}`, cred: CRED.session },
      ],
    },
  ),
  get(
    'diagram registered svg suffix',
    `/api/diagram/mermaid/${EMBEDDED_HASH}.svg`,
    {
      before: [
        { method: 'GET', url: `/api/file/${P.embedded}`, cred: CRED.session },
      ],
    },
  ),
  get('diagram unknown hash', `/api/diagram/plantuml/${'a'.repeat(64)}`),
  get('diagram invalid type', `/api/diagram/graphviz/${'a'.repeat(64)}`),
  get('diagram invalid hash', '/api/diagram/mermaid/xyz'),
];

/** `GET /api/public-content/:slug` (public; repo documents redacted). */
const PUBLIC_CONTENT: WireScenario[] = [
  ...['readme', 'privacy', 'terms'].map((slug) =>
    get(`publicContent ${slug}`, `/api/public-content/${slug}`, {
      redact: ['content', 'html', 'headings'],
    }),
  ),
  get('publicContent unknown', '/api/public-content/nope'),
  get('publicContent invalid slug', '/api/public-content/bad.slug'),
];

/** Export and diagram scenarios. */
export const SCENARIOS_FILES: WireScenario[] = [
  ...EXPORT,
  ...EXPORT_CACHE,
  ...DIAGRAM_EXPORT,
  ...DIAGRAM,
  ...PUBLIC_CONTENT,
];
