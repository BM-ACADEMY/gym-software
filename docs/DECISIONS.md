# Decisions: open questions and the log

Format of an open item: question, Claude's recommendation, default if no answer, what it blocks, tier (see `OPERATING_RULES.md`).
Mohamed answers in one line. Claude moves answered items to the log in the next commit.

## Open: needs Mohamed (updated 28 Oct, after his first answers)

| ID | Question | Recommendation | If no answer | Blocks | Tier |
| --- | --- | --- | --- | --- | --- |

## Open: Tier 2, proceeding on default (veto any time)

| ID | Item | Default being used |
| --- | --- | --- |
| D-06 | Refund window for the first payment | 7 days, first payment only (`VITE_REFUND_DAYS`); legal pages stay drafts until a lawyer reviews |
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

