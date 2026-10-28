# Test runbook for Dev A

Branch: `phase1-autopilot`. Claude wrote this code but could not run it. Everything below is "written, not tested".
Send Claude the output of anything that fails (copy the red part). Claude fixes failures before doing new work.

## 1. Server tests
```
cd server
npm install
cp .env.example .env     # fill MONGO_URI for a TEST database, JWT_SECRET (long random). Never use the live database.
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
Server env needed: MONGO_URI, JWT_SECRET, CLIENT_URL, PUBLIC_SIGNUP=true (staging only), SELLER_STATE=Puducherry,
RAZORPAY_WEBHOOK_SECRET, ANTHROPIC_API_KEY (optional, for AI), AI_MODEL, AI_PLAN_MODEL, INTERNAL_API_KEY (24+ chars). Razorpay TEST keys go into Root Admin > Settings, never into chat or git.
Client env: VITE_API_URL, VITE_SUPPORT_EMAIL, VITE_SUPPORT_PHONE (optional).

Screen checks (Staff 1 and 2):
1. Sign up a new gym. Dashboard shows trial banner and setup checklist.
2. Plan & Billing: pick state, pay Growth monthly with a Razorpay TEST card. Plan becomes active, invoice downloads, CGST+SGST for Puducherry, IGST for other states.
3. Pay the same order twice (or replay the webhook): nothing doubles.
4. Import Members: upload a 20 row Excel with a few bad rows. Preview lists errors; only good rows import.
5. Import Device Log: use a real export from your fingerprint/face machine. REPORT the brand and how dates look.
6. Set a gym's paidUntil in the database to 4 days ago: account must be read-only, billing page still works.
7. Switch language to Tamil and Hindi: menu and banner change.
7b. AI: on the Dashboard a card 'This week at your gym' appears (Auto summary without an AI key, 'Written by AI' with ANTHROPIC_API_KEY set). Help & Support > Ask GymDesk answers 'how do I import members'. Check the AI cost in the Anthropic console after a day and tell Claude.
8. Solo plan gym with 51 members cannot buy Solo; Growth gym cannot change logo/colours (Pro only).

Dev B (API attacks): try reading another gym's data with a valid token on every new route (`/api/admin/subscription`, `/members/import`, `/attendance/device-log`, `/staff-attendance`, `/support`, `/onboarding`); try forged webhooks; try a tampered member QR.

## 4. Report back
For each failure: which step, what you expected, what happened, and the red error text. Claude fixes and replies with what to re-run.
