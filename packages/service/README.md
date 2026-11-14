# @karmaniverous/jeeves-server

Jeeves Server — secure file browser, markdown viewer, and webhook gateway with PDF/DOCX export and expiring share links.

## Install

```bash
npm install -g @karmaniverous/jeeves-server
```

## Run

Create a JSON config file at `<configDir>/jeeves-server/config.json` (or use `jeeves-server init`), then:

```bash
jeeves-server start [--config <path>]
```

Default port: **1934**.

## CLI

```bash
jeeves-server start                      # Start the server
jeeves-server status                     # Query running server status
jeeves-server config [jsonpath]          # Query resolved configuration (admin key)
jeeves-server config validate            # Validate config file
jeeves-server config apply               # Apply config patch to running server (admin key)
jeeves-server init                       # Generate starter config
jeeves-server service install|uninstall  # Register/remove system service
jeeves-server service start|stop|restart|status  # Manage system service
```

`status`, `config` and `config apply` call `http://127.0.0.1:<port>` (`--port`, default 1934) through `@karmaniverous/jeeves-server-sdk`. `config` and `config apply` send an admin key: `--key <key>`, else the `JEEVES_SERVER_KEY` environment variable, else the insider key derived from `keys._plugin` in the config file given by `-c, --config`. Failures print `<code>: <message>`, with a hint on where to supply the key after a 401 or 403.

## Markdown documents

A Markdown document is a `.md` or `.markdown` file, or any other text file jeeves-watcher renders as Markdown (`renderAs: 'md'`). The file view, PDF/DOCX export and `GET /api/link-info/*` treat exactly these files as Markdown, so the Download menu, the advertised export links and the export route agree. Exporting a watcher-rendered file while the watcher is unreachable answers `502 SERVER_WATCHER_UNAVAILABLE`.

Front matter is parsed as YAML 1.2. The top-level key `jeeves` is reserved for the whole Jeeves platform when its value is a mapping: a namespace for directives addressed to Jeeves components (jeeves-server reads `jeeves.print`). The whole `jeeves` mapping is hidden from the displayed front matter, on screen and in PDF and DOCX; the other keys are shown with their comments and order. Any other `jeeves` value is ordinary front matter. Invalid YAML is shown as written.

```yaml
---
title: Daily Industry Brief
jeeves:
  print: bca-brief
---
```

## Docs

- [Setup & Configuration](guides/setup.md)
- [Deployment](guides/deployment.md)
- [Sharing](guides/sharing.md)
- [Exports](guides/exports.md)
- [Event Gateway](guides/event-gateway.md)
- [API Integration](guides/api-integration.md)

## Public Endpoints

- `GET /health` — liveness check (`{ "ok": true }`, no auth)
- `GET /status` - server status (version, health, capabilities; event commands and the Chrome path for admins only)
- `GET /config [?path=jsonpath]` - query resolved config (admin: a session or insider key with no scopes)
