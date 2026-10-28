# Decisions: open questions and the log

Format of an open item: question, Claude's recommendation, default if no answer, what it blocks, tier (see `OPERATING_RULES.md`).
Mohamed answers in one line. Claude moves answered items to the log in the next commit.

## Open: needs Mohamed (updated 28 Oct, after his first answers)

| ID | Question | Recommendation | If no answer | Blocks | Tier |
| --- | --- | --- | --- | --- | --- |
| D-05 | Turn on a daily autonomous run (a scheduled Claude session that works the Tier 1 and 2 queue each morning on `phase1-autopilot` and sends the Daily Brief; never touches `main`, production or real customers)? | Yes, once Dev A has run the tests one time so it builds on a known-good base | Not turned on | The 5 to 10 minute rhythm | 3 |
| D-10 | Approve the price table (section 14 of the master doc): Solo 249 (no paid ads), Starter 599, Growth 999, Pro 1,999 ex GST; launch offer for 3 months at Starter 499, Growth 849, Pro 1,799; no Rs 249-for-12-months offer | Yes. Offers sit above the floor price, so they cannot lose money even at full usage | Prices stay as the scope has them; no offer is built | Pricing page, checkout | 3 |
| D-11 | Salon, Spa and Barber/Grooming as one product (salon.afraventures.in) with three presets, instead of three products? | One product. About 80 percent of the work is shared | Claude plans one product | Salon scope | 3 |
| D-14 | Role of Afra AI OS (separate repo `afraventurepvt-create/afra-ai-os`): use it as Afra's internal sales and lead hub (ad leads, telecaller and field-agent follow-up, conversion reports) for selling the products. It does not host or run any customer product; separate stack, hosting and logins. Later link: one-way, authenticated events (sign-up, trial, payment) from products into its leads | Yes. Do not wait for it: its own plan puts the Gym brand last (Phase 5), so the 10 Nov gym launch must not depend on it | Products sell through WhatsApp/ad links and Super Admin only | Sales funnel, agent payouts | 3 |
| D-15 | AI provider. Afra AI OS plans OpenAI for internal agents; our products are costed on Anthropic (price model section 14). Keep each on its own key, budget and cap; do not mix inside a product | Yes, separate | Products stay on Anthropic | AI cost model | 3 |

## Open: Tier 2, proceeding on default (veto any time)

| ID | Item | Default being used |
| --- | --- | --- |
| D-06 | Refund window for the first payment | 7 days, first payment only (`VITE_REFUND_DAYS`); legal pages stay drafts until a lawyer reviews |
| D-07 | Business rules R01 to R30 in the QA workbook | Claude proposes safe defaults in a table for Mohamed to scan; none go live without the QA gate |
| D-08 | Product name | Working name GymDesk (candidate RepSetu); interim address fit.afraventures.in; final name after the launch gate |

## Still waiting on people, not decisions (see `BACKLOG.md` phase 0)

Every task below is a row in the **Dev Task Sheet** (shared doc, devs update Status and Notes): https://claude.ai/artifact/NwcPRQpgvbWifhqTzRetd1 . Claude reads it at the start of each session and fixes reported failures first.

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
| 2026-10-28 | D-13: every AI/WhatsApp feature has a per-plan monthly cap, a per-gym usage view (SA-03), a platform-wide daily budget stop, and a spend limit set in the Anthropic Console | Mohamed |
| 2026-10-28 | D-09 answered: NO demo or waitlist launches. Every product's phase 1 is real, competitive software, planned like the gym (scope file, phases, backlog, tests, QA gate). Dates 13 to 28 Nov stay as owner targets. Claude's risk note: shared core must be extracted first and human tests set the real dates; Claude reports date confidence in every Daily Brief | Mohamed |
