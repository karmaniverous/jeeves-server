# Jeeves Server Skill

Operate and interact with a jeeves-server deployment. Use for file browsing, document sharing, export, link generation, event gateway queries, and server diagnostics.

## Tools

| Tool | Purpose |
|------|---------|
| `server_status` | Server health: version, uptime, Chrome availability, export formats, connected services |
| `server_browse` | Get file/directory metadata and listings for a browse path |
| `server_link_info` | Query available link types for a path (page URL, raw URL, export links) |
| `server_share` | Generate share links with optional expiry and directory depth |
| `server_export` | Trigger export (PDF, DOCX, SVG, PNG, ZIP) and get download URL |
| `server_event_status` | Query event gateway status, active schemas, and recent event log |

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

## Bootstrap: Full Stack Setup

### Prerequisites

- **Node.js 20+** and npm
- **Java 8+** (optional, for local PlantUML rendering)
- **Chrome/Chromium** (optional, for PDF export)
- **NSSM** (Windows) or **systemd** (Linux) for service management
- **Caddy** (recommended) or nginx for reverse proxy with automatic TLS

### 1. Install jeeves-server

```bash
npm install -g @karmaniverous/jeeves-server
```

### 2. Create config

Create `jeeves-server.config.json` in the server's working directory:

```json
{
  "port": 1934,
  "roots": {
    "data": "/path/to/data"
  },
  "keys": {
    "_internal": "random-hex-seed-for-puppeteer",
    "_plugin": "random-hex-seed-for-openclaw-plugin"
  },
  "insiders": [
    { "email": "you@example.com" }
  ],
  "google": {
    "clientId": "${GOOGLE_CLIENT_ID}",
    "clientSecret": "${GOOGLE_CLIENT_SECRET}"
  },
  "sessionSecret": "${SESSION_SECRET}",
  "watcherUrl": "http://127.0.0.1:1936"
}
```

### 3. Validate config

```bash
jeeves-server config validate
jeeves-server config show
```

### 4. Register as system service

**Windows (NSSM):**
```bash
jeeves-server service install
jeeves-server service start
```

**Linux (systemd):**
```bash
sudo jeeves-server service install
sudo jeeves-server service start
```

### 5. Configure Caddy reverse proxy

Add to your Caddyfile:

```
your-domain.com {
    reverse_proxy localhost:1934
}
```

Caddy handles TLS certificate provisioning automatically. Ensure DNS A/AAAA records point to your server.

### 6. Install OpenClaw plugin

```bash
npx @karmaniverous/jeeves-server-openclaw install
```

Configure the plugin in `openclaw.json` with `apiUrl` and `pluginKey` (matching the `_plugin` key seed from server config). 

**Important:** Add `"jeeves-server-openclaw"` to the `tools.allow` array in `openclaw.json` so the agent can use the plugin's tools.

Restart the gateway to load the plugin.

## Troubleshooting

If the server is unreachable:
1. Is the service running? → `jeeves-server service start`
2. Is the apiUrl correct? → Default: `http://127.0.0.1:1934`
3. Is the `_plugin` key configured in both server config and plugin config?
4. Is Caddy proxying to the correct port? → Check `Caddyfile`
5. Is the firewall allowing traffic on port 1934? → Only needed for local access; Caddy handles external traffic
