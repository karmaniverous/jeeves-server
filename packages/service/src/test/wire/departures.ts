/**
 * The closed list of approved wire departures from the branch-base baseline (`wire-baseline.json`): each departing scenario, what the base sent, and the spec decision that allows the change, with the error code the new body must carry. Pure data.
 *
 * @packageDocumentation
 */

/** One approved departure. */
export interface WireDeparture {
  /** What the branch base sent, and why it changes. */
  before: string;
  /** The spec decision or design section that allows it. */
  allowedBy: string;
  /** HTTP status of the new reply. */
  status: number;
  /** The `code` of the new standard error body (error replies only). */
  code?: string;
}

/** Decision 4 (#315): the service's own errors move to Fastify's standard error body. */
const D4 =
  "Decision 4 / #315: Fastify's standard error body (api/errors.ts, registerErrorHandlers)";

/**
 * As {@link D4}, with the status the spec's code list gives the code.
 *
 * @param why - The code and the status change.
 * @returns The `allowedBy` text.
 */
const d4Status = (why: string) =>
  `${D4}; status per the spec's code list: ${why}`;

const D4_MACHINE_KEY = d4Status(
  'SERVER_MACHINE_KEY_NOT_ROTATABLE is 403 (the legacy route answered 501)',
);
const D4_CHROME = d4Status('SERVER_CHROME_UNAVAILABLE is 503 (was 500)');
const D4_EXPORT_FAILED = d4Status(
  'SERVER_EXPORT_FAILED is 502 (a failed render was 500)',
);
const D4_RUNNER = d4Status(
  'SERVER_RUNNER_UNAVAILABLE is 503 (an unreachable runner was 502)',
);

/** Approved departures by scenario name. */
export const WIRE_DEPARTURES: Readonly<Partial<Record<string, WireDeparture>>> =
  {
    // jeeves-owned handler (`createConfigQueryHandler`): jeeves 0.10.0 sends
    // Fastify's standard error body for an invalid JSONPath.
    'config invalid jsonpath': {
      before:
        '400 {"error":"Unclosed ( at character 3"} from @karmaniverous/jeeves 0.7.0',
      allowedBy: 'Decision 4 (all packages on @karmaniverous/jeeves ^0.11.0)',
      status: 400,
      code: 'JEEVES_CONFIG_QUERY_INVALID',
    },
    // jeeves-owned handler (`createConfigApplyHandler`): jeeves 0.10.0 folds
    // the Zod issues into `message` of Fastify's standard error body.
    'configApply invalid config': {
      before:
        '400 {"error":"Config validation failed","issues":[{"expected":"number","code":"invalid_type","path":["port"],"message":"Invalid input: expected number, received string"}]} from @karmaniverous/jeeves 0.7.0',
      allowedBy: 'Decision 4 (all packages on @karmaniverous/jeeves ^0.11.0)',
      status: 400,
      code: 'JEEVES_CONFIG_INVALID',
    },
    // T7: every JSON error reply of the service (#315).
    'configApply empty body': {
      before:
        '500 {"statusCode":500,"error":"Internal Server Error","message":"Cannot convert undefined or null to object"}',
      allowedBy: D4,
      status: 500,
    },
    'configApply no body': {
      before:
        '500 {"statusCode":500,"error":"Internal Server Error","message":"Cannot destructure property \'patch\' of \'request\' as it is undefined."}',
      allowedBy: D4,
      status: 500,
    },
    'pathKey no path': {
      before: '400 {"error":"path query param required"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'pathKey unknown key': {
      before: '401 {"error":"Invalid API key"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'pathKey none': {
      before: '401 {"error":"X-API-Key header required"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'pathKey insider key in query': {
      before: '401 {"error":"X-API-Key header required"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'insiderKey unknown key': {
      before: '401 {"error":"Invalid API key"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'insiderKey none': {
      before: '401 {"error":"X-API-Key header required"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'legacy rotateKey machine key': {
      before:
        '501 {"error":"Machine key rotation is not supported with TypeScript config. Update the key manually in jeeves.config.ts and restart the server."}',
      allowedBy: D4_MACHINE_KEY,
      status: 403,
      code: 'SERVER_MACHINE_KEY_NOT_ROTATABLE',
    },
    'legacy rotateKey bad key': {
      before: '401 {"error":"Invalid insider key"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'legacy rotateKey none': {
      before: '401 {"error":"Invalid insider key"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'legacy share no path': {
      before: '400 {"error":"path query param required"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'legacy share bad key': {
      before: '401 {"error":"Invalid insider key"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'legacy share none': {
      before: '401 {"error":"Invalid insider key"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'receiveEvent none': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'receiveEvent bad key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'receiveEvent scoped machine key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'receiveEvent insider key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'auth callback code': {
      before:
        '500 {"statusCode":500,"error":"Internal Server Error","message":"fetch failed"}',
      allowedBy: D4,
      status: 500,
    },
    'spa asset missing': {
      before: '404 {"error":"Not found"}',
      allowedBy: D4,
      status: 404,
      code: 'SERVER_NOT_FOUND',
    },
    'unknown route': {
      before: '404 {"error":"Not found"}',
      allowedBy: D4,
      status: 404,
      code: 'SERVER_NOT_FOUND',
    },
    'unknown route POST': {
      before: '404 {"error":"Not found"}',
      allowedBy: D4,
      status: 404,
      code: 'SERVER_NOT_FOUND',
    },
    'unknown route POST under browse': {
      before: '404 {"error":"Not found"}',
      allowedBy: D4,
      status: 404,
      code: 'SERVER_NOT_FOUND',
    },
    'unknown api route': {
      before: '404 {"error":"Not found"}',
      allowedBy: D4,
      status: 404,
      code: 'SERVER_NOT_FOUND',
    },
    'unknown api route none': {
      before: '404 {"error":"Not found"}',
      allowedBy: D4,
      status: 404,
      code: 'SERVER_NOT_FOUND',
    },
    'drives none': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'drives insider key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'drives scoped machine key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'drives bad key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'drives root path share': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'browse root none': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'browse root insider key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'browse root scoped insider key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'browse root scoped machine key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'browse root bad key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'browse public expired share': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'browse public share for another path': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'browse deeper via deep share without dirs': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'browse file out of scope': {
      before: '403 {"error":"Path is outside your access scope"}',
      allowedBy: D4,
      status: 403,
      code: 'SERVER_OUT_OF_SCOPE',
    },
    'browse missing': {
      before: '404 {"error":"Not found","path":"{dir}/content/missing.md"}',
      allowedBy: D4,
      status: 404,
      code: 'SERVER_NOT_FOUND',
    },
    'browse no root': {
      before: '404 {"error":"Invalid path"}',
      allowedBy: D4,
      status: 404,
      code: 'SERVER_NOT_FOUND',
    },
    'browse traversal': {
      before: '400 {"error":"Invalid path"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_PATH',
    },
    'browse traversal backslash': {
      before: '400 {"error":"Invalid path"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_PATH',
    },
    'fileContent directory': {
      before: '400 {"error":"Use /api/path/ for directories"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_NOT_A_FILE',
    },
    'fileContent missing': {
      before: '404 {"error":"Not found"}',
      allowedBy: D4,
      status: 404,
      code: 'SERVER_NOT_FOUND',
    },
    'fileContent no root': {
      before: '404 {"error":"Invalid path"}',
      allowedBy: D4,
      status: 404,
      code: 'SERVER_NOT_FOUND',
    },
    'fileContent traversal': {
      before: '400 {"error":"Invalid path"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_PATH',
    },
    'fileContent traversal backslash': {
      before: '400 {"error":"Invalid path"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_PATH',
    },
    'fileContent empty path': {
      before: '400 {"error":"Path required"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_PATH',
    },
    'fileContent none': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'fileContent insider key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'fileContent scoped insider key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'fileContent scoped machine key out of scope': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'fileContent scoped session out of scope': {
      before: '403 {"error":"Path is outside your access scope"}',
      allowedBy: D4,
      status: 403,
      code: 'SERVER_OUT_OF_SCOPE',
    },
    'fileContent bad key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'fileContent expired share': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'fileContent share for another path': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'raw directory': {
      before:
        '400 {"error":"Cannot serve directory as raw — use /api/export for ZIP"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_NOT_A_FILE',
    },
    'raw missing': {
      before: '404 {"error":"Not found","path":"{dir}/content/missing.md"}',
      allowedBy: D4,
      status: 404,
      code: 'SERVER_NOT_FOUND',
    },
    'raw no root': {
      before: '404 {"error":"Invalid path"}',
      allowedBy: D4,
      status: 404,
      code: 'SERVER_NOT_FOUND',
    },
    'raw empty path': {
      before: '400 {"error":"Path required"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_PATH',
    },
    'raw png none': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'raw png scoped machine key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'linkInfo none': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'linkInfo no root': {
      before: '404 {"error":"Invalid path"}',
      allowedBy: D4,
      status: 404,
      code: 'SERVER_NOT_FOUND',
    },
    'linkInfo empty path': {
      before: '400 {"error":"Path required"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_PATH',
    },
    'fileWrite none': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'fileWrite path share': {
      before: '403 {"error":"Insider access required"}',
      allowedBy: D4,
      status: 403,
      code: 'SERVER_INSIDER_REQUIRED',
    },
    'fileWrite scoped session out of scope': {
      before: '403 {"error":"Path is outside your access scope"}',
      allowedBy: D4,
      status: 403,
      code: 'SERVER_OUT_OF_SCOPE',
    },
    'fileWrite no content': {
      before: '400 {"error":"Request body must include \\"content\\" string"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'fileWrite non-string content': {
      before: '400 {"error":"Request body must include \\"content\\" string"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'fileWrite directory': {
      before: '400 {"error":"Can only write to files"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_NOT_A_FILE',
    },
    'fileWrite missing': {
      before: '404 {"error":"File not found"}',
      allowedBy: D4,
      status: 404,
      code: 'SERVER_NOT_FOUND',
    },
    'fileWrite no root': {
      before: '404 {"error":"Invalid path"}',
      allowedBy: D4,
      status: 404,
      code: 'SERVER_NOT_FOUND',
    },
    'fileMutate toggle-checkbox out of range': {
      before: '400 {"error":"Checkbox index 9 out of range"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'fileMutate toggle-checkbox bad body': {
      before:
        '400 {"error":"toggle-checkbox requires index (number) and checked (boolean)"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'fileMutate edit-block reversed': {
      before: '400 {"error":"startLine must not exceed endLine"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'fileMutate edit-block out of bounds': {
      before: '400 {"error":"Line range out of bounds"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'fileMutate edit-block empty content': {
      before: '400 {"error":"content must not be empty"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'fileMutate edit-block missing fields': {
      before:
        '400 {"error":"edit-block requires startLine, endLine, and content"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'fileMutate delete-block missing fields': {
      before: '400 {"error":"delete-block requires startLine and endLine"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'fileMutate insert-block bad position': {
      before:
        '400 {"error":"insert-block requires atLine, content, and position (before|after)"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'fileMutate insert-block out of bounds': {
      before: '400 {"error":"atLine out of bounds"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'fileMutate edit-cell separator': {
      before: '400 {"error":"Cannot edit a separator row"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'fileMutate edit-cell bad column': {
      before: '400 {"error":"Column index out of bounds"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'fileMutate edit-cell missing fields': {
      before: '400 {"error":"edit-cell requires line, col, and content"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'fileMutate no action': {
      before: '400 {"error":"Missing action field"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'fileMutate unknown action': {
      before: '400 {"error":"Unknown action: explode"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'fileMutate array body': {
      before: '400 {"error":"Missing action field"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'fileMutate not markdown': {
      before: '400 {"error":"Only .md files are supported"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'fileMutate missing': {
      before: '404 {"error":"File not found"}',
      allowedBy: D4,
      status: 404,
      code: 'SERVER_NOT_FOUND',
    },
    'fileMutate none': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'fileMutate path share': {
      before: '403 {"error":"Insider access required"}',
      allowedBy: D4,
      status: 403,
      code: 'SERVER_INSIDER_REQUIRED',
    },
    'fileMutate scoped session out of scope': {
      before: '403 {"error":"Path is outside your access scope"}',
      allowedBy: D4,
      status: 403,
      code: 'SERVER_OUT_OF_SCOPE',
    },
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
      allowedBy: D4,
      status: 400,
      code: 'SERVER_EXPORT_UNSUPPORTED',
    },
    'export json pdf': {
      before: '400 {"error":"Only markdown files support PDF/DOCX export"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_EXPORT_UNSUPPORTED',
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
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
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
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
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
    'share none': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'share insider key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'share scoped machine key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'share path share': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'share missing path': {
      before: '400 {"error":"path is required"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'share scoped session out of scope': {
      before: '403 {"error":"Path is outside your access scope"}',
      allowedBy: D4,
      status: 403,
      code: 'SERVER_OUT_OF_SCOPE',
    },
    'shareFor none': {
      before: '401 {"error":"Insider auth required for utility endpoints"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'shareFor path share': {
      before: '401 {"error":"Insider auth required for utility endpoints"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'shareFor missing path': {
      before: '400 {"error":"path is required"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'shareFor insiders not an array': {
      before: '400 {"error":"insiders array is required"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'contentLink unknown': {
      before: '404 {"error":"nope.md not found"}',
      allowedBy: D4,
      status: 404,
      code: 'SERVER_NOT_FOUND',
    },
    'contentLink invalid name': {
      before: '400 {"error":"Invalid file name"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'resolvePath none': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'resolvePath insider key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'resolvePath scoped machine key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'resolvePath path share': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'resolvePath scoped machine key in scope': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'resolvePath missing fsPath': {
      before: '400 {"error":"fsPath query parameter required"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'resolvePath relative': {
      before: '400 {"error":"fsPath must be an absolute path"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_PATH',
    },
    'resolvePath outside roots': {
      before: '404 {"error":"Path does not fall under any configured root"}',
      allowedBy: D4,
      status: 404,
      code: 'SERVER_NOT_FOUND',
    },
    'rotateKey none': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'rotateKey insider key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'rotateKey machine key': {
      before: '403 {"error":"Insider auth required"}',
      allowedBy: D4,
      status: 403,
      code: 'SERVER_MACHINE_KEY_NOT_ROTATABLE',
    },
    'rotateKey scoped machine key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'rotateKey path share': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'search none': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'search session': {
      before: '502 {"error":"Watcher unreachable: TypeError: fetch failed"}',
      allowedBy: D4,
      status: 502,
      code: 'SERVER_WATCHER_UNAVAILABLE',
    },
    'search scoped session': {
      before: '502 {"error":"Watcher unreachable: TypeError: fetch failed"}',
      allowedBy: D4,
      status: 502,
      code: 'SERVER_WATCHER_UNAVAILABLE',
    },
    'search insider key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'search machine key': {
      before: '502 {"error":"Watcher unreachable: TypeError: fetch failed"}',
      allowedBy: D4,
      status: 502,
      code: 'SERVER_WATCHER_UNAVAILABLE',
    },
    'search scoped machine key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'search path share': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'search missing query': {
      before: '400 {"error":"query is required"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'searchFacets none': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'searchFacets session': {
      before: '502 {"error":"Failed to reach watcher","detail":"fetch failed"}',
      allowedBy: D4,
      status: 502,
      code: 'SERVER_WATCHER_UNAVAILABLE',
    },
    'searchFacets scoped session': {
      before: '502 {"error":"Failed to reach watcher","detail":"fetch failed"}',
      allowedBy: D4,
      status: 502,
      code: 'SERVER_WATCHER_UNAVAILABLE',
    },
    'searchFacets insider key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'searchFacets machine key': {
      before: '502 {"error":"Failed to reach watcher","detail":"fetch failed"}',
      allowedBy: D4,
      status: 502,
      code: 'SERVER_WATCHER_UNAVAILABLE',
    },
    'searchFacets scoped machine key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'searchFacets path share': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'listEvents none': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'listEvents scoped session': {
      before: '403 {"error":"Unscoped insider access required"}',
      allowedBy: D4,
      status: 403,
      code: 'SERVER_FORBIDDEN',
    },
    'listEvents insider key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'listEvents scoped machine key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'listEvents path share': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'oauthStart none': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'oauthStart insider key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'oauthStart scoped machine key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'oauthStart path share': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'oauthStart no client credentials': {
      before:
        '400 {"error":"provider, account, clientId, and clientSecret are required"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'oauthStart unknown provider': {
      before:
        '400 {"error":"authUrl and tokenUrl are required (either in request body or via named provider config)"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'oauthStart missing fields': {
      before:
        '400 {"error":"provider, account, clientId, and clientSecret are required"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'oauthStart invalid name': {
      before:
        '400 {"error":"provider and account may only contain letters, digits, \\".\\", \\"_\\", \\"-\\", \\"@\\" and \\"+\\", and may not be \\".\\" or \\"..\\""}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'oauthStart bad origin': {
      before: '400 {"error":"origin must be a valid URL"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'oauthToken expired': {
      before:
        '401 {"error":"refresh_failed","message":"Re-authorization required"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_OAUTH_REFRESH_FAILED',
    },
    'oauthToken missing file': {
      before: '404 {"error":"Credential file not found"}',
      allowedBy: D4,
      status: 404,
      code: 'SERVER_NOT_FOUND',
    },
    'oauthStatus missing params': {
      before: '400 {"error":"provider and account query params required"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'oauthToken missing params': {
      before: '400 {"error":"provider and account query params required"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'oauthStatus invalid name': {
      before:
        '400 {"error":"provider and account may only contain letters, digits, \\".\\", \\"_\\", \\"-\\", \\"@\\" and \\"+\\", and may not be \\".\\" or \\"..\\""}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'oauthToken invalid name': {
      before:
        '400 {"error":"provider and account may only contain letters, digits, \\".\\", \\"_\\", \\"-\\", \\"@\\" and \\"+\\", and may not be \\".\\" or \\"..\\""}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'oauthStatus none': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'oauthToken scoped machine key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'runner GET /api/runner/jobs': {
      before: '502 {"error":"Runner unreachable"}',
      allowedBy: D4_RUNNER,
      status: 503,
      code: 'SERVER_RUNNER_UNAVAILABLE',
    },
    'runner GET /api/runner/jobs/alpha': {
      before: '502 {"error":"Runner unreachable"}',
      allowedBy: D4_RUNNER,
      status: 503,
      code: 'SERVER_RUNNER_UNAVAILABLE',
    },
    'runner GET /api/runner/jobs/alpha/runs?limit=5': {
      before: '502 {"error":"Runner unreachable"}',
      allowedBy: D4_RUNNER,
      status: 503,
      code: 'SERVER_RUNNER_UNAVAILABLE',
    },
    'runner POST /api/runner/jobs/alpha/run': {
      before: '502 {"error":"Runner unreachable"}',
      allowedBy: D4_RUNNER,
      status: 503,
      code: 'SERVER_RUNNER_UNAVAILABLE',
    },
    'runner POST /api/runner/jobs/alpha/enable': {
      before: '502 {"error":"Runner unreachable"}',
      allowedBy: D4_RUNNER,
      status: 503,
      code: 'SERVER_RUNNER_UNAVAILABLE',
    },
    'runner POST /api/runner/jobs/alpha/disable': {
      before: '502 {"error":"Runner unreachable"}',
      allowedBy: D4_RUNNER,
      status: 503,
      code: 'SERVER_RUNNER_UNAVAILABLE',
    },
    'runner GET /api/runner/status': {
      before: '502 {"error":"Runner unreachable"}',
      allowedBy: D4_RUNNER,
      status: 503,
      code: 'SERVER_RUNNER_UNAVAILABLE',
    },
    'runner jobs none': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'runner jobs session': {
      before: '502 {"error":"Runner unreachable"}',
      allowedBy: D4_RUNNER,
      status: 503,
      code: 'SERVER_RUNNER_UNAVAILABLE',
    },
    'runner jobs scoped session': {
      before: '502 {"error":"Runner unreachable"}',
      allowedBy: D4_RUNNER,
      status: 503,
      code: 'SERVER_RUNNER_UNAVAILABLE',
    },
    'runner jobs insider key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'runner jobs machine key': {
      before: '502 {"error":"Runner unreachable"}',
      allowedBy: D4_RUNNER,
      status: 503,
      code: 'SERVER_RUNNER_UNAVAILABLE',
    },
    'runner jobs scoped machine key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'runner jobs path share': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'runner unknown route': {
      before: '404 {"error":"Not found"}',
      allowedBy: D4,
      status: 404,
      code: 'SERVER_NOT_FOUND',
    },
  };
