# GymDesk: Finalized Project Scope and Phases

Last updated: 2026-10-23. Owner: Mohamed Kamarudeen B (Afra Ventures Pvt Ltd).
This file is the single source of truth for what we are building, in what order, and why.
Task-level status lives in `docs/BACKLOG.md`. Decisions live at the bottom of this file.

## 1. Goal

A self-serve gym management SaaS that runs on autopilot: a gym owner finds the landing page,
starts a free trial, imports members, pays, renews and gets support without talking to anyone.
Sold in India first (Tamil Nadu and Puducherry, then all India), built so it can be sold globally later.

Working name: GymDesk (candidate: RepSetu, undecided). Tagline idea: "Your gym, on autopilot."

## 2. How we work (built with Claude)

- Claude writes the code, tests and docs on branches. The dev team tests, deploys, holds accounts.
- Claude's cloud workspace cannot run `npm install` (registry blocked) or the app, so nothing Claude
  writes is trusted until a human runs `cd server && npm install && npm test` and staging checks.
- One cycle: Claude pushes a branch and writes what to test, a human tests within one working day,
  Claude fixes, repeat. A phase is done when its gate (section 5) is green.
- Account approvals (Razorpay KYC, SMS DLT, WhatsApp Business) take 1 to 3 weeks and are the real
  critical path. They start on day 1.

## 3. Phase 1 scope (public self-serve launch)

Must have, because an owner needs it to say yes or we cannot sell without it:

1. Landing page: pricing, demo video, FAQ, WhatsApp contact, Tamil and English.
2. Self-serve sign-up, 14-day free trial, no card, phone or email with password.
3. Setup wizard: gym details, membership plans, import members (Excel/CSV), add staff, print QR poster.
4. Flat plans, every core feature included, limits by member count only. No card fees, no add-ons.
5. Pay and renew: Razorpay, prepaid monthly or yearly (yearly = 10 months price), GST invoice,
   read-only lock when unpaid (data kept, 3-day grace), reminders before expiry.
6. WhatsApp for the gym's own members: renewal reminders (30, 7, 1 day before expiry, and at lapse),
   dues chase with a UPI pay link. Approved templates only for business-initiated messages.
7. Absence alert after about 10 days without a check-in, with a one-tap win-back message.
8. Owner daily summary on WhatsApp (check-ins, cash collected, dues, renewals due).
9. Attendance: QR, manual, and device-log import (CSV/Excel from any biometric device),
   device user ID on members and staff, staff attendance (QR/manual, leave, late marks).
10. Already built, keep and gate by plan: QR check-in, member web app, PT sessions with trainer
    commission, accounts and expenses, AI workout and diet plans (bonus, not the headline), roles.
11. English, Tamil and Hindi interface, language switch per user, all text in language files.
12. Support: help centre, in-app help, WhatsApp chatbot with hand-over to a person, tickets.
13. Super admin: trials, revenue (MRR), payments, suspend or extend with a logged reason.
14. Security fixes (done on branch `pilot-security-fixes`), backups, uptime and error alerts.
15. Global-ready settings: currency, tax label and rate, timezone, country code stored per gym.
    Only INR and GST are switched on in Phase 1.

## 4. Later phases

Phase 2 (about 4 weeks after launch):
- Live biometric sync (ZKTeco-compatible devices send check-ins to our server; bridge program for
  devices that cannot). Needs one real device and the vendor spec. Do not build blind.
- Door blocking: disable expired members on the device, enable on renewal.
- Staff payroll: salary by days present, PT commission, advances, payslip PDF (port TeamPulse engine).
- Member AutoPay, class booking with waitlist, referral and partner codes, Excel reports.

Phase 3 (from about March 2027): Stripe and USD, local payment methods by country, VAT templates,
more languages (Arabic RTL, Spanish, Indonesian), regional price lists, second data region if required.

Not planned: white-label mobile app stores, POS, BMI devices, multi-branch (add later at +50% per branch).

## 5. Timeline and gates (built with Claude, stretch target)

Targets assume a human tests each branch within one working day and accounts are approved by 12 Nov.
Fallback public date if either slips: 15 Dec 2026.

| Phase | Dates | Work | Gate |
| --- | --- | --- | --- |
| 0. Safe base | 24 to 29 Oct | Test and merge `pilot-security-fixes`. 3 to 5 friendly gyms use it free. Apply for accounts on day 1 | Security and Tenant Isolation tests 100% pass, backup restored once |
| 1a. Money | 30 Oct to 8 Nov | Plan system in code, sign-up and trial, billing, GST invoice, lockout, super admin overview | Test gym signs up, pays, locks when unpaid, unlocks on payment |
| 1b. Retention and setup | 9 to 20 Nov | WhatsApp renewals and dues, absence alerts, daily summary, wizard, import, staff attendance, landing page | New gym imports 100 members and gets a real WhatsApp reminder |
| 1c. Language and support | 16 to 25 Nov | Tamil and Hindi, help centre, chatbot, tickets | Tamil tester completes setup and a support question alone |
| 1d. Test and soft launch | 26 to 30 Nov | Full QA workbook run, fixes, 10 invited gyms on paid plans | All P1 tests pass, 10 gyms active, no payment or data incident |
| Public launch | 1 Dec 2026 | Landing page opens, ads start at Rs 1,000 a day | Cost per paying gym under Rs 3,000, watched weekly |

## 6. Pricing (India, excluding 18% GST)

| Plan | Monthly | Yearly | Limits |
| --- | --- | --- | --- |
| Starter | Rs 599 | Rs 5,999 | 150 members, 2 staff |
| Growth (default) | Rs 999 | Rs 9,999 | 500 members, 5 staff, PT, accounts, AI plans, WhatsApp allowance |
| Pro | Rs 1,999 | Rs 19,999 | Unlimited members and staff, higher WhatsApp allowance, branding |

- 14-day free trial of Growth, no card. Launch offer "Start" at Rs 249 a month for 12 months (cap 150
  members, 90 days or first 150 gyms) is OPEN: confirm with Mohamed before building.
- Marketing messages are prepaid packs only (Meta charges about Rs 1.09 each). Reminders cost about Rs 0.145.
- Global list (proposal, untested): about USD 19 / 39 / 79 a month. Placeholders until tested.
- Rivals abroad charge USD 75 to 230 a month; Indian rivals Rs 300 to 2,999 a month.

## 7. Architecture notes for whoever codes next

- Stack: Node/Express 5, Mongoose 9, JWT; React 19 + Vite + Redux Toolkit + Tailwind 4. MongoDB Atlas.
- Tenancy is by `subscriberId` filtering written by hand in each controller (not automatic). Every new
  query on tenant data must filter by `req.user.subscriberId`. `tests/multiTenantIsolation.test.js` is the gate.
- Plans are being moved from the database (`PlatformPlan` + `PlanFeature`, inconsistent with the seed
  script) to a code-defined config like TeamPulse's `server/src/config/plans.js`.
- Reference implementation to port from: repo `afraventurepvt-create/payroll` (TeamPulse):
  `server/src/billing/*`, `config/plans.js`, `whatsapp/sender.js`, `jobs/billing.js`, `routes/internal.js`,
  `employees/csv.js`, `docs/STAGE4.md`. Its DB tests were never run; treat ported code as unproven.
- Production safety rules already in code (do not undo): no demo OTP in production, no
  `simulate-payment` in production, no fallback webhook secret, member self-pay route removed,
  rate limits on auth, `$`-key rejection, CORS allow-list via `CORS_ORIGINS`, public sign-up gated
  by `PUBLIC_SIGNUP` (turn on at launch).
- Money is whole rupees. Store a currency code next to every amount from now on.
- Never commit secrets. Gateway keys are saved by Root Admin in Settings, not in git.

## 8. Decisions made

| Date | Decision |
| --- | --- |
| 2026-10-09 | One public India price list; regional offers by coupon only |
| 2026-10-21 | Closed pilot first, then public; security fixes before anything else |
| 2026-10-23 | Phase 1 is the full self-serve product, not a closed pilot |
| 2026-10-23 | Prepaid periods (no AutoPay) for gym subscriptions, as in TeamPulse; AutoPay for members in Phase 2 |
| 2026-10-23 | AI is a bonus feature; lead with collections, retention, flat pricing |
| 2026-10-23 | Live biometric sync waits for a real device and the vendor spec |
| 2026-10-23 | Build global-ready settings now, sell outside India in Phase 3 |

## 9. Open decisions (ask Mohamed)

- Final product name (GymDesk vs RepSetu), domains, trademark.
- Rs 249 launch offer: yes or no.
- Legal entity that invoices (Afra Ventures Pvt Ltd) and GST registration (ask the CA).
- Which biometric devices the friendly gyms use.
- The 30 business rules (R01 to R30) in the QA workbook: Claude may propose safe defaults.

## 10. Accounts and inputs only a human can provide

Razorpay account in the company name (test keys first), SMS DLT registration, WhatsApp Business API
provider with Meta verification and approved templates, domain and email, production hosting
(paid instance, not free tier) and MongoDB Atlas with backups, uptime monitor and error tracking,
demo video, friendly pilot gyms.
