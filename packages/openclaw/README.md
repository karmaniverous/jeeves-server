# @karmaniverous/jeeves-server-openclaw

OpenClaw plugin for Jeeves Server. A standard OpenClaw plugin built on the `@karmaniverous/jeeves` core: it registers tools and ships a skill, and writes no workspace content at runtime.

Provides agents with tools for:

- Server status and capabilities
- File/directory browsing, metadata, and drive listing
- File writing and structured mutation
- Share link generation (with insider/outsider audience support)
- Export (PDF/DOCX/SVG/PNG/ZIP) and cache management
- Key rotation and auth status
- Event gateway visibility
- OAuth2 credential management (authorize, status, token retrieval)

## Install

```bash
npm install -g @karmaniverous/jeeves
jeeves install server --config-root /path/to/config
# Restart the OpenClaw gateway after installing
```

`jeeves install` runs `openclaw plugins install npm:@karmaniverous/jeeves-server-openclaw@<version> --pin --accept-capabilities` and writes the plugin config below. There is no plugin-specific installer.

## Configuration

### Server

Add an unscoped `_plugin` key to your Jeeves Server config:

```json
{ "keys": { "_plugin": "<seed>" } }
```

### OpenClaw

```json
{
  "plugins": {
    "entries": {
      "jeeves-server-openclaw": {
        "enabled": true,
        "config": {
          "apiUrl": "http://127.0.0.1:1934",
          "pluginKey": "<same-seed-as-server-_plugin>",
          "configRoot": "j:/config"
        }
      }
    }
  }
}
```

| Config | Default | Description |
| --- | --- | --- |
| `apiUrl` | `http://127.0.0.1:1934` | Server API base URL |
| `pluginKey` | — | Server `_plugin` key seed |
| `configRoot` | — | Platform config root (core derives component config dirs). Falls back to the `JEEVES_CONFIG_ROOT` env var. |

The plugin always loads, even before `configRoot` is set: it logs one warning, and its tools return a `configRoot not configured` error until you set `configRoot` in the plugin config or `JEEVES_CONFIG_ROOT`. The root is read when a tool runs, not at registration.

URLs returned by tools are rewritten to the server's `publicUrl`, read from `{configRoot}/jeeves-server/config.json` (or the `JEEVES_SERVER_PUBLIC_URL` env var).

## Docs

- [OpenClaw Integration](./guides/openclaw-integration.md) — Full configuration, tool reference, architecture
