# @karmaniverous/jeeves-server-openclaw

OpenClaw plugin for Jeeves Server. Integrates with `@karmaniverous/jeeves` core for managed TOOLS.md writing, service lifecycle commands, and platform content maintenance.

Provides agents with tools for:

- Server status and capabilities
- File/directory metadata browsing
- Share link generation
- Export (PDF/DOCX/SVG/PNG/ZIP)
- Event gateway visibility

## Install

```bash
npx @karmaniverous/jeeves-server-openclaw install
# Restart OpenClaw gateway after installing
```

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
          "configRoot": "j:/config",
          "publicUrl": "https://jeeves.example.com"
        }
      }
    }
  }
}
```

| Config | Default | Description |
|--------|---------|-------------|
| `apiUrl` | `http://127.0.0.1:1934` | Server API base URL |
| `pluginKey` | — | Server `_plugin` key seed |
| `configRoot` | `j:/config` | Platform config root (core derives component config dirs) |
| `publicUrl` | — | Public base URL for shareable links. When set, URLs returned by tools are rewritten to this host. |

## Docs

- [OpenClaw Integration](./guides/openclaw-integration.md) — Full configuration, tool reference, architecture

