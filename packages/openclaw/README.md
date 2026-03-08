# @karmaniverous/jeeves-server-openclaw

OpenClaw plugin for Jeeves Server. Provides agents with tools for:

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
          "pluginKey": "<same-seed-as-server-_plugin>"
        }
      }
    }
  }
}
```

## Docs

- OpenClaw Integration: ./guides/openclaw-integration.md

