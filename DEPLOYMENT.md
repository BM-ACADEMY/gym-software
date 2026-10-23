# Deploying GymDesk

Everything the app needs to go live is already wired up in code — this is
the runbook for the three account-level steps only *you* can do (they need
your own MongoDB Atlas / Railway or Render / Vercel accounts). Nothing here
requires touching application code.

## 1. MongoDB Atlas (replaces the self-hosted MongoDB box)

1. Create a free cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
2. **Database Access** → add a user with a strong password (read/write on any database).
3. **Network Access** → add `0.0.0.0/0` (or your backend host's static IP, if your platform gives you one).
4. **Database → Connect → Drivers** → copy the `mongodb+srv://...` connection string.
5. You need **two** databases on the same cluster — production and test:
   - `MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/gymdesk?retryWrites=true&w=majority`
   - `MONGODB_TEST_URI=mongodb+srv://<user>:<password>@<cluster>/gymdesk_test?retryWrites=true&w=majority`

Keep the current `server/.env` around locally for dev — this only changes what production points at.

## 2. Backend — Railway or Render

The repo has config for both; use whichever platform you prefer, not both.

### Option A: Railway

1. `railway.json` already lives in `server/`.
2. In the Railway dashboard: **New Project → Deploy from GitHub repo**, pick this repo.
3. Set the service's **Root Directory** to `server`.
4. Add the environment variables from `server/.env.example` under the service's **Variables** tab (`MONGODB_URI`, `JWT_SECRET`, `OTP_MODE=live`, `BULKSMS_API_URL`, `RAZORPAY_KEY_ID`/`SECRET`, and optionally `ANTHROPIC_API_KEY` / `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_ACCESS_TOKEN`).
5. Railway assigns a public URL like `https://gymdesk-backend.up.railway.app` — that's your `VITE_API_URL` base (append `/api`).

### Option B: Render

1. `render.yaml` already lives at the repo root (a Blueprint).
2. In the Render dashboard: **New → Blueprint**, point it at this repo. Render reads `render.yaml` and creates the `gymdesk-backend` web service with `rootDir: server` already set.
3. Fill in the env vars marked `sync: false` in the Render dashboard (same list as above) — Render prompts for these during Blueprint setup.
4. Render assigns a URL like `https://gymdesk-backend.onrender.com` — again, your `VITE_API_URL` base + `/api`.

Either way, confirm it's live: `curl https://<your-backend-url>/api/health` should return `{"success":true,"message":"Server is running"}` — this is also what the platform's own health check polls.

## 3. Frontend — Vercel

1. `client/vercel.json` is already set up (Vite build, SPA rewrites).
2. In the Vercel dashboard: **Add New → Project**, import this repo, set **Root Directory** to `client`.
3. Add one environment variable: `VITE_API_URL=https://<your-backend-url>/api` (from step 2).
4. Deploy. Vercel gives you a `https://<project>.vercel.app` URL — that's your production frontend.

## 4. After both are live

- Log in with the seeded demo accounts (`server/scripts/seedDemoUsers.js` — see `HANDOVER.md` §3) against the production URL to confirm the full stack talks to each other.
- Rotate `JWT_SECRET`, `RAZORPAY_KEY_ID/SECRET`, and any API keys to production-grade values before real users touch it — the ones in `server/.env` today are dev/test credentials.
- If you enable WhatsApp or the live Claude integration, set `WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_ACCESS_TOKEN` or `ANTHROPIC_API_KEY` on the backend host, not in the frontend — they're server-only secrets.
