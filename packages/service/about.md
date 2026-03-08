# Jeeves Server

A self-hosted file browser, document viewer, and webhook gateway with secure sharing and one-click PDF/DOCX export.

## Why Markdown?

**Markdown is the ideal format for authoring documents**, especially when working with AI assistants. It's simple, readable, version-controllable, and diff-friendly.

But in the business world, you can't share `.md` files — people expect PDFs and Word documents.

**Jeeves Server bridges this gap.** Author your documents in Markdown, review them beautifully rendered in the browser, then export to PDF or DOCX with one click when it's time to share.

## Features

- **File Browser** — Navigate your filesystem through a modern web interface
- **Markdown Rendering** — `.md` files render as styled HTML with table of contents
- **PDF & DOCX Export** — One-click export for business-ready documents
- **Code Highlighting** — Source files display with syntax highlighting
- **Mermaid & PlantUML Diagrams** — Rendered inline with pan/zoom
- **Dark/Light Themes** — Toggle between themes; preference is saved
- **Secure Sharing** — Generate expiring links for external recipients
- **Semantic Search** — Full-text search across indexed documents (via jeeves-watcher integration)

## Authentication

Jeeves uses two access modes:

### Insider Access

Insider links use a derived key that works within configured scopes. With insider access you can:

- Navigate freely between directories and files (within scopes)
- Generate shareable links for others
- Rotate your API key (invalidates all existing links)
- Search across indexed documents

### Outsider Access

Outsider links are path-specific and can optionally expire. With outsider access you can:

- View the specific file or directory shared with you
- Download raw files and exports

## Header Controls

| Button | Description |
|--------|-------------|
| 🎩 | Home — return to drive list (insider only) |
| ? | About — this page |
| 🔑 | Rotate API Key — generates a new key, invalidating all existing links |
| ⬇ | Download/Export — raw file, PDF, DOCX, or ZIP |
| 🔗 | Share — copy insider or outsider link with optional expiry |
| 🔎 | Search — semantic search across indexed documents |
| 🌙/☀️ | Toggle dark/light theme |

---

*Jeeves Server — [GitHub](https://github.com/karmaniverous/jeeves-server)*
