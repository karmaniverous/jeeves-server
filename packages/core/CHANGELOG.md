# Changelog

All notable changes to this project will be documented in this file.

## [0.4.0] - 2026-10-14

### 🚀 Features

- *(auth)* Accept the URL key as k as well as key (#279)
- *(core)* TrustProxyHeaders config setting; core 0.4.0
- *(share)* Report isDirectory from /api/share; server_share returns rawUrl for plain and deep file shares, none for directories

### 🐛 Bug Fixes

- *(release)* GitHub release notes and changelog use the new version tag (#276)
- *(release)* Match npm-package-template-ts#30 exactly (#276)
- *(config)* Require publicUrl when login flows are configured
- *(events)* Restrict /api/events to unscoped insiders
- *(release)* Pass the package-prefixed tag to git-cliff

### 📚 Documentation

- Sync guides, skill, README and endpoint catalog with 3.15.0 behaviour
- *(core)* Document ShareResponse.isDirectory; test /api/share isDirectory with and without a trailing slash

### 🧪 Testing

- *(events)* Pin the strict rule for insiders with any scopes configured
- Replace constant-only and weak assertions with behaviour checks
- *(core)* Assert whole-config validity when a login flow is accepted

### ⚙️ Miscellaneous Tasks

- Revert package version bumps (releases are done locally)
## [0.3.0] - 2026-09-29

### 💼 Other

- Updated jeeves-core

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-core v0.3.0
## [0.2.1-3] - 2026-09-28

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-core v0.2.1-3
## [0.2.1-2] - 2026-09-27

### 🐛 Bug Fixes

- Update root package-lock.json in release-it after:bump hook

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-core v0.2.1-2
## [0.2.1-1] - 2026-09-27

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-core v0.2.1-1
## [0.2.1-0] - 2026-09-27

### 🚀 Features

- *(openclaw)* [**breaking**] Standard OpenClaw plugin on jeeves core 0.6.0 with lazy configRoot
- *(openclaw)* Pass lazy apiUrl to createPluginToolset; pin core 0.6.0-4

### 🐛 Bug Fixes

- *(release)* Use --github.preRelease for release-it 21

### ⚙️ Miscellaneous Tasks

- Apply prettier across the repo; ignore generated CHANGELOGs
- Release @karmaniverous/jeeves-server-core v0.2.1-0
## [0.2.0] - 2026-06-25

### 🐛 Bug Fixes

- Prevent overlapping event queue batches, add eventQueue config (#245)
- Remove publicUrl from plugin config, make eventQueueConcurrency configurable (#245, #247)
- Address Copilot review — drainLoop error handling, resolve-path 404/400, absolute path validation, stale cursor recovery (#245, #247)

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

### 🚀 Features

- Add logging.level and logging.file config support (#213)
- Shared endpoint catalog in core package (#210)

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
