# GymDesk — Client Handover Notes

Gym Management SaaS, MERN stack. Four roles: **Root Admin** (platform owner), **Gym Owner / Admin**, **Sub-Admin** (staff/trainer), **Member** (customer).

## 1. Stack & structure

- `server/` — Node/Express API, MongoDB via Mongoose.
  - `app.js` — the configured Express app (no side effects; used by both `server.js` and the test suite).
  - `server.js` — real entrypoint: connects the DB, starts the HTTP server, and starts the background schedulers (notification rules, platform billing cycle, member auto-renewals).
  - `controllers/`, `routes/`, `models/`, `services/`, `middleware/`, `utils/` — standard layering. Admin and Sub-Admin routes for the same module share one controller file; the controller itself scopes data down for a Sub-Admin without "view all" permission.
- `client/` — React 19 + Vite + Redux Toolkit + Tailwind, one page tree per role under `src/pages/{root-admin,admin,subadmin,member}`.

## 2. Running it locally

```bash
# Server
cd server
npm install
npm run dev        # nodemon server.js — http://localhost:5000

# Client (separate terminal)
cd client
npm install
npm run dev         # http://localhost:5173
```

Required `server/.env` keys: `MONGODB_URI`, `MONGODB_TEST_URI` (a **separate** database for the automated test suite — never the same DB as production data), `JWT_SECRET`, `PORT`, `OTP_MODE` (`demo` or `live`), plus optional `BULKSMS_API_URL` and SMTP vars for real SMS/email delivery.

## 3. Demo accounts

Seeded via `node server/scripts/seedDemoUsers.js` (safe to re-run; upserts):

| Role | Name | Phone | Password |
|---|---|---|---|
| Root Admin | Snega | 7339017112 | Snega@123 |
| Gym Owner | Charles | 8807226257 | Charles@123 |
| Sub-Admin (trainer) | Swetha | 9345989654 | Swetha@123 |
| Member | Ragu | 9486788591 | Ragu@123 |

`OTP_MODE=demo` prints OTPs to the server console instead of sending real SMS/email — use this for a walkthrough without a live SMS/email provider configured.

## 4. What's real vs. simulated

Everything is built against real business logic and real data — nothing in the app is mocked at the UI layer.

- **Payment gateway** (`server/services/paymentGateway.js`, `webhookProcessor.js`): **live Razorpay integration** (test mode) is wired up — real order creation via Razorpay's API, the real Checkout.js widget on Member Payments and Admin platform billing, and real HMAC-SHA256 signature verification of the checkout callback, backed by a real idempotency ledger (`WebhookEvent`, unique-indexed on `(provider, eventId)`) so a duplicate confirmation can never double-credit an invoice. Credentials live in MongoDB (`SystemSettings`, key `payment_gateway`) — set via Root Admin → Settings → Payment gateway (`PUT /api/root-admin/settings/payment-gateway`), never in a config file or committed anywhere in the repo; the secret is write-only (masked on every read). Without a provider configured there, the app automatically falls back to the original dummy/simulated gateway — same code path, same idempotency guarantees, no real charge.
- **AI service** (`server/services/ai.js`): churn risk, no-show prediction, optimal PT slot suggestion, monthly narrative reports, and smart notification timing are real, deterministic, rule-based logic operating on real data (attendance, payments, session history) — by design, not stand-ins for an LLM call. **Workout/diet plan generation (AI Plans) does call Claude** (`claude-opus-5`) when `ANTHROPIC_API_KEY` is set in `server/.env` — real generation from the member's goal, medical notes, equipment, and body stats. Without a key configured, it automatically falls back to the same rule-based generator it always used, with no error surfaced to the user.
- **WhatsApp** (`server/utils/whatsapp.js`): real WhatsApp Cloud API integration, enabled per-gym from Admin → Settings → WhatsApp and opt-in per member/trainer in their notification preferences. Sends for real once `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN` are set in `server/.env`; otherwise it logs the message instead of sending, the same demo-mode pattern SMS already used.

Notifications (`server/services/notifications.js`) send real SMS (BulkSMS), real email (SMTP), and real WhatsApp when `OTP_MODE=live` and the relevant env vars are set.

### Testing the real Razorpay flow

With test-mode credentials configured, use Razorpay's published test card in the Checkout widget: card `4111 1111 1111 1111`, any future expiry, any CVV, any name — or any test UPI VPA (`success@razorpay`). No real money moves in test mode.

## 5. Feature coverage by role

All four roles have complete, working flows for their core modules: members, attendance, payments (incl. PDF invoices/receipts and GST support), staff/trainers, PT sessions (incl. sellable session packages with credit tracking), workouts, trials, accounts (incl. GST summary), reports & analytics, notifications, settings, subscriber/platform management, plan creation & coupons, billing, and support tickets. Root Admin can also directly move a subscriber onto a different platform plan (a support/override action separate from the gym's own checkout flow).

## 6. Automated tests

```bash
cd server
npm test        # jest --runInBand
```

Runs against `MONGODB_TEST_URI` (a dedicated `_test` database, dropped after each run) — never against real data. Covers multi-tenant data isolation, the sub-admin permission matrix, webhook idempotency, and a full cross-role walkthrough (owner → trainer → member → root admin).

```bash
cd client
npm test         # vitest run
npm run test:watch
```

Component/unit tests (Vitest + React Testing Library, jsdom) covering role-gating (`ProtectedRoute`), a Root Admin flow (Analytics charts), a Member flow (Dashboard next-payment widget), a Trainer flow (PT session reschedule), and the sub-admin nav-permission filter as a pure-logic unit test.

## 7. Known gaps / next steps

These need something only the client can provide, so they're intentionally left open rather than faked:

- **Live LLM for AI Plans** — code is wired up (`services/ai.js`), just needs an `ANTHROPIC_API_KEY` in `server/.env` to go live; falls back to the rule-based generator until then.
- **WhatsApp notifications** — code is wired up (`utils/whatsapp.js`, Meta WhatsApp Cloud API), just needs `WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_ACCESS_TOKEN` in `server/.env` to go live; logs instead of sending until then.
- **Production deployment** — currently runs dev-only (local Node + a self-hosted MongoDB box). All the deploy config is in place (`server/railway.json`, `render.yaml`, `client/vercel.json`, `.env.example` in both `server/` and `client/`) — see **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the step-by-step runbook. What's left needs your own accounts: a MongoDB Atlas cluster, a Railway or Render service for `server/`, and a Vercel project for `client/`.

Everything else called for in the original requirements doc is implemented and verified.
