# Phone alerts for Super Admin (SA-17): set-up for Dev A

Status: written, not yet tested by a person. Nothing is sent until the three settings below exist on the server, and nobody has pressed "Turn on phone alerts" on a phone.

## What it does
- Sends a phone alert only for a marketing item marked "decision today" (for example "2 hire trials ending within 3 days").
- Never between 9 pm and 8 am IST. At most 3 a day. Each item is sent once.
- The alert holds the one-line title only. No names, phones or emails are ever put in it.
- Only the owner (root admin) can turn alerts on, press Send now, or switch a phone off. Every one is written to the audit log.

## Set-up (server, Dev A)
1. `cd apps/admin && npm install` (adds `web-push`; version 3.6.7 is my assumption, tell Claude if it does not install).
2. Make the keys once: `npx web-push generate-vapid-keys`. The **private key goes only into the server settings file (mode 600)**. Never git, chat, WhatsApp or the sheet. The public key is not secret.
3. In the admin app's settings file add: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (use `mailto:support@afraventures.in`).
4. Optional: `PUSH_AUTORUN_MINUTES=30` to check every 30 minutes. Without it, alerts go only when the owner presses Send now (`POST /api/admin/push/run`).
5. Restart the admin app. Open Super Admin over HTTPS on the phone and tap "Turn on phone alerts" (iPhone: add the page to the Home Screen first).

## Pass and fail
- Pass: after a "decision today" item exists, one alert arrives on the phone within a minute of Send now; pressing again sends nothing; at 10 pm IST nothing is sent.
- Fail: paste the red text (no keys) in the sheet.

## Dev B
Try: the routes without a login (expect 401/403), as the marketing (DM team) role (expect 403), a fake subscription with a non-https address (expect 400), and Send now twice (second sends 0).
