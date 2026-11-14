---
name: jeeves-server
description: >
  jeeves-server: file browsing, share and insider links, PDF/DOCX export, path resolution, .md edits, event gateway, OAuth tokens, config, diagnostics.
---

# Jeeves Server Skill

Operate and interact with a jeeves-server 3.16 deployment through the plugin's tools: browse, share, export links, edits, events, OAuth tokens, config and diagnostics.

## Tools

| Tool | Purpose |
| --- | --- |
| `server_status` | Version, uptime, Chrome, export formats, auth summary, events, event queue progress |
| `server_config` | Resolved server config (JSONPath filter); admin-only route, sent with the plugin key |
| `server_config_apply` | Apply a config patch (or `replace`); admin-only route, sent with the plugin key |
| `server_service` | Install, uninstall, start, stop, restart or query the system service |
| `server_drives` | Configured roots (Windows drives, Linux `roots`) |
| `server_browse` | Directory listing or file metadata for a browse path |
| `server_link_info` | `pageUrl`, `rawUrl`, `downloadUrl` and export links for a path |
| `server_resolve_path` | Absolute filesystem path → browse path, browse URL and public URL |
| `server_share` | Share link (`expiryDays`, `depth`, `dirs`, or `insiders` for an audience); `rawUrl` for file shares |
| `server_export` | **Download URL** (not bytes) for `pdf`/`docx` (Markdown), `zip`/`tar` (directories), `svg`/`png` (Mermaid, PlantUML). Unkeyed (insider browser session) or `share: { expiryDays? }` for a URL anyone can open |
| `server_export_cache_clear` | Clear cached exports and diagrams of a file or a directory tree |
| `server_file_write` | Overwrite an existing file (insider) |
| `server_file_mutate` | `.md` edits: `edit-block`, `delete-block`, `insert-block`, `edit-cell`, `toggle-checkbox` (insider) |
| `server_auth_status` | Who the server thinks is calling (sent without a key) |
| `server_event_status` | Event schemas and recent event log entries (`limit`, default 20) |
| `oauth_authorize` / `oauth_status` / `oauth_token` | OAuth2 credentials: start authorization, check, get a (refreshed) access token |

No tool returns a URL carrying the plugin key. `server_rotate_key` no longer exists (machine keys can't rotate). URLs are rewritten to the server's `publicUrl` (read from `{configRoot}/jeeves-server/config.json` or `JEEVES_SERVER_PUBLIC_URL`; it is not a plugin setting).

## Paths and routes

Browse paths are `{root}/{path}`: `J:\domains\readme.md` → `j/domains/readme.md` (drop the colon, lowercase the drive, forward slashes).

| Prefix | Serves |
| --- | --- |
| `/browse/<path>` | Web UI: the link to give people |
| `/api/raw/<path>` | File bytes; `?download=1` always downloads, with the file's name |
| `/api/export/<path>?format=…` | PDF/DOCX (Markdown), ZIP/tar (directories, insiders only) |
| `/api/mermaid-export/<path>`, `/api/plantuml-export/<path>` | Diagram exports (formats in link info) |
| `/api/link-info/<path>` | Available links and export formats |
| `/health`, `/status`, `/openapi.json` | No credentials needed |

**Raw and export links from a share link:** content routes verify the key against the path after the prefix, so replacing `/browse/` with `/api/raw/` or `/api/export/` in a share URL, keeping the whole query (`k`, and `exp`, `d`, `dirs`, `s` when present), gives a working link. Add `download=1` beside them to force a download. Links carry the key as `k` (the old `key` still works; `k` wins).

## Access model

- **Insiders** sign in (Google, email magic link) or use an insider/machine key; **outsiders** need a share link. Identities carry scopes (picomatch globs: `/**` for a tree, `/*` for direct children).
- **Navigation** routes (listings, link info, drives) admit an in-scope path or an ancestor of one; **content** routes (file, raw, export, diagram exports) need the path itself in scope; both accept share credentials for that path.
- **Insider** routes (share, share-for, resolve-path, search, OAuth, runner proxy, writes, mutations, cache clear, archives) need an identity; share keys get `403 SERVER_INSIDER_REQUIRED`. Paths they address must be in the caller's scopes.
- **Admin** routes (`/config`, `/config/apply`, `/api/events`) need an identity with **no scopes configured**: an unscoped insider or machine key such as the plugin's `_plugin`. Any scope, even `allow: ['/**']`, gets `403 SERVER_FORBIDDEN`.
- `/status` is public but hides `health.events[].cmd` and `health.chrome.path` from non-admin callers.
- Share links: plain links never expire unless `expiryDays` is given. A plain directory share covers the whole tree; `depth`/`dirs` make a deep share (each followed link or opened directory costs one level). An `outsiderPolicy` can restrict what may be shared outside.

## Errors

Every API error is `{ statusCode, code?, error, message }`. Branch on `code`:

| Code | Status | Meaning |
| --- | --- | --- |
| `SERVER_UNAUTHORIZED` | 401 | No valid credential |
| `SERVER_OUT_OF_SCOPE` / `SERVER_FORBIDDEN` / `SERVER_INSIDER_REQUIRED` | 403 | Outside scopes / scoped caller on an admin route / share key on an insider route |
| `SERVER_NOT_FOUND` | 404 | Nothing there (or a path under no root) |
| `SERVER_INVALID_PATH`, `SERVER_INVALID_REQUEST`, `FST_ERR_VALIDATION` | 400 | Bad path, bad value, field failed the schema |
| `SERVER_NOT_A_FILE` / `SERVER_NOT_A_DIRECTORY` / `SERVER_EXPORT_UNSUPPORTED` | 400 | Wrong kind of path or format |
| `SERVER_EXPORT_FAILED` / `SERVER_WATCHER_UNAVAILABLE` | 502 | Render failed / watcher down (also for watcher-rendered exports) |
| `SERVER_CHROME_UNAVAILABLE` / `SERVER_RUNNER_UNAVAILABLE` | 503 | No Chrome for PDF / runner unreachable |
| `SERVER_CONFLICT` / `SERVER_ARCHIVE_TOO_LARGE` | 409 / 413 | Edit raced another change / directory over `maxZipSizeMb` |
| `SERVER_OAUTH_REFRESH_FAILED` / `SERVER_NOT_CONFIGURED` | 401 / 501 | Re-authorize / OAuth not configured |

Other codes (`SERVER_MACHINE_KEY_NOT_ROTATABLE`, `SERVER_SIGN_IN_REJECTED`, `SERVER_EMAIL_UNAVAILABLE`, `SERVER_INTERNAL_KEY_MISSING`) and every route are in the API Reference and API & Integration guides. A 500 with no `code` is masked; the detail is in the server log.

## Documents and exports

- Markdown is `.md`, `.markdown`, or any file jeeves-watcher renders as Markdown; all render and export (PDF needs Chrome; DOCX too). Title: front-matter `title`, else the file name.
- **`jeeves:` front matter** is the platform's reserved directive namespace and is hidden from displayed front matter. `jeeves: { print: <name> }` picks a print style from server config `printStyles` for the PDF (not DOCX); the response header `X-Print-Style` names it, or `default` for an unknown name (never an error).
- Exports are cached by content, style, server version and referenced images; `server_export_cache_clear` forces a re-render.
- Check formats with `server_link_info` before exporting. When handing documents to people, prefer share links over file uploads, and Markdown over DOCX/PDF unless they need a file.

## Event gateway

`POST /event?k=<key>` with a JSON **object** (anything else is `400 FST_ERR_VALIDATION`). The first configured event whose JSON Schema matches wins; an optional JsonMap transform reshapes it; it is queued in `logs/event-queue.jsonl` and run by up to `eventQueueConcurrency` commands at a time. Delivery is at least once (make commands idempotent); timed-out commands are killed with their process tree. `server_status` shows queue progress in `health.eventQueue` (`offset`, `size`, `pendingBytes`, `parseErrors`, `lastCursorReset`, `lastRewind`); `server_event_status` shows schemas and the log (`queue_parse_error`, `queue_cursor_reset`, `queue_rewound` mark queue incidents; unmatched bodies are kept up to 256 KiB, `truncated` marks cut ones).

## Configuration notes

- Config is `{configRoot}/jeeves-server/config.json` (JSON, `${VAR}` substitution). Insider seeds live there too (no `state.json`). Back up `config.json` and the event queue (`logs/event-queue.jsonl` and its `.cursor`); neither is in the package.
- `keys._internal` is required for PDF/DOCX; `keys._plugin` (unscoped) for the plugin. Admin insiders have no `scopes`.
- `roots` (Linux) maps root ids to paths; `events` maps names to schema + command; `oauth` (`credentialDir`, `providers`) backs the `oauth_*` tools; `go` maps `/go/<slug>` shortlinks; `printStyles` names PDF styles; `exportCachePath` moves the export cache.
- `publicUrl` (or `trustProxyHeaders: true`) is required when email, Google or OAuth login is configured. Mermaid is bundled; PlantUML's jar downloads on install (Java optional).
- CLI: `jeeves-server config` and `config apply` need an admin key: `--key`, `JEEVES_SERVER_KEY`, or `--config` (derives it from `keys._plugin`).

## Setup

Node.js 24.22.2 or later, Chrome/Chromium for PDF, NSSM (Windows) or systemd (Linux), and a reverse proxy (Caddy recommended).

```bash
npm install -g @karmaniverous/jeeves-server
jeeves-server init --config <config-dir>      # starter config
jeeves-server config validate --config <path>
jeeves-server service install --config <path>
jeeves-server service start
npm install -g @karmaniverous/jeeves
jeeves install server --config-root <config-root>   # plugin + its config (apiUrl, pluginKey = keys._plugin)
```

Restart the gateway after installing the plugin. Server and plugin versions go together: server 3.16 with plugin 0.16.

## Troubleshooting

- `configRoot not configured` (only `server_service install` needs it): set `plugins.entries.jeeves-server-openclaw.config.configRoot` or `JEEVES_CONFIG_ROOT`, then restart the gateway.
- `server_config` gets 401/403: the server's `keys._plugin` is missing, differs from the plugin's `pluginKey`, or has scopes.
- Export `502 SERVER_EXPORT_FAILED`: the render page didn't finish (check `keys._internal` and the server log); nothing was cached. `503 SERVER_CHROME_UNAVAILABLE`: fix `chromePath`.
- Server unreachable: `jeeves-server service status`; `apiUrl` (default `http://127.0.0.1:1934`); the proxy's upstream port.
