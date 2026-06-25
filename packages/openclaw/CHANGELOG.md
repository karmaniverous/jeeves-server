# Changelog

All notable changes to this project will be documented in this file.

## [unreleased]

### 💼 Other

- [SERVER-312] fix: remove hardcoded j:/config fallback for configRoot (#244)
- [SERVER-312] fix: replace hardcoded j/ drive prefix in tool examples (#246)
- [SERVER-312] fix: require auth for server_resolve_path plugin tool (#247)
- [SERVER-312] fix: make resolve-path endpoint unauthenticated (#247)
- [SERVER-312] fix: remove publicUrl from plugin config, make eventQueueConcurrency configurable (#245, #247)
- [SERVER-312] docs: update guides for eventQueue, eventQueueConcurrency, publicUrl, server_resolve_path (#244, #245, #246, #247)
- [SERVER-312] refactor: extract resolveEventPaths helper, add skipAuth to ApiToolConfig (#245, #247)
- [SERVER-312] docs: sync skill, guides, and config reference with touched code (#244, #245, #246, #247)
- Updated core
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

### 💼 Other

- [V3-7] feat: add publicUrl config for shareable URL rewriting (#145)

When publicUrl is configured in the plugin, all URLs returned to tool
callers are rewritten to use the public domain instead of the local
bind address. When absent, URLs pass through unchanged (dev behavior).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
- [V3-7] feat: update TOOLS guidance to note automatic URL rewriting (#152)

Remove the need for manual loopback URL rewriting instructions. Add a
note that server tools automatically rewrite URLs when publicUrl is
configured.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
- [V3-7] chore: bump versions (service 3.7.0, openclaw 0.8.0)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
- [V3-7] refactor: SOLID/DRY pass across v3.7.0 changes

- Remove eslint-disable comments in events.ts and fileContent.ts by
  using non-async plugin pattern (matching toggleCheckbox.ts convention)
- Eliminate redundant handleText branches (rawOnly and non-rawOnly
  produced identical output)
- Extract magic number 86400000 to named MS_PER_DAY constant
- Optimize rewriteUrlsInData to pre-compute both origins instead of
  re-parsing URLs on every string match

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
- [V3-7] test: improve coverage and remove trivial tests

Add missing edge-case tests for events route (limit clamping, non-numeric
input, negative values), serverTools URL rewriting (HTTPS with port,
port-mismatch non-rewrite), and toggleCheckbox (content preservation,
multi-checkbox targeting). No trivial tests found to remove.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
- [V3-7] docs: sync documentation with v3.7.0 implementation

Add publicUrl config to all doc surfaces (SKILL.md, openclaw-integration.md,
README). Document checkbox toggling capability in TOOLS.md injection and
SKILL.md. Add v3.7.0 and v0.8.0 CHANGELOG entries. Fix prettier formatting
in toggleCheckbox test.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
- [V3-7] fix: address Gemini review — URL boundary, checkbox regex, Cheerio, race condition

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
- [V3-7] fix: toggle-checkbox route wildcard position (CI fix)

Move wildcard from middle of route path to end: POST /api/file/*/toggle-checkbox
→ POST /api/toggle-checkbox/*. Fastify's find-my-way router requires wildcards
to be the last character in the route.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>

### ⚙️ Miscellaneous Tasks

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

### 💼 Other

- [150] fix: consume core importMetaUrl for plugin install (#150)

Fixes #150. Also closes #147.

- Bump @karmaniverous/jeeves to ^0.5.4 in both packages
- Replace distDir with importMetaUrl in plugin CLI
- Remove unused node:path and node:url imports from cli.ts

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.7.2
## [0.7.1] - 2026-04-05

### ⚙️ Miscellaneous Tasks

- Update @karmaniverous/jeeves to ^0.5.3 and bump minor/patch deps
- Release @karmaniverous/jeeves-server-openclaw v0.7.1
## [0.7.0] - 2026-04-03

### 💼 Other

- [360] feat: Phase 1 — core service adoption (getServiceUrl, getBindAddress, Node 22 fast-fail)

- Bump @karmaniverous/jeeves to ^0.5.1 in both packages
- Set engines.node to >=22 in all package.json files
- Add runtime Node version fast-fail guard in CLI and start-server entry points
- Replace bespoke watcherUrl, runnerUrl, metaUrl config properties with getServiceUrl() from core
- Replace bespoke host config property with getBindAddress() from core
- Fix hardcoded 127.0.0.1 in export route — now uses resolved bind address
- Add config migration: deprecated properties stripped with deprecation warnings
- Update all call sites (runner proxy, search, fileContent, auth-status, status, export)
- Update RuntimeConfig type and buildRuntimeConfig to remove deprecated fields
- Wire init() in descriptor.run() and start-server.ts for core service resolution
- Update all test files for new types and mock getServiceUrl/fetch

Closes #135, #141, #142, #143, #145
- [360] feat: Phase 2 — core v0.5.1 wiring (cleanup escalation, getPackageVersion, substituteEnvVars TODO)

- Wire gatewayUrl cleanup escalation in plugin via loadWorkspaceConfig()
- Replace bespoke packageVersion.ts with core getPackageVersion(import.meta.url)
- Add TODO comment to substituteEnvVars.ts (core does not export it yet)
- Update onConfigApply signature to accept config argument (Task 7)
- [360] docs: Phase 4 — documentation updates for v3.6.0

- Update SKILL.md: Node 22+, CSV rendering, directory counts, collapsible features, core service discovery
- Update setup guide: remove deprecated config properties, add core service discovery guidance
- Update README: Node 22+, add CSV and collapsible features to highlights
- Review promptInjection.ts: no changes needed (status shape unchanged)

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.7.0
## [0.6.2] - 2026-03-31

### 💼 Other

- [53] chore: bump core to v0.4.6 (init before run) + fix knip issues
- [53] chore: bump core to v0.4.6 (init before run) + fix knip issues

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.6.2
## [0.6.1] - 2026-03-30

### 💼 Other

- [51] feat: integrate descriptor.run from core v0.4.5

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.6.1
## [0.6.0] - 2026-03-30

### 💼 Other

- [35] fix: use static bind default, bump openclaw core dep, remove local stub
- [35] fix: add missing dirs param to server_share plugin tool (#99, #87)

The server_share tool was missing the dirs parameter that the POST /api/share
endpoint accepts. Added dirs to tool parameters and buildRequest body.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
- [35] refactor: migrate openclaw plugin to core v0.4.4 SDK

Remove hand-rolled serviceCommands/pluginRemove in favor of core's
createServiceManager and createPluginCli. Rewrite cli.ts to delegate
to createPluginCli factory. Update index.ts to construct a full
JeevesComponentDescriptor for createComponentWriter.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
- [35] fix: resolve lint errors from core v0.4.4 migration
- [35] refactor: adopt createPluginToolset, health-nested status, event endpoint (#87, #112, #118, #128)
- [35] refactor: remove Connected Services from TOOLS.md writer (closes #128)
- [35] docs: sync documentation with SDK adoption changes
- [35] docs: add title front matter to all guides

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.6.0
## [0.5.1] - 2026-03-25

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.5.1
## [0.5.0] - 2026-03-22

### 💼 Other

- [117] feat: bump core to v0.3.0 and consolidate status endpoint (#117)
- [117] refactor(openclaw): use resolveOptionalPluginSetting for getPluginKey (#112)

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server-openclaw v0.5.0
## [0.4.1] - 2026-03-22

### 💼 Other

- [113] feat: add host bind and metaUrl config options

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
