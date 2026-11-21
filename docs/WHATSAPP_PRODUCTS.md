# WhatsApp for all products: one sender, written 16 Nov (not yet tested against Meta)

## What exists
- `packages/core-whatsapp/src/sender.js`: one sender for every product, over Meta's WhatsApp Cloud API. Tested here only with a pretend network (17 tests in the package, under a stand-in runner; Dev A runs the real `npm test`).
- `afraTemplates.js`: Afra to business owners (welcome, trial, payment, renewal...). Already existed; see `docs/WHATSAPP_TEMPLATES_AFRA.md`.
- `productTemplates.js`: DRAFT messages from a business to its own customers or candidates, two per product at most. Not submitted to Meta.
- The gym still has its own older sender (`server/utils/whatsapp.js`). It is not switched over yet.

## Rules built in
1. Sends only when all three are true: `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN` are set, `WHATSAPP_SENDING=on`, and the caller passes `consent: true` for that person. Otherwise it only logs a demo line with the phone number masked.
2. Approved templates only. No free text, no outreach by chat.
3. Quiet hours 9 pm to 8 am India time: nothing goes out unless the caller says the person is waiting for it.
4. Never throws, never logs or returns the token. One bad number cannot stop a run.
5. Optional duplicate guard (same key sent once).

## Not done yet (waiting on Kamar and Aakash)
- Which provider or Meta directly, the number, Meta business verification, which templates are already approved (message to Aakash sent 14 Nov).
- Tamil and Hindi wording (same names with `_ta`, `_hi`).
- Wiring: no product job calls the sender yet. Each job (reminders, dues, come-back) is built per product, starts at Suggest level, and needs an owner switch. Each needs an "agreed to be contacted" field on the customer, which Groom, Mart and Cloth customers already have in some form (check per product before wiring).
- Usage counting per business and the plan allowance (SA-03).
- Opt-out handling ("stop") and delivery webhooks.
- Submitting templates in WhatsApp Manager.

## Server settings (set later, by Dev A, at hidden prompts, never in git or chat)
`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_SENDING` (leave off until the first test), optional `WHATSAPP_TEMPLATE_LANG` (default en), `WHATSAPP_API_VERSION` (default v21.0).
