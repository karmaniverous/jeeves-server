const {execSync} = require('child_process');
const path = require('path');
const opts = {cwd: path.join('D:', 'repos', 'karmaniverous', 'jeeves-server'), encoding: 'utf8', stdio: 'pipe'};
execSync('git add -A', opts);
execSync('git commit --amend --no-edit', opts);
console.log('amended');
