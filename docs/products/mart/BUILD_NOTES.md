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


## Phase 2 wave A (12 Nov, night): written, not yet tested by a person
Done, with plain-node checks (`tests/phase2a`, `phase2b`, `privacy`, `upi`, `strings`, `internal`; route tests use an in-memory stand-in, not a database):
1. **Panel screens** (manifest, 22 items, each with `roles`): Close the day (`/day-closes`), Supplier bills (`/purchases`), Pay a supplier (`/supplier-payments`), GST summary (`/reports/gst-summary`, by rate, for the CA; we do not file GST), Festival dates (`/festivals`, owner types the dates, we never guess), Audit trail (`/audit`, owner only), UPI links, Staff, Attendance, Advances, Payslips, Team logins. Suppliers are picked by typing the name exactly as listed.
2. **Audit trail** (`MartAudit`): expense, udhaar payment, supplier payment, day close, settings, festival, privacy, team, staff, advance and UPI actions. Action name and a short reference only, no customer details. **Data export and delete on request** (owner only): one customer's data as JSON, anonymise a customer (name, phone, email removed; bills stay for the shop's accounts; a customer who still owes money needs a second confirm), whole-shop export, and a delete-the-shop *request* (typed words; a person at Afra handles it, nothing is deleted automatically).
3. **Roles and permissions** (`src/permissions.js`, server side): admin (owner), subadmin (manager), cashier, stockkeeper. A route nobody listed is owner only. Cashier: bill, udhaar, day close, read items, UPI links. Stock keeper: stock, items, supplier bills. Manager keeps the old sub-admin rights except team, payroll, privacy and audit. Applied to Mart routes and to the shared `/pos` routes. Owner adds logins through `POST /team` (API; see remaining). **Payroll** (`src/payroll.js`): staff with monthly salary, attendance (present, half, absent, paid and unpaid leave, weekly off), advances, draft payslip per month (unmarked days are not paid and make it a draft). We do not pay anyone.
4. **UPI payment links**: built from the owner's UPI id in settings; the customer pays in their own UPI app; the owner checks the UPI app or bank and marks the link paid. We cannot see or confirm the money. **GST summary** screen as above.
5. **Festival editor** and **remove the udhaar limit** (tick the box with the number empty) in the panel.
6. **Tamil and Hindi** names for every panel item in `admin/strings.json`, marked "needs native review (M-06)". The shared panel does not read this file yet.
7. **Internal summary** `GET /api/internal/admin-summary` (counts only, contract v1, same as Hire; off unless `INTERNAL_API_KEY` of 24+ characters is set).

Remaining (not silently dropped):
- Add-a-login screen (needs a password field type in `packages/core-ui`, outside Mart; today `POST /team` by API, or Dev A).
- Download button for the CA CSV (needs a link type in core-ui; the API `GET /reports/ca-export` works).
- Panel reading `admin/strings.json` (core-ui change) and Tamil/Hindi for messages and errors; native review M-06.
- Sales-list route for Super Admin (`admin-accounts`: owner contact, needs consent handling like Hire).
- (done in MRT-12 below) UPI QR image; change-password for team logins; yearly paid-leave allowance and shifts; payslip print page.
- Bill-photo AI, WhatsApp sending, offline billing, scale and printer: still planned.

Dev A: run `tests/routes.db.test.js` (two new phase 2 cases: cashier role and payroll/audit/privacy); set `INTERNAL_API_KEY` on a test server and call `/api/internal/admin-summary` with the `x-internal-key` header; sign in as a cashier and check the 403s; mark a payslip month fully and check the draft flag goes away.


## MRT-12 (13 Nov): written, not yet tested by a person
Plain-node tests pass here (`tests/qr.test.js`, `tests/mrt12.test.js`, in-memory stand-ins, not a database). Dev A or CI: run `tests/routes.db.test.js` and `mrt12.test.js` against a real Mongo; nothing below has been run in a browser.
1. **Change password.** Owner: `POST /team/password` {email, password} resets a manager, cashier or stock keeper login (not the owner's own); `GET /team/password` lists who changed which login and when (no passwords, no hashes). Everyone: `POST /my-password` {current, password}; wrong current password counts toward the same 5-tries / 15-minute lock as sign-in. New passwords are 10 to 100 characters (same as sign-up; adding a login via `POST /team` still accepts 8, an inconsistency to settle: proposed backlog row). A change sets `passwordChangedAt`; session cookies now carry `iat` and `sessionMiddleware` refuses a cookie made before the change, so old sign-ins end at once. A cookie issued before this release has no `iat`, so for a user who has changed a password it is refused (right); users who never changed it are unaffected. Panel: "Reset a team password" (owner) and "My password" (everyone).
2. **UPI QR image.** `GET /upi-links/:id/qr.svg` draws the shop's own stored link as a QR code (`src/qr.js`, pure JS, no new dependency; a copy is in `apps/wash/src/qr.js`, to move into `packages/core-ui` or `core-server` later). Byte mode, error correction M, versions 1 to 20. Checked here: 82 test codes (every version, both ECC levels L and M, at maximum length) all decoded by OpenCV's `QRCodeDetectorAruco`; the older `QRCodeDetector` failed 3 of them, and a second run showed the same codes decode with the Aruco detector, so the code is believed correct. **Not scanned by a real UPI app yet: Dev A or a staff phone must scan one and see the right payee and amount.** The panel list shows the picture address in a column; a proper "show QR" button needs a link action type in core-ui (proposed backlog row CORE-UI-02).
3. **Paid leave allowance.** Setting `paidLeaveAllowance` (0 to 60 days a year, empty = no limit, as before) in My settings. Paid-leave marks beyond the year's allowance are paid as unpaid leave and shown on the slip (`leaveOverAllowance`). `GET /leave-balance` shows used and left per person for the calendar year. The allowance resets on 1 January; no carry-over rule is built (assumption to confirm with the owner or a labour adviser; Tamil Nadu shop rules are not checked here).
4. **Shifts.** `GET/POST /shifts`, `DELETE /shifts/:id`. 24-hour HH:MM, same day, at most 16 hours, at most 4 per person per day, overlap refused, hours per person for the month. Managers may enter them, cashiers and stock keepers may not. A night shift across midnight is entered as two shifts (a limit, by design for now). Shifts are a plan: they do not change pay.
5. **Payslip print.** `GET /payslip/print?month=YYYY-MM` (all staff, one slip per page) or `&staffId=` (one). Owner only, HTML with every value escaped, no scripts, `Cache-Control: no-store`, a CSP of `default-src 'none'`. Panel: "Print all payslips" saves the page; open it and print from the browser. The per-person button needs a link action type in core-ui (CORE-UI-02).
6. **Offline billing: already in the shared billing screen.** `PosScreen` in core-ui keeps items on the device, queues bills when the network drops, retries with a `clientId` (core-pos returns the saved bill for a repeat, so no double bill), and moves refused bills to a "rejected" list. `public/sw.js` opens the app shell offline and never stores `/api`. Nothing new was needed in Mart; it still needs the human offline test (QA row): bill in aeroplane mode, reconnect, check one bill each.
7. **Bill-photo AI** stays planned (needs the AI cap, the model choice and an owner decision on the monthly allowance).

### Scale and printer notes (assumptions, no hardware tested)
- **Fact:** the billing screen already accepts decimal quantity (`allowDecimalQty`) and a barcode typed or pasted into the search box. A USB or Bluetooth barcode scanner that types like a keyboard therefore works with no code.
- **Assumption:** many Indian retail scales and label printers can send the weight as keyboard-style text or over USB serial. Keyboard-style needs no code; serial would need the browser's Web Serial, which works in desktop Chrome and Edge, and which we have not checked on Android. Decide after seeing the model the first pilot shop owns.
- **Receipt printer:** the bill page (`openBillPage`) prints through the browser, so any printer with an installed driver works, including 58 mm and 80 mm thermal ones; paper width and font size need a test print on the real printer. Printing straight to a Bluetooth ESC/POS printer from the page is not built.
- **Needed from a human:** one barcode scanner, one scale, one thermal printer, and a pilot shop to try them. Until then marketing must not say "connects to your scale or printer" (it is already in `MARKETING_CLAIMS.md` as not allowed).

### Proposed backlog rows (for the parent to add)
- MRT-13 Owner decision: one password length rule for every login (10), then raise `POST /team` to 10.
- MRT-14 Human test: scan a Mart UPI QR with a real UPI app; offline bill test; change-password and sign-out test.
- CORE-UI-02 Link and open action type in the panel (open a QR picture, a print page, a PDF in a new tab, with the signed-in cookie).
- CORE-QR-01 Move `qr.js` out of Mart and Wash into one shared package, with its test.

