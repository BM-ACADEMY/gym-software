# Afra Dine: front end (client)

Status: written, not yet tested. The folder `apps/dine/client` is a Vite and React page, copied from the Hire client. It has sign-in and sign-up, the owner panel built from `apps/dine/admin/manifest.json`, an install-to-home-screen file and a language box where menu names exist. Nothing here has been built or opened in a browser. The files were only syntax-checked with esbuild, and a test bundle resolved every import.

Wording on the page is limited to what is true today: an invite-only pilot. No prices and no promises.

## What is in it
- `src/AuthGate.jsx`: sign in or ask to join the pilot, against `/api/dine/auth`. Shows a read-only banner when the plan has ended.
- `src/main.jsx`: top bar (business name, language box when the product has Tamil/Hindi names, sign out) and the owner panel. The panel gets the signed-in role, so each person sees only the menu items their role may see.
- `src/product.js`: name, colour, server address and header, in one place.
- `public/`: install file, service worker (never stores `/api`), icons (plain placeholder letters in the product colour; replace with real artwork).

## Billing
No shared billing screen: Dine bills from an open order (`POST /api/dine/orders/:id/bill`), so it needs a table and order screen.

## Still needs product-specific screens
- Table view: open tables, start an order, add items and modifiers
- KOT board and kitchen/bar display (another worker is adding plain HTML versions; decide whether to keep them or build them here)
- Bill screen: split bill, service charge, discount with reason, payment
- QR menu and print views

## Dev A: build and try it
1. `cd apps/dine/client && npm install && npm run build` (should end with a `dist` folder; if the build complains about `core-pos` being CommonJS, tell Claude the exact message).
2. For a local look: start the product server on port 5009 with its settings, then `npm run dev` in the client folder and open the address it prints. Sign up, then open each menu item.
3. Check: sign up works, sign in works, the menu shows, a staff login sees fewer items than the owner, Sign out returns to the sign-in page.
4. Check installing to the home screen works on a phone (production build only).

## Dev A: serve it on the same domain
Best: the web server (nginx) serves `apps/dine/client/dist` for the product's address and passes `/api` to port 5009. If it is easier to serve it from the product's Express app, this is the exact change to `apps/dine/src/app.js`, just before `return app;` (not applied yet, because other workers are editing that file):

```js
const path = require('path');
app.use(express.static(path.join(__dirname, '../client/dist')));
app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(__dirname, '../client/dist/index.html')));
```

## Known limits
- The page was never run. Treat every screen as untested.
- Tamil and Hindi menu names (where present) are drafts and need a native speaker (M-06). Text inside the shared panel and billing screens is English only.
- Icons are placeholders.


## Staff screens (CLIENT-03, written 12 Nov, not yet run by a person)

The Dine client now has tabs next to the owner panel: **Tables, Kitchen, Bill, Pay later, Returns, Panel**. Files are in `apps/dine/client/src/screens/`.

| Tab | What it does | Server routes used (all under `/api/dine`) |
| --- | --- | --- |
| Tables | Coloured table buttons (free, open, in kitchen, served, billed); tap to open or start an order; takeaway; bar tab only if pub mode is on | `GET /orders`, `POST /orders`, `GET /settings` |
| Order (inside Tables) | Menu search and categories, size or type and extras, send to kitchen or bar, remove an item (reason needed once sent), mark served, print kitchen or bar ticket | `GET /menu`, `GET /orders/:id`, `POST /orders/:id/lines`, `POST /orders/:id/kot`, `POST /orders/:id/lines/:lineId/void`, `POST /orders/:id/served`, `GET /orders/:id/print/kot?station=` |
| Kitchen | Big tickets for the kitchen or the bar, refreshes every 10 seconds, tap Served | `GET /kitchen?station=`, `POST /orders/:id/served` |
| Bill | Make the bill with an optional discount (type, value, reason; the server's refusal message is shown as it is), service charge and GST lines, split equally or by items, payments (cash, UPI, card, pay later, loyalty points), reopen with a reason, print A5 or A4 | `POST /orders/:id/bill`, `/split`, `/pay`, `/reopen`, `GET /orders/:id/print/bill?size=` |
| Pay later | Who owes (phone masked), collect a payment | `GET /credit/dues`, `POST /credit/payments` |
| Returns | Pick a paid order, quantity per line, reason; refund shown from the server | `GET /orders?status=paid`, `POST /orders/:id/returns` |

Words are in `screens/strings.js` (English complete, Tamil draft, needs a native speaker, M-06). There is no pricing or claims text.

### What changed in the final list (13 Nov, written, not yet tested by a person)
- **Table list is on the server now:** `GET` and `PUT /api/dine/settings/tables` (owner or manager saves; anyone who takes orders reads). Every phone shows the same tables. A list left in a browser by the older version is used once and saved to the server if this login may.
- **Tabs follow the role:** `GET /api/dine/auth/me` now also answers `staffRole` and `allowed` (the role's action list). The tab bar hides tabs the role cannot use (kitchen sees only Kitchen, captain sees Tables only). If `allowed` is missing the page shows every tab and the server refuses, as before.
- **Import tab** (owner or manager): ingredients, recipes, guests from a CSV file or pasted rows. "Check first" saves nothing; "Save" re-reads the same text on the server.
- **Owner panel screens added:** Pay later (who owes), Returns and refunds, Payslips (this month and last month), Loyalty points settings.
- **Returns:** the service charge is now refunded in proportion to what is returned (part returns add up to the whole). Food is put back in stock only if the returning person asks (`restock: true`); cooked food usually cannot be reused. There is no tick box for restock on the Returns tab yet.
- **Shifts:** an overnight shift (for example 22:00 to 02:00) now blocks the early hours of the next day and the evening before.

### Still not there
- Table moves and merges, guest names on orders, item notes, kitchen sound alert, a menu editing screen (the owner panel covers menu), a restock tick box on the Returns tab.
- Loyalty settings screen leaves the "largest share of a bill that points can pay" at its default (the shared screen has no decimal field).
- **Print pages** open in a new tab and rely on the sign-in cookie (they are GET pages).
- **Not run:** syntax-checked with esbuild only. Nobody has run it in a browser.

### Dev A steps for these screens
1. `cd apps/dine/client && npm install && npm run build`, then `npm run dev` against a running Dine server.
2. As owner: add two tables, open one, add a dish with a size and an extra, send to kitchen, open the Kitchen tab in a second window and press Served.
3. Bill it: try a discount without a reason (should be refused), with a reason, and as a cashier above the owner's limit (the refusal text must show). Split by items for 2 guests, pay half cash and half UPI, print A5.
4. Pay later: bill with the Pay later method and a guest name and 10-digit phone; check Pay later lists them; collect a part payment.
5. Returns: return one line of a paid order with a reason; try returning more than was sold (must be refused).
6. As kitchen role: only Kitchen should work; other tabs must show "Not allowed for your role".
7. Switch the language box to Tamil and check nothing breaks (missing lines fall back to English).
