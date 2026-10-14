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

API routes continue returning JSON `{ error: 'Unauthorized' }` for programmatic clients — the sign-in page only applies to browser-navigated SPA paths.

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
| `GET` | `/status` | Server metadata: version, uptime, services, capabilities. Add `?events=N` for recent event log entries |

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
| `POST` | `/api/share` | Generate share link (`path`, `expiry` as epoch ms, `depth`, `dirs`) |
| `POST` | `/api/util/share-for` | Generate share link for a specific audience (insiders, enforceOutsiderPolicy) |
| `POST` | `/api/rotate-key` | Rotate an insider's key (invalidates all their outsider links) |

### Scopes and errors

Content routes (`/api/path`, `/api/file`, `/api/raw`, `/api/export`, `/api/export-cache`, `/api/mermaid-export`, `/api/plantuml-export`, `/api/link-info`) verify `?k=` against the content path after the route prefix, so share keys work on all of them. For scoped identities:

| Status | Body | When |
| --- | --- | --- |
| `400` | `{ "error": "Invalid path" }` | The content path contains a `..` segment |
| `401` | `{ "error": "Unauthorized" }` | No valid session or key |
| `403` | `{ "error": "Path is outside your access scope" }` | Authenticated, but the path is outside the identity's scopes |

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

`provider` and `account` may only contain letters, digits, `.`, `_`, `-`, `@` and `+` (so `jason@johngalt.id` works), and may not be `.` or `..`. Path separators, control characters and empty values are rejected with 400.

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
| `GET` | `/api/resolve-path?fsPath=<absolute path>` | Map a filesystem path to `{ browsePath, browseUrl, publicUrl? }`. Requires a machine key, insider key or insider session (401 without credentials, 403 for share keys). |
| `GET` | `/api/events?limit=N` | Recent event log entries (1â€“100, default 20). Unscoped insiders only: insiders or machine keys with scope restrictions get 403. Unmatched webhook bodies are stored in full up to 256 KiB; larger ones are cut at the cap and carry `truncated: true` and `originalBytes`. |

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

1. **Use the OpenClaw plugin** if available — it provides tools for browsing (`server_browse`, `server_link_info`, `server_drives`), sharing (`server_share`), export (`server_export`, `server_export_cache_clear`), file mutation (`server_file_write`, `server_file_mutate`), auth (`server_auth_status`, `server_rotate_key`), events (`server_event_status`), and OAuth credential management (`oauth_authorize`, `oauth_status`, `oauth_token`)
2. **Convert Windows paths** to URL paths using the formula above
3. **Use `/health`** for liveness checks and **`/status`** for details (no auth required for either)
4. **Prefer `/browse/` routes** for links you share with humans (renders the SPA)
5. **Use `/api/export/` routes** for direct PDF/DOCX downloads
