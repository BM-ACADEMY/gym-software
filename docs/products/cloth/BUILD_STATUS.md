# Cloth: build status (12 Nov 2026). Written, not yet tested by a person

Code: `apps/cloth` (port 5010, fail-closed without `MONGODB_URI` and `CLOTH_SESSION_SECRET`). Billing, customers and loyalty come from `packages/core-pos` mounted at `/api/pos`; sign-up, sign-in and trial from the Hire pattern; plan engine from `packages/core-billing`.

## All-in-one standard (PRODUCT_PRINCIPLES section 7): what is covered
| # | Area | Phase 1 in code (pure rules + routes + tests) | Phase 2 (not silently dropped) |
| --- | --- | --- | --- |
| 1 | Accounts | Expenses by category, cash day close (expected vs counted), supplier bills and dues ageing, profit and loss in plain words, GST summary by rate, CSV for the CA (formula-safe). We do not file GST | Tally-style export format; customer-dues ledger screen (udhaar balance exists in core-pos, ageing list is in daily summary); bank reconciliation |
| 2 | Operations | Variants grid (size x colour), stock moves with optimistic lock, alteration and tailoring jobs with status flow, supplier bills | Fabric by metre and rolls, godown transfer, purchase-bill photo reading, barcode label PDF, roles beyond admin/subadmin |
| 3 | Staff | Staff list, attendance (present, half, absent, leave), month pay from salary | Shifts, leave balances, payslip PDF (core payroll), commission on sales |
| 4 | Sales | Bills through core-pos; sales by day, week, month; returned bills excluded | Sales by item, staff and hour screens; UPI payment link |
| 5 | Customers | Phone-keyed record (core-pos) plus occasion date, credit-since date, do-not-contact, remembered sizes | Import from old register already in core-pos CSV (needs the screen); visit history screen |
| 6 | Appointments or orders | Alteration orders with ready date | Booking link or QR for alterations, reminder messages (need approved templates) |
| 7 | Marketing | Suggest-only ideas with reasons: win-back, occasion, clearance, review request; templates named `cloth_*`, each marked "needs Meta approval" | Sending (only on owner switch), shareable shop page or QR |
| 8 | Prediction | Next-month sales range, busiest and slowest weekday, size gaps, stock that will run out, lapse risk, cash needed for dues, festival rule (last year same window + growth % the owner sets). All labelled estimates with the reason | AI explanation on top; forecasts by hour; seasonal curve beyond one year |
| 9 | Alerts and leaks | Heavy discounts, returns/voids by staff, repeated cash shortage | Stock mismatch vs physical count; drop in repeat customers |
| 10 | Control | Daily summary with three actions (suggest mode), tenant filter on every route, read-only guard when the plan lapses | Owner summary on WhatsApp, audit trail screen, data export and delete on request, backups, PWA install |
| 11 | Growth | none (by rule) | Multi-branch, online ordering, accounting integrations, e-invoice |

## Real gaps to know about (not hidden)
1. **(Done 12 Nov, written, not yet tested: CLO-05)** Bills now reduce variant stock: a bill line may carry `variantId`; `src/billGuard.js` sits in front of `POST /api/pos/bills`, takes price and GST from the shop's own variant, takes stock first (409 if short), gives it back if the bill is not saved, and writes a stock move with the bill id. Barcode scan on the bill screen is still Phase 2. Old note: bills did not reduce variant stock. Core-pos bills use `PosItem`; Cloth stock is in `ClothVariant`. Until a bill line carries a variant id and the stock move is written, the owner records sales on the stock screen (`type: sale`). Cost of goods in profit and loss and slow-stock dates depend on this. First Phase 2 item, needed before invite-only start.
2. GST bands are data (default read from busy.in on 12 Nov 2026: 5% up to Rs 2,500 per piece, 18% above) and flagged "needs CA confirmation". HSN wording is a CA item, not decided here.
3. No screens beyond the manifest-driven admin panel; the customer-facing pages are not built.
4. WhatsApp templates `cloth_*` do not exist yet; nothing is sent.
5. Plans in `src/plans.js` are an Assumption, not approved (Tier 3, CLO-P1).

## Dev A: what to run and look for
1. `cd apps/cloth && npm install && npm test`. Expect the plain-node checks below to pass under Jest too (11 + 14 + 8 + 9 + 3 + 4). Report any difference.
2. Start with `MONGODB_URI` and `CLOTH_SESSION_SECRET` (32+ chars) in the server settings file, hit `GET /api/health` (ok true). Without them every `/api` route must answer 503.
3. Sign up a test shop, add a style grid, record a purchase and a sale, add an alteration, add an expense, close the day. A second test shop must see none of it.
4. Check the fail-closed tenant guard: a query outside a signed-in request must throw (see `packages/core-server/tests/tenant.test.js`).
5. Copy `apps/hire/tests/app.test.js` pattern for a Cloth app test (503 without settings, 401 without sign-in on `/api/cloth/*` and `/api/pos/*`).

## D-30 staff discounts (12 Nov, written, not yet tested)
- Owner sets the rule in Settings (`PUT /api/cloth/settings { discountRule: { staff: 'any'|'limit'|'owner_only', maxPercent } }`, owner role only; default staff 'limit' 10 percent). Same `discountPolicy.js` as Salon.
- `billGuard.js` checks it after computing the bill (staff = any non-admin user), refuses with 403 and a plain message, otherwise saves who (owner/staff) and percent in `ClothBillDiscount` plus an audit line `CL-n 10% by staff`.
- Owner sees staff discounts in `GET /reports/leaks` (`staffDiscounts`) and as a note in the daily summary.
- **Proposed change for core-pos (not done, outside this fork's folder):** a `beforeBill` hook in `createPosRouter` so every product enforces D-30 in one place and `PosBill` carries `discountBy` and `discountPercent`; Cloth's wrapper can then be removed.
- Dev A: the guard runs `protect` twice on `/api/pos` (once in app.js, once inside the core-pos router); check there is no side effect and the tenant context still holds on the bill route.

## Phase 2 wave A (12 Nov, night). Written, not yet tested by a person
Plain-node checks: 17 test files, 96 checks, all pass (accounts 14, barcode 5, dataRights 4, discount 10, internal 2, manifest 1, payroll 4, phase2a 7, pickup 3, returnsRules 3, routes 8, routesMore 9, rules 11, salesReports 5, session 3, signup 4, stockCount 3). They use an in-memory stand-in for the database, so they prove the rules and the shape of each route, not the real Mongo queries.

| ID | What is new | Where |
| --- | --- | --- |
| CLO-06 | Barcode: set a barcode on a variant, labels as CSV (`GET /labels.csv`) and printable page (`GET /labels.html`), scan lookup (`GET /variants/by-barcode/:code`). Fabric by the metre: a variant with unit `metre` keeps stock in whole centimetres, bills take `metres` with up to 2 decimals, stock in/out through `/variants/:id/fabric-stock` | `src/barcode.js`, `routesPhase2.js`, `billGuard.js` |
| CLO-07 | Staff: shift, paid-leave balance (default 12 days a year, owner sets), commission rules (owner sets), payslip as JSON or printable page (`/staff/:id/shift`, `/leave`, `/payslip`) | `src/payrollRules.js` |
| CLO-08 | Sales by item, staff and hour (`/reports/sales-breakdown?by=`) and a Tally-style voucher CSV for the CA (`/export/tally.csv`, owner only, audited). It is a plain voucher list, not a Tally import file | `src/salesReports.js` |
| CLO-09 | Alteration pickup link: secret 48-character token, public page `/api/cloth-pickup/:token` shows only the item, status, ready date and balance (no phone), rate-limited, owner can rotate | `src/pickup.js`, `pickupRoutes.js` |
| CLO-10 | Data export (`/export/all.json`, owner only, audited, no passwords or secret links), delete on request = anonymise the customer, bills stay (`/customers/:id/delete`, must type DELETE), audit list (`/audit`) | `src/dataRights.js` |
| CLO-11 | Physical stock count (`/variants/:id/count`), difference recorded; owner can adjust the system stock to the count; mismatches show in `/reports/leaks` and `/reports/stock-mismatch` | `src/leaks.js` |
| CLO-12 | Returns and exchanges put the exact size and colour back in stock (`POST /returns`, reason needed, never more than sold, audited). Money, points and pay-later are reversed with the shared bill return (`/api/pos/bills/:id/return-lines`) | `src/returnsRules.js` |
| CLO-13 | Owner panel screens: sales by item, staff and hour, profit and loss, GST summary, expenses, things to check, audit trail, staff pay rules; barcode column on stock | `admin/manifest.json` |
| CLO-14 | `GET /api/internal/admin-summary` for Super Admin (counts only; key in `INTERNAL_API_KEY`; off without it). Cloth has no AI yet so AI counts are zero | `src/internalRoutes.js` |

### Dev A: what to run for this wave
1. `npm install && npm test` in `apps/cloth` (real Jest). Note any difference from the plain-node results above.
2. Fabric: make a variant, set unit to metre (only possible at zero stock), add 10.5 m (stock shows 1050 cm), bill 2.5 m: stock must drop by 250 cm and the bill line must show qty 2.5. Check that the shared bill route (`core-pos`) accepts a fractional quantity; the plain-node test only proves the guard.
3. Scan: `GET /api/cloth/variants/by-barcode/<code>` for a code in shop A must return 404 when called as shop B.
4. Pickup: make a link for a job, open it in a private window (no sign-in): item, status and balance only, no phone. Rotate: the old link must give "not valid". Try 40 quick opens: expect a 429.
5. Export and delete: as the owner, download `/export/all.json` (no password hashes inside). Delete a test customer: name becomes "Removed on request", phone gone, bills still listed. As the subadmin both must answer 403.
6. Count: count a variant 2 short, check it appears in `/reports/leaks`. As the subadmin, `adjust:true` must answer 403.
7. Returns: return 1 of 2 sold on a bill (stock +1); try returning 2 more (refused); do the money side with the shared return-lines.
8. Panel: open the owner panel as owner and as subadmin. Owner-only screens (profit and loss, GST, things to check, audit trail, staff pay rules) must not show for the subadmin. Stats screens use endpoints with a query string (`?by=item`): check the shared panel passes it through.
9. Race checks (need a real database): two people returning the same item at once must not put stock back twice (the route re-checks after writing and voids the extra move with a 409).

### Still open after wave A (nothing silently dropped)
- Customer import screen and loyalty screens: the routes exist in core-pos (`/api/pos/import/customers` with preview and commit, loyalty on bills), and the `ImportCsv` component exists in core-ui, but Cloth has no product client shell yet to host a custom screen. Same gap for every product.
- Cloth's own customer-facing pages beyond the pickup page (a shop page or QR for the catalogue), WhatsApp sending and the `cloth_*` templates (waiting on Meta), UPI payment link.
- Godown transfer, purchase-bill photo reading, shifts rota screen (shift data is stored; no calendar view), payslip PDF (printable page only).
- Staff discount and commission are by the name on the bill line; the bill screen must let the cashier pick the staff member per line.
- Barcode label output is text (a label printer or font draws the bars); no barcode image is generated.
- Branches, online ordering, accounting-software integrations, e-invoice (Phase 3 by rule).
- Plans, GST bands and HSN wording stay Assumptions pending the owner and the CA.

## Phase 3 close-out (CLO-13, CLIENT-04) — written, not yet tested by a person

Done in code (plain-node checks pass; nothing run against a real database, front-end not built in Vite):
- GST mode per shop (none, inclusive, exclusive). Default none, flagged for the CA. The bill screen starts from it and can still change it. Owner only.
- Loyalty points redeem on a bill (uses the shared bill route's `redeemPoints`; points shown after the customer phone lookup).
- Labels carry a real Code 128 barcode (pure JS SVG, no new dependency) plus the code as text. The table and check symbol were self-checked; **scan a printed label with a real scanner before relying on it**.
- Public catalogue page `/api/cloth-catalogue/:token`: only items the owner marks public and in stock, no stock counts, prices only if turned on, owner can turn off or renew the link, rate-limited, noindex.
- UPI payment link record (`/upi-links`): link built from the owner's UPI id; we cannot see the money, owner marks it paid.
- Godown transfer (`/godown`, `/godown/transfer`): stock moves between shop and a named godown, conditional updates, never below zero, recorded as a `transfer` stock move.
- Shifts calendar data (`/shifts/calendar?month=`) and the existing payslip print page.
- Item and variant CSV import with preview then confirm (`/items/import/preview`, `/confirm`); the server re-checks on confirm.
- Quoted line breaks in CSV cells: server reader (`csvParse.js`) and the customer import screen's chunking.
- New "Shop tools" tab (owner only): import, godown, catalogue, UPI link, shifts, GST.

Tests: `tests/rules3.test.js` (Code 128, CSV, import, transfer, calendar, catalogue, UPI) and `tests/phase3.test.js` (routes: owner-only, other-shop 404s, public token page).

Still open: purchase-bill photo reading (needs the small AI model decision), payslip as a real PDF (print page only), Tamil/Hindi strings for the new screens, GST rule (CA), real scanner test of Code 128, godown stock is not yet shown in the stock count or low-stock lists.
