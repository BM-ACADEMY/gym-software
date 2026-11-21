# Dine (restaurant, cafe, pub): what we may say in marketing

Written 12 Nov 2026 following the gym rules (`docs/MARKETING_CLAIMS.md`) and `docs/PRODUCT_PRINCIPLES.md`. Product folder: `docs/products/dine/`. This file covers Dine (restaurant, cafe, pub).

## The rule

1. Every claim has one status: **BUILT-AND-SEEN-BY-A-HUMAN**, **WRITTEN-NOT-TESTED** or **PLANNED**.
2. **Only BUILT-AND-SEEN-BY-A-HUMAN claims may appear on a public page, in an ad or in a message.** A person (Dev A, Staff 1 or 2, or an invited owner) must have seen it work on a real database, not just the plain-node checks.
3. A claim moves up one step only when its test is recorded (who, when, what they saw) in the QA workbook. Claude edits this file in the same commit that records the pass.
4. At the start every claim is WRITTEN-NOT-TESTED, so public copy is limited to the pilot lines below. Nothing here is a launch claim yet.
5. Predictions are always called **estimates**, with the reason and the data used. "Not enough data" is shown when there is too little.
6. Money is whole rupees with a currency code. Prices are never typed into copy: the page reads live plan prices.

## Allowed on a public page today (truthful pilot lines)

- "Dine (restaurant, cafe, pub) is coming soon. We are running an invite-only pilot with a few businesses. Ask to join."
- "Built for small Indian businesses. Tamil, Hindi and English." (only after M-06 native review of the screens; until then say "English, Tamil and Hindi are being checked by native speakers")
- "Your data stays yours. You can ask for a copy or for it to be deleted." (only after data export and delete are built and seen; until then use "We will explain what we store before you sign up")

## Claim table

| ID | Claim (what we would say) | Where it is in the code or docs | Status |
| --- | --- | --- | --- |
| DIN-C01 | A menu with sizes and add-ons | apps/dine/src (menu rules); DIN-01 | WRITTEN-NOT-TESTED |
| DIN-C02 | Table orders from open to paid, with separate kitchen and bar tickets, voids and reopen | orders and KOT flow; DIN-01 | WRITTEN-NOT-TESTED |
| DIN-C03 | Split a bill by items or equally, with service charge (GST treatment on service charge is for the CA to confirm) | DIN-02 | WRITTEN-NOT-TESTED |
| DIN-C04 | Recipe cost, stock that reduces when a dish is paid, and wastage records | DIN-03 | WRITTEN-NOT-TESTED |
| DIN-C05 | Pub mode (Pro): bottle-by-bottle variance and happy-hour prices | DIN-03; pub mode Pro only | WRITTEN-NOT-TESTED |
| DIN-C06 | Cash book, day close, expenses, supplier dues with ageing, profit and loss in plain words, a file for the CA | DIN-04 | WRITTEN-NOT-TESTED |
| DIN-C07 | Sales reports and estimates: next-month range, busy days and hours, stock run-out, customers likely to lapse (labelled estimates) | DIN-04 | WRITTEN-NOT-TESTED |
| DIN-C08 | Best and worst dishes and slow hours, as suggestions | DIN-01 insights | WRITTEN-NOT-TESTED |
| DIN-C09 | A daily summary with at most three actions and reasons | DIN-05 | WRITTEN-NOT-TESTED |
| DIN-C10 | Win-back, slow-hour and review-request ideas (suggestions only) | DIN-05 | WRITTEN-NOT-TESTED |
| DIN-C11 | Cashiers and managers can discount inside a limit the owner sets; kitchen, captain and bartender roles cannot; the owner sees every staff discount | D-30; DIN-07 | WRITTEN-NOT-TESTED |
| DIN-C12 | Roles with their own permissions for each route | DIN-06 | WRITTEN-NOT-TESTED |

## Planned, not built (never say these)

- QR menu and direct-order WhatsApp link
- Printed kitchen ticket and bill
- FSSAI number on the bill
- Tables and kitchen-display screens (only the admin panel exists)
- Pay later (credit) and returns
- UPI payment links
- Aggregator (Zomato, Swiggy) sync, multiple outlets, handheld captain app
- Payslips, leave, shifts
- Tamil and Hindi message text
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
- "GST-ready", "FSSAI-compliant" or "excise-ready" (service charge GST, liquor VAT and excise, FSSAI wording are open CA and lawyer items in `docs/products/dine/CA_LAWYER_ITEMS.md`)
- Anything that promotes alcohol to the public or in WhatsApp (Meta alcohol policy check DIN-R2 is open); pub mode is described only as "bar stock and happy-hour pricing tools" and only to pub owners
- "Cuts food cost by X percent" or "stops wastage" (no measured results)
- "Works with Zomato / Swiggy" (planned)
- Any price or competitor comparison (not audited)

## Review

Owner reads this file before any copy is published. Lawyer and CA items are listed in the product folder. Last checked 12 Nov 2026: nothing has been run by a person; all rows WRITTEN-NOT-TESTED or PLANNED.
