# Changelog

All notable changes to this project will be documented in this file.

## [unreleased]

### 🚀 Features

- Expand config schema for magic link auth and instance branding

### 🐛 Bug Fixes

- Resolve lint errors (prettier, deprecated z.email, unnecessary optionals, async mocks)

### 🚜 Refactor

- SOLID/DRY pass - generic TTL map, DEFAULT_BRANDING, setSessionCookie, renderErrorPage, export DEFAULT_TEMPLATE
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
