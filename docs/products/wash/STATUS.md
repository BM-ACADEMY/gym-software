# Wash: build status (12 Nov 2026)

Everything below is **written, not yet tested by a person**. My checks are plain-node (57 pass); nothing was run against a real database. Prices and caps are drafts (Assumption). Tags: Fact, Assumption, Decision.

## Where the code is
`apps/wash` (server on port 5011, `WASH_SESSION_SECRET` and `MONGODB_URI` in the server settings file only; without them every /api route answers 503). Admin screens come from `apps/wash/admin/manifest.json` (core-ui). Shared customers, GST bills, loyalty and CSV import come from `packages/core-pos`, mounted at `/api/pos`.

## All-in-one standard (PRODUCT_PRINCIPLES section 7) against what is written
| # | Area | Written now (Phase 1) | Phase 2 (not silently dropped) |
| --- | --- | --- | --- |
| 1 | Accounts | Cash book per day, day-end cash closing (counted vs expected, flag), expenses by category, supplier dues, profit and loss in plain words, CSV for the CA (formula-safe). No GST filing (Decision) | Customer dues on wash jobs (pay later; core-pos has the balance), Tally-style export, GST summary page, expense edit and delete with audit |
| 2 | Operations | Job board (waiting, washing, ready, delivered, cancelled), vehicle by plate, class pricing with add-ons, bay and queue timing rules, pickup-delay watch, roles admin and subadmin | Bay-timing screen, per-role views beyond admin/subadmin, before and after photos (needs the storage account, Tier 3) |
| 3 | Staff | Attendants, attendance (present, absent, leave) and month summary, incentive per delivered job | Shifts, leave balances, payslip through core payroll |
| 4 | Sales | Sales by day, class, attendant, hour; split payments on delivery; GST bill through core-pos | Returns on wash jobs, payment links, discount-with-reason on jobs, week and item reports |
| 5 | Customers | Vehicle record with owner name and phone, do-not-contact, usual wash gap; core-pos customers and loyalty | Import of the old register into Vehicles (core-pos CSV import exists for customers), birthdays, notes |
| 6 | Appointments or orders | Walk-in job board | Booking link and QR, reminders by WhatsApp (needs Meta templates), pickup and drop |
| 7 | Marketing | Review-request list, off-peak offer tied to the slowest hour, festival prompts from dates the owner saves. Suggest only, nothing is sent | Sending through approved `wash_*` templates (none approved), shareable page or QR |
| 8 | Prediction | Next-month sales range (needs 3 months), busy and slow hours (needs about 20 jobs), pass renewals (50 percent is a guess), lapse risk. Each is labelled "Estimate, not a promise" with its reason and data | Check every estimate against real pilot data; stock run-out and cash needed for dues once stock and dues exist |
| 9 | Alerts | Cash difference flag, unpaid delivered jobs, pickup delay, off-peak idle bays in the daily summary | Heavy-discount and void alerts (discounts not on jobs yet), sudden repeat-customer drop |
| 10 | Control and safety | Daily summary with three actions and reasons, tenant filter on every query, fail-closed start, read-only when the plan ends, plan caps on passes | Audit trail screen, data export and delete on request, offline mode, Super Admin product counts (`/api/internal`), PWA icons and service worker |
| 11 | Growth | None | Multi-bay scheduling UI, camera plate recognition, fleet accounts, online booking, e-invoice |

## Dev A: what to run and what to look for
1. `cd apps/wash && npm install && npm test`. Jest should run the 9 test files without errors. The tests use an in-memory stand-in for the database, so a green result does not prove the real queries work.
2. Start the server with a test MongoDB and the two settings. Sign up at `POST /api/wash/auth/signup` (header `x-requested-with: afra-wash`), then: set a price list, add an attendant, add a vehicle, create a job, move it to washing, ready, delivered with `payAllWith: cash`. Look for: the job leaves the board, `lastWash` on the vehicle changes, a second business cannot see any of it.
3. Sell a monthly pass, create a job for that plate, deliver it: the pass should lose one wash and only add-ons are charged.
4. Close the day with a wrong cash count: expect a difference and a flag. Close the same day again: expect a refusal.
5. Open `/api/wash/accounts/export.csv` and open the file in a spreadsheet: no cell should run as a formula.
6. Dev B: try every route with another business's job, pass, vehicle and attendant ids; all should answer "not found" or empty.

## Open decisions for the owner
- Are Rs 149 / 299 / 499 before or after 18 percent GST? (the code treats them as before)
- Floor-price table WSH-P1 including photo storage cost, and the cloud storage account for photos.
- CA wording on the SAC code and invoice text for car wash services.
- WhatsApp templates `wash_car_ready`, `wash_wash_due`, `wash_review_request` to submit to Meta (none submitted).
