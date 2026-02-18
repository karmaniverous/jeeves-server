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
- **Deep share links** — Configurable `depth` (0-10) for following internal links, `dirs` flag for directory browsing
  - Server-side link rewriting: internal links get computed sub-keys, external links untouched
  - Stack-based navigation: tracks visited pages, supports back-traversal without depth cost
  - Backward-compatible key derivation: existing share links (no depth/dirs) keep working
  - Directory access scoped by sharer's permissions when `dirs=true`
  - `withKey()` forwards all auth params (`key`, `d`, `dirs`, `s`, `exp`) on API calls
- **README share link** — `/api/readme-link` endpoint returns pre-computed deep share URL for server's README (uses `_internal` key seed, `depth=2`, `dirs=false`)
- **Outsider breadcrumbs** — File shares show filename only; directory shares trim to share root
- **Dropdown menus** — `DownloadDropdown` and `LinkDropdown` components with `variant` prop (`'header'` | `'default'` | `'menuItem'`)
  - Header variant: always-dark styling with `hover:bg-white/10`
  - Default variant: theme-aware for table rows
  - MenuItem variant: full-width menu row for collapsed account menu items
  - Directory shares hide depth/dirs controls (inherently descendant-scoped)
- **Progressive header collapse** — Controls fold into account menu across breakpoints: 400px (link), 480px (download), sm (key), md (readme+github+theme)

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
| `/browse` (header) | `Header` | 📖 README share link + GitHub link |

**Layout pattern**: Each page manages its own fixed top bar container with `topBarRef` + resize observer for dynamic height measurement. Header component (`flex-wrap py-2`) wraps naturally on mobile — no fixed height.

**Key components**:
- `Header` — Breadcrumbs, dropdowns, theme toggle, account menu
- `DownloadDropdown` / `LinkDropdown` — Radix dropdown menus with `variant` prop
- `CodeBlock` — Syntax-highlighted code with copy buttons
- `SvgViewer` — Pan/zoom SVG rendering
- `MermaidViewer` — Mermaid diagram rendering

### Server-Rendered Pages (Removed)

Legacy `/path/*` routes have been decommissioned. All page views are served by the React SPA at `/browse/*`. API endpoints at `/api/raw/*` and `/api/export/*` handle raw file access and exports.

### Dark Mode

Tailwind v4 with `@theme inline` requires CSS variable indirection:
- `@theme inline` → CSS variable refs
- `@layer base` → actual values for light/dark
- `.dark` class on `<html>` (required for Radix portal components outside React tree)
- Dark mode accent: `--accent: #3a3a3a` against `--popover: #1c1c1c`

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/browse/*` | Cookie or `?key=` | React SPA (file browser, viewer) |
| GET | `/api/auth/status` | Cookie or `?key=` | Auth status check (accepts `path` param for outsider key verification) |
| GET | `/api/auth/google` | None | Google OAuth initiation |
| GET | `/api/auth/google/callback` | None | Google OAuth callback |
| GET | `/api/drives` | Cookie or `?key=` | List available drives |
| GET | `/api/path/:path` | Cookie or `?key=` | Directory listing |
| GET | `/api/file/:path` | Cookie or `?key=` | File content (rendered or raw) |
| GET | `/api/raw/:path` | Cookie or `?key=` | Raw file download |
| GET | `/api/export/:path` | Cookie or `?key=` | PDF/DOCX export |
| POST | `/api/share` | Cookie (insider) | Generate outsider share link (accepts `depth`, `dirs`) |
| GET | `/api/readme-link` | None | Pre-computed README share URL |
| POST | `/api/rotate-key` | Cookie (insider) | Rotate insider key |
| POST | `/api/util/share-for` | Cookie or `?key=` | Audience-aware share link generation |
| POST | `/event` | `?key=` (scoped) | Webhook gateway |
| GET | `/health` | None | Health check |

## Utility Endpoints (`/api/util/*`)

Programmatic endpoints for access decisions and server introspection. Used by the resident AI assistant and future CLI.

### `POST /api/util/share-for`

Determines the appropriate link type for sharing a resource with a specific audience. The sharer is identified from the request's auth context.

**Request:**
```json
{
  "path": "/d/projects/foo/spec.md",
  "insiders": ["devin@qtalo.com", "guest@example.com"],
  "depth": 2,
  "dirs": false,
  "enforceOutsiderPolicy": true
}
```

**Decision tree:**
1. Can the sharer access this path? No → `null`
2. Can all insider participants access this path? No → `null` (returns `blocked` list)
3. Are there non-insider participants?
   - No → bare insider URL
   - Yes + `enforceOutsiderPolicy` + policy allows → outsider share link
   - Yes + `enforceOutsiderPolicy` + policy denies → `null`
   - Yes + policy not enforced → outsider share link (+ `warning` if policy would deny)

**Response types:** `insider`, `outsider-share`, `blocked`, `policy-denied`

### Outsider Policy

Global config constraining which paths are eligible for outsider sharing:

```typescript
outsiderPolicy?: {
  allow?: string[];
  deny?: string[];
}
```

Uses the same allow/deny scopes model as insider scopes. When `enforceOutsiderPolicy: true` is passed (default for AI assistant usage), the policy gates outsider share link generation. When `false` (web UI usage), the policy produces warnings but doesn't block.

### Client-side Insider Upgrade

When a logged-in insider lands on an outsider share link, the SPA detects insider status via `/api/auth/status` and strips the key/depth/stack params, upgrading to full insider navigation.

### Future Utility Endpoints (planned)

| Path | Description |
|------|-------------|
| `/api/util/access` | Raw access check for a single identity + path |
| `/api/util/keys` | Key derivation and rotation status |
| `/api/util/config` | Sanitized config introspection |
| `/api/util/health` | Extended health check |

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

Feature branches named `feature/GH-{N}-description`. Lefthook pre-commit hooks with `add-issue` (auto-prefixes `[GH-{N}]`). Squash merge to `main`.

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

## Platform Support

**Supported:** Windows and Linux. Both tested in CI (GitHub Actions, Ubuntu, Node 20 + 22).

**Platform abstraction layer** (`src/util/platform.ts`):
- `getRoots()` — Windows: auto-discovers drive letters A-Z. Linux: uses configurable `roots` from config.
- `urlPathToFs()` / `fsPathToUrl()` — bidirectional URL ↔ filesystem path conversion.
- `breadcrumbParts()` — platform-aware breadcrumb generation.

**Platform-specific config:**
- `chromePath` — path to Chrome/Chromium binary (platform-dependent)
- `roots` — filesystem root map for Linux file browser (ignored on Windows)
- `mermaidCliPath` — path to mermaid-cli installation (optional, replaces hardcoded path)

**Platform-agnostic core:** Fastify, React SPA, HMAC auth model, markdown rendering, export service, event gateway.

## Running as a Service

**Windows (NSSM):**
```bash
nssm install JeevesServer "node" "E:\jeeves-server\dist\server.js"
nssm start JeevesServer
```

**Linux (systemd):**
```bash
sudo systemctl enable jeeves-server
sudo systemctl start jeeves-server
```

## License

MIT
