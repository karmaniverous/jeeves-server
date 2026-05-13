const {execSync} = require('child_process');
const path = require('path');
const opts = {cwd: path.join('D:', 'repos', 'karmaniverous', 'jeeves-server'), encoding: 'utf8', stdio: 'pipe'};
execSync('git add -A', opts);
execSync('git commit -m "chore: remove stale temp scripts"', opts);
console.log('done');
