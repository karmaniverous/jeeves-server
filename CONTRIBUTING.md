# Contributing to jeeves-server

## Prerequisites

- Node.js 24.22.2+
- npm 10+
- A `jeeves-core` configuration directory (set via `JEEVES_CONFIG_ROOT` env var, defaults to `J:\config` on the reference install)

## Repository Structure

This is a monorepo with four packages:

```
packages/
  core/             # Endpoint catalog, schemas, error codes, OpenAPI document, config schema, key utilities
  sdk/              # Typed, browser-safe API client built from the catalog
  service/          # The Fastify server + React SPA client
    client/         # Vite + React client source
    src/            # Server TypeScript source
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

| Variable                | Description                | Default     |
| ----------------------- | -------------------------- | ----------- |
| `JEEVES_WORKSPACE_PATH` | Path to jeeves workspace   | `J:\jeeves` |
| `JEEVES_CONFIG_ROOT`    | Path to jeeves-core config | `J:\config` |

Set these before running the dev server if your paths differ from the defaults.

### Building

From the repo root:

```bash
npm run build        # Builds core + SDK + server + client (Vite) + OpenClaw plugin
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

Client tests (`packages/service/client/src/**/*.test.ts`) run in the service package's Vitest (`npm test` in `packages/service`) under happy-dom, with the client's `@/` alias. Hooks and components are rendered with the small harness in `client/src/test/reactHarness.ts` (`renderHook`, `mount`, `settle`), with client modules such as `@/lib/api` mocked.

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

|  | Dev | Prod |
| --- | --- | --- |
| **Port** | 19340 | 1934 |
| **Entry** | `npx tsx watch packages/service/src/dev-server.ts` | NSSM service (global npm install) |
| **Config** | `<configDir>/jeeves-server/config.json` | Global install `config.json` |
| **Client** | Built via `npm run build` | Built during `npm publish` |

**Never copy config between dev and prod.** Each has its own OAuth credentials, session secrets, and key seeds.

## Wire Baseline

`packages/service/src/api/wireBaseline.test.ts` (part of `npm test`) replays every scenario in `packages/service/src/test/wire/` against the real routes over a temp corpus and config, with every dependency (watcher, runner, SMTP, PlantUML servers, Chrome) unreachable, and compares each reply (status, key headers, normalised body; binary bodies by length and hash) with `wire-baseline.json`, recorded from the release's branch base.

- **Never edit `wire-baseline.json`.** A reply that changes on purpose is listed in `departures.ts` with what the base sent and the decision that allows it; anything else is a regression.
- New scenarios: add them to the `scenarios*.ts` lists, then re-record from the base: `npm run wire:capture` in `packages/service` (optional `--ref <ref>`, `--out <path>`) checks the ref out into a temporary git worktree, installs it, copies the current harness in and records there. The harness may only import service modules that exist at that ref.
- Recording runs on Windows and Linux; volatile values (temp and package paths, the content root, keys, deep-share stacks, timestamps, versions, UUIDs) are normalised, and Windows drive listings and breadcrumbs are mapped onto the Linux view.

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
