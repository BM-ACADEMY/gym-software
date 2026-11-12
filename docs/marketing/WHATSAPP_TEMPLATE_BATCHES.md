# WhatsApp template submission batches (per product)

Written 13 Nov 2026. **Nothing here has been submitted by Claude. Submission is done in WhatsApp Manager by Dev A or the person Mohamed names. Written, not yet tested.**
Sources: `server/config/whatsappTemplates.js` (gym), `packages/core-whatsapp/src/afraTemplates.js` (Afra), `docs/WHATSAPP_TEMPLATES_PRODUCTS.md` (other products, drafts) and each product's marketing code. Tables for batches 1 and 2 below are generated from the code by `node marketing/gen_template_batches.js`, so the text is exactly what the app will send.
Rules for all batches: language English, body only (no header, footer or buttons); variable order must match; Meta decides the category (accept a re-label and tell Mohamed, cost changes); samples are fake; messages go only to people who agreed; quiet hours 9 pm to 8 am IST; no template promises a discount, a guarantee or results.

## Status of the match between text and code
| Batch | Product | Text matches what the app sends? |
| --- | --- | --- |
| 1 | GymDesk (6) | **Yes.** Checked 13 Nov: each code body appears word for word in `docs/WHATSAPP_TEMPLATES.md`. These are in use by the gym and reported under review at Meta (2 Nov, per-template status not yet given). |
| 2 | Afra to owners (10) | **Yes** (code and doc match). Nothing sends them yet (needs billing events and Meta approval; backlog WA-03). |
| 3 | Groom (salon) | **No code.** Names `groom_*` in the draft file but the app has no template names or senders, and `salon_*` is the prefix in the scope doc. **Flag: decide the prefix (`groom_` or `salon_`) before submitting.** |
| 3 | Mart | **No code.** Only suggestions exist; no template names in code. Drafts only. |
| 3 | Dine | **Mismatch.** Code names `dine_winback`, `dine_slow_hour`, `dine_review`; the draft file lists `dine_booking_confirmed`, `dine_booking_reminder`, `dine_regulars_offer`. Texts differ. |
| 3 | Cloth | **Mismatch.** Code names `cloth_winback`, `cloth_occasion`, `cloth_offer`, `cloth_review`; draft file lists `cloth_order_ready`, `cloth_dues_reminder`, `cloth_new_stock`. |
| 3 | Wash | **Mismatch.** Code names `wash_car_ready`, `wash_wash_due`, `wash_review_request`; draft file lists `wash_job_ready`, `wash_job_received`, `wash_due_reminder`. |
| 4 | Hire | **No code for templates.** Draft only; on hold until the lawyer's written approval of this exact wording is filed. |

Rule applied: do not submit anything for a product until the code and the submitted text are the same. For batch 3 the owner decides which set is right, then Claude changes the code or the draft so they agree, and only then is it submitted.

## Batch 1: GymDesk to its members and owner (ready; already in code)
| Name | Category | Variables | Text (exactly as the code sends it) | Sample values |
| --- | --- | --- | --- | --- |
| `gymdesk_renewal_reminder` | UTILITY | {{1}} name, {{2}} gym, {{3}} days, {{4}} phone | Hi {{1}}, your membership at {{2}} ends in {{3}} day(s). Renew now to keep your access without a break. Questions? Call {{4}}. | Ravi ; Iron House Gym ; 7 ; 9876543210 |
| `gymdesk_plan_expired` | UTILITY | {{1}} name, {{2}} gym, {{3}} phone | Hi {{1}}, your membership at {{2}} has ended. Renew to start training again. Call {{3}} and we will set it up for you. | Ravi ; Iron House Gym ; 9876543210 |
| `gymdesk_winback` | MARKETING | {{1}} name, {{2}} gym, {{3}} phone | Hi {{1}}, we miss you at {{2}}! Your membership ended recently. Come back this week and we will get you started again. Call {{3}}. | Ravi ; Iron House Gym ; 9876543210 |
| `gymdesk_dues_reminder` | UTILITY | {{1}} name, {{2}} gym, {{3}} amount, {{4}} upi, {{5}} phone | Hi {{1}}, a payment of Rs {{3}} is pending at {{2}}. You can pay by UPI to {{4}}. Already paid? Please ignore this. Call {{5}} for help. | Ravi ; Iron House Gym ; 1500 ; irongym@okaxis ; 9876543210 |
| `gymdesk_absence_checkin` | MARKETING | {{1}} name, {{2}} gym, {{3}} days | Hi {{1}}, we have not seen you at {{2}} for {{3}} days. Everything okay? Your trainers are ready whenever you are. | Ravi ; Iron House Gym ; 7 |
| `gymdesk_owner_daily_summary` | UTILITY | {{1}} gym, {{2}} checkins, {{3}} collected, {{4}} dues, {{5}} renewals | Daily summary for {{1}}: {{2}} check-ins today, Rs {{3}} collected, Rs {{4}} dues pending, {{5}} memberships ending in the next 7 days. | Iron House Gym ; 42 ; 6500 ; 12000 ; 9 |

## Batch 2: Afra to business owners (ready; not yet sent by code)
| Name | Category | Variables | Text (exactly as the code sends it) | Sample values |
| --- | --- | --- | --- | --- |
| `afra_welcome` | UTILITY | {{1}} name, {{2}} product, {{3}} trial_end, {{4}} phone | Hi {{1}}, welcome to {{2}}. Your free trial has started and ends on {{3}}. Need help? Call {{4}}, Monday to Saturday, 10 am to 6 pm. | Ravi ; Fit ; 12 Nov 2026 ; 9876543210 |
| `afra_trial_ending` | UTILITY | {{1}} name, {{2}} product, {{3}} days, {{4}} end_date, {{5}} phone | Hi {{1}}, your {{2}} free trial ends in {{3}} day(s), on {{4}}. To keep your data and continue, choose a plan in the app. Help: {{5}}. | Ravi ; Fit ; 3 ; 12 Nov 2026 ; 9876543210 |
| `afra_payment_received` | UTILITY | {{1}} name, {{2}} amount, {{3}} product, {{4}} invoice, {{5}} paid_until | Hi {{1}}, we received Rs {{2}} for your {{3}} plan. Invoice {{4}}. Your plan is active until {{5}}. Thank you. | Ravi ; 999 ; Fit ; AV/2026-27/0007 ; 12 Dec 2026 |
| `afra_renewal_reminder` | UTILITY | {{1}} name, {{2}} product, {{3}} days, {{4}} end_date, {{5}} phone | Hi {{1}}, your {{2}} plan ends in {{3}} day(s), on {{4}}. Renew in the app to avoid a break. Help: {{5}}. | Ravi ; Fit ; 7 ; 12 Dec 2026 ; 9876543210 |
| `afra_plan_expired` | UTILITY | {{1}} name, {{2}} product, {{3}} grace_days, {{4}} phone | Hi {{1}}, your {{2}} plan has ended. You have {{3}} more day(s) before the account becomes read-only. Renew in the app. Help: {{4}}. | Ravi ; Fit ; 3 ; 9876543210 |
| `afra_account_readonly` | UTILITY | {{1}} name, {{2}} product, {{3}} end_date, {{4}} phone | Hi {{1}}, your {{2}} account is now read-only because the plan ended on {{3}}. Your data is safe. Renew in the app to make changes again. Help: {{4}}. | Ravi ; Fit ; 15 Dec 2026 ; 9876543210 |
| `afra_refund_update` | UTILITY | {{1}} name, {{2}} amount, {{3}} product, {{4}} phone | Hi {{1}}, your refund of Rs {{2}} for {{3}} is approved. It should reach you in 7 to 14 working days. Questions? Call {{4}}. | Ravi ; 999 ; Fit ; 9876543210 |
| `afra_support_update` | UTILITY | {{1}} name, {{2}} ticket, {{3}} status, {{4}} phone | Hi {{1}}, your support request {{2}} is now {{3}}. Reply here or call {{4}} if you need more help. | Ravi ; T-1042 ; resolved ; 9876543210 |
| `afra_callback` | UTILITY | {{1}} name, {{2}} product, {{3}} day, {{4}} phone | Hi {{1}}, as you asked, our team will call you about {{2}} on {{3}} between 10 am and 6 pm. Another time suits you? Call {{4}}. | Ravi ; Fit ; Friday ; 9876543210 |
| `afra_winback` | MARKETING | {{1}} name, {{2}} product, {{3}} days, {{4}} phone | Hi {{1}}, your {{2}} account is paused and your data is saved for {{3}} more days. You can renew in the app any time, or call {{4}} and we will help. | Ravi ; Fit ; 30 ; 9876543210 |

## Batch 3: shop to its customers (DRAFTS: do not submit yet)
Wording from `docs/WHATSAPP_TEMPLATES_PRODUCTS.md`. Variables are in order as listed.

### Groom (`groom_`): flag prefix, no code
| Name | Category | Variables | Text | Sample values |
| --- | --- | --- | --- | --- |
| `groom_appointment_reminder` | UTILITY | {{1}} name, {{2}} salon, {{3}} time, {{4}} phone | Hi {{1}}, a reminder of your appointment at {{2}} on {{3}}. Need to change it? Call {{4}}. | Priya ; Glow Salon ; Fri 15 Nov, 4 pm ; 9876543210 |
| `groom_booking_confirmed` | UTILITY | {{1}} name, {{2}} salon, {{3}} service, {{4}} time | Hi {{1}}, your booking at {{2}} for {{3}} is confirmed for {{4}}. | Priya ; Glow Salon ; haircut ; Fri 15 Nov, 4 pm |
| `groom_rebook_nudge` | MARKETING | {{1}} name, {{2}} salon, {{3}} phone | Hi {{1}}, it has been a while since your last visit to {{2}}. Call {{3}} to book your next slot. | Priya ; Glow Salon ; 9876543210 |

### Mart (`mart_`): no code, draft
| Name | Category | Variables | Text | Sample values |
| --- | --- | --- | --- | --- |
| `mart_credit_reminder` | UTILITY | {{1}} name, {{2}} shop, {{3}} amount, {{4}} phone | Hi {{1}}, Rs {{3}} is pending at {{2}}. Already paid? Please ignore this. Call {{4}} for help. | Ravi ; Kumar Stores ; 450 ; 9876543210 |
| `mart_bill_copy` | UTILITY | {{1}} name, {{2}} shop, {{3}} amount, {{4}} billno | Hi {{1}}, thank you for shopping at {{2}}. Your bill {{4}} for Rs {{3}} is recorded. | Ravi ; Kumar Stores ; 450 ; B-0012 (sample added by Claude, Assumption) |
| `mart_owner_daily_summary` | UTILITY | {{1}} shop, {{2}} sales, {{3}} bills, {{4}} credit | Daily summary for {{1}}: Rs {{2}} sales from {{3}} bills, Rs {{4}} credit given today. | Kumar Stores ; 8200 ; 31 ; 650 (samples added by Claude, Assumption) |

Flag (Mart): `mart_credit_reminder` is a customer dues reminder; the code only lists udhaar as suggestions. Sending needs the owner's switch and the customer's agreement.

### Dine (`dine_`): MISMATCH with code
Draft file set:
| Name | Category | Variables | Text | Sample values |
| --- | --- | --- | --- | --- |
| `dine_booking_confirmed` | UTILITY | {{1}} name, {{2}} place, {{3}} people, {{4}} time | Hi {{1}}, your table at {{2}} for {{3}} is confirmed for {{4}}. | Ravi ; Spice Garden ; 4 people ; Fri 7 pm (Assumption) |
| `dine_booking_reminder` | UTILITY | {{1}} name, {{2}} place, {{3}} time, {{4}} phone | Hi {{1}}, a reminder of your table at {{2}} at {{3}}. To change it call {{4}}. | Ravi ; Spice Garden ; 7 pm ; 9876543210 (Assumption) |
| `dine_regulars_offer` | MARKETING | {{1}} name, {{2}} place, {{3}} phone | Hi {{1}}, we would love to see you again at {{2}}. Call {{3}} to book a table. | Ravi ; Spice Garden ; 9876543210 (Assumption) |

What the code (`apps/dine/src/marketing.js`) would send instead (suggest-only text today):
- `dine_winback`: "Hi <first name>, it has been a while since you visited <venue>. We would love to see you again." (2 variables; no phone, no booking.)
- `dine_slow_hour`: "Hi, <venue> has a small offer this <h>:00 to <h+1>:00 slot. Ask for it at the counter." (no name variable; starts with "Hi," so fine, but the offer is owner-set.)
- `dine_review`: "Thank you for visiting <venue>. If you enjoyed it, a short review helps us: <link>". **Flag: the body ends with a variable (the link), which Meta does not allow (Assumption from Meta's general rules; check on the day). Needs a URL button or trailing words.**
Flags: (1) the two sets do not match; (2) booking templates imply a booking feature that is not built (QR menu and booking link are planned); (3) `dine_*` for bar offers must not be submitted until DIN-R2 (Meta alcohol policy) is answered; (4) Mohamed must approve exact text first (D-ME1 in `docs/products/dine/CA_LAWYER_ITEMS.md`).

### Cloth (`cloth_`): MISMATCH with code
Draft file set:
| Name | Category | Variables | Text | Sample values |
| --- | --- | --- | --- | --- |
| `cloth_order_ready` | UTILITY | {{1}} name, {{2}} shop, {{3}} orderno | Hi {{1}}, your order {{3}} at {{2}} is ready for pickup. | Priya ; Lakshmi Textiles ; A-104 (Assumption) |
| `cloth_dues_reminder` | UTILITY | {{1}} name, {{2}} shop, {{3}} amount, {{4}} phone | Hi {{1}}, a payment of Rs {{3}} is pending at {{2}}. Already paid? Please ignore this. Call {{4}} for help. | Priya ; Lakshmi Textiles ; 1200 ; 9876543210 (Assumption) |
| `cloth_new_stock` | MARKETING | {{1}} name, {{2}} shop, {{3}} phone | Hi {{1}}, new stock has arrived at {{2}}. Visit us or call {{3}}. | Priya ; Lakshmi Textiles ; 9876543210 (Assumption) |

Code (`apps/cloth/src/routesMore.js`) names `cloth_winback`, `cloth_occasion`, `cloth_offer`, `cloth_review` as "needs Meta approval", with **no wording written for any of them**. Flags: (1) sets do not match; (2) alteration "order ready" is drafted but the code does not send it; (3) text for the four coded names must be written and approved by Mohamed before submission.

### Wash (`wash_`): MISMATCH with code
Draft file set:
| Name | Category | Variables | Text | Sample values |
| --- | --- | --- | --- | --- |
| `wash_job_ready` | UTILITY | {{1}} name, {{2}} place, {{3}} vehicle | Hi {{1}}, your {{3}} is ready for pickup at {{2}}. | Ravi ; Sparkle Wash ; TN 07 AB 1234 (Assumption) |
| `wash_job_received` | UTILITY | {{1}} name, {{2}} place, {{3}} vehicle, {{4}} time | Hi {{1}}, we received your {{3}} at {{2}}. Expected ready time: {{4}}. | Ravi ; Sparkle Wash ; TN 07 AB 1234 ; 4 pm (Assumption) |
| `wash_due_reminder` | MARKETING | {{1}} name, {{2}} place, {{3}} phone | Hi {{1}}, it is time for your next wash at {{2}}. Call {{3}} to book. | Ravi ; Sparkle Wash ; 9876543210 (Assumption) |

Code (`apps/wash/src/marketing.js`) uses the names `wash_review_request`, `wash_car_ready`, `wash_wash_due` ("names to be submitted; NOT approved") with **no wording in code**. Flags: (1) names differ from the draft (`wash_car_ready` vs `wash_job_ready`; `wash_wash_due` vs `wash_due_reminder`; `wash_review_request` has no draft; `wash_job_received` has no code); (2) the vehicle number is a customer identifier: keep it out of anything shown publicly; (3) "car is ready" is in the claims do-not-say list until approved templates exist.

### Hire (`hire_`): HOLD
| Name | Category | Variables | Text | Sample values |
| --- | --- | --- | --- | --- |
| `hire_interview_reminder` | UTILITY | {{1}} name, {{2}} company, {{3}} time | Hi {{1}}, a reminder of your interview with {{2}} on {{3}}. Reply here if you need to change it. | Asha ; Kumar Traders ; Fri 15 Nov, 11 am (Assumption) |
| `hire_consent_request` | UTILITY or MARKETING (Meta decides) | {{1}} name, {{2}} agency | Hi {{1}}, {{2}} would like to keep your details to match you with jobs. Reply YES to agree or NO to stop. Lawyer must approve this wording. | Asha ; Bright Staffing (Assumption) |
| `hire_client_update` | UTILITY | {{1}} client, {{2}} count, {{3}} agency | Hi {{1}}, {{3}} has sent {{2}} new candidates for your open job. Open your shortlist link to review. | Kumar Traders ; 3 ; Bright Staffing (Assumption) |

Flags: (1) the consent text contains "Lawyer must approve this wording." which must be **removed** before any submission, and the final wording is the lawyer's; (2) `hire_client_update` mentions a link but has no link variable or button, so the shortlist page must exist first; (3) the draft file says the lawyer approved (29 Oct, Mohamed's report) but the written approval of this exact wording is not in the repo: file it first; (4) candidate messages stay suggest-only until then.

## Meta rules to check on the day (Assumption from Meta's general rules)
- A body cannot start or end with a variable, and two variables cannot be side by side. Every text above ends with a full stop or words, except the Dine review text (flagged).
- Every variable needs a sample. No threats, no misleading offers, no more personal data than the person expects.
- Which WhatsApp business number sends batch 1 and batch 2 is an open question for Dev A and Mohamed (`docs/WHATSAPP_TEMPLATES_ALL.md`). Tamil and Hindi versions (`_ta`, `_hi`) only after a native reader checks the wording.
