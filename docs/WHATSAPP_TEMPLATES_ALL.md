# WhatsApp templates: master list (all products), 29 Oct

One place to see every template, who it is from and to, which batch it belongs to, and where the exact wording lives. Wording is never copied here; open the linked file.

| Batch | When | Templates | From → to | Wording lives in | Status |
| --- | --- | --- | --- | --- | --- |
| 1a | Today (29 Oct) | 6 gym: renewal reminder, plan expired, win-back, dues reminder, absence check-in, owner daily summary | Gym → its members (and one to the gym owner) | `docs/WHATSAPP_TEMPLATES.md` (code: `server/config/whatsappTemplates.js`) | Ready for Dev to submit |
| 1b | Today, after 1a | 10 Afra (B2B): welcome, trial ending, payment received, renewal reminder, plan expired, account read-only, refund update, support update, callback, win-back | Afra → business owner (all products) | `docs/WHATSAPP_TEMPLATES_AFRA.md` (code: `packages/core-whatsapp/src/afraTemplates.js`; doc is generated and a test checks they match) | Ready for Dev to submit; not yet sent by any code |
| 2 | Each product, a week before its launch | 15: groom 3, Mart 3, Dine 3, Cloth 3, Wash 3 | Shop → its customers | `docs/WHATSAPP_TEMPLATES_PRODUCTS.md` | Drafts, not for submission yet |
| 3 | After the lawyer's written approval is filed | 3 Hire: interview reminder, consent request, client update | Agency → candidate / client | `docs/WHATSAPP_TEMPLATES_PRODUCTS.md` (Hire section) | On hold |

Total: 34 templates. Today's batch is 16.

## Rules for all batches
- Name and the order of {{1}}, {{2}} must match the file exactly; the server fills values in that order.
- Only people who agreed get messages. Owners: they signed up or asked to be called. Members/customers: the shop confirms agreement in Settings. Stop at once on "stop".
- Quiet hours 9 pm to 8 am IST. A daily send limit applies.
- Meta decides utility vs marketing. Accept a re-label and tell Kamarudeen (cost changes).
- Never put real names, numbers or any key in a template sample. Samples are fake.
- Win-back, rebook, new-stock and offer messages are marketing: owner switches them on; never automatic by default.
- No template promises a discount, a guarantee or results.

## Open questions for Dev A and Kamarudeen (facts needed, not guessed)
1. Which WhatsApp business account and number sends batch 1a (a shop's message to its member) and batch 1b (Afra to the owner)? Is one Afra account enough for all shops, or does each shop need its own number? Answer decides how batch 2 is set up. (Assumption: one Afra number to start; to check with Meta's rules for tech providers.)
2. Support phone number for the {{phone}} values: +91 78269 97187 (digits for config: 917826997187). Confirm with Dev A that it is the number that sends and receives WhatsApp.
3. Tamil and Hindi: same names with `_ta` / `_hi`, after a native reader checks the wording.

## What "applied" means today
- Batch 1a wording is also in the gym's server code and already used by the gym.
- Batch 1b is defined in code as data with tests, but nothing sends it yet. Sending needs: the trial and billing events (shared billing core), the sales hand-off, and Meta approval. Tracked as WA-03 in `docs/BACKLOG.md`.

## Status log
- 2 Nov 2026: Kamarudeen reports the templates are **under review** at Meta (which batches and each template status not yet given; Dev A to report per template).
