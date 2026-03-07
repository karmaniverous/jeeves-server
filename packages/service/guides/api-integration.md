# API & Integration Guide

How to interact with Jeeves Server programmatically — for scripts, bots, AI assistants, and CI/CD pipelines.

## Authentication for API Access

All API requests authenticate via `?key=<insider-key>` URL parameter or session cookie. For programmatic access, use a key:

```typescript
// In jeeves.config.ts
keys: {
  'ci-bot': 'random-seed-string',
  // Scoped key for webhooks only:
  'webhook': { key: 'another-seed', scopes: ['/event'] },
},
```

### Getting the derived key

The config contains **seeds**. The actual URL key is derived via HMAC:

```bash
# Get the insider key from a seed
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

### File Access

```bash
# Get file content (rendered)
GET /api/file/d/docs/design.md?key=<key>
# Returns: { type: "markdown", html: "...", headings: [...], content: "...", fileName: "..." }

# Get file content (raw text)
GET /api/file/d/docs/design.md?key=<key>&mode=raw
# Returns: { type: "text", content: "...", fileName: "..." }

# Get raw file bytes
GET /path/d/docs/design.md?key=<key>&raw=1
# Returns: file content with appropriate Content-Type

# Export as PDF
GET /path/d/docs/design.md?key=<key>&export=pdf
# Returns: application/pdf

# Export as DOCX
GET /path/d/docs/design.md?key=<key>&export=docx
# Returns: application/vnd.openxmlformats-officedocument.wordprocessingml.document
```

### Directory Listing

```bash
# List drives
GET /api/drives?key=<key>
# Returns: { drives: [{ letter: "C", label: "System", ... }] }

# List directory
GET /api/directory/d/docs?key=<key>
# Returns: { path: "d/docs", entries: [{ name: "...", type: "file"|"directory", ... }] }
```

### Authentication

```bash
# Check auth status
GET /api/auth/status?key=<key>
# Returns: { authenticated: true, email: "...", isInsider: true, mode: "key" }
```

### Sharing

```bash
# Get insider key (requires X-API-Key header with seed)
GET /insider-key
# Headers: X-API-Key: <seed>
# Returns: { key: "a1b2c3d4..." }

# Compute outsider key for a path
GET /key?path=/d/docs/design.md
# Headers: X-API-Key: <seed>
# Returns: { key: "e5f6a7b8..." }

# Rotate a key
POST /rotate-key
# Body: { key: "<current-insider-key>" }
```

### Event Gateway

```bash
# Send a webhook
POST /event?key=<webhook-key>
Content-Type: application/json
Body: { "type": "page.content_updated", "data": { "page_id": "abc123" } }
# Returns: { matched: "notion-page-update" } or { matched: null }
```

### Health

```bash
GET /health
# Returns: 200 OK (no auth required)
```

## Converting Windows Paths to URLs

Jeeves Server maps Windows filesystem paths to URL paths:

```
D:\docs\design.md  →  /d/docs/design.md
E:\projects\foo    →  /e/projects/foo
```

**Conversion formula:**
1. Replace backslashes with forward slashes
2. Replace the drive letter + colon with lowercase letter
3. Prepend the route prefix (`/path/` for legacy, `/browse/` for SPA, `/api/file/` for API)

```javascript
function winPathToUrl(winPath, prefix = '/path/') {
  const urlPath = winPath
    .replace(/\\/g, '/')
    .replace(/^([A-Z]):/, (_, d) => d.toLowerCase());
  return `${prefix}${urlPath}`;
}

// D:\docs\design.md → /path/d/docs/design.md
// D:\docs\design.md → /browse/d/docs/design.md
// D:\docs\design.md → /api/file/d/docs/design.md
```

```powershell
# PowerShell equivalent
function Convert-ToJeevesUrl {
  param([string]$Path, [string]$Prefix = '/path/')
  $urlPath = $Path -replace '\\','/' -replace '^([A-Z]):',{ $_.Groups[1].Value.ToLower() }
  return "${Prefix}${urlPath}"
}
```

## Generating Share Links

### Insider links

```javascript
const insiderKey = computeInsiderKey(seed);
const url = `https://jeeves.example.com/browse/d/docs/design.md?key=${insiderKey}`;
```

### Outsider links (path-scoped)

```javascript
const crypto = require('crypto');

function outsiderKey(seed, path) {
  const normalized = path.toLowerCase().replace(/^\/+|\/+$/g, '');
  return crypto.createHmac('sha256', seed).update(normalized).digest('hex').substring(0, 32);
}

function outsiderKeyWithExpiry(seed, path, expiryMs) {
  const normalized = path.toLowerCase().replace(/^\/+|\/+$/g, '');
  const data = `${normalized}|${expiryMs}`;
  return crypto.createHmac('sha256', seed).update(data).digest('hex').substring(0, 32);
}

// Non-expiring outsider link
const key = outsiderKey(seed, 'd/docs/design.md');
const url = `https://jeeves.example.com/browse/d/docs/design.md?key=${key}`;

// Expiring outsider link (1 week)
const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
const key = outsiderKeyWithExpiry(seed, 'd/docs/design.md', expiry);
const url = `https://jeeves.example.com/browse/d/docs/design.md?key=${key}&exp=${expiry}`;
```

### Directory links

Outsider keys for directories grant access to all descendants:

```javascript
// Share an entire directory
const key = outsiderKey(seed, 'd/projects/client-x');
const url = `https://jeeves.example.com/browse/d/projects/client-x?key=${key}`;
// Grants access to all files under D:\projects\client-x\
```

## For AI Assistants

If you're an AI assistant working with Jeeves Server, here's what you need to know:

### Generating links to share with humans

When your human asks you to share a document:

1. **Convert the Windows path** to a URL path (see above)
2. **Use the insider key** for team members, or generate an outsider key for external recipients
3. **Choose the right route**: `/browse/` for browser viewing, `/path/` with `?export=pdf` for direct PDF download

### Authoring documents

Write Markdown files to the server's filesystem. Jeeves Server will render them beautifully. You can:
- Embed Mermaid diagrams (rendered inline)
- Embed SVG files (rendered with pan/zoom)
- Use code blocks with language hints (syntax highlighted)
- Reference other local files with relative paths

### Checking server status

```bash
curl -s http://localhost:1934/health
```

### Triggering webhooks

If you need to trigger an action via the event gateway:

```bash
curl -X POST "http://localhost:1934/event?key=<webhook-key>" \
  -H "Content-Type: application/json" \
  -d '{"action": "rebuild", "target": "docs"}'
```

Match this against a configured event schema to dispatch your handler.
