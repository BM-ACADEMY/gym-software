# Test hand-over: all products (12 Nov 2026)

Everything here is **written, not yet tested by a person**. Plain-node checks passed on the Claude side, but they use stand-in data, not a real database. Your results are the proof. Report in the test sheet: Pass or Fail plus one line. Fix reports come back to Claude first (project rule).

Each product has its own sheet rows in `docs/products/<product>/QA_TESTS.tsv` (11 columns, paste under the end of sheet v4). Product folders: salon, mart, wash, cloth, dine, hire. Gym tests stay as they are.

**Order to test (same for every role):** 1 Salon (with Clinic), 2 Mart, 3 Wash, 4 Cloth, 5 Dine, 6 Hire. Do Dev A first; Dev B and Staff start a product only after Dev A says its app runs.

**Rules for everyone**
- Fake data only. Never real customers, real phone numbers or real money.
- Never put a password, key or secret in the sheet, chat or screenshots.
- If something is not on a screen yet, write "no screen" and move on; it is probably in the Phase 2 list of that product. Do not call it a pass.

---

## Dev A (set up and run)

For each product, in this order, do the S rows in its QA_TESTS.tsv (ids SAL-S1.., MRT-S1.., WSH-S1.., CLO-S1.., DIN-S1.., HIR-S10..).

1. In the product folder (`apps/<product>`) run `npm install` then `npm test`.
   - **Pass means:** every test file passes.
   - **Fail means:** any red test. Send the output to Claude. Do not edit the tests.
2. Put the two settings in the server settings file (never in git): the database address and the product session secret (32+ random characters). Start the app. Open the health address.
   - **Pass means:** health says ok true. With the settings removed, every `/api` address answers 503 (closed).
   - **Fail means:** the app runs without its settings.
3. Run the database test file in the product (`tests/routes.db.test.js` where it exists) against a test database whose name ends in `test`. It is emptied each run.
4. Do the product special checks:
   - Salon: three people book the same slot at the same moment. Exactly one wins.
   - Mart: credit limit works; stock goes down once; day close adds up.
   - Wash: a monthly pass loses one wash per delivery; closing the day twice is refused.
   - Cloth: a bill takes the stock of that size and colour once, and gives it back if the bill fails; selling more than the stock is refused. Also check the double sign-in check on the bill route.
   - Dine: a second payment on the same order is refused; two phones adding a line at once; recipe stock falls once.
   - Hire: two agencies never see each other.
5. Open every CSV export in a spreadsheet. **Pass means** no cell runs as a formula. **Fail means** a cell starting with = calculates.
6. Send Claude: which tests passed, which failed, any error text.

## Dev B (attack through the API)

Start a product after Dev A says it runs. Do its A rows (SAL-A1.., MRT-A1.., WSH-A1.., CLO-A1.., DIN-A1.., HIR-A10..).

Always try these on every product:
- **Other business:** sign in as business B and ask for business A's records by id, and send a tenantId in the body and in the address. **Pass means** not found, forbidden or empty. **Fail means** any of A's data appears or changes.
- **Signed out:** every address answers 401.
- **Role bypass:** staff and other roles try owner screens (settings, accounts, export, discount rule). **Pass means** refused. **Fail means** it works.
- **Discount over the limit:** staff 10 percent with a reason works; 11 percent, or any discount with no reason, is refused and nothing is saved. Try it as a line discount, a bill discount and both. The owner is never limited.
- **Replay and double submit:** the same bill, payment, delivery or day close twice. **Pass means** the second one is refused or returns the first. **Fail means** a second record or a second charge.
- **Injection:** text such as a script tag, `{"$ne":null}` and a name starting with `=` in every text field. **Pass means** stored as plain text. **Fail means** it acts.
- **Tokens and limits:** Salon booking link and Hire share and consent links: wrong, guessed, old and reused tokens are refused; quick repeated requests are slowed.
- Write down the exact request and the answer for every Fail. Do not fix; send to Claude.

## Staff 1 and Staff 2 (screen tests)

Staff 1 takes the odd rows and Staff 2 the even rows shown in the Who column of each product's T rows (SAL-T1.., MRT-T1.., WSH-T1.., CLO-T1.., DIN-T1.., HIR-T10..). Use a phone-sized screen, then a laptop once.

For each row: do the steps exactly as written, then compare with **Pass means** and **Fail means**. Take a screenshot only of fake data.

Things to watch in every product:
- **First screen** after sign-up shows something true about the shop (services filled in, or an empty list with one clear next button).
- **Money** is whole rupees and shows the currency.
- **Discounts:** staff can give a small discount with a reason; a big one is refused with a message; the owner then sees it in the daily list.
- **Estimates** (next month, busy hours, run-out) say "estimate" and give a reason. **Fail means** any estimate that reads like a promise.
- **Suggestions** never send anything by themselves. **Fail means** any message goes out without the owner switching it on.
- **Tamil and Hindi:** only Salon, Mart and Gym have drafts; wording needs a native review, so note awkward words but do not fail on them.

## What the team should not mark Pass yet (owner or outside help needed)
- GST rates, SAC and HSN wording and invoice text: CA (Salon, Wash, Cloth, Dine).
- WhatsApp message templates for each product: not submitted to Meta; nothing is sent.
- Clinic records, Hire candidate messages, pub and alcohol wording: lawyer.
- Price ladders for all five new products: owner approval after the floor-price tables.

## Known open items (not failures)
- Salon: no screens yet for expenses, profit and loss, GST, export; booking page screen and QR are Phase 2.
- Mart: no screen yet for the discount rule; credit limit clear in the panel.
- Wash: no discount settings screen; a cancel after work started needs no reason yet.
- Cloth: barcode scan on the bill screen; customer pages.
- Dine: own table and kitchen screens (DIN-UI); real-database route tests (DIN-QA).
- Every product: audit trail screen, data export and delete on request, staff payslips.

## Update 12 Nov (night): build the front-ends first (Dev A)
The five new products now also have a phone front-end each, written but never built or opened. Before the Staff tests, do this once per product (Salon, Mart, Dine, Cloth, Wash):
1. `cd apps/<product>/client && npm install && npm run build`. Pass means the build finishes. If it complains about a shared billing file (core-pos), send Claude the exact message.
2. Start the product server (steps in `docs/products/<product>/DEV_A_STEPS.md` or STATUS/BUILD_NOTES), then `npm run dev` in the client folder, and sign up.
3. Serve the build behind the product's domain (three-line change in `docs/products/<product>/CLIENT.md`).
Then the Staff screen tests apply to these screens: Salon (day view, queue, bill), Dine (tables, kitchen, bill), Cloth (bill by barcode and by size and colour, alterations, stock), Wash (job board, new job, dues, close the day), Mart (billing with barcode and weight, team logins, downloads).
Staff discount rule (D-30): as staff, give a discount over the owner's limit; it must be refused with the limit message. As owner, change the rule in the Discounts screen, then try again.
Set per product on the server (never in git): `INTERNAL_API_KEY` (for Super Admin counts), and in Super Admin the per-product `ADMIN_URL_<PRODUCT>` and `ADMIN_KEY_<PRODUCT>`. Note Wash's summary route is `/api/internal/wash/admin-summary`; the others use `/api/internal/admin-summary`.
