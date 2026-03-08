# API & Integration Guide

How to interact with Jeeves Server programmatically — for scripts, bots, AI assistants, and CI/CD pipelines.

## Authentication for API Access

All API requests (except `/health` and `/api/status`) authenticate via `?key=<insider-key>` URL parameter or session cookie.

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
  return crypto.createHmac('sha256', seed).update('insider').digest('hex').substring(0, 32);
}
```

## API Endpoints

### Public (no auth required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Simple health check (200 OK) |
| `GET` | `/api/status` | Server metadata: version, uptime, services, capabilities |

### File Access (auth required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/file/<path>` | File content (rendered HTML for markdown, raw for others) |
| `GET` | `/api/raw/<path>` | Raw file bytes with appropriate Content-Type |
| `GET` | `/api/link-info/<path>` | Query available views and export formats for a path |

### Directory Access

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/drives` | List available drives (Windows) or roots (Linux) |
| `GET` | `/api/directory/<path>` | List directory contents |

### Export

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/export/<path>?format=pdf\|docx\|zip` | Export file or directory |
| `GET` | `/api/mermaid-export/<path>?format=svg\|png\|pdf` | Export Mermaid diagram |
| `GET` | `/api/plantuml-export/<path>?format=svg\|png\|pdf\|eps` | Export PlantUML diagram |

### Sharing

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/insider-key` | Get derived insider key (requires `X-API-Key` header with seed) |
| `GET` | `/key?path=<path>` | Compute outsider key for a path |
| `POST` | `/rotate-key` | Rotate an insider's key (invalidates all their outsider links) |

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/auth/status` | Check authentication status and mode |

### Event Gateway

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/event` | Send a webhook (matched against configured schemas) |

### Search (requires watcher integration)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/search` | Semantic search (proxied to jeeves-watcher) |
| `GET` | `/api/search/facets` | Get filter facets for search UI (cached) |

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
  return prefix + winPath.replace(/\\\\/g, '/').replace(/^([A-Z]):/, (_, d) => d.toLowerCase());
}
```

## Generating Share Links

### Insider links

```javascript
const insiderKey = computeInsiderKey(seed);
const url = \`https://jeeves.example.com/browse/d/docs/design.md?key=\${insiderKey}\`;
```

### Outsider links (path-scoped)

```javascript
const crypto = require('crypto');

function outsiderKey(seed, path) {
  const normalized = path.toLowerCase().replace(/^\/+|\/+$/g, '');
  return crypto.createHmac('sha256', seed).update(normalized).digest('hex').substring(0, 32);
}
```

See the [Sharing](sharing.md) guide for details on expiring links and directory sharing.

## For AI Assistants

If you're an AI assistant working with Jeeves Server:

1. **Use the OpenClaw plugin** if available — it provides `server_status`, `server_browse`, `server_link_info`, `server_share`, `server_export`, and `server_event_status` tools
2. **Convert Windows paths** to URL paths using the formula above
3. **Use `/api/status`** for health checks (no auth required)
4. **Prefer `/browse/` routes** for links you share with humans (renders the SPA)
5. **Use `/api/export/` routes** for direct PDF/DOCX downloads
