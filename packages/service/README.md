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

`jeeves.print` names a print style registered under `printStyles` in the server config: the PDF export adds its stylesheet after the default print CSS and applies its page size, margins, header and footer, and the response names it in `X-Print-Style`. PDF only; an unregistered name gives default styling. See [Exports](guides/exports.md#print-styles) and [Setup](guides/setup.md#print-styles).

A document's title is its front-matter `title` (a non-empty string), else the file name; other files and directories use their name, a drive root its label. `GET /api/file/*` returns it as `title`, the browser tab shows `{title} - {branding.name}`, and the page shell of `/browse/<path>` carries it in `<title>` and `og:title` for link unfurlers, but only for a request that passes the sign-in gate (a share link, a session or a key). A slow watcher never delays that page more than 1.5 s: the file name is used instead.

## Upgrading from 3.15

3.16.0 changes the API in a minor version: every error is Fastify's standard body with a `SERVER_*` code, `POST /rotate-key` and `GET /share` are gone, `/config` and `/config/apply` are admin-only (unscoped insiders and keys), `/status` hides event commands and the Chrome path from non-admins, `POST /event` takes JSON objects only, and Node.js 24.22.2 or later is required. Upgrade the OpenClaw plugin to 0.16.0 at the same time. See [Migrating to 3.16](guides/migrating-to-3.16.md).

## API

Every machine-API route is an entry of the endpoint catalog (`SERVER_CATALOG` in `@karmaniverous/jeeves-server-core`), which also yields `GET /openapi.json` (no auth) and the typed client `@karmaniverous/jeeves-server-sdk`. `GET /health` and `GET /status` need no credentials. The [API Reference](guides/api-reference.md) is generated from the catalog; [API & Integration](guides/api-integration.md) covers credentials, route behaviour and error codes.

## Docs

- [Setup & Configuration](guides/setup.md)
- [Deployment](guides/deployment.md)
- [Sharing](guides/sharing.md)
- [Exports](guides/exports.md)
- [Event Gateway](guides/event-gateway.md)
- [API Integration](guides/api-integration.md)
- [API Reference](guides/api-reference.md)
- [Migrating to 3.16](guides/migrating-to-3.16.md)
