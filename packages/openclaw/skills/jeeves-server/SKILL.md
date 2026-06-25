# Jeeves Server Skill

Operate and interact with a jeeves-server deployment. Use for file browsing, document sharing, export, link generation, event gateway queries, and server diagnostics.

## Tools

| Tool | Purpose |
|------|---------|
| `server_status` | Server health: version, uptime, port, Chrome availability, export formats, auth info |
| `server_browse` | Get file/directory metadata and listings for a browse path |
| `server_link_info` | Query available link types for a path (page URL, raw URL, export links) |
| `server_share` | Generate share links with optional expiry and directory depth |
| `server_export` | Trigger export (PDF, DOCX, SVG, PNG, ZIP) and get download URL |
| `server_event_status` | Query event gateway status, active schemas, and recent event log |
| `server_config` | Query resolved server configuration (supports JSONPath) |
| `server_config_apply` | Apply a configuration patch to the running server |
| `server_service` | Manage the system service (install, uninstall, start, stop, restart, status) |
| `server_file_write` | Overwrite file content (insider-only; file must already exist) |
| `server_file_mutate` | Apply structured .md mutations: edit-block, delete-block, insert-block, edit-cell, toggle-checkbox |
| `server_rotate_key` | Rotate the authenticated insider's API key (invalidates all share links) |
| `server_export_cache_clear` | Clear export and diagram caches for a given path |
| `server_drives` | List available root drives/labels configured on the server |
| `server_auth_status` | Check current authentication status |
| `server_resolve_path` | Convert an absolute filesystem path to a server browse path and optional public URL |
| `oauth_authorize` | Initiate OAuth2 authorization for a provider/account |
| `oauth_status` | Check if valid OAuth2 credentials exist for a provider/account |
| `oauth_token` | Retrieve a valid access token (with automatic refresh) |

## Browse Paths

All paths use the jeeves-server browse path format: `{drive}/{path}` (e.g., `j/domains/projects/readme.md`).

To convert a Windows file path to a browse path:
- `J:\domains\projects\readme.md` → `j/domains/projects/readme.md`
- Strip the colon, lowercase the drive letter, use forward slashes

## Public URL Rewriting

When `publicUrl` is configured in the server's own config (`{configRoot}/jeeves-server/config.json`), all URLs returned by server tools are automatically rewritten to use the public domain instead of the internal `apiUrl`. No manual URL rewriting is needed.

## Inline Editing

Insiders can edit rendered Markdown pages via the web UI:
- **Block editing:** Hover controls on rendered blocks (paragraphs, headings, lists, tables, code, diagrams) for edit, copy, insert, and delete
- **Cell editing:** Direct table cell editing
- **Checkbox toggling:** Interactive task-list checkboxes via `POST /api/file/*` with `action: 'toggle-checkbox'` (fire-and-forget, last-write-wins)
- **Full-document editing:** Edit button in the tab bar (visible on both rendered and raw tabs for insiders)

All mutations go through `POST /api/file/*` (unified mutation endpoint). The `server_file_mutate` tool provides agent access to the same mutations.

## Auth Gate

Unauthenticated browser access to SPA routes (`/`, `/browse/*`, `/runner/*`) returns a branded sign-in page instead of the SPA. The sign-in page shows an email login form (when email auth is configured) as the primary action, with a "Sign in with Google" button below (when Google auth is also configured). When only Google auth is active, the Google button is shown alone. When only key auth is active, an API key required message is displayed. The page reflects instance branding (name, emoji) when configured. After sign-in, the user is redirected back to the originally requested page. API routes continue returning JSON 401 for programmatic clients.

## Browse Features

- **Directory item counts:** Subdirectory rows display a nonrecursive item count in the Size column.
- **CSV table rendering:** `.csv` files render as HTML tables (Rendered tab) with raw source in the Raw tab.
- **Collapsible frontmatter:** YAML frontmatter blocks exceeding 10 lines are collapsed by default with a "Show all" toggle.
- **Collapsible TOC:** The table of contents sidebar uses a tree structure with expand/collapse chevrons on headings that have children. Active headings auto-expand their ancestor chain.

## Sharing

- **Insiders** authenticate via Google OAuth, email magic link, or key-based auth — bare URLs work for them
- **Outsiders** need HMAC share links — use `server_share` to generate them
- Share links have configurable expiry (default 30 days)
- Directory shares support depth control for recursive access
- An `outsiderPolicy` can constrain which paths are eligible for outsider sharing

## Export

Available formats depend on file type and server capabilities:
- **Markdown files:** PDF (requires Chrome), DOCX
- **CSV files:** rendered as HTML tables (no additional export formats)
- **Mermaid diagrams:** SVG, PNG, PDF (Mermaid CLI is bundled)
- **PlantUML diagrams:** Formats depend on server configuration (jar downloaded automatically via postinstall)
- **Directories:** ZIP (insider-only)

Use `server_link_info` first to check which formats are available for a path.

## Diagnostics

Run `server_status` to check:
- Server version and uptime
- Chrome availability (required for PDF export)
- Available export formats and diagram languages
- Auth configuration (insider count, key count)
- Event gateway schemas

Service health for companion services (watcher, runner, meta) is mediated through the server's `/status` endpoint. The plugin queries the server only — never watcher or runner directly.

## Bootstrap: Full Stack Setup

### Prerequisites

- **Node.js 22+** and npm
- **Java 8+** (optional, for local PlantUML rendering — jar downloaded automatically)
- **Chrome/Chromium** (required for PDF export)
- **NSSM** (Windows) or **systemd** (Linux) for service management
- **Caddy** (recommended) or nginx for reverse proxy with automatic TLS

### 1. Install jeeves-server

```bash
npm install -g @karmaniverous/jeeves-server
```

### 2. Create config

Generate a starter config:

```bash
jeeves-server init --config /path/to/config-dir
```

Or create `jeeves-server/config.json` manually (JSON only):

```json
{
  "port": 1934,
  "chromePath": "/usr/bin/chromium-browser",
  "auth": {
    "modes": ["keys", "google"],
    "google": {
      "clientId": "${GOOGLE_CLIENT_ID}",
      "clientSecret": "${GOOGLE_CLIENT_SECRET}"
    },
    "sessionSecret": "${SESSION_SECRET}"
  },
  "scopes": {
    "public-docs": {
      "allow": ["/d/docs/*"]
    }
  },
  "insiders": {
    "you@example.com": {},
    "contractor@example.com": { "scopes": "public-docs" }
  },
  "keys": {
    "_internal": "random-hex-seed-for-puppeteer",
    "_plugin": "random-hex-seed-for-openclaw-plugin",
    "primary": "random-hex-seed-for-api-access"
  },
  "logging": {
    "level": "info"
  }
}
```

**Key fields:**
- `chromePath` — **required**, path to Chrome/Chromium executable
- `auth.modes` — **required**, array of `"keys"`, `"google"`, and/or `"email"`
- `scopes` — named scope definitions (allow/deny), referenced by name from insiders and keys
- `insiders` — map of email → `{ scopes?, allow?, deny? }`
- `keys._internal` — required for PDF/DOCX export (Puppeteer auth)
- `keys._plugin` — required for OpenClaw plugin auth
- `outsiderPolicy` — optional global constraints on outsider sharing

**Companion service URLs** (watcher, runner, meta) are resolved via core config at `{configRoot}/jeeves-core/config.json` under `services.{name}.url`. Port defaults are: watcher 1936, runner 1937, meta 1938. The deprecated `watcherUrl`, `runnerUrl`, `metaUrl`, and `host` config properties are ignored with a deprecation warning.

Environment variable substitution is supported: `${VAR_NAME}` in string values.

Generate key seeds with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Validate config

```bash
jeeves-server config validate [--config <path>]
jeeves-server config [jsonpath] [--config <path>]
```

### 4. Register as system service

Service commands execute directly (no more printing instructions):

**Windows (NSSM):**
```bash
jeeves-server service install [--config <path>]
jeeves-server service start
```

**Linux (systemd):**
```bash
jeeves-server service install [--config <path>]
jeeves-server service start
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

Restart the gateway to load the plugin.

## Troubleshooting

If the server is unreachable:
1. Is the service running? → `jeeves-server service status`
2. Is the apiUrl correct? → Default: `http://127.0.0.1:1934`
3. Is the `_plugin` key configured in both server config and plugin config?
4. Is Caddy proxying to the correct port? → Check `Caddyfile`
5. Is the firewall allowing traffic on port 1934? → Only needed for local access; Caddy handles external traffic
