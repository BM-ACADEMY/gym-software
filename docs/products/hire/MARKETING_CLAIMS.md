# Hire (recruitment agencies): what we may say in marketing

Written 12 Nov 2026 following the gym rules (`docs/MARKETING_CLAIMS.md`) and `docs/PRODUCT_PRINCIPLES.md`. Product folder: `docs/products/hire/`. This file covers Hire (recruitment agencies).

## The rule

1. Every claim has one status: **BUILT-AND-SEEN-BY-A-HUMAN**, **WRITTEN-NOT-TESTED** or **PLANNED**.
2. **Only BUILT-AND-SEEN-BY-A-HUMAN claims may appear on a public page, in an ad or in a message.** A person (Dev A, Staff 1 or 2, or an invited owner) must have seen it work on a real database, not just the plain-node checks.
3. A claim moves up one step only when its test is recorded (who, when, what they saw) in the QA workbook. Claude edits this file in the same commit that records the pass.
4. At the start every claim is WRITTEN-NOT-TESTED, so public copy is limited to the pilot lines below. Nothing here is a launch claim yet.
5. Predictions are always called **estimates**, with the reason and the data used. "Not enough data" is shown when there is too little.
6. Money is whole rupees with a currency code. Prices are never typed into copy: the page reads live plan prices.

## Allowed on a public page today (truthful pilot lines)

- "Hire (recruitment agencies) is coming soon. We are running an invite-only pilot with a few businesses. Ask to join."
- "Built for small Indian businesses. Tamil, Hindi and English." (only after M-06 native review of the screens; until then say "English, Tamil and Hindi are being checked by native speakers")
- "Your data stays yours. You can ask for a copy or for it to be deleted." (only after data export and delete are built and seen; until then use "We will explain what we store before you sign up")

## Claim table

| ID | Claim (what we would say) | Where it is in the code or docs | Status |
| --- | --- | --- | --- |
| HIR-C01 | Unlimited recruiter logins at one flat price | apps/hire/src/plans.js; docs/products/hire/SCOPE.md | WRITTEN-NOT-TESTED |
| HIR-C02 | Clients and jobs with fee terms and a guarantee period | apps/hire/src/models.js | WRITTEN-NOT-TESTED |
| HIR-C03 | Upload a PDF or Word resume and AI fills a candidate record that you review and correct (within a plan cap and a daily platform budget stop) | resumeService.js, parse.js, extract.js; HIR-01 | WRITTEN-NOT-TESTED |
| HIR-C04 | AI ranks candidates against a job with a short reason; the recruiter can override | rank.js, reasonService.js | WRITTEN-NOT-TESTED |
| HIR-C05 | A pipeline per job from sourced to joined or dropped, with notes and follow-ups | pipeline.js | WRITTEN-NOT-TESTED |
| HIR-C06 | A read-only client share page with shortlisted candidates, where the client can mark interested or reject | routes.js (createSharePublicRouter) | WRITTEN-NOT-TESTED |
| HIR-C07 | Offer-drop warnings from simple rules (no reply after 48 hours, other offers mentioned, long notice), shown as flags, not predictions | offerDrop.js | WRITTEN-NOT-TESTED |
| HIR-C08 | Placement fee tracking and GST invoices | fees.js; billing core | WRITTEN-NOT-TESTED |
| HIR-C09 | A morning list per recruiter and a Friday client update as suggestions (suggest only) | autopilot.js, marketingIdeas.js | WRITTEN-NOT-TESTED |
| HIR-C10 | Duplicate detection by phone or email | models.js unique indexes | WRITTEN-NOT-TESTED |
| HIR-C11 | A consent form for candidates (stays closed until the lawyer-approved notice is in place) | consentForm.js, consent.js | WRITTEN-NOT-TESTED |

## Planned, not built (never say these)

- WhatsApp outreach to candidates and screening answers saved in chat (needs approved templates and the lawyer-approved candidate consent; stays suggest-only until the lawyer approves)
- Interview scheduling with reminders
- Forwarding resumes from WhatsApp
- CSV import and export screens
- Ask your business
- Tamil and Hindi screens
- Data export and delete on request (DPDP)
- Mobile install (PWA) tested by a person

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
- "AI hires for you", "replaces recruiters" or "finds the best candidate" (the AI suggests a ranking with a reason; the recruiter decides)
- "Predicts who will drop out" (we show rule-based flags, not predictions)
- "Messages candidates automatically" (candidate messages stay suggestions until the lawyer approves and the owner switches them on)
- "DPDP-compliant" or "legal consent built in" (lawyer review M-15 / LAW-1 is open)
- Naming a competitor or any per-recruiter price comparison (sources not audited)
- Showing or sharing any real candidate data in demos, screenshots or ads

## Candidate data: extra rules

- Resumes and phone numbers are personal data. No real candidate data in screenshots, ads, demos or chat.
- Public copy says only that candidate messages are "suggestions you approve" until the lawyer has approved the consent wording.
- A client share link shows only what the recruiter chose to share.

## Review

Owner reads this file before any copy is published. Lawyer and CA items are listed in the product folder. Last checked 12 Nov 2026: nothing has been run by a person; all rows WRITTEN-NOT-TESTED or PLANNED.
