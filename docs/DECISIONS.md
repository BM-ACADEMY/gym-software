# Decisions: open questions and the log

Format of an open item: question, Claude's recommendation, default if no answer, what it blocks, tier (see `OPERATING_RULES.md`).
Mohamed answers in one line. Claude moves answered items to the log in the next commit.

## Open: needs Mohamed (updated 29 Oct)

| ID | Question | Recommendation | If no answer | Blocks | Tier |
| --- | --- | --- | --- | --- | --- |
| D-22 | Monthly limit on AI workout/diet plan generations (PRICE-01): Growth 30, Pro 100, Solo and Starter 0 (feature off) | Yes (these are the numbers `docs/AI_COST_MODEL.md` assumes) | Stays in code on the branch only; nothing is deployed | Gym floor price at full use; Pricing page wording | 3 |
| D-23 | Floor-price method for the six new products: need master plan section 14 (overheads, margin, safety factor) | Send the file | No shop price table; prices stay drafts | Price approval for Salon, Mart, Dine, Cloth, Wash, Hire | 3 |

## Open: Tier 2, proceeding on default (veto any time)

| ID | Item | Default being used |
| --- | --- | --- |
| D-06 | Refund window for the first payment | 7 days, first payment only (`VITE_REFUND_DAYS`); legal pages stay drafts until a lawyer reviews them |
| D-07 | Business rules R01 to R30 in the QA workbook | Claude proposes safe defaults in a table for Mohamed to scan; none go live without the QA gate |
| D-08 | Product name | Working name GymDesk (candidate RepSetu); interim address fit.afraventures.in; final name after the launch gate |


## Still waiting on people, not decisions (see `BACKLOG.md` phase 0)

Every task below is a row in the team task sheet (`docs/TEAM_TASK_SHEET.xlsx`, one tab per person, detailed steps; the owner puts it in Google Drive so devs can edit online). The older shared doc https://claude.ai/artifact/NwcPRQpgvbWifhqTzRetd1 is superseded by it. Claude reads it at the start of each session and fixes reported failures first.

- Dev A: run `cd server && npm install && npm test`, then `cd client && npm install && npm run build`; send back any red output. Follow `docs/TEST_RUNBOOK.md`.
- Dev A: paid hosting, Atlas backups with one restore drill (`docs/OPS.md`), uptime monitor.
- Mohamed or Dev A: change every password that was ever in `HANDOVER.md` (history still has them), then confirm.
- Mohamed: WhatsApp Business application with a separate GymDesk number (critical path, target approval 12 Nov); Razorpay test keys; CA check on GST invoices and the SAC code.

## Log

| Date | Decision | By |
| --- | --- | --- |
| 2026-10-28 | Repos set to private; Claude given access to `gym-software` and `payroll` | Mohamed |
| 2026-10-28 | Salon is the first product after the gym; shared core is a monorepo with shared packages | Mohamed |
| 2026-10-28 | Gym name can be any working name for now; final name decided after the launch gate | Mohamed |
| 2026-10-28 | Claude works on its own and Mohamed reviews 5 to 10 minutes a day; work never stops for a pending decision (`OPERATING_RULES.md`) | Mohamed |
| 2026-10-28 | Direction: AI is the main story and the Super Admin must be a complete SaaS back office. How to market it is D-02 | Mohamed |
| 2026-10-28 | D-01 answered: all products start first-phase launches on 10 Nov, one every 3 days. Reading and limits in D-09 | Mohamed |
| 2026-10-28 | D-02 answered: the first phase must be AI-driven. Pulled into launch scope: AI-01 Renewal Copilot and AI-02 Ask GymDesk on your own data, plus PWA-01. Claims still follow only what is built and tested | Mohamed |
| 2026-10-28 | D-03 answered: yes, launch scope frozen at the backlog plus SA-03, SA-04, SA-05 and the AI items above | Mohamed |
| 2026-10-28 | D-04 answered: no fixed offer; Claude builds a cost-based price model so that nobody says no and there is no loss. Result in D-10 | Mohamed |
| 2026-10-28 | Dev work runs in parallel: Claude does not wait for the team; every dev task is a row in the Dev Task Sheet (a shared doc) | Mohamed |
| 2026-10-28 | Gym address: fit.afraventures.in (app) and api.fit.afraventures.in (API) | Mohamed |
| 2026-10-28 | Earlier decisions: see `SCOPE.md` section 8 | Mohamed |
| 2026-10-28 | D-12: start with ONE Afra Ventures WhatsApp number for all products (display name must match the website). Template names are prefixed per product (gym_, salon_). Number is a per-product setting so it can be split later without code change. Revisit when volume grows or a quality warning appears | Mohamed (Claude recommends) |
| 2026-10-28 | D-13: every AI/WhatsApp feature has a per-plan monthly cap, a per-gym usage view (SA-03), a platform-wide daily budget stop, and a spend limit set in the OpenAI dashboard | Mohamed |
| 2026-10-28 | D-09 answered: NO demo or waitlist launches. Every product's phase 1 is real, competitive software, planned like the gym (scope file, phases, backlog, tests, QA gate). Dates 13 to 28 Nov stay as owner targets. Claude's risk note: shared core must be extracted first and human tests set the real dates; Claude reports date confidence in every Daily Brief | Mohamed |
| 2026-10-28 | D-10 answered: gym price table approved "for now" (Solo 249, Starter 599, Growth 999, Pro 1,999 ex GST; 3-month offers 499 / 849 / 1,799; Solo not for paid ads). To be re-checked after the AI provider change (D-15) and the first week of pilot data | Mohamed |
| 2026-10-28 | D-11 answered in part: Salon, Spa and Barber stay ONE product. Owner prefers the working name/address "groom" (groom.afraventures.in); plan tier and presets decide the rest. Claude default (Tier 2): address groom.afraventures.in as working name, three presets chosen at sign-up, plan tier sets limits; final name decided with D-08 | Mohamed |
| 2026-10-28 | D-05 answered: yes, daily autonomous run (scheduled task) on `phase1-autopilot`; never touches `main`, production or real customers | Mohamed |
| 2026-10-28 | D-14 answered: yes, Afra AI OS is Afra's internal sales and lead hub; not a host for products; no dependency for launch | Mohamed |
| 2026-10-28 | D-15 answered (changes Claude's recommendation): OpenAI for ALL products. Build one provider layer in `core-ai` (OpenAI default, model names in config) so the model can be changed without code changes. Price model section 14 to be re-run with OpenAI prices. Caps and usage for every product are managed centrally in Super Admin (SA-03 widened to all products) | Mohamed |
| 2026-10-28 | D-16 approved: monthly AI-call caps Solo 15, Starter 40, Growth 120, Pro 300 (`plans.js` and the pricing page updated; written, not yet tested) | Mohamed |
| 2026-10-28 | Team sheet is now a spreadsheet with detailed steps; new Hostinger KVM 2 server for Afra AI OS only (tab 'Afra AI OS server'); products on a paid always-on host and Atlas in an India region. Hosting spend still needs Mohamed's approval (M-09) | Mohamed |
| 2026-10-28 | D-17 answered (supersedes the hosting line above): plan Afra AI OS and ALL Afra SaaS products on the new Hostinger KVM 2 (200.141.15.246). Plan in `docs/HOSTING_PLAN.md`. Claude's guard: move products to their own server or KVM 4 before the 1 Dec gym launch or earlier if the load triggers in the plan are hit (spend is Tier 3) | Mohamed |
| 2026-10-29 | D-18: (1) the Salon, Spa and Barber product keeps the working name **groom** (groom.afraventures.in, WhatsApp template prefix `groom_`); (2) each product serves its API on the same name under `/api`, no separate `api.` name; (3) build the all-products Super Admin (stage 2) now, without waiting for test results | Mohamed |
| 2026-10-29 | D-19: accepted that autopilot means a co-pilot that watches, prepares, reminds and reports, default "suggest"; owners switch auto-send on per job. Marketing must not say "runs on its own" or "no work needed" until a human has seen it work. Hire agency two-step sign-in: default off, still open | Mohamed |

## D-19b (29 Oct): brand and Super Admin marketing autopilot
- Claude chooses taglines (easy, strategic, psychological); list in `docs/BRAND_AND_TAGLINES.md` section 6. Gym name stays Fit. Trademark checks when a brand reaches its target and converts.
- Super Admin gets marketing autopilot (push notifications, to-do, calendar, session plan, suggestions). Mohamed confirms every action. Plan: `docs/SUPER_ADMIN_AUTOPILOT.md`. Same idea added as owner-side suggestions in each product.
- Confirmed: phone push only. Channels: all. Content made by Mohamed's DM team; Claude drafts, DM team posts, Mohamed approves. New role "marketing" (SA-18).

## D-20 (29 Oct): Super Admin CRM
- Super Admin gets a CRM for leads, trials, renewals and follow-ups (`docs/SUPER_ADMIN_CRM.md`). Goal: more sign-ups and renewals.
- Claude's default (Mohamed may change): products send account-level facts (business, owner contact, plan, dates, last active) to Super Admin; no end-customer data. Human calls only, 10 am to 6 pm Monday to Saturday; no AI voice calls; auto-send only with approved templates and consent.
- D-20 update (29 Oct): Mohamed said to connect the CRM to Afra AI OS if possible. Direction: sales and renewal follow-ups run in the Afra AI OS Lead Hub; Super Admin supplies account facts and a daily contact CSV. Claude did not change the Afra AI OS repo; its brand and access decisions wait for Mohamed (`docs/AFRA_AI_OS_HANDOFF_PRODUCTS_SALES.md`). Leads sheet: shared only with Dev A, never in git or chat.

## D-21 (29 Oct): sales leads for Afra's products
- One Afra AI OS brand "AFRA Products" for all product sales and renewals; product and stage in `campaign`. People are telecaller or BD and will change; access granted per person, not fixed in code.
- Afra AI OS session must still log it in its own decisions and plan before building.

## D-22 (29 Oct): AI provider is OpenRouter, not OpenAI (supersedes the OpenAI part of D-15)
- Fact (Kamarudeen, 29 Oct): Aakash bought OpenRouter, not an OpenAI account.
- Code change (written, not yet tested with a real key): `server/services/aiProvider.js` now accepts `AI_PROVIDER=openrouter`. It uses `OPENROUTER_API_KEY` (server settings only), base URL `https://openrouter.ai/api/v1` (Assumption: verify on first call), and requires `AI_MODEL` and `AI_PLAN_MODEL` to be set to OpenRouter model names. Claude does not guess model names. OpenAI mode still works unchanged. Gym, Hire and every product that calls `complete()` pick this up with no other change.
- Privacy default: each request asks OpenRouter for zero-data-retention endpoints only (`provider.zdr: true`, from OpenRouter's ZDR page). If a chosen model has no such endpoint the call will fail; Dev A tells Kamarudeen before anyone sets `AI_OPENROUTER_ZDR=off`.
- Money: the daily AI budget uses a price table keyed by model name; OpenRouter models not in the table are priced at the safe-side fallback, so spend figures are estimates until Dev A adds the real per-token prices of the chosen models (`server/services/aiBudget.js`; Hire uses flat Rs per million tokens settings). Check the real spend on OpenRouter's dashboard against our figures after the first day.
- Open for Kamarudeen and the lawyer: Hire sends resume text (personal data) to an outside AI service. The privacy notice must say so, including that the service may process data outside India. Lawyer to confirm wording. Hire AI parsing stays off until then (set no key) unless Kamarudeen decides otherwise.
- Model chosen (Kamarudeen, 29 Oct): `openai/gpt-4o-mini`, already bought, balance 10 USD (about Rs 880 at the app's rate of Rs 88 per dollar; Kamarudeen, 29 Oct). Use it for both `AI_MODEL` and `AI_PLAN_MODEL`. Its price in `aiBudget.js` is an Assumption (OpenAI list price from memory) until Dev A checks OpenRouter's model page.
- Rough size (Assumption, not measured): one resume read is about 3,000 tokens in and 500 out, well under Rs 1. So the balance is a lot of reads; the real number comes from the first day's dashboard.
- Guard: the platform daily AI budget defaults to Rs 500, which would let a bug burn the whole 10 USD balance in two days. Recommend Dev A sets it to Rs 50 in Root Admin and `HIRE_DAILY_AI_BUDGET_INR=50` until real use is known. Also set a limit inside the OpenRouter account.
- Risk to check on the first call: if OpenRouter has no zero-retention endpoint for this model the call fails with a "no endpoints" style error; Dev A reports it to Kamarudeen before turning the setting off.


## D-24 (2 Nov): Hire outreach, assistant routing call, Hire two-step sign-in, refund window (Kamarudeen said "yes for all" to Claude's recommendations)
1. **Hire outreach is prepaid packs only, none included in any plan.** Pro resume reading cut from 2,000 to 1,000 a month until the real AI price is known. Code: `apps/hire/src/plans.js` (`outreachPerMonth` 0, Pro `parsesPerMonth` 1000; test `plans.test.js`). Prepaid packs are not built, so Hire cannot send candidate outreach yet (it is suggest-only anyway). Prices stay drafts (Tier 3) until Dev A reads the real model price. Basis: `docs/products/hire/FLOOR_PRICE.md`.
2. **The assistant's routing call is logged but not counted against the owner's monthly AI limit.** Its money still counts toward the platform daily budget; routing is capped at twice the plan limit a month as an abuse guard. Code: `server/services/aiAssist.js`, new usage kind `routing` (`models/AiUsage.js`); test `aiAssistant.test.js` updated. Written, not yet run (needs Dev A's database).
3. **Hire agency two-step sign-in: optional at launch, off by default, encouraged.** Compulsory later if the lawyer says so (M-15). Nothing to build now: the setting already stays off.
4. **Refund window: 7 days** (the draft), lawyer to confirm on the refund page.

## D-25 (2 Nov): web app and phone app
Kamarudeen agreed: (1) no Play Store or App Store app until **10 paying gyms** are live. **Reminder trigger:** every Daily Brief shows "Paying gyms: n of 10" (from Super Admin counts); when it reaches 10, the Brief's first line asks Kamarudeen whether to wrap the web app for Google Play (about 2 to 3 days of work; Apple later). (2) Team tests the home-screen install on a real Android phone and an iPhone. (3) A "Put GymDesk on your phone" hint is on the owner dashboard (hide button; hidden once installed). (4) Hire and Super Admin are installable the same way (manifest, icons, service worker that never stores /api calls). Store fees quoted earlier were from memory, not checked.

## D-26 (2 Nov, night): no native app for now
Kamarudeen: skip the Google Play / App Store app for now. The web app and home-screen install (PWA-02) are the only app form. No store work is planned or scheduled. The Daily Brief line "Paying gyms: n of 10" stays only as a reminder to ask again; it starts no work. Replaces the store part of D-25.

## D-27 (2 Nov, night): store app is planned (D-26 withdrawn)
Kamarudeen changed his mind: "Let's plan for it". Plan in `docs/STORE_APP_PLAN.md`: Android first (Trusted Web Activity), iPhone later (Capacitor), register as the Pvt Ltd (organization), owners' apps only, no plan purchase inside the app at first. Gate and costs there. D-26 (skip) no longer applies. Open for Kamarudeen: apply for the D-U-N-S number (S1); confirm the date or gate.

## D-28 (12 Nov): everything changeable without a deploy; Claude builds, the developer does only what Claude cannot
Kamarudeen: launch as soon as possible; anything he may want to update, add or change must be editable himself; the developer does only the minimum Claude cannot do (servers, secrets, running tests, accounts); Claude does the rest. Applied: (1) plan prices, limits and feature switches are editable in Root Admin > Plan settings (SET-01); code defaults stay the fallback; each change needs a written reason, is kept in a history, and a price below the cost floor needs an extra confirm. This also covers the plan-limit part of SA-06 for all gyms; per-gym overrides and view-as stay as in `docs/SUPER_ADMIN_SUPPORT_TOOLS.md`. (2) Next editable items: landing and pricing wording, FAQ, help articles, trial length, announcements (done in Super Admin), promo codes (done). WhatsApp template text is NOT editable: it must match what Meta approved.

## D-29 (12 Nov): Clinic is a preset of the Salon (groom) appointment product
Kamarudeen shared a clinic booking demo (a BM TechX design: body map, Tamil/English, instant or approve-each booking, follow-up lists, physio package progress) and said to add it to the plans and carry on in order: dynamic items, then Salon. Decision: Clinic is a fourth preset next to Salon, Spa and Barber (same appointments, reminders, packages, follow-up and win-back code), not a separate app. The demo is BM TechX's design work, so we reuse the ideas, not its text, names or code. Health records need lawyer review before any real clinic uses it; AI gives no medical advice. Open for the owner: product name and price ladder (Tier 3).
