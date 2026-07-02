---
title: "Setup & Configuration"
---

# Setup & Configuration

## Prerequisites

- **Node.js** ≥ 22
- **Chrome or Chromium** — required for PDF export (Puppeteer uses it headlessly)

## Installation

```bash
npm install -g @karmaniverous/jeeves-server
```

The `postinstall` script automatically downloads the PlantUML jar for local diagram rendering.

## Configuration

Jeeves Server uses **JSON-only** configuration. Config files follow the path convention `<configDir>/jeeves-server/config.json`.

```bash
# Generate a starter config
jeeves-server init --config /path/to/config-dir

# Or specify an explicit path
jeeves-server start --config /path/to/jeeves-server/config.json
```

Legacy paths (`jeeves-server.config.json`) are auto-migrated to the new convention on first use.

### Config structure (JSON)

```json
{
  "port": 1934,
  "chromePath": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "auth": {
    "modes": ["keys", "google", "email"],
    "google": {
      "clientId": "your-google-client-id",
      "clientSecret": "your-google-client-secret"
    },
    "sessionSecret": "random-session-signing-secret",
    "email": {
      "smtpUrl": "smtps://user:pass@smtp.example.com:465",
      "fromAddress": "login@example.com"
    }
  },
  "branding": {
    "name": "My Docs Server",
    "emoji": "📚"
  },
  "scopes": {
    "restricted": {
      "allow": ["/d/projects/*"],
      "deny": ["/d/projects/secret/*"]
    }
  },
  "insiders": {
    "alice@example.com": {},
    "contractor@example.com": { "scopes": "restricted" }
  },
  "keys": {
    "_internal": "random-hex-seed-for-pdf-export",
    "_plugin": "random-hex-seed-for-openclaw-plugin",
    "primary": "random-hex-seed-for-api-access",
    "webhook-notion": {
      "key": "random-hex-seed",
      "scopes": ["/event"]
    }
  },
  "publicUrl": "https://docs.example.com",
  "eventQueue": "/var/state/jeeves-server/event-queue.jsonl",
  "eventQueueConcurrency": 3,
  "events": {}
}
```

### Logging

Optional logging configuration. Matches the pattern used by jeeves-watcher and jeeves-meta.

```json
{
  "logging": {
    "level": "debug",
    "file": "/var/log/jeeves-server.log"
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `level` | string | `info` | Pino log level: `trace`, `debug`, `info`, `warn`, `error`, `fatal` |
| `file` | string | — | Log file path. When set, logs are written to this file via pino file transport. When omitted, logs go to stdout. |

The entire `logging` block is optional. When absent, the server uses pino's default (`info` level, stdout).

> **Not hot-reloadable.** Logging config is set when the Fastify server is constructed. Changes require `jeeves-server service restart`.

### Public URL

When the server is behind a reverse proxy (Caddy, nginx), set `publicUrl` so API responses include full public URLs:

```json
{
  "publicUrl": "https://docs.example.com"
}
```

The OpenClaw plugin reads this value from the server config to rewrite tool response URLs. If not set, URLs use the local API address.

### Event queue storage

By default the event queue is stored inside the npm install directory, which is fragile across upgrades. Set `eventQueue` to a stable path:

```json
{
  "eventQueue": "/var/state/jeeves-server/event-queue.jsonl",
  "eventQueueConcurrency": 3
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `eventQueue` | string | `{installDir}/logs/event-queue.jsonl` | Absolute path to the durable event queue file. The cursor file is created alongside as `eventQueue + '.cursor'`. |
| `eventQueueConcurrency` | number | `3` | Maximum concurrent event queue entries per batch. |

See the [Event Gateway](event-gateway.md) guide for details on queue processing.

### Environment variable substitution

String values in the config support `${VAR_NAME}` substitution from `process.env`:

```json
{
  "auth": {
    "google": {
      "clientId": "${GOOGLE_CLIENT_ID}",
      "clientSecret": "${GOOGLE_CLIENT_SECRET}"
    }
  }
}
```

### Validating your config

```bash
jeeves-server config validate [--config <path>]
```

This loads and validates the config against the Zod schema, reporting any errors. Use `config [jsonpath]` to query the fully resolved configuration:

```bash
jeeves-server config                        # Full resolved config
jeeves-server config '$.port'               # Query specific field
jeeves-server config '$.auth.modes'         # Nested query
```

### Platform-specific settings

**Windows** — drives are auto-discovered; no `roots` config needed:
```json
{ "chromePath": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" }
```

**Linux** — configure filesystem roots for the file browser:
```json
{
  "chromePath": "/usr/bin/chromium-browser",
  "roots": {
    "home": "/home",
    "projects": "/opt/projects"
  }
}
```

On Windows, `roots` is ignored. On Linux, if omitted, it defaults to `{ "root": "/" }`.

### Config persistence

The config file is loaded at startup and validated against the Zod schema. The server writes back to `config.json` in two cases: when an insider's key seed is auto-generated on first login (Google OAuth or email magic link), and when an insider rotates their key. These updates are atomic (file-locked) and the server reloads the affected config section automatically.

---

## Authentication Modes

Jeeves Server supports three authentication methods, configured via `auth.modes`:

```json
{
  "auth": {
    "modes": ["email", "google", "keys"]
  }
}
```

You can enable any combination. The order matters — modes are checked in the order listed.

### Google OAuth (`"google"`)

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

### Key-Based Auth (`"keys"`)

**Best for:** Headless access, bot integrations, simple setups without Google.

Users authenticate by appending `?key=<value>` to any URL. The server derives keys from configured seeds using HMAC-SHA256.

**Requirements when enabled:**
- At least one entry in `keys`

**How keys work:** You configure a **seed** (a random secret string). The server derives the actual key from it via HMAC. You never put the derived key in the config — only the seed. To get the derived key:

```bash
curl -H "X-API-Key: <seed>" https://your-domain.com/insider-key
```

### Email Magic Link (`"email"`)

**Best for:** Teams where insiders don't use Google Workspace, or any setup where passwordless email login is preferred.

Users enter their email on the sign-in page. If the email matches a configured insider, the server sends a login link via SMTP. Clicking the link sets a session cookie — identical to Google OAuth sessions.

**Requirements when enabled:**
- `auth.email.smtpUrl` — SMTP connection string (e.g. `smtps://user:pass@smtp.example.com:465`)
- `auth.email.fromAddress` — Sender email address (e.g. `login@jeeves.id`)
- `auth.sessionSecret` — a random string for signing session cookies (shared with Google auth)
- At least one entry in `insiders`

**How it works:**
1. User enters their email on the sign-in page.
2. If the email matches a configured insider, the server generates a self-validating signed token (HMAC-SHA256, stateless) and an 8-character OTP code.
3. The signed token is encrypted with AES-256-GCM using the OTP as the key.
4. The user's browser is redirected to a verification page containing the encrypted blob in the URL.
5. The server sends an email containing both the OTP code and a clickable magic link.
6. The user either enters the OTP code on the verification page (which decrypts the token client-side) or clicks the magic link directly.

**Security notes:**
- The `POST /api/auth/magic` endpoint always returns 200 OK with a `verifyUrl` regardless of whether the email matches an insider (prevents email enumeration — invalid emails receive a fake encrypted blob)
- Tokens are fully stateless (self-validating signed tokens with HMAC-SHA256) — no server-side storage
- Tokens expire after 10 minutes
- OTP alphabet is 32 lowercase alphanumeric characters with ambiguous characters (0, 1, o, l) excluded

### Both Modes Together

When multiple modes are active, browser users log in with Google or email magic link, and bots/scripts use `?key=` for stateless access. All methods work on every endpoint.

| Scenario | Recommended |
|----------|-------------|
| Team of humans with Google Workspace | `["google"]` |
| Team without Google Workspace | `["email"]` |
| Bot/script access only | `["keys"]` |
| Humans + bots on the same server | `["google", "keys"]` or `["email", "keys"]` |
| Maximum flexibility (all login methods) | `["email", "google", "keys"]` |
| Quick local setup, no credentials | `["keys"]` |

---

## Named Access Scopes

Define reusable scope policies at the top level, then reference them by name from insiders, keys, or the outsider policy:

```json
{
  "scopes": {
    "engineering": {
      "allow": ["/d/repos/*", "/d/docs/*"],
      "deny": ["/d/docs/hr/*"]
    },
    "readonly-projects": {
      "allow": ["/d/projects/*"]
    }
  },
  "insiders": {
    "dev@example.com": { "scopes": "engineering" },
    "contractor@example.com": {
      "scopes": "readonly-projects",
      "deny": ["/d/projects/secret/*"]
    }
  }
}
```

Named scopes are **atomic** — composition happens at the point of use. An insider or key referencing a named scope can add extra `allow` and `deny` patterns that merge on top of the named scope's rules.

Scopes can also be specified inline (without named references) using the same formats as before:

```json
{ "scopes": ["/d/projects/*"] }
{ "scopes": { "allow": ["/d/*"], "deny": ["/d/secrets/*"] } }
```

---

## Insiders

The `insiders` map defines **who** has full browsing access:

```json
{
  "insiders": {
    "alice@example.com": {},
    "contractor@example.com": { "scopes": "restricted" },
    "team@example.com": {
      "scopes": { "allow": ["/d/*"], "deny": ["/d/secrets/*"] }
    }
  }
}
```

See the [Insiders, Outsiders & Sharing](sharing.md) guide for the full access model.

---

## Keys

The `keys` map defines **named API keys** for machine and human access:

```json
{
  "keys": {
    "primary": "a-random-64-char-hex-string",
    "webhook-notion": {
      "key": "another-random-hex-string",
      "scopes": ["/event"]
    },
    "_internal": "seed-for-pdf-export",
    "_plugin": "seed-for-openclaw-plugin"
  }
}
```

**Generate seeds with:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Reserved keys

| Key | Purpose | Scopes |
|-----|---------|--------|
| `_internal` | Puppeteer uses this to authenticate when rendering PDFs/DOCX. **Required for export.** | Must be unscoped |
| `_plugin` | OpenClaw plugin authentication. See [OpenClaw Integration](../../openclaw/guides/openclaw-integration.md). | Must be unscoped |

Both reserved keys are enforced unscoped by the Zod schema.

---

## Event Gateway

See the [Event Gateway](event-gateway.md) guide for full configuration and usage.

---

## Optional Integrations

### jeeves-watcher (Semantic Search)

The server proxies semantic search queries to [jeeves-watcher](https://github.com/karmaniverous/jeeves-watcher) and provides a search UI in the header, with filter facets and scope-aware result filtering. The watcher URL is resolved automatically via core service discovery (default port 1936).

To override the default URL, configure it in `{configRoot}/jeeves-core/config.json`:

```json
{ "services": { "watcher": { "url": "http://custom-host:1936" } } }
```

### jeeves-runner (Process Dashboard)

The server proxies runner API calls for the process dashboard UI. The runner URL is resolved automatically via core service discovery (default port 1937).

To override the default URL, configure it in `{configRoot}/jeeves-core/config.json`:

```json
{ "services": { "runner": { "url": "http://custom-host:1937" } } }
```

### PlantUML

Mermaid is bundled as a direct dependency — no configuration needed. PlantUML uses a fallback pipeline:

1. **Local Java jar** (downloaded automatically via `postinstall`) — fastest, supports `!include`
2. **Configured PlantUML servers** — private instances, tried in order
3. **Public community server** (`plantuml.com`) — always appended as last resort

```json
{
  "plantuml": {
    "jarPath": "/opt/plantuml/plantuml.jar",
    "javaPath": "/usr/bin/java",
    "servers": ["https://internal.plantuml.example.com/plantuml"]
  }
}
```

If `plantuml` is omitted entirely, only the community server is used.

---

## Instance Branding

Customize the server's appearance and email communications:

```json
{
  "branding": {
    "name": "My Company Docs",
    "emoji": "📚",
    "theme": {
      "light": {
        "primary": "#1a73e8",
        "background": "#ffffff"
      },
      "dark": {
        "primary": "#8ab4f8",
        "background": "#1a1a1a"
      }
    },
    "emailTemplate": "<p>{{branding.emoji}} Click <a href=\"{{{magicLink}}}\">here</a> to sign in to {{branding.name}}</p>"
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | `"Jeeves Server"` | Instance display name — used in page title, navbar, and login emails |
| `emoji` | string | `"🎩"` | Home icon in the navbar |
| `theme` | object | — | CSS variable overrides under `light` and `dark` keys |
| `emailTemplate` | string | — | Handlebars template for magic link emails. Available variables: `{{{magicLink}}}`, `{{otpCode}}`, `{{branding.name}}`, `{{branding.emoji}}` |

The `theme` object maps CSS custom property names to values. Keys under `light` are injected into `:root`; keys under `dark` are injected into `.dark`. When omitted, the default Tailwind theme applies.

Branding is surfaced via the `/status` endpoint (no auth required) so the React client can apply it on load.

---

## Config Reference

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `port` | number | `1934` | Server port |
| `chromePath` | string | *required* | Path to Chrome/Chromium executable |
| `auth` | object | *required* | Authentication configuration |
| `scopes` | object | `{}` | Named scope definitions |
| `insiders` | object | `{}` | Email → insider entry map |
| `keys` | object | `{}` | Named key entries |
| `events` | object | `{}` | Event gateway schemas |
| `eventTimeoutMs` | number | `30000` | Default event command timeout |
| `eventLogPurgeMs` | number | `2592000000` | Event log retention (default: 30 days) |
| `maxZipSizeMb` | number | `100` | Max directory size for ZIP export |
| `roots` | object | — | Linux filesystem roots (ignored on Windows) |
| ~~`watcherUrl`~~ | — | — | **Deprecated in v3.6.0.** Use core service discovery. |
| ~~`runnerUrl`~~ | — | — | **Deprecated in v3.6.0.** Use core service discovery. |
| ~~`host`~~ | — | — | **Deprecated in v3.6.0.** Use `getBindAddress()` via core. |
| ~~`metaUrl`~~ | — | — | **Deprecated in v3.6.0.** Use core service discovery. |
| `branding` | object | — | Instance branding (name, emoji, theme, email template) |
| `auth.email` | object | — | Email magic link config (required when modes includes `"email"`) |
| `plantuml` | object | — | PlantUML rendering config |
| `diagramCachePath` | string | `.diagram-cache` | Cached rendered diagram directory |
| `publicUrl` | string | — | Public base URL (e.g. `https://docs.example.com`). When set, API responses include full public URLs. |
| `eventQueue` | string | `{installDir}/logs/event-queue.jsonl` | Absolute path to the durable event queue file. Cursor file is `eventQueue + '.cursor'`. |
| `eventQueueConcurrency` | number | `3` | Maximum concurrent event queue entries per batch. |
| `outsiderPolicy` | scopes | — | Global outsider sharing constraints |
| `oauth` | object | — | OAuth2 credential management (credential directory and named providers) |
| `go` | object | — | Shortlink redirects (`GET /go/:slug` → target URL) |
| `mermaidCliPath` | string | — | **Deprecated.** Mermaid is now bundled. |
