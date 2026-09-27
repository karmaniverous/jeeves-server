# Changelog

All notable changes to this project will be documented in this file.

## [unreleased]

### 💼 Other

- [261] chore(deps): pin @karmaniverous/jeeves 0.6.0-7
## [0.2.1-0] - 2026-09-27

### 💼 Other

- [261] feat(openclaw)!: standard OpenClaw plugin on jeeves core 0.6.0 with lazy configRoot

Move the plugin (and jeeves-server-core) to @karmaniverous/jeeves@0.6.0-3,
the static-content core (karmaniverous/jeeves#109).

- Remove the ComponentWriter / TOOLS.md "## Server" section, the async
  status-menu cache (promptInjection) and the createPluginCli-based
  install/uninstall bin. `jeeves install` installs the plugin with
  `openclaw plugins install` and writes its config.
- Resolve configRoot lazily (plugin config, then JEEVES_CONFIG_ROOT) when a
  tool runs. register() always succeeds, logs one warning when configRoot is
  unset, and defers core init() to first use. Tools invoked without it return
  a clear error naming both ways to set it. publicUrl is read per call.
- Manifest: configRoot/pluginKey descriptions; configRoot has no default and
  is not required. SKILL.md gains name/description frontmatter (#260) and
  jeeves install instructions.
- Tests: registration without config, tool error, plugin config / OpenClaw
  config entry / env var, late config, lazy publicUrl, no conversation hooks,
  manifest and skill frontmatter checks.

BREAKING CHANGE: the `jeeves-server-openclaw install|uninstall` CLI is gone;
install with `jeeves install server` (or `openclaw plugins install`). The
plugin no longer writes TOOLS.md; use `server_status` and the skill.

Closes #261
Closes #263
Closes #260
- [261] chore(deps): ncu -u --peer across all packages
- [261] chore: apply prettier across the repo; ignore generated CHANGELOGs
- [261] feat(openclaw): pass lazy apiUrl to createPluginToolset; pin core 0.6.0-4
- [261] chore(deps): pin @karmaniverous/jeeves 0.6.0-6
- [261] fix(release): use --github.preRelease for release-it 21
- [261] chore: release @karmaniverous/jeeves-server-core v0.2.1-0
## [0.2.0] - 2026-06-25

### 💼 Other

- [SERVER-312] fix: prevent overlapping event queue batches, add eventQueue config (#245)
- [SERVER-312] fix: remove publicUrl from plugin config, make eventQueueConcurrency configurable (#245, #247)
- [SERVER-312] fix: address Copilot review — drainLoop error handling, resolve-path 404/400, absolute path validation, stale cursor recovery (#245, #247)

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-core v0.2.0
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
