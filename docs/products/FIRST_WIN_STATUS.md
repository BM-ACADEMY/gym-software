# First win in five minutes and set-up checklist: status (13 Nov)

Status: **written, not yet tested by a person.** Plain-node checks pass (4 to 6 tests per product, in each `apps/<product>/tests/firstwin.test.js`); nothing has run against a real database or in a browser.

Shared code: `packages/core-pos/src/firstWin.js` (checklist, setup record, routes) and `firstWinStrings.js` (English, Tamil draft needing native review M-06). Each product supplies its own `src/firstWin.js` (steps, the one number, sample records) and mounts it in `src/app.js`.

| Product | The one number (the owner's loss) | Steps | Source of the number |
|---|---|---|---|
| Salon | Customers not back in 60 days, and what their last service is worth | prices, staff, first bill, see suggestions, share booking link | Customer.lastVisit, Service price |
| Mart | Udhaar pending and from how many customers | items, first bill, staff, close day, see suggestions | PosCustomer.creditDue |
| Dine | Guests not back in 60 days, times your own average paid bill (estimate) | menu, first paid order, close day, staff, share QR menu, see suggestions | Customer.visits, paid orders |
| Cloth | Items in stock with no sale for 90 days, and the stock value held (cost, else MRP; estimate) | stock, first bill, staff, close day, see suggestions | Variant.lastSoldOn / addedOn |
| Wash | Vehicles not washed for 30 days, times your own average delivered job (estimate) | price list, attendant, first job, close day, see suggestions | Vehicle.lastWash, delivered jobs |

Routes (all owner only, tenant scoped, under `/api/<product>`): `GET /first-win`, `GET /setup`, `GET /setup/steps`, `POST /setup/steps/:key/done` (manual steps only), `POST /setup/sample`, `POST /setup/sample/remove`. The two POSTs for sample data and the tick respect the read-only rule for expired accounts. Add `?lang=ta` for the Tamil draft.

Honesty rules kept: a sample is always labelled "Sample" and never shown as the owner's; sample data is refused once the owner has real records; removal deletes exactly the records that were created (their ids are stored), and the checklist ignores sample records.

Known gaps (for the parent to log):
- The panel does not yet pass the owner's language to these screens (`?lang=ta`); the screen titles are translated only for Mart (strings.json).
- "I did this" steps are ticked by the owner; the first-win screen does not tick "see suggestions" by itself.
- Dev A: run `node --test`/jest for the six `firstwin.test.js` files against the real packages and confirm the dot-path `$set` (`marks.<key>`, `sample.on`) works on real MongoDB, then screen-test on a phone.
