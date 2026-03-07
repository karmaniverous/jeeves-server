# Deployment

How to run Jeeves Server in production.

> Jeeves Server runs on **Windows** and **Linux**. Both platforms are tested in CI.

## Prerequisites

- **Node.js** ≥ 18
- **Chrome or Chromium** — for PDF/DOCX export via Puppeteer
- **A domain** with HTTPS — required for Google OAuth and secure sharing
- **A reverse proxy** — nginx, Caddy, or similar (recommended)

### Optional Dependencies

- **Java** (JDK 11+) — required for local PlantUML rendering with `!include` support. Without Java, PlantUML falls back to the community server (no `!include` support).
- **PlantUML jar** — download from [plantuml.com/download](https://plantuml.com/download). Configure the path in `jeeves.config.ts` under `plantuml.jarPath`.
- **Mermaid CLI** — for server-side Mermaid diagram rendering. Install with `npm install @mermaid-js/mermaid-cli` and configure `mermaidCliPath` in `jeeves.config.ts`.

## Running the Server

### Direct

```bash
node dist/server.js
```

The server listens on the port configured in `jeeves.config.ts` (default: 1934) on all interfaces (`0.0.0.0`).

### As a Windows Service (NSSM)

[NSSM](https://nssm.cc/) (Non-Sucking Service Manager) turns any executable into a Windows service:

```bash
# Install the service
nssm install JeevesServer "C:\Program Files\nodejs\node.exe" "E:\jeeves-server\dist\server.js"

# Configure working directory
nssm set JeevesServer AppDirectory "E:\jeeves-server"

# Configure stdout/stderr logging
nssm set JeevesServer AppStdout "E:\jeeves-server\logs\service-stdout.log"
nssm set JeevesServer AppStderr "E:\jeeves-server\logs\service-stderr.log"

# Start the service
nssm start JeevesServer
```

**Service management:**
```bash
nssm start JeevesServer
nssm stop JeevesServer
nssm restart JeevesServer
nssm status JeevesServer
nssm remove JeevesServer confirm   # Uninstall
```

### As a systemd Service (Linux)

```ini
# /etc/systemd/system/jeeves-server.service
[Unit]
Description=Jeeves Server
After=network.target

[Service]
Type=simple
User=jeeves
WorkingDirectory=/opt/jeeves-server
ExecStart=/usr/bin/node /opt/jeeves-server/dist/server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable jeeves-server
sudo systemctl start jeeves-server
sudo systemctl status jeeves-server
```

### Linux Quick Start (Ubuntu/Debian)

```bash
# System packages
sudo apt-get update && sudo apt-get install -y curl git build-essential chromium-browser caddy

# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt-get install -y nodejs

# Clone and build
cd /opt
sudo git clone https://github.com/karmaniverous/jeeves-server.git
cd jeeves-server
npm ci
cd client && npm ci && npx vite build --outDir ../dist/client && cd ..
npx tsc

# Configure
cp jeeves.config.template.ts jeeves.config.ts
# Edit jeeves.config.ts — set chromePath, roots, auth, keys, etc.
echo '{}' > state.json
```

**Linux-specific config options:**

```typescript
{
  // Chromium path (required for PDF/DOCX export)
  chromePath: '/usr/bin/chromium-browser',

  // Filesystem roots for the file browser (replaces Windows drive letters)
  roots: {
    home: '/home',
    projects: '/opt/projects',
  },

  // Mermaid CLI path (optional, for .mmd diagram rendering)
  mermaidCliPath: '/opt/mermaid-cli',
}
```

On Windows, `roots` is ignored — the file browser auto-discovers drive letters. On Linux, if `roots` is omitted, it defaults to `{ root: '/' }`.

**Puppeteer config** (for Chromium on Linux):

Create `puppeteer.json` in the server root:
```json
{
  "executablePath": "/usr/bin/chromium-browser",
  "args": ["--no-sandbox", "--disable-setuid-sandbox"]
}
```

## Reverse Proxy

Running behind a reverse proxy is recommended for:
- **HTTPS termination** — required for Google OAuth and secure key transmission
- **Domain routing** — serve on a clean domain/subdomain
- **Rate limiting** and request filtering

### Caddy (simplest)

```
jeeves.example.com {
    reverse_proxy localhost:1934
}
```

Caddy automatically provisions and renews HTTPS certificates via Let's Encrypt.

### nginx

```nginx
server {
    listen 443 ssl http2;
    server_name jeeves.example.com;

    ssl_certificate /etc/letsencrypt/live/jeeves.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/jeeves.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:1934;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Large file uploads (for webhook bodies)
        client_max_body_size 10M;

        # WebSocket support (if needed in future)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

server {
    listen 80;
    server_name jeeves.example.com;
    return 301 https://$host$request_uri;
}
```

## HTTPS

**HTTPS is required** when using Google OAuth — Google will not redirect to an HTTP callback URL (except `localhost` for development).

**HTTPS is strongly recommended** even with key-only auth, because keys appear in URL parameters. Without HTTPS, keys are visible to network observers.

### Options

| Method | Effort | Best For |
|--------|--------|----------|
| **Caddy** | Minimal | Automatic HTTPS, zero config |
| **Let's Encrypt + nginx** | Moderate | Fine-grained control |
| **Cloudflare Tunnel** | Moderate | No port forwarding needed |

## Google OAuth Setup for Production

When using Google OAuth in production:

1. **Add your domain** to the Google Cloud Console OAuth consent screen
2. **Set the redirect URI** to `https://your-domain.com/auth/google/callback`
3. **Update `jeeves.config.ts`** with the production credentials

> **Dev vs Prod:** You can use different Google OAuth client IDs for development and production. Each `jeeves.config.ts` is gitignored and instance-specific.

### Multiple environments

Run dev and prod on the same machine using different ports:

```typescript
// Dev: jeeves.config.ts (port 3457)
port: 3457,
auth: {
  google: {
    clientId: 'dev-client-id.apps.googleusercontent.com',
    clientSecret: 'dev-secret',
  },
},

// Prod: jeeves.config.ts (port 1934)
port: 1934,
auth: {
  google: {
    clientId: 'prod-client-id.apps.googleusercontent.com',
    clientSecret: 'prod-secret',
  },
},
```

Each needs its own Google OAuth redirect URI registered.

## Health Checks

The `/health` endpoint requires no authentication:

```bash
curl http://localhost:1934/health
# Returns 200 OK
```

Use this for:
- Load balancer health checks
- Service monitoring (Uptime Kuma, Prometheus, etc.)
- NSSM/systemd restart triggers

## Updating

```bash
cd /path/to/jeeves-server
git pull

# Full rebuild
npm install
npm run build
cd client && npx vite build --outDir ../dist/client && cd ..

# Restart the service
nssm restart JeevesServer           # Windows
sudo systemctl restart jeeves-server # Linux
```

> ⚠️ Remember: `npm run build` deletes `dist/` entirely. Always rebuild the client after the server.

## File Permissions

The server needs:
- **Read access** to any files you want to serve (drives, directories)
- **Write access** to its own directory for `state.json` and `logs/`
- **Execute access** to Chrome/Chromium for PDF export
- **Execute access** to event handler commands

## Backups

Key files to back up:
- `jeeves.config.ts` — your configuration (secrets!)
- `state.json` — insider keys and rotation state
- `logs/event-queue.jsonl` + `logs/event-queue.cursor` — pending events

The server code itself is in git — no need to back up `dist/` or `node_modules/`.
