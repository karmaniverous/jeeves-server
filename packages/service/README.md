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
jeeves-server config [jsonpath]          # Query resolved configuration
jeeves-server config validate            # Validate config file
jeeves-server config apply               # Apply config patch to running server
jeeves-server init                       # Generate starter config
jeeves-server service install|uninstall  # Register/remove system service
jeeves-server service start|stop|restart|status  # Manage system service
```

## Docs

- [Setup & Configuration](guides/setup.md)
- [Deployment](guides/deployment.md)
- [Sharing](guides/sharing.md)
- [Exports](guides/exports.md)
- [Event Gateway](guides/event-gateway.md)
- [API Integration](guides/api-integration.md)

## Public Endpoints

- `GET /status` — server status (version, health, capabilities)
- `GET /config [?path=jsonpath]` — query resolved config (auth required)
