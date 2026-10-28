# Decisions: open questions and the log

Format of an open item: question, Claude's recommendation, default if no answer, what it blocks, tier (see `OPERATING_RULES.md`).
Mohamed answers in one line. Claude moves answered items to the log in the next commit.

## Open: needs Mohamed (first batch, 28 Oct 2026)

| ID | Question | Recommendation | If no answer | Blocks | Tier |
| --- | --- | --- | --- | --- | --- |
| D-01 | `SCOPE.md` has two timelines: section 5 (public launch 1 Dec, build to 20 Nov) and section 11 (build done 28 to 30 Oct, test to about 4 Nov). Which is current? | Keep 1 Dec as the public launch. Treat section 11 as the first code-complete and test round, not the launch | Claude proceeds with that reading | Test planning, WhatsApp template timing | 2 |
| D-02 | AI is now the main story (Mohamed, 28 Oct). `MARKETING_CLAIMS.md` forbids calling the whole product "AI-powered" because today only Ask GymDesk, the weekly summary and AI plans use AI; churn risk and dashboards are normal calculations. How do we reconcile? **A:** launch with claims limited to shipped AI, build AI Renewal Copilot first after launch. **B:** delay launch until Copilot ships. | A. Untested code is already the bottleneck, so adding more before launch raises risk. Make AI real first, then claim it | Claude builds the AI backlog as written; claims stay as they are | Landing copy, ad copy, `MARKETING_CLAIMS.md` | 3 |
| D-03 | Freeze launch scope at what is in `BACKLOG.md` phases 0 to 1f, plus only three admin items: SA-03 AI and WhatsApp usage caps, SA-04 founder daily brief, SA-05 promo code screen? | Yes. Everything else in phases 1g and 3 starts after the soft launch | Claude treats the freeze as agreed | Order of work | 3 |
| D-04 | The Rs 249 launch offer (12 months, 150 members). | **No** as written. Using the plan maths in the master doc (about Rs 90 monthly cost per gym), Rs 249 leaves about Rs 159 a month, so a Rs 3,000 cost per paying gym takes about 19 months to repay, against about 3.6 months at Rs 999. Safer: first month Rs 249, then the normal price | No offer is built | Pricing page, checkout | 3 |
| D-05 | Turn on a daily autonomous run? A scheduled Claude session would work the Tier 1 and 2 queue each morning on `phase1-autopilot`, push small commits, and send the Daily Brief. It never touches `main`, production or real customers. | Yes, after the repo tests have run once, so it builds on a known-good base | Not turned on | Mohamed's 5 to 10 minute rhythm | 3 |

## Open: Tier 2, proceeding on default (veto any time)

| ID | Item | Default being used |
| --- | --- | --- |
| D-06 | Refund window for the first payment | 7 days, first payment only (`VITE_REFUND_DAYS`); legal pages stay drafts until a lawyer reviews |
| D-07 | Business rules R01 to R30 in the QA workbook | Claude proposes safe defaults in a table for Mohamed to scan; none go live without the QA gate |
| D-08 | Product name | Working name GymDesk (candidate RepSetu); interim address fit.afraventures.in; final name after the launch gate |

## Still waiting on people, not decisions (see `BACKLOG.md` phase 0)

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
| 2026-10-28 | Earlier decisions: see `SCOPE.md` section 8 | Mohamed |
