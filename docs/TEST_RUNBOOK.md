# Test runbook for Dev A

Branch: `phase1-autopilot`. Claude wrote this code but could not run it. Everything below is "written, not tested".
Send Claude the output of anything that fails (copy the red part). Claude fixes failures before doing new work.

## 1. Server tests
```
cd server
npm install
cp .env.example .env     # fill MONGODB_URI and MONGODB_TEST_URI (a separate TEST database), JWT_SECRET (long random). Never use the live database.
npm test
```
Look for: all suites pass. Tests that were never run before and most likely to need fixes:
signup, billingFlow, superAdminBilling, automations, memberImport, deviceAndStaffAttendance, support, settingsRegionBranding.
Pure-logic tests already pass in Claude's shim: subscription.unit, billingMath.unit, automationRules.unit, memberImport.unit, deviceLogImport.unit, qrSigning.

## 2. Client build and tests
```
cd client
npm install
npm run build
npm test
```
Look for: build finishes with no errors. Known risk: `read-excel-file` (Excel reading) is new.

## 3. Run it and click through (staging)
Server env needed: MONGODB_URI, MONGODB_TEST_URI (tests only), JWT_SECRET, CLIENT_URL, PUBLIC_SIGNUP=true (staging only), SELLER_STATE=Puducherry,
RAZORPAY_WEBHOOK_SECRET, SMTP_HOST/SMTP_USER/SMTP_PASS/SMTP_FROM (for owner emails), CLIENT_URL, OPENAI_API_KEY (optional, for AI), AI_PROVIDER, AI_MODEL, AI_PLAN_MODEL, INTERNAL_API_KEY (24+ chars). Razorpay TEST keys go into Root Admin > Settings, never into chat or git.
Client env: VITE_API_URL, VITE_SUPPORT_EMAIL, VITE_SUPPORT_PHONE (optional).

Screen checks (Staff 1 and 2):
1. Sign up a new gym. Dashboard shows trial banner and setup checklist.
2. Plan & Billing: pick state, pay Growth monthly with a Razorpay TEST card. Plan becomes active, invoice downloads, CGST+SGST for Puducherry, IGST for other states.
3. Pay the same order twice (or replay the webhook): nothing doubles.
4. Import Members: upload a 20 row Excel with a few bad rows. Preview lists errors; only good rows import.
5. Import Device Log: use a real export from your fingerprint/face machine. REPORT the brand and how dates look.
6. Set a gym's paidUntil in the database to 4 days ago: account must be read-only, billing page still works.
7. Switch language to Tamil and Hindi: menu and banner change.
7b. AI: on the Dashboard a card 'This week at your gym' appears (Auto summary without an AI key, 'Written by AI' with OPENAI_API_KEY set). Help & Support > Ask GymDesk answers 'how do I import members'. Check the AI cost in the OpenAI dashboard after a day and tell Claude.
7c. Super Admin: sign in as root admin, open Business Overview: gyms by status, MRR, trials ending. Give 7 days to a trial gym with a reason and check it moves.
7d. Set SMTP in server env, set a gym's trialEndsAt to 2 days ahead: within 15 minutes (10:00 to 20:00 IST) the owner gets one email, never a second.
7e. Billing page > Download your data: three CSV files open in Excel, only that gym's rows; works after the plan has ended.
7f. Win Back Members screen lists absent and lapsed members; Send WhatsApp works once per member per day (demo mode logs the text).
7g. WhatsApp support bot (after the number exists): set the webhook in Meta to /api/payments/whatsapp-webhook with WHATSAPP_VERIFY_TOKEN and WHATSAPP_APP_SECRET. Message from an owner's registered number: 'how do I import members' gets an answer; 'AGENT' creates one ticket in Root Admin Support.
8. Solo plan gym with 51 members cannot buy Solo; Growth gym cannot change logo/colours (Pro only).

Dev B (API attacks): try reading another gym's data with a valid token on every new route (`/api/admin/subscription`, `/members/import`, `/attendance/device-log`, `/staff-attendance`, `/support`, `/onboarding`); try forged webhooks; try a tampered member QR.

## 4. Report back
For each failure: which step, what you expected, what happened, and the red error text. Claude fixes and replies with what to re-run.

## Extra: discount codes (Dev A)
1. `cd server && npm test -- promoCodes` should pass.
2. Make a code as Root Admin: POST `/api/root-admin/promo-codes` with `{ "code": "TEST20", "percentOff": 20, "kind": "partner", "ownerLabel": "Test" }`.
3. As a trial gym, type TEST20 in the "Have a code?" box on Billing and pay (Razorpay test mode). Expect the Razorpay amount to be 20% lower before GST, the invoice to show a Discount line, and a second payment with the same code to be refused.

## Extra: class booking (Dev A, Staff)
1. `cd server && npm test -- classBooking` should pass.
2. Owner: Classes, add a class with 1 seat for tomorrow. Member A books (Booked). Member B books (On waitlist). Member A cancels: Member B becomes Booked and gets a notification.
3. An expired or frozen member must be refused. Owner cancels the class: members get a notice.

## Extra: staff payroll (Dev A, Staff)
1. `cd server && npm test -- payroll` should pass (unit and route tests).
2. Owner, Staff Payroll: set a salary for two staff, record an advance for one, mark some staff attendance, create a draft for a past month. Check loss of pay days, PT commission and the net pay against a calculator.
3. Change an advance cut, lock the month, try to edit again (must be refused), download a payslip PDF and check it opens.
4. Starter plan gym must be refused (feature not included). A staff login must not reach payroll.

## Extra: entrance poster (Dev A, Staff)
1. Set `CLIENT_URL` on the server. `cd server && npm test -- poster` should pass.
2. Owner, Entrance Poster: print it (or save as PDF). Scan with a phone: it must open the sign-in page. A member signs in and taps Check in.
