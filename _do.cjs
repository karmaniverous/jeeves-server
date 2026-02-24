const { execSync } = require('child_process');
const fs = require('fs');
const cwd = 'E:\\dev\\karmaniverous\\jeeves-server';
const run = (cmd) => { console.log(`> ${cmd}`); return execSync(cmd, { cwd, stdio: 'inherit' }); };
const token = fs.readFileSync('D:\\.jeeves-config\\credentials\\github\\jgs-jeeves.token').toString('utf16le').replace(/\0/g, '').trim();
const env = { ...process.env, GH_TOKEN: token };
const runGh = (cmd) => { console.log(`> ${cmd}`); return execSync(cmd, { cwd, env, encoding: 'utf8' }); };

// Commit & push
run('git checkout main');
run('git add -A');
run('git commit -m "fix: dark mode status pills via custom-variant"');
run('git push origin main');

// Bump patch
run('npm version patch --no-git-tag-version');
const pkg = JSON.parse(fs.readFileSync(cwd + '\\package.json', 'utf8'));
const ver = `v${pkg.version}`;
console.log(`Version: ${ver}`);
run('git add -A');
run(`git commit -m "chore: release ${ver}"`);
run(`git tag ${ver}`);
run('git push origin main --tags');

// GitHub release
console.log(runGh(`gh release create ${ver} --title "${ver}" --notes "fix: dark mode status pills on runner dashboard"`));
