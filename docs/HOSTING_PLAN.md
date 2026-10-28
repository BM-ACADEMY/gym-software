# Hosting plan: everything on the new Hostinger VPS

Decision D-17 (28 Oct, Mohamed): plan Afra AI OS and all Afra SaaS products on the new Hostinger server. Supersedes the earlier line "new server for Afra AI OS only; products on a paid always-on host".
Server: KVM 2, Ubuntu 24.04, Mumbai, IP 200.141.15.246, 2 vCPU, 8 GB RAM, 100 GB disk. Bought 28 Oct for 1 month (Rs 1,299), ends 28 Nov, auto-renew on.
Status: plan written; nothing deployed. Server hardening (M-11) comes first.

## Layout on the one server
One nginx in front, one system user and one systemd service per app, every app listening on 127.0.0.1 only, one HTTPS name per app.

| App | Address | Local port | Database | Notes |
| --- | --- | --- | --- | --- |
| Afra AI OS (sales and lead hub) | app.afraventures.in, staging.afraventures.in | its runbook | PostgreSQL on this server | Own runbooks in the afra-ai-os repo; do not edit its nginx files |
| Gym | fit.afraventures.in | 5000 | MongoDB Atlas (India) | `docs/DEPLOY_VPS.md` |
| Salon/Spa/Barber (groom) | groom.afraventures.in | 5001 | MongoDB Atlas | Same recipe as the gym |
| Mart | mart.afraventures.in (name draft) | 5002 | MongoDB Atlas | |
| Dine | dine.afraventures.in (name draft) | 5003 | MongoDB Atlas | |
| Cloth | cloth.afraventures.in (name draft) | 5004 | MongoDB Atlas | |
| Wash | wash.afraventures.in (name draft) | 5005 | MongoDB Atlas | |
| Hire | hire.afraventures.in (name draft) | 5006 | MongoDB Atlas | |

Rules: one copy of each product backend (their timers send messages, so two copies would double-send); never open the app ports to the internet; each app has its own settings file under `/etc/<app>/` (mode 600); product names and addresses are drafts until the owner fixes names (D-08).
Product data stays in Atlas, so the server holds code and logs only. Afra AI OS keeps its own PostgreSQL here.

## Will it fit? (Assumption, not measured)
- Memory: Afra AI OS with its Postgres about 2 GB; each small Node API about 0.2 to 0.4 GB; nginx and system about 0.5 GB. Seven products plus Afra AI OS should fit in 8 GB for a pilot.
- CPU is the real limit: 2 vCPUs shared by all apps. Fine for a pilot with a few pilot businesses; not for paying customers at launch.
- Dev A measures after the first deploy (`free -m`, `uptime`, `top`) and writes the numbers in the sheet.

## When to move (Claude proposes; Tier 3 spend decision)
Move the products to their own server, or upgrade to KVM 4 (2x CPU, 16 GB; the pricing page showed Rs 1,099 a month on a 24-month promo), when any one of these is true:
1. Before the gym public launch on 1 Dec, whichever comes first with the points below.
2. Memory in use above 75 percent for a day, or load average above 1.5 per core for an hour.
3. More than about 20 paying businesses across all products (Assumption).
4. A slow page reported by a pilot user that traces to server load.
Afra AI OS has already felt slow on a shared box, so the sales hub must never share a CPU crunch with customer apps at launch.

## Backups and safety on the shared server
- Atlas holds product data: turn on its backups (free tier has none: decide the plan before real customers; Tier 3, M-09).
- Afra AI OS: its own encrypted backup scripts (storage choice H17 open).
- Hostinger weekly backups are included; keep them, plus a manual snapshot before every risky change.
- One compromise of this server would expose every app, so: key-only SSH, firewall 22/80/443 only, automatic security updates, separate system user per app, no secrets in git (hardening steps 1 to 12).

## What I changed because of this decision
`DEPLOYMENT.md` and `HANDOVER.md` now point to this plan and to `docs/DEPLOY_VPS.md` instead of Railway, Render and Vercel (those files stay only as a fallback). Team sheet task A-15 runs the gym on this server.
