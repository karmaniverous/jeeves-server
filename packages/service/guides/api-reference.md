---
title: API Reference
---

<!-- Generated from SERVER_CATALOG by `npm run api-reference` (packages/service). Do not edit: the drift test fails until the file is regenerated. -->

# API Reference

Every machine-API route of jeeves-server is an entry of its endpoint catalog, `SERVER_CATALOG` in `@karmaniverous/jeeves-server-core`. This page is generated from it. The same catalog yields `GET /openapi.json` (served without credentials, also shipped as `@karmaniverous/jeeves-server-core/openapi.json`), the SDK (`createServerClient` in `@karmaniverous/jeeves-server-sdk`, one method per entry, named as the headings below) and the OpenClaw plugin's tools.

- **Requests are validated** against the entry's schemas; a request that fails gets `400` with code `FST_ERR_VALIDATION`.
- **Errors** share one body, `{ statusCode, code?, error, message }`; the `SERVER_*` codes are listed in [API & Integration: Errors](./api-integration.md#errors).
- **Credentials:** an insider, machine or share key as the `k` query parameter, or the `jeeves_session` cookie; the key-exchange routes (`/key`, `/insider-key`) take the raw machine seed in `X-API-Key`. Each entry's **Access** line says which it accepts (see [Insiders, Outsiders & Sharing](./sharing.md)).

## Share credentials

Navigation and content entries also accept a share link's query parameters: `k` (the path key), `exp` (expiry, Unix ms, for expiring links), `d`, `dirs` and `s` (deep shares) and `key` (legacy name of `k`). A share link's parameters work unchanged on every route under the same path: replace `/browse/` with `/api/raw/` or `/api/export/` and keep the query string.

## Entries

| Entry | Method | Path | Access |
| --- | --- | --- | --- |
| [`status`](#status) | `GET` | `/status` | public |
| [`config`](#config) | `GET` | `/config` | admin |
| [`configApply`](#configapply) | `POST` | `/config/apply` | admin |
| [`health`](#health) | `GET` | `/health` | public |
| [`authStatus`](#authstatus) | `GET` | `/api/auth/status` | public |
| [`sendMagicLink`](#sendmagiclink) | `POST` | `/api/auth/magic` | public |
| [`pathKey`](#pathkey) | `GET` | `/key` | machineSeed |
| [`insiderKey`](#insiderkey) | `GET` | `/insider-key` | machineSeed |
| [`search`](#search) | `POST` | `/api/search` | insider |
| [`searchFacets`](#searchfacets) | `GET` | `/api/search/facets` | insider |
| [`drives`](#drives) | `GET` | `/api/drives` | navigation |
| [`browse`](#browse) | `GET` | `/api/path/*` | navigation |
| [`fileContent`](#filecontent) | `GET` | `/api/file/*` | content |
| [`fileWrite`](#filewrite) | `PUT` | `/api/file/*` | content+insider |
| [`fileMutate`](#filemutate) | `POST` | `/api/file/*` | content+insider |
| [`raw`](#raw) | `GET` | `/api/raw/*` | content |
| [`export`](#export) | `GET` | `/api/export/*` | content |
| [`exportCacheClear`](#exportcacheclear) | `DELETE` | `/api/export-cache/*` | content+insider |
| [`exportMermaid`](#exportmermaid) | `GET` | `/api/mermaid-export/*` | content |
| [`exportPlantUml`](#exportplantuml) | `GET` | `/api/plantuml-export/*` | content |
| [`linkInfo`](#linkinfo) | `GET` | `/api/link-info/*` | navigation |
| [`diagram`](#diagram) | `GET` | `/api/diagram/:type/:hash` | public |
| [`publicContent`](#publiccontent) | `GET` | `/api/public-content/:slug` | public |
| [`share`](#share) | `POST` | `/api/share` | insider |
| [`shareFor`](#sharefor) | `POST` | `/api/util/share-for` | insider |
| [`contentLink`](#contentlink) | `GET` | `/api/content-link/:file` | public |
| [`readmeLink`](#readmelink) | `GET` | `/api/readme-link` | public |
| [`resolvePath`](#resolvepath) | `GET` | `/api/resolve-path` | insider |
| [`rotateKey`](#rotatekey) | `POST` | `/api/rotate-key` | insider |
| [`receiveEvent`](#receiveevent) | `POST` | `/event` | eventKey |
| [`listEvents`](#listevents) | `GET` | `/api/events` | admin |
| [`oauthStart`](#oauthstart) | `POST` | `/api/oauth/start` | insider |
| [`oauthStatus`](#oauthstatus) | `GET` | `/api/oauth/status` | insider |
| [`oauthToken`](#oauthtoken) | `GET` | `/api/oauth/token` | insider |
| [`runnerGet`](#runnerget) | `GET` | `/api/runner/*` | insider |
| [`runnerPost`](#runnerpost) | `POST` | `/api/runner/*` | insider |
| [`runnerPatch`](#runnerpatch) | `PATCH` | `/api/runner/*` | insider |
| [`runnerPut`](#runnerput) | `PUT` | `/api/runner/*` | insider |
| [`runnerDelete`](#runnerdelete) | `DELETE` | `/api/runner/*` | insider |

### status

`GET /status`

Get server service health, version, and uptime.

**Access:** `public`: anyone (a credential, when sent, is resolved but never refused).

**Response** (JSON):

| Field | Type | Description |
| --- | --- | --- |
| `name` | `string` |  |
| `version` | `string` |  |
| `uptime` | `number` |  |
| `status` | `"healthy" \| "degraded" \| "unhealthy"` |  |
| `health` | `object` |  |

### config

`GET /config`

Query server running configuration. Optional JSONPath filter.

**Access:** `admin`: an identity with no scopes configured (an unscoped insider session or machine key).

**Request:**

| Field | In | Type | Description |
| --- | --- | --- | --- |
| `path` | query | `string` (optional) | JSONPath expression (optional) |

**Response:** `object` (JSON).

### configApply

`POST /config/apply`

Apply a config patch to the running server service.

**Access:** `admin`: an identity with no scopes configured (an unscoped insider session or machine key).

**Request:**

| Field | In | Type | Description |
| --- | --- | --- | --- |
| `patch` | body | `object` | Config patch to apply |
| `replace` | body | `boolean` (optional) | Replace the whole config instead of merging |

**Response** (JSON):

| Field | Type | Description |
| --- | --- | --- |
| `applied` | `true` |  |
| `config` | `object` |  |
| `warning` | `string` (optional) |  |

### health

`GET /health`

Liveness check: returns { ok: true }, with no downstream checks.

**Access:** `public`: anyone (a credential, when sent, is resolved but never refused).

**Response** (JSON):

| Field | Type | Description |
| --- | --- | --- |
| `ok` | `true` |  |

### authStatus

`GET /api/auth/status`

Check current authentication status. Returns whether authenticated, email, insider status, and key metadata.

**Access:** `public`: anyone (a credential, when sent, is resolved but never refused).

**Request:**

| Field | In | Type | Description |
| --- | --- | --- | --- |
| `path` | query | `string` (optional) | Path a share credential is verified against (default /). |

**Response** (JSON):

| Field | Type | Description |
| --- | --- | --- |
| `authenticated` | `boolean` |  |
| `email` | `string` (optional) |  |
| `picture` | `string` (optional) |  |
| `isInsider` | `boolean` |  |
| `keyCreatedAt` | `string \| null` (optional) |  |
| `searchEnabled` | `boolean` (optional) |  |

### sendMagicLink

`POST /api/auth/magic`

Request a sign-in link by email. Always answers with a verification URL, whether or not the email belongs to an insider.

**Access:** `public`: anyone (a credential, when sent, is resolved but never refused).

**Request:**

| Field | In | Type | Description |
| --- | --- | --- | --- |
| `email` | body | `string` (optional) | Email address to sign in with. |
| `returnTo` | body | `string` (optional) | Page to open after sign-in (server-relative). |

**Response** (JSON):

| Field | Type | Description |
| --- | --- | --- |
| `verifyUrl` | `string` |  |

### pathKey

`GET /key`

Compute the outsider path key for a path from the machine seed sent in X-API-Key.

**Access:** `machineSeed`: the raw machine seed in the `X-API-Key` header.

**Request:**

| Field | In | Type | Description |
| --- | --- | --- | --- |
| `path` | query | `string` | Path to compute the outsider key for. |

**Response** (JSON):

| Field | Type | Description |
| --- | --- | --- |
| `path` | `string` |  |
| `key` | `string` |  |

### insiderKey

`GET /insider-key`

Compute the insider key for the machine seed sent in X-API-Key.

**Access:** `machineSeed`: the raw machine seed in the `X-API-Key` header.

**Response** (JSON):

| Field | Type | Description |
| --- | --- | --- |
| `key` | `string` |  |

### search

`POST /api/search`

Semantic search through jeeves-watcher, grouped by file and filtered to the scopes of the caller.

**Access:** `insider`: an identity (session or insider/machine key); every path the request addresses must be in its scopes.

**Request:**

| Field | In | Type | Description |
| --- | --- | --- | --- |
| `query` | body | `string` | Search text. |
| `limit` | body | `integer` (optional) | Files to return (default 20). |
| `filter` | body | `object` (optional) | Qdrant filter, passed to jeeves-watcher. |

**Response** (JSON):

| Field | Type | Description |
| --- | --- | --- |
| `results` | `object[]` |  |
| `metadata` | `object` |  |

### searchFacets

`GET /api/search/facets`

Search facets from jeeves-watcher, passed through unchanged.

**Access:** `insider`: an identity (session or insider/machine key); every path the request addresses must be in its scopes.

**Response:** `unknown` (JSON).

### drives

`GET /api/drives`

List available root drives/labels configured on the server.

**Access:** `navigation`: an identity, or a share credential for the path; the path or a non-denied ancestor of an allowed pattern must be in scope.

Also accepts the share-link query parameters (`k`, `exp`, `d`, `dirs`, `s`); see [Share credentials](#share-credentials).

**Response:** `object[]` (JSON).

### browse

`GET /api/path/*`

Get file or directory metadata. For files: size, mtime, content type, rendered HTML availability. For directories: listing of entries.

**Access:** `navigation`: an identity, or a share credential for the path; the path or a non-denied ancestor of an allowed pattern must be in scope.

**Request:**

| Field | In | Type | Description |
| --- | --- | --- | --- |
| `*` | path | `string` | Browse path (e.g. "<drive>/path/to/dir") |

Also accepts the share-link query parameters (`k`, `exp`, `d`, `dirs`, `s`); see [Share credentials](#share-credentials).

**Response:** `object` (JSON).

### fileContent

`GET /api/file/*`

Get a file with type-specific handling: Markdown, CSV and diagrams rendered to HTML, other text as is, images and binaries by name. `raw=1` skips rendering.

**Access:** `content`: an identity, or a share credential for the path; the path itself must be in scope.

**Request:**

| Field | In | Type | Description |
| --- | --- | --- | --- |
| `*` | path | `string` | Browse path (e.g. "<drive>/path/to/file.md") |
| `raw` | query | `string` (optional) | 1: return the source without rendering it. |
| `render_diagrams` | query | `string` (optional) | 1: render embedded diagrams into the HTML. |

Also accepts the share-link query parameters (`k`, `exp`, `d`, `dirs`, `s`); see [Share credentials](#share-credentials).

**Response** (JSON):

| Field | Type | Description |
| --- | --- | --- |
| `type` | `"markdown" \| "mermaid" \| "plantuml" \| "svg" \| "csv" \| "text" \| "image" \| "binary"` |  |
| `content` | `string` (optional) |  |
| `html` | `string \| null` (optional) |  |
| `headings` | `object[]` (optional) |  |
| `size` | `number` (optional) |  |
| `fileName` | `string` |  |
| `breadcrumbs` | `object[]` |  |
| `isInsider` | `boolean` |  |
| `mtime` | `number` (optional) |  |
| `renderAs` | `string` (optional) |  |
| `matchedRules` | `string[]` (optional) |  |
| `title` | `string` (optional) |  |

### fileWrite

`PUT /api/file/*`

Overwrite the content of an existing file. Insider-only; the file must already exist.

**Access:** `content+insider`: an identity (session or insider/machine key) whose scopes cover the path; share credentials are refused.

**Request:**

| Field | In | Type | Description |
| --- | --- | --- | --- |
| `*` | path | `string` | Browse path (e.g. "<drive>/path/to/file.md") |
| `content` | body | `string` | New file content |

**Response** (JSON):

| Field | Type | Description |
| --- | --- | --- |
| `ok` | `true` |  |
| `path` | `string` |  |
| `size` | `number` |  |

### fileMutate

`POST /api/file/*`

Apply a structured mutation to a .md file. Insider-only. Supports: edit-block, delete-block, insert-block, edit-cell, toggle-checkbox.

**Access:** `content+insider`: an identity (session or insider/machine key) whose scopes cover the path; share credentials are refused.

**Request:**

| Field | In | Type | Description |
| --- | --- | --- | --- |
| `*` | path | `string` | File path (must be a .md file) |
| `action` | body | `"edit-block" \| "delete-block" \| "insert-block" \| "edit-cell" \| "toggle-checkbox"` | Mutation action to perform |
| `startLine` | body | `integer` (optional) | Start line (1-based) for edit-block/delete-block |
| `endLine` | body | `integer` (optional) | End line (1-based) for edit-block/delete-block |
| `content` | body | `string` (optional) | Content for edit-block, insert-block, or edit-cell |
| `atLine` | body | `integer` (optional) | Target line (1-based) for insert-block |
| `position` | body | `"before" \| "after"` (optional) | Insert position for insert-block |
| `context` | body | `string` (optional) | Optional context for insert-block (e.g. "table-row") |
| `line` | body | `integer` (optional) | Line number (1-based) for edit-cell |
| `col` | body | `integer` (optional) | Column index (0-based) for edit-cell |
| `index` | body | `integer` (optional) | Checkbox index (0-based) for toggle-checkbox |
| `checked` | body | `boolean` (optional) | Desired checked state for toggle-checkbox |

**Response** (JSON):

| Field | Type | Description |
| --- | --- | --- |
| `ok` | `true` |  |

### raw

`GET /api/raw/*`

Download a file as is, with its own content type. `download=1` always sends it as an attachment.

**Access:** `content`: an identity, or a share credential for the path; the path itself must be in scope.

**Request:**

| Field | In | Type | Description |
| --- | --- | --- | --- |
| `*` | path | `string` | Browse path (e.g. "<drive>/path/to/file.md") |
| `download` | query | `string` (optional) | 1 (or true): send Content-Disposition: attachment for any file type. |

Also accepts the share-link query parameters (`k`, `exp`, `d`, `dirs`, `s`); see [Share credentials](#share-credentials).

**Response:** `application/octet-stream` bytes.

### export

`GET /api/export/*`

Export a Markdown document as PDF or DOCX, or a directory as a ZIP or Tar archive (archives for insiders only).

**Access:** `content`: an identity, or a share credential for the path; the path itself must be in scope.

**Request:**

| Field | In | Type | Description |
| --- | --- | --- | --- |
| `*` | path | `string` | Browse path (e.g. "<drive>/path/to/file.md") |
| `format` | query | `"pdf" \| "docx" \| "zip" \| "tar"` (optional) | pdf (default) or docx for Markdown documents; zip or tar for directories. |

Also accepts the share-link query parameters (`k`, `exp`, `d`, `dirs`, `s`); see [Share credentials](#share-credentials).

**Response:** `application/octet-stream` bytes.

### exportCacheClear

`DELETE /api/export-cache/*`

Clear the export and diagram caches for a given path.

**Access:** `content+insider`: an identity (session or insider/machine key) whose scopes cover the path; share credentials are refused.

**Request:**

| Field | In | Type | Description |
| --- | --- | --- | --- |
| `*` | path | `string` | Browse path to clear caches for |

**Response** (JSON):

| Field | Type | Description |
| --- | --- | --- |
| `cleared` | `object` |  |

### exportMermaid

`GET /api/mermaid-export/*`

Export a Mermaid diagram file as SVG, PNG or PDF.

**Access:** `content`: an identity, or a share credential for the path; the path itself must be in scope.

**Request:**

| Field | In | Type | Description |
| --- | --- | --- | --- |
| `*` | path | `string` | Browse path (e.g. "<drive>/path/to/file.md") |
| `format` | query | `string` (optional) | svg (default), png or pdf. |

Also accepts the share-link query parameters (`k`, `exp`, `d`, `dirs`, `s`); see [Share credentials](#share-credentials).

**Response:** `application/octet-stream` bytes.

### exportPlantUml

`GET /api/plantuml-export/*`

Export a PlantUML diagram file in one of the formats the configured renderers support (SVG, PNG, PDF, EPS).

**Access:** `content`: an identity, or a share credential for the path; the path itself must be in scope.

**Request:**

| Field | In | Type | Description |
| --- | --- | --- | --- |
| `*` | path | `string` | Browse path (e.g. "<drive>/path/to/file.md") |
| `format` | query | `string` (optional) | svg (default), or another format the renderers support (png, pdf, eps). |

Also accepts the share-link query parameters (`k`, `exp`, `d`, `dirs`, `s`); see [Share credentials](#share-credentials).

**Response:** `application/octet-stream` bytes.

### linkInfo

`GET /api/link-info/*`

Query available link types for a path (exists, page URL, raw URL, export links for PDF/DOCX/SVG/PNG).

**Access:** `navigation`: an identity, or a share credential for the path; the path or a non-denied ancestor of an allowed pattern must be in scope.

**Request:**

| Field | In | Type | Description |
| --- | --- | --- | --- |
| `*` | path | `string` | Browse path (e.g. "<drive>/path/to/file.md") |

Also accepts the share-link query parameters (`k`, `exp`, `d`, `dirs`, `s`); see [Share credentials](#share-credentials).

**Response** (JSON):

| Field | Type | Description |
| --- | --- | --- |
| `exists` | `boolean` |  |
| `isDirectory` | `boolean` (optional) |  |
| `pageUrl` | `string` (optional) |  |
| `rawUrl` | `string \| null` (optional) |  |
| `downloadUrl` | `string \| null` (optional) |  |
| `exportLinks` | `object[]` (optional) |  |

### diagram

`GET /api/diagram/:type/:hash`

Get a diagram embedded in a rendered document, as SVG, by its type and content hash.

**Access:** `public`: anyone (a credential, when sent, is resolved but never refused).

**Request:**

| Field | In | Type | Description |
| --- | --- | --- | --- |
| `type` | path | `"mermaid" \| "plantuml"` | Diagram type. |
| `hash` | path | `string` | SHA-256 of the diagram source (hex), optionally with .svg. |

**Response:** `image/svg+xml` bytes.

### publicContent

`GET /api/public-content/:slug`

Get one of the public pages of the server (readme, privacy, terms) rendered as Markdown.

**Access:** `public`: anyone (a credential, when sent, is resolved but never refused).

**Request:**

| Field | In | Type | Description |
| --- | --- | --- | --- |
| `slug` | path | `string` | Page: readme, privacy or terms. |

**Response** (JSON):

| Field | Type | Description |
| --- | --- | --- |
| `type` | `"markdown" \| "mermaid" \| "plantuml" \| "svg" \| "csv" \| "text" \| "image" \| "binary"` |  |
| `content` | `string` (optional) |  |
| `html` | `string \| null` (optional) |  |
| `headings` | `object[]` (optional) |  |
| `size` | `number` (optional) |  |
| `fileName` | `string` |  |
| `breadcrumbs` | `object[]` |  |
| `isInsider` | `boolean` |  |
| `mtime` | `number` (optional) |  |
| `renderAs` | `string` (optional) |  |
| `matchedRules` | `string[]` (optional) |  |
| `title` | `string` (optional) |  |

### share

`POST /api/share`

Sign a share link for a path: a path key, optionally expiring, or a deep share (`depth`, `dirs`). The response reports whether the path is a directory.

**Access:** `insider`: an identity (session or insider/machine key); every path the request addresses must be in its scopes.

**Request:**

| Field | In | Type | Description |
| --- | --- | --- | --- |
| `path` | body | `string` | Path to share (/<root>/<path>). |
| `expiry` | body | `string` (optional) | Expiry (Unix milliseconds); omit for no expiry. |
| `depth` | body | `integer` (optional) | Deep share depth. |
| `dirs` | body | `boolean` (optional) | Deep share: directories below the path may be opened. |

**Response** (JSON):

| Field | Type | Description |
| --- | --- | --- |
| `url` | `string` |  |
| `path` | `string` |  |
| `exp` | `string \| null` |  |
| `depth` | `number` |  |
| `dirs` | `boolean` |  |
| `isDirectory` | `boolean` |  |

### shareFor

`POST /api/util/share-for`

Sign a share link for a path aimed at named insiders: an insider link when every recipient is an insider with access, else an outsider share checked against the outsider policy.

**Access:** `insider`: an identity (session or insider/machine key); every path the request addresses must be in its scopes; also the insider-seed insider key.

**Request:**

| Field | In | Type | Description |
| --- | --- | --- | --- |
| `path` | body | `string` | Path to share (/<root>/<path>). |
| `insiders` | body | `string[]` | Recipients: insider emails; anyone else is an outsider. |
| `depth` | body | `integer` (optional) | Deep share depth. |
| `dirs` | body | `boolean` (optional) | Deep share: directories below the path may be opened. |
| `enforceOutsiderPolicy` | body | `boolean` (optional) | false: sign even where the outsider policy denies. |

**Response** (JSON):

| Field | Type | Description |
| --- | --- | --- |
| `url` | `string \| null` |  |
| `type` | `"insider" \| "outsider-share" \| "blocked" \| "policy-denied"` |  |
| `reason` | `string` (optional) |  |
| `blocked` | `string[]` (optional) |  |
| `warning` | `string` (optional) |  |

### contentLink

`GET /api/content-link/:file`

Pre-computed share link for one of the pinned content pages of the server (privacy, terms).

**Access:** `public`: anyone (a credential, when sent, is resolved but never refused).

**Request:**

| Field | In | Type | Description |
| --- | --- | --- | --- |
| `file` | path | `string` | Content page: privacy or terms. |

**Response** (JSON):

| Field | Type | Description |
| --- | --- | --- |
| `url` | `string` |  |

### readmeLink

`GET /api/readme-link`

Pre-computed share link for the README of the server.

**Access:** `public`: anyone (a credential, when sent, is resolved but never refused).

**Response** (JSON):

| Field | Type | Description |
| --- | --- | --- |
| `url` | `string` |  |

### resolvePath

`GET /api/resolve-path`

Convert an absolute filesystem path to a server browse path and optional public URL.

**Access:** `insider`: an identity (session or insider/machine key); every path the request addresses must be in its scopes.

**Request:**

| Field | In | Type | Description |
| --- | --- | --- | --- |
| `fsPath` | query | `string` | Absolute filesystem path to resolve |

**Response** (JSON):

| Field | Type | Description |
| --- | --- | --- |
| `browsePath` | `string` |  |
| `browseUrl` | `string` |  |
| `publicUrl` | `string` (optional) |  |

### rotateKey

`POST /api/rotate-key`

Rotate the key of the calling insider. The old insider key and every outsider link the insider signed stop working.

**Access:** `insider`: an identity (session or insider/machine key); every path the request addresses must be in its scopes; also the insider-seed insider key.

**Response** (JSON):

| Field | Type | Description |
| --- | --- | --- |
| `ok` | `true` |  |
| `keyCreatedAt` | `string` |  |
| `invalidates` | `"insiderKey" \| "outsiderLinks"[]` |  |

### receiveEvent

`POST /event`

Event gateway webhook receiver: matches a JSON object against the configured event schemas and queues the matching command.

**Access:** `eventKey`: a machine key valid for `/event`, as `k`.

**Response** (JSON):

| Field | Type | Description |
| --- | --- | --- |
| `matched` | `string \| null` |  |

### listEvents

`GET /api/events`

Recent event log entries, newest last (insiders with no scopes configured; limit capped at 100).

**Access:** `admin`: an identity with no scopes configured (an unscoped insider session or machine key).

**Request:**

| Field | In | Type | Description |
| --- | --- | --- | --- |
| `limit` | query | `string` (optional) | Entries to return (default 20, at most 100). |

**Response:** `object[]` (JSON).

### oauthStart

`POST /api/oauth/start`

Start an OAuth2 authorization code flow; returns the URL to open in a browser.

**Access:** `insider`: an identity (session or insider/machine key); every path the request addresses must be in its scopes.

**Request:**

| Field | In | Type | Description |
| --- | --- | --- | --- |
| `provider` | body | `string` | Provider name. |
| `account` | body | `string` | Account name. |
| `authUrl` | body | `string` (optional) | Authorization endpoint URL. |
| `tokenUrl` | body | `string` (optional) | Token endpoint URL. |
| `clientId` | body | `string` | OAuth client id. |
| `clientSecret` | body | `string` | OAuth client secret. |
| `scopes` | body | `string[]` (optional) | Scopes to request. |
| `pkce` | body | `boolean` (optional) | Use PKCE. |
| `origin` | body | `string` (optional) | Origin for the redirect URI (default: the public URL). |

**Response** (JSON):

| Field | Type | Description |
| --- | --- | --- |
| `authUrl` | `string` |  |
| `state` | `string` |  |

### oauthStatus

`GET /api/oauth/status`

Check whether valid OAuth2 credentials exist for a provider/account.

**Access:** `insider`: an identity (session or insider/machine key); every path the request addresses must be in its scopes.

**Request:**

| Field | In | Type | Description |
| --- | --- | --- | --- |
| `provider` | query | `string` | Provider name. |
| `account` | query | `string` | Account name. |

**Response** (JSON):

| Field | Type | Description |
| --- | --- | --- |
| `exists` | `boolean` |  |
| `expired` | `boolean` |  |
| `provider` | `string` |  |
| `account` | `string` |  |

### oauthToken

`GET /api/oauth/token`

Get a valid access token for a provider/account, refreshing it when expired.

**Access:** `insider`: an identity (session or insider/machine key); every path the request addresses must be in its scopes.

**Request:**

| Field | In | Type | Description |
| --- | --- | --- | --- |
| `provider` | query | `string` | Provider name. |
| `account` | query | `string` | Account name. |

**Response** (JSON):

| Field | Type | Description |
| --- | --- | --- |
| `access_token` | `string` |  |
| `token_type` | `string` |  |
| `expires_in_seconds` | `number \| null` |  |

### runnerGet

`GET /api/runner/*`

Pass-through GET to the jeeves-runner API.

**Access:** `insider`: an identity (session or insider/machine key); every path the request addresses must be in its scopes.

**Request:**

| Field | In | Type | Description |
| --- | --- | --- | --- |
| `*` | path | `string` | Runner API path (e.g. "jobs/alpha/runs"). |

**Response:** `unknown` (JSON).

### runnerPost

`POST /api/runner/*`

Pass-through POST to the jeeves-runner API.

**Access:** `insider`: an identity (session or insider/machine key); every path the request addresses must be in its scopes.

**Request:**

| Field | In | Type | Description |
| --- | --- | --- | --- |
| `*` | path | `string` | Runner API path (e.g. "jobs/alpha/runs"). |

**Response:** `unknown` (JSON).

### runnerPatch

`PATCH /api/runner/*`

Pass-through PATCH to the jeeves-runner API.

**Access:** `insider`: an identity (session or insider/machine key); every path the request addresses must be in its scopes.

**Request:**

| Field | In | Type | Description |
| --- | --- | --- | --- |
| `*` | path | `string` | Runner API path (e.g. "jobs/alpha/runs"). |

**Response:** `unknown` (JSON).

### runnerPut

`PUT /api/runner/*`

Pass-through PUT to the jeeves-runner API.

**Access:** `insider`: an identity (session or insider/machine key); every path the request addresses must be in its scopes.

**Request:**

| Field | In | Type | Description |
| --- | --- | --- | --- |
| `*` | path | `string` | Runner API path (e.g. "jobs/alpha/runs"). |

**Response:** `unknown` (JSON).

### runnerDelete

`DELETE /api/runner/*`

Pass-through DELETE to the jeeves-runner API.

**Access:** `insider`: an identity (session or insider/machine key); every path the request addresses must be in its scopes.

**Request:**

| Field | In | Type | Description |
| --- | --- | --- | --- |
| `*` | path | `string` | Runner API path (e.g. "jobs/alpha/runs"). |

**Response:** `unknown` (JSON).
