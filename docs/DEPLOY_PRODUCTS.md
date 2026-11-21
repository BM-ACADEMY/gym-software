# Deploying the products to the Hostinger VPS

Written 13 Nov 2026. **Written, not yet tested by a person.** Nothing here has been run on the real server.
Server: Hostinger KVM 2 VPS, 200.141.15.246, Ubuntu 24.04, Mumbai. **Shared with live AFRA systems: read the SHARED SERVER section first.** Paid until 28 Nov 2026 (owner renews). Eight apps: Gym, Hire, Salon, Mart, Dine, Cloth, Wash and the Super Admin.

**Who does what**
- **Claude** (in the Hostinger browser terminal, owner watching) or **one developer** runs the commands marked `[CLAUDE/DEV]`.
- **Only the owner (Kamar)** does the steps marked `[OWNER]`: every password, key and secret is typed by him into the server's settings files. Claude never sees, copies or writes a secret into chat, git or a document. If a step shows a secret on screen, hide it.

All files mentioned are in the repo under `deploy/`.

## 0. Before you start (check these first)
- [ ] CI on `phase1-autopilot` is green (GitHub, Actions tab). If it is red, fix first; do not deploy.
- [ ] A **release branch** exists, cut from `phase1-autopilot` after CI is green, e.g. `release-20261113`. Production never follows `phase1-autopilot` directly, and nobody pushes to `main`. `[OWNER]` says the name; `[CLAUDE/DEV]` creates it.
- [ ] Hostinger **snapshot** taken from the Hostinger panel (so the whole server can be put back). `[OWNER]`
- [ ] MongoDB Atlas is ready as in `deploy/MONGO.md` (eight databases, eight users, allow-list = this VPS only). `[OWNER]`
- [ ] Gym: no `gymdesk` service exists on this server (checked 13 Nov). Step 9 does not apply here.

## SHARED SERVER (read this first; found 13 Nov 2026 by looking at the real server, read-only)
The server already runs live systems, so this kit must not touch them:
- **Lead Hub (AFRA AI OS):** systemd `afra-app@live` and `afra-app@staging` (ports 3000 and 3001), user `afra`, folders `/srv/afra/live|staging`, settings `/etc/afra/live.env|staging.env`, two PostgreSQL clusters, backup timers `afra-backup@*`, nginx file `/etc/nginx/conf.d/afra.conf` for app.afraventures.in and staging.afraventures.in.
- **Postiz** (Docker, post.afraventures.in), **Temporal** (Docker), **ReelHub** (reels.afraventures.in), fail2ban, the firewall (ufw already active and correct).
- **Node 22 already installed** at `/opt/node-22/bin/node` (the Lead Hub's). We use it; we never install, upgrade or change it.

So for the products:
- **Own user and folders:** user `afraprod`, `/srv/afraprod`, `/etc/afraprod`, `/var/log/afraprod`. Never the `afra` user (a break-in to a product app must not be able to read the Lead Hub's live settings).
- **Nothing is removed or upgraded:** no `apt upgrade`, no `ufw` change, no deleting nginx's default site, no global npm install. pm2 is installed in our own folder (`/srv/afraprod/tools`).
- **Own nginx names:** `10-prod-common.conf`, `prod-proxy.conf`, `prod-security-headers.conf`, `prod-<product>.conf`; rate-limit zones start with `prod_`. Always `sudo nginx -t` before a reload; if it fails, remove our new file and stop.
- **Memory:** the server also runs Postiz, Temporal and a search database. Check `free -h` before building; build one front-end at a time with `nice -n 19`. Watch memory after the apps start; if it is tight, move the products to the other server (82.25.85.114) or upgrade the plan.
- **Backups:** the Lead Hub has its own. Ours are separate (`deploy/backup/`).
- **Ports used by us:** 5000, 5006 to 5012 (all free on 13 Nov).
- **Old `gymdesk`:** not on this server (no such service). It is probably on the other server; leave it alone for now.

## 1. Server basics `[CLAUDE/DEV]` (shared-server version: installs almost nothing)
```
/opt/node-22/bin/node -v          # must start with v22 (already there)
sudo apt -y install git certbot python3-certbot-nginx 2>&1 | tail -3    # only if missing; this does NOT upgrade other packages
free -h; nproc                    # memory check (see above)
```
Do not run `apt upgrade`, `ufw enable` or `npm install -g`.

## 2. The app user and folders `[CLAUDE/DEV]`
```
sudo adduser --system --group --home /srv/afraprod afraprod
sudo mkdir -p /srv/afraprod/releases /srv/afraprod/tools /etc/afraprod /var/log/afraprod
sudo chown -R afraprod:afraprod /srv/afraprod /var/log/afraprod
sudo chown root:afraprod /etc/afraprod && sudo chmod 750 /etc/afraprod
sudo -u afraprod env PATH=/opt/node-22/bin:$PATH npm install --prefix /srv/afraprod/tools pm2     # pm2 in our own folder
sudo install -d -o afraprod -g afraprod -m 700 /srv/afraprod/data /srv/afraprod/wash-photos   # Super Admin users file and audit data, Wash job photos (outside the release folders)
sudo -u afraprod ssh-keygen -t ed25519 -f /srv/afraprod/.ssh_deploy -N "" 2>/dev/null || true
```
Deploy key: add the **public** half (`/srv/afraprod/.ssh_deploy.pub`) to GitHub as a **read-only deploy key** on the repository (it is public now, so a plain `https://github.com/BM-ACADEMY/gym-software.git` clone also works without any key: set `REPO_URL` to that and skip the key). `[OWNER]` adds it in GitHub (Settings > Deploy keys) if the key route is used.
Start on reboot: `sudo env PATH=/opt/node-22/bin:/srv/afraprod/tools/node_modules/.bin:$PATH pm2 startup systemd -u afraprod --hp /srv/afraprod`, then run the one command it prints, then `sudo -u afraprod pm2 save` after the first deploy.

## 3. The settings files (all secrets) `[OWNER]`
One file per product, `/etc/afraprod/<product>.env`, owner `afraprod`, mode 600. The names and which are required are in `deploy/env/<product>.env.example` (names only, no values).
`[CLAUDE/DEV]` creates the empty files and the layout:
```
for p in gym hire salon mart dine cloth wash admin; do
  sudo install -m 600 -o afraprod -g afraprod /dev/null /etc/afraprod/$p.env
done
```
Then `[CLAUDE/DEV]` copies the names from `deploy/env/<p>.env.example` into each file with **empty values**, and the **owner types every value himself** at the terminal (nano). How to make a good secret: `openssl rand -base64 48` on the server, copied by the owner into the file only.
Every file needs: `MONGODB_URI` (from Atlas), `<PRODUCT>_SESSION_SECRET` (32+ characters, different for every product), `INTERNAL_API_KEY` (24+ characters; the **same value** in a product's file and in the admin file as `ADMIN_KEY_<PRODUCT>`). The Super Admin file also needs `ADMIN_MFA_KEY` (32 random bytes, base64: `openssl rand -base64 32`) and its users file. For the admin addresses use `ADMIN_URL_<PRODUCT>=http://127.0.0.1:<port>`.
**Without a database address and a session secret, a product starts but answers 503 on every call and `/api/health` says `ok: false`.** That is on purpose (fail-closed), not a bug.
Razorpay keys for the Gym are saved in the Root Admin screen later, not in these files.

## 4. Install the web-server files `[CLAUDE/DEV]`
Use the repo copy from the first release (clone once to read the files, or after step 6 use `/srv/afraprod/current/deploy/nginx`).
```
sudo cp deploy/nginx/10-prod-common.conf /etc/nginx/conf.d/
sudo mkdir -p /etc/nginx/snippets
sudo cp deploy/nginx/prod-proxy.conf deploy/nginx/prod-security-headers.conf /etc/nginx/snippets/
for s in gym hire salon mart dine cloth wash admin; do sudo cp deploy/nginx/$s.conf /etc/nginx/sites-available/prod-$s.conf; sudo ln -sf /etc/nginx/sites-available/prod-$s.conf /etc/nginx/sites-enabled/; done  # NOTE: no "rm default": the default site is not ours to remove
sudo nginx -t        # must say "syntax is ok". If it fails, stop and read the message.
```
(If the certificate lines in the site files do not exist yet, `nginx -t` complains about missing certificates: install the site files, run step 5 first with the plain-HTTP versions, or use `certbot --nginx` which adds them. Do not skip the test.)

## 5. Names (DNS) and HTTPS
`[OWNER]` In the domain's DNS panel add an **A record** to `200.141.15.246` for each name: `fit`, `groom`, `mart`, `dine`, `cloth`, `wash`, `hire`, `admin` (all under afraventures.in). **The names other than `fit` are drafts**; the owner confirms them first. If a name changes, change the host name inside the matching `deploy/nginx/*.conf` too.
`[CLAUDE/DEV]` wait until `dig +short groom.afraventures.in` shows the VPS address, then run the certbot commands in `deploy/nginx/CERTBOT.md` (the owner's email goes in, typed by him). Check: `sudo certbot renew --dry-run`.
Super Admin: put it behind an IP allow-list in `admin.conf` (the commented lines) once the owner's office address is known, and keep the two-step sign-in on.

## 6. Check, deploy, smoke-test `[CLAUDE/DEV]`
```
sudo bash deploy/preflight.sh                 # read-only; every line must be PASS. It never prints a secret.
sudo -u afraprod RELEASE_BRANCH=release-20261113 bash deploy/deploy.sh --dry-run    # shows the plan, changes nothing
sudo -u afraprod RELEASE_BRANCH=release-20261113 bash deploy/deploy.sh              # the real one
```
`deploy.sh` makes a new folder under `/srv/afraprod/releases`, installs, builds the front-ends, switches the `current` link, restarts under pm2, waits for every `/api/health`, and **goes back to the previous release by itself if any check fails**. It keeps the last 5 releases. You can deploy only some products: `--products "salon mart"`. It refuses `main` and refuses to run without `RELEASE_BRANCH`.
First time: also run `pm2 startup` (it prints one command to run with sudo) so the apps start after a reboot, then `pm2 save`.

**Smoke tests** (a person looks at each; write the result in `docs/products/HANDOVER_TESTS.md`). For each product, open its address in a browser and:
- **All:** `https://<name>/api/health` shows `ok: true`; the padlock is valid; the home page loads with no blank screen; sign-up or log-in works; log out works.
- **Gym (fit):** owner log-in, add a member, take a (test-mode) payment, member list shows him.
- **Salon (groom):** create the business, add a service and a staff member, book an appointment, check out a bill; give a staff discount and see the owner is told and the limit is respected.
- **Mart:** add an item with GST, sell it, stock goes down.
- **Dine:** add a menu item, open the public menu at `/dine-public/menu/<token>`, place a table order, see it in the kitchen view.
- **Cloth:** add an item with a size and colour, sell it, stock for that size goes down.
- **Wash:** add a job, move it through its stages, bill it.
- **Hire:** add a job and a candidate; the public share and consent pages (`/api/hire-share`, `/api/hire-consent`) open without log-in. Candidate messages stay "suggest" until the lawyer approves.
- **Super Admin (admin):** sign in with two-step; seven product tiles show counts or "not connected" (Wash may show "not connected": see notes).
- **Wrong data check:** a user of one business must not see another business's data (try it once with two test businesses).
- **No demo accounts on production.** Use throw-away test businesses and delete them after.

## 7. Rollback `[CLAUDE/DEV]`
Automatic: a failed health check puts the previous release back and the script exits with an error.
By hand (a bad release found later):
```
ls -1t /srv/afraprod/releases                                   # newest first; pick the one before
sudo -u afraprod ln -sfn /srv/afraprod/releases/<older-stamp> /srv/afraprod/current.next && sudo -u afraprod mv -Tf /srv/afraprod/current.next /srv/afraprod/current
sudo -u afraprod pm2 startOrRestart /srv/afraprod/current/deploy/ecosystem.config.js --update-env
```
Then run the health checks again. Data in Atlas is not rolled back by this; take an export before any release that changes how data is stored. Worst case: restore the Hostinger snapshot from step 0.
Panic stop of one product: `pm2 stop <product>` (nginx then answers 502 for that name only).

## 8. Everyday commands
`pm2 status` · `pm2 logs <product> --lines 100` · `pm2 reload <product>` · `tail -f /var/log/afraprod/deploy.log`. Logs are in `/var/log/afraprod/`. Never paste a log into chat without reading it for personal data first.

## 9. The old Gym on systemd (if one exists)
If `systemctl status gymdesk` shows a running service on port 5000: tell the owner, take the snapshot, then `sudo systemctl stop gymdesk && sudo systemctl disable gymdesk` just before the first deploy so port 5000 is free (the pm2 Gym takes it). Keep its settings file; copy only the **names** to `/etc/afraprod/gym.env` and let the owner re-type the values. Rollback for this step: `sudo systemctl start gymdesk` after `pm2 stop gym`.

## 10. Notes and changes to know
- **Ports changed** against `HOSTING_PLAN.md` (its 5001 to 5006 table is out of date). Now fixed in the pm2 file: gym 5000, hire 5006, salon 5007, mart 5008, dine 5009, cloth 5010, wash 5011, admin 5012. The admin's own code default (5010) clashes with Cloth, so the pm2 file pins admin to 5012.
- **The release branch** is cut from `phase1-autopilot` after CI is green. The deploy script has no hard-coded branch.
- **Product names and addresses are drafts** until the owner confirms them.
- **Wash summary route:** Wash currently answers the Super Admin on `/api/internal/wash/admin-summary`, the others on `/api/internal/admin-summary`. Until SA-18 aligns it, Wash shows "not connected" in the Super Admin. Not a deploy blocker.
- **Dine:** the tables route and the role returned by `/auth/me` are known gaps (DIN-SRV); the table-order smoke test may fail until fixed.
- **Not yet done by anyone:** no product has run against a real database; front-ends have never been built with Vite on a real machine. Expect first-run problems and fix them on the release branch, not on the server.
- **Money rules:** one GST rule is still needed (the code stores prices before GST; the master plan says "included"). Mart (all plans) and Dine Pro are below the floor price on the draft ladder. Do not publish prices until the owner decides.
- **CA, lawyer, Meta WhatsApp templates and Tamil/Hindi review** are owner items outside this deploy.
- **Backups:** see `deploy/MONGO.md`; free Atlas has none. Decide before real customers.
- **Marketing says only what a person saw working.** After the smoke tests pass, list in `docs/products/MARKETING_CLAIMS.md` what was seen.
