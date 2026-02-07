# Jeeves Server

Express server for Jeeves providing:
- **Webhook receiver** — single endpoint that derives source from request headers/body
- **File server** — serves files with markdown rendering to HTML
- **Path-specific authentication** — each path gets a unique key, only one secret stored

## Setup

```bash
# Clone
git clone https://github.com/karmaniverous/jeeves-server.git
cd jeeves-server

# Configure
cp .env.local.template .env.local
# Edit .env.local and set API_KEY

# Install & run
npm install
npm start
```

## Authentication

**Path-specific keys:** Each endpoint requires a unique key computed as `HMAC-SHA256(apiKey, normalizedPath)`.

Benefits:
- Only one API key stored in config
- Each path gets a unique access key
- If one key is leaked, other paths remain protected

**Computing keys:**
```bash
# Use the /key endpoint (requires raw API key in X-API-Key header)
curl -H "X-API-Key: <api-key>" "http://localhost:3456/key?path=/webhook"
curl -H "X-API-Key: <api-key>" "http://localhost:3456/key?path=/d/projects/foo.md"
```

**Using keys:**
```bash
# Webhook
curl -X POST "http://localhost:3456/webhook?key=<computed-key>" -d '{...}'

# File
curl "http://localhost:3456/path/d/projects/foo.md?key=<computed-key>"
```

## Endpoints

| Method | Path       | Auth                | Description                          |
|--------|------------|---------------------|--------------------------------------|
| POST   | /webhook   | Path-key (`?key=`)  | Receive webhooks                     |
| GET    | /path/*    | Path-key (`?key=`)  | Serve files (md rendered as HTML)    |
| GET    | /key       | X-API-Key header    | Compute path-key for a given path    |
| GET    | /health    | None                | Health check                         |

## Markdown Rendering

When serving `.md` files:
- Rendered as styled HTML
- Local links (`href`, `src`) rewritten to `/path/...?key=<computed-key>`
- Navigation between related files works seamlessly

## Source Detection (Webhooks)

| Source  | Detection Method                           |
|---------|-------------------------------------------|
| Notion  | `X-Notion-Signature` header               |
| GitHub  | `X-GitHub-Event` header                   |
| Slack   | `body.type` + `body.team_id/api_app_id`   |
| Stripe  | `body.type` + `body.data.object`          |
| Custom  | `X-Webhook-Source` header or `body._source` |

## Running as Windows Service

For production:
```bash
# Clone to E:\
cd E:\
git clone https://github.com/karmaniverous/jeeves-server.git
cd jeeves-server
cp .env.local.template .env.local
# Set API_KEY in .env.local
npm install

# Install as service (using NSSM)
nssm install JeevesServer "node" "E:\jeeves-server\server.js"
nssm start JeevesServer
```

## Development

```bash
# Watch mode (auto-restart on changes)
npm run dev
```

## License

MIT
