# GymDesk on the Hostinger VPS (pilot)

Status: written, not yet run by a person. Replaces the Railway/Render + Vercel route in `DEPLOYMENT.md` for the pilot.
Server: Hostinger KVM 2, Ubuntu 24.04, Mumbai, IP 200.141.15.246 (shared with Afra AI OS in the pilot).
Do this only AFTER the server hardening (`afra-ai-os` runbook `new-server-hardening`, steps 1 to 12) is checked off.
Before the public launch on 1 Dec, move the products to their own server (decision pending, tier 3).

## What runs where
- Database: MongoDB Atlas (India region). Not on this server. Allow ONLY this server's IP in Atlas Network Access (replace `0.0.0.0/0`).
- Backend: Node 22, one process, under systemd, listening on 127.0.0.1:5000 only. **Run exactly one copy**: the automations and daily jobs run inside the process with timers (`server.js`), so two copies would send every WhatsApp reminder twice.
- Website: `client` built to static files, served by nginx.
- nginx: one site `fit.afraventures.in` (HTTPS by Let's Encrypt). `/api/` goes to the backend, everything else to the built site. Afra AI OS keeps its own nginx site on the same machine; do not edit its files.

## Steps (Dev A or the owner with Claude Code)
1. DNS (Hostinger DNS or wherever `afraventures.in` lives): A record `fit` to 200.141.15.246. Wait until `dig fit.afraventures.in` shows it.
2. Packages: `sudo apt install -y nginx certbot python3-certbot-nginx git` and Node 22 from NodeSource. Check `node -v` shows v22.
3. App user and code: `sudo adduser --system --group gymdesk`, then `sudo -u gymdesk git clone <repo> /srv/gymdesk` and `git checkout phase1-autopilot` (use the release branch Mohamed names later, never `main` by hand).
4. Settings file `/etc/gymdesk/gymdesk.env`, owner root, mode 600 (`sudo chmod 600`). Contents follow `server/.env.example`. New random values for `JWT_SECRET` and `INTERNAL_API_KEY` (`openssl rand -base64 48`). Set `NODE_ENV=production`, `PORT=5000`, `CORS_ORIGINS=https://fit.afraventures.in`, `CLIENT_URL=https://fit.afraventures.in`, `OTP_MODE=live`, `MONGODB_URI` (production database only), Razorpay and OpenAI keys when ready. Never commit this file or paste it in chat.
5. Install and build: `cd /srv/gymdesk/server && npm ci --omit=dev`; `cd ../client && npm ci && VITE_API_URL=/api npm run build` (relative `/api` means the site and API share one address).
6. systemd unit `/etc/systemd/system/gymdesk.service`:
   ```
   [Unit]
   Description=GymDesk API
   After=network.target
   [Service]
   User=gymdesk
   WorkingDirectory=/srv/gymdesk/server
   EnvironmentFile=/etc/gymdesk/gymdesk.env
   ExecStart=/usr/bin/node server.js
   Restart=always
   RestartSec=3
   NoNewPrivileges=true
   ProtectSystem=full
   PrivateTmp=true
   [Install]
   WantedBy=multi-user.target
   ```
   Then `sudo systemctl daemon-reload && sudo systemctl enable --now gymdesk`. Check: `curl http://127.0.0.1:5000/api/health` returns `{"success":true,...}`.
7. nginx site `/etc/nginx/sites-available/fit.afraventures.in` (link into `sites-enabled`):
   ```
   server {
     server_name fit.afraventures.in;
     root /srv/gymdesk/client/dist;
     index index.html;
     client_max_body_size 10m;
     location /api/ {
       proxy_pass http://127.0.0.1:5000;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
     }
     location /sw.js { add_header Cache-Control "no-cache"; try_files $uri =404; }
     location / { try_files $uri /index.html; }
   }
   ```
   `sudo nginx -t && sudo systemctl reload nginx`, then `sudo certbot --nginx -d fit.afraventures.in`.
8. Firewall: only ports 22, 80, 443 open (already from hardening). Port 5000 must NOT be reachable from outside: from your own computer `curl http://200.141.15.246:5000` must fail.
9. Checks: `https://fit.afraventures.in/api/health` is green; sign up a new test gym; install the app on a phone (PWA-01); remove the test gym. No demo accounts on production.
10. Updates later: `git pull`, `npm ci --omit=dev`, rebuild the client, `sudo systemctl restart gymdesk`. Keep the previous build folder until the new one is checked.

## Open items
- Daily backup copy of Atlas (Atlas has its own backups on paid tiers; on free it does not): decision on where backups live (H17) and who pays.
- Move to a separate server before 1 Dec (hosting spend approval, M-09).
- Monitoring: a free uptime check on `/api/health` and a failure email.
