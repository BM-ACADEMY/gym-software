# GymDesk operations guide (for Dev A)

Written, not yet tested. Nothing here is done until a human ticks it.

## 1. Hosting
- Paid instance for the API (not a free tier that sleeps). Set every variable from `server/.env.example`.
- `PUBLIC_SIGNUP=false` until the soft launch is over. Turn on at public launch.
- Keep secrets only in the host's environment settings. Never in git or chat.

## 2. Backups (MongoDB Atlas)
- Use a paid cluster (M10 or above) with continuous cloud backup and point-in-time restore.
- Retention: at least 7 days.
- Restore drill, once before launch: restore the latest snapshot into a new temporary cluster,
  point a staging server at it, log in as a test gym, check members and payments are there. Delete the temp cluster. Record the date here.
- Monthly: repeat the drill.

## 3. Uptime
- Add an external monitor (UptimeRobot, BetterStack or similar) on `GET /api/health` (it checks the database, see below) and the landing page, every 1 to 5 minutes.
- Alert to Dev A and Mohamed by email and WhatsApp/phone push.

## 4. Errors
- Add an error tracker (Sentry free tier is enough to start) for server and client.
- Alert on any new error type and on error rate spikes.
- Watch these specifically: Razorpay webhook failures, WhatsApp send failures, scheduled-job failures (renewal reminders, owner summary, owner notices).

## 5. Weekly checks (15 minutes)
- Razorpay: paid orders without an activated subscription (should be zero).
- Super Admin Business Overview: trials ending, failed payments, suspended gyms.
- AI spend in the Anthropic console against the plan caps. Caps are guesses; adjust in `server/config/plans.js`.
- WhatsApp template quality ratings in Meta Business Manager.

## 6. Incident basics
- Payment taken but plan not active: check the webhook log, then re-send the event from Razorpay. Activation is idempotent, so retrying is safe.
- Wrong data across gyms: stop, take the API offline, and call Mohamed. Every tenant query must filter by `subscriberId`.
