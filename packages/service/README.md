# @karmaniverous/jeeves-server

Jeeves Server — secure file browser, markdown viewer, and webhook gateway with PDF/DOCX export and expiring share links.

## Install

```bash
npm install -g @karmaniverous/jeeves-server
```

## Run

Jeeves Server loads configuration via cosmiconfig. Create a config file such as `jeeves-server.config.json` and run:

```bash
jeeves-server start [--config <path>]
```

Default port: **1934**.

## CLI

```bash
jeeves-server start
jeeves-server config validate
jeeves-server config show
jeeves-server service install
jeeves-server service uninstall
jeeves-server service start|stop|restart
```

## Docs

- Setup & Configuration: ../../packages/service/guides/setup.md
- Deployment: ../../packages/service/guides/deployment.md
- Sharing: ../../packages/service/guides/sharing.md
- Exports: ../../packages/service/guides/exports.md
- Event Gateway: ../../packages/service/guides/event-gateway.md
- API Integration: ../../packages/service/guides/api-integration.md

## Public endpoints

- `GET /health` — health check
- `GET /api/status` — server metadata (public; no auth)

