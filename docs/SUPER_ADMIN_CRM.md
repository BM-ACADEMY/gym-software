# Super Admin CRM: leads, trials, renewals and follow-ups (plan)

Status: planned, not built. **Revised 29 Oct: connect to Afra AI OS instead of building a second CRM** (see section 0). Request from Mohamed (29 Oct): customer management in Super Admin for all leads, status, renewal follow-ups; goal is to make customers sign up and renew.
Who the "customer" is here: the business owner who buys an Afra product (a gym owner, an agency owner). Not their members, candidates or shoppers. Those stay inside each product and never come to Super Admin.

## 0. Decision direction: use Afra AI OS Lead Hub for the sales work (Mohamed, 29 Oct: "connect there if possible")
Afra AI OS Phase 1 is already a Lead and Follow-up Hub (brand-separated leads, phone dedupe, round-robin assignment, statuses, notes, callbacks, CSV import with dry run, audit, mobile screens). Its scope already lists P02 AFRA Gym Management with sales, renewal and customer success work. Building the same thing again in Super Admin would split the sales team across two tools.
Split of jobs (Claude's proposal, needs Mohamed's OK in the Afra AI OS decision log; nothing in that repo was changed from this session):
| Where | Does |
| --- | --- |
| **Afra AI OS Lead Hub** (Postgres, its own sign-in and rules) | Sales leads and follow-ups: who to call, status, notes, callbacks, assignment, dedupe, outcome of each call, conversion. Sales team works only here |
| **Super Admin** (this repo's admin app) | Account facts from products (trial ending, renewal due, expired, last used) as read-only lists and numbers; marketing to-do; product launch notes. Produces the daily "call these accounts" list for the Lead Hub |
| **The link** | Phase 1: a labelled CSV of the day's contacts (phone, name, email, source, campaign such as `fit-renewal-7d`) imported through the Lead Hub's dry-run import. Later (needs approval): a service-user webhook so no CSV is needed |
Why this is the safe first step: the Lead Hub CSV takes only phone, name, email, source and campaign, so no renewal amounts or usage details travel with it; the caller opens the Super Admin account page for those. Re-importing a phone that exists merges into history, not a duplicate.
What Afra AI OS must decide first (its rules: plan first, no new brand without asking):
1. Is "AFRA Products" (one brand for Fit, groom, Mart, Dine, Cloth, Wash, Hire sales) or one brand per product the right split? Claude suggests one brand with `campaign` = product + stage, to keep telecaller sets simple. Mohamed decides.
2. Which people are telecallers, which is the manager (the sales team Mohamed has).
3. Calling stays manual (Superfone or phones) with outcomes logged by hand, per its Phase 1 rule. No calling-engine work.
Claude does not edit the Afra AI OS repo from this session. Hand-off text for that session: `docs/AFRA_AI_OS_HANDOFF_PRODUCTS_SALES.md`.

## 1. What the team sees
| Screen | Purpose |
| --- | --- |
| Pipeline | Every lead and account in columns: New lead, Contacted, Demo done, Trial started, Trial ending (3 days), Paid, Renewal due (7 days), Grace, Expired, Lost |
| Today's follow-ups | Who to call or message today, why, and what to say; tick done, snooze, or write the result |
| Account page | Business name, owner name and contact, product, plan, trial and paid dates, last time they used it, notes, call/message history, next step |
| Renewals | Everyone whose plan ends in 30 days, 7 days, today, or is in grace/expired, with amount (whole rupees, INR, GST shown separately) |
| Lead sources | Where each lead came from (website form, referral, Instagram, WhatsApp, event, DM team campaign) and how many converted |
| Reports | Sign-ups, trial to paid %, renewal %, lost reasons, by product and by team member (counts and rupees) |

## 2. Data and rules
- **Source of account facts (plan, trial dates, paid until, status):** each product's own billing, read through the server-to-server summary route. Status is computed by `packages/core-billing` from dates, never typed by hand. This needs an account-level list route per product (business name, owner contact, plan, dates, last active), which is a bigger share than the counts-only route used today. **Decision for Mohamed:** allow it (recommended) because renewals cannot be chased without knowing who. Claude's default: yes, account-level facts only; no end-customer data.
- **Leads (people who haven't signed up yet):** stored in the admin app's own CRM collection (`crm_leads`, `crm_activities`, `crm_tasks`), with source, product interest, status, owner, next follow-up date, lost reason.
- **Contact permission:** record how and when the owner agreed to be contacted (website form, they called, etc.). No WhatsApp marketing to anyone without it; use only Meta-approved templates; honour "stop" at once; quiet hours 9 pm to 8 am.
- **Calls:** human team only, 10 am to 6 pm IST Monday to Saturday. No AI voice calls.
- **Dedupe:** by phone (E.164) then email, same rule as Hire. A returning lead merges into history.
- **Retention and deletion:** a lead who says "delete" is deleted within the period the lawyer confirms (placeholder until confirmed). Notes avoid sensitive personal details.
- **Audit:** every status change, export and delete is logged with who and when. Exports limited to admin role.
- **Money:** whole rupees with a currency code.

## 3. Autopilot in the CRM (suggest first, same levels as everywhere)
| Watches | Suggests | Auto-send (only if Mohamed switches it on, per job) |
| --- | --- | --- |
| New lead with no contact in 1 hour (inside call hours) | "Call now" task with the script | Instant "thanks, we'll call you" template |
| Trial day 3, day 10, day 13 with low use | Help call or "need a hand?" message; shows what they haven't tried | Day-12 "trial ends in 2 days" template |
| Renewal 30 / 7 / 1 days out | Follow-up task with amount and offer idea | Reminder template at 7 and 1 days |
| Expired or in grace | Win-back task; reason question | Grace-ending template |
| Paid account not used for 14 days | Check-in call (churn risk) | None |
| Lost lead after 60 days | Re-contact suggestion | None |
Everything is in the activity log. Suggested wording avoids unproven claims (`docs/BRAND_AND_TAGLINES.md` section 4). Discounts are never offered automatically; Mohamed sets any offer.

## 4. Roles (all with two-step sign-in)
- **Owner/admin (Mohamed):** everything, exports, offers, deletes.
- **Sales/support:** leads, follow-ups, notes, renewals; no money settings, no exports, no deletes.
- **Marketing (DM team, SA-18):** lead sources and campaign results only; no contact details.

## 5. Build order (nothing built yet; re-scoped by section 0: items that duplicate the Lead Hub are dropped)
1. CRM-01 pure rules in `packages/core-crm`: stage from account facts, follow-up due dates, dedupe, renewal buckets, contact-permission check. Tests with fake data.
2. CRM-02 store and routes in `apps/admin` (leads, activities, tasks), role checks, audit, tests.
3. CRM-03 account-level list route in every product (gym first, Hire second) behind the internal key.
4. CRM-04 manifest screens: Pipeline, Follow-ups, Account, Renewals, Sources, Reports.
5. CRM-05 import leads from a CSV and from the website form (consent recorded).
6. CRM-06 suggestions on the autopilot runner; templates through WhatsApp after Meta approval.
7. CRM-07 reports.

## 6. Open for Mohamed (not blocking)
- Approve account-level facts from each product into Super Admin (default yes).
- Done: Mohamed has a sales team (names and roles still needed for the Lead Hub brand access).
- Which renewal offers are allowed (e.g. yearly = 10 months already exists for the gym).
- Leads are in a sheet (Mohamed, 29 Oct). Real lead data must never go into git or chat: Mohamed shares the sheet with Dev A, who runs the Lead Hub CSV dry-run import and sends back only the counts (rows, duplicates, bad rows).
