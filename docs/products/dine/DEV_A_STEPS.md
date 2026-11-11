# Dine: what Dev A runs (written, not yet tested by a person)

1. `cd apps/dine && npm install` then `npm test`. Expect: `rules`, `allinone`, `summary`, `routes`, `signup`, `session`, `app`, `tenantWiring` all pass. Send the output back.
2. Start with settings `MONGODB_URI` and `DINE_SESSION_SECRET` in the server settings file (never git). `GET /api/health` must say `{"ok":true}`. Without them every `/api` route must answer 503.
3. Sign up through `POST /api/dine/auth/signup` (header `x-requested-with: afra-dine`), then walk one table end to end with a real database: add menu items, open order, add lines, KOT, serve, bill, pay. Check: a second pay on the same order is refused; two phones adding a line at the same moment, one is told "Someone else just changed this order".
4. Two venues, two logins: venue B must never see venue A's orders, menu, cash, customers (Dev B attack list: change ids in the URL, send `tenantId` in the body and query).
5. Create a recipe, sell the dish, check the ingredient quantity went down by the recipe amount once, not twice.
6. Day close with a counted amount below expected: status `short`. CA export opens in a spreadsheet and a bill number starting with `=` shows as text.
7. The route tests use spy models. A real-database route test file is still to be written (Phase 2 item DIN-QA).
