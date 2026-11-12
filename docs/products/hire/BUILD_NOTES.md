# Hire: build notes against the all-in-one standard (12 Nov 2026)

Checked against `docs/PRODUCT_PRINCIPLES.md` section 7 and `SCOPE.md`. Written, not yet tested by a person. Hire is for recruitment agencies, so some areas (appointments, stock, staff discounts) do not apply; they are marked n/a, not dropped.

| # | Area | Status in Hire |
| --- | --- | --- |
| 1 | Accounts | PARTLY: placement fees with GST and due dates (`/fees`). Cash book, expenses, profit and loss, CA export: Phase 2 |
| 2 | Operations | WRITTEN: candidates, jobs, clients, pipeline stages, share page for clients, consent form, resume parsing |
| 3 | Staff | Phase 2: recruiter logins are admin and subadmin only; no attendance or payslip (use core payroll later) |
| 4 | Sales and revenue | PARTLY: fees raised and marked paid, weekly report. Revenue by client, recruiter and month: Phase 2 |
| 5 | Customers | WRITTEN: clients with fee terms and guarantee days. Client follow-up list: Phase 2 |
| 6 | Appointments or orders | n/a (interview scheduling is Phase 2) |
| 7 | Marketing | WRITTEN, suggest only: `GET /marketing-ideas`. Sending needs approved templates (lawyer first) |
| 8 | Prediction | Phase 2: time-to-fill and fee forecast, labelled as estimates |
| 9 | Alerts | PARTLY: stale jobs and consent expiry in the autopilot list. Fee overdue alert: Phase 2 |
| 10 | Control and safety | NEW 12 Nov: data export and delete on request, audit trail (below). Backups follow the database host |
| 11 | Growth later | Phase 2: multiple recruiters with roles, job-board sync |

## Added on 12 Nov (data rights and audit)
- `GET /api/hire/candidates/:id/export` (owner only): everything held about one person, plain fields, no ids or link hashes. Audited.
- `POST /api/hire/candidates/:id/anonymise` (owner only): wipes name, phone, email, location, title, company, skills and pay; blocks contact; keeps the placement and fee rows so money still adds up. Audited. Panel button "Remove personal details".
- `GET /api/hire/export` (owner only): the agency's own data, row caps of 5,000 per list (says which list was cut), no other agency's rows.
- `GET /api/hire/audit` (owner only) and panel screen "Audit trail": who did what to which record. Never the personal details themselves. Candidate delete and consent withdrawal are now audited too.
- Super Admin: Hire sends `businesses.active7d` (agencies with a sign-in in the last 7 days; ids counted, not sent).

## Phase 2 (nothing silently dropped)
Account-level delete request (agency closes account): needs an owner decision on the waiting period and lawyer wording. Export as a downloadable file from the panel (today API only). Cash book, expenses, P&L and CA CSV. Fee overdue alert. Time-to-fill and fee forecast. Recruiter roles beyond admin and subadmin, attendance and payslip. Client follow-up list. Interview scheduling. Tamil and Hindi UI.

## Open items for people
Lawyer: candidate notice, export and removal wording, retention period (M-15, LAW-1). Dev A: run the tests below on a real database.

## Dev A steps
1. `npm install` and `npm test` in `apps/hire`.
2. Sign up two test agencies. As owner of agency A, add a candidate, export them, anonymise them, then open Audit trail: three lines, no phone or email in them.
3. As a subadmin: export, anonymise, agency export and audit must each answer 403.
4. Agency A's export must contain nothing of agency B.
5. After anonymise, the candidate's fee and placement rows still show, the phone and email are gone, and a new candidate with the same phone can be added.

## Phase 2 close-out (13 Nov 2026, HIR-P2): written, not yet tested by a person
Plain-node checks pass (`apps/hire/tests/phase2.test.js`, 16 checks, plus all older Hire checks). Nothing run against a real database; the panel was not built in a browser.

| Area | What now exists |
| --- | --- |
| 1 Accounts | Owner-only: expenses (`/expenses`), profit and loss (`/accounts/pnl`, fee without GST counted when paid, GST collected on its own line), cash book (`/accounts/cashbook`), CA file (`/accounts/ca.csv`). Panel: "Money", "Expenses". We do not file GST |
| 3 Staff | Recruiter login (role `recruiter`): owner adds and switches off (`/team`). A recruiter works candidates, jobs, pipeline and interviews only; blocked from fees, accounts, exports, audit, team, settings, forecasts, reports, share links, and every delete (`rolesPolicy.js`, checked in tests). No attendance or payslip here: use core payroll later |
| 4 Revenue | Fees by month through the profit and loss range; per-recruiter revenue still not split |
| 6 Appointments | Interview scheduling: book from a submitted or interview-stage candidate (by name from the panel form, or by pipeline entry), no overlap for one candidate, list, done, cancel (`/interviews`) |
| 7 Marketing, messages | Suggest-only drafts: interview reminder to a candidate (`/interviews/:id/draft`), fee reminder to a client (`/fees/:id/draft`). Nothing is sent. No draft for a person who withdrew consent, was removed, is do-not-contact, or has no consent on record |
| 8 Prediction | Time to fill (needs 3 placements) and expected fees from open submissions, both labelled estimates. The stage chances (10 / 25 / 70 percent) are our starting guesses, not measured |
| 10 Control | Account-level close request (`/account/close-request`, audited, cancel any time before the date). Downloads from the panel: all data (JSON), fees, clients, jobs, expenses, candidates (CSV), each audited and safe against spreadsheet formulas |

Decisions the owner (and lawyer) still need to make: how many days the close request waits (30 is a draft default); what deletes the account after the wait (no job does this yet; the server owner runs it); whether a recruiter should see only their own candidates (today they see the agency's).
Still not built: a job runner that actually deletes closed accounts, per-recruiter revenue, interview booking screen with a calendar picker (the panel form takes a typed date and time), overdue-fee alert, job-board sync, Tamil and Hindi screens, sending any candidate message (stays off until the lawyer approves).
Dev A: `npm test` in `apps/hire`; sign up two agencies and repeat the owner-only and other-agency checks in `phase2.test.js` by hand through the panel.
