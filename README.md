# Jeeves Server

A lightweight file browser, document viewer, and event gateway with secure, shareable links.

## Why Markdown?

**Markdown is the ideal format for authoring documents**, especially when working with AI assistants. It's simple, readable, version-controllable, and diff-friendly.

But in the business world, you can't share `.md` files — people expect PDFs and Word documents.

**Jeeves Server bridges this gap.** Author your documents in Markdown, review them beautifully rendered in the browser, then export to PDF or DOCX with one click when it's time to share with colleagues, clients, or stakeholders.

## Features

### File Browsing & Viewing

- **Drive browser** — List available drives, navigate directories
- **Markdown rendering** — `.md` files render as styled HTML with table of contents sidebar
- **Code highlighting** — Source files display with syntax highlighting (highlight.js)
- **SVG rendering** — SVG files render as images with pan/zoom support (Panzoom)
- **Mermaid diagrams** — `.mmd` files render as diagrams
- **Image viewing** — Direct display of image files
- **Breadcrumb navigation** — Full path breadcrumbs with clickable segments

### Export & Download

- **PDF export** — One-click export via Puppeteer (uses installed Chrome)
- **DOCX export** — Word document generation via `@turbodocx/html-to-docx`
- **ZIP directories** — Download entire directories as ZIP (configurable size limit via `maxZipSizeMb`)
- **Raw file download** — Direct file download option
- **Export UX** — Spinner → check icon transition, no layout shift

### Rendered Markdown Controls

- **Prose width toggle** — Three-width selector (narrow/medium/wide) for rendered markdown:
  - **Narrow**: `max-w-prose` (65ch) — optimal reading width
  - **Medium**: `max-w-5xl` (64rem) — balanced width (default)
  - **Wide**: `max-w-none` — full container width
  - Persisted to `localStorage`, hidden on mobile, display-only (no effect on exports)
  - Icons: `Minimize2` / `Minus` / `Maximize2` (Lucide), shown only when Rendered tab is active on `md+` screens
- **Rendered/Raw tabs** — Toggle between rendered and raw source views
- **Table of contents** — Sidebar TOC on desktop, floating overlay on mobile

### Theming

- **Dark/light mode** — Toggle between themes; preference saved to `localStorage`
- **Theme class on `<html>`** — Required for Radix portal components

### Authentication & Authorization

- **Dual auth system** — `authModes: ('google' | 'keys')[]` configured in `jeeves.config.ts`
  - **Google OAuth** — For insider users (email-based identity)
  - **Key-based auth** — `?key=<value>` URL parameter for headless/bot access
- **Insiders** — Google-authenticated users with optional path scopes
- **Outsiders** — HMAC-derived share links with optional expiry
- **Named keys** — Multiple keys with optional path restrictions (`scopes`)
- **`_internal` reserved key** — Unscoped machine key for Puppeteer export auth (must not have scopes, enforced by Zod)
- **SPA key auth** — Client extracts `?key=` once, appends to all API calls via `withKey()` helper

### Sharing

- **Share link generation** — Expiring outsider links with HMAC signatures
- **Expiry control** — Configurable expiration (or "never")
- **Dropdown menus** — `DownloadDropdown` and `LinkDropdown` components with `variant` prop (`'header'` | `'default'`)
  - Header variant: always-dark styling
  - Default variant: theme-aware for table rows

### Event Gateway

- **Webhook endpoint** — `POST /event?key=<key>` receives external webhooks
- **Schema matching** — Validates against configured JSON Schemas (ajv); first match wins
- **Body mapping** — Optional `@karmaniverous/jsonmap` transformation before dispatch
- **Durable queue** — JSONL-based queue with cursor tracking (survives restarts)
- **Single-threaded processing** — Sequential event draining with configurable timeouts
- **Event logging** — All events (matched/unmatched) logged with automatic purging

## Architecture

### Tech Stack

- **Server**: Fastify (TypeScript)
- **Client**: React SPA with React Router, shadcn/ui components, Radix primitives
- **Styling**: Tailwind CSS v4 with `@theme inline` + CSS variable indirection
- **Icons**: Lucide (served locally via `/static/lucide.min.js` — zero CDN dependencies)
- **Build**: `tsc` (server) + Vite (client)

### Configuration

**Schema-first design** using Zod 4. The schema at `src/config/schema.ts` is the single source of truth; all types are derived via `z.infer<>`.

#### `jeeves.config.ts` (gitignored, immutable at runtime)

TypeScript configuration file loaded at startup via `jiti`. Copy from `jeeves.config.template.ts`.

```typescript
import type { JeevesConfig } from './src/config/schema.js';

const config: JeevesConfig = {
  port: 3456,
  chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  auth: {
    modes: ['google', 'keys'],
    google: {
      clientId: '...',
      clientSecret: '...',
    },
    sessionSecret: '...',
  },
  insiders: {
    'user@example.com': {},           // No scope restrictions
    'limited@example.com': { scopes: ['/d/docs/**'] },
  },
  keys: {
    _internal: 'some-seed-string',    // Reserved: unscoped, for Puppeteer
    'webhook-notion': {
      key: 'webhook-key-seed',
      scopes: ['/event'],
    },
  },
  events: {
    'notion-page-update': {
      schema: { type: 'object', properties: { type: { const: 'page.content_updated' } }, required: ['type'] },
      cmd: 'node dispatcher.js',
      map: { pageId: { '$': { method: '$.lib._.get', params: ['$.input', 'data.page_id'] } } },
      timeoutMs: 60000,
    },
  },
  maxZipSizeMb: 100,
};

export default config;
```

#### `state.json` (mutable runtime state)

Separate from config. Stores insider keys and rotation timestamps. Written by the server at runtime.

```json
{
  "keyRotatedAt": "2026-02-15T...",
  "insiderKeys": {
    "user@example.com": {
      "seed": "auto-generated-seed",
      "createdAt": "2026-02-15T..."
    }
  }
}
```

**Key principle**: Config is immutable at runtime; state is mutable. TS config cannot be mutated programmatically — machine key rotation returns 501.

### Client Architecture

React SPA served at `/browse/*` with the following pages:

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Redirects to `/browse` | |
| `/browse` | `FileBrowser` | Drive listing |
| `/browse/:path` | `FileBrowser` | Directory listing or file view |
| `/browse/about` | `About` | About page |

**Layout pattern**: Each page manages its own fixed top bar container with `topBarRef` + resize observer for dynamic height measurement. Header component (`flex-wrap py-2`) wraps naturally on mobile — no fixed height.

**Key components**:
- `Header` — Breadcrumbs, dropdowns, theme toggle, account menu
- `DownloadDropdown` / `LinkDropdown` — Radix dropdown menus with `variant` prop
- `CodeBlock` — Syntax-highlighted code with copy buttons
- `SvgViewer` — Pan/zoom SVG rendering
- `MermaidViewer` — Mermaid diagram rendering

### Server-Rendered Pages (Legacy)

Server-rendered `/path/*` pages are **frozen** — no modifications until React migration is complete, then they will be deleted. DRY template via `renderPageShell()` in `src/templates/layout.ts`.

### Dark Mode

Tailwind v4 with `@theme inline` requires CSS variable indirection:
- `@theme inline` → CSS variable refs
- `@layer base` → actual values for light/dark
- `.dark` class on `<html>` (required for Radix portal components outside React tree)
- Dark mode accent: `--accent: #3a3a3a` against `--popover: #1c1c1c`

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/browse/*` | Cookie or `?key=` | React SPA (file browser, viewer, about) |
| GET | `/path/*` | `?key=` | Legacy server-rendered pages (frozen) |
| GET | `/api/auth/status` | Cookie or `?key=` | Auth status check |
| GET | `/api/auth/google` | None | Google OAuth initiation |
| GET | `/api/auth/google/callback` | None | Google OAuth callback |
| GET | `/api/drives` | Cookie or `?key=` | List available drives |
| GET | `/api/directory/:path` | Cookie or `?key=` | Directory listing |
| GET | `/api/file/:path` | Cookie or `?key=` | File content (rendered or raw) |
| POST | `/event` | `?key=` (scoped) | Webhook gateway |
| GET | `/key` | X-API-Key header | Compute outsider key for a path |
| GET | `/insider-key` | X-API-Key header | Get insider key |
| POST | `/rotate-key` | Key (in body) | Rotate a key |
| GET | `/health` | None | Health check |
| GET | `/about` | None or key | Legacy about page |

## Build & Development

### Prerequisites

- Node.js ≥ 18
- Chrome/Chromium (for PDF export)

### Build

```bash
# Full rebuild (server + client)
npm run build              # tsc — compiles server, prebuild nukes dist/
cd client
npx vite build --outDir ../dist/client   # Must rebuild client after server
cd ..
```

> ⚠️ **`npm run build` (`prebuild`) deletes the entire `dist/` directory**, including `dist/client/`. Always rebuild the client after the server build.

### Development

```bash
# Dev repo: E:\dev\karmaniverous\jeeves-server (port 3457)
# Prod repo: E:\jeeves-server (port 3456)

# Start dev server
node dist/server.js
```

### Self-Testing

Uses `puppeteer-core` from the project's `node_modules` with the derived `_internal` insider key for screenshot verification.

### Git Workflow

Branch: `feature/GH-5-react-frontend` for React SPA migration. Lefthook pre-commit hooks with `add-issue` (auto-prefixes `[GH-5]`).

## Static Assets (Zero CDN)

All JS/CSS libraries are served locally:

| Route | Library |
|-------|---------|
| `/static/lucide.min.js` | Lucide icons |
| `/static/panzoom.min.js` | Panzoom (SVG viewer) |
| `/static/hljs/:theme` | highlight.js themes |

## Dependencies

| Package | Purpose |
|---------|---------|
| `fastify` | HTTP server |
| `@fastify/cookie` | Cookie management (Google auth sessions) |
| `@fastify/static` | Static file serving (React SPA) |
| `puppeteer-core` | PDF export (uses installed Chrome) |
| `@turbodocx/html-to-docx` | DOCX export |
| `highlight.js` | Syntax highlighting |
| `marked` | Markdown → HTML |
| `ajv` | JSON Schema validation (event gateway) |
| `@karmaniverous/jsonmap` | JSON body mapping (event gateway) |
| `lodash` | Utility functions (jsonmap lib) |
| `@panzoom/panzoom` | SVG pan/zoom |
| `jiti` | Runtime TypeScript config loading |
| `zod` | Schema validation (v4) |
| `archiver` | ZIP export |

### Client Dependencies

| Package | Purpose |
|---------|---------|
| `react` / `react-dom` | UI framework |
| `react-router-dom` | Client-side routing |
| `@radix-ui/react-dropdown-menu` | Dropdown primitives |
| `lucide-react` | Icons |
| `tailwindcss` | Styling (v4) |
| `@tailwindcss/typography` | Prose styling |
| `tailwind-merge` | Class merging utility |
| `clsx` | Conditional classes |

## Running as Windows Service

```bash
nssm install JeevesServer "node" "E:\jeeves-server\dist\server.js"
nssm start JeevesServer
```

## License

MIT
