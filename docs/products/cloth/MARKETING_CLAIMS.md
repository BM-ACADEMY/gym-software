# Cloth (textile and garment shops): what we may say in marketing

Written 12 Nov 2026 following the gym rules (`docs/MARKETING_CLAIMS.md`) and `docs/PRODUCT_PRINCIPLES.md`. Product folder: `docs/products/cloth/`. This file covers Cloth (textile and garment shops).

## The rule

1. Every claim has one status: **BUILT-AND-SEEN-BY-A-HUMAN**, **WRITTEN-NOT-TESTED** or **PLANNED**.
2. **Only BUILT-AND-SEEN-BY-A-HUMAN claims may appear on a public page, in an ad or in a message.** A person (Dev A, Staff 1 or 2, or an invited owner) must have seen it work on a real database, not just the plain-node checks.
3. A claim moves up one step only when its test is recorded (who, when, what they saw) in the QA workbook. Claude edits this file in the same commit that records the pass.
4. At the start every claim is WRITTEN-NOT-TESTED, so public copy is limited to the pilot lines below. Nothing here is a launch claim yet.
5. Predictions are always called **estimates**, with the reason and the data used. "Not enough data" is shown when there is too little.
6. Money is whole rupees with a currency code. Prices are never typed into copy: the page reads live plan prices.

## Allowed on a public page today (truthful pilot lines)

- "Cloth (textile and garment shops) is coming soon. We are running an invite-only pilot with a few businesses. Ask to join."
- "Built for small Indian businesses. Tamil, Hindi and English." (only after M-06 native review of the screens; until then say "English, Tamil and Hindi are being checked by native speakers")
- "Your data stays yours. You can ask for a copy or for it to be deleted." (only after data export and delete are built and seen; until then use "We will explain what we store before you sign up")

## Claim table

| ID | Claim (what we would say) | Where it is in the code or docs | Status |
| --- | --- | --- | --- |
| CLO-C01 | Stock by size and colour (style grids) with stock moves that two people cannot overwrite | apps/cloth variants.js; CLO-02 | WRITTEN-NOT-TESTED |
| CLO-C02 | A bill line reduces the stock of that size and colour; price and GST come from your own list; a sale is refused if stock is short | billGuard.js; CLO-05 | WRITTEN-NOT-TESTED |
| CLO-C03 | GST bands by price per piece held as editable data (default 5 percent up to Rs 2,500 per piece, 18 percent above; the CA confirms) | gst.js; CLO-00 | WRITTEN-NOT-TESTED |
| CLO-C04 | Alteration and tailoring jobs with ready dates, an overdue list and an uncollected list | alterations.js; CLO-02 | WRITTEN-NOT-TESTED |
| CLO-C05 | Slow and dead stock with a markdown idea and its reason; size gaps | stockAdvice.js; CLO-00 | WRITTEN-NOT-TESTED |
| CLO-C06 | Festival-season forecast from last year's same window plus the growth you set (an estimate) | predict.js; CLO-04 | WRITTEN-NOT-TESTED |
| CLO-C07 | Cash book, day close, expenses, supplier bills and dues ageing, profit and loss in plain words, a file for the CA | accounts.js; CLO-03 | WRITTEN-NOT-TESTED |
| CLO-C08 | Estimates: next-month range, busiest weekday, stock run-out, customers likely to lapse, cash needed for dues | predict.js; CLO-04 | WRITTEN-NOT-TESTED |
| CLO-C09 | Alerts: heavy discounts, returns by staff, repeated cash shortage | leaks.js; CLO-04 | WRITTEN-NOT-TESTED |
| CLO-C10 | Staff can discount inside a limit the owner sets; the owner sees every one | D-30; CLO-08 | WRITTEN-NOT-TESTED |
| CLO-C11 | A daily summary with three actions and reasons; suggest-only win-back, occasion, clearance and review ideas | summary.js, followups.js; CLO-04 | WRITTEN-NOT-TESTED |
| CLO-C12 | Staff attendance and month pay from salary | staffRules.js; CLO-03 | WRITTEN-NOT-TESTED |

## Planned, not built (never say these)

- Barcode labels and scan billing
- Fabric by metre and rolls
- Booking link or QR for alterations
- WhatsApp reminders and sending (`cloth_*` templates not approved)
- Tally-style export
- Shifts, leave, payslip, commission
- Customer-facing pages and shop page
- Data export and delete on request
- Stock-mismatch alert against a physical count
- Branches, online ordering, e-invoice

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
- "Correct GST for every garment" or an HSN claim (GST bands and HSN wording are open CA items)
- "Barcode billing" or "fabric by metre" (planned)
- "Clears your dead stock" or "sell more at festivals" (we show estimates and ideas only)
- Any price or competitor comparison (not audited)

## Review

Owner reads this file before any copy is published. Lawyer and CA items are listed in the product folder. Last checked 12 Nov 2026: nothing has been run by a person; all rows WRITTEN-NOT-TESTED or PLANNED.
