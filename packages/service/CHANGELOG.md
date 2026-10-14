# Changelog

All notable changes to this project will be documented in this file.

## [3.15.0] - 2026-10-14

### 🚀 Features

- *(auth)* Accept the URL key as k as well as key (#279)
- *(share)* Generate share and auth URLs with k (#279)
- *(service)* GET /health liveness endpoint (#259)
- *(core)* TrustProxyHeaders config setting; core 0.4.0
- *(share)* Report isDirectory from /api/share; server_share returns rawUrl for plain and deep file shares, none for directories

### 🐛 Bug Fixes

- *(share)* Share-for depth-0 links carry d (#282)
- *(share)* Authenticate author-written /api/raw/ links in deep shares (#269)
- *(export)* Render with the internal key and never cache a failed render (#295)
- *(export)* Render Mermaid file exports in a temp dir (#281)
- *(release)* GitHub release notes and changelog use the new version tag (#276)
- *(auth)* Build public URLs from publicUrl, not request headers
- *(share)* Bind deep share keys to one path; per-entry keys in listings
- *(auth)* Tighten auth on resolve-path, events and export-cache routes
- *(search)* Filter search results with the content-route scope matcher
- *(oauth)* Validate provider and account names before building credential paths
- *(release)* Match npm-package-template-ts#30 exactly (#276)
- *(config)* Require publicUrl when login flows are configured
- *(oauth)* Allow @ and + in credential provider and account names
- *(sharing)* Issue plain tree keys for share-for directory links without depth
- *(events)* Restrict /api/events to unscoped insiders
- *(release)* Pass the package-prefixed tag to git-cliff
- *(client)* Keep the share query on directory entry routes under a plain outsider share
- *(oauth)* Accept credential names that start with two dots
- *(oauth)* Reject start origins with credentials or a fragment

### 💼 Other

- Updated core

### 🚜 Refactor

- *(sharing)* Build share URLs and deep share contexts through shared helpers
- *(routes)* Share insider, OAuth credential and public-origin guards; name event limits
- *(export)* Name the render-state attribute and values shared by pages and the renderer
- *(oauth)* Split the OAuth API routes into start, credential routes and a credential store

### 📚 Documentation

- K parameter, /status and /health, skill additions (#279, #259, #274)
- Deep share semantics, publicUrl and trustProxyHeaders, route auth
- Point event log readers to /api/events and fix an en dash
- Sync guides, skill, README and endpoint catalog with 3.15.0 behaviour
- Directory shares from the UI are plain; deep directory shares come from the API or plugin
- *(core)* Document ShareResponse.isDirectory; test /api/share isDirectory with and without a trailing slash

### 🎨 Styling

- *(client)* Prettier-format the 3.15.0 client lib files

### 🧪 Testing

- *(docs)* Update the deep-share validation script for k and per-path deep keys
- *(events)* Pin the strict rule for insiders with any scopes configured
- Replace constant-only and weak assertions with behaviour checks

### ⚙️ Miscellaneous Tasks

- Revert package version bumps (releases are done locally)
- *(client)* Regenerate the client lockfile from its manifest
## [3.14.1] - 2026-10-04

### 🐛 Bug Fixes

- *(service)* Enforce insider scopes for session-authenticated requests (#271)
- *(service)* Address review on insider scope enforcement (#271)

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.14.1
## [3.14.0] - 2026-09-29

### 💼 Other

- Updated jeeves-core
- Updated core

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.14.0
## [3.14.0-2] - 2026-09-28

### 💼 Other

- Updated core

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.14.0-2
## [3.14.0-1] - 2026-09-27

### 🐛 Bug Fixes

- Update root package-lock.json in release-it after:bump hook

### 💼 Other

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
- Updated core

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.14.0-1
## [3.14.0-0] - 2026-09-27

### 🐛 Bug Fixes

- Adapt to puppeteer 25, archiver 8, markdown-it 15 and TypeScript 6 majors
- *(build)* Clear vite native-config, chunk-size and rollup outputToFilesystem warnings
- *(release)* Use --github.preRelease for release-it 21
- *(service)* Merge server_config_apply patches into the runtime config file (#265)

### 💼 Other

- Updated core
- Updated core

### ⚙️ Miscellaneous Tasks

- Resolve knip findings and audit advisories (lodash-es override)
- Apply prettier across the repo; ignore generated CHANGELOGs
- Move every package to @karmaniverous/jeeves 0.6.0-4; allow install scripts by name
- Release @karmaniverous/jeeves-server v3.14.0-0
## [3.13.1] - 2026-07-04

### 🐛 Bug Fixes

- SPA auth gate path prefix for share keys

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.13.1
## [3.13.0] - 2026-07-02

### 🚀 Features

- *(#252)* Self-validating signed token, delete magicLinkState
- *(#252)* OTP generation, AES-256-GCM encryption, email template
- *(#252)* Verification page, magicVerify route, sign-in redirect
- *(#253)* Server-side auth gate in SPA fallback handler

### 🐛 Bug Fixes

- *(#241)* Fix zero-byte ZIP export and add tar format for directories
- Address copilot review - returnTo type guard, archive error logging, aria-labels, outsider docs

### 🚜 Refactor

- *(#253)* Remove client-side AuthGate, replace with AuthStatusProvider
- Extract shared page shell (DRY pass - signInPage, verifyPage, pageShell)

### 📚 Documentation

- Sync guides, skill, and API reference with #241 tar format, #252 OTP flow, #253 auth gate

### 🧪 Testing

- Add magicToken + pageShell tests, replace trivial export/verifyPage tests

### ⚙️ Miscellaneous Tasks

- Dependency audit - update minor/patch deps (prettier, eslint, rollup, tailwindcss)
- Release @karmaniverous/jeeves-server v3.13.0
## [3.12.2] - 2026-06-27

### 🐛 Bug Fixes

- Encode URL path segments in resolve-path API response

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.12.2
## [3.12.1] - 2026-06-27

### 🐛 Bug Fixes

- Resolve-path route must use /api/ prefix to match middleware bypass and meta caller

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.12.1
## [3.12.0] - 2026-06-25

### 🚀 Features

- Expose resolve-path API endpoint, add publicUrl to server config (#247)

### 🐛 Bug Fixes

- Prevent overlapping event queue batches, add eventQueue config (#245)
- Make resolve-path endpoint unauthenticated (#247)
- Remove publicUrl from plugin config, make eventQueueConcurrency configurable (#245, #247)
- Address Copilot review — drainLoop error handling, resolve-path 404/400, absolute path validation, stale cursor recovery (#245, #247)

### 💼 Other

- Updated core

### 🚜 Refactor

- Extract resolveEventPaths helper, add skipAuth to ApiToolConfig (#245, #247)

### 📚 Documentation

- Update guides for eventQueue, eventQueueConcurrency, publicUrl, server_resolve_path (#244, #245, #246, #247)
- Sync skill, guides, and config reference with touched code (#244, #245, #246, #247)

### 🧪 Testing

- Replace trivial eventQueue tests, add resolve-path and config path resolution coverage (#244, #245, #247)

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.12.0
## [3.11.4] - 2026-06-19

### 🐛 Bug Fixes

- Include guides/ in package files (fixes /readme 404)

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.11.4
## [3.11.3] - 2026-06-19

### 🚀 Features

- Dynamic favicon from config

### 🐛 Bug Fixes

- Restore accidentally deleted types in types.ts
- Use correct versions for updated dependencies

### 💼 Other

- Lintfix

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.11.3
## [3.11.2] - 2026-06-16

### 🚀 Features

- Unified code block toolbar with word-wrap toggle and copy button

### 📚 Documentation

- Update README, user guide, and spec for unified code block toolbar

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.11.2
## [3.11.1] - 2026-06-15

### 🐛 Bug Fixes

- SPA sign-in, public content routes, magic link, URL encoding, dark mode
- Address Copilot review — XSS, open redirect, async I/O, React anti-patterns
- Resolve lint warnings — tsdoc escaping, restore eslint-disable, setState anti-pattern

### 💼 Other

- Updated core

### 🚜 Refactor

- Replace all FastifyPluginAsync eslint-disables with FastifyPluginCallback

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.11.1
## [3.11.0] - 2026-06-14

### 🚀 Features

- Expand config schema for magic link auth and instance branding
- Surface branding in /status, redact emailAuth in /config
- Add branding context and wire into App and Header
- Add mailer service for magic link auth (nodemailer + handlebars)
- Magic link backend routes + token state + transport init
- Redesign sign-in page with email magic link form and branding support

### 🐛 Bug Fixes

- Address Copilot PR review comments on magic-link-branding
- Resolve lint errors (prettier, deprecated z.email, unnecessary optionals, async mocks)
- Only show auth buttons for fully configured modes (getEffectiveAuthModes)

### 💼 Other

- Updated core

### 🚜 Refactor

- SOLID/DRY pass - generic TTL map, DEFAULT_BRANDING, setSessionCookie, renderErrorPage, export DEFAULT_TEMPLATE

### 📚 Documentation

- Update guides, README, and skill for magic link auth and branding
- Fix stale auth references in setup, SKILL, and api-integration guides

### 🧪 Testing

- Add ttlStateMap, errorPage tests; improve email tests with mock transport

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.11.0
## [3.10.15] - 2026-06-13

### 🚀 Features

- Add logging.level and logging.file config support (#213)
- Auth-gated SPA fallback with branded sign-in page (#214)

### 🐛 Bug Fixes

- Show edit button on rendered tab for insiders (#211)
- Address Copilot review and CI smoke test failures

### 💼 Other

- Updated core

### 🚜 Refactor

- DRY deep-share param extraction, remove redundant nullish coalescing

### 📚 Documentation

- Sync README, guides, and core exports with touched code
- Sync SKILL.md and api-integration guide with touched code

### 🧪 Testing

- Add tests for extractDeepParams and sanitizeReturnTo, consolidate signInPage tests

### ⚙️ Miscellaneous Tasks

- Add zod direct dependency, remove stale package-directory
- Release @karmaniverous/jeeves-server v3.10.15
## [3.10.14] - 2026-06-11

### 💼 Other

- Updated deps

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.10.14
## [3.10.13] - 2026-05-30

### 🐛 Bug Fixes

- Add content/ to service package files field
- Background-cache service health checks in /status (#177)
- Scope refresh timer and add error handling per review

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.10.13
## [3.10.12] - 2026-05-29

### 🐛 Bug Fixes

- Thread auth key through Puppeteer export for raw image resolution (#220)
- Restrict auth key interception to local origin

### 💼 Other

- Merge remote-tracking branch 'origin/bugfix/220-raw-image-export-auth' into chore/ncu-update-and-hoist-144
- Updated core

### 🚜 Refactor

- Use substituteEnvVars from @karmaniverous/jeeves core (#144)

### ⚙️ Miscellaneous Tasks

- Update dependencies via ncu --peer
- Release @karmaniverous/jeeves-server v3.10.12
## [3.10.11] - 2026-05-28

### 🐛 Bug Fixes

- Strip fragment from href before resolving deep share link target path
- Use strict undefined check for empty fragment preservation

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.10.11
## [3.10.10] - 2026-05-16

### 🐛 Bug Fixes

- Pin jeeves-server-core dependency to ^0.1.2

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.10.10
## [3.10.9] - 2026-05-13

### 🚀 Features

- Export config Zod schema via core package (#204)

### 🐛 Bug Fixes

- Resolve lint errors in export ordering and stale disable directive
- Remove unused zod dependency from service package

### ⚙️ Miscellaneous Tasks

- Bump @karmaniverous/jeeves to ^0.5.10
- Apply safe dependency updates
- Fix knip configuration hints
- Update all deps and migrate core/service to rollup+ts builds
- Merge main into branch, resolve package.json conflicts
- Release @karmaniverous/jeeves-server v3.10.9
## [3.10.8] - 2026-05-12

### 🐛 Bug Fixes

- Include scripts/ in service package files for postinstall

### 💼 Other

- Merge remote-tracking branch 'origin/main' into chore/git-cliff-changelogs

# Conflicts:
#	packages/service/package.json

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.10.8
## [3.10.7] - 2026-05-12

### 🐛 Bug Fixes

- Edit-cell line offset — resolve td/th to table, not tr

### ⚙️ Miscellaneous Tasks

- Add npm publish safety net (.npmignore + gitignore *.local)
- Add files whitelists and npm-pack-check CI workflow
- Switch from auto-changelog to git-cliff
- Release @karmaniverous/jeeves-server v3.10.7
## [3.10.6] - 2026-05-03

### 💼 Other

- Updated jeeves-core

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.10.6
## [3.10.5] - 2026-04-26

### 🐛 Bug Fixes

- Mobile checkbox interaction — use removeAttribute + event delegation
- Resolve lint errors in MarkdownView scroll preservation
- Use scroll listener for scroll preservation per review

### 🚜 Refactor

- Move enableCheckboxes to useLayoutEffect per review

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.10.5
## [3.10.4] - 2026-04-22

### 🚀 Features

- Create shared package, add missing plugin tools, DRY types (#194)

### 🐛 Bug Fixes

- Resolve pre-existing knip failures
- Upgrade client eslint to v10, fix lint errors from stricter rules

### 🚜 Refactor

- Rename shared package to @karmaniverous/jeeves-server-core

### 📚 Documentation

- Sync all documentation with current implementation

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.10.4
## [3.10.3] - 2026-04-22

### 🚀 Features

- Add copy button to table cell hover controls (#188)

### 🐛 Bug Fixes

- Add /api prefix to OAuth API routes (#190)
- Guard navigator.clipboard before writeText calls
- Resolve state.json from state root instead of package directory (#185)
- Use path.dirname/basename for state dir resolution
- Remove state.json and dead keyRotatedAt code (#192)

### 💼 Other

- Updated jeeves core

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.10.3
## [3.10.2] - 2026-04-21

### 🐛 Bug Fixes

- Store insider seeds in config.json instead of state.json (#185)

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.10.2
## [3.10.1] - 2026-04-21

### 🐛 Bug Fixes

- Authenticate embedded images for all outsider shares (#183)

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.10.1
## [3.10.0] - 2026-04-21

### 🚀 Features

- /go/:slug shortlink redirects (#180)

### 🐛 Bug Fixes

- Resolve serverRoot via package.json discovery (#178)

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.10.0
## [3.9.0] - 2026-04-20

### 🚀 Features

- Markdown-it migration, block editing, OAuth2 flow (#162, #163)
- Cell edit popup textarea
- Block type label in edit popup
- Client-side undo/redo stack

### 🐛 Bug Fixes

- Resolve remaining React lint errors
- Resolve all pre-existing eslint errors
- Address Gemini review — undo correctness, reactivity, DRY, cleanup
- Preserve source mapping on diagrams and HTML blocks for block editing ([#167](https://github.com/karmaniverous/jeeves-server/pull/167))
- Constrain edit popup height to prevent overflow (#168)
- Address Gemini review — remove redundant variable, handle indented HTML blocks (#168)
- Resolve built client dir when running under tsx (#170)
- Address Gemini review — env vars, path-based detection, cross-platform docs (#170)
- Exclude dist/src from source-mode detection to fix CI smoke tests (#170)
- Add line wrapping and contained positioning to popup CodeEditor (#172)
- Unify cell/block editor, pure flex height chain, SOLID/DRY cleanup (#172)
- Ctrl+Enter save keybinding — use Prec.highest to override basicSetup (#175)
- Move undo/redo to header, preserve scroll on save (#174, #176)
- Move undo/redo to document toolbar next to width buttons (#174)

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.9.0
## [3.8.5] - 2026-04-15

### 💼 Other

- Updated jeeves-core

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.8.5
## [3.8.4] - 2026-04-14

### 🐛 Bug Fixes

- Prettier formatting in toggleCheckbox route
- Make clear-cache visible to outsiders in download menu
- Move DownloadDropdown outside isInsider gate in DirectoryRow

### 💼 Other

- Lintfix

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.8.4
## [3.8.3] - 2026-04-11

### 🐛 Bug Fixes

- Checkbox click handler — use native capture-phase delegation via ref callback, fix mtime stale-write flow

### 💼 Other

- Fix

### 🚜 Refactor

- Simplify checkbox toggle to fire-and-forget (no mtime, no conflict)

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.8.3
## [3.8.2] - 2026-04-11

### 🐛 Bug Fixes

- Use descendant selector for checkbox indexing (li > input -> li input)

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.8.2
## [3.8.1] - 2026-04-11

### 🐛 Bug Fixes

- Checkbox toggle click handling for dangerouslySetInnerHTML

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.8.1
## [3.8.0] - 2026-04-11

### 🚀 Features

- Add checkbox indexing and mtime to markdown pipeline (#154)
- Add POST /api/file/*/toggle-checkbox endpoint (#154)
- Wire MarkdownView checkbox toggling (#154)

### 🐛 Bug Fixes

- Correct /events route path to /api/events (#156)
- Address Gemini review — URL boundary, checkbox regex, Cheerio, race condition
- Toggle-checkbox route wildcard position (CI fix)

### 🚜 Refactor

- SOLID/DRY pass across v3.7.0 changes

### 📚 Documentation

- Sync documentation with v3.7.0 implementation

### 🎨 Styling

- Fix prettier formatting in markdown tests

### 🧪 Testing

- Improve coverage and remove trivial tests

### ⚙️ Miscellaneous Tasks

- Bump versions (service 3.7.0, openclaw 0.8.0)
- Release @karmaniverous/jeeves-server v3.8.0
## [3.6.5] - 2026-04-08

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.6.5
## [3.6.4] - 2026-04-05

### 💼 Other

- Unhoisted jeeves

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.6.4
## [3.6.3] - 2026-04-05

### 💼 Other

- Hoisted jeeves

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.6.3
## [3.6.2] - 2026-04-05

### 🐛 Bug Fixes

- Consume core importMetaUrl for plugin install (#150)

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.6.2
## [3.6.1] - 2026-04-05

### ⚙️ Miscellaneous Tasks

- Update @karmaniverous/jeeves to ^0.5.3 and bump minor/patch deps
- Update @types/node to ^25.5.2
- Update @karmaniverous/jsonmap ^0.3.1 → ^2.1.1
- Release @karmaniverous/jeeves-server v3.6.1
## [3.6.0] - 2026-04-03

### 🚀 Features

- Phase 1 — core service adoption (getServiceUrl, getBindAddress, Node 22 fast-fail)
- Phase 2 — core v0.5.1 wiring (cleanup escalation, getPackageVersion, substituteEnvVars TODO)
- Phase 3 — UX improvements (CSV tables, directory item counts, collapsible frontmatter, collapsible TOC)

### 🚜 Refactor

- Address code review — async directory reads, CSV row normalization, extract mapDirectoryEntry
- Split TocSection.tsx — move utilities to tocUtils.ts (fixes react-refresh lint)

### 📚 Documentation

- Phase 4 — documentation updates for v3.6.0
- Fix Node version in deployment guide (20 → 22)

### 🧪 Testing

- Add missing test coverage for v3.6.0 features

### ⚙️ Miscellaneous Tasks

- Phase 5 — quality gates clean (knip fixes, remove package-directory dep)
- Remove TASK.md build artifact, DRY up Node version check and fix minor issues
- Release @karmaniverous/jeeves-server v3.6.0
## [3.5.2] - 2026-03-31

### ⚙️ Miscellaneous Tasks

- Bump core to v0.4.6 (init before run) + fix knip issues
- Bump core to v0.4.6 (init before run) + fix knip issues
- Release @karmaniverous/jeeves-server v3.5.2
## [3.5.1] - 2026-03-30

### 🚀 Features

- Integrate descriptor.run from core v0.4.5

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.5.1
## [3.5.0] - 2026-03-30

### 🚀 Features

- Replace cosmiconfig with direct JSON config loading
- Use getBindAddress from core, replace localhost with 127.0.0.1
- Define JeevesComponentDescriptor for server component
- Add GET /api/events endpoint for event log queries
- Add POST /config/apply endpoint using createConfigApplyHandler

### 🐛 Bug Fixes

- Use static bind default, bump openclaw core dep, remove local stub
- Decode HTML entities in TOC heading text (#102)
- Show user-friendly search error messages (#98)
- Encode browse path segments in API calls, add SPA catch-all (#50, #127)
- Resolve lint errors from core v0.4.4 migration
- Resolve startCommand path absolutely for CI compatibility
- Align config validate test assertion with core SDK output

### 🚜 Refactor

- Replace hand-rolled package.json walk with packageDirectorySync (#96)
- Migrate GET /status to createStatusHandler factory
- Migrate openclaw plugin to core v0.4.4 SDK
- Replace hand-rolled CLI with createServiceCli(descriptor) (#106)
- SOLID/DRY cleanup

### 📚 Documentation

- Sync documentation with SDK adoption changes
- Add title front matter to all guides

### 🧪 Testing

- Add tests for diagramExport and sharing helpers

### ⚙️ Miscellaneous Tasks

- Bump @karmaniverous/jeeves to ^0.4.3, remove cosmiconfig dep
- Update deps (peer-safe)
- Release @karmaniverous/jeeves-server v3.5.0
## [3.4.2] - 2026-03-25

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.4.2
## [3.4.1] - 2026-03-23

### 🐛 Bug Fixes

- Runner proxy routes call /status instead of /stats and /health (#120)
- Runner proxy routes call /status instead of /stats and /health (#120)

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.4.1
## [3.4.0] - 2026-03-22

### 🚀 Features

- Bump core to v0.3.0 and consolidate status endpoint (#117)

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.4.0
## [3.3.1] - 2026-03-22

### 🚀 Features

- Add host bind and metaUrl config options

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.3.1
## [3.3.0] - 2026-03-21

### 🚀 Features

- Core v0.2.0 SDK adoption (#111) ([#111](https://github.com/karmaniverous/jeeves-server/pull/111))

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.3.0
## [3.2.1] - 2026-03-19

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.2.1
## [3.2.0] - 2026-03-18

### 🐛 Bug Fixes

- Add tagPrefix to auto-changelog config for monorepo tags

### 📚 Documentation

- Full documentation pass with PlantUML diagrams
- Fix diagram image paths in guides

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.2.0
## [3.1.3] - 2026-03-11

### 🚀 Features

- Explicit scope overrides take precedence over named scopes

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.1.3
## [3.1.2] - 2026-03-11

### 🐛 Bug Fixes

- Parse inline tokens in heading renderer (code spans, bold, italic)

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.1.2
## [3.1.1] - 2026-03-09

### 🐛 Bug Fixes

- Rendered tab persists when switching to Raw on watcher-rendered files
- Rendered tab persists when switching to Raw on watcher-rendered files
- Prevent full data reload on tab switch (only reload on path change)

### 💼 Other

- Revert "fix: Rendered tab persists when switching to Raw on watcher-rendered files"

This reverts commit 572cec8bc999df7e834fa66ff948747f2d35be32.

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.1.1
## [3.1.0] - 2026-03-09

### 🚀 Features

- Extend /api/status with ?events=N for recent event log (#89)
- Render text/number facets as text inputs, chips for select/multiselect
- Schema-driven facet rendering by uiHint
- Two-step facet selection + garbage value filtering
- Garbage value diagnostics for inference rule debugging
- Metadata chips on search results with click-to-filter
- Search facets, metadata chips, and click-to-filter

### 🐛 Bug Fixes

- Cap schema-driven facet chips to fields with ≤30 values
- Use type=number input for number facets
- Increase facets timeout to 15s, add error logging
- Restore eager facet loading on modal open
- Text/number facets skip value cleaning, cast values to String
- Restore light mode text-foreground on Add Filter menu labels
- Make +N more chip overflow a clickable link that expands the result
- Close SearchableSelect dropdown on outside click (capture phase)

### 🚜 Refactor

- Remove hardcoded filters, fix lazy facet loading

### 📚 Documentation

- Document ?events=N query param on /api/status

### ⚡ Performance

- Lazy-load facets only when 'Add filter' is clicked

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.1.0
## [3.0.1] - 2026-03-08

### 💼 Other

- Updated docs

### 📚 Documentation

- Refresh README and guides for v3 CLI + config
- Add typedoc config and dependencies
- Add changelogs as children of package guide indexes
- Add guide index content and fix typedoc trailing comma

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.0.1
## [3.0.0] - 2026-03-08

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.0.0
## [3.0.0-1] - 2026-03-08

### 🚀 Features

- Named access scopes (#84) ([#84](https://github.com/karmaniverous/jeeves-server/pull/84))

### 🐛 Bug Fixes

- Make resetConfig reload runtime config
- Plugin auth chain, status endpoint improvements (#83) ([#83](https://github.com/karmaniverous/jeeves-server/pull/83))
- Normalize path for watcher render (Windows backslash + uppercase drive)
- Resolve remaining lint errors (type annotations, unused params, unnecessary conditionals)

### 💼 Other

- Lintfix

### ⚙️ Miscellaneous Tasks

- Add knip configs, remove dead exports, clean all code quality checks
- Release @karmaniverous/jeeves-server v3.0.0-1
## [3.0.0-0] - 2026-03-08

### 🚀 Features

- Migrate config from jiti/TS to cosmiconfig/JSON
- Add CLI commands (start, config validate/show, service)
- Add GET /api/status endpoint
- Internalize diagram dependencies (mermaid/plantuml)
- Add GET /api/link-info endpoint
- Add scroll anchoring for async diagram renders
- Add GET /api/search/facets proxy endpoint
- Schema-driven search facet filters (Step 10)
- Document rendering pipeline (Phase 4, Steps 16-18)

### 🐛 Bug Fixes

- Set rootDir and update start script path for monorepo layout
- Adjust rootDir depth for monorepo dist/src/config path
- Adjust relative paths for monorepo dist/src/ layout
- Cosmiconfig searchPlaces, SOLID/DRY pass, test coverage
- Resolve package.json path portably for version
- Remove unused parameter in linkInfo test
- Add missing return-await in facets handler
- Address Gemini code review feedback across PRs #65-#76
- Address all gap analysis findings
- Force white background in panzoom fullscreen (dark mode)
- Resolve all client ESLint errors and warnings
- Resolve knip unused files, dependencies, and exports
- CI failures and SvgViewer panzoom re-init bug
- CI rimraf resolution and remove redundant client steps

### 💼 Other

- Incorporate main (PR #77 gap-analysis)
- Publishconfig public access

### 🚜 Refactor

- Monorepo scaffolding (Phase 1, Step 1)
- Extract buildRuntimeConfig to resolve.ts (DRY)
- Extract shared renderMarkdownContent pipeline

### 🧪 Testing

- Add resolve.ts unit tests (21 tests)

### ⚙️ Miscellaneous Tasks

- SOLID/DRY/test coverage pass
- Migrate default port to 1934
- Add tsdoc.json to both package roots
- Add tsdoc.json to both package roots
- Make both packages releasable
- Add client as workspace member, align puppeteer versions
- Release @karmaniverous/jeeves-server v3.0.0-0
