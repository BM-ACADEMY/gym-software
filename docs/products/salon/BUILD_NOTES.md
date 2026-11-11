# Salon (Groom) build notes, 12 Nov 2026

Everything below is **written, not yet tested by a person**. Plain-node checks (51 in total) pass; database tests need Dev A.

## Where things are
`apps/salon`: `src/` (rules and routes), `admin/manifest.json` (owner panel), `server.js` (port 5007), `tests/`.
Run the plain checks: `node /path/to/ashim.js apps/salon/tests/<file>.test.js`. Database test for Dev A: `tests/routes.db.test.js` (steps in its first lines).

## Covered against PRODUCT_PRINCIPLES section 7 (the eleven areas)
| Area | Phase 1 in code | Notes |
| --- | --- | --- |
| 1 Accounts | cash book from bills, expenses by category, supplier dues (unpaid expenses), customer dues, day close (expected vs counted), P&L in plain words, GST summary by rate, CSV for the CA with formula-safe cells | No GST filing (Decision). SAC/HSN and invoice wording still need the CA (Tier 3) |
| 2 Operations | services, staff (unlimited), appointments with clash check and unique index, walk-in queue, roles `admin` and `staff` (staff see only their own visits and masked phones; money screens owner only) | |
| 3 Staff | commission rules (staff+service, staff, service, default) per bill line, commission report per date range | Attendance, shifts, leave, payslip: Phase 2 |
| 4 Sales | bills with server-side prices, GST or plain, split payments, change from cash, discount needs a reason, idempotent retry, sales report by day, staff, service, hour | Returns, payment links: Phase 2 |
| 5 Customers | phone-keyed, notes, birthday, anniversary, do-not-contact, consent record | Import from old register/sheet, loyalty points, packages: Phase 2 (core-pos has them, not wired) |
| 6 Booking | public link by secret token, consent tick, only offered slots, instant or approve mode, cancel with own phone, rate limit | Booking page screen (HTML) and QR image: Phase 2 (API only). Reminders need Meta templates |
| 7 Marketing | win-back and rebooking lists, 3 actions of the day, review-request ideas, festival ideas from the owner's own list | Suggest only. Ready-made messages and sending need approved templates: Phase 2 |
| 8 Prediction | next-month sales range, busy and slow days and hours, customers likely to lapse, cash needed for dues. All labelled estimates with reason and data used; "not enough data" under 3 months or 20 visits | Stock run-out: Phase 2 (no stock in Phase 1) |
| 9 Alerts | heavy discounts, cash differences at day close, drop in returning customers | Voids and stock mismatch: Phase 2 |
| 10 Control | owner daily summary, audit trail records (expense, day close, export, discount; no customer details), 3 plan-priced tiers with staff unlimited | Audit trail screen, data export/delete on request, backups: Phase 2 or ops |
| 11 Growth | not Phase 1 | |

## Phase 2 list (nothing dropped silently)
1. Staff attendance, shifts, leave, payslip (core payroll not wired).
2. Customer CSV import (core-pos `csvImport` exists), loyalty points, packages and memberships (physio "session 4 of 10").
3. Stock and product consumption per service, stock run-out estimate, stock-mismatch alert.
4. Returns and voids on bills, void leak check, payment links, advance for long services via UPI.
5. Reminders and message sending (24h and 2h before, review request, win-back text): needs approved WhatsApp templates `salon_*`, suggest-first.
6. Public booking page screen and QR image; reschedule through the public link.
7. Audit trail screen, export and delete on request (DPDP, lawyer review), print bill (core-pos `billHtml` exists, shop details not wired).
8. Clinic specifics: doctor-only clinical notes, body-area picker, Tamil/Hindi text (native review). Lawyer review of patient records before any real clinic.
9. Admin panel list screens that need date ranges (expenses, P&L, GST, export): routes exist, manifest screens for them not added yet.
10. Super Admin counts for this product; plan self-checkout (core-billing wired for status and read-only guard only).

## Open owner decisions
Product name; price ladder (draft 149/299/499 is an Assumption, floor-price check SAL-P1 not done); CA wording for SAC and invoices; Meta templates; whether staff may give discounts (today staff can, with a reason, audited).
