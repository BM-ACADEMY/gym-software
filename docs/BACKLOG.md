# GymDesk Backlog

Status values: TODO, IN PROGRESS, WRITTEN (code pushed, not yet tested by a human), DONE (tests pass and merged), BLOCKED.
Claude: update this file in the same commit as the work. Work in ID order within a phase unless blocked.
Days are estimates for Claude-written code, excluding human test time.

## Phase 0: Safe base

| ID | Task | Status | Acceptance |
| --- | --- | --- | --- |
| P0-01 | Security fixes on `pilot-security-fixes` (commit 21cba9c) | WRITTEN | `npm test` passes incl. `tests/pilotSecurity.test.js`; Security and Tenant suites green on staging |
| P0-02 | Make GitHub repo private, change every password that was in HANDOVER.md | TODO (human) | Old passwords fail |
| P0-03 | Production env set from `server/.env.example`; paid hosting; Atlas backups, one restore tested | TODO (human) | Restore drill done |
| P0-04 | Log the 25 failed P1 tests from the QA workbook as bugs | TODO (human) | Bug Log filled |
| P0-05 | Razorpay exists (get test keys via Dev A, confirm company name + GST). Apply for WhatsApp Business API (separate GymDesk number). CA check on GST invoices. No SMS/DLT | TODO (human) | WhatsApp application submitted; test keys saved in Settings |

## Phase 1a: Money

Progress 24 Oct: dev branch `charles` merged in. 1A-01/02/03 written (plans in `server/config/plans.js`, status in `server/services/subscription.js`, `POST /api/auth/signup`, `GET /api/admin/subscription`). Pure logic checked 11/11 with a shim; DB tests in `tests/signup.test.js` not run. Legacy `PlatformPlan` kept for old pilot gyms only. 28 Oct: 1A-04 (checkout, confirm, webhook, idempotent activation, upgrade credit) and 1A-05 (gap-free GST invoice numbers per financial year, PDF) written in `services/subscriptionBilling.js`, `services/billingMath.js`, routes under `/api/admin/subscription`, webhook `/api/payments/razorpay-webhook`. Pure maths checked 26/26 with a shim; `tests/billingFlow.test.js` not run. Needs: Razorpay test keys in Root Admin Settings, `RAZORPAY_WEBHOOK_SECRET`, webhook URL set in Razorpay dashboard for events payment.captured and payment.failed, CA check on SAC code and GST mode. 1A-07 (`GET /api/root-admin/subscriptions/overview`, `POST .../:id/extend` with logged reason) and 1A-08 (`GET /api/internal/billing-reminders`, header `x-internal-key` = `INTERNAL_API_KEY`) written; `tests/superAdminBilling.test.js` not run. 1A-06 written for PT and accounts (branding gate still to do with the UI). Client written (syntax-checked only, never built): password sign-up page, `Plan & Billing` page with Razorpay Checkout and invoice download, trial/overdue banner, honest Pricing page. Removed made-up claims from the landing page (500+ gyms, 99% retention, fake testimonials, BMI). GST rule decided 28 Oct: buyer in Puducherry (seller state, env `SELLER_STATE`) gets CGST+SGST, every other state gets IGST; state is asked at sign-up and before first payment. Next phase 1b: WhatsApp template sender + renewal/dues/absence/daily-summary automations, setup wizard + Excel import, staff attendance, device-log import, signed QR, landing polish, legal pages (terms/privacy/refund wording needs CA/lawyer).
 (2 to 3 days of Claude coding each unless noted)

| ID | Task | Status | Acceptance |
| --- | --- | --- | --- |
| 1A-01 | Code-defined plans (`server/config/plans.js`): starter, growth, pro, trial; limits and feature list; replace `PlatformPlan`/`PlanFeature` use and `planFeatureGuard` | WRITTEN | Seed script gone; guards read config; existing tests updated |
| 1A-02 | Subscription status from dates on every request (trial, paid until, grace, suspended); 402 `subscription_expired` except billing and account routes | WRITTEN | Replaces interim trial lock in `middleware/auth.js` |
| 1A-03 | Self-serve sign-up (password), 14-day trial on Growth, welcome state | WRITTEN | New gym created with trial dates; no OTP dependency |
| 1A-04 | Razorpay billing port: price on server, order, checkout verify, webhook (raw body), idempotent activation, credit for unused days on upgrade | WRITTEN | Test-mode payment activates plan; repeat webhook is a no-op; amount mismatch fails |
| 1A-05 | GST invoice numbers (gap-free, restart 1 April), CGST/SGST/IGST split, printable invoice | WRITTEN | Invoice matches CA-approved wording |
| 1A-06 | Gate every route by plan feature and member/staff limits (PT, earnings, accounts, analytics, branding, reminders) | TODO | QA tests GATE-05 to GATE-15, PLAT-02 to PLAT-18 pass |
| 1A-07 | Super admin overview: companies by status, MRR, trials ending, give days, suspend, with logged reason | WRITTEN | No access to a gym's member data |
| 1A-08 | Billing reminder list endpoint for the scheduler (trial_ending, renewal_due, expired) protected by internal key | WRITTEN | |

## Phase 1b: Retention and setup

Progress 28 Oct: 1B-01 to 1B-04 written. `utils/whatsapp.js` sends approved templates only (demo mode logs text when no credentials); `services/automations.js` runs every 15 min (renewals at 30/7/1 days and +1/+7 after end, weekly dues up to 4, 10-day absence, owner summary at 8 pm IST; 9am to 9pm IST for members; each message has a unique dedupe key; per-plan monthly quota; skipped for locked gyms). Old SMS channel now off unless `SMS_ENABLED=true`. Templates to submit to Meta: `docs/WHATSAPP_TEMPLATES.md`. Tests `tests/automationRules.unit.test.js` (10/10 via shim) and `tests/automations.test.js` (not run). Also written: member import (`POST /api/admin/members/import`, preview then commit), device-log import (`POST /api/admin/attendance/device-log`, members to check-ins, staff to daily attendance), staff attendance (`/api/admin/staff-attendance`), device ID on member/staff forms. Pure parts checked by shim: 45/45 across 5 unit files. UNVERIFIED: Excel (.xlsx) reading uses `read-excel-file` (added to client package.json; Dev A runs `npm install`); how it returns date and time cells must be tested with a real device export. Also: member QR now signed with HMAC (`QR_SECRET` or JWT_SECRET); old unsigned QRs are refused and members see the new one in their app. Onboarding checklist on owner dashboard. Open: dues pay link is a UPI ID in text (no clickable link); members reply to the GymDesk number, not the gym.

| ID | Task | Status | Acceptance |
| --- | --- | --- | --- |
| 1B-01 | WhatsApp template sender (never throws, timeouts) and opt-in flag per member | WRITTEN | Replaces free-text sender on branch `charles` |
| 1B-02 | Renewal reminders at 30, 7, 1 day and at lapse; dues chase with Razorpay payment link | WRITTEN | Member pays link, record updates itself |
| 1B-03 | Absence alert (10 days) and one-tap win-back message | WRITTEN | |
| 1B-04 | Owner daily summary message | WRITTEN | |
| 1B-05 | Setup wizard and demo data; Excel/CSV member import with preview and error list | WRITTEN (import + dashboard checklist) | 100 members imported in under 5 minutes |
| 1B-06 | Device user ID on Member and SubAdmin; import device logs (CSV/Excel) into Attendance with `method: biometric` | WRITTEN | Duplicates ignored; unmatched IDs listed |
| 1B-07 | Staff attendance (QR/manual), leave and late marks | WRITTEN | |
| 1B-08 | Landing page, pricing page, legal pages (terms, privacy, refund), city pages template | WRITTEN (legal drafts, company details from `VITE_*` env, decoy contact form removed; lawyer review and city pages still open) | Razorpay website-policy needs met |

## Phase 1c: Language and support

| ID | Task | Status | Acceptance |
| --- | --- | --- | --- |
| 1C-01 | i18n framework; move all UI text to language files; English, Tamil, Hindi | TODO | Language switch per user; no hard-coded text left |
| 1C-02 | Help centre (top 20 articles), in-app help links | TODO | |
| 1C-03 | Support chatbot on WhatsApp with hand-over; support tickets (reuse existing Ticket model) | TODO | |
| 1C-04 | Global-ready settings: currency, tax label and rate, timezone, country code per gym | TODO | INR/GST default |

## Phase 1d: Test and soft launch

| ID | Task | Status | Acceptance |
| --- | --- | --- | --- |
| 1D-01 | Full QA workbook run; all P1 pass; Business Rules R01 to R30 decided | TODO (human + Claude) | Dashboard gate READY |
| 1D-02 | 10 invited gyms on paid plans | TODO (human) | |
| 1D-03 | Turn on `PUBLIC_SIGNUP=true`, start ads at Rs 1,000/day | TODO (human) | |

## Phase 2 and 3

See `docs/SCOPE.md` section 4. Not started.

## Open questions

See `docs/SCOPE.md` section 9.
