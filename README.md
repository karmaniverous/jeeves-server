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
- **SVG & Mermaid Diagrams** — Rendered inline with pan/zoom
- **Secure Sharing** — Expiring links with HMAC signatures, scoped access
- **Event Gateway** — Webhook receiver with JSON Schema validation and durable queue
- **Zero CDN** — All assets served locally, no external dependencies

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
