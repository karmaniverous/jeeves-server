# Changelog

All notable changes to this project will be documented in this file.

## [unreleased]

### 💼 Other

- Updated core
- Updated jeeves/core
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
