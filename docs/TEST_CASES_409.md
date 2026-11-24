# GymDesk: the 409 automated tests

Nov 24, 2026 · @Afra Ventures

## Summary

All 409 automated server tests of the gym software pass (67 test files), run by Claude on 24 Nov 2026. The 17 client (screen) tests also pass, and the client builds.

- **What they are:** small programs that call the gym server the way the app does and check the answer. About half use a database; the rest check pure rules (prices, GST, dates) with no database.
- **How they were run:** on Claude's local copy of branch `razorpay-live-24-nov`, with a throwaway in-memory database, not the team's test database. Aakash still runs them on the team test database for RM-01; that run is the official one.
- **One fix was needed:** the enquiry-form test never switched rate limiting on, so it failed. The app was right; the test was fixed.
- **What a pass does not prove:** that a person can use the screens, that Razorpay live works, or that WhatsApp and SMS send. Those need people (last section).

## Tests by area

| Area | Test files | Tests |
| --- | --- | --- |
| Payments, plans and billing | 10 | 76 |
| Members, staff and daily work | 15 | 75 |
| AI features and support | 11 | 62 |
| Owner reports, coach and briefs | 9 | 59 |
| Security and gym data kept apart | 7 | 51 |
| Leads, marketing and messages | 7 | 46 |
| Sign-up, settings and site content | 7 | 28 |
| Hire app routes | 1 | 12 |
| **Total** | **67** | **409** |

Source: Jest results from server/tests, run 24 Nov 2026. Online copy with the chart: https://claude.ai/artifact/HAmSu5tj5zgeGr1Padt4hN

Payments and member work together hold 151 of the 409 tests. Hire has the fewest because only its routes are tested from the gym server.

## Full list

Every test below passed on 24 Nov 2026. Each name is the test's own wording in the code: the group name, then what it checks. "File" is the test file in `server/tests/`; "unit" files check rules with no database.

### Payments, plans and billing (76 tests)

| File | Test |
| --- | --- |
| billingFlow.test | subscription billing flow trial gym pays for Growth monthly: invoice, paid-until and plan are set |
| billingFlow.test | subscription billing flow paying the same order twice does not extend twice or burn a second invoice number |
| billingFlow.test | subscription billing flow renewing early extends from the old end date |
| billingFlow.test | subscription billing flow downgrade while paid is refused; upgrade gets credit |
| billingFlow.test | subscription billing flow webhook: bad signature is rejected, good one activates once, wrong amount fails the order |
| billingFlow.test | subscription billing flow invoice PDF downloads for the owner only |
| billingFlow.test | subscription billing flow GST: Puducherry gym gets CGST+SGST, other states get IGST, missing state is refused |
| billingFlow.test | subscription billing flow a gym over the plan member limit cannot buy the smaller plan |
| billingFlow.test | subscription billing flow a failed attempt does not kill the order: a retry on the same order still activates |
| billingFlow.test | subscription billing flow upgrade that ends before the old paid-until still switches the plan |
| billingFlow.test | subscription billing flow refund webhook (PAY-2): a full refund marks the payment refunded once; a partial one keeps it paid; unknown or unsigned is ignored |
| billingMath.unit.test | quote and GST growth monthly: 999 + 18% = 1179, split 90/90 |
| billingMath.unit.test | quote and GST igst puts all GST on one line, same total |
| billingMath.unit.test | quote and GST odd GST splits without losing a rupee |
| billingMath.unit.test | quote and GST credit is capped at 90% of the price |
| billingMath.unit.test | quote and GST unknown plan throws |
| billingMath.unit.test | periods and invoice numbers 31 Jan + 1 month clamps to 28 Feb |
| billingMath.unit.test | periods and invoice numbers yearly adds a calendar year |
| billingMath.unit.test | periods and invoice numbers financial year switches on 1 April IST |
| billingMath.unit.test | periods and invoice numbers invoice number format |
| billingMath.unit.test | purchase rules trial gym starts now with no credit |
| billingMath.unit.test | purchase rules renewing the same plan extends from the end date |
| billingMath.unit.test | purchase rules upgrade starts now with credit for unused days |
| billingMath.unit.test | purchase rules downgrade while paid is blocked until the period ends |
| billingMath.unit.test | purchase rules suspended gym cannot buy |
| billingMath.unit.test | purchase rules expired gym can buy any plan, starting now |
| billingMath.unit.test | GST place of supply same state is CGST+SGST, other state is IGST, unknown is IGST |
| billingMath.unit.test | Solo ranks below Starter Solo to Starter is an upgrade, Starter to Solo waits for period end |
| gatewayKeys.unit.test | payment gateway keys (RM-11) mode comes from the key id prefix |
| gatewayKeys.unit.test | payment gateway keys (RM-11) a new live key id with a blank secret is refused (would pair it with the old test secret) |
| gatewayKeys.unit.test | payment gateway keys (RM-11) a new live key id with its secret is saved and reported as a mode change |
| gatewayKeys.unit.test | payment gateway keys (RM-11) same key id with a blank secret keeps the saved secret |
| gatewayKeys.unit.test | payment gateway keys (RM-11) a key id that is not a Razorpay one is refused |
| gatewayKeys.unit.test | payment gateway keys (RM-11) secret pasted into both boxes is refused |
| gatewayKeys.unit.test | payment gateway keys (RM-11) first save on an empty setting is not a mode change |
| gatewayKeys.unit.test | payment gateway keys (RM-11) unknown provider is refused |
| planOverrides.unit.test | plan overrides (SET-01) validation: whole rupees, limits, features, unknown fields |
| planOverrides.unit.test | plan overrides (SET-01) below the floor is a warning that needs a confirm; solo is exempt |
| planOverrides.unit.test | plan overrides (SET-01) applyOverrides changes the live object in place and a reset restores the code default |
| planOverrides.unit.test | plan overrides (SET-01) public plans carry no floors, history or costs |
| planOverrides.unit.test | plan overrides (SET-01) store: reason needed, below-floor needs confirm, change is saved, logged and reloads; reset goes back |
| planOverrides.unit.test | plan overrides (SET-01) a failing database read keeps the code defaults |
| planOverrides.unit.test | trial length (SET-01) live value follows the saved setting; bad values fall back to the default |
| planSettings.test | plan settings (Root Admin) gym owners and signed-out visitors cannot read or change plans |
| planSettings.test | plan settings (Root Admin) change needs a reason; below the floor needs a confirm; the public price page and checkout price follow |
| planSettings.test | plan settings (Root Admin) unknown plan and unknown fields are refused |
| promoCodes.test | billingMath discount percent comes off before GST |
| promoCodes.test | billingMath discount no discount keeps old numbers |
| promoCodes.test | promo codes at checkout root admin creates a code; gym owners cannot |
| promoCodes.test | promo codes at checkout code lowers the invoice, is counted once, and cannot be reused after a first payment |
| promoCodes.test | promo codes at checkout unknown, expired, inactive and exhausted codes are refused |
| promoCodes.test | promo codes at checkout a code limited to other plans is refused |
| refundRecord.unit.test | refund recording (PAY-2) partial refund keeps the payment paid and flags it for review |
| refundRecord.unit.test | refund recording (PAY-2) the same refund twice is counted once; the rest makes it refunded |
| refundRecord.unit.test | refund recording (PAY-2) refund above the total is capped; unknown payment or broken data is ignored |
| subscription.unit.test | subscription status from dates suspended wins over everything |
| subscription.unit.test | subscription status from dates inside trial is trial with Growth plan |
| subscription.unit.test | subscription status from dates trial over without payment is expired and read-only |
| subscription.unit.test | subscription status from dates paid in the future is active on the paid plan |
| subscription.unit.test | subscription status from dates paid period ended within 3 days is grace with full access |
| subscription.unit.test | subscription status from dates paid period ended more than 3 days ago is expired |
| subscription.unit.test | subscription status from dates legacy pilot gym with no dates is never locked |
| subscription.unit.test | subscription status from dates trialDates gives a 14 day trial |
| subscription.unit.test | plan prices GST is 18% and rounded to whole rupees |
| subscription.unit.test | plan prices unknown plan or cycle returns null |
| subscription.unit.test | plan prices yearly is cheaper than 12 months for every plan |
| subscription.unit.test | Solo plan priced at 249 / 2490 ex GST with no WhatsApp allowance |
| subscription.unit.test | Solo plan Solo has no paid features |
| superAdminBilling.test | super admin subscription overview, extend and reminders overview counts statuses and computes MRR from plans |
| superAdminBilling.test | super admin subscription overview, extend and reminders gym owners cannot see the overview |
| superAdminBilling.test | super admin subscription overview, extend and reminders extend needs a reason, adds days and writes an audit entry |
| superAdminBilling.test | super admin subscription overview, extend and reminders billing reminders need the internal key and list the right gyms |
| webhookIdempotency.test | Payment gateway webhook idempotency a validly-signed webhook marks the invoice paid |
| webhookIdempotency.test | Payment gateway webhook idempotency replaying the exact same webhook event is a harmless no-op, not a double-credit |
| webhookIdempotency.test | Payment gateway webhook idempotency a tampered signature is rejected with 401 and never touches the record |
| webhookIdempotency.test | Payment gateway webhook idempotency a webhook for an order with no matching payment record returns 404 |

### Security and gym data kept apart (51 tests)

| File | Test |
| --- | --- |
| crossRoleWalkthrough.test | Cross-role QA walkthrough Root Admin sees the new gym in the subscriber list |
| crossRoleWalkthrough.test | Cross-role QA walkthrough Gym Owner onboards a member |
| crossRoleWalkthrough.test | Cross-role QA walkthrough Gym Owner hires a trainer (sub-admin) with pt-sessions permission |
| crossRoleWalkthrough.test | Cross-role QA walkthrough Trainer (sub-admin) books a PT session for the member |
| crossRoleWalkthrough.test | Cross-role QA walkthrough Member checks in for the day |
| crossRoleWalkthrough.test | Cross-role QA walkthrough Gym Owner records a payment for the member |
| crossRoleWalkthrough.test | Cross-role QA walkthrough Trainer completes the PT session |
| crossRoleWalkthrough.test | Cross-role QA walkthrough Root Admin drills into the gym and sees the real member/revenue numbers |
| crossRoleWalkthrough.test | Cross-role QA walkthrough Root Admin can impersonate the Gym Owner and act as them (audited) |
| health.test | health check returns 200 while the database is connected |
| multiTenantIsolation.test | Multi-tenant data isolation Gym B cannot read Gym A's member by ID |
| multiTenantIsolation.test | Multi-tenant data isolation Gym A's member list never includes Gym B's members |
| multiTenantIsolation.test | Multi-tenant data isolation Gym B cannot record a payment against Gym A's member |
| multiTenantIsolation.test | Multi-tenant data isolation Gym B cannot view a payment that belongs to Gym A |
| multiTenantIsolation.test | Multi-tenant data isolation Gym B cannot book/see a PT session against Gym A's member |
| multiTenantIsolation.test | Multi-tenant data isolation Root Admin subscriber list contains both gyms, but a Gym Owner token is rejected on that route |
| permissionMatrix.test | Sub-admin permission matrix sub-admin with no "members" permission entry at all is rejected (403) |
| permissionMatrix.test | Sub-admin permission matrix sub-admin with view:false on "members" is rejected even if edit:true |
| permissionMatrix.test | Sub-admin permission matrix sub-admin with view:true, edit:false on "members" can read but cannot create |
| permissionMatrix.test | Sub-admin permission matrix a deactivated (isActive:false) sub-admin is rejected regardless of permissions |
| permissionMatrix.test | Sub-admin permission matrix viewAll:false scopes a sub-admin to only their own assigned members |
| permissionMatrix.test | Sub-admin permission matrix viewAll:true lets a sub-admin see members not assigned to them |
| permissionMatrix.test | Sub-admin permission matrix a permission granted on one module does not leak into another (attendance permission does not unlock members) |
| permissionMatrix.test | Sub-admin permission matrix the Gym Owner (admin role) always has full access regardless of any permissions map |
| pilotSecurity.test | Pilot launch security fixes input validation login with a NoSQL operator object is rejected (login-phone) |
| pilotSecurity.test | Pilot launch security fixes input validation login with a NoSQL operator object is rejected (root admin) |
| pilotSecurity.test | Pilot launch security fixes input validation non-string password is rejected |
| pilotSecurity.test | Pilot launch security fixes input validation member search treats regex characters literally |
| pilotSecurity.test | Pilot launch security fixes input validation escapeRegex escapes special characters |
| pilotSecurity.test | Pilot launch security fixes rate limiting 9th wrong login for the same phone is blocked with 429 |
| pilotSecurity.test | Pilot launch security fixes OTP OTPs are 6 digits |
| pilotSecurity.test | Pilot launch security fixes OTP in production an OTP request never returns demoOtp and fails when SMS is not configured |
| pilotSecurity.test | Pilot launch security fixes OTP public sign-up is closed in production unless PUBLIC\_SIGNUP=true |
| pilotSecurity.test | Pilot launch security fixes payments the member self-pay route no longer exists |
| pilotSecurity.test | Pilot launch security fixes payments simulate-payment is not available in production (member) |
| pilotSecurity.test | Pilot launch security fixes payments simulate-payment is not available in production (gym owner) |
| pilotSecurity.test | Pilot launch security fixes payments a webhook is rejected in production when no gateway secret is configured |
| pilotSecurity.test | Pilot launch security fixes plan limits and trial lock member creation is blocked at the plan member limit |
| pilotSecurity.test | Pilot launch security fixes plan limits and trial lock a gym with no plan limit can still add members |
| pilotSecurity.test | Pilot launch security fixes plan limits and trial lock an expired trial makes the gym read-only |
| qrSigning.test | signed member QR a genuine payload verifies |
| qrSigning.test | signed member QR a made-up or edited payload is refused |
| suspendedGym.test | Suspended gym, read-only lockdown: GET requests still work for a suspended gym (owner) |
| suspendedGym.test | Suspended gym, read-only lockdown: a write request from the Gym Owner is blocked with 403 |
| suspendedGym.test | Suspended gym, read-only lockdown: a write request from a Sub-Admin (trainer) is blocked with 403 |
| suspendedGym.test | Suspended gym, read-only lockdown: a write request from a Member (self check-in) is blocked with 403 |
| suspendedGym.test | Suspended gym, read-only lockdown: a Sub-Admin can still GET (read-only access preserved) |
| suspendedGym.test | Suspended gym, read-only lockdown: Root Admin's own routes are never blocked by a gym's suspension |
| suspendedGym.test | Suspended gym, read-only lockdown: an impersonation session is exempt and can still write on the suspended gym's behalf |
| suspendedGym.test | Suspended gym, read-only lockdown: the Gym Owner can still submit a support ticket while suspended |
| suspendedGym.test | Suspended gym, read-only lockdown: reactivating the gym immediately lifts the write block |

### Members, staff and daily work (75 tests)

Includes the 12 tests of the shared shop billing core (`posCore`), which the other products use.

| File | Test |
| --- | --- |
| adminAccounts.unit.test | gym account facts shape: owner contact, status, no money or members |
| adminAccounts.unit.test | gym account facts consent is false unless explicitly true; missing owner is safe |
| adminSummary.test | GET /api/internal/admin-summary refused without the key or with a wrong key |
| adminSummary.test | GET /api/internal/admin-summary returns the shared shape with the right key |
| adminSummary.unit.test | admin summary shape has the agreed fields |
| adminSummary.unit.test | admin summary shape carries no personal data |
| churnRisk.test | churn risk and win-back (AI-04) needs a login |
| churnRisk.test | churn risk and win-back (AI-04) lists a member who stopped coming, and the next win-back step; marking it done moves to no repeat |
| churnRisk.test | churn risk and win-back (AI-04) another gym never sees these members |
| churnRules.unit.test | churn risk lapsed or unknown expiry members are not scored here |
| churnRules.unit.test | churn risk a regular who stopped coming is high risk with reasons |
| churnRules.unit.test | churn risk one weak signal alone is not enough; a healthy member gives null |
| churnRules.unit.test | churn risk new member with no routine and dues is flagged medium or high |
| churnRules.unit.test | churn risk reasons carry no names or phones |
| churnRules.unit.test | win-back sequence steps come due on days 1, 5 and 14 and stop after 30 |
| churnRules.unit.test | win-back sequence a step already done is not shown again, and a missed older step is skipped not stacked |
| churnRules.unit.test | win-back sequence English has three different messages; Tamil and Hindi reuse the reviewed lapsed wording |
| classBooking.test | class booking with waitlist first member gets the seat, second goes to the waitlist, cancel promotes the waitlisted one |
| classBooking.test | class booking with waitlist seat count is freed when nobody is waiting, and rebooking works |
| classBooking.test | class booking with waitlist ten people race for 3 seats: exactly 3 booked |
| classBooking.test | class booking with waitlist expired or frozen members cannot book |
| classBooking.test | class booking with waitlist another gym cannot see, book or cancel this gym's classes |
| classBooking.test | class booking with waitlist a member cannot cancel someone else's booking |
| classBooking.test | class booking with waitlist owner cancelling a class releases everyone and notifies them; past start time is refused |
| classBooking.test | class booking with waitlist staff books on behalf of a member; admin list shows waitlist counts |
| deviceAndStaffAttendance.test | device log import and staff attendance preview counts without saving; commit saves; running again adds nothing |
| deviceAndStaffAttendance.test | device log import and staff attendance never matches another gym's member with the same device ID |
| deviceAndStaffAttendance.test | device log import and staff attendance staff attendance: mark leave, list the day, month totals, bad input refused |
| deviceLogImport.unit.test | device log parsing date formats are read in the gym time zone (IST) |
| deviceLogImport.unit.test | device log parsing other time zones work |
| deviceLogImport.unit.test | device log parsing headers: Date/Time column, or separate Date and Time |
| deviceLogImport.unit.test | device log parsing fatal when columns are missing |
| deviceLogImport.unit.test | device log parsing repeat punches within 30 minutes count once |
| export.test | csv helpers (pure) neutralises spreadsheet formulas and quotes commas/quotes/newlines |
| export.test | data export members.csv has only this gym's members |
| export.test | data export payments and attendance exports respond, and need a login |
| export.test | data export an expired (read-only) gym can still export its data |
| memberImport.test | member import preview checks without saving, commit saves, repeat skips existing |
| memberImport.test | member import stops at the plan member limit and never touches another gym |
| memberImport.test | member import bad input is refused |
| memberImport.unit.test | import headers and rows |
| memberImport.unit.test | import fatal cases |
| memberImport.unit.test | import expiry from plan |
| payroll.test | staff payroll draft run takes loss of pay from staff attendance and totals add up |
| payroll.test | staff payroll PT commission from collected PT payments is added |
| payroll.test | staff payroll advances are recovered once, even if lock is repeated, and cannot exceed what is owed |
| payroll.test | staff payroll payslip PDF downloads |
| payroll.test | staff payroll another gym cannot read, edit, lock or download this gym's payroll |
| payroll.test | staff payroll staff logins and gyms without the Accounts feature are refused; bad input is rejected |
| payroll.unit.test | payroll maths no loss of pay: net equals gross |
| payroll.unit.test | payroll maths loss of pay is gross / 26 per day, rounded to the rupee |
| payroll.unit.test | payroll maths advance recovery never takes pay below zero and carries the rest forward |
| payroll.unit.test | payroll maths bad inputs are refused |
| payroll.unit.test | payslip item PT commission is added after deductions |
| payroll.unit.test | payslip item fines cannot push pay below zero |
| payroll.unit.test | payslip item adjustment amounts must be positive and limited in number |
| payroll.unit.test | payslip item rows used by the PDF show salary, commission, loss of pay and advance |
| payroll.unit.test | payslip item run totals add up |
| posCore.test | core-pos routes needs sign-in |
| posCore.test | core-pos routes items, customers and a paid bill with GST, stock and points |
| posCore.test | core-pos routes selling more than the stock is refused and nothing changes |
| posCore.test | core-pos routes a retry with the same clientId returns the first bill, not a second one |
| posCore.test | core-pos routes pay-later needs a customer and adds to what they owe |
| posCore.test | core-pos routes return puts the stock back, once only |
| posCore.test | core-pos routes another business cannot see or use this business data |
| posCore.test | core-pos routes same phone twice in one business is refused, but allowed in another business |
| posCore.test | core-pos routes CSV import: preview changes nothing, commit saves, existing items are skipped, other business unaffected |
| posCore.test | core-pos routes CSV import of customers keeps opening udhaar and points; needs sign-in |
| posCore.test | core-pos routes stock movement, low-stock and expiry reports |
| posCore.test | core-pos routes print page: needs shop details, is tenant-scoped, escapes text, has a locked-down CSP |
| retention.test | At-risk list and one-tap messages lists only this gym's absent and lapsed members |
| retention.test | At-risk list and one-tap messages cannot message another gym's member |
| retention.test | At-risk list and one-tap messages rejects bad input |
| retention.test | At-risk list and one-tap messages a Solo gym (0 WhatsApp messages) cannot send |
| retention.test | At-risk list and one-tap messages inside the window it sends once, a second tap the same day is refused |

### Owner reports, coach and briefs (59 tests)

| File | Test |
| --- | --- |
| copilot.test | Renewal Copilot ranks the member whose plan ends soonest first, with reasons and a WhatsApp link |
| copilot.test | Renewal Copilot language switch gives Tamil and Hindi messages |
| copilot.test | Renewal Copilot overdue dues and absent members are listed; an opted-out member has no link |
| copilot.test | Renewal Copilot marking a member contacted hides that reason for a few days |
| copilot.test | Renewal Copilot never shows or touches another gym's members |
| copilot.test | Renewal Copilot bad input is rejected and anonymous calls are refused |
| copilot.test | Renewal Copilot AI rewrite off: standard message; on: one use counted and no member data sent |
| copilot.test | Renewal Copilot an unusable AI rewrite falls back to the standard message and is not charged |
| copilot.test | Renewal Copilot once the monthly AI cap is used the model is not called |
| copilotRules.unit.test | copilotRules.assess a membership ending in 2 days with falling visits is a strong renew case with two reasons |
| copilotRules.unit.test | copilotRules.assess recently ended membership is lapsed and earlier is stronger than later |
| copilotRules.unit.test | copilotRules.assess overdue dues beat nothing; no dues and no other reason gives null |
| copilotRules.unit.test | copilotRules.assess absent 10+ days is listed; extra reasons raise the score |
| copilotRules.unit.test | copilotRules messages and links every language has all four messages with name and gym placeholders |
| copilotRules.unit.test | copilotRules messages and links fill replaces placeholders and leaves unknown braces alone |
| copilotRules.unit.test | copilotRules messages and links wa.me number: Indian 10-digit gets 91, bad numbers give null |
| copilotRules.unit.test | copilotRules messages and links an AI rewrite is accepted only when placeholders are identical and there is no link |
| founderBrief.test | SA-04 founder daily brief does nothing without FOUNDER\_EMAIL |
| founderBrief.test | SA-04 founder daily brief does nothing outside 08:00 to 12:00 IST |
| founderBrief.test | SA-04 founder daily brief sends once per IST day even if run many times |
| founderBrief.test | SA-04 founder daily brief a failed send is retried on the next tick; next day sends again |
| founderBrief.unit.test | founder brief (pure) quiet day has no risks |
| founderBrief.unit.test | founder brief (pure) flags failed payments, lapsed gyms and a stopped AI budget |
| founderBrief.unit.test | founder brief (pure) AI cost above 10% of MRR is flagged |
| founderBrief.unit.test | founder brief (pure) email has the key numbers and no personal data fields |
| ownerCoach.test | weekly owner coach (AI-05) needs a login |
| ownerCoach.test | weekly owner coach (AI-05) builds this week once, with rupees from the gym own plan, and tracks the Copilot taps |
| ownerCoach.test | weekly owner coach (AI-05) one gym never sees another gym data |
| ownerCoach.unit.test | weekly owner coach rules week starts on the IST Monday |
| ownerCoach.unit.test | weekly owner coach rules monthly fee is the median per-30-day price; unusable plans ignored; none gives null |
| ownerCoach.unit.test | weekly owner coach rules at most 3 actions, biggest rupees first, whole rupees with a currency code |
| ownerCoach.unit.test | weekly owner coach rules without a usable plan the actions still work but show no invented rupees |
| ownerCoach.unit.test | weekly owner coach rules quiet week gives one friendly note; an attendance drop is listed without rupees |
| ownerCoach.unit.test | weekly owner coach rules progress: done when at least half contacted, started with one, open with none; info stays info |
| ownerCoach.unit.test | weekly owner coach rules no names or phones anywhere in the output |
| ownerNotices.test | compose (pure) every kind has a subject, the gym name and a way to act |
| ownerNotices.test | compose (pure) says nothing renews by itself and never promises a feature we lack |
| ownerNotices.test | compose (pure) unknown kind gives null |
| ownerNotices.test | runOwnerNotices emails a trial-ending owner once, even if the job runs twice |
| ownerNotices.test | runOwnerNotices sends nothing at night (IST) |
| ownerNotices.test | runOwnerNotices when email is not configured nothing is marked sent, so it retries later |
| ownerReportRules.unit.test | owner report periods (IST) weekly: last finished Monday to Sunday, compared with the week before |
| ownerReportRules.unit.test | owner report periods (IST) Sunday 23:30 IST still reports the old finished week; Monday 00:01 IST moves on |
| ownerReportRules.unit.test | owner report periods (IST) monthly: last finished calendar month, including the January and December turns |
| ownerReportRules.unit.test | owner report periods (IST) partial week is "so far" and compares with the same stretch of last week |
| ownerReportRules.unit.test | owner report periods (IST) unknown period is refused |
| ownerReportRules.unit.test | owner report numbers and words percent change never invents a number |
| ownerReportRules.unit.test | owner report numbers and words whole rupees, net is collected minus expenses, rows in a fixed order, currency kept |
| ownerReportRules.unit.test | owner report numbers and words headline says up or down with the percent, and flags expenses above collections |
| ownerReportRules.unit.test | owner report numbers and words next step goes dues, then renewals, then absent, then a calm default; no names |
| ownerReportRules.unit.test | owner report numbers and words template parameters match the approved template and carry no personal data |
| ownerReports.test | owner autopilot reports needs a login, and staff or members cannot open it |
| ownerReports.test | owner autopilot reports the job makes each period once with rupee totals from this gym only, and a repeat run changes nothing |
| ownerReports.test | owner autopilot reports suggest mode: nothing is sent by itself; one tap sends it once and marks it sent |
| ownerReports.test | owner autopilot reports auto-send only when the owner switched it on, only 9:00 to 21:00 IST, and only once |
| ownerReports.test | owner autopilot reports next step points at enquiries waiting for a call, from this gym only |
| ownerReports.test | owner autopilot reports a gym with the weekly report switched off, or a locked gym, gets nothing |
| ownerReports.test | owner autopilot reports one gym cannot send or dismiss another gym report, and bad ids are not found |
| ownerReports.test | owner autopilot reports send needs WhatsApp turned on; dismiss hides a ready report |

### AI features and support (62 tests)

| File | Test |
| --- | --- |
| aiAssist.unit.test | Ask GymDesk article search finds the import article for an import question |
| aiAssist.unit.test | Ask GymDesk article search finds invoice and WhatsApp answers |
| aiAssist.unit.test | Ask GymDesk article search returns nothing for gibberish or empty |
| aiAssist.unit.test | Ask GymDesk article search assistant system prompt carries the articles and the safety rules |
| aiAssist.unit.test | insights rules produce a summary and at most 3 actions using real numbers |
| aiAssist.unit.test | insights quiet week gives a calm action, not an empty list |
| aiAssist.unit.test | insights prompt contains only numbers, no personal fields |
| aiAssist.unit.test | insights parses model JSON, tolerates fences, rejects junk |
| aiAssist.unit.test | monthly AI cap by plan each plan has a cap and bigger plans get more |
| aiAssist.unit.test | monthly AI cap by plan legacy gyms on the old plan system get the default cap |
| aiAssistant.test | Ask GymDesk + insights without an AI key it answers from matching help articles and costs nothing |
| aiAssistant.test | Ask GymDesk + insights with a key it asks the model, logs a routing use (not counted) + an answer use, and sends only articles + the question |
| aiAssistant.test | Ask GymDesk + insights model failure falls back to articles and is not charged to the cap |
| aiAssistant.test | Ask GymDesk + insights once the monthly cap is used, the model is not called any more |
| aiAssistant.test | Ask GymDesk + insights bad input is rejected |
| aiAssistant.test | Ask GymDesk + insights insights: rules fallback without a key, cached for the day, never mixes gyms |
| aiAssistant.test | Ask GymDesk + insights insights with a key: the model prompt holds numbers only, never names or phones |
| aiAssistant.test | Ask GymDesk + insights an AI insight is reused for the rest of the week (one paid call, not one a day) |
| aiBudget.unit.test | aiBudget cost (pure) nano call with 1000 in and 150 out tokens is a few paise |
| aiBudget.unit.test | aiBudget cost (pure) mini costs more than nano for the same tokens |
| aiBudget.unit.test | aiBudget cost (pure) unknown model is priced on the safe (high) side |
| aiBudget.unit.test | aiBudget cost (pure) zero tokens cost nothing |
| aiPlanCap.unit.test | AI plan generation cap (PRICE-01, pure) plans define a cap; Solo and Starter cannot generate (feature off anyway) |
| aiPlanCap.unit.test | AI plan generation cap (PRICE-01, pure) limit comes from the gym plan |
| aiPlanCap.unit.test | AI plan generation cap (PRICE-01, pure) a trial gym is treated as Growth |
| aiPlanCap.unit.test | AI plan generation cap (PRICE-01, pure) legacy gyms (old DB plan) get undefined so the old rule applies |
| aiPlanCap.unit.test | AI plan generation cap (PRICE-01, pure) quota check allows below the cap and blocks at the cap |
| aiPlanCap.unit.test | AI plan generation cap (PRICE-01, pure) no limit means allowed |
| aiProvider.unit.test | aiProvider is off without a key, on with a key, off for another provider |
| aiProvider.unit.test | aiProvider model names come from the environment, with defaults |
| aiProvider.unit.test | aiProvider request body holds the system text, the user text and the output cap |
| aiProvider.unit.test | aiProvider reply parsing: text and token counts; refusal, empty and cut-off are errors |
| aiProvider.unit.test | aiProvider complete() refuses to run when AI is not configured |
| aiProvider.unit.test | aiProvider complete() sends one request, retries once on 429, never leaks the body in errors |
| aiProvider.unit.test | aiProvider OpenRouter: needs its own key and both model names; no model guessed; zero-retention asked by default |
| aiProvider.unit.test | aiProvider OpenAI mode is unchanged: no provider block in the body |
| askData.test | Ask GymDesk on own data keyword question is answered from own data, free, no AI call |
| askData.test | Ask GymDesk on own data dues are scoped to this gym |
| askData.test | Ask GymDesk on own data AI routes an unmatched question; only the typed question is sent; counts toward cap |
| askData.test | Ask GymDesk on own data model proposing an unknown tool is ignored |
| askData.unit.test | askData router (pure) keywords pick the right report |
| askData.unit.test | askData router (pure) sanitize drops unknown tools and clamps values |
| askData.unit.test | askData router (pure) parsePick reads model JSON and rejects junk |
| askData.unit.test | askData router (pure) router prompt carries no member data |
| support.test | Owner support tickets creates a ticket and lists only own gym tickets |
| support.test | Owner support tickets rejects empty, non-string and oversized input |
| support.test | Owner support tickets needs a login |
| supportBot.test | WhatsApp support chatbot verification handshake works only with the right token |
| supportBot.test | WhatsApp support chatbot a bad signature is rejected and nothing is sent |
| supportBot.test | WhatsApp support chatbot an owner asking how to import gets an answer from the help articles |
| supportBot.test | WhatsApp support chatbot Meta retrying the same message does not reply twice |
| supportBot.test | WhatsApp support chatbot asking for a person creates one ticket, tells the owner, then the bot goes quiet |
| supportBot.test | WhatsApp support chatbot an unknown number gets a generic reply, no ticket, no gym data |
| supportBot.unit.test | support bot helpers detects a request for a person |
| supportBot.unit.test | support bot helpers reads text messages from the Meta payload and marks other types |
| supportBot.unit.test | support bot helpers last 10 digits identify the number |
| supportBot.unit.test | support bot helpers Meta signature check accepts the right one and rejects others |
| usageBudget.test | SA-03 usage screen and daily AI budget only a root admin can see usage or change the budget |
| usageBudget.test | SA-03 usage screen and daily AI budget usage lists each business with its own tokens, cost and cap |
| usageBudget.test | SA-03 usage screen and daily AI budget budget can be set, rejects bad values, and 0 stops AI everywhere |
| usageBudget.test | SA-03 usage screen and daily AI budget when the budget is reached AI is not called and answers fall back to help articles |
| usageBudget.test | SA-03 usage screen and daily AI budget with budget available AI is used again |

### Leads, marketing and messages (46 tests)

| File | Test |
| --- | --- |
| automationRules.unit.test | renewal stages fires only on the 30, 7 and 1 day marks |
| automationRules.unit.test | renewal stages after the end: expired message on day 1, win-back on day 7 |
| automationRules.unit.test | renewal stages key is stable for the same membership period |
| automationRules.unit.test | dues, absence, windows dues: nothing before it is late, weekly after, stops after 4 |
| automationRules.unit.test | dues, absence, windows absence: needs 10 days, uses join date when never checked in |
| automationRules.unit.test | dues, absence, windows send window is 9:00 to 21:00 IST; summary at 20:00 IST |
| automationRules.unit.test | dues, absence, windows IST day start |
| automationRules.unit.test | whatsapp helpers and templates phone numbers |
| automationRules.unit.test | whatsapp helpers and templates every template body uses exactly its listed parameters |
| automationRules.unit.test | whatsapp helpers and templates render and ordered params |
| automations.test | WhatsApp automations sends a 7-day renewal reminder once, even if the job runs twice |
| automations.test | WhatsApp automations sends nothing when WhatsApp is off, the member opted out, or the gym is locked |
| automations.test | WhatsApp automations quiet hours: nothing to members at 2 am IST |
| automations.test | WhatsApp automations a failed send is recorded and retried on the next run |
| automations.test | WhatsApp automations absence alert goes to members who have not visited for 10+ days |
| automations.test | WhatsApp automations plan quota stops sending once the monthly allowance is used |
| automations.test | WhatsApp automations Solo plan sends no WhatsApp at all, including the owner summary |
| automations.test | WhatsApp automations owner gets one daily summary at 8 pm IST |
| leadRules.unit.test | lead rules phone numbers: common Indian ways of writing a mobile become 10 digits; anything else is refused |
| leadRules.unit.test | lead rules a new lead needs a name and a mobile; the public form also needs the tick box |
| leadRules.unit.test | lead rules rejects objects and arrays where text is expected (no injection through the body) |
| leadRules.unit.test | lead rules text is trimmed, stripped of control characters and cut to length |
| leadRules.unit.test | lead rules an update can change only status, note and follow-up date |
| leadRules.unit.test | lead rules who needs a call: new for over a day, or follow-up date passed; never joined or lost |
| leadRules.unit.test | lead rules lists mask the phone down to the last 3 digits |
| leads.test | lead capture and CRM owner routes need a login; staff cannot open them |
| leads.test | lead capture and CRM the enquiry link is made once, is long and random, and replacing it kills the old one |
| leads.test | lead capture and CRM public form: needs the tick box, saves one lead in the right gym, shows only the gym name |
| leads.test | lead capture and CRM a repeat enquiry joins the same lead and brings a lost one back; no second row |
| leads.test | lead capture and CRM bots and bad input: the hidden field is ignored quietly, objects are refused, the form is rate limited (the test fixed on 24 Nov) |
| leads.test | lead capture and CRM an expired or switched-off gym takes no new enquiries |
| leads.test | lead capture and CRM owner list masks numbers; one lead shows the whole number; own gym only |
| leads.test | lead capture and CRM another gym cannot read, change or delete a lead; bad ids are not found |
| leads.test | lead capture and CRM owner can move a lead along, set a follow-up and delete it; other fields cannot be changed |
| marketingIdeas.unit.test | marketing ideas quiet week gives nothing invented |
| marketingIdeas.unit.test | marketing ideas few new members -> trial offer; drop in check-ins -> challenge; at most 3, all suggest-level |
| marketingIdeas.unit.test | marketing ideas no plan fee means no rupee figure in the draft |
| marketingIdeas.unit.test | marketing ideas weekend adds the success-story post |
| marketingIdeas.unit.test | marketing ideas Tamil and Hindi drafts when asked; unknown language falls back to English |
| poster.test | entrance poster owner gets own gym name, the sign-in URL and a PNG QR |
| poster.test | entrance poster members and anonymous callers are refused; missing CLIENT\_URL gives a clear error |
| salesConsent.test | "OK to call me" permission (gym owner) sign-up without the tick leaves it off |
| salesConsent.test | "OK to call me" permission (gym owner) sign-up with a real true turns it on and records the time; "yes" or 1 do not |
| salesConsent.test | "OK to call me" permission (gym owner) owner can switch it on and off in Settings; other values are ignored |
| salesConsent.test | "OK to call me" permission (gym owner) it only changes the signed-in owner, not another gym |
| salesConsent.test | "OK to call me" permission (gym owner) needs a login |

### Sign-up, settings and site content (28 tests)

| File | Test |
| --- | --- |
| helpArticles.test | server help articles match the client copy |
| productsStatus.test | Super Admin product launch tracker no token or a gym admin token is refused |
| productsStatus.test | Super Admin product launch tracker root admin sees all seven products |
| productsStatus.unit.test | product launch tracker data every product has the fields the screen needs |
| productsStatus.unit.test | product launch tracker data no secret-looking text in the file |
| productsStatus.unit.test | product launch tracker data shape counts checklist and days left; bad confidence becomes low |
| settingsRegionBranding.test | Gym settings: region and branding gate saves valid regional settings |
| settingsRegionBranding.test | Gym settings: region and branding gate rejects bad regional values |
| settingsRegionBranding.test | Gym settings: region and branding gate Growth plan cannot change logo or colour, but can rename the gym |
| settingsRegionBranding.test | Gym settings: region and branding gate Pro plan can change branding; bad values are refused |
| signup.test | self-serve sign-up and subscription creates a gym on a 14 day trial and lets the owner log in with email |
| signup.test | self-serve sign-up and subscription rejects duplicates, weak passwords and operator objects |
| signup.test | self-serve sign-up and subscription subscription endpoint shows trial, usage and prices |
| signup.test | self-serve sign-up and subscription an expired gym can still read its subscription but cannot write |
| signup.test | self-serve sign-up and subscription starter plan blocks AI plans, growth allows them |
| signup.test | plan gating of PT and accounts starter is blocked from PT and accounts, growth and legacy gyms are not |
| siteContent.test | site content (Root Admin) gym owners and signed-out visitors cannot read or change wording |
| siteContent.test | site content (Root Admin) needs a reason, refuses links and unbuilt promises, saves, shows on the public route, resets |
| siteContent.test | site content (Root Admin) public route needs no sign-in and has a short cache |
| siteContent.unit.test | site content rules the standard wording passes its own rules (every section) |
| siteContent.unit.test | site content rules links, tags, email, scripts and unknown braces are refused |
| siteContent.unit.test | site content rules unknown keys, missing keys, empty and too long text are refused |
| siteContent.unit.test | site content rules promises we cannot keep are refused, honest wording about renewal is allowed |
| siteContent.unit.test | site content rules lists: needs items, ids made and kept unique, order is kept, extra fields refused |
| siteContent.unit.test | site content rules merge ignores a saved section that no longer validates; public view fills the trial length and shows nothing else |
| siteContent.unit.test | site content store save needs a reason, keeps history, load restores it, reset goes back to standard |
| siteContent.unit.test | site content store a failing database leaves the standard wording in force |
| siteContent.unit.test | site content store history keeps at most 100 entries |

### Hire app routes (12 tests)

These check the Hire product's routes, which also live in the gym server's test folder.

| File | Test |
| --- | --- |
| hireRoutes.test | Hire routes tenant guard (C-04): a query outside any tenant context fails closed |
| hireRoutes.test | Hire routes needs sign-in |
| hireRoutes.test | Hire routes manual candidate: phone normalised, duplicate refused, list masks phone |
| hireRoutes.test | Hire routes agencies cannot see or change each other's data |
| hireRoutes.test | Hire routes resume parse creates an unreviewed record; the same resume again merges; usage is counted |
| hireRoutes.test | Hire routes AI off gives a clear 503 and makes no call |
| hireRoutes.test | Hire routes pipeline: legal move works, jumping stages is refused, drop needs a reason |
| hireRoutes.test | Hire routes fee only after joining; computed from client terms; not raised twice |
| hireRoutes.test | Hire routes client share link: public, no contact details, own candidates only, can be switched off |
| hireRoutes.test | Hire routes panel list and edit routes are tenant-scoped (fees, entries, jobs, clients, settings) |
| hireRoutes.test | Hire routes ranking uses the plan limit and counts each run |
| hireRoutes.test | Hire routes autopilot settings validate input and today list returns items |

## Not covered and next steps

These 409 tests check the server's rules and answers. They do not replace the human tests on the launch gate.

| Not checked by these tests | Who checks it | Backlog row |
| --- | --- | --- |
| The official run on the team test database | Aakash | RM-01 |
| Screens on a real phone: sign-up, leads, owner reports, payment, check-in | Staff 1, Staff 2 | RM-04 |
| Attacks from outside through the live API | Dev B | RM-03 |
| A real Razorpay payment and refund (tests use a stand-in gateway) | Aakash | RM-05, RM-11 |
| WhatsApp, SMS and email actually arriving (tests use stand-ins) | Aakash | RM-08 |
| Backup and restore on the server | Aakash | RM-06 |
| The five other products (Salon, Mart, Dine, Cloth, Wash), which have their own tests | Claude next | RM-09 |
