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
    "modes": ["keys", "google"],
    "google": {
      "clientId": "your-google-client-id",
      "clientSecret": "your-google-client-secret"
    },
    "sessionSecret": "random-session-signing-secret"
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

The config file is loaded at startup and validated against the Zod schema. The server writes back to `config.json` in two cases: when an insider's key seed is auto-generated on first Google login, and when an insider rotates their key. These updates are atomic (file-locked) and the server reloads the affected config section automatically.

---

## Authentication Modes

Jeeves Server supports two authentication methods, configured via `auth.modes`:

```json
{
  "auth": {
    "modes": ["google", "keys"]
  }
}
```

You can enable one or both. The order matters — modes are checked in the order listed.

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

### Both Modes Together

When both are active, browser users log in with Google, and bots/scripts use `?key=` for stateless access. Both methods work on every endpoint.

| Scenario | Recommended |
|----------|-------------|
| Team of humans accessing via browser | `["google"]` |
| Bot/script access only | `["keys"]` |
| Humans + bots on the same server | `["google", "keys"]` |
| Quick local setup, no Google credentials | `["keys"]` |

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
| `plantuml` | object | — | PlantUML rendering config |
| `diagramCachePath` | string | `.diagram-cache` | Cached rendered diagram directory |
| `outsiderPolicy` | scopes | — | Global outsider sharing constraints |
| `oauth` | object | — | OAuth2 credential management (credential directory and named providers) |
| `go` | object | — | Shortlink redirects (`GET /go/:slug` → target URL) |
| `mermaidCliPath` | string | — | **Deprecated.** Mermaid is now bundled. |
