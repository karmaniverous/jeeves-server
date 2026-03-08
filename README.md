# Jeeves Server 🎩

**Turn AI-authored documents into business-ready deliverables.**

A self-hosted file browser, document viewer, and webhook gateway. Author documents in Markdown with your AI assistant, then share them as beautifully rendered pages, PDFs, or Word documents — no friction, no external dependencies.

## Packages

This is a monorepo with two published packages:

| Package | Description |
|---------|-------------|
| [`@karmaniverous/jeeves-server`](packages/service/) | The server — file browser, document renderer, export engine, event gateway |
| [`@karmaniverous/jeeves-server-openclaw`](packages/openclaw/) | OpenClaw plugin — gives AI agents tools for browsing, sharing, and exporting |

## Quick Start

```bash
# Install globally
npm install -g @karmaniverous/jeeves-server

# Create a config file (JSON, YAML, JS, or TS — via cosmiconfig)
# See guides/setup.md for full config reference
cat > jeeves-server.config.json << 'EOF'
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

- **File Browser** — Navigate drives and directories through a modern React UI
- **Markdown Rendering** — Prose with TOC sidebar, adjustable reading width, dark/light themes
- **PDF & DOCX Export** — One-click, perfectly rendered, business-ready
- **Code Highlighting** — Syntax highlighting with copy buttons
- **SVG, Mermaid & PlantUML Diagrams** — Rendered inline with pan/zoom; Mermaid is bundled, PlantUML uses a fallback pipeline (local jar → private servers → community server)
- **Embedded Diagrams in Markdown** — `mermaid` and `plantuml` fenced code blocks render as inline SVGs
- **Secure Sharing** — Expiring links with HMAC signatures, scoped access
- **Named Access Scopes** — Define reusable scope policies, reference them by name across insiders and keys
- **Event Gateway** — Webhook receiver with JSON Schema validation and durable queue
- **Semantic Search** — Full-text search via [jeeves-watcher](https://github.com/karmaniverous/jeeves-watcher) integration
- **OpenClaw Plugin** — AI agents can browse, share, export, and query server status via tools
- **CLI** — `jeeves-server start`, `config validate`, `config show`, `service install`
- **Zero CDN** — All assets served locally, no external dependencies

## Configuration

Jeeves Server uses [cosmiconfig](https://github.com/cosmiconfig/cosmiconfig) for configuration. It searches for:

- `jeeves-server.config.json` / `.yaml` / `.yml`
- `jeeves-server.config.js` / `.ts` / `.mjs` / `.cjs`
- `.jeeves-serverrc` / `.jeeves-serverrc.json` / `.jeeves-serverrc.yaml`
- `package.json` (`"jeeves-server"` key)

Configuration is validated at startup against a [Zod](https://github.com/colinhacks/zod) schema. The schema in `packages/service/src/config/schema.ts` is the single source of truth.

**Environment variable substitution:** Use `${VAR_NAME}` in string config values and they'll be replaced from `process.env` at load time.

See the [Setup & Configuration](packages/service/guides/setup.md) guide for full details.

## CLI

```bash
# Start the server
jeeves-server start [--config <path>]

# Validate configuration
jeeves-server config validate [--config <path>]

# Show resolved configuration (insiders, keys, scopes)
jeeves-server config show [--config <path>]

# Print service install/uninstall instructions (NSSM on Windows, systemd on Linux)
jeeves-server service install [--config <path>] [--name <service-name>]
jeeves-server service uninstall [--name <service-name>]

# Manage installed service
jeeves-server service start|stop|restart [--name <service-name>]
```

## Guides

- [Setup & Configuration](packages/service/guides/setup.md) — Installation, auth modes, config structure, named scopes
- [Insiders, Outsiders & Sharing](packages/service/guides/sharing.md) — Access model, share links, key derivation, expiry, rotation
- [Exporting & Downloads](packages/service/guides/exports.md) — PDF, DOCX, SVG, PNG, and ZIP export
- [Event Gateway](packages/service/guides/event-gateway.md) — Webhook receiving, JSON Schema matching, body mapping, durable queue
- [Deployment](packages/service/guides/deployment.md) — Running as a service, reverse proxy, HTTPS, updates
- [API & Integration](packages/service/guides/api-integration.md) — Endpoint reference, path conversion, share link generation
- [OpenClaw Integration](packages/openclaw/guides/openclaw-integration.md) — Plugin installation, configuration, tool reference

## Platform Support

- **Windows:** File browser auto-discovers drive letters (A–Z). Chrome path defaults to Program Files.
- **Linux:** File browser uses configurable `roots` (e.g. `{ home: '/home', projects: '/opt/projects' }`). Chromium path is typically `/usr/bin/chromium-browser`.

Both platforms are tested in CI (GitHub Actions on Ubuntu, Node 20 + 22).

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

## License

MIT
