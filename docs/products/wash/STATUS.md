# Wash: build status (12 Nov 2026)

Everything below is **written, not yet tested by a person**. My checks are plain-node (62 pass); nothing was run against a real database. Prices and caps are drafts (Assumption). Tags: Fact, Assumption, Decision.

## Where the code is
`apps/wash` (server on port 5011, `WASH_SESSION_SECRET` and `MONGODB_URI` in the server settings file only; without them every /api route answers 503). Admin screens come from `apps/wash/admin/manifest.json` (core-ui). Shared customers, GST bills, loyalty and CSV import come from `packages/core-pos`, mounted at `/api/pos`.

## All-in-one standard (PRODUCT_PRINCIPLES section 7) against what is written
| # | Area | Written now (Phase 1) | Phase 2 (not silently dropped) |
| --- | --- | --- | --- |
| 1 | Accounts | Cash book per day, day-end cash closing (counted vs expected, flag), expenses by category, supplier dues, profit and loss in plain words, CSV for the CA (formula-safe). No GST filing (Decision) | Customer dues on wash jobs (pay later; core-pos has the balance), Tally-style export, GST summary page, expense edit and delete with audit |
| 2 | Operations | Job board (waiting, washing, ready, delivered, cancelled), vehicle by plate, class pricing with add-ons, bay and queue timing rules, pickup-delay watch, roles admin and subadmin | Bay-timing screen, per-role views beyond admin/subadmin, before and after photos (needs the storage account, Tier 3) |
| 3 | Staff | Attendants, attendance (present, absent, leave) and month summary, incentive per delivered job | Shifts, leave balances, payslip through core payroll |
| 4 | Sales | Sales by day, class, attendant, hour; split payments on delivery; GST bill through core-pos | Returns on wash jobs, payment links, week and item reports |
| 5 | Customers | Vehicle record with owner name and phone, do-not-contact, usual wash gap; core-pos customers and loyalty | Import of the old register into Vehicles (core-pos CSV import exists for customers), birthdays, notes |
| 6 | Appointments or orders | Walk-in job board | Booking link and QR, reminders by WhatsApp (needs Meta templates), pickup and drop |
| 7 | Marketing | Review-request list, off-peak offer tied to the slowest hour, festival prompts from dates the owner saves. Suggest only, nothing is sent | Sending through approved `wash_*` templates (none approved), shareable page or QR |
| 8 | Prediction | Next-month sales range (needs 3 months), busy and slow hours (needs about 20 jobs), pass renewals (50 percent is a guess), lapse risk. Each is labelled "Estimate, not a promise" with its reason and data | Check every estimate against real pilot data; stock run-out and cash needed for dues once stock and dues exist |
| 9 | Alerts | Cash difference flag, unpaid delivered jobs, pickup delay, off-peak idle bays in the daily summary | Sudden repeat-customer drop; a required reason when a started job is cancelled (today only the owner alert exists) |
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

## D-30 staff discounts (13 Nov): written, not yet tested
Staff (role subadmin) may give a discount on a job inside the rule the owner sets in `PUT /api/wash/settings` (default: staff up to 10 percent; `any`, `limit`, `owner_only`). A reason of at least 3 letters is always required (400 without it). Over the limit gives 403 with a plain message. The job stores subtotal, discount, discountPercent, discountBy (owner or staff) and discountReason; the discount cannot cut into what a monthly pass already covers. Each discount writes an audit line (`GET /api/wash/audit`, owner only). The owner sees `GET /api/wash/leaks` (staff discounts and started-then-cancelled jobs per day) and both appear in the daily summary actions. Settings, leaks and audit answer 403 to staff.
Not done: the admin manifest has no discount fields on the job form (the nested discount body needs a core-ui field type or a custom screen), and no settings screen yet; use the API until then.

## Phase 2 wave A (13 Nov): written, not yet tested by a person
100 plain-node checks pass across 18 test files (against an in-memory stand-in for the database, not a real one). New code is in `apps/wash/src/routesMore.js` plus small pure files. Every new route has a test and each test also checks that another business sees nothing.

| Item | What was written | Where |
| --- | --- | --- |
| Panel screens | Job board with three reasoned cancel buttons for started jobs (owner is told), Accounts (P&L, customers who owe, supplier dues), Discounts and voids list, Audit trail, Payslips, Shifts list, Booking requests (accept or decline), Booking link, attendant salary fields | `admin/manifest.json` (validates with core-ui) |
| Photos | Before and after photo records: a storage reference only, 300 KB hard limit, JPEG/WebP/PNG, up to 6 per kind per job, no raw image in the database. Counts as a photo use for the plan | `photos.js`, `POST/GET /jobs/:id/photos` |
| Customer dues | Deliver with "pay later" (needs the owner's phone on the vehicle and `payLater: true`), list of who owes, collect later (cash book and day closing include it) | `money.js`, `POST /jobs/:id/collect`, `GET /dues/customers` |
| Refunds | Owner only, reason required, never more than was paid; counted in cash book, day closing, P&L and the CA file (as a negative line) | `POST /jobs/:id/refund`, `GET /refunds` |
| Shifts, leave, payslip | Shifts per attendant per day; paid-leave allowance; payslip in plain words (absent and extra leave unpaid, unmarked days count as worked, incentive added). Salary can be set only by the owner | `payroll.js`, `/shifts`, `/payslips`, `PUT /attendants/:id/pay` |
| Booking link | Secret-token public page (plain HTML, nonce-based security header, no third-party scripts), consent tick, request only (nothing is confirmed until the owner calls), rate limited, 200-waiting cap, link switched off when the plan ends or the account is deleted | `booking.js`, `publicBooking.js` at `/api/wash-book/:token`, owner routes `/booking-link`, `/bookings` |
| Register import | CSV with preview, owner confirms, skip-bad-rows confirmation, upsert by plate, formula characters stripped, up to 2,000 rows | `vehiclesImport.js`, `POST /vehicles/import/preview` and `/commit` |
| Data rights | Full JSON export (owner), anonymise one customer (name and phone removed, money stays), delete request (exact words, recorded, link switched off, 30-day wait is an Assumption for the lawyer) | `dataRights.js`, `GET /export`, `/vehicles/:plate/anonymise`, `/account/delete-request` |
| Super Admin counts | `GET /api/internal/wash/admin-summary`, counts only, key in header | `internalRoutes.js` |
| App install files | Manifest, service worker (never caches the API) and three icons | `pwa/` (see its README) |

### Still not done in Wash (nothing dropped silently)
- (done in WSH-10 below) **QR image**.
- (mostly done in WSH-10 below; see its own not-done list) **Panel buttons for:** register import, data export download, anonymise, delete request, refunds, collecting a due, photos, shifts entry and pay settings after creation. The routes exist; the shared panel can only list, add simple records and press fixed buttons. These need a small custom screen in core-ui.
- (mostly done in WSH-10 below; see its own not-done list) **Photo upload itself:** needs the cloud storage account (owner decision, WSH-P1). Until then the app can only store references.
- (mostly done in WSH-10 below; see its own not-done list) **Pay advances and deductions** on payslips; GST on refunds (CA question).
- **WhatsApp sending** (templates `wash_*` not approved), customer reminders.
- (mostly done in WSH-10 below; see its own not-done list) Sales reports do not subtract refunds (the P&L and cash book do).
- **Panel offers Cancel for started jobs only with fixed reasons**; a free-text reason is API-only.

### Dev A: what to run for Phase 2
1. `cd apps/wash && npm install && npm test` (18 files).
2. Start the app with a real database and `INTERNAL_API_KEY` set. Pay-later: deliver a job with `payLater: true` and `payments: [{ "method": "cash", "amount": 100 }]` for a vehicle that has a phone; `GET /dues/customers` shows the rest; `POST /jobs/:id/collect`; the cash book for that day shows it; close the day and the expected cash includes it.
3. Refund the same job with a reason: P&L and the cash book go down; a second refund over the paid amount is refused.
4. Open `/api/wash-book/<token from GET /booking-link>` in a phone browser: the form loads with no console errors; send a request; it appears under Booking requests. Send 6 quickly: the 6th is refused. Rotate the link: the old one gives "not valid".
5. Import a small CSV of vehicles (preview, then commit); export the data and check no passwords and no other business appear; anonymise one vehicle; ask for deletion with the exact words and cancel it.
6. `GET /api/internal/wash/admin-summary` without the key gives 401, with it gives counts.
7. Dev B: another business's job, booking, photo and refund ids on every new route; the booking page with a script in the business name or note; CSV with formulas.

## WSH-10 (13 Nov): written, not yet tested by a person
Plain-node tests pass here (`tests/wsh10.test.js` plus the older files; in-memory stand-in for the database; the photo folder test uses a real temporary folder). Every new route has a test and each checks that another business sees or changes nothing. Nothing has been run in a browser or with a real database.

| Item | What was written | Where |
| --- | --- | --- |
| QR for the booking link | `GET /booking-link/qr.svg` (owner). Address = `WASH_PUBLIC_URL` (https only) if set, else the address the owner is using now. Panel: "Download the QR picture" on the Booking link screen. Pure-JS encoder, no new dependency; same code and checks as Mart (82 codes decoded by OpenCV) | `qr.js`, `routesWave3.js` |
| Booking request to job | `POST /bookings/:id/convert` (owner). Claims the request first (two taps make one job), price from the price list, uses a monthly pass if one is active, job is dated today. The customer's phone and name are NOT copied to the vehicle (they agreed to be answered, not marketed to). Panel button "Make a job" | `routesWave3.js` |
| Advances and deductions | `POST/GET /pay-adjustments` (owner). A deduction needs a reason. Payslip now shows `advances`, `deductions`, `net`, and `carryForward` when they are more than the pay (pay never goes below 0). Panel screen "Advances and deductions" | `payroll.js`, `routesMore.js` |
| Sales report minus refunds | `GET /reports/sales` rows now have `revenue`, `refunded`, `net`; totals `total`, `refundedTotal`, `netTotal`. By day a refund counts on the refund day (same as cash book and P&L); by class, attendant or hour it counts against the original job. A refund whose job is missing is shown as `unplacedRefunds`, not hidden | `reports.js`, `routes.js` |
| Photo upload | `POST /jobs/:id/photos/upload?kind=before|after`, body = the JPEG, WebP or PNG. 300 KB limit, the file's first bytes must match its type, six per kind per job, stored in the folder `WASH_PHOTO_DIR` (absolute path) as `<business>/<job>/<random>.jpg`. 503 "not set up" if the folder is not set. `GET /photos/:id/file` is signed-in and own business only, and only for files this feature stored (a reference typed into the older route can never read a file). `POST /photos/:id/remove` (owner) deletes the file and record. The app shrinks the photo on the phone first (`client/src/photoFit.js`). Storage is behind a small interface (`storage.js`: put, get, remove); a cloud adapter is a second file | `storage.js`, `routesWave3.js`, `client/src/Board.jsx` |
| Job card | `GET /jobs/:id/card`: one-page HTML, every value escaped, no scripts, no-store. App button "Print job card" opens it | `jobCard.js` |
| Bay | `bay` on a job (1 to 12 letters, digits, spaces, dashes). Set when creating a job or later with `POST /jobs/:id/bay` until the job is finished. Shown on the board, the card and the job form | `bays.js` |
| Panel buttons | Refunds (by number plate), Customers who owe you (paid in full: cash, UPI or card), Job photos (list and remove), Bring in your old register (check first, then save), Shifts (typed name), Advances and deductions, Make a job on bookings. `GET /shifts` now returns a plain list: before, the Shifts screen would have shown nothing | `admin/manifest.json` |

### Owner decisions and settings this needs
- **WSH-P1 (owner):** where photos should live long term. Today: a folder on the server (`WASH_PHOTO_DIR`, must be on a disk that is backed up; Hostinger VPS disk assumed, not checked). A cloud account would cost money and is not set up. A 300 KB photo x 12 per job x 40 jobs a day is about 144 MB a day for a busy shop (arithmetic from the limits, an estimate): decide how long photos are kept before this fills a small disk. Nothing deletes old photos yet.
- **Server settings to add to `deploy/env/wash.env.example`** (outside this fork's folders, parent to do): `WASH_PHOTO_DIR` (absolute path, owned by the app user, mode 700) and `WASH_PUBLIC_URL` (https address of the Wash site, no trailing slash).
- Pay advances: nothing is filed or paid by the software; the owner pays. Whether an advance must be recovered within one month is the owner's rule; the carry-forward shows the rest.

### Still not done in Wash (nothing dropped silently)
- Panel buttons for data export beyond the existing "Download all my business data" on the Audit screen, anonymise and delete request (routes exist, use the API or Dev A).
- Part-payment of a due from the panel (the app has it; the panel does "paid in full" only).
- Photo cleanup by age, thumbnails on the server, a cloud adapter.
- Per-job "Print card" and photo capture are in the app only (the panel cannot open a page or pick a file; proposed core-ui link and file field types).
- GST on refunds (CA question), WhatsApp sending (templates `wash_*` not approved).
- Bookings: a request with no number plate cannot be turned into a job from the panel (add the job from the job board).

### Dev A: what to run for WSH-10
1. `cd apps/wash && npm test` (20 files). Set `WASH_PHOTO_DIR=/some/absolute/folder` and `WASH_PUBLIC_URL=https://...` and restart.
2. Booking link screen: download the QR picture and scan it with a phone camera: it must open the booking page. Then send a request from that page; on the Booking requests screen tap Make a job (needs a plate and a class on the request, or a known vehicle): the job appears on the board; tap again: refused.
3. In the app: open a job, Photos, take a photo: it appears as a thumbnail; try a file over 300 KB that cannot be shrunk and a text file renamed .jpg (refused); sign in as another business and open `/api/wash/photos/<id>/file`: 404. Without `WASH_PHOTO_DIR`: "not set up".
4. Advances: add an advance and a deduction (without a reason: refused); Payslips shows the net. Refunds by plate: refund more than paid (refused); Sales report by day shows the refund taken off.
5. Print job card: opens a page with the plate, bay and total; print preview fits one page.
6. Dev B: other business's job, booking, photo ids on every new route; a plate or business name with script tags on the card page; a photo whose first bytes are PHP or HTML.

### Proposed backlog rows (for the parent to add)
- WSH-11 Owner decision WSH-P1: photo storage place and how long photos are kept; then a clean-up job and (if cloud) an adapter.
- WSH-12 Human test of WSH-10 (list above) including the QR scan and the photo upload on a real phone.
- CORE-UI-02 Link action type and a file-pick field type in the panel (print pages, QR pictures, photo upload).
- CORE-QR-01 One shared QR package for Mart and Wash with its test.

