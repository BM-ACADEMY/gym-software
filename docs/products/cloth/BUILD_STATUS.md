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
1. **Bills do not yet reduce variant stock.** Core-pos bills use `PosItem`; Cloth stock is in `ClothVariant`. Until a bill line carries a variant id and the stock move is written, the owner records sales on the stock screen (`type: sale`). Cost of goods in profit and loss and slow-stock dates depend on this. First Phase 2 item, needed before invite-only start.
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
