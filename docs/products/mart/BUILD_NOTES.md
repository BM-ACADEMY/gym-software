# Mart build notes (12 Nov 2026): first slice

Status: **written, not yet tested by a person.** Plain-node checks pass for the rules (49); the route tests need a database (Dev A).

## Where things are
`apps/mart/src`: `reorder.js`, `shelf.js` (expiry, dead stock), `udhaar.js`, `leaks.js`, `summary.js` (daily summary, three actions), `accounts.js` (cash book, day close, expenses, supplier dues, profit and loss, CA file), `insights.js` (sales reports, estimates, marketing), `shape.js` (stored records to rule inputs), `models.js`, `routes.js`, `plans.js` (draft), session/signup/auth copied from Hire, `app.js`, `server.js` (port 5008), `admin/manifest.json`.
Billing, items, stock, returns, CSV import and loyalty are `packages/core-pos`, mounted at `/api/mart/pos`.

## Covered from PRODUCT_PRINCIPLES section 7 (11 areas)
1 Accounts: yes (cash book expected cash, day close, expenses by category, supplier dues and payments, customer dues, profit and loss in plain words, CA CSV; no GST filing). 2 Operations: stock, expiry, reorder, udhaar. 3 Staff: Phase 2 (core payroll not wired). 4 Sales: bills from core-pos, reports by day, hour, staff, item. 5 Customers: core-pos (phone key, loyalty, import) plus udhaar ledger. 6 Orders: not applicable in Phase 1 (WhatsApp ordering is Phase 2 in SCOPE). 7 Marketing: lapse list, festival ideas from owner-entered dates, review request list; suggest only. 8 Prediction: next-month range, busy and slow hours and days, run-out, lapse risk, cash needed, all labelled estimates with reasons. 9 Alerts: heavy discounts, returned bills by staff, stock mismatch, cash mismatch. 10 Control: daily summary; audit trail, export and delete: Phase 2.

## Phase 2 (not silently dropped)
Staff attendance, shifts, leave, payslip and commission wiring; staff roles beyond admin and sub-admin; audit trail screen; data export and delete on request; purchase bill by photo (AI, capped); offline billing human test; weighing scale; WhatsApp sending (needs approved `mart_*` templates and the autopilot runner); festival list editor in the panel (API exists, panel number-fields only); credit limit clear in panel; UPI payment links; GST summary screen (CSV is there); Tamil and Hindi text (English only now, native review needed); Super Admin internal summary route (like Hire `internalRoutes.js`); autopilot settings screen; landing page and claims file; QA workbook and Dev B attack list; opening-cash carry over uses the last saved close.

## Known limits
- Udhaar age comes from pay-later bills plus a balancing entry (opening balances, returns), so an old opening balance is aged from the customer's creation date.
- Day-close cash sales use bill payments minus change; a bill edited later is not reflected.
- Cost of goods uses the item's current cost price, not the price at purchase.
- Prices in `plans.js` are an Assumption; the free entry tier is not built.

## D-30 staff discounts (12 Nov): written, not yet tested
Rule in `src/discountPolicy.js` (copy of Salon's): `any` | `limit` (default, 10 percent) | `owner_only`; owner (`admin`) never limited, sub-admin counts as staff. `discountGuard` in `routes.js` runs before the core-pos bill route: prices the bill from the shop's own item prices, needs a reason (3+ characters), refuses over-limit staff with 403, and after the bill is saved writes `MartBillDiscount` (who, role, percent, amount, reason) plus an activity line. Rule is saved by `PUT /settings` `discountRule` (owner only, 403 for staff). Owner sees it in `GET /reports/leaks` (`staffDiscounts`, per day) and in `GET /summary` (`staffDiscounts`, shown as a table on Today).
Dev A: run the new D-30 test in `tests/routes.db.test.js`. Check that a discount typed as a per-line discount is also caught (guard prices lines the same way as the route). Known gap: core-pos bills do not store `discountBy`, so Mart keeps it in `MartBillDiscount`; if the guard's recording fails after the bill is saved, the bill stands and the failure is logged. The panel has no editor for the rule yet (API only): Phase 2.
