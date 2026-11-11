# Salon, Spa, Barber and Clinic (Groom): what we may say in marketing

Written 12 Nov 2026 following the gym rules (`docs/MARKETING_CLAIMS.md`) and `docs/PRODUCT_PRINCIPLES.md`. Product folder: `docs/products/salon/`. This file covers Salon, Spa, Barber and Clinic (Groom).

## The rule

1. Every claim has one status: **BUILT-AND-SEEN-BY-A-HUMAN**, **WRITTEN-NOT-TESTED** or **PLANNED**.
2. **Only BUILT-AND-SEEN-BY-A-HUMAN claims may appear on a public page, in an ad or in a message.** A person (Dev A, Staff 1 or 2, or an invited owner) must have seen it work on a real database, not just the plain-node checks.
3. A claim moves up one step only when its test is recorded (who, when, what they saw) in the QA workbook. Claude edits this file in the same commit that records the pass.
4. At the start every claim is WRITTEN-NOT-TESTED, so public copy is limited to the pilot lines below. Nothing here is a launch claim yet.
5. Predictions are always called **estimates**, with the reason and the data used. "Not enough data" is shown when there is too little.
6. Money is whole rupees with a currency code. Prices are never typed into copy: the page reads live plan prices.

## Allowed on a public page today (truthful pilot lines)

- "Salon, Spa, Barber and Clinic (Groom) is coming soon. We are running an invite-only pilot with a few businesses. Ask to join."
- "Built for small Indian businesses. Tamil, Hindi and English." (only after M-06 native review of the screens; until then say "English, Tamil and Hindi are being checked by native speakers")
- "Your data stays yours. You can ask for a copy or for it to be deleted." (only after data export and delete are built and seen; until then use "We will explain what we store before you sign up")

## Claim table

| ID | Claim (what we would say) | Where it is in the code or docs | Status |
| --- | --- | --- | --- |
| SAL-C01 | Appointments that cannot be double-booked, with a walk-in queue | apps/salon/src/routes.js, slots.js; SAL-02 | WRITTEN-NOT-TESTED |
| SAL-C02 | A booking link customers open on their phone; only free slots shown; a consent tick is required | apps/salon booking routes; SAL-02 | WRITTEN-NOT-TESTED |
| SAL-C03 | Unlimited staff logins at one price; staff see only their own visits and masked phone numbers | apps/salon roles, plans.js; SAL-01 | WRITTEN-NOT-TESTED |
| SAL-C04 | Bills with GST or plain, split payments, change from cash, a reason needed for every discount | apps/salon billing.js; SAL-03 | WRITTEN-NOT-TESTED |
| SAL-C05 | Commission worked out per bill line by the most specific rule | apps/salon commission.js; SAL-03 | WRITTEN-NOT-TESTED |
| SAL-C06 | Staff can give discounts; the owner sets the limit (default 10 percent) and sees every staff discount | discountPolicy.js; D-30; SAL-07 | WRITTEN-NOT-TESTED |
| SAL-C07 | Cash book, day close, expenses, dues, profit and loss in plain words, a file for your CA (we do not file GST) | accounts.js; SAL-04 | WRITTEN-NOT-TESTED |
| SAL-C08 | A list of customers who have not been back in 60 days and who are due to rebook (suggestions only) | winback.js, marketing.js; SAL-06 | WRITTEN-NOT-TESTED |
| SAL-C09 | A daily summary with three things to do today, each with its reason | summary.js; SAL-06 | WRITTEN-NOT-TESTED |
| SAL-C10 | Estimates: next-month sales range, busy and slow hours, customers likely to lapse (labelled estimates, "not enough data" when thin) | predict.js; SAL-05 | WRITTEN-NOT-TESTED |
| SAL-C11 | Alerts: heavy discounts, cash that does not match at day close, fewer returning customers | leaks.js; SAL-05 | WRITTEN-NOT-TESTED |
| SAL-C12 | Clinic preset: doctor and patient wording, consultation, follow-up and physio services | presets.js (clinic) | WRITTEN-NOT-TESTED |

## Planned, not built (never say these)

- WhatsApp reminders 24 hours and 2 hours before, review requests, win-back sending (need approved `salon_*` templates and the owner switch)
- Loyalty points, packages and memberships ("session 4 of 10" progress)
- Staff attendance, shifts, leave, payslip
- Stock and product use per service
- Customer import from the old register or sheet
- Booking page screen, QR image
- Advance payment by UPI for long services
- Doctor-only notes and a body-area picker for clinics
- Data export and delete on request, backups
- Any price or "70 to 88 percent cheaper than ..." comparison (competitor prices are sources not audited; ladder not approved)

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
- "Saves you Rs X" or "brings back N customers" (no measured results exist)
- "Cheaper than Dingg / MioSalon / Invoay" or any named competitor comparison
- For clinics: medical advice, health outcomes, "diagnose", "treat", "cure", "records are safe for patient data" (patient records need lawyer review first)
- "Staff cannot steal" (we show alerts for things that look wrong; they are questions, not proof)

## Clinic preset: extra rules

- No medical advice from the product or the AI, ever, and no health claims in any copy.
- Patient notes are visible to the doctor only; this is PLANNED, not built. Until a lawyer has reviewed consent and record storage, public copy must not say "patient records" or "medical records".
- Say "appointments, follow-up lists and packages for clinics" and only after those are BUILT-AND-SEEN.
- The BM TechX clinic demo is that company's design work: do not reuse its text, names, photos or doctor names.

## Review

Owner reads this file before any copy is published. Lawyer and CA items are listed in the product folder. Last checked 12 Nov 2026: nothing has been run by a person; all rows WRITTEN-NOT-TESTED or PLANNED.
