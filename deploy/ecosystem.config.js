'use strict';
// pm2 process list for every Afra product on the Hostinger VPS. Written 13 Nov 2026, not yet run by a person.
// Rules (docs/HOSTING_PLAN.md, D-17): exactly ONE copy of each product backend (their timers send messages, so two copies
// would double-send), every app listens on 127.0.0.1 only, and every secret lives in /etc/afra/<product>.env (mode 600,
// never in git). Node 22 reads that file itself (--env-file), so nothing secret is written in this file.
// Code is run from /srv/afra/current, a symlink that deploy.sh flips to the newest release after its checks pass.
const BASE = process.env.AFRA_BASE || '/srv/afra';
const app = (name, dir, port, envName) => ({
  name,
  cwd: `${BASE}/current/${dir}`,
  script: 'server.js',
  interpreter: 'node',
  node_args: [`--env-file=/etc/afra/${envName}.env`],
  exec_mode: 'fork', // never 'cluster': one copy only
  instances: 1,
  autorestart: true,
  restart_delay: 3000,
  max_restarts: 10,
  min_uptime: '20s',
  max_memory_restart: '400M',
  time: true,
  merge_logs: true,
  out_file: `/var/log/afra/${name}.out.log`,
  error_file: `/var/log/afra/${name}.err.log`,
  // PORT is fixed here, not left to the code default: the admin app's code default (5010) clashes with Cloth's (5010).
  env: { NODE_ENV: 'production', PORT: String(port) },
});
module.exports = {
  apps: [
    app('gym', 'server', 5000, 'gym'),
    app('hire', 'apps/hire', 5006, 'hire'),
    app('salon', 'apps/salon', 5007, 'salon'),
    app('mart', 'apps/mart', 5008, 'mart'),
    app('dine', 'apps/dine', 5009, 'dine'),
    app('cloth', 'apps/cloth', 5010, 'cloth'),
    app('wash', 'apps/wash', 5011, 'wash'),
    app('admin', 'apps/admin', 5012, 'admin'),
  ],
};
