# Dine: what Dev A runs (written, not yet tested by a person)

1. `cd apps/dine && npm install` then `npm test`. Expect: `rules`, `allinone`, `summary`, `routes`, `signup`, `session`, `app`, `tenantWiring` all pass. Send the output back.
2. Start with settings `MONGODB_URI` and `DINE_SESSION_SECRET` in the server settings file (never git). `GET /api/health` must say `{"ok":true}`. Without them every `/api` route must answer 503.
3. Sign up through `POST /api/dine/auth/signup` (header `x-requested-with: afra-dine`), then walk one table end to end with a real database: add menu items, open order, add lines, KOT, serve, bill, pay. Check: a second pay on the same order is refused; two phones adding a line at the same moment, one is told "Someone else just changed this order".
4. Two venues, two logins: venue B must never see venue A's orders, menu, cash, customers (Dev B attack list: change ids in the URL, send `tenantId` in the body and query).
5. Create a recipe, sell the dish, check the ingredient quantity went down by the recipe amount once, not twice.
6. Day close with a counted amount below expected: status `short`. CA export opens in a spreadsheet and a bill number starting with `=` shows as text.
7. The route tests use spy models. A real-database route test file is still to be written (Phase 2 item DIN-QA).
8. D-30 discounts: as a cashier, bill with a 10 percent discount (works, bill shows who and percent), then 11 percent (refused with the limit). As the owner set `discountRule` to `owner_only` in Settings: the cashier is refused. The owner summary shows "Staff gave N discounts worth Rs X".

## Phase 2 additions (written, not yet tested by a person)
9. Credit: pay an order with method credit (needs customer name and phone; refused above the venue credit limit, default Rs 5,000 is an Assumption). `GET /api/dine/credit/dues`, then `POST /credit/payments`: oldest dues are cleared first; a cash payment shows in the cash book as credit recovery.
10. Returns: `POST /orders/:id/returns` with a reason of 3+ letters. A second return beyond the billed quantity is refused. Credit owed and loyalty points fall; a cash refund appears in the cash book. Service charge is not refunded and food is not restocked (known limit).
11. Print: `GET /orders/:id/print/bill` (only billed or paid; A4 or A5) and `/print/kot?station=kitchen|bar`. Check the FSSAI number (14 digits, set in `PUT /settings/venue`) shows on the bill.
12. QR menu: `GET /dine-public/menu/<token>` opens without login, hides liquor, escapes names, answers 429 if hit too often. `POST /settings/menu-link/rotate` kills the old link. `GET /order-link` returns a WhatsApp link only; nothing is sent.
13. Imports: `/import/ingredients|recipes|guests/preview` shows rows and errors, `/commit` saves. Opening credit in a guest file is ignored and reported.
14. Privacy (owner only): guest export; delete needs `confirm: "DELETE"` and is refused while credit is owed; the audit list `GET /audit` shows both.
15. People: shifts (`/shifts`), leave (`/leave`, decide), `PUT /staff/:userId/pay`, `GET /payslip` (no PF, ESI or tax; the CA checks).
16. Loyalty and birthdays: `PUT /settings/loyalty`, earn and redeem on pay, `GET /customers/birthdays` is a suggestion list only.
17. Pages `/dine-public/app/tables` and `/app/kitchen` poll the API; signed-out users see "Please sign in to Dine first." Role-gating is by the API.
18. Super Admin: `GET /api/internal/admin-summary` with header `x-internal-key` (set `INTERNAL_API_KEY`, 24+ characters): 401 without it; no guest or owner contact data in the answer.
19. Not yet done: real-database route tests (DIN-QA), manifest screens for the new routes, overnight shifts overlapping across dates.
