# Jeeves Server Skill

Operate and interact with a jeeves-server deployment. Use for file browsing, document sharing, export, link generation, and server diagnostics.

## Tools

| Tool | Purpose |
|------|---------|
| `server_status` | Server health: version, uptime, Chrome availability, export formats, connected services |
| `server_browse` | Get file/directory metadata and listings for a browse path |
| `server_link_info` | Query available link types for a path (page URL, raw URL, export links) |
| `server_share` | Generate share links with optional expiry and directory depth |
| `server_export` | Trigger export (PDF, DOCX, SVG, PNG, ZIP) and get download URL |

## Browse Paths

All paths use the jeeves-server browse path format: `{drive}/{path}` (e.g., `j/domains/projects/readme.md`).

To convert a Windows file path to a browse path:
- `J:\domains\projects\readme.md` → `j/domains/projects/readme.md`
- Strip the colon, lowercase the drive letter, use forward slashes

## Sharing

- **Insiders** authenticate via Google OAuth — bare URLs work for them
- **Outsiders** need HMAC share links — use `server_share` to generate them
- Share links have configurable expiry (default 30 days)
- Directory shares support depth control for recursive access

## Export

Available formats depend on file type and server capabilities:
- **Markdown files:** PDF (requires Chrome), DOCX
- **Mermaid diagrams:** SVG, PNG, PDF
- **PlantUML diagrams:** Formats depend on server configuration
- **Directories:** ZIP (insider-only)

Use `server_link_info` first to check which formats are available for a path.

## Diagnostics

Run `server_status` to check:
- Server version and uptime
- Chrome availability (required for PDF export)
- Connected services (watcher, runner) and their reachability
- Available export formats and diagram languages

## Bootstrap

If the server is unreachable, check:
1. Is the JeevesServer service running? → `jeeves-server service start`
2. Is the apiUrl correct in OpenClaw plugin config? → Default: `http://127.0.0.1:1934`
3. Is the `_plugin` key configured in both server config and plugin config?

## Installation

```bash
npx @karmaniverous/jeeves-server-openclaw install
```

This copies the plugin to `~/.openclaw/extensions/` and patches `openclaw.json`. Restart the gateway after installing.
