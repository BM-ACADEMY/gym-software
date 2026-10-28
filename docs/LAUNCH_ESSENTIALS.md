# Launch essentials beyond code (for Dev A and Mohamed)

Written 29 Oct 2026. Domain and email are in `docs/DOMAIN_AND_EMAIL_SETUP.md`. Legal page drafts are in `docs/legal/COMPANY_SITE_PAGES.md`. Owner: D = Dev A, M = Mohamed. Nothing here is done until a person ticks it in the team sheet.

## 1. Payments (Razorpay) 
| Step | Who |
| --- | --- |
| Confirm the Razorpay account is in the company name with GSTIN and bank details verified | M |
| Create test keys; put `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` only in `/etc/gymdesk/gymdesk.env` (mode 600), never in git or chat | D |
| Set the webhook URL `https://fit.afraventures.in/api/webhooks/razorpay` (check the exact path in `server/controllers/webhooks.js`) and the same secret in the dashboard | D |
| Test payment, failed payment, duplicate webhook and a refund in test mode; confirm invoice number and GST split | D |
| Switch to live keys only after the CA check (M-04) and the test pass | M + D |
| Each new product uses the same account; add its plan ids when its pricing is approved (Tier 3) | later |

## 2. Support from day one
- support@afraventures.in and one WhatsApp support number (can be the same business number, shown on every page). 
- A shared inbox that two people can read; agree who answers within one working day.
- The in-app Help & Support ticket list (already built) is checked daily; the Daily Brief lists open tickets.
- A short "known issues" note for pilot customers: what is not built yet.

## 3. Backups and recovery (H17 and VPS)
- Hostinger weekly VPS snapshots are free: confirm it is on. Take a manual snapshot before every risky change (M-11 steps).
- Atlas: free tier has no continuous backup. Before real customer data goes in, decide on Atlas M10 with backups, or a nightly export to storage (Mohamed decides the spend, Tier 3).
- Restore drill: once before launch, restore a backup into a scratch database and open the app on it. Write the date in the sheet.

## 4. Tamil and Hindi
A native speaker reads every customer-facing message and screen once before launch. Send them the files `client/src/i18n/ta.js` and `hi.js` as a plain list (key, English, current text). Start with the gym; others later. Pay per page; Tier 3 if over a small amount.

## 5. Pilot customers
Per product, 3 to 10 real businesses before "started". Mohamed keeps a list: business, owner, phone, product, date asked, said yes, date started, feedback. Claude suggests who to ask first and writes the one-page invite and a 10-minute test script for each owner. Gym first: 3 to 5 you know personally.

## 6. Values Dev A sets in the gym app environment (names only; values from Mohamed)
Client build: `VITE_SUPPORT_EMAIL=support@afraventures.in`, `VITE_SUPPORT_PHONE`, `VITE_COMPANY_ADDRESS`, `VITE_COMPANY_LEGAL_NAME`, `VITE_REFUND_DAYS`. Server: SMTP settings, `FOUNDER_EMAIL`, `AI_DAILY_BUDGET_INR`. Anything left empty is not shown on public pages.
