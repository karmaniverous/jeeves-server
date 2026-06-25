# Changelog

All notable changes to this project will be documented in this file.

## [unreleased]

### 💼 Other

- [SERVER-312] fix: prevent overlapping event queue batches, add eventQueue config (#245)
- [SERVER-312] fix: remove publicUrl from plugin config, make eventQueueConcurrency configurable (#245, #247)
- [SERVER-312] fix: address Copilot review — drainLoop error handling, resolve-path 404/400, absolute path validation, stale cursor recovery (#245, #247)
## [0.1.7] - 2026-06-15

### 🐛 Bug Fixes

- Resolve lint warnings — tsdoc escaping, restore eslint-disable, setState anti-pattern

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-core v0.1.7
## [0.1.6] - 2026-06-14

### 🚀 Features

- Expand config schema for magic link auth and instance branding

### 🐛 Bug Fixes

- Resolve lint errors (prettier, deprecated z.email, unnecessary optionals, async mocks)

### 🚜 Refactor

- SOLID/DRY pass - generic TTL map, DEFAULT_BRANDING, setSessionCookie, renderErrorPage, export DEFAULT_TEMPLATE

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-core v0.1.6
## [0.1.5] - 2026-06-13

### 💼 Other

- [213] feat: add logging.level and logging.file config support (#213)
- [210] feat: shared endpoint catalog in core package (#210)

### 📚 Documentation

- Sync README, guides, and core exports with touched code

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-core v0.1.5
## [0.1.4] - 2026-06-11

### 💼 Other

- Updated core
- Updated jeeves/core

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-core v0.1.4
## [0.1.3] - 2026-05-29

### ⚙️ Miscellaneous Tasks

- Update dependencies via ncu --peer
- Release @karmaniverous/jeeves-server-core v0.1.3
## [0.1.2] - 2026-05-13

### 🚀 Features

- Export config Zod schema via core package (#204)

### 🐛 Bug Fixes

- Resolve lint errors in export ordering and stale disable directive
- Strip BOM and repair encoding artifacts in schema.ts; remove fixknip2.js

### 💼 Other

- Merge remote-tracking branch 'origin/main' into chore/git-cliff-changelogs

# Conflicts:
#	packages/service/package.json

### ⚙️ Miscellaneous Tasks

- Apply safe dependency updates
- Update all deps and migrate core/service to rollup+ts builds
- Merge main into branch, resolve package.json conflicts
- Add missing npm metadata to core package.json
- Release @karmaniverous/jeeves-server-core v0.1.2
## [0.1.1] - 2026-05-12

### ⚙️ Miscellaneous Tasks

- Add npm publish safety net (.npmignore + gitignore *.local)
- Add files whitelists and npm-pack-check CI workflow
- Switch from auto-changelog to git-cliff
- Release @karmaniverous/jeeves-server-core v0.1.1
## [0.1.0] - 2026-04-22

### 💼 Other

- Public package

### 🚜 Refactor

- Rename shared package to @karmaniverous/jeeves-server-core

### ⚙️ Miscellaneous Tasks

- Add release-it infrastructure to core package
- Release @karmaniverous/jeeves-server-core v0.1.0
