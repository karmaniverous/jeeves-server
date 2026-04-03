# jeeves-server v3.6.0 Dev Plan Execution

You are executing a dev plan for jeeves-server v3.6.0. The repo is at D:\repos\karmaniverous\jeeves-server (monorepo with packages/service and packages/openclaw).

## HARD RULES

- Never use eslint-disable. Fix the code instead.
- Commit AND push after each phase. No stranded local branches.
- Before EVERY git push: run `gh pr list --head <branch> --repo karmaniverous/jeeves-server --json number,state` to check PR state.
- Set GH_TOKEN before any gh command: `export GH_TOKEN=$(cat J:/config/credentials/github/jgs-jeeves.token | tr -d '\r\n')`
- Run quality gates (lint, typecheck, build, test) before committing. Zero errors AND zero warnings.
- Create a feature branch: `git checkout -b feat/3.6.0-core-alignment`
- 300 LOC hard limit per file. Decompose if exceeded.
- All code in TypeScript. No JS files.
- Do NOT tag or release (Task 23) — stop after Task 22.
- Do NOT run ncu (Task 20) — skip it entirely.
- For Task 9 (substituteEnvVars): check if core v0.5.1 exports it by inspecting `node_modules/@karmaniverous/jeeves/dist/index.d.ts`. If NOT exported, add a `// TODO: replace with core utility when hoisted` comment to the existing server implementation and move on.
- For Task 10 (getPackageVersion): same approach — check the core exports. If exported, adopt it. If not, leave as-is.
- For Task 8 (loadWorkspaceConfig): same approach — check the core exports. If not exported, skip the cleanup escalation wiring and add a TODO comment explaining what needs to happen when core ships it.

## PHASE EXECUTION ORDER

Execute phases sequentially: Phase 1 (tasks 1-6), then Phase 2 (tasks 7-10), then Phase 3 (tasks 11-14), then Phase 4 (tasks 15-19), then Phase 5 (tasks 21-22 only, skip 20 and 23).

After each phase, run quality gates from BOTH package directories:

```
cd packages/service && npm run lint && npm run typecheck && npm run build && npm test
cd packages/openclaw && npm run lint && npm run typecheck && npm run build && npm test
```

Then commit and push.

## THE FULL SPEC

Read the spec file at `J:\domains\projects\jeeves-server\spec.md` — specifically the "Next Version (3.6.x)" section. That section contains the complete implementation details for every task including code examples, file paths, migration strategies, and test criteria.

Begin with Phase 1. Work methodically through each task. Read the existing code before modifying it. When done with all phases, report what was accomplished and any issues encountered.
