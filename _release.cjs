const { execSync } = require('child_process');
const cwd = 'E:\\dev\\karmaniverous\\jeeves-server';
const run = (cmd) => execSync(cmd, { cwd, stdio: 'inherit' });
run('git add -A');
run('git commit -m "chore: release v2.9.0"');
run('git tag v2.9.0');
run('git push origin main --tags');
