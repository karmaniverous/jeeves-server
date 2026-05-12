const {execSync} = require('child_process');
const fs = require('fs');
const path = require('path');
const opts = {cwd: path.join('D:', 'repos', 'karmaniverous', 'jeeves-server'), encoding: 'utf8', stdio: 'pipe'};

execSync('git add -A', opts);

const msg = `chore: switch from auto-changelog to git-cliff

Replace auto-changelog with git-cliff for all three packages (core,
openclaw, service). Each package now has its own cliff.toml with:
- tag_pattern scoped to its prefix (core/, openclaw/, service/)
- include_paths scoped to its package directory
- merge commit filtering (skip Merge pull request / Merge branch)

This fixes the long-standing issue where all three changelogs showed
commits from the entire repo instead of just their own package.

Changes:
- Add cliff.toml to packages/core, packages/openclaw, packages/service
- Add git-cliff as root devDependency, remove auto-changelog from all packages
- Update release-it hooks to use git-cliff instead of auto-changelog
- Update knip configs (auto-changelog -> git-cliff)
- Add changelog script to core package (was missing)
- Regenerate all three CHANGELOGs with properly scoped content`;

fs.writeFileSync(path.join(opts.cwd, '.git-commit-msg'), msg);
execSync('git commit -F .git-commit-msg', opts);
fs.unlinkSync(path.join(opts.cwd, '.git-commit-msg'));
console.log('committed');

// Check PR state
const prCheck = execSync('gh pr list --head chore/git-cliff-changelogs --repo karmaniverous/jeeves-server --json number,state', opts).trim();
console.log('PR check:', prCheck);
