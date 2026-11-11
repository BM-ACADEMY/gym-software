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

## Phase 2 status (written, not yet tested by a human; plain-node and in-memory checks pass)
Done in code:
1. Staff: base salary, attendance, shifts, leave (request, decide), advances, payslip and month payslips (owner sees all; staff see own).
2. Customers: CSV import (preview, then commit with consent confirmed), loyalty points (earn on bill, redeem, reversed on void), packages and memberships with guarded session use.
3. Stock: products, purchases, counts (difference kept and alerted), per-service product use taken off at billing, restored on void, run-out estimate labelled "Estimate, not a promise" and "not enough data" when thin, low and negative stock alerts, retail product lines priced by the server.
4. Voids and refunds (reason required, owner only, guarded so two at once cannot refund more than paid), void and refund leak checks, income, GST and cash-expected follow refunds. Payment links: not built.
5. Accounts month view, staff-discount list, activity log, data export and delete on request (owner, typed DELETE).
6. Public booking page as plain HTML (escaped name, consent box, strict security headers) and owner booking link text for a QR code (`GET /settings/booking-qr`, needs `SALON_PUBLIC_URL`). No QR image is made.
7. Clinic: `doctor` role (masked phones, no money screens), body-area field on appointments, doctor-or-owner clinical notes behind `CLINIC_NOTES_ENABLED=true` (off by default, off until a lawyer reviews patient records), consent wording marked as draft.
8. Super Admin counts: `GET /api/internal/admin-summary` with `x-internal-key` (`INTERNAL_API_KEY`), counts only, schema 1.

Still not built: reminders and message sending (need approved WhatsApp templates), reschedule through the public link, payment links, print bill, plan self-checkout, Tamil/Hindi text (native review), date-range and file-download screens in the panel (CA CSV, customer export, CSV import and creating a refund stay API-only), QR image.

Dev A steps: run `tests/routes.db.test.js` and the new routes on a real database; try double-spend and double-refund and double package use at once; for any bill made before the `refunded` field existed, set `refunded: 0` (none expected before launch); check the panel screens on a phone; open the booking page on a phone with a real link; set `SALON_PUBLIC_URL`, `INTERNAL_API_KEY`; leave `CLINIC_NOTES_ENABLED` unset.

## Open owner decisions
Product name; price ladder (draft 149/299/499 is an Assumption, floor-price check SAL-P1 not done); CA wording for SAC and invoices; Meta templates; whether staff may give discounts (today staff can, with a reason, audited).
