# Business autopilot: what each product does for the owner without being asked

Written 28 Oct 2026 at Mohamed's request ("autopilot mode for the products, reporting and all as per their business"). Status of everything here: **planned and partly written, not yet tested by a person**. Tags: Decision / Assumption.

## The idea (Decision)
Each product runs the owner's daily routine by itself and tells the owner only what needs them. Three parts: **watch** (rules look at the business data), **act** (small safe actions), **report** (a short message the owner reads in a minute). The AI helps with wording and summaries only. The numbers and the decisions to act come from fixed rules.

## Three levels, owner picks per job (Decision)
1. **Suggest** (default for every job): autopilot prepares the action and shows it. One tap approves.
2. **Auto for internal things**: reminders to staff, reports to the owner, tasks created. No customer is contacted.
3. **Auto-send to customers**: only for jobs the owner switches on, only approved templates, only to people with consent, inside quiet hours rules and a daily limit.

## Guardrails every job must pass (Decision, same as the gym rules)
- Tenant isolation: a job reads and writes only its own business.
- Consent and do-not-contact are checked by the server before any message. No consent, no send.
- Quiet hours (default 9 pm to 8 am, owner can change) and a daily send limit per business.
- Every automatic action is written to an activity log the owner can read, with an Undo or Stop where possible.
- Each job counts against the plan's AI and WhatsApp caps; the platform daily budget stop (D-13/D-16) switches AI wording off and falls back to fixed text.
- Owner can pause all autopilot with one switch. A job that fails three times pauses itself and tells the owner.
- No AI voice calls. No spending money, changing prices or deleting data automatically.
- Not promised in marketing until a human has seen it work.

## Per product (Assumption until the owner interviews confirm the pain)
| Product | Watches | Acts (level) | Reports to the owner |
| --- | --- | --- | --- |
| **Hire** (priority) | Candidates silent for 2+ days, interviews tomorrow, offers with drop flags, jobs with no submission for 3 days, fees past due, consent running out | Reminds the recruiter (2); drafts candidate nudges and client updates (1, then 3 once enabled); reminds clients of unpaid fees (3) | Morning list for each recruiter; Friday client update per client; Monday agency report: submissions, interviews, offers, joins, drops, fees invoiced and paid, slow jobs |
| **Gym** | Expiring memberships, absentees, unpaid dues (already built: Renewal Copilot) | Renewal and absence messages (1/3) | Founder brief and owner weekly summary (already written) |
| **Salon / Spa / Barber** | Customers not back in their usual gap, tomorrow's no-show risk, low stock, idle slots | Rebooking nudges, appointment reminders (3); staff tasks (2) | Daily sales and bookings, weekly top services and staff, slow hours |
| **Mart** | Items near out of stock, expiring batches, customers with udhaar overdue | Reorder list per supplier (1); udhaar reminders (3) | Daily sales, profit estimate, fast and dead stock, credit owed |
| **Dine** | Slow items, stock for tomorrow, table turn time, bad reviews if connected | Prep and purchase list (1); regular-guest offers (3) | Daily sales by hour and item, wastage, weekly summary |
| **Cloth** | Slow-moving stock, size gaps, season end, customers' occasions | Markdown suggestions (1); occasion messages (3) | Daily sales, stock ageing, supplier dues |
| **Wash** | Customers due for next wash, unpaid jobs, pickup delays | Wash-due reminders, ready-for-pickup messages (3) | Daily jobs and revenue, repeat rate, staff work done |

## Shared build (core, one time)
`packages/core-autopilot` (not created yet): job registry, schedule runner, levels and guardrails above, activity log, daily limits, quiet hours, per-job pause. Products only supply their own watch rules and wording. Billing, trial status and the read-only rule for expired accounts already exist as `packages/core-billing` (C-04a, written, not yet tested); autopilot jobs must respect it (an expired account gets no auto-send). Until `core-autopilot` exists, Hire's rules live in `apps/hire/src/autopilot.js` and move into core when the second product needs them.

## Open for Mohamed (Tier 3, not blocking)
- WhatsApp template wording for auto-send jobs (lawyer for candidates; Meta approval).
- Default daily send limit and quiet hours.
- Whether any auto-send job should be on by default (Claude's recommendation: none).

## Marketing suggestions (added 29 Oct)
Owner-side and Super Admin marketing suggestions: `docs/SUPER_ADMIN_AUTOPILOT.md`. Same levels and guardrails.
