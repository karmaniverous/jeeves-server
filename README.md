# Jeeves Server 🎩

**Turn AI-authored documents into business-ready deliverables.**

A self-hosted file browser, document viewer, and webhook gateway. Author documents in Markdown with your AI assistant, then share them as beautifully rendered pages, PDFs, or Word documents — no friction, no external dependencies.

## Packages

This is a monorepo with four packages:

| Package | Description |
| --- | --- |
| [`@karmaniverous/jeeves-server`](packages/service/) | The server — file browser, document renderer, export engine, event gateway |
| [`@karmaniverous/jeeves-server-openclaw`](packages/openclaw/) | OpenClaw plugin — gives AI agents tools for browsing, sharing, and exporting |
| [`@karmaniverous/jeeves-server-sdk`](packages/sdk/) | Typed, browser-safe client for the server's HTTP API, built from the endpoint catalog |
| [`@karmaniverous/jeeves-server-core`](packages/core/) | Endpoint catalog and schemas, error codes, OpenAPI document, config schema and key utilities, shared by the other packages |

## Quick Start

```bash
# Install globally
npm install -g @karmaniverous/jeeves-server

# Create a config file (JSON only)
# See guides/setup.md for full config reference
mkdir -p jeeves-server
cat > jeeves-server/config.json << 'EOF'
{
  "chromePath": "/usr/bin/chromium-browser",
  "auth": {
    "modes": ["keys"]
  },
  "keys": {
    "_internal": "generate-a-random-hex-string",
    "primary": "another-random-hex-string"
  }
}
EOF

# Start the server (default port: 1934)
jeeves-server start
```

Generate key seeds with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Features

- **File Browser** — Navigate drives and directories through a modern React UI, with directory item counts
- **Markdown Rendering** — Prose with collapsible TOC sidebar, collapsible frontmatter, adjustable reading width, dark/light themes
- **CSV Table Rendering** — `.csv` files render as HTML tables with a Rendered/Raw tab
- **PDF & DOCX Export** — One-click, perfectly rendered, business-ready
- **Print Styles** — Named PDF styles in server config (`printStyles`), chosen per document with a `jeeves: { print: <name> }` front-matter directive (the `jeeves:` mapping is the platform's reserved namespace and is hidden from displayed front matter)
- **Code Highlighting** — Syntax highlighting with copy and word-wrap toggle
- **SVG, Mermaid & PlantUML Diagrams** — Rendered inline with pan/zoom; Mermaid is bundled, PlantUML uses a fallback pipeline (local jar → private servers → community server)
- **Embedded Diagrams in Markdown** — `mermaid` and `plantuml` fenced code blocks render as inline SVGs
- **Secure Sharing** — Expiring links with HMAC signatures, scoped access
- **Magic Link Auth** — Passwordless email login via SMTP, alongside Google OAuth and key-based auth
- **Instance Branding** — Configurable name, emoji, color themes, and email templates
- **Named Access Scopes** — Define reusable scope policies, reference them by name across insiders and keys
- **Event Gateway** — Webhook receiver with JSON Schema validation and durable queue
- **Semantic Search** — Full-text search via [jeeves-watcher](https://github.com/karmaniverous/jeeves-watcher) integration
- **OpenClaw Plugin** — AI agents can browse, share, export, and query server status via tools
- **CLI** — `start`, `status`, `config [jsonpath]`, `config validate`, `config apply`, `init`, `service install/start/stop/restart`
- **Zero CDN** — All assets served locally, no external dependencies

## Configuration

Jeeves Server uses **JSON-only** configuration. The config file follows the path convention `<configDir>/jeeves-server/config.json`. Legacy paths (`jeeves-server.config.json`) are auto-migrated on first use.

```bash
# Generate a starter config
jeeves-server init --config /path/to/config-dir

# Or specify explicitly
jeeves-server start --config /path/to/jeeves-server/config.json
```

Configuration is validated at startup against a [Zod 4](https://github.com/colinhacks/zod) schema. The schema in `packages/core/src/schema.ts` is the single source of truth (re-exported by the service package).

**Environment variable substitution:** Use `${VAR_NAME}` in string config values and they'll be replaced from `process.env` at load time.

See the [Setup & Configuration](packages/service/guides/setup.md) guide for full details.

## CLI

```bash
# Start the server
jeeves-server start [--config <path>]

# Query running server status
jeeves-server status [--port <port>]

# Query resolved configuration (supports JSONPath; needs an admin key)
jeeves-server config [jsonpath] [--port <port>] [--key <key>] [--config <path>]

# Validate configuration
jeeves-server config validate --config <path>

# Apply a config patch (--file, or JSON on stdin) to the running server (needs an admin key)
jeeves-server config apply [--file <path>] [--replace] [--port <port>] [--key <key>] [--config <path>]

# Generate a starter config file
jeeves-server init [--config <path>]

# Service management (executes directly — NSSM on Windows, systemd on Linux)
jeeves-server service install [--config <path>] [--name <service-name>]
jeeves-server service uninstall [--name <service-name>]
jeeves-server service start|stop|restart|status [--name <service-name>]
```

`status`, `config` and `config apply` call the server at `http://127.0.0.1:<port>` (default 1934) through the [SDK](packages/sdk/). `/config` and `/config/apply` are admin routes, so `config` and `config apply` send a key: `--key <key>` (an unscoped insider or machine key), else the `JEEVES_SERVER_KEY` environment variable, else the insider key derived from `keys._plugin` in the server config file given by `--config`. A failure prints `<code>: <message>` (e.g. `SERVER_UNAUTHORIZED: …`), with a hint on where to supply the key after a 401 or 403.

## Guides

- [Setup & Configuration](packages/service/guides/setup.md) — Installation, auth modes, config structure, named scopes
- [Insiders, Outsiders & Sharing](packages/service/guides/sharing.md) — Access model, share links, key derivation, expiry, rotation
- [Exporting & Downloads](packages/service/guides/exports.md) — PDF, DOCX, SVG, PNG, and ZIP export
- [Event Gateway](packages/service/guides/event-gateway.md) — Webhook receiving, JSON Schema matching, body mapping, durable queue
- [Deployment](packages/service/guides/deployment.md) — Running as a service, reverse proxy, HTTPS, updates
- [API & Integration](packages/service/guides/api-integration.md) — SDK usage, route behaviour, error codes, path conversion, share link generation
- [API Reference](packages/service/guides/api-reference.md) — Every route of the endpoint catalog (generated); also `GET /openapi.json`
- [Migrating to 3.16](packages/service/guides/migrating-to-3.16.md) — Breaking changes in 3.16.0 and plugin 0.16.0
- [OpenClaw Integration](packages/openclaw/guides/openclaw-integration.md) — Plugin installation, configuration, tool reference

## Upgrading from 3.15

3.16.0 ships breaking API changes in a minor version (4.0.0 is reserved for the release aligned with OpenClaw's stable release): one error body with `SERVER_*` codes, removed `POST /rotate-key` and `GET /share`, admin-only `/config` and `/config/apply`, admin-only fields in `/status`, JSON objects only on `POST /event`, and Node.js 24.22.2 or later. Upgrade the server and the plugin (0.16.0) together. See [Migrating to 3.16](packages/service/guides/migrating-to-3.16.md).

## Platform Support

- **Windows:** File browser auto-discovers drive letters (A–Z). Chrome path defaults to Program Files.
- **Linux:** File browser uses configurable `roots` (e.g. `{ home: '/home', projects: '/opt/projects' }`). Chromium path is typically `/usr/bin/chromium-browser`.

Both platforms are tested in CI (GitHub Actions on Ubuntu, Node 24.22.2 and the latest Node 24). Node.js 24.22.2 or later is required (the floor for every Jeeves component: the built-in SQLite in Node 24.16.0-24.18.0 left WAL files un-checkpointed); the CLI exits with an error on an older Node.

## Development

```bash
git clone https://github.com/karmaniverous/jeeves-server.git
cd jeeves-server
npm install

# Build everything
npm run build

# Run all checks
npm run typecheck
npm run lint
npm test
npm run knip
```

The monorepo uses npm workspaces. The dev server runs on port 19340 by default.

## Releasing

Each package is released separately with release-it (`npm run release` in its directory), in this order:

1. **Core** (`packages/core`) first, whenever it has changed.
2. **SDK** (`packages/sdk`), after core is published. If core's version changed, raise its `@karmaniverous/jeeves-server-core` range to the new version (e.g. `^0.4.0`) in the release commit.
3. **Server** (`packages/service`) and **plugin** (`packages/openclaw`) together, after core and the SDK are published. Raise their `@karmaniverous/jeeves-server-core` and `@karmaniverous/jeeves-server-sdk` ranges to the versions just released in the release commit.

The SDK, server and plugin bundles import core (and the server and plugin the SDK) at runtime, so a range that excludes the new version would install an older one without the exports they need. `before:init` hooks (`scripts/check-core-range.mjs`) stop a release when its declared core range, or its SDK range (`--sibling ../sdk/package.json`), doesn't admit the version in the workspace.

## License

BSD-3-Clause

---

Built for you with ❤️ on Bali by [Jason Williscroft](https://github.com/karmaniverous) & [Jeeves](https://github.com/jgs-jeeves).
