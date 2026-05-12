# Changelog

All notable changes to this project will be documented in this file.

## [unreleased]

### 🐛 Bug Fixes

- Edit-cell line offset — resolve td/th to table, not tr

### ⚙️ Miscellaneous Tasks

- Add npm publish safety net (.npmignore + gitignore *.local)
- Add files whitelists and npm-pack-check CI workflow
- Switch from auto-changelog to git-cliff
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

- Make clear-cache visible to outsiders in download menu
- Move DownloadDropdown outside isInsider gate in DirectoryRow

### 💼 Other

- [V3-7] fix: prettier formatting in toggleCheckbox route

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
- Lintfix

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.8.4
## [3.8.3] - 2026-04-11

### 💼 Other

- [V3-7] fix: checkbox click handler — use native capture-phase delegation via ref callback, fix mtime stale-write flow
- [V3-7] refactor: simplify checkbox toggle to fire-and-forget (no mtime, no conflict)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
- Fix

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.8.3
## [3.8.2] - 2026-04-11

### 💼 Other

- [V3-7] fix: use descendant selector for checkbox indexing (li > input -> li input)

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.8.2
## [3.8.1] - 2026-04-11

### 💼 Other

- [V3-7] fix: checkbox toggle click handling for dangerouslySetInnerHTML

With dangerouslySetInnerHTML, the browser toggles native checkboxes before
the React click handler fires. Read input.checked directly (already the
desired new state) instead of inverting it. Replace preventDefault with
stopPropagation to allow the visual toggle while preventing parent
navigation.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.8.1
## [3.8.0] - 2026-04-11

### 💼 Other

- [V3-7] fix: correct /events route path to /api/events (#156)

The events route was registered as '/events' instead of '/api/events',
causing 404 responses. Fixed the path and added tests.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
- [V3-7] feat: add checkbox indexing and mtime to markdown pipeline (#154)

Assign sequential data-checkbox-index to each GFM task-list checkbox
in rendered HTML. Include file mtime in markdown API responses so the
client can send it with toggle-checkbox requests for stale-write
protection.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
- [V3-7] feat: add POST /api/file/*/toggle-checkbox endpoint (#154)

Insider-only endpoint to flip a single GFM task-list checkbox in a
markdown source file. Uses mtime-based stale-write protection (409 on
conflict). Includes tests for happy path, stale-write, outsider
rejection, and out-of-range index.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
- [V3-7] feat: wire MarkdownView checkbox toggling (#154)

Enable interactive checkboxes for insiders in rendered markdown.
POST toggle-checkbox on click with data-checkbox-index, checked
state, and mtime. Update mtime on success, re-fetch on 409 conflict.
Disable checkboxes and show loading state during flight.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
- [V3-7] chore: bump versions (service 3.7.0, openclaw 0.8.0)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
- [V3-7] style: fix prettier formatting in markdown tests

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

### 💼 Other

- [150] fix: consume core importMetaUrl for plugin install (#150)

Fixes #150. Also closes #147.

- Bump @karmaniverous/jeeves to ^0.5.4 in both packages
- Replace distDir with importMetaUrl in plugin CLI
- Remove unused node:path and node:url imports from cli.ts

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.6.2
## [3.6.1] - 2026-04-05

### ⚙️ Miscellaneous Tasks

- Update @karmaniverous/jeeves to ^0.5.3 and bump minor/patch deps
- Update @types/node to ^25.5.2
- Update @karmaniverous/jsonmap ^0.3.1 → ^2.1.1
- Release @karmaniverous/jeeves-server v3.6.1
## [3.6.0] - 2026-04-03

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
- [360] feat: Phase 3 — UX improvements (CSV tables, directory item counts, collapsible frontmatter, collapsible TOC)

- Add CSV rendered table view with RFC 4180 parser and HTML table rendering
- Add Rendered/Raw tab support for .csv files in FileContentView
- Add .csv-table styles matching prose typography
- Add directory item counts (nonrecursive) in Size column for directory rows
- Add collapsible large frontmatter (>10 lines collapsed by default with toggle)
- Add collapsible TOC sections with chevron toggles and auto-expand on scroll
- Add TocSection component with buildTocTree() and findAncestorSlugs() utilities
- Add 12 unit tests for CSV parsing (quoted fields, escaped quotes, empty fields, etc.)

Closes #48, #49, #115, #116
- [360] docs: Phase 4 — documentation updates for v3.6.0

- Update SKILL.md: Node 22+, CSV rendering, directory counts, collapsible features, core service discovery
- Update setup guide: remove deprecated config properties, add core service discovery guidance
- Update README: Node 22+, add CSV and collapsible features to highlights
- Review promptInjection.ts: no changes needed (status shape unchanged)
- [360] chore: Phase 5 — quality gates clean (knip fixes, remove package-directory dep)

- Remove unused package-directory dependency (replaced by core getPackageVersion)
- Add start-server.ts as knip entry point
- All quality gates pass: lint, typecheck, knip, build, test (165 tests)
- [360] chore: remove TASK.md build artifact, DRY up Node version check and fix minor issues
- [360] test: add missing test coverage for v3.6.0 features

- Deprecated config property migration (loadConfig.test.ts)
- Collapsible frontmatter threshold logic (markdown.test.ts)
- Export URL 0.0.0.0 → 127.0.0.1 fallback (export.test.ts)
- Directory itemCount mapping (directory.test.ts)
- CSV table css-table class + large CSV (csv.test.ts)
- Runner proxy URL resolution (runner.test.ts)
- Search watcher URL resolution (search.test.ts)
- [360] refactor: address code review — async directory reads, CSV row normalization, extract mapDirectoryEntry
- [360] docs: fix Node version in deployment guide (20 → 22)
- [360] refactor: split TocSection.tsx — move utilities to tocUtils.ts (fixes react-refresh lint)

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.6.0
## [3.5.2] - 2026-03-31

### 💼 Other

- [53] chore: bump core to v0.4.6 (init before run) + fix knip issues
- [53] chore: bump core to v0.4.6 (init before run) + fix knip issues

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.5.2
## [3.5.1] - 2026-03-30

### 💼 Other

- [51] feat: integrate descriptor.run from core v0.4.5

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.5.1
## [3.5.0] - 2026-03-30

### 🐛 Bug Fixes

- Align config validate test assertion with core SDK output

### 💼 Other

- [35] chore: bump @karmaniverous/jeeves to ^0.4.3, remove cosmiconfig dep

Bump the core jeeves dependency in packages/service from ^0.3.0 to ^0.4.3
and remove the cosmiconfig dependency (no longer needed after config loading
is switched to direct JSON reads in the next commit).

Note: openclaw dep bump deferred to S4/S5 as it requires API migration.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
- [35] feat: replace cosmiconfig with direct JSON config loading

Replace cosmiconfig-based config loading with direct JSON file reads.
Add config path migration logic that automatically moves old-style
jeeves-server.config.json to new jeeves-server/config.json convention.
Make loadConfig/initConfig/resetConfig synchronous since all I/O is now
sync fs operations.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
- [35] feat: use getBindAddress from core, replace localhost with 127.0.0.1

Import SERVER_PORT and getBindAddress from @karmaniverous/jeeves for
schema defaults instead of hardcoded values. Replace 'localhost' with
'127.0.0.1' in URL constructions (export route, path redirect) to
avoid DNS resolution ambiguity.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
- [35] fix: use static bind default, bump openclaw core dep, remove local stub
- [35] fix: decode HTML entities in TOC heading text (#102)

The TOC sidebar displayed raw HTML entities like &quot; and &#39; because
heading text was only stripped of HTML tags, not decoded. Now uses cheerio
to properly extract text content with entity decoding.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
- [35] fix: show user-friendly search error messages (#98)

Parse watcher error responses and display contextual messages instead of
raw JSON error strings in the search modal.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
- [35] fix: encode browse path segments in API calls, add SPA catch-all (#50, #127)

Client API functions now properly encode each path segment with
encodeURIComponent, fixing issues with dotfile directories and paths
containing special characters. Also added a setNotFoundHandler SPA
fallback to catch edge cases where wildcard routes miss certain paths
(e.g. dot-prefixed segments on Linux).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
- [35] refactor: replace hand-rolled package.json walk with packageDirectorySync (#96)

Replaced the manual directory walk in packageVersion.ts with
packageDirectorySync from the package-directory npm package. Added
package-directory as a direct dependency of the service package.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
- [35] feat: define JeevesComponentDescriptor for server component

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
- [35] refactor: migrate GET /status to createStatusHandler factory

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
- [35] feat: add GET /api/events endpoint for event log queries

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
- [35] feat: add POST /config/apply endpoint using createConfigApplyHandler

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
- [35] refactor: migrate openclaw plugin to core v0.4.4 SDK

Remove hand-rolled serviceCommands/pluginRemove in favor of core's
createServiceManager and createPluginCli. Rewrite cli.ts to delegate
to createPluginCli factory. Update index.ts to construct a full
JeevesComponentDescriptor for createComponentWriter.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
- [35] fix: resolve lint errors from core v0.4.4 migration
- [35] chore: update deps (peer-safe)
- [35] refactor: replace hand-rolled CLI with createServiceCli(descriptor) (#106)
- [35] refactor: SOLID/DRY cleanup
- [35] test: add tests for diagramExport and sharing helpers
- [35] docs: sync documentation with SDK adoption changes
- [35] fix: resolve startCommand path absolutely for CI compatibility
- [35] docs: add title front matter to all guides

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.5.0
## [3.4.2] - 2026-03-25

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.4.2
## [3.4.1] - 2026-03-23

### 💼 Other

- [120] fix: runner proxy routes call /status instead of /stats and /health (#120)
- [120] fix: runner proxy routes call /status instead of /stats and /health (#120)

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.4.1
## [3.4.0] - 2026-03-22

### 💼 Other

- [117] feat: bump core to v0.3.0 and consolidate status endpoint (#117)

### ⚙️ Miscellaneous Tasks

- Release @karmaniverous/jeeves-server v3.4.0
## [3.3.1] - 2026-03-22

### 💼 Other

- [113] feat: add host bind and metaUrl config options

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
