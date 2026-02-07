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

## Header Controls

| Button | Description |
|--------|-------------|
| 🎩 | Home — return to drive list (insider only) |
| ? | About — this page |
| 🔑 | Rotate API Key — generates a new master key, invalidating all existing links |
| ⬇ Raw | Download the raw file |
| 📄 PDF | Export markdown as PDF |
| 📝 DOCX | Export markdown as Word document |
| Inside | Copy insider link to clipboard |
| Outside | Generate outsider link (optionally with expiry) |
| 🌙/☀️ | Toggle dark/light theme |

## Sharing Links

### Insider Links

Click **Inside** to copy the current page URL with insider access. Anyone with this link can navigate freely.

### Outsider Links

1. Enter an expiry in the input field (e.g., `15m`, `1h`, `7d`) or leave blank for no expiry
2. Click **Outside** to generate and copy a path-specific link
3. Share the link — recipients can only view this specific path

## Key Rotation

Click the 🔑 button to rotate the API key. This will:

- Generate a new random API key
- Invalidate **all** existing insider and outsider links
- Redirect you to the same page with the new insider key

The time since last rotation is shown next to the key button.

---

*Jeeves Server — [GitHub](https://github.com/karmaniverous/jeeves-server)*
