# Jeeves Server 🎩

A lightweight file browser, document viewer, and event gateway with secure, shareable links.

## Why Markdown?

**Markdown is the ideal format for authoring documents**, especially when working with AI assistants. It's simple, readable, version-controllable, and diff-friendly.

But in the business world, you can't share `.md` files — people expect PDFs and Word documents.

**Jeeves Server bridges this gap.** Author your documents in Markdown, review them beautifully rendered in the browser, then export to PDF or DOCX with one click when it's time to share with colleagues, clients, or stakeholders.

## Features

- **File Browser** — Navigate drives and directories through a modern React UI
- **Markdown Rendering** — Beautiful prose with TOC sidebar, dark/light themes, and adjustable reading width
- **PDF & DOCX Export** — One-click export for business-ready documents
- **Code Highlighting** — Syntax highlighting for source files with copy buttons
- **SVG & Mermaid** — Render diagrams with pan/zoom support
- **Secure Sharing** — Generate expiring links for external recipients
- **Event Gateway** — Receive webhooks, validate with JSON Schema, and dispatch commands
- **Zero CDN** — All assets served locally

## Quick Start

```bash
git clone https://github.com/karmaniverous/jeeves-server.git
cd jeeves-server
npm install
cp jeeves.config.template.ts jeeves.config.ts  # Configure
npm run build
cd client && npx vite build --outDir ../dist/client && cd ..
node dist/server.js
```

## Documentation

Full requirements and architecture documentation lives in [`.stan/system/stan.requirements.md`](.stan/system/stan.requirements.md).

## License

MIT
