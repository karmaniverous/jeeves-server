---
title: Migrating to 3.16
---

# Migrating to 3.16

jeeves-server 3.16.0 ships breaking API changes in a minor version: major version 4.0.0 is reserved for the release aligned with OpenClaw's stable release. It is released together with `@karmaniverous/jeeves-server-openclaw` 0.16.0, `@karmaniverous/jeeves-server-core` 0.5.0 and the new `@karmaniverous/jeeves-server-sdk` 0.1.0. This guide lists what changes for operators, API clients and plugin users.

## Upgrade checklist

1. **Node.js 24.22.2 or later** on every host (all four packages declare `engines.node: ">=24.22.2"`; the CLI exits with an error on an older Node).
2. **Upgrade the server and the plugin together.** A 3.15 server with the 0.16 plugin or SDK, or a 3.16 server with the 0.15 plugin, is not supported.
3. **Admin insiders:** remove `scopes` (and `allow`/`deny`) from the insider entries of the people who manage the server (`/config` is now admin-only, see [below](#config-and-configapply-are-admin-only)). Keep `keys._plugin` unscoped (the schema already requires it).
4. **CLI:** `jeeves-server config` and `config apply` now need a key (`--key`, `JEEVES_SERVER_KEY`, or `--config` pointing at the server config).
5. **Clients that parse error bodies** branch on `code` instead of `error` (see [Error bodies](#error-bodies)).
6. **Callers of `POST /rotate-key` or `GET /share`** move to `POST /api/rotate-key` and `POST /api/share`.
7. **Optional:** delete the old export cache directory (`exportCachePath`, default `.export-cache` under the working directory) to reclaim disk space.

## Error bodies

Every JSON route now answers an error with Fastify's standard error body:

```json
{
  "statusCode": 404,
  "code": "SERVER_NOT_FOUND",
  "error": "Not Found",
  "message": "File not found"
}
```

`error` is the standard status text, `message` is for people and may change, and `code` is the contract. The `SERVER_*` codes and their statuses are exported by `@karmaniverous/jeeves-server-core` as `SERVER_ERROR_CODES` and `SERVER_ERROR_STATUS` and listed in [API & Integration: Errors](./api-integration.md#errors). Extra fields such as `details`, `detail`, `path`, `issues` and `renderState` are gone (file-system and library error messages are logged, not sent). Any other failure is a `500` with no `code` and a generic message.

| 3.15 reply | 3.16 status | 3.16 `code` |
| --- | --- | --- |
| `401 {"error":"Unauthorized"}`, `"Invalid API key"`, `"X-API-Key header required"`, `"Insider auth required for utility endpoints"` | 401 | `SERVER_UNAUTHORIZED` |
| `403 {"error":"Path is outside your access scope"}` | 403 | `SERVER_OUT_OF_SCOPE` |
| `403 {"error":"Insider access required"}`, `"Archive export requires insider access"` | 403 | `SERVER_INSIDER_REQUIRED` |
| `403 {"error":"Unscoped insider access required"}` (`/api/events`) | 403 | `SERVER_FORBIDDEN` |
| `403 {"error":"Insider auth required"}` (`/api/rotate-key` with a machine key) | 403 | `SERVER_MACHINE_KEY_NOT_ROTATABLE` |
| `400 {"error":"Invalid path"}` (a `..` segment), `"Path required"`, `"fsPath must be an absolute path"` | 400 | `SERVER_INVALID_PATH` |
| `404 {"error":"Invalid path"}` (no such root), `"Path does not fall under any configured root"` | 404 | `SERVER_NOT_FOUND` |
| `404 {"error":"Not found"}` (with or without `path`), `"File not found"`, `"Mermaid file not found"`, `"PlantUML file not found"`, `"Credential file not found"`, `"Diagram source not found"`; unknown routes | 404 | `SERVER_NOT_FOUND` |
| `400 {"error":"Use /api/path/ for directories"}`, `"Cannot serve directory as raw…"`, `"Can only write to files"` | 400 | `SERVER_NOT_A_FILE` |
| `400 {"error":"Files support pdf or docx export"}`, `"Directories only support zip or tar export"` | 400 | `SERVER_EXPORT_UNSUPPORTED` |
| `500 {"error":"PDF export failed","details":"…Browser was not found…"}` (also DOCX), `500 {"error":"Mermaid render failed"}` without Chrome | **503** | `SERVER_CHROME_UNAVAILABLE` |
| `500 {"error":"Plantuml render failed"}`; a failed document render (`renderState`) | **502** | `SERVER_EXPORT_FAILED` |
| `502 {"error":"Watcher unreachable: …"}`, `502 {"error":"Failed to reach watcher","detail":…}` | 502 | `SERVER_WATCHER_UNAVAILABLE` |
| `502 {"error":"Runner unreachable"}` | **503** | `SERVER_RUNNER_UNAVAILABLE` |
| `401 {"error":"refresh_failed","message":"Re-authorization required"}` (`/api/oauth/token`) | 401 | `SERVER_OAUTH_REFRESH_FAILED` |
| `400` for a missing or mistyped field: `"path is required"`, `"query is required"`, `"Missing action field"`, `"Unknown action: …"`, `"edit-block requires …"`, `"Request body must include \"content\" string"`, `"fsPath query parameter required"`, `"provider and account query params required"`, `"insiders array is required"`, `"Invalid diagram type"`, `"path query param required"` | 400 | `FST_ERR_VALIDATION` (the catalog's request schemas) |
| `400` for an invalid value: `"Checkbox index 9 out of range"`, `"Line range out of bounds"`, `"startLine must not exceed endLine"`, `"content must not be empty"`, `"Only .md files are supported"`, `"Invalid slug"`, `"Invalid hash"`, `"Invalid file name"`, `"origin must be a valid URL"`, an invalid provider or account name, `"authUrl and tokenUrl are required…"` | 400 | `SERVER_INVALID_REQUEST` |
| `500` with a file-system or library message | 500 | none (message masked) |

New codes with no 3.15 equivalent: `SERVER_NOT_A_DIRECTORY` (400), `SERVER_ARCHIVE_TOO_LARGE` (413), `SERVER_CONFLICT` (409), `SERVER_EMAIL_UNAVAILABLE` (500), `SERVER_INTERNAL_KEY_MISSING` (500), `SERVER_NOT_CONFIGURED` (501), `SERVER_SIGN_IN_REJECTED` (403). The runner proxy now forwards the runner's `Retry-After`.

**Status changes:** Chrome unavailable 500 → 503; unrenderable PlantUML export 500 → 502; runner unreachable 502 → 503; rotation with a machine key on the removed legacy route was 501.

## Removed routes

| Removed | Use instead |
| --- | --- |
| `POST /rotate-key` | `POST /api/rotate-key` (a session or the insider-seed insider key; machine keys get `403 SERVER_MACHINE_KEY_NOT_ROTATABLE`, because machine seeds rotate in config). It logs `insider_key_rotated` and answers `{ ok, keyCreatedAt, invalidates: ['insiderKey', 'outsiderLinks'] }` |
| `GET /share?path=…` | `POST /api/share` (`{ path, expiry?, depth?, dirs? }`), which checks the caller's scopes and the outsider policy and makes deep links. The legacy route checked neither |

Both now answer `404 SERVER_NOT_FOUND`.

## `/config` and `/config/apply` are admin-only

In 3.15 both routes were unauthenticated: anyone who could reach the port could read the runtime config and rewrite it (only a reverse-proxy block protected them). In 3.16 they are **admin** routes: they accept only an identity with **no scopes configured**, i.e. an unscoped insider session or an unscoped machine key such as the plugin's `_plugin` key, but never the server's own `_internal` key (it renders exports, not admin). Any configured scope, even `allow: ["/**"]`, gets `403 SERVER_FORBIDDEN`; no credential gets `401 SERVER_UNAUTHORIZED`. `/api/events` follows the same rule (as in 3.15). The `/config/apply` response is redacted like `/config`.

To keep using the config from a browser session, remove `scopes`, `allow` and `deny` from your own insider entry:

```json
{
  "insiders": {
    "admin@example.com": {},
    "contractor@example.com": { "scopes": "public-docs" }
  }
}
```

The CLI's `config` and `config apply` send a key: `--key <key>` (an unscoped insider or machine key), else `JEEVES_SERVER_KEY`, else the insider key derived from `keys._plugin` in the config file given by `-c, --config`. Failures print `<code>: <message>`, with a hint after a 401 or 403.

## Access model

Every route is a catalog entry with one access class ([API Reference](./api-reference.md)). Identity credentials (a session, a machine key, an insider-seed insider key) are verified as identities and their scopes apply to the path; share credentials are verified against the path. Changes a client may notice:

- **Scoped machine keys** may now call `POST /api/share`, `GET /api/resolve-path`, `POST /api/search`, `GET /api/search/facets`, and `GET /api/drives` (3.15 answered 401), and get `403 SERVER_OUT_OF_SCOPE` instead of 401 for a path outside their scopes. Scopes limit paths only, so the routes they can't limit stay closed to scoped machine keys, as in 3.15: the runner proxy (`/api/runner/*`), `POST /api/oauth/start`, `GET /api/oauth/status` and `GET /api/oauth/token` answer a scoped machine key `403 SERVER_FORBIDDEN` (3.15 answered 401) and never reach the runner or a token endpoint. Sessions, scoped or not, and unscoped machine keys such as the plugin's use them as before.
- **`GET /api/resolve-path`** checks the resolved path against a scoped caller's scopes (3.15 resolved any path for a scoped session).
- **The insider-seed insider key** authenticates `POST /api/rotate-key` as well as `POST /api/util/share-for`, and nothing else.
- **Share keys** never authenticate insider or admin routes.
- **Access follows the route the server matched**, after percent-decoding, so an encoded URL (`/%63onfig`, `/%61pi/file/...`) gets exactly the checks of the plain one, and an encoded `..` segment (`%2e%2e`, `%2F..%2F`) is `400 SERVER_INVALID_PATH` on every content route. `POST /api/share`, `POST /api/util/share-for` and `GET /api/resolve-path` refuse a path with a `..` segment the same way, and the two share routes also a `.` segment or a literally encoded dot segment (`%2e`, `.%2e`, `%2e.`, `%2e%2e`, any case). The share URL they return carries the path percent-encoded per segment (`sub%20dir/100%25%20done.md`), so a name with `%`, `#` or `?` makes a working link.
- **Runner job IDs** `.` and `..` (plain or encoded), or holding `/` or `\`, are `400` on every `/api/runner/jobs/:id` route and never reach the runner.
- **Export downloads** (`/api/export`, `/api/mermaid-export`, `/api/plantuml-export`) send `Content-Disposition: attachment; filename="<ASCII fallback>"; filename*=UTF-8''<percent-encoded name>` (RFC 6266), as `/api/raw?download=1` does: a non-ASCII name (a directory named `日本`, say) no longer fails with 500.

## `/status` hides admin fields

`GET /status` stays public, but for callers that aren't admin (no credential, a share credential or a scoped identity) it omits each `health.events[].cmd` (the event names stay) and `health.chrome.path` (`health.chrome.configured` stays). Admin callers, including the plugin's key, get the full block. New fields: `health.eventQueue` (`offset`, `size`, `pendingBytes`, `parseErrors`, `lastCursorReset?`, `lastRewind?`) and the sign-in redirect URIs (`health.auth.googleRedirectUri`, `health.auth.oauthRedirectUri`).

## `POST /event` takes JSON objects only

A webhook body must be a JSON object. An array, a scalar or a non-JSON body, which 3.15 accepted as `200 {"matched":null}`, is now `400 FST_ERR_VALIDATION`. Large objects are still accepted; only the logged preview of an unmatched body is capped at 256 KiB.

## Runner proxy is an allow-list

`/api/runner/*` forwards only the routes 3.15 proxied, to a session (scoped or not) or an unscoped machine key; a scoped machine key gets `403 SERVER_FORBIDDEN` (see above):

| Server route | Runner route |
| --- | --- |
| `GET /api/runner/jobs` | `GET /jobs` |
| `GET /api/runner/jobs/:id` | `GET /jobs/:id` |
| `GET /api/runner/jobs/:id/runs?limit=` | `GET /jobs/:id/runs?limit=` (default 20) |
| `POST /api/runner/jobs/:id/run` | `POST /jobs/:id/run` |
| `PATCH /api/runner/jobs/:id/enable` | `PATCH /jobs/:id/enable` |
| `PATCH /api/runner/jobs/:id/disable` | `PATCH /jobs/:id/disable` |
| `GET /api/runner/status` | `GET /status` |

Enabling and disabling a job is now `PATCH`, as the runner expects: 3.15 took `POST /api/runner/jobs/:id/enable` (and `/disable`) and sent it upstream as `PATCH` (#309); 3.16 rewrites no method, so a `POST` there is `404 SERVER_NOT_FOUND`. Every other method or path under `/api/runner/`, the runner's `/config` and `/config/apply`, job creation, updates, deletion and script updates included, is `404 SERVER_NOT_FOUND` from the server for every caller, admins too, and never reaches the runner. Use jeeves-runner's own API (it listens on localhost) for those. No credential, query parameter (other than `limit`) or body is forwarded. Runner errors come back with the runner's status, code, message and `Retry-After`; an unreachable runner is `503 SERVER_RUNNER_UNAVAILABLE`.

## Export cache reset

Cached exports are now keyed by the format, the document's content (as loaded, so watcher-rendered output counts), the print style, the server version and the referenced local images, instead of the file path and modification time. Nothing in the old cache is hit again: every document re-renders once after the upgrade. You can delete the old cache directory (`exportCachePath`, default `.export-cache` under the server's working directory) before or after upgrading.

## Documents

- **`jeeves:` front-matter namespace.** A top-level `jeeves` mapping in Markdown front matter is reserved for directives to Jeeves components and is hidden from the displayed front matter (screen, PDF and DOCX). Rename any of your own `jeeves:` mapping that should stay visible.
- **Print styles.** `jeeves: { print: <name> }` selects a style registered under `printStyles` in the server config for the PDF; the response names it in `X-Print-Style` (`default` for an unknown name). See [Exports](./exports.md#print-styles).
- `.markdown` files and text files that jeeves-watcher renders as Markdown now render and export like `.md`; exporting a watcher-rendered file while the watcher is down is `502 SERVER_WATCHER_UNAVAILABLE`.
- Additive response fields: `title` in `GET /api/file/*`, `downloadUrl` in `GET /api/link-info/*`; `?download=1` on `/api/raw/*` downloads with an RFC 6266 file name.

## OpenClaw plugin 0.16.0

- **`server_rotate_key` is removed.** It could never succeed: the plugin holds a machine key, and machine keys can't rotate.
- **`server_export` returns a download URL** instead of fetching the export: `{ path, format, url }`, with `format` one of `pdf`, `docx` (Markdown), `zip`, `tar` (directories), `svg`, `png` (Mermaid and PlantUML); another combination is a tool error naming the valid formats. From the release after 0.16.0 the valid formats are the ones `server_link_info` lists in `exportLinks`, so documents the watcher renders as Markdown export to PDF/DOCX and Mermaid to PDF too (#320). The URL carries no key and opens in an insider's browser session; with `share: { expiryDays? }` it carries a signed share (and `exp`) so anyone with the link can download; directory archives are insider-only, so `share` with `zip` or `tar` is a tool error. No tool returns a URL carrying the plugin key.
- **`server_config` and `server_config_apply` send the plugin key**, so they reach the admin-only routes. The server's `keys._plugin` must be unscoped (the schema requires it).
- Tool names and parameters are otherwise unchanged (18 tools); the catalog tools take their descriptions from the server's endpoint catalog, and every tool calls the server through the SDK.

## SDK and core

- **`@karmaniverous/jeeves-server-sdk` 0.1.0** is new: `createServerClient({ baseUrl, auth })` with one typed method per catalog entry, `ServerError` with the body's `code`, and the link helpers `toRawUrl`, `toExportUrl` and `withShareCredential`. See its [README](https://github.com/karmaniverous/jeeves-server/tree/main/packages/sdk#readme).
- **`@karmaniverous/jeeves-server-core` 0.5.0** replaces the `serverEndpoints` table with `SERVER_CATALOG` (built with `@karmaniverous/jeeves`' `defineCatalog`), and adds the error codes, `SERVER_OPENAPI_DOCUMENT` / `openapi.json` and a browser-safe `./catalog` entry. Code that read `serverEndpoints` uses `SERVER_CATALOG` or the SDK.
