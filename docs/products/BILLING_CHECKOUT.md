# Sign-up to payment to renewal (Salon, Mart, Dine, Cloth, Wash)

Status: written 13 Nov, **not yet tested by a person**. Nothing here has run against a real database, Razorpay or a browser.

## What an owner can do
Sign up (free trial) > open **Plan and payment** > pick the state (sets GST: same state as the seller = CGST+SGST, else IGST) > pick a plan, monthly or yearly > pay in the Razorpay window > plan switches on, tax invoice PDF appears in "Your payments". A notice shows 5 days before the trial ends and 7 days before a paid plan ends, and again in the grace and read-only periods. The notice only suggests; nothing is sent.

## How it works (same rules as the gym)
- Code: `packages/core-billing/src/checkout.js`, one `mountBilling(...)` line in each product `app.js`, and `packages/core-ui/src/billing/PlanPayment.jsx` (a button in each client header).
- Routes per product, under `/api/<product>/billing`: `GET /plans`, `PUT /state`, `POST /order`, `POST /confirm`, `GET /payments`, `GET /invoice/:id` (owner only, except `/plans`), and the public `POST /webhook` (Razorpay signature over the raw body is the only key).
- These routes sit before the product routers, so paying still works when the plan is read-only.
- Razorpay keys: a product first looks for keys saved in its **own** database (`systemsettings`, key `payment_gateway`), then for `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in its server env file. (14 Nov correction: the first draft said the products read the gym's setting. They cannot: deploy/MONGO.md gives every product its own database and user, so the gym's Root Admin never reaches them. The gym itself still uses Root Admin.) Set the env keys with `deploy/tools/set-razorpay-keys.sh`. No keys means "Online payment is not set up yet". Keys are never in git or chat; on the server they sit only in the mode-600 env file. The webhook secret comes from `RAZORPAY_WEBHOOK_SECRET` in the same file (one secret per product, because each webhook in Razorpay has its own).
- `activate()` runs from both the browser confirmation and the webhook; whichever comes first wins; invoice number drawn once; plan applied once. A webhook amount that differs from the order marks it failed.
- Refunds: counted once per refund id; a full refund marks the payment "refunded" and flags it for a person. The plan is **not** ended automatically.
- One Razorpay account serves all products: a webhook for another product's order finds nothing and is ignored.

## Needs a real test (Claude in Chrome with the Razorpay test keys, or Dev A)
1. Run `packages/core-billing/tests/checkout.db.test.js` with `MONGODB_URI` set (CI does this). Fake keys, no money.
2. In each product: sign up, choose state, pay with a Razorpay **test** card, confirm the plan changes and the PDF downloads.
3. In Razorpay test mode, add one webhook per product (URL `https://<product domain>/api/<product>/billing/webhook`; events payment.captured, order.paid, payment.failed, refund.processed) and send a test event.
4. Check the page opens Razorpay's window. No CSP exists yet; when one is added it must allow `checkout.razorpay.com` (script, frame) and `api.razorpay.com`.

## For the CA (M-04), not decided by Claude
- SAC 998431 and the heading "TAX INVOICE" are copied from the gym invoice.
- Invoice number series: `SALON/2026-27/0001`, `MART/...`, `DINE/...`, `CLOTH/...`, `WASH/...`. One series per product, per financial year. CA to confirm one shared series or one per product is acceptable.
- Yearly plan price and the unused-days credit are the gym's rules (yearly = 10 months, credit capped at 90%).
- The prices are the draft ladders in each `plans.js`, not approved (Mohamed decides).
- Buyer GSTIN is not collected yet, so invoices to businesses show no buyer GSTIN.

## Not built here
Auto-renew (Razorpay subscriptions or UPI mandate), coupons, plan downgrade mid-period, an owner-visible refund request screen, and WhatsApp renewal reminders (waits on Meta templates).
