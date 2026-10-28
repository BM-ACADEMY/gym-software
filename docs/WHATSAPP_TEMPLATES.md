# WhatsApp templates to submit to Meta

Submit each template below in WhatsApp Manager (Message templates), language English, body only (no header, footer or buttons).
The name and the order of {{1}}, {{2}} must match exactly, because the server fills them in that order.
Source of truth: `server/config/whatsappTemplates.js`.

**Cost and approval notes**
- Utility messages cost about Rs 0.145 each in India, marketing messages about Rs 1.09 (rates change; check Meta's current price list).
- Meta decides the category, not us. If it re-labels a utility template as marketing, accept it; the cost estimate then changes.
- Approval usually takes minutes to 2 days. A rejected template needs a reworded resubmission.
- Tamil and Hindi versions are added in Phase 1c with the same names plus language code (ta, hi).
- Members must have agreed to receive these messages. The gym confirms this when switching reminders on in Settings.

## gymdesk_renewal_reminder

- Category: UTILITY
- Parameters in order: {{1}} = name, {{2}} = gym, {{3}} = days, {{4}} = phone
- Body:

> Hi {{1}}, your membership at {{2}} ends in {{3}} day(s). Renew now to keep your access without a break. Questions? Call {{4}}.

- Sample values for Meta: Ravi | Iron House Gym | 7 | 9876543210

## gymdesk_plan_expired

- Category: UTILITY
- Parameters in order: {{1}} = name, {{2}} = gym, {{3}} = phone
- Body:

> Hi {{1}}, your membership at {{2}} has ended. Renew to start training again. Call {{3}} and we will set it up for you.

- Sample values for Meta: Ravi | Iron House Gym | 9876543210

## gymdesk_winback

- Category: MARKETING (Meta will very likely treat a win-back as marketing)
- Parameters in order: {{1}} = name, {{2}} = gym, {{3}} = phone
- Body:

> Hi {{1}}, we miss you at {{2}}! Your membership ended recently. Come back this week and we will get you started again. Call {{3}}.

- Sample values for Meta: Ravi | Iron House Gym | 9876543210

## gymdesk_dues_reminder

- Category: UTILITY
- Parameters in order: {{1}} = name, {{2}} = gym, {{3}} = amount, {{4}} = upi, {{5}} = phone
- Body:

> Hi {{1}}, a payment of Rs {{3}} is pending at {{2}}. You can pay by UPI to {{4}}. Already paid? Please ignore this. Call {{5}} for help.

- Sample values for Meta: Ravi | Iron House Gym | 1500 | irongym@okaxis | 9876543210

## gymdesk_absence_checkin

- Category: MARKETING (likely; a check-in nudge is promotional in Meta's view)
- Parameters in order: {{1}} = name, {{2}} = gym, {{3}} = days
- Body:

> Hi {{1}}, we have not seen you at {{2}} for {{3}} days. Everything okay? Your trainers are ready whenever you are.

- Sample values for Meta: Ravi | Iron House Gym | 7

## gymdesk_owner_daily_summary

- Category: UTILITY
- Parameters in order: {{1}} = gym, {{2}} = checkins, {{3}} = collected, {{4}} = dues, {{5}} = renewals
- Body:

> Daily summary for {{1}}: {{2}} check-ins today, Rs {{3}} collected, Rs {{4}} dues pending, {{5}} memberships ending in the next 7 days.

- Sample values for Meta: Iron House Gym | 42 | 6500 | 12000 | 9

