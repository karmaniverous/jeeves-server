---
title: 'API & Integration Guide'
---

# API & Integration Guide

How to interact with Jeeves Server programmatically — for scripts, bots, AI assistants, and CI/CD pipelines.

## Authentication for API Access

All API requests (except `/health` and `/status`) authenticate via `?k=<insider-key>` URL parameter or session cookie.

> **`k`, not `key`.** Since 3.15.0 every URL the server generates carries its auth key as `k`. The old parameter name `key` is still accepted everywhere (when both are present, `k` wins), so existing links, bookmarks and webhook URLs keep working. Generated links use `k` because some agent platforms (OpenClaw among them) mask the value of any query parameter named `key` in tool output.

### Browser Auth Gate

When an unauthenticated browser hits a SPA route (`/`, `/browse/*`, `/runner/*`), the server returns a branded sign-in page instead of the SPA. The page shows an email login form as the primary action (when email auth is configured), with a "Sign in with Google" button below (when Google OAuth is also configured). When only Google auth is active, the Google button is shown alone. When only key auth is active, an API key required message is displayed. The page reflects instance branding (name, emoji) when configured. After successful sign-in, the user is redirected back to the originally requested page.

API routes continue returning a JSON 401 (`SERVER_UNAUTHORIZED`, see [Errors](#errors)) for programmatic clients — the sign-in page only applies to browser-navigated SPA paths.

```json
{
  "keys": {
    "ci-bot": "random-seed-string",
    "webhook": { "key": "another-seed", "scopes": ["/event"] }
  }
}
```

### Getting the derived key

The config contains **seeds**. The actual URL key is derived via HMAC:

```bash
curl -s "http://localhost:1934/insider-key" -H "X-API-Key: <seed>"
# Returns: { "key": "a1b2c3d4..." }
```

Or compute it yourself:

```javascript
const crypto = require('crypto');
function insiderKey(seed) {
  return crypto
    .createHmac('sha256', seed)
    .update('insider')
    .digest('hex')
    .substring(0, 32);
}
```

## API Endpoints

### Public (no auth required)

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Liveness check: returns `{ "ok": true }` |
| `GET` | `/status` | Server metadata: version, uptime, services, capabilities. Event commands (`health.events[].cmd`) and the Chrome path (`health.chrome.path`) are shown only to admins (a session or insider key with no scopes configured). For recent event log entries, use `GET /api/events?limit=N` (admins; see below) |

### File Access (auth required)

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/file/<path>` | File content (rendered HTML for markdown, raw for others) |
| `GET` | `/api/raw/<path>` | Raw file bytes with appropriate Content-Type |
| `GET` | `/api/link-info/<path>` | Query available views and export formats for a path |

### Directory Access

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/drives` | List available drives (Windows) or roots (Linux) |
| `GET` | `/api/path/<path>` | List directory contents (or file metadata for a file path) |

### Export

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/export/<path>?format=pdf\|docx\|zip\|tar` | Export file or directory |
| `GET` | `/api/mermaid-export/<path>?format=svg\|png\|pdf` | Export Mermaid diagram |
| `GET` | `/api/plantuml-export/<path>?format=svg\|png\|pdf\|eps` | Export PlantUML diagram |

### Sharing

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/insider-key` | Get derived insider key (requires `X-API-Key` header with seed) |
| `GET` | `/key?path=<path>` | Compute outsider key for a path |
| `POST` | `/api/share` | Generate share link (`path`, `expiry` as epoch ms, `depth`, `dirs`); the response reports `isDirectory` |
| `POST` | `/api/util/share-for` | Generate share link for a specific audience (insiders, enforceOutsiderPolicy) |
| `POST` | `/api/rotate-key` | Rotate an insider's key (session or insider-seed key; machine keys get `403 SERVER_MACHINE_KEY_NOT_ROTATABLE`). Logs `insider_key_rotated`; the response `{ ok, keyCreatedAt, invalidates: ['insiderKey', 'outsiderLinks'] }` says the insider key and every outsider link the insider signed stopped working |

The legacy `POST /rotate-key` and `GET /share` were removed in 3.16.0 (#292): use `POST /api/rotate-key` and `POST /api/share`.

### Scopes and errors

Content routes (`/api/path`, `/api/file`, `/api/raw`, `/api/export`, `/api/export-cache`, `/api/mermaid-export`, `/api/plantuml-export`, `/api/link-info`) verify `?k=` against the content path after the route prefix, so share keys work on all of them except `DELETE /api/export-cache`, which is insider only (403 for share keys). For scoped identities:

| Status | Code | When |
| --- | --- | --- |
| `400` | `SERVER_INVALID_PATH` | The content path contains a `..` segment |
| `401` | `SERVER_UNAUTHORIZED` | No valid session or key |
| `403` | `SERVER_OUT_OF_SCOPE` | Authenticated, but the path is outside the identity's scopes |

Directory listings and link info admit ancestors of in-scope paths (for navigation) and only list reachable entries; every other content route requires the path itself to be in scope. See [Sharing → How scopes are enforced](sharing.md#how-scopes-are-enforced).

### File Mutation (insider auth required)

| Method | Path | Description |
| --- | --- | --- |
| `PUT` | `/api/file/<path>` | Overwrite file content |
| `POST` | `/api/file/<path>` | Apply structured mutations to `.md` files (edit-block, delete-block, insert-block, edit-cell, toggle-checkbox) |

### Export Cache

| Method | Path | Description |
| --- | --- | --- |
| `DELETE` | `/api/export-cache/<path>` | Clear export and diagram caches for a path (insider only) |

### Authentication

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/auth/status` | Check authentication status and mode (no auth required) |
| `POST` | `/api/auth/magic` | Request a magic login link (no auth required, returns 200 with `{ verifyUrl }` whether or not the email is an insider) |
| `GET` | `/auth/magic/verify` | OTP verification page — server-rendered page where users enter the emailed code (top-level route, no auth required) |
| `GET` | `/auth/magic/callback` | Magic link callback — verifies signed token, sets session cookie (top-level route, no auth required) |

### OAuth2 Credential Management (insider auth required)

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/oauth/start` | Initiate OAuth2 authorization flow (returns auth URL) |
| `GET` | `/api/oauth/status?provider=&account=` | Check credential existence and expiry |
| `GET` | `/api/oauth/token?provider=&account=` | Retrieve valid access token (auto-refreshes if expired) |

`provider` and `account` may only contain letters, digits, `.`, `_`, `-`, `@` and `+` (so `jason@johngalt.id` works), and may not be `.` or `..`. Path separators, control characters and empty values are rejected with 400 (`SERVER_INVALID_REQUEST`).

### Event Gateway

| Method | Path     | Description                                         |
| ------ | -------- | --------------------------------------------------- |
| `POST` | `/event` | Send a webhook (matched against configured schemas) |

### Search (requires watcher integration)

| Method | Path                 | Description                                 |
| ------ | -------------------- | ------------------------------------------- |
| `POST` | `/api/search`        | Semantic search (proxied to jeeves-watcher) |
| `GET`  | `/api/search/facets` | Get filter facets for search UI (cached)    |

### Path resolution and event log

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/resolve-path?fsPath=<absolute path>` | Map a filesystem path to `{ browsePath, browseUrl, publicUrl? }`. Requires a session or insider key (401 without one; share keys are refused); a scoped caller gets 403 for a path outside its scopes. |
| `GET` | `/api/events?limit=N` | Recent event log entries (1–100, default 20). Only for insiders with no scopes configured (a machine key or insider session without `scopes`). Any configured scopes refuse access, even `allow: ['/**']` (403 `SERVER_FORBIDDEN`). Unmatched webhook bodies are stored in full up to 256 KiB; larger ones are cut at the cap and carry `truncated: true` and `originalBytes`. |

## Errors

Since 3.16.0 every JSON route answers an error with Fastify's standard error body:

```json
{
  "statusCode": 404,
  "code": "SERVER_NOT_FOUND",
  "error": "Not Found",
  "message": "File not found"
}
```

Branch on `code`, never on `message` (it is for people and may change). The codes and their statuses are exported by `@karmaniverous/jeeves-server-core` as `SERVER_ERROR_CODES` and `SERVER_ERROR_STATUS`:

| Status | Code | When |
| --- | --- | --- |
| `400` | `SERVER_INVALID_PATH` | A path that is empty, has a `..` segment, or isn't absolute where it must be |
| `400` | `SERVER_INVALID_REQUEST` | A request field is missing or invalid (a line range, a mutation's fields, an OAuth origin) |
| `400` | `SERVER_NOT_A_FILE` / `SERVER_NOT_A_DIRECTORY` | A file route addressed a directory, or the reverse |
| `400` | `SERVER_EXPORT_UNSUPPORTED` | No export in that format for that path |
| `401` | `SERVER_UNAUTHORIZED` | No valid credential for the route |
| `401` | `SERVER_OAUTH_REFRESH_FAILED` | A stored OAuth credential expired and could not be refreshed: authorize again |
| `403` | `SERVER_FORBIDDEN` | Known caller, but not allowed (e.g. `/api/events` for a scoped insider) |
| `403` | `SERVER_OUT_OF_SCOPE` | The path is outside the caller's scopes |
| `403` | `SERVER_INSIDER_REQUIRED` | A share key on an insider-only route |
| `403` | `SERVER_MACHINE_KEY_NOT_ROTATABLE` | Key rotation with a machine key (machine seeds rotate in config) |
| `403` | `SERVER_SIGN_IN_REJECTED` | Sign-in refused for that account |
| `404` | `SERVER_NOT_FOUND` | Nothing there (file, directory, page, route, credential, or a path under no root) |
| `409` | `SERVER_CONFLICT` | A change raced another change to the same file |
| `413` | `SERVER_ARCHIVE_TOO_LARGE` | The directory exceeds `maxZipSizeMb` |
| `500` | `SERVER_INTERNAL_KEY_MISSING` | The server has no `_internal` key, which the route needs |
| `500` | `SERVER_EMAIL_UNAVAILABLE` | The sign-in email could not be sent |
| `501` | `SERVER_NOT_CONFIGURED` | The feature (OAuth) is not configured on this server |
| `502` | `SERVER_EXPORT_FAILED` | The document or diagram did not render |
| `502` | `SERVER_WATCHER_UNAVAILABLE` | jeeves-watcher failed or could not be reached |
| `503` | `SERVER_CHROME_UNAVAILABLE` | No usable Chrome for an export (check `chromePath`) |
| `503` | `SERVER_RUNNER_UNAVAILABLE` | jeeves-runner could not be reached |

Any other failure is a `500` with no `code` and a generic message; the details go to the server log only. `/api/runner/*` passes every method (GET, POST, PATCH, PUT, DELETE), path, query (credentials removed) and JSON body through to jeeves-runner, so its methods are the runner's own (enabling a job is `PATCH /api/runner/jobs/:id/enable`). Runner errors come back with the runner's status, code, message and `Retry-After`; the `error` text follows the status. Request validation failures are `400 FST_ERR_VALIDATION`. Browser routes (the SPA, `/auth/*`, magic link pages, `/oauth/callback`, `/go`) answer with pages and redirects instead.

## Converting Windows Paths to URLs

```
D:\\docs\\design.md  →  /d/docs/design.md
E:\\projects\\foo    →  /e/projects/foo
```

**Conversion formula:**

1. Replace backslashes with forward slashes
2. Replace the drive letter + colon with lowercase letter
3. Prepend the route prefix (`/browse/` for SPA, `/api/file/` for API, `/path/` for legacy)

```javascript
function winPathToUrl(winPath, prefix = '/browse/') {
  return (
    prefix +
    winPath
      .replace(/\\\\/g, '/')
      .replace(/^([A-Z]):/, (_, d) => d.toLowerCase())
  );
}
```

## Generating Share Links

### Insider links

```javascript
const insiderKey = computeInsiderKey(seed);
const url = \`https://jeeves.example.com/browse/d/docs/design.md?k=\${insiderKey}\`;
```

### Outsider links (path-scoped)

```javascript
const crypto = require('crypto');

function outsiderKey(seed, path) {
  const normalized = path.toLowerCase().replace(/^\/+|\/+$/g, '');
  return crypto
    .createHmac('sha256', seed)
    .update(normalized)
    .digest('hex')
    .substring(0, 32);
}
```

See the [Sharing](sharing.md) guide for details on expiring links and directory sharing.

## For AI Assistants

If you're an AI assistant working with Jeeves Server:

1. **Use the OpenClaw plugin** if available — it provides tools for browsing (`server_browse`, `server_link_info`, `server_drives`), sharing (`server_share`), export (`server_export`, `server_export_cache_clear`), file mutation (`server_file_write`, `server_file_mutate`), auth (`server_auth_status`), events (`server_event_status`), and OAuth credential management (`oauth_authorize`, `oauth_status`, `oauth_token`)
2. **Convert Windows paths** to URL paths using the formula above
3. **Use `/health`** for liveness checks and **`/status`** for details (no auth required for either)
4. **Prefer `/browse/` routes** for links you share with humans (renders the SPA)
5. **Use `/api/export/` routes** for direct PDF/DOCX downloads
