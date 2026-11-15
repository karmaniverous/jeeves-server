/**
 * Descriptions of jeeves-server's own (non-standard) catalog entries, keyed by entry name: one wording for OpenAPI, the SDK and the plugin's tools. Pure data.
 *
 * @remarks
 * The entries behind today's plugin tools (`browse`, `linkInfo`,
 * `fileWrite`, `fileMutate`, `exportCacheClear`, `drives`, `authStatus`,
 * `resolvePath`) keep the tools' descriptions, so the tools read the same
 * once they are built from the catalog.
 *
 * @packageDocumentation
 */

/** Description of each entry, keyed by entry name. */
export const ENTRY_DESCRIPTIONS = {
  health: 'Liveness check: returns { ok: true }, with no downstream checks.',
  authStatus:
    'Check current authentication status. Returns whether authenticated, email, insider status, and key metadata.',
  sendMagicLink:
    'Request a sign-in link by email. Always answers with a verification URL, whether or not the email belongs to an insider.',
  drives: 'List available root drives/labels configured on the server.',
  browse:
    'Get file or directory metadata. For files: size, mtime, content type, rendered HTML availability. For directories: listing of entries.',
  fileContent:
    'Get a file with type-specific handling: Markdown, CSV and diagrams rendered to HTML, other text as is, images and binaries by name. `raw=1` skips rendering.',
  fileWrite:
    'Overwrite the content of an existing file. Insider-only; the file must already exist.',
  fileMutate:
    'Apply a structured mutation to a .md file. Insider-only. Supports: edit-block, delete-block, insert-block, edit-cell, toggle-checkbox.',
  raw: 'Download a file as is, with its own content type. `download=1` always sends it as an attachment.',
  export:
    'Export a Markdown document as PDF or DOCX, or a directory as a ZIP or Tar archive (archives for insiders only).',
  exportCacheClear: 'Clear the export and diagram caches for a given path.',
  exportMermaid: 'Export a Mermaid diagram file as SVG, PNG or PDF.',
  exportPlantUml:
    'Export a PlantUML diagram file in one of the formats the configured renderers support (SVG, PNG, PDF, EPS).',
  linkInfo:
    'Query available link types for a path (exists, page URL, raw URL, export links for PDF/DOCX/SVG/PNG).',
  diagram:
    'Get a diagram embedded in a rendered document, as SVG, by its type and content hash.',
  publicContent:
    'Get one of the public pages of the server (readme, privacy, terms) rendered as Markdown.',
  share:
    'Sign a share link for a path: a path key, optionally expiring, or a deep share (`depth`, `dirs`). The response reports whether the path is a directory.',
  shareFor:
    'Sign a share link for a path aimed at named insiders: an insider link when every recipient is an insider with access, else an outsider share checked against the outsider policy.',
  contentLink:
    'Pre-computed share link for one of the pinned content pages of the server (privacy, terms).',
  readmeLink: 'Pre-computed share link for the README of the server.',
  resolvePath:
    'Convert an absolute filesystem path to a server browse path and optional public URL.',
  rotateKey:
    'Rotate the key of the calling insider. The old insider key and every outsider link the insider signed stop working.',
  pathKey:
    'Compute the outsider path key for a path from the machine seed sent in X-API-Key.',
  insiderKey: 'Compute the insider key for the machine seed sent in X-API-Key.',
  search:
    'Semantic search through jeeves-watcher, grouped by file and filtered to the scopes of the caller.',
  searchFacets: 'Search facets from jeeves-watcher, passed through unchanged.',
  receiveEvent:
    'Event gateway webhook receiver: matches a JSON object against the configured event schemas and queues the matching command.',
  listEvents:
    'Recent event log entries, newest last (insiders with no scopes configured; limit capped at 100).',
  oauthStart:
    'Start an OAuth2 authorization code flow; returns the URL to open in a browser.',
  oauthStatus:
    'Check whether valid OAuth2 credentials exist for a provider/account.',
  oauthToken:
    'Get a valid access token for a provider/account, refreshing it when expired.',
  runnerListJobs: 'List the jeeves-runner jobs (runner GET /jobs).',
  runnerGetJob: 'One jeeves-runner job (runner GET /jobs/:id).',
  runnerListRuns:
    "A jeeves-runner job's recent runs (runner GET /jobs/:id/runs).",
  runnerRunJob: 'Run a jeeves-runner job now (runner POST /jobs/:id/run).',
  runnerEnableJob:
    'Enable a jeeves-runner job (runner PATCH /jobs/:id/enable).',
  runnerDisableJob:
    'Disable a jeeves-runner job (runner PATCH /jobs/:id/disable).',
  runnerStatus: 'jeeves-runner status (runner GET /status).',
} as const;
