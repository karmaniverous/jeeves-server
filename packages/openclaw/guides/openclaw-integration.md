# OpenClaw Integration Guide

## Installation

```bash
npx @karmaniverous/jeeves-server-openclaw install
```

This copies the plugin to `~/.openclaw/extensions/` and patches `openclaw.json`.
Restart the OpenClaw gateway after installing.

## Configuration

### Server Config

Add a `_plugin` key to the server's `keys` config:

```json
{
  "keys": {
    "_internal": "your-internal-seed",
    "_plugin": "hex-seed-for-openclaw-plugin"
  }
}
```

The `_plugin` key must be unscoped (no scope restrictions) — this is enforced by the Zod schema.

### OpenClaw Config

In `openclaw.json`, configure the plugin entry:

```json
{
  "plugins": {
    "entries": {
      "jeeves-server-openclaw": {
        "enabled": true,
        "config": {
          "apiUrl": "http://127.0.0.1:1934",
          "pluginKey": "same-hex-seed-as-server-_plugin-key"
        }
      }
    }
  }
}
```

## Tools

| Tool | Purpose |
|------|---------|
| `server_status` | Server health: version, uptime, Chrome availability, export formats |
| `server_browse` | Get file/directory metadata and listings |
| `server_link_info` | Query available link types for a path |
| `server_share` | Generate share links with optional expiry and depth |
| `server_export` | Trigger export (PDF, DOCX, SVG, PNG, ZIP) |
| `server_event_status` | Query event gateway schemas and recent event log entries |

## TOOLS.md Injection

The plugin automatically maintains a `## Server` section in your workspace `TOOLS.md` file, refreshing every 60 seconds. This provides agents with live context about server capabilities, export formats, connected services, and event gateway schemas.

## Uninstalling

```bash
npx @karmaniverous/jeeves-server-openclaw uninstall
```

This removes the plugin from extensions, cleans up `openclaw.json`, and removes the `## Server` section from `TOOLS.md`.
