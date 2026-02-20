# Setup & Configuration

## Prerequisites

- **Node.js** ≥ 18
- **Chrome or Chromium** — required for PDF export (Puppeteer uses it headlessly)
- **A domain or IP** where the server will be accessible (for Google OAuth callbacks)

## Installation

```bash
git clone https://github.com/karmaniverous/jeeves-server.git
cd jeeves-server
npm install
```

## Configuration

Jeeves Server uses a **TypeScript configuration file** validated at startup by a [Zod](https://github.com/colinhacks/zod) schema. The schema at `src/config/schema.ts` is the single source of truth — all types are derived from it.

### Create your config

```bash
cp jeeves.config.template.ts jeeves.config.ts
```

Edit `jeeves.config.ts` with your values. This file is **gitignored** — it contains secrets and is never committed.

### Config structure

```typescript
import type { JeevesConfig } from './src/config/schema.js';

export default {
  port: 3456,
  chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  auth: { ... },
  insiders: { ... },
  keys: { ... },
  events: { ... },
} satisfies JeevesConfig;
```

The `satisfies` keyword gives you type checking without losing literal types — your editor will autocomplete and validate as you type.

### Platform-specific settings

**Windows** — drives are auto-discovered; no `roots` config needed:
```typescript
chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
```

**Linux** — configure filesystem roots for the file browser:
```typescript
chromePath: '/usr/bin/chromium-browser',
roots: {
  home: '/home',
  projects: '/opt/projects',
},
mermaidCliPath: '/opt/mermaid-cli',  // optional
plantuml: {                          // optional
  jarPath: '/opt/plantuml/plantuml.jar',
  javaPath: '/usr/bin/java',         // defaults to 'java' on PATH
  servers: [],                       // private servers; community server always appended
},
```

On Windows, `roots` is ignored. On Linux, if omitted, it defaults to `{ root: '/' }`.

### Local Developer Mode

When running Jeeves Server on your own machine as a personal file browser, enable `localMode` for a frictionless experience:

```typescript
localMode: true,
```

When enabled:
- **No login required** — requests from `localhost` get full insider access automatically
- **Open locally** — an "Open" button in the header opens files with your OS default handler (VS Code, Excel, etc.)
- **Clean UI** — share/link controls are hidden (localhost links aren't useful to others)

This is ideal for developers who want a powerful local file browser with Markdown rendering, diagram support, and semantic search — with the ability to open any file in its native application.

> **Note:** `localMode` only trusts `localhost` (`127.0.0.1` / `::1`). Remote requests still require normal authentication. Leave `localMode` off (or omit it) when testing the full auth experience locally.

### Config is immutable at runtime

Once the server starts, the config is loaded once and never written to. Mutable state (like auto-generated insider keys) lives in a separate `state.json` file that the server manages itself.

---

## Authentication Modes

Jeeves Server supports two authentication methods, configured via `auth.modes`:

```typescript
auth: {
  modes: ['google', 'keys'],  // Active modes, in priority order
  // ...
}
```

You can enable one or both. The order matters — modes are checked in the order listed.

### Google OAuth (`'google'`)

**Best for:** Teams where insiders log in via browser.

Users authenticate with their Google account. The server checks their email against the `insiders` map to determine access.

**Requirements when enabled:**
- `auth.google.clientId` and `auth.google.clientSecret` — from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
- `auth.sessionSecret` — a random string for signing session cookies
- At least one entry in `insiders`

**Google Cloud setup:**
1. Create a project (or use an existing one)
2. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Authorized redirect URI: `https://your-domain.com/auth/google/callback`
5. Copy the client ID and client secret into your config

**Session secret generation:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Key-Based Auth (`'keys'`)

**Best for:** Headless access, bot integrations, simple setups without Google.

Users authenticate by appending `?key=<value>` to any URL. The server derives keys from configured seeds using HMAC-SHA256 and checks the provided key against all known derived keys.

**Requirements when enabled:**
- At least one entry in `keys`

**How keys work:** You configure a **seed** (a random secret string). The server derives the actual insider key from it via HMAC. You never put the derived key in the config — only the seed. To get the derived key for use in URLs:

```bash
# Via the API (requires X-API-Key header with any seed)
curl -H "X-API-Key: <seed>" https://your-domain.com/insider-key
```

### Both Modes Together

```typescript
auth: {
  modes: ['keys', 'google'],  // Keys checked first
}
```

When both are active:
- Browser users can log in with Google for a session-based experience
- Bots and scripts can use `?key=` for stateless access
- Both methods work on every endpoint

### Choosing a Mode

| Scenario | Recommended |
|----------|-------------|
| Team of humans accessing via browser | `['google']` |
| Bot/script access only | `['keys']` |
| Humans + bots on the same server | `['google', 'keys']` |
| Quick local setup, no Google credentials | `['keys']` |

---

## Insiders

The `insiders` map defines **who** has full browsing access. Each entry is an email address with optional path scopes:

```typescript
insiders: {
  // Full access
  'alice@example.com': {},

  // Restricted to specific paths (allow-only)
  'contractor@example.com': {
    scopes: ['/d/projects/client-x/*'],
  },

  // Broad access with cutouts (allow/deny)
  'team-member@example.com': {
    scopes: {
      allow: ['/d/*'],
      deny: ['/d/secrets/*', '/d/.private/*'],
    },
  },
},
```

With Google auth, insiders log in via OAuth and the server checks their email. With key auth, each insider gets a derived URL key.

See the [Insiders, Outsiders & Sharing](sharing.md) guide for the full access model.

---

## Keys

The `keys` map defines **named API keys** for machine access:

```typescript
keys: {
  // Unscoped — full access to all paths
  primary: 'a-random-64-char-hex-string',

  // Scoped — restricted to specific paths
  'webhook-notion': {
    key: 'another-random-hex-string',
    scopes: ['/event'],
  },

  // Reserved: internal server operations (Puppeteer export)
  _internal: 'yet-another-random-hex-string',
},
```

**Generate seeds with:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### The `_internal` key

The `_internal` key is reserved for the server's own use — specifically, Puppeteer uses it to authenticate when rendering PDFs and DOCX files. It **must not** have scopes (enforced by the schema).

If you don't configure `_internal`, PDF/DOCX export will not work.

### Key names

Key names are used for logging and identification. Choose meaningful names: `primary`, `webhook-notion`, `ci-bot`, etc.

---

## Event Gateway

The event gateway receives webhooks at `POST /event`, validates them against JSON Schema rules, and dispatches matched events to shell commands via a durable JSONL queue.

```typescript
events: {
  'notion-page-update': {
    // JSON Schema to match against incoming body
    schema: {
      type: 'object',
      properties: { type: { const: 'page.content_updated' } },
      required: ['type'],
    },
    // Command to execute when matched
    cmd: 'node /path/to/handler.js',
    // Optional: transform body before passing to command
    map: {
      pageId: { '$': { method: '$.lib._.get', params: ['$.input', 'data.page_id'] } },
    },
    // Optional: override default timeout
    timeoutMs: 60000,
  },
},
```

Webhook callers authenticate with a scoped key:
```bash
curl -X POST "https://your-domain.com/event?key=<webhook-key>" \
  -H "Content-Type: application/json" \
  -d '{"type": "page.content_updated", "data": {"page_id": "abc123"}}'
```

---

## Building

```bash
# Full build (server TypeScript + React client)
npm run build                                      # Compiles server → dist/
cd client && npx vite build --outDir ../dist/client && cd ..  # Builds React SPA → dist/client/
```

> ⚠️ `npm run build` deletes the entire `dist/` directory (including `dist/client/`). Always rebuild the client after the server.

---

## Running

```bash
node dist/server.js
```

### As a Windows service

```bash
nssm install JeevesServer "node" "/path/to/dist/server.js"
nssm start JeevesServer
```

### Health check

```
GET /health
```

Returns `200 OK` with no authentication required.

---

## File Layout

```
jeeves-server/
├── jeeves.config.ts          # Your config (gitignored)
├── jeeves.config.template.ts # Config template (committed)
├── state.json                # Runtime state (gitignored, auto-managed)
├── src/                      # Server source (TypeScript)
│   ├── config/
│   │   ├── schema.ts         # Zod schema (source of truth)
│   │   ├── index.ts          # Config loader (jiti for TS)
│   │   └── types.ts          # Runtime types
│   ├── auth/                 # Google OAuth + key verification
│   ├── routes/               # Fastify route handlers
│   ├── services/             # Export, markdown, event queue
│   └── server.ts             # Entry point
├── client/                   # React SPA source
│   └── src/
│       ├── pages/            # FileBrowser, FileViewer, About
│       ├── components/       # Header, dropdowns, viewers
│       └── lib/              # API client, auth, theme
├── dist/                     # Compiled output (gitignored)
│   ├── server.js             # Compiled server
│   └── client/               # Built React SPA
└── guides/                   # Documentation
```
