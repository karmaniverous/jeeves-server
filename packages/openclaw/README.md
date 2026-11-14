# @karmaniverous/jeeves-server-openclaw

OpenClaw plugin for Jeeves Server. A standard OpenClaw plugin built on the `@karmaniverous/jeeves` core: it registers tools and ships a skill, and writes no workspace content at runtime.

Provides agents with tools for:

- Server status and capabilities
- File/directory browsing, metadata, and drive listing
- File writing and structured mutation
- Share link generation (with insider/outsider audience support)
- Export download URLs (PDF/DOCX/ZIP/Tar/SVG/PNG) and cache management
- Auth status
- Event gateway visibility
- OAuth2 credential management (authorize, status, token retrieval)

## Install

```bash
npm install -g @karmaniverous/jeeves
jeeves install server --config-root /path/to/config
# Restart the OpenClaw gateway after installing
```

`jeeves install` runs `openclaw plugins install npm:@karmaniverous/jeeves-server-openclaw@<version> --pin --accept-capabilities --force` and writes the plugin config below. There is no plugin-specific installer.

### Checked against `@karmaniverous/jeeves` 0.11.0

The install behaviour this plugin documents was checked against jeeves 0.11.0's `jeeves install`, `update` and `uninstall` source (jeeves-server 3.16.0). It matches: the `openclaw plugins install` command line above; the config written to `plugins.entries.jeeves-server-openclaw.config` (`configRoot` from `--config-root`, required; `apiUrl`, default `http://127.0.0.1:1934`; `pluginKey`); removal of a legacy `extensions/jeeves-server-openclaw` copy; `jeeves update server`; `jeeves uninstall` (`--dry-run`, legacy TOOLS.md block); no gateway restart. jeeves 0.11.0 adds or differs in:

- **Order:** the plugin config is written (one `openclaw config set --batch-file`) _before_ `openclaw plugins install` (the 3.15.0 docs said after). The plugin still loads without `configRoot`, for an install by hand or a removed config.
- **`pluginKey` sync:** the server's literal `keys._plugin` (in `<configRoot>/jeeves-server/config.json`) wins; with no server key the plugin's key is copied there; with neither, one is generated and written to both; if they differ, install fails before any change unless `--server-plugin-key` is passed. A `${VAR}` server key is never overwritten.
- **Skips** `openclaw plugins install` when the plugin is already installed at the resolved version (unless `--force-reinstall`); a legacy copy is removed only after the install succeeds, and only when its `package.json` names this package.
- **Also** renders the platform content (SOUL.md and AGENTS.md managed blocks), wires skills and runs `patch-openclaw` (skip with `--content-only` or `--skip-patch`); `jeeves update` fills in missing plugin config.

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

The plugin always loads, even before `configRoot` is set: it logs one warning. Tools that only call the server's HTTP API keep working (without `publicUrl` rewriting). Only calls that read `configRoot` (`server_service` with `action: install`) return a `configRoot not configured` error until you set `configRoot` in the plugin config or `JEEVES_CONFIG_ROOT`. The root is read when a tool runs, not at registration.

URLs returned by tools are rewritten to the server's `publicUrl`, read from `{configRoot}/jeeves-server/config.json` (or the `JEEVES_SERVER_PUBLIC_URL` env var).

## Docs

- [OpenClaw Integration](./guides/openclaw-integration.md) — Full configuration, tool reference, architecture
