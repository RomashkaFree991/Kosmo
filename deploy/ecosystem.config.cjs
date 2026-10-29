// pm2: сервер Kosmo с настройками из /etc/kosmo/kosmo.env
const fs = require('node:fs');
const path = require('node:path');

const envFile = process.env.KOSMO_ENV ?? '/etc/kosmo/kosmo.env';
const env = {};
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

module.exports = {
  apps: [{
    name: 'kosmo',
    cwd: path.join(__dirname, '..', 'server'),
    script: 'src/index.js',
    node_args: '--no-warnings=ExperimentalWarning',
    env: { NODE_ENV: 'production', ...env },
    max_memory_restart: '600M',
    kill_timeout: 5000,
    time: true,
  }],
};
