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

The [API Reference](./api-reference.md) lists every machine-API route with its method, path, access class, parameters and response. It is generated from the endpoint catalog (`SERVER_CATALOG` in `@karmaniverous/jeeves-server-core`), as are `GET /openapi.json` (no auth) and the SDK (`@karmaniverous/jeeves-server-sdk`), so the three always agree with the server. Call the API from TypeScript with the SDK:

```typescript
import { createServerClient } from '@karmaniverous/jeeves-server-sdk';

const server = createServerClient({
  baseUrl: 'http://localhost:1934',
  auth: { key: insiderKey },
});
const listing = await server.browse({ '*': 'd/docs' }); // `*` is the browse path
```

Behaviour the reference doesn't spell out:

- **`/health` and `/status` need no credentials.** `/status` shows event commands (`health.events[].cmd`) and the Chrome path (`health.chrome.path`) only to admins (a session or key with no scopes configured); other callers get the event names and `chrome.configured`. Recent event log entries are `GET /api/events?limit=N` (admins).
- **Downloads.** `/api/raw/<path>` sends the file's own content type; types a browser doesn't show inline download, and `?download=1` (or `true`) downloads any type with `Content-Disposition: attachment; filename="<ASCII fallback>"; filename*=UTF-8''<percent-encoded name>` (RFC 6266). `/api/link-info/<path>` returns `pageUrl`, `rawUrl`, `downloadUrl` (`rawUrl?download=1`; null for directories) and `exportLinks`.
- **Share credentials on content routes.** Content and navigation routes (`/api/path`, `/api/file`, `/api/raw`, `/api/export`, `/api/mermaid-export`, `/api/plantuml-export`, `/api/link-info`) verify `?k=` against the content path after the route prefix, so a share link's query string works on all of them. Writes, block edits, `DELETE /api/export-cache` and directory archives (`zip`, `tar`) need an insider (`403 SERVER_INSIDER_REQUIRED` for share keys).
- **Scopes.** Directory listings and link info admit ancestors of in-scope paths (for navigation) and list only reachable entries; every other content route requires the path itself to be in scope (`403 SERVER_OUT_OF_SCOPE`). Insider routes that take a path in the body or query (`share`, `search`, `resolve-path`) check it against the caller's scopes. See [Sharing → How scopes are enforced](sharing.md#how-scopes-are-enforced).
- **Admin routes.** `/config`, `/config/apply` and `/api/events` accept only identities with no scopes configured: an unscoped insider session or machine key (such as the plugin's `_plugin` key). Any configured scope, even `allow: ['/**']`, gets `403 SERVER_FORBIDDEN`.
- **Key rotation.** `POST /api/rotate-key` takes a session or an insider-seed insider key (machine keys get `403 SERVER_MACHINE_KEY_NOT_ROTATABLE`), logs `insider_key_rotated` and answers `{ ok, keyCreatedAt, invalidates: ['insiderKey', 'outsiderLinks'] }`: the insider key and every outsider link the insider signed stop working. The legacy `POST /rotate-key` and `GET /share` were removed in 3.16.0 (see [Migrating to 3.16](./migrating-to-3.16.md)).
- **OAuth.** `provider` and `account` may only contain letters, digits, `.`, `_`, `-`, `@` and `+` (so `jason@johngalt.id` works), and may not be `.` or `..`; anything else is `400 SERVER_INVALID_REQUEST`.
- **Events.** `POST /event` takes a JSON object (anything else is `400 FST_ERR_VALIDATION`). Unmatched webhook bodies are logged in full up to 256 KiB; larger ones are cut at the cap and carry `truncated: true` and `originalBytes`.
- **Sign-in pages** (`/auth/magic/verify`, `/auth/magic/callback`, `/oauth/callback`, `/go/:slug`) are browser routes, not catalog entries: they answer with pages and redirects.

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

1. **Use the OpenClaw plugin** if available — it provides tools for browsing (`server_browse`, `server_link_info`, `server_drives`, `server_resolve_path`), sharing (`server_share`), export links (`server_export` returns a download URL, `server_export_cache_clear`), file mutation (`server_file_write`, `server_file_mutate`), auth (`server_auth_status`), events (`server_event_status`), OAuth credential management (`oauth_authorize`, `oauth_status`, `oauth_token`) and the service (`server_status`, `server_config`, `server_config_apply`, `server_service`)
2. **Convert Windows paths** to URL paths using the formula above
3. **Use `/health`** for liveness checks and **`/status`** for details (no auth required for either)
4. **Prefer `/browse/` routes** for links you share with humans (renders the SPA)
5. **Use `/api/export/` routes** for direct PDF/DOCX downloads
