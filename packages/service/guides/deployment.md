---
title: "Deployment"
---

# Deployment

How to run Jeeves Server in production.

## Prerequisites

- **Node.js** ≥ 22
- **Chrome or Chromium** — for PDF/DOCX export via Puppeteer
- **A domain** with HTTPS — required for Google OAuth and secure sharing
- **A reverse proxy** — Caddy, nginx, or similar (recommended)

### Bundled Dependencies

- **Mermaid CLI** — bundled as a direct dependency (`@mermaid-js/mermaid-cli`). No separate install needed.
- **PlantUML jar** — downloaded automatically during `npm install` (via `postinstall` script). Requires Java (JDK 11+) at runtime for local rendering.

## Installation

```bash
npm install -g @karmaniverous/jeeves-server
```

Create your config file (see [Setup & Configuration](setup.md)):

```bash
# Example: JSON config (new path convention)
mkdir -p /etc/jeeves-server
cat > /etc/jeeves-server/config.json << 'EOF'
{
  "chromePath": "/usr/bin/chromium-browser",
  "auth": { "modes": ["keys"] },
  "keys": {
    "_internal": "your-random-hex-seed",
    "primary": "another-random-hex-seed"
  }
}
EOF
```

## Running the Server

### Direct

```bash
jeeves-server start --config /path/to/jeeves-server.config.json
```

The server listens on the configured port (default: 1934) on all interfaces.

### As a Windows Service (NSSM)

The CLI installs and manages the NSSM service directly:

```bash
jeeves-server service install --config "C:\\config\\jeeves-server\\config.json"
jeeves-server service start
jeeves-server service stop
jeeves-server service restart
jeeves-server service status
```

Or use NSSM directly:

```bash
nssm install JeevesServer "C:\\Program Files\\nodejs\\node.exe" "<global-npm-path>\\@karmaniverous\\jeeves-server\\dist\\src\\cli\\index.js" start --config "C:\\config\\jeeves-server.config.json"
nssm set JeevesServer AppDirectory "<working-dir>"
nssm set JeevesServer AppStdout "<log-dir>\\service.log"
nssm set JeevesServer AppStderr "<log-dir>\\service-error.log"
nssm set JeevesServer Start SERVICE_AUTO_START
nssm start JeevesServer
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
ExecStart=/usr/bin/env jeeves-server start --config /etc/jeeves-server/config.json
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable jeeves-server
sudo systemctl start jeeves-server
```

## Reverse Proxy

Running behind a reverse proxy is recommended for HTTPS termination, domain routing, and rate limiting.

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
        client_max_body_size 10M;
    }
}

server {
    listen 80;
    server_name jeeves.example.com;
    return 301 https://$host$request_uri;
}
```

## HTTPS

**HTTPS is required** when using Google OAuth — Google will not redirect to an HTTP callback URL (except `localhost`).

**HTTPS is strongly recommended** even with key-only auth, because keys appear in URL parameters.

## Health Checks

```bash
# No auth required
curl http://localhost:1934/health

# Detailed server status (no auth required)
curl http://localhost:1934/api/status
```

The `/api/status` endpoint returns version, uptime, connected services, export capabilities, and event schemas. Add `?events=N` to include the N most recent event log entries. Use `/health` for simple load balancer checks and `/api/status` for monitoring dashboards.

## Updating

```bash
# Update the global package
npm install -g @karmaniverous/jeeves-server@latest

# Restart the service
jeeves-server service restart    # or: nssm restart JeevesServer / systemctl restart jeeves-server
```

## File Permissions

The server needs:
- **Read access** to any files you want to serve
- **Write access** to its working directory for `state.json` and logs
- **Execute access** to Chrome/Chromium for PDF export
- **Execute access** to event handler commands

## Backups

Key files to back up:
- Your config file (`jeeves-server.config.json`) — contains secrets
- `state.json` — insider keys and rotation state
- Event queue files — `logs/event-queue.jsonl` + `logs/event-queue.cursor`
