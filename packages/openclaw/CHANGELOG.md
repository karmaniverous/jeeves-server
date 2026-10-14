# Changelog

All notable changes to this project will be documented in this file.

## [0.15.0] - 2026-10-14

### 🚀 Features

- *(share)* Generate share and auth URLs with k (#279)
- *(core)* TrustProxyHeaders config setting; core 0.4.0
- *(share)* Report isDirectory from /api/share; server_share returns rawUrl for plain and deep file shares, none for directories

### 🐛 Bug Fixes

- *(plugin)* Server_share rawUrl uses /api/raw/ (#278)
- *(release)* GitHub release notes and changelog use the new version tag (#276)
- *(auth)* Tighten auth on resolve-path, events and export-cache routes
- *(release)* Match npm-package-template-ts#30 exactly (#276)
- *(config)* Require publicUrl when login flows are configured
- *(sharing)* Issue plain tree keys for share-for directory links without depth
- *(events)* Restrict /api/events to unscoped insiders
- *(release)* Pass the package-prefixed tag to git-cliff

### 💼 Other

- Updated core

### 📚 Documentation

- K parameter, /status and /health, skill additions (#279, #259, #274)
- Deep share semantics, publicUrl and trustProxyHeaders, route auth
- Point event log readers to /api/events and fix an en dash
- Sync guides, skill, README and endpoint catalog with 3.15.0 behaviour
- Directory shares from the UI are plain; deep directory shares come from the API or plugin
- *(plugin)* Server_share links never expire when expiryDays is omitted

### 🧪 Testing

- *(openclaw)* Use the current server_share shape in the rewrite fixture
- *(events)* Pin the strict rule for insiders with any scopes configured
- Replace constant-only and weak assertions with behaviour checks

### ⚙️ Miscellaneous Tasks

- Revert package version bumps (releases are done locally)
## [0.14.1] - 2026-10-04

### 🐛 Bug Fixes

- *(service)* Address review on insider scope enforcement (#271)

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.14.1
## [0.14.0] - 2026-09-29

### 💼 Other

- Updated jeeves-core
- Updated core

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.14.0
## [0.14.0-3] - 2026-09-28

### 💼 Other

- Updated core

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.14.0-3
## [0.14.0-2] - 2026-09-27

### 💼 Other

- Updated core

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.14.0-2
## [0.14.0-1] - 2026-09-27

### 🐛 Bug Fixes

- *(openclaw)* Accurate configRoot-unset startup warning (#266)
- Update root package-lock.json in release-it after:bump hook

### 💼 Other

- Updated core
- [267] fix: tests and typecheck read core and CLI from source, not dist

Service and openclaw vitest configs alias @karmaniverous/jeeves-server-core
to packages/core/src, and their tsconfigs map it with paths, so typecheck
and tests pass on a clean checkout with no dist/. The rollup builds override
paths: {} and still build against the built core package. Service rootDir and
outDir move to tsconfig.build.json (TS 6 rejects source outside rootDir).

The config CLI test runs src/cli/index.ts through tsx instead of
dist/src/cli/index.js.

Source resolution exposes core's @deprecated mermaidCliPath, so the ignored
field is no longer copied into RuntimeConfig.

Closes #267

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.14.0-1
## [0.14.0-0] - 2026-09-27

### 🚀 Features

- *(openclaw)* [**breaking**] Standard OpenClaw plugin on jeeves core 0.6.0 with lazy configRoot
- *(openclaw)* Pass lazy apiUrl to createPluginToolset; pin core 0.6.0-4

### 🐛 Bug Fixes

- *(openclaw)* Gate only tools that read configRoot
- *(release)* Use --github.preRelease for release-it 21

### 💼 Other

- Updated core

### 🧪 Testing

- *(openclaw)* Merge duplicate HTTP-tool configRoot tests

### ⚙️ Miscellaneous Tasks

- *(openclaw)* Update rollup, @rollup/plugin-commonjs and zod minors
- Resolve knip findings and audit advisories (lodash-es override)
- Apply prettier across the repo; ignore generated CHANGELOGs
- Release @karmaniverous/jeeves-server-openclaw v0.14.0-0
## [0.13.0] - 2026-07-02

### 📚 Documentation

- Sync guides, skill, and API reference with #241 tar format, #252 OTP flow, #253 auth gate

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.13.0
## [0.12.0] - 2026-06-25

### 🐛 Bug Fixes

- Remove hardcoded j:/config fallback for configRoot (#244)
- Replace hardcoded j/ drive prefix in tool examples (#246)
- Require auth for server_resolve_path plugin tool (#247)
- Make resolve-path endpoint unauthenticated (#247)
- Remove publicUrl from plugin config, make eventQueueConcurrency configurable (#245, #247)

### 💼 Other

- Updated core

### 🚜 Refactor

- Extract resolveEventPaths helper, add skipAuth to ApiToolConfig (#245, #247)

### 📚 Documentation

- Update guides for eventQueue, eventQueueConcurrency, publicUrl, server_resolve_path (#244, #245, #246, #247)
- Sync skill, guides, and config reference with touched code (#244, #245, #246, #247)

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.12.0
## [0.11.1] - 2026-06-15

### 💼 Other

- Updated core

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.11.1
## [0.11.0] - 2026-06-14

### 💼 Other

- Updated core

### 📚 Documentation

- Update guides, README, and skill for magic link auth and branding
- Fix stale auth references in setup, SKILL, and api-integration guides

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.11.0
## [0.10.8] - 2026-06-13

### 💼 Other

- Updated core

### 📚 Documentation

- Sync SKILL.md and api-integration guide with touched code

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.10.8
## [0.10.7] - 2026-06-11

### 🐛 Bug Fixes

- *(openclaw)* Externalize @karmaniverous/jeeves in rollup config (closes #224)

### 💼 Other

- Updated deps

### 🚜 Refactor

- *(openclaw)* Use builtinModules and shared external array per review

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.10.7
## [0.10.6] - 2026-05-29

### 💼 Other

- Updated core

### ⚙️ Miscellaneous Tasks

- Update dependencies via ncu --peer
- Release @karmaniverous/jeeves-server-openclaw v0.10.6
## [0.10.5] - 2026-05-16

### 🐛 Bug Fixes

- Pin jeeves-server-core dependency to ^0.1.2

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.10.5
## [0.10.4] - 2026-05-13

### 🚀 Features

- Add contracts.tools to openclaw.plugin.json (#203)

### ⚙️ Miscellaneous Tasks

- Add npm publish safety net (.npmignore + gitignore *.local)
- Switch from auto-changelog to git-cliff
- Bump @karmaniverous/jeeves to ^0.5.10
- Apply safe dependency updates
- Release @karmaniverous/jeeves-server-openclaw v0.10.4
## [0.10.3] - 2026-05-03

### 💼 Other

- Updated jeeves-core

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.10.3
## [0.10.2] - 2026-04-22

### 🚀 Features

- Create shared package, add missing plugin tools, DRY types (#194)

### 🐛 Bug Fixes

- Address PR review — URL encoding, rawUrl regression, lockfile sync

### 🚜 Refactor

- Rename shared package to @karmaniverous/jeeves-server-core

### 📚 Documentation

- Sync all documentation with current implementation

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.10.2
## [0.10.1] - 2026-04-22

### 💼 Other

- Updated jeeves core

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.10.1
## [0.10.0] - 2026-04-20

### 🚀 Features

- Markdown-it migration, block editing, OAuth2 flow (#162, #163)

### 🐛 Bug Fixes

- Resolve all pre-existing eslint errors

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.10.0
## [0.9.1] - 2026-04-15

### 💼 Other

- Updated jeeves-core

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.9.1
## [0.9.0] - 2026-04-11

### 🚀 Features

- Add publicUrl config for shareable URL rewriting (#145)
- Update TOOLS guidance to note automatic URL rewriting (#152)

### 🐛 Bug Fixes

- Address Gemini review — URL boundary, checkbox regex, Cheerio, race condition
- Toggle-checkbox route wildcard position (CI fix)

### 🚜 Refactor

- SOLID/DRY pass across v3.7.0 changes

### 📚 Documentation

- Sync documentation with v3.7.0 implementation

### 🧪 Testing

- Improve coverage and remove trivial tests

### ⚙️ Miscellaneous Tasks

- Bump versions (service 3.7.0, openclaw 0.8.0)
- Release @karmaniverous/jeeves-server-openclaw v0.9.0
## [0.7.5] - 2026-04-08

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.7.5
## [0.7.4] - 2026-04-05

### 💼 Other

- Unhoisted jeeves

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.7.4
## [0.7.3] - 2026-04-05

### 💼 Other

- Hoisted jeeves

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.7.3
## [0.7.2] - 2026-04-05

### 🐛 Bug Fixes

- Consume core importMetaUrl for plugin install (#150)

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.7.2
## [0.7.1] - 2026-04-05

### ⚙️ Miscellaneous Tasks

- Update @karmaniverous/jeeves to ^0.5.3 and bump minor/patch deps
- Release @karmaniverous/jeeves-server-openclaw v0.7.1
## [0.7.0] - 2026-04-03

### 🚀 Features

- Phase 1 — core service adoption (getServiceUrl, getBindAddress, Node 22 fast-fail)
- Phase 2 — core v0.5.1 wiring (cleanup escalation, getPackageVersion, substituteEnvVars TODO)

### 📚 Documentation

- Phase 4 — documentation updates for v3.6.0

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.7.0
## [0.6.2] - 2026-03-31

### ⚙️ Miscellaneous Tasks

- Bump core to v0.4.6 (init before run) + fix knip issues
- Bump core to v0.4.6 (init before run) + fix knip issues
- Release @karmaniverous/jeeves-server-openclaw v0.6.2
## [0.6.1] - 2026-03-30

### 🚀 Features

- Integrate descriptor.run from core v0.4.5

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.6.1
## [0.6.0] - 2026-03-30

### 🐛 Bug Fixes

- Use static bind default, bump openclaw core dep, remove local stub
- Add missing dirs param to server_share plugin tool (#99, #87)
- Resolve lint errors from core v0.4.4 migration

### 🚜 Refactor

- Migrate openclaw plugin to core v0.4.4 SDK
- Adopt createPluginToolset, health-nested status, event endpoint (#87, #112, #118, #128)
- Remove Connected Services from TOOLS.md writer (closes #128)

### 📚 Documentation

- Sync documentation with SDK adoption changes
- Add title front matter to all guides

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.6.0
## [0.5.1] - 2026-03-25

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.5.1
## [0.5.0] - 2026-03-22

### 🚀 Features

- Bump core to v0.3.0 and consolidate status endpoint (#117)

### 🚜 Refactor

- *(openclaw)* Use resolveOptionalPluginSetting for getPluginKey (#112)

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.5.0
## [0.4.1] - 2026-03-22

### 🚀 Features

- Add host bind and metaUrl config options

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.4.1
## [0.4.0] - 2026-03-21

### 🚀 Features

- Core v0.2.0 SDK adoption (#111) ([#111](https://github.com/karmaniverous/jeeves-server/pull/111))

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.4.0
## [0.3.1] - 2026-03-19

### 🚀 Features

- *(openclaw)* Adopt jeeves core component writer

### 🐛 Bug Fixes

- Add tagPrefix to auto-changelog config for monorepo tags
- *(openclaw)* Derive plugin version from package.json at runtime
- *(openclaw)* Address Gemini review — error handling and writer cleanup
- *(openclaw)* Bundle @karmaniverous/jeeves into plugin dist

### 🚜 Refactor

- *(openclaw)* Use createAsyncContentCache from jeeves v0.1.1
- *(openclaw)* Resolve SOLID/DRY violations

### 📚 Documentation

- Full documentation pass with PlantUML diagrams
- Fix diagram image paths in guides

### 🧪 Testing

- *(openclaw)* Cover service commands
- *(openclaw)* Expand coverage for openclawPaths, pluginRemove, serviceCommands

### ⚙️ Miscellaneous Tasks

- *(openclaw)* Update deps, clean knip config
- *(openclaw)* Update @karmaniverous/jeeves to 0.1.3
- *(openclaw)* Use resolveWorkspacePath from jeeves 0.1.4
- *(openclaw)* Update @karmaniverous/jeeves to 0.1.5
- *(openclaw)* Update jeeves to 0.1.6, add servicePackage/pluginPackage
- Release @karmaniverous/jeeves-server-openclaw v0.3.1
## [0.3.0] - 2026-03-14

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.3.0
## [0.2.1] - 2026-03-11

### 📚 Documentation

- Document scope override precedence in OpenClaw skill

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.2.1
## [0.2.0] - 2026-03-09

### 🚀 Features

- Search facets, metadata chips, and click-to-filter

### 🐛 Bug Fixes

- Server_share sends POST with JSON body instead of GET (#87)
- Server_browse and server_export route mismatches

### 📚 Documentation

- Document ?events=N query param on /api/status

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.2.0
## [0.1.1] - 2026-03-08

### 💼 Other

- Updated docs

### 📚 Documentation

- Refresh README and guides for v3 CLI + config
- Add changelogs as children of package guide indexes
- Add guide index content and fix typedoc trailing comma

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.1.1
## [0.1.0] - 2026-03-08

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.1.0
## [0.1.0-1] - 2026-03-08

### 🐛 Bug Fixes

- Plugin auth chain, status endpoint improvements (#83) ([#83](https://github.com/karmaniverous/jeeves-server/pull/83))
- Remove unnecessary auth from /api/status calls (endpoint is public)
- Add pattern to StatusResponse events type

### 💼 Other

- Lintfix

### ⚙️ Miscellaneous Tasks

- Add knip configs, remove dead exports, clean all code quality checks
- Release @karmaniverous/jeeves-server-openclaw v0.1.0-1
## [0.1.0-0] - 2026-03-08

### 🚀 Features

- Implement OpenClaw plugin (Phase 3, Steps 11-15)

### 🐛 Bug Fixes

- Address Gemini code review feedback across PRs #65-#76
- Address all gap analysis findings
- Resolve TS2352 warnings in openclaw test mocks

### 💼 Other

- Incorporate main (PR #77 gap-analysis)
- Zero version

### 🚜 Refactor

- Monorepo scaffolding (Phase 1, Step 1)

### ⚙️ Miscellaneous Tasks

- Add tsdoc.json to both package roots
- Add tsdoc.json to both package roots
- Eliminate all lint warnings
- SOLID/DRY pass #3 + plugin test coverage
- Make both packages releasable
- Release @karmaniverous/jeeves-server-openclaw v0.1.0-0
