# Jeeves Server 🎩

**Turn AI-authored documents into business-ready deliverables.**

## The Problem

You're working with an AI assistant. Together, you're producing real work — design documents, technical specs, integration plans, meeting summaries. The output is Markdown, because that's the native authoring format for AI: structured, version-controllable, rich with embedded code and diagrams.

Now share that work with your colleagues.

You can't send them a `.md` file. You can't ask them to install a Markdown viewer. You need something they can read in a browser, download as a PDF, or open in Word — today, without friction.

## The Solution

Jeeves Server gives you a secure, polished window into the machine where your AI assistant lives. It turns the raw output of AI collaboration into something your team can actually use:

- **Browse and view** any file on the server — Markdown renders beautifully with table of contents, syntax-highlighted code, and Mermaid diagrams
- **Share securely** — generate expiring links for external recipients, no login required
- **Export instantly** — one-click PDF and DOCX downloads, perfectly rendered
- **Stay in control** — Google OAuth for your team, scoped API keys for integrations, all zero-trust

You don't author documents here. That's what your AI assistant is for. Jeeves Server is the publishing layer — the bridge between the laboratory and the boardroom.

## Event Gateway

Jeeves Server also includes a **webhook gateway** — a durable, schema-validated event processing pipeline. External services (Notion, GitHub, CI/CD systems, anything that sends webhooks) can POST to your server, and Jeeves will:

- **Validate** the payload against JSON Schema rules
- **Transform** the body using JsonMap (extract just the fields you need)
- **Queue** matched events in a durable JSONL queue that survives restarts
- **Dispatch** to shell commands with the transformed payload on stdin

This makes Jeeves Server a natural integration hub for the same AI-assisted workflow: your assistant writes automation scripts, Jeeves Server receives the triggers, and the scripts execute on the same machine where everything else lives. No Lambda functions, no cloud queues — just a webhook URL and a command.

See the [Event Gateway guide](guides/event-gateway.md) for setup and configuration.

## Why Markdown?

Markdown is **the** native document format for AI collaboration:

- AI assistants read and write it natively — no format translation, no lossy conversion
- It supports everything business documents need: headings, tables, code blocks, diagrams, links
- It's plain text — version-controllable, diffable, mergeable
- It's the format your assistant already thinks in

The gap has always been the last mile: getting Markdown into the hands of people who don't know what Markdown is. Jeeves Server closes that gap.

## Features

- **File Browser** — Navigate drives and directories through a modern React UI
- **Markdown Rendering** — Prose with TOC sidebar, adjustable reading width, dark/light themes
- **PDF & DOCX Export** — One-click, perfectly rendered, business-ready
- **Code Highlighting** — Syntax highlighting with copy buttons
- **SVG, Mermaid & PlantUML Diagrams** — Rendered inline with pan/zoom; PlantUML uses a fallback pipeline (local jar → private servers → community server)
- **Embedded Diagrams in Markdown** — `mermaid` and `plantuml` fenced code blocks render as inline SVGs (GitHub convention)
- **Local Developer Mode** — `localMode` for personal use: no login on localhost, "Open locally" button for native file handlers, clean UI without sharing controls
- **Secure Sharing** — Expiring links with HMAC signatures, scoped access
- **Event Gateway** — Webhook receiver with JSON Schema validation and durable queue
- **Zero CDN** — All assets served locally, no external dependencies

## Guides

- [Setup & Configuration](guides/setup.md) — Installation, auth modes (Google OAuth & key-based), config structure, and getting running
- [Insiders, Outsiders & Sharing](guides/sharing.md) — The access model, how share links work, key derivation, expiry, and rotation
- [Exporting & Downloads](guides/exports.md) — PDF, DOCX, and ZIP export, Puppeteer setup, troubleshooting, and what affects rendered output
- [Event Gateway](guides/event-gateway.md) — Webhook receiving, JSON Schema matching, body mapping, durable queue processing, and monitoring
- [Deployment](guides/deployment.md) — Running as a service (Windows & Linux), reverse proxy setup, HTTPS, Google OAuth for production, and updates
- [API & Integration](guides/api-integration.md) — Programmatic access, endpoint reference, Windows path conversion, generating share links, and notes for AI assistants

## Live Demo

The 📖 button in the header is itself a live external share link — it points to this very README—in the working directory on a live production Jeeves Server—with `depth=2` (so you can follow links to the guides) and `dirs=false` (no directory browsing). If you're reading this in Jeeves Server, you're seeing the deep share feature in action. If you're reading this on GitHub, click [here](https://jeeves.johngalt.id/browse/e/jeeves-server/README.md?key=58f33049a73af8c3e694afa45eca426c&d=2&dirs=0&s=NoIg9ApmBWEQbhAzgWiRATojYBKBRAQQBEBZfAOgFsATEAXSA) to see for yourself.

## Platform Support

Jeeves Server runs on **Windows** and **Linux**.

- **Windows:** File browser auto-discovers drive letters (A-Z). Chrome path defaults to Program Files.
- **Linux:** File browser uses configurable `roots` in `jeeves.config.ts` (e.g. `{ home: '/home', projects: '/opt/projects' }`). Chromium path is typically `/usr/bin/chromium-browser`.

Both platforms are tested in CI (GitHub Actions on Ubuntu, Node 20 + 22).

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

Full requirements and architecture: [`.stan/system/stan.requirements.md`](.stan/system/stan.requirements.md)

## License

MIT
