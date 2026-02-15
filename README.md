# Jeeves Server

A lightweight file browser, document viewer, and event gateway with secure, shareable links.

## Why Markdown?

**Markdown is the ideal format for authoring documents**, especially when working with AI assistants. It's simple, readable, version-controllable, and diff-friendly.

But in the business world, you can't share `.md` files — people expect PDFs and Word documents.

**Jeeves Server bridges this gap.** Author your documents in Markdown, review them beautifully rendered in the browser, then export to PDF or DOCX with one click when it's time to share with colleagues, clients, or stakeholders.

## Features

- **File Browser** — Navigate your filesystem through a web interface
- **Markdown Rendering** — `.md` files render as styled HTML with table of contents
- **PDF & DOCX Export** — One-click export for business-ready documents
- **Code Highlighting** — Source files display with syntax highlighting
- **SVG Rendering** — SVG files render as images with pan/zoom support
- **Dark/Light Themes** — Toggle between themes; preference is saved
- **Secure Sharing** — Generate expiring links for external recipients
- **Named Keys with Scoping** — Multiple keys with optional path restrictions
- **Event Gateway** — Receive webhooks, filter with JSON Schema, and dispatch commands

## Setup

```bash
# Clone
git clone https://github.com/karmaniverous/jeeves-server.git
cd jeeves-server

# Configure
cp config.json.local.template config.json.local
# Edit config.json.local and set your keys

# Install & run
npm install
npm start
```

## Configuration

### config.json (committed)

Public configuration including event schemas and defaults.

```json
{
  "eventTimeoutMs": 30000,
  "eventLogPurgeMs": 604800000,
  "events": {
    "notion-page-update": {
      "schema": {
        "type": "object",
        "properties": {
          "type": { "const": "page.content_updated" }
        },
        "required": ["type"]
      },
      "cmd": "node D:\\.jeeves\\core\\dispatchers\\notion-page-update.js",
      "map": {
        "pageId": {
          "$": { "method": "$.lib._.get", "params": ["$.input", "data.page_id"] }
        },
        "type": {
          "$": { "method": "$.lib._.get", "params": ["$.input", "type"] }
        }
      },
      "timeoutMs": 60000
    }
  }
}
```

| Key | Type | Description |
|-----|------|-------------|
| `eventTimeoutMs` | number | Default command timeout for event processing (ms) |
| `eventLogPurgeMs` | number | Purge event log entries older than this (ms). Purge runs on each log write. |
| `events` | `Record<string, Event>` | Named event configurations (see [Event Gateway](#event-gateway)) |

#### Event config

```typescript
interface Event {
  schema: object;        // JSON Schema matched against incoming webhook body
  cmd: string;           // Command to execute when schema matches
  map?: object;          // Optional JsonMap to extract/transform body before passing to cmd
  timeoutMs?: number;    // Override default timeout for this event's command
}
```

### config.json.local (gitignored)

Secrets and instance-specific configuration.

```json
{
  "keys": {
    "insider": "your-insider-key-here",
    "webhook-notion": {
      "key": "your-webhook-key-here",
      "scopes": ["/event"]
    }
  }
}
```

| Key | Type | Description |
|-----|------|-------------|
| `keys` | `Record<string, string \| KeyConfig>` | Named authentication keys |

#### Key config

```typescript
type KeyValue = string;  // Shorthand: key value, all paths allowed

interface KeyConfig {
  key: string;             // The key value
  scopes?: string | string[];  // Path glob(s) this key can access. Undefined = all paths.
}
```

### config.json.local.template (committed)

Template for new installs. Copy to `config.json.local` and fill in secrets.

## Authentication

Jeeves uses **named keys** for authentication. Every request requires `?key=<value>` where the value matches any configured key.

### Key Types

- **Unscoped keys** (plain string value) — access all paths and endpoints
- **Scoped keys** (object with `scopes`) — access only paths matching the configured glob(s)

### Key Resolution

1. Incoming `?key=X` is matched against all key values in `config.json.local`
2. The matched key's name and scopes are resolved
3. If the key has scopes, the request path must match at least one scope glob
4. The key name is available for logging and identification

### Key Rotation

The 🔑 button in the header rotates the key that was used on the current request. This allows multiple insider keys to be independently rotated or decommissioned.

### Insider vs Outsider

- **Insider access**: Request uses an unscoped key → full navigation, sharing controls, key rotation
- **Outsider access**: Request uses a path-specific outsider key (generated via sharing) → view only that path

## Event Gateway

The `/event` endpoint receives webhooks from external services, validates them against configured JSON Schemas, and dispatches matched events to commands via a durable queue.

### Flow

```
POST /event?key=<key>
  │
  ├─ Auth: validate key, check scope includes /event
  │
  ├─ For each event in config.events:
  │    └─ Validate request body against event.schema (ajv)
  │    └─ First match wins
  │
  ├─ If match:
  │    ├─ If event.map defined → transform body via JsonMap
  │    ├─ Else → use full body
  │    ├─ Append to event-queue.jsonl (durable)
  │    └─ Return 200 { matched: "<event-name>" }
  │
  └─ If no match:
       ├─ Log as unmatched in event-log.jsonl
       └─ Return 200 { matched: null }
```

### Queue Processing

Events are processed **single-threaded** from a durable JSONL queue:

1. **Append**: Validated events are appended to `event-queue.jsonl` with metadata
2. **Drain**: A single-threaded processor reads entries sequentially
3. **Execute**: For each entry, spawn `cmd` with the (optionally mapped) body piped as stdin
4. **Timeout**: Commands are killed after `timeoutMs` (per-event or default)
5. **Errors ignored**: The command is responsible for its own error handling; the queue processor logs and moves on
6. **Cursor**: A cursor file tracks the byte offset of the last processed entry, surviving restarts

#### Queue entry format

```jsonl
{"ts":"2026-02-15T05:00:00Z","event":"notion-page-update","cmd":"node ...","body":{...},"timeoutMs":60000}
```

### Event Logging

All events (matched and unmatched) are logged to `event-log.jsonl`:

```jsonl
{"ts":"2026-02-15T05:00:00Z","event":"notion-page-update","matched":true,"exitCode":0,"durationMs":1234}
{"ts":"2026-02-15T05:00:01Z","event":null,"matched":false,"bodyPreview":"..."}
```

Each log write also purges entries older than `eventLogPurgeMs`.

### Body Mapping with JsonMap

When an event config includes a `map` object, the incoming webhook body is transformed via [@karmaniverous/jsonmap](https://github.com/karmaniverous/jsonmap) before being passed to the command. This extracts only the relevant fields from potentially large webhook payloads.

The `map` object follows JsonMap syntax. The `lib` object available in mappings includes `lodash` as `_`.

When `map` is undefined, the full webhook body is passed to the command as-is.

### Example: Notion Webhook

```json
{
  "events": {
    "notion-page-update": {
      "schema": {
        "type": "object",
        "properties": {
          "type": { "const": "page.content_updated" }
        },
        "required": ["type"]
      },
      "cmd": "node D:\\.jeeves\\core\\dispatchers\\notion-page-update.js",
      "map": {
        "pageId": {
          "$": { "method": "$.lib._.get", "params": ["$.input", "data.page_id"] }
        },
        "type": {
          "$": { "method": "$.lib._.get", "params": ["$.input", "type"] }
        }
      },
      "timeoutMs": 60000
    }
  }
}
```

Notion sends a large payload; the `map` extracts just `pageId` and `type`, which is piped as JSON to stdin of the command.

## Endpoints

| Method | Path         | Auth                | Description                          |
|--------|--------------|---------------------|--------------------------------------|
| GET    | /path/*      | `?key=`             | Serve files (md rendered, code highlighted, binary served) |
| POST   | /event       | `?key=` (scoped)    | Receive webhooks, match against event schemas |
| GET    | /about       | None (or key)       | About page with usage instructions   |
| GET    | /key         | X-API-Key header    | Compute path-key for a given path    |
| GET    | /insider-key | X-API-Key header    | Get the insider key                  |
| POST   | /rotate-key  | Key (in body)       | Rotate the key used on this request  |
| GET    | /health      | None                | Health check                         |

## Integration

### Getting Keys

```powershell
# Read from config.json.local
$config = Get-Content "E:\jeeves-server\config.json.local" | ConvertFrom-Json
$insiderKey = $config.keys.insider
# or for object-style keys:
$webhookKey = $config.keys.'webhook-notion'.key
```

### Generating Shareable Links

```bash
# Insider link (full navigation)
https://jeeves.johngalt.id/path/d/docs/readme.md?key=<insider-key>

# Outsider link (path-restricted, with expiry)
curl -X POST "https://jeeves.johngalt.id/outsider-key" \
  -H "Content-Type: application/json" \
  -d '{"insiderKey":"<insider-key>","path":"/d/docs/readme.md","expiry":"7d"}'
```

### Export Options

Append to any markdown URL:
- `?export=pdf` — Download as PDF
- `?export=docx` — Download as Word document
- `?raw=1` — Download raw markdown file

### Converting Windows Paths

```javascript
// D:\docs\readme.md → /path/d/docs/readme.md
const urlPath = winPath
  .replace(/\\/g, '/')
  .replace(/^([A-Z]):/, (m, d) => d.toLowerCase());
const url = `https://jeeves.johngalt.id/path${urlPath}?key=${key}`;
```

### Sending Webhooks

```bash
curl -X POST "https://jeeves.johngalt.id/event?key=<webhook-key>" \
  -H "Content-Type: application/json" \
  -d '{"type":"page.content_updated","data":{"page_id":"abc123"}}'
```

## Dependencies

| Package | Purpose |
|---------|---------|
| `express` | HTTP server |
| `puppeteer-core` | PDF export (uses installed Chrome) |
| `@turbodocx/html-to-docx` | DOCX export |
| `highlight.js` | Syntax highlighting |
| `marked` | Markdown → HTML |
| `ajv` | JSON Schema validation (event gateway) |
| `@karmaniverous/jsonmap` | JSON body mapping (event gateway) |
| `lodash` | Utility functions (jsonmap lib) |
| `@panzoom/panzoom` | SVG pan/zoom |

## Running as Windows Service

```bash
nssm install JeevesServer "node" "E:\jeeves-server\server.js"
nssm start JeevesServer
```

## Development

```bash
npm run dev
```

## License

MIT
