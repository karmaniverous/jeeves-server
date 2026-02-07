# Jeeves Server

A lightweight file browser and document viewer with secure, shareable links.

## Why Markdown?

**Markdown is the ideal format for authoring documents**, especially when working with AI assistants. It's simple, readable, version-controllable, and diff-friendly.

But in the business world, you can't share `.md` files — people expect PDFs and Word documents.

**Jeeves Server bridges this gap.** Author your documents in Markdown, review them beautifully rendered in the browser, then export to PDF or DOCX with one click when it's time to share with colleagues, clients, or stakeholders.

## Features

- **File Browser** — Navigate your filesystem through a web interface
- **Markdown Rendering** — `.md` files render as styled HTML with table of contents
- **PDF & DOCX Export** — One-click export for business-ready documents
- **Code Highlighting** — Source files display with syntax highlighting
- **Dark/Light Themes** — Toggle between themes; preference is saved
- **Secure Sharing** — Generate expiring links for external recipients
- **Path-specific Authentication** — Each path gets a unique key, only one secret stored

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

Jeeves uses **path-specific keys** for authentication. There are two access modes:

### Insider Access

Insider links use a single master key that works for any path. With insider access you can:

- Navigate freely between directories and files
- Generate shareable links for others
- Rotate the API key (invalidates all existing links)

### Outsider Access

Outsider links are path-specific and can optionally expire. With outsider access you can:

- View the specific file or directory shared with you
- Download raw files
- Share the same link with others

Outsiders cannot navigate to parent directories or other paths.

### Computing Keys

```bash
# Use the /key endpoint (requires raw API key in X-API-Key header)
curl -H "X-API-Key: <api-key>" "http://localhost:3456/key?path=/d/projects/foo.md"

# Use the /insider-key endpoint
curl -H "X-API-Key: <api-key>" "http://localhost:3456/insider-key"
```

## Endpoints

| Method | Path         | Auth                | Description                          |
|--------|--------------|---------------------|--------------------------------------|
| GET    | /path/*      | Path-key (`?key=`)  | Serve files (md rendered as HTML)    |
| GET    | /about       | None (or key)       | About page with usage instructions   |
| POST   | /webhook     | Path-key (`?key=`)  | Receive webhooks                     |
| GET    | /key         | X-API-Key header    | Compute path-key for a given path    |
| GET    | /insider-key | X-API-Key header    | Get the insider key                  |
| POST   | /rotate-key  | Insider key (body)  | Rotate the API key                   |
| GET    | /health      | None                | Health check                         |

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
