# WhatsApp templates: Afra to business owners (B2B), all products

Generated from `packages/core-whatsapp/src/afraTemplates.js`. Do not edit by hand: change the code and run `node scripts/gen-template-doc.js`.
Submit in WhatsApp Manager > Message templates, language English, body only (no header, footer or buttons). Name, wording and the order of {{1}}, {{2}} must match exactly.
Sent from Afra's own business number to owners who signed up or asked to be contacted. Meta decides the final category; accept a re-label and tell Kamarudeen.

## afra_welcome

- Category: UTILITY
- Parameters in order: {{1}} = name, {{2}} = product, {{3}} = trial_end, {{4}} = phone
- Body:

> Hi {{1}}, welcome to {{2}}. Your free trial has started and ends on {{3}}. Need help? Call {{4}}, Monday to Saturday, 10 am to 6 pm.

- Sample values for Meta: Ravi | Fit | 12 Nov 2026 | 9876543210

## afra_trial_ending

- Category: UTILITY
- Parameters in order: {{1}} = name, {{2}} = product, {{3}} = days, {{4}} = end_date, {{5}} = phone
- Body:

> Hi {{1}}, your {{2}} free trial ends in {{3}} day(s), on {{4}}. To keep your data and continue, choose a plan in the app. Help: {{5}}.

- Sample values for Meta: Ravi | Fit | 3 | 12 Nov 2026 | 9876543210

## afra_payment_received

- Category: UTILITY
- Parameters in order: {{1}} = name, {{2}} = amount, {{3}} = product, {{4}} = invoice, {{5}} = paid_until
- Body:

> Hi {{1}}, we received Rs {{2}} for your {{3}} plan. Invoice {{4}}. Your plan is active until {{5}}. Thank you.

- Sample values for Meta: Ravi | 999 | Fit | AV/2026-27/0007 | 12 Dec 2026

## afra_renewal_reminder

- Category: UTILITY
- Parameters in order: {{1}} = name, {{2}} = product, {{3}} = days, {{4}} = end_date, {{5}} = phone
- Body:

> Hi {{1}}, your {{2}} plan ends in {{3}} day(s), on {{4}}. Renew in the app to avoid a break. Help: {{5}}.

- Sample values for Meta: Ravi | Fit | 7 | 12 Dec 2026 | 9876543210

## afra_plan_expired

- Category: UTILITY
- Parameters in order: {{1}} = name, {{2}} = product, {{3}} = grace_days, {{4}} = phone
- Body:

> Hi {{1}}, your {{2}} plan has ended. You have {{3}} more day(s) before the account becomes read-only. Renew in the app. Help: {{4}}.

- Sample values for Meta: Ravi | Fit | 3 | 9876543210

## afra_account_readonly

- Category: UTILITY
- Parameters in order: {{1}} = name, {{2}} = product, {{3}} = end_date, {{4}} = phone
- Body:

> Hi {{1}}, your {{2}} account is now read-only because the plan ended on {{3}}. Your data is safe. Renew in the app to make changes again. Help: {{4}}.

- Sample values for Meta: Ravi | Fit | 15 Dec 2026 | 9876543210

## afra_refund_update

- Category: UTILITY
- Parameters in order: {{1}} = name, {{2}} = amount, {{3}} = product, {{4}} = phone
- Body:

> Hi {{1}}, your refund of Rs {{2}} for {{3}} is approved. It should reach you in 7 to 14 working days. Questions? Call {{4}}.

- Sample values for Meta: Ravi | 999 | Fit | 9876543210

## afra_support_update

- Category: UTILITY
- Parameters in order: {{1}} = name, {{2}} = ticket, {{3}} = status, {{4}} = phone
- Body:

> Hi {{1}}, your support request {{2}} is now {{3}}. Reply here or call {{4}} if you need more help.

- Sample values for Meta: Ravi | T-1042 | resolved | 9876543210

## afra_callback

- Category: UTILITY
- Parameters in order: {{1}} = name, {{2}} = product, {{3}} = day, {{4}} = phone
- Body:

> Hi {{1}}, as you asked, our team will call you about {{2}} on {{3}} between 10 am and 6 pm. Another time suits you? Call {{4}}.

- Sample values for Meta: Ravi | Fit | Friday | 9876543210

## afra_winback

- Category: MARKETING
- Parameters in order: {{1}} = name, {{2}} = product, {{3}} = days, {{4}} = phone
- Body:

> Hi {{1}}, your {{2}} account is paused and your data is saved for {{3}} more days. You can renew in the app any time, or call {{4}} and we will help.

- Sample values for Meta: Ravi | Fit | 30 | 9876543210
