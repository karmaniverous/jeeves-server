# AGENTS.md

Standing rules for every agent (human or AI) working in this repository. They apply to every task of the jeeves-server 3.16.0 release (branch `feature/3-16-0`, one PR) and stay until replaced. [CONTRIBUTING.md](CONTRIBUTING.md) covers setup and conventions; these rules sit on top of it.

## Source of truth

- The product spec on the Jeeves server (`spec/` of the jeeves-server project: `index.md`, the Current Version documents and the `next-*.md` Next Version design) is the source of truth. Its Dev Plan says which task you are doing; do only that task.
- Owner decisions in the spec are fixed. Never reverse one in code. Don't edit the spec from a PR. If the code contradicts the spec, or a decision looks wrong, stop and report it.
- Build only on released `@karmaniverous/jeeves`. If a design detail needs a jeeves change, stop and report it.

## Gates (before every push)

Every gate must pass with **zero errors and zero warnings**, at the repo root **and** from each package you touched (`packages/core`, `packages/service`, `packages/openclaw`, `packages/service/client`):

```bash
npm run build
npm run typecheck
npm run lint
npm test
npm run knip
npm run docs        # repo root only
```

- CI must be green on the pushed head.
- **Never** add `eslint-disable`, `@ts-ignore`/`@ts-expect-error`, lint `ignores`, or turn a lint, typecheck, knip or coverage rule off, for tests too. Fix the code. The single exception is test-only: one line may carry `eslint-disable-next-line <rule> -- <why>` when the test genuinely can't be written another way, and every such line is listed in the PR description.
- No test is skipped silently: a skip is explicit in code (`it.skipIf(...)` with a comment giving the reason) and named in the PR description.

## Tests and design

- Every behaviour change ships with tests that fail without it. No trivial tests (asserting a constant, a mock or a type).
- Starting from the code you touched: review the diff for SOLID and DRY (one responsibility per module, shared logic in one place, files under 300 lines), check coverage of every touched file (it must not fall) and run a mutation check on new logic (break it, see a test fail, restore).
- Schema-first: Zod schemas are the source of truth, types come from `z.infer<>`.
- New dependencies at their latest version; list them in the PR description.

## Wire baseline

- `packages/service/src/test/wire/wire-baseline.json` records what the branch base (3.15.0 plus #310, #312, #313) sends for every route. **Never edit it.** A reply that changes is either listed in `packages/service/src/test/wire/departures.ts` (with what the base sent and the decision that allows it) or a regression to fix.

## Docs

- Keep READMEs, guides (`packages/*/guides/`), `CONTRIBUTING.md` and the published skill in sync with the code in the same task, in the repo's own pattern.
- Never edit a `CHANGELOG.md`: release-it regenerates it.

## Git and PRs

- Conventional Commits. Commit in logical steps and **push after every commit**.
- Immediately before **every** push: `gh pr list --head feature/3-16-0 --repo karmaniverous/jeeves-server --state all --json number,state`. Push only if there is no PR or the newest one is `OPEN`; if it is `MERGED` or `CLOSED`, stop and report.
- **No version bumps**: never change a package's `version` or the ranges between workspace packages, and never change release configuration beyond what the task asks. Releases, merges, tags and publishing are the owner's.
- GitHub writes use the bot identity only (`gh api user --jq .login` before any write).
