# WhatsApp templates for the other products (drafts)

Written 28 Oct 2026. **Gym templates are in `docs/WHATSAPP_TEMPLATES.md` and are ready to submit.** The ones below are drafts for the other six products: not in code yet, not submitted. Submit the gym six first (29 Oct), then these after each product's messages exist in code. Prefix per product (D-12). Same rules as the gym file: English, body only, parameter order must match, Meta decides the category, rates change.

Customers must have agreed to messages. Marketing templates are prepaid per message (about Rs 1.09, check Meta's price list); utility about Rs 0.145.

## Salon (`groom_`)
- `groom_appointment_reminder` UTILITY. Params: name, salon, time, phone. Body: Hi {{1}}, a reminder of your appointment at {{2}} on {{3}}. Need to change it? Call {{4}}. Sample: Priya | Glow Salon | Fri 15 Nov, 4 pm | 9876543210
- `groom_booking_confirmed` UTILITY. Params: name, salon, service, time. Body: Hi {{1}}, your booking at {{2}} for {{3}} is confirmed for {{4}}. Sample: Priya | Glow Salon | haircut | Fri 15 Nov, 4 pm
- `groom_rebook_nudge` MARKETING. Params: name, salon, phone. Body: Hi {{1}}, it has been a while since your last visit to {{2}}. Call {{3}} to book your next slot.

## Mart (`mart_`)
- `mart_credit_reminder` UTILITY. Params: name, shop, amount, phone. Body: Hi {{1}}, Rs {{3}} is pending at {{2}}. Already paid? Please ignore this. Call {{4}} for help. Sample: Ravi | Kumar Stores | 450 | 9876543210
- `mart_bill_copy` UTILITY. Params: name, shop, amount, billno. Body: Hi {{1}}, thank you for shopping at {{2}}. Your bill {{4}} for Rs {{3}} is recorded.
- `mart_owner_daily_summary` UTILITY. Params: shop, sales, bills, credit. Body: Daily summary for {{1}}: Rs {{2}} sales from {{3}} bills, Rs {{4}} credit given today.

## Dine (`dine_`)
- `dine_booking_confirmed` UTILITY. Params: name, place, people, time. Body: Hi {{1}}, your table at {{2}} for {{3}} is confirmed for {{4}}.
- `dine_booking_reminder` UTILITY. Params: name, place, time, phone. Body: Hi {{1}}, a reminder of your table at {{2}} at {{3}}. To change it call {{4}}.
- `dine_regulars_offer` MARKETING. Params: name, place, phone. Body: Hi {{1}}, we would love to see you again at {{2}}. Call {{3}} to book a table.

## Cloth (`cloth_`)
- `cloth_order_ready` UTILITY. Params: name, shop, orderno. Body: Hi {{1}}, your order {{3}} at {{2}} is ready for pickup.
- `cloth_dues_reminder` UTILITY. Params: name, shop, amount, phone. Body: Hi {{1}}, a payment of Rs {{3}} is pending at {{2}}. Already paid? Please ignore this. Call {{4}} for help.
- `cloth_new_stock` MARKETING. Params: name, shop, phone. Body: Hi {{1}}, new stock has arrived at {{2}}. Visit us or call {{3}}.

## Wash (`wash_`)
- `wash_job_ready` UTILITY. Params: name, place, vehicle. Body: Hi {{1}}, your {{3}} is ready for pickup at {{2}}.
- `wash_job_received` UTILITY. Params: name, place, vehicle, time. Body: Hi {{1}}, we received your {{3}} at {{2}}. Expected ready time: {{4}}.
- `wash_due_reminder` MARKETING. Params: name, place, phone. Body: Hi {{1}}, it is time for your next wash at {{2}}. Call {{3}} to book.

## Hire (`hire_`): Mohamed reports (29 Oct) the lawyer approved. Before submitting, file the lawyer's written approval of this exact wording in the shared drive and note the date in the backlog
- `hire_interview_reminder` UTILITY. Params: name, company, time. Body: Hi {{1}}, a reminder of your interview with {{2}} on {{3}}. Reply here if you need to change it.
- `hire_consent_request` UTILITY or MARKETING (Meta decides). Params: name, agency. Body: Hi {{1}}, {{2}} would like to keep your details to match you with jobs. Reply YES to agree or NO to stop. Lawyer must approve this wording.
- `hire_client_update` UTILITY. Params: client, count, agency. Body: Hi {{1}}, {{3}} has sent {{2}} new candidates for your open job. Open your shortlist link to review.
Note: a link in the body needs the link added as a button or a fixed URL; decide when the client share page exists.

## Meta rules to keep in mind (Assumption from Meta's general template rules; check on the day)
- A body cannot start or end with a parameter, and two parameters cannot sit side by side.
- Each parameter needs a sample value when submitting.
- No threats, no misleading offers, no personal data beyond what the customer expects.
