# Wash (car wash and detailing): what we may say in marketing

Written 12 Nov 2026 following the gym rules (`docs/MARKETING_CLAIMS.md`) and `docs/PRODUCT_PRINCIPLES.md`. Product folder: `docs/products/wash/`. This file covers Wash (car wash and detailing).

## The rule

1. Every claim has one status: **BUILT-AND-SEEN-BY-A-HUMAN**, **WRITTEN-NOT-TESTED** or **PLANNED**.
2. **Only BUILT-AND-SEEN-BY-A-HUMAN claims may appear on a public page, in an ad or in a message.** A person (Dev A, Staff 1 or 2, or an invited owner) must have seen it work on a real database, not just the plain-node checks.
3. A claim moves up one step only when its test is recorded (who, when, what they saw) in the QA workbook. Claude edits this file in the same commit that records the pass.
4. At the start every claim is WRITTEN-NOT-TESTED, so public copy is limited to the pilot lines below. Nothing here is a launch claim yet.
5. Predictions are always called **estimates**, with the reason and the data used. "Not enough data" is shown when there is too little.
6. Money is whole rupees with a currency code. Prices are never typed into copy: the page reads live plan prices.

## Allowed on a public page today (truthful pilot lines)

- "Wash (car wash and detailing) is coming soon. We are running an invite-only pilot with a few businesses. Ask to join."
- "Built for small Indian businesses. Tamil, Hindi and English." (only after M-06 native review of the screens; until then say "English, Tamil and Hindi are being checked by native speakers")
- "Your data stays yours. You can ask for a copy or for it to be deleted." (only after data export and delete are built and seen; until then use "We will explain what we store before you sign up")

## Claim table

| ID | Claim (what we would say) | Where it is in the code or docs | Status |
| --- | --- | --- | --- |
| WSH-C01 | Vehicle records by registration number with owner name and phone | apps/wash vehicles.js; WSH-00 | WRITTEN-NOT-TESTED |
| WSH-C02 | A job board: waiting, washing, ready, delivered, cancelled, with bay and queue timing | jobs.js, bays.js; WSH-00 | WRITTEN-NOT-TESTED |
| WSH-C03 | Class pricing with add-ons, GST bill, split payments | WSH-01 and core-pos | WRITTEN-NOT-TESTED |
| WSH-C04 | Monthly passes with washes left; a delivered job uses one wash and only add-ons are charged | pass.js; WSH-00 | WRITTEN-NOT-TESTED |
| WSH-C05 | Incentive per delivered job for each attendant, in whole rupees | incentive.js; WSH-00 | WRITTEN-NOT-TESTED |
| WSH-C06 | Cash closing at day end: counted against expected, with a flag and no second close for the same day | cashclose.js; WSH-00 | WRITTEN-NOT-TESTED |
| WSH-C07 | Cash book, expenses, supplier dues, profit and loss in plain words, a file for the CA | accounts.js; WSH-01 | WRITTEN-NOT-TESTED |
| WSH-C08 | Sales by day, class, attendant and hour | reports.js; WSH-01 | WRITTEN-NOT-TESTED |
| WSH-C09 | Estimates: next-month range, busy and slow hours, pass renewals, customers likely to lapse (each labelled "Estimate, not a promise") | predict.js; WSH-01 | WRITTEN-NOT-TESTED |
| WSH-C10 | Review-request, off-peak and festival ideas (suggestions only) | marketing.js; WSH-01 | WRITTEN-NOT-TESTED |
| WSH-C11 | Staff can discount inside a limit the owner sets, with a reason; the owner sees every one; cancelled-after-started jobs are flagged | D-30; WSH-03 | WRITTEN-NOT-TESTED |
| WSH-C12 | A daily summary with three actions and reasons | summary.js; WSH-01 | WRITTEN-NOT-TESTED |
| WSH-C13 | Attendant attendance and month summary | attendance.js; WSH-01 | WRITTEN-NOT-TESTED |

## Planned, not built (never say these)

- Before and after photos
- Booking link and QR; pickup and drop
- WhatsApp "car is ready" and wash-due messages (`wash_*` templates not submitted)
- Payslips and shifts through core payroll
- Customer dues on jobs and returns
- Importing your old register of vehicles
- Required reason when a started job is cancelled
- Camera plate recognition, fleet accounts, online booking
- Data export and delete on request

## Do NOT say

- "Unlimited AI" (every plan has a monthly allowance)
- "Guaranteed" anything: results, savings, growth, compliance, approval
- "AI predicts ..." (we show labelled estimates with the reason and data used; never a promise)
- "Runs on its own", "fully automatic", "autopilot sends messages" (suggest by default; sending only after the owner switches a job on, and only approved WhatsApp templates)
- "No. 1", "best in India", "most trusted", customer counts, testimonials, ratings (none exist until real, consenting owners say so)
- "AI chatbot replies to your customers" or "AI calls your customers" (not built; no AI voice calls ever)
- "We file your GST" or "GST-compliant for every case" (we prepare a summary and a CA file; the CA files and confirms)
- "Bank-grade", "100% secure", "never goes down" (not provable)
- Any price as final until the owner has approved the ladder (Tier 3); prices on the page must come from live plan settings
- Any feature marked WRITTEN-NOT-TESTED or PLANNED below, as if it works today
- "Your customers get a message when the car is ready" (templates not approved)
- "Photo proof of every wash" (planned)
- "Increases washes per day" or "fills your bays" (no measured results; only estimates and suggestions)
- Any price or competitor comparison (not audited)

## Review

Owner reads this file before any copy is published. Lawyer and CA items are listed in the product folder. Last checked 12 Nov 2026: nothing has been run by a person; all rows WRITTEN-NOT-TESTED or PLANNED.
