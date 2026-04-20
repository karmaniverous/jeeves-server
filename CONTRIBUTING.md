# Contributing to jeeves-server

## Prerequisites

- Node.js v24+
- npm 10+
- A `jeeves-core` configuration directory (set via `JEEVES_CONFIG_ROOT` env var, defaults to `J:\config` on the reference install)

## Repository Structure

This is a monorepo with three packages:

```
packages/
  service/          # The Fastify server + React SPA client
    client/         # Vite + React client source
    src/            # Server TypeScript source
  jeeves-server/    # Config package (config.json)
  openclaw/         # OpenClaw plugin (skills, prompt injection)
```

## Setup

```bash
git clone https://github.com/karmaniverous/jeeves-server.git
cd jeeves-server
npm install
```

## Development

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `JEEVES_WORKSPACE_PATH` | Path to jeeves workspace | `J:\jeeves` |
| `JEEVES_CONFIG_ROOT` | Path to jeeves-core config | `J:\config` |

Set these before running the dev server if your paths differ from the defaults.

### Building

From the repo root:

```bash
npm run build        # Builds server (tsc) + client (Vite) + OpenClaw plugin
npm run typecheck    # Type-check all packages
npm run lint         # ESLint
```

### Running the Dev Server

The server requires `jeeves-core` to be initialized before startup. Use `dev-server.ts` (not `server.ts` directly):

```bash
# 1. Build the client first (the dev server serves built Vite assets, not source)
npm run build

# 2. Start the dev server
npx tsx watch packages/service/src/dev-server.ts
```

The dev server runs on port **19340** (prod uses 1934).

> **Why not `npm run dev`?** The workspace `dev` script runs `server.ts` directly, which requires `jeeves-core` to already be initialized. `dev-server.ts` calls `init()` first, then imports `server.ts`.

> **White screen?** If you see a white screen, the client assets are probably not built. Run `npm run build` and restart.

### Client Iteration

There is no standalone Vite dev server. The Fastify server serves the built client assets. For rapid client iteration:

1. Keep the dev server running (`npx tsx watch packages/service/src/dev-server.ts`)
2. In a second terminal: `npx vite build --watch` (from `packages/service/client/`)
3. Refresh the browser after each rebuild

### Port Conflicts

If port 19340 is already in use from a previous crashed process:

```bash
# Windows
netstat -aon | findstr :19340
taskkill /PID <pid> /F

# macOS / Linux
lsof -i :19340
kill -9 <pid>
```

## Dev vs Prod

| | Dev | Prod |
|---|---|---|
| **Port** | 19340 | 1934 |
| **Entry** | `npx tsx watch packages/service/src/dev-server.ts` | NSSM service (global npm install) |
| **Config** | `packages/jeeves-server/config.json` | Global install `config.json` |
| **Client** | Built via `npm run build` | Built during `npm publish` |

**Never copy config between dev and prod.** Each has its own OAuth credentials, session secrets, and key seeds.

## Branch Naming

Enforced by lefthook pre-commit hook:

- `bugfix/<name>`
- `feature/<name>`
- `chore/<name>`
- `docs/<name>`
- `hotfix/<name>`
- `release/<semver>`

## Commit & PR Guidelines

- Conventional commits: `fix:`, `feat:`, `chore:`, `docs:`, etc.
- Include the issue number: `fix: description (#123)`
- Run `npm run typecheck` and `npm run lint` before pushing
- PRs target `main`
