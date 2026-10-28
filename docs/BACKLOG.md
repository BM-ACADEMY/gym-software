# GymDesk Backlog

Status values: TODO, IN PROGRESS, WRITTEN (code pushed, not yet tested by a human), DONE (tests pass and merged), BLOCKED.
Claude: update this file in the same commit as the work. Work in ID order within a phase unless blocked.
Days are estimates for Claude-written code, excluding human test time.

## Phase 0: Safe base

| ID | Task | Status | Acceptance |
| --- | --- | --- | --- |
| P0-01 | Security fixes on `pilot-security-fixes` (commit 21cba9c) | WRITTEN | `npm test` passes incl. `tests/pilotSecurity.test.js`; Security and Tenant suites green on staging |
| P0-02 | Make GitHub repo private, change every password that was in HANDOVER.md (the four demo accounts: Root Admin, Gym Owner, Sub-Admin, Member, plus any real login that reused them). 28 Oct: `seedDemoUsers.js` no longer holds passwords; it needs `DEMO_SEED_PASSWORD` | TODO (human) | Old passwords fail |
| P0-03 | Production env set from `server/.env.example`; paid hosting; Atlas backups, one restore tested | TODO (human); guide in `docs/OPS.md` | Restore drill done |
| P0-04 | Log the 25 failed P1 tests from the QA workbook as bugs | TODO (human) | Bug Log filled |
| P0-05 | Razorpay exists (get test keys via Dev A, confirm company name + GST). Apply for WhatsApp Business API (separate GymDesk number). CA check on GST invoices. No SMS/DLT | TODO (human) | WhatsApp application submitted; test keys saved in Settings |

## Phase 1a: Money

Progress 24 Oct: dev branch `charles` merged in. 1A-01/02/03 written (plans in `server/config/plans.js`, status in `server/services/subscription.js`, `POST /api/auth/signup`, `GET /api/admin/subscription`). Pure logic checked 11/11 with a shim; DB tests in `tests/signup.test.js` not run. Legacy `PlatformPlan` kept for old pilot gyms only. 28 Oct: 1A-04 (checkout, confirm, webhook, idempotent activation, upgrade credit) and 1A-05 (gap-free GST invoice numbers per financial year, PDF) written in `services/subscriptionBilling.js`, `services/billingMath.js`, routes under `/api/admin/subscription`, webhook `/api/payments/razorpay-webhook`. Pure maths checked 26/26 with a shim; `tests/billingFlow.test.js` not run. Needs: Razorpay test keys in Root Admin Settings, `RAZORPAY_WEBHOOK_SECRET`, webhook URL set in Razorpay dashboard for events payment.captured and payment.failed, CA check on SAC code and GST mode. 1A-07 (`GET /api/root-admin/subscriptions/overview`, `POST .../:id/extend` with logged reason) and 1A-08 (`GET /api/internal/billing-reminders`, header `x-internal-key` = `INTERNAL_API_KEY`) written; `tests/superAdminBilling.test.js` not run. 1A-06 written for PT and accounts (branding gate still to do with the UI). Client written (syntax-checked only, never built): password sign-up page, `Plan & Billing` page with Razorpay Checkout and invoice download, trial/overdue banner, honest Pricing page. Removed made-up claims from the landing page (500+ gyms, 99% retention, fake testimonials, BMI). GST rule decided 28 Oct: buyer in Puducherry (seller state, env `SELLER_STATE`) gets CGST+SGST, every other state gets IGST; state is asked at sign-up and before first payment. 28 Oct: Solo plan added (Rs 249 / 2,490, 50 members, 1 staff, no WhatsApp) on Mohamed's approval; unit tests pass via shim (13/13 and 17/17), DB tests not run. 28 Oct review fixes: a failed Razorpay attempt no longer cancels the order (retry on same order works); an upgrade whose new period ends before the old paid-until now still switches the plan (payment `appliedAt`). Test runbook for Dev A: `docs/TEST_RUNBOOK.md`. 28 Oct: removed more copied or false public claims (fake client logos, 24/7 phone support, class booking, CRM, inventory, BMI, fake 2024 blog, `India's #1`, 7-day trial); FAQ rewritten to match the code; /blog redirects home. Next phase 1b: WhatsApp template sender + renewal/dues/absence/daily-summary automations, setup wizard + Excel import, staff attendance, device-log import, signed QR, landing polish, legal pages (terms/privacy/refund wording needs CA/lawyer).
 (2 to 3 days of Claude coding each unless noted)

| ID | Task | Status | Acceptance |
| --- | --- | --- | --- |
| 1A-01 | Code-defined plans (`server/config/plans.js`): starter, growth, pro, trial; limits and feature list; replace `PlatformPlan`/`PlanFeature` use and `planFeatureGuard` | WRITTEN | Seed script gone; guards read config; existing tests updated |
| 1A-02 | Subscription status from dates on every request (trial, paid until, grace, suspended); 402 `subscription_expired` except billing and account routes | WRITTEN | Replaces interim trial lock in `middleware/auth.js` |
| 1A-03 | Self-serve sign-up (password), 14-day trial on Growth, welcome state | WRITTEN | New gym created with trial dates; no OTP dependency |
| 1A-04 | Razorpay billing port: price on server, order, checkout verify, webhook (raw body), idempotent activation, credit for unused days on upgrade | WRITTEN | Test-mode payment activates plan; repeat webhook is a no-op; amount mismatch fails |
| 1A-05 | GST invoice numbers (gap-free, restart 1 April), CGST/SGST/IGST split, printable invoice | WRITTEN | Invoice matches CA-approved wording |
| 1A-06 | Gate every route by plan feature and member/staff limits (PT, earnings, accounts, analytics, branding, reminders) | WRITTEN (PT, accounts, AI plans, branding logo/colour; analytics and earnings not gated) | QA tests GATE-05 to GATE-15, PLAT-02 to PLAT-18 pass |
| 1A-07 | Super admin overview: companies by status, MRR, trials ending, give days, suspend, with logged reason | WRITTEN | No access to a gym's member data |
| 1A-08 | Billing reminder list endpoint for the scheduler (trial_ending, renewal_due, expired) protected by internal key | WRITTEN | |

## Phase 1b: Retention and setup

Progress 28 Oct: 1B-01 to 1B-04 written. `utils/whatsapp.js` sends approved templates only (demo mode logs text when no credentials); `services/automations.js` runs every 15 min (renewals at 30/7/1 days and +1/+7 after end, weekly dues up to 4, 10-day absence, owner summary at 8 pm IST; 9am to 9pm IST for members; each message has a unique dedupe key; per-plan monthly quota; skipped for locked gyms). Old SMS channel now off unless `SMS_ENABLED=true`. Templates to submit to Meta: `docs/WHATSAPP_TEMPLATES.md`. Tests `tests/automationRules.unit.test.js` (10/10 via shim) and `tests/automations.test.js` (not run). Also written: member import (`POST /api/admin/members/import`, preview then commit), device-log import (`POST /api/admin/attendance/device-log`, members to check-ins, staff to daily attendance), staff attendance (`/api/admin/staff-attendance`), device ID on member/staff forms. Pure parts checked by shim: 45/45 across 5 unit files. UNVERIFIED: Excel (.xlsx) reading uses `read-excel-file` (added to client package.json; Dev A runs `npm install`); how it returns date and time cells must be tested with a real device export. Also: member QR now signed with HMAC (`QR_SECRET` or JWT_SECRET); old unsigned QRs are refused and members see the new one in their app. Onboarding checklist on owner dashboard. Open: dues pay link is a UPI ID in text (no clickable link); members reply to the GymDesk number, not the gym.

| ID | Task | Status | Acceptance |
| --- | --- | --- | --- |
| 1B-01 | WhatsApp template sender (never throws, timeouts) and opt-in flag per member | WRITTEN | Replaces free-text sender on branch `charles` |
| 1B-02 | Renewal reminders at 30, 7, 1 day and at lapse; dues chase with Razorpay payment link | WRITTEN | Member pays link, record updates itself |
| 1B-03 | Absence alert (10 days) and one-tap win-back message | WRITTEN (Win Back Members screen, `tests/retention.test.js` not run) | |
| 1B-04 | Owner daily summary message | WRITTEN | |
| 1B-05 | Setup wizard and demo data; Excel/CSV member import with preview and error list | WRITTEN (import + dashboard checklist + printable Entrance Poster with QR to the member sign-in page, `tests/poster.test.js` never run; needs `CLIENT_URL` set) | 100 members imported in under 5 minutes |
| 1B-06 | Device user ID on Member and SubAdmin; import device logs (CSV/Excel) into Attendance with `method: biometric` | WRITTEN | Duplicates ignored; unmatched IDs listed |
| 1B-07 | Staff attendance (QR/manual), leave and late marks | WRITTEN | |
| 1B-08 | Landing page, pricing page, legal pages (terms, privacy, refund), city pages template | WRITTEN (legal drafts, company details from `VITE_*` env, decoy contact form removed; lawyer review and city pages still open) | Razorpay website-policy needs met |

## Phase 1c: Language and support

| ID | Task | Status | Acceptance |
| --- | --- | --- | --- |
| 1C-01 | i18n framework; move all UI text to language files; English, Tamil, Hindi | PARTIAL (framework `client/src/i18n`, English text is the key; menu, header, trial banner, Dashboard, setup checklist, sign-in, sign-up, Billing, Members, Attendance, Payment and Win Back translated; language picker in header; every other screen still English; Tamil and Hindi need native review) | Language switch per user; no hard-coded text left |
| 1C-02 | Help centre (top 20 articles), in-app help links | WRITTEN (13 articles at `/help`, search, link in account menu and footer) | |
| 1C-03 | Support chatbot on WhatsApp with hand-over; support tickets (reuse existing Ticket model) | WRITTEN (owner Help & Support page + tickets; WhatsApp bot for gym owners: webhook `/api/payments/whatsapp-webhook`, answers from help articles, AGENT or unsure creates one ticket then goes quiet for a day, demo mode without credentials; tests not run; needs the WhatsApp number, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`) | |
| 1C-04 | Global-ready settings: currency, tax label and rate, timezone, country code per gym | PARTIAL (country, currency, time zone, language saved per gym with checks, Settings card; `tests/settingsRegionBranding.test.js` not run. NOT yet used: automations still run on IST and English templates, invoices are INR + GST only) | INR/GST default |

## Phase 1e: AI features (added 28 Oct for the launch story)

| ID | Task | Status | Acceptance |
| --- | --- | --- | --- |
| 1E-01 | Ask GymDesk assistant (answers from help articles, article search when no key or cap used, monthly cap per plan) | WRITTEN | `tests/aiAssistant.test.js`, `tests/aiAssist.unit.test.js` (10/10 via shim) |
| 1E-02 | Weekly AI insights card on owner dashboard (totals only, AI at most weekly, rules fallback daily) | WRITTEN | no names or phones in the model prompt |
| 1E-03 | AI plan generation: cheaper model default via `AI_PLAN_MODEL` (old code used a model name that may not exist) | WRITTEN | plan generation works with the key set |
| 1E-04 | Marketing claims list `docs/MARKETING_CLAIMS.md` | WRITTEN | landing copy matches |
| 1E-05 | AI cost check after 1 week of use; adjust `aiCallsPerMonth` in `plans.js` | TODO (human data) | |

## Phase 1f: Autopilot and Super Admin (added 28 Oct)

| ID | Task | Status | Acceptance |
| --- | --- | --- | --- |
| 1F-01 | Super Admin "Business Overview" page (MRR, gyms by status, trials ending, renewals due, lapsed, latest payments, AI calls, give days with reason) | WRITTEN | `client/src/pages/root-admin/BusinessOverview.jsx` |
| 1F-02 | Automatic owner emails: welcome, trial ending (3, 1 days), renewal due (7, 1), grace, expired; once each, 10:00 to 20:00 IST; needs SMTP | WRITTEN | `tests/ownerNotices.test.js` not run |
| 1F-03 | Data export CSV (members, payments, attendance) for owners, works when read-only; promised in Terms and Help | WRITTEN | `tests/export.test.js` not run |
| 1F-04 | WhatsApp version of owner billing messages | BLOCKED (needs WhatsApp number and approved templates) | |

## Phase 1d: Test and soft launch

| ID | Task | Status | Acceptance |
| --- | --- | --- | --- |
| 1D-01 | Full QA workbook run; all P1 pass; Business Rules R01 to R30 decided | TODO (human + Claude) | Dashboard gate READY |
| 1D-02 | 10 invited gyms on paid plans | TODO (human) | |
| 1D-03 | Turn on `PUBLIC_SIGNUP=true`, start ads at Rs 1,000/day | TODO (human) | |

## Phase 1g: Super Admin completeness (added 28 Oct, owner direction)

Priority: L = before launch (only these three, see D-03), A = first month after soft launch, B = later. Days are estimates for Claude-written code, excluding human test time. Existing: Business Overview page (1F-01), give days with logged reason (1A-07), tickets, promo codes through the API only (2-01), `AuditLog` model (viewer not checked).

| ID | Task | Pri | Days | Status |
| --- | --- | --- | --- | --- |
| SA-03 | AI and WhatsApp usage with caps and alerts for every business in every product, plus a platform daily budget stop and token/rupee cost from `AiUsage` (ties to 1E-05, D-13, D-15) | L | 3 | WRITTEN (not yet tested): services/aiBudget.js, Root Admin API + screen (AI & WhatsApp Usage), tests aiBudget.unit (checked in plain node) and usageBudget (DB, not run). Default daily budget Rs 500 is an assumption |
| SA-04 | Founder daily brief by email (MRR, new and lost gyms, failed payments, tickets, AI cost, risks) | L | 2 | TODO |
| SA-05 | Promo and referral code screen in Root Admin (API exists) | L | 1.5 | TODO |
| SA-01 | Gym health score and churn-risk list from usage signals, with an automatic nudge to the owner | A | 3 | TODO |
| SA-02 | Support inbox with AI triage, reply drafts, auto-answer from help articles, SLA timers | A | 3 | TODO |
| SA-06 | Plan and limit overrides and feature flags per gym, each with a logged reason | A | 2 | TODO |
| SA-07 | View-as-gym for support: read-only, logged, time-limited | A | 2 | TODO |
| SA-08 | Audit-log viewer with filters and export | A | 1.5 | TODO |
| SA-09 | Announcements to all or selected gyms (in-app and email) | B | 1.5 | TODO |
| SA-10 | Platform team roles: support, finance, read-only | B | 2 | TODO |
| SA-11 | Refund and credit note tool with approval (needs CA wording, Tier 3) | B | 3 | TODO |
| SA-12 | Data export and delete on request (DPDP; lawyer review) | B | 2 | TODO |
| SA-13 | Trial-abuse and fake sign-up detection | B | 2 | TODO |
| SA-14 | Cohort retention and MRR movement analytics | B | 2 | TODO |

## Phase 3-AI: AI-first features (added 28 Oct, owner direction: AI is the main story)

Rule: nothing here is advertised until it is built, tested by a human and listed in `docs/MARKETING_CLAIMS.md`. AI never gets raw database access; it uses a short list of read-only, tenant-scoped tools. Member names and phones are not sent to the model unless the feature needs them and the claims list says so.

| ID | Task | Pri | Days | Status |
| --- | --- | --- | --- | --- |
| AI-01 | Renewal Copilot: daily ranked list of who to chase, why, and a ready message (Tamil, English, Hindi). Works before Meta approval: a tap opens WhatsApp on the owner's own phone with the message filled in; automatic sends use approved templates once live | L (owner, 28 Oct) | 3 | WRITTEN (28 Oct; not yet tested: `tests/copilotRules.unit.test.js` 8/8 pass via shim; `tests/copilot.test.js` needs Dev A; screen `client/src/pages/admin/Copilot.jsx` never built. Ranking is rules, not AI; AI only rewrites a message template, no member data sent, counted in the monthly AI cap. Tamil/Hindi wording needs native review. Automatic sends after Meta approval still to do) |
| AI-02 | Ask GymDesk on your own data via safe read-only tools (dues, expiring, absent, collections) | L (owner, 28 Oct) | 3 | WRITTEN (not yet tested): server/services/askData.js, tests askData.unit.test.js (pure, checked with plain node) and askData.test.js (DB, not run) |
| AI-03 | Register import from a photo or PDF of the paper register, with preview and correction | A | 3 | TODO |
| AI-04 | Churn risk that explains why, plus an automatic win-back sequence | A | 3 | TODO |
| AI-05 | Weekly owner coach: 3 actions with expected rupee impact, then tracks whether they were done (upgrade of 1E-02) | A | 2 | TODO |
| AI-06 | WhatsApp assistant for members (timings, dues, class booking); blocked until WhatsApp is live | B | 4 | BLOCKED |
| AI-07 | Anomaly alerts: heavy discounts, proxy check-ins, cash that does not match | B | 3 | TODO |
| AI-08 | Offer and message writer for owners in Tamil, Hindi and English | B | 2 | TODO |
| PWA-01 | Installable web app (manifest, icons, service worker) so owners can add GymDesk to a phone or computer; data download already exists (1F-03). No app-store accounts needed | L (owner, 28 Oct) | 1.5 | WRITTEN (28 Oct; not yet tested: manifest, 3 icons, `public/sw.js`, registered in `main.jsx` in production only; the service worker stores app files only, never API data. Needs a real phone test; the host must serve `/sw.js` and `/manifest.webmanifest` from the site root) |
| AI-00 | OpenAI provider layer for all products (D-15): `services/aiProvider.js` (fetch, no new package), `AI_PROVIDER`, `OPENAI_API_KEY`, `AI_MODEL`, `AI_PLAN_MODEL`; `AiUsage` now records model and tokens. Old Anthropic code removed from services (the `@anthropic-ai/sdk` entry stays in `package.json` until Dev A can regenerate the lock file) | L | 1 | WRITTEN (not yet tested: `tests/aiProvider.unit.test.js`, `tests/aiAssistant.test.js`; real model names and `reasoning_effort` unverified) |
| PRICE-02 | AI call caps by plan from `docs/AI_COST_MODEL.md` (Starter 40, Growth 120, Pro 300). Tier 3: plan limits need Mohamed's OK; `plans.js` unchanged until then | L | 0.2 | WRITTEN (approved as D-16; `plans.js` and Pricing page changed; not yet tested) |
| PRICE-01 | Cap on AI workout/diet plan generations per plan per month in `plans.js` (cost model assumes 30 on Growth, 100 on Pro) | L | 0.5 | TODO |

## Phase 2 and 3

See `docs/SCOPE.md` section 4.

| ID | Task | Status | Test |
| --- | --- | --- | --- |
| 2-01 | Discount, partner and referral codes at checkout (percent off before GST, max 50%, first payment only by default, plan limits, expiry, max uses, counted once per payment, shown on invoice). Root Admin API `/api/root-admin/promo-codes`; owner box on Billing page | WRITTEN (`tests/promoCodes.test.js`, never run). No Root Admin screen yet: codes are made through the API. Gym-to-gym referral rewards not built | Dev A runs the test; creates a code; pays with it in Razorpay test mode and checks the invoice |
| 2-02 | Class booking with waitlist: owner adds one-off classes (name, time, seats), members book from their app, full classes waitlist, cancel promotes the next person, in-app notice, owner can book/remove/cancel class. Open to all plans | WRITTEN (`tests/classBooking.test.js`, never run). No WhatsApp notice for promotion; repeating weekly classes not built | Dev A runs the test; Staff try booking as two members for a 1-seat class |
| 2-04 | Excel reports: members, payments, attendance already download as CSV that opens in Excel (Tamil safe). Real .xlsx needs a new library, decide later | PARTIAL | |
| 2-05 | Staff payroll (engine ported from TeamPulse; ESI and PF off): salary per person, loss of pay from staff attendance (26 working days), PT commission from collected PT payments, advances with recovery, draft then lock, payslip PDF. Owner only, Growth and Pro (Accounts feature) | WRITTEN. Pure maths tests ran and passed (9 of 9) with a stand-in runner; DB and PDF tests (`tests/payroll.test.js`) never run. Payslip PDF prints "Rs" and Latin letters only (Tamil names show as ?). No WhatsApp payslip send, no ESI/PF screens, no half-day attendance | Dev A runs `npm test -- payroll`; owner makes a run for a past month and checks every payslip by hand |
| 2-06 | Member AutoPay (Razorpay subscriptions) | TODO (risky, needs live testing) | |
| 2-03 | Live biometric sync and door control | BLOCKED (needs a real device and vendor spec) | |

## Open questions

See `docs/SCOPE.md` section 9.

## Phase P: Product suite and shared core (added 28 Oct, owner decision D-09: real products, no waitlist launches)

Scope files: `docs/products/README.md` (index and rules), `CORE.md`, and one `SCOPE.md` per product. Product task IDs (SAL, MRT, DIN, CLO, WSH, HIR) are created from each scope's phase 1 list when its core modules exist. Owner target start dates: Salon 13 Nov, Mart 16 Nov, Dine 19 Nov, Cloth 22 Nov, Wash 25 Nov, Hire 28 Nov. Claude reports date confidence in each Daily Brief.

| ID | Task | Pri | Status |
| --- | --- | --- | --- |
| C-01 | Package boundaries, architecture note, no-cross-product-import check | L | TODO |
| C-02 | `core-pos`: customer, billing/POS (offline), loyalty, inventory, with tests; first user Salon, then Mart | L | TODO |
| C-03 | Fail-closed tenant plugin, a test per model | L | TODO |
| C-04 | Move billing, plans, WhatsApp, caps, Super Admin into packages; gym consumes them only after Dev A's first green run | A | TODO |
| C-05 | Business-type switch and per-product presets | L | TODO |
| P-R | Research tasks per product (SAL-R1, MRT-R1, DIN-R2, CLO-R1, WSH-R1, HIR-R1): verify competitor features and policies; replace Assumptions in scope files | L | TODO |
| P-P | Floor-price tables per product (SAL-P1, MRT-P1, DIN-P1, CLO-P1, WSH-P1, HIR-P1), same method as the gym; Mohamed approves (Tier 3) | L | TODO |
| P-QA | Product QA workbooks and Dev B attack lists per product | L | TODO |
| P-LAND | Landing page and claims file per product, matching `MARKETING_CLAIMS.md` rules | L | TODO |

| DEP-01 | Gym on the Hostinger VPS: runbook `docs/DEPLOY_VPS.md` (nginx, systemd, certbot, Atlas allowlist, single instance) | WRITTEN (not run); waits for server hardening step 12 |
