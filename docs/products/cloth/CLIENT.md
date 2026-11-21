# Afra Cloth: front end (client)

Status: written, not yet tested. The folder `apps/cloth/client` is a Vite and React page, copied from the Hire client. It has sign-in and sign-up, the owner panel built from `apps/cloth/admin/manifest.json`, an install-to-home-screen file and a language box where menu names exist. Nothing here has been built or opened in a browser. The files were only syntax-checked with esbuild, and a test bundle resolved every import.

Wording on the page is limited to what is true today: an invite-only pilot. No prices and no promises.

## What is in it
- `src/AuthGate.jsx`: sign in or ask to join the pilot, against `/api/cloth/auth`. Shows a read-only banner when the plan has ended.
- `src/main.jsx`: top bar (business name, Billing button, language box when the product has Tamil/Hindi names, sign out) and the owner panel. The panel gets the signed-in role, so each person sees only the menu items their role may see.
- `src/product.js`: name, colour, server address and header, in one place.
- `public/`: install file, service worker (never stores `/api`), icons (plain placeholder letters in the product colour; replace with real artwork).

## Screens (CLIENT-04, written, not yet tested by a person)
The top bar now has tabs next to the owner panel: Panel, Bill, Alterations, Stock, Customers, Other items. The screens are in `src/screens/`, all wording in `src/strings.js` (English only), one small client in `src/api.js`.

- **Bill** (`Bill.jsx`): scan or type a barcode (`GET /api/cloth/variants/by-barcode/:code`), or find an item and tap size then colour. Each line carries `variantId`; fabric items take metres with up to 2 decimals. Staff is chosen on every line. Discount per line and on the whole bill, with a reason that is required; if the server refuses (the owner's staff limit, D-30) its own message is shown. Payments: cash, UPI, card, pay later. The bill is saved with `POST /api/pos/bills` (through the Cloth stock guard) and carries a `clientId`, so a retry does not make a second bill. The total shown is a preview from the shared bill maths; the server's figure is the one saved. GST on the bill is a choice on the screen (No GST, added on top, price already has GST); Cloth has no per-shop GST-mode setting yet, so the default is No GST. Open question for the CA and the owner.
- **Alterations** (`Alterations.jsx`): list with filters (all, late, ready but not collected for 7 days, each status), new job, move along the flow with only the allowed buttons, pickup link and a new link (`/api/cloth/alterations`, `/:id/status`, `/:id/pickup-link`). "Ready" shows the server's suggestion to message the customer; nothing is sent.
- **Stock** (`Stock.jsx`): count (`POST /api/cloth/variants/:id/count`; the owner may also set the system stock to the count) with the list of counts that did not match (`/reports/stock-mismatch`); return or exchange (`POST /api/cloth/returns`) with a required reason. The money side is still the shared bill return, as the server says.
- **Customers** (`People.jsx`): search, loyalty points per customer (`GET /api/pos/customers/:id`), and CSV import with a preview first, then add (`POST /api/pos/import/customers`, split into pieces of 1000 rows).
- **Other items**: the shared item billing screen, for things not sold by size and colour.

### Limits of these screens
- Never run in a browser. Syntax-checked with esbuild, and `main.jsx` bundles with every import resolved. That is all.
- Return screen: a saved bill's lines carry no variant id, so the shop picks the items coming back from its own list, and the server checks the quantity against what that bill sold. Choose the bill first.
- Redeeming loyalty points on a bill, a per-customer sizes/occasion editor, label printing, and the CSV import of items and variants are not in these screens. Quoted line breaks inside a CSV cell are not handled when splitting a big file.
- No Tamil or Hindi text on these screens yet.
- Rs amounts are whole rupees (INR).

## Dev A: build and try it
1. `cd apps/cloth/client && npm install && npm run build` (should end with a `dist` folder; if the build complains about `core-pos` being CommonJS, tell Claude the exact message).
2. For a local look: start the product server on port 5010 with its settings, then `npm run dev` in the client folder and open the address it prints. Sign up, then open each menu item.
3. Check the Cloth screens too: bill an item by barcode and by size and colour; bill 2.5 metres of a fabric item; as staff try a discount over the owner's limit and read the message; make an alteration job and open its pickup link in a private window; count one item; return one item and see its stock go back; import a small customer CSV and check the preview before adding.
4. Check: sign up works, sign in works, the menu shows, a staff login sees fewer items than the owner, Sign out returns to the sign-in page.
5. Check installing to the home screen works on a phone (production build only).

## Dev A: serve it on the same domain
Best: the web server (nginx) serves `apps/cloth/client/dist` for the product's address and passes `/api` to port 5010. If it is easier to serve it from the product's Express app, this is the exact change to `apps/cloth/src/app.js`, just before `return app;` (not applied yet, because other workers are editing that file):

```js
const path = require('path');
app.use(express.static(path.join(__dirname, '../client/dist')));
app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(__dirname, '../client/dist/index.html')));
```

## Known limits
- The page was never run. Treat every screen as untested.
- Tamil and Hindi menu names (where present) are drafts and need a native speaker (M-06). Text inside the shared panel and billing screens is English only.
- Icons are placeholders.
