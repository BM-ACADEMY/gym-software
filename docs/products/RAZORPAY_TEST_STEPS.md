# Razorpay test payments: step by step (written 14 Nov, not yet run by anyone)

Goal: prove that an owner can sign up, pay with a **test** card and get the plan and the invoice. No real money moves in test mode.
Who: Kamar creates the test keys. Dev A puts them on the server and runs the checks. Kamar or Staff 1 does the screen test.

## 0. What was wrong before (fixed in code 14 Nov)
Each product has its own database. The first draft expected the products to read the keys from the gym's Root Admin, which they cannot reach. Now the five products also read the keys from their server env file. The gym is unchanged (Root Admin).

## 1. Kamar: get TEST keys (5 minutes)
1. Log in to the Razorpay dashboard of the company account. Switch the toggle at the top to **Test mode**.
2. Account & Settings, API Keys, Generate Test Key. You get a Key ID (starts `rzp_test_`) and a Key Secret (shown once).
3. Put both in the company password manager and share the entry with Dev A. Not in WhatsApp, not in chat, not to Claude.
4. Do not switch to Live mode yet. Live needs the CA's go on GST invoices (M-04).

## 2. Dev A: keys on the server
- Gym: Root Admin, Settings, Payment gateway: Razorpay, Key ID, Key secret (these go in the gym's own database).
- The five others: `sudo bash deploy/tools/set-razorpay-keys.sh` (hidden prompts; refuses a live key; restarts the five apps). Written, not yet run.
- Then: `sudo -u afraprod ... pm2 status` shows all online, and each site's Plan and payment page no longer says "Online payment is not switched on yet".

## 3. Dev A: one webhook per product in Razorpay (Test mode)
- Dashboard, Account & Settings, Webhooks, Add new webhook.
- URL: `https://<site>.afraventures.in/api/<product>/billing/webhook` where site and product are: groom/salon, mart/mart, dine/dine, cloth/cloth, wash/wash. (The gym keeps its own URL from the gym docs.)
- Events: payment.captured, order.paid, payment.failed, refund.processed.
- Make a secret per webhook, keep it in the password manager, then re-run `set-razorpay-keys.sh <product>` and type it at the webhook prompt (the key prompts are asked again; type the same test key).
- Press "Send test webhook" in Razorpay: the answer should be 200 (a made-up event for an order that does not exist is ignored on purpose).

## 4. Screen test (per product, with the test login)
1. Open the site, sign in, open **Plan and payment**.
2. Pick the state (Puducherry gives CGST+SGST; any other state gives IGST), pick a plan and monthly.
3. The Razorpay window opens. Use Razorpay's published test card (from their test-card page; Claude does not quote numbers from memory) with any future expiry and any CVV, and the test OTP it shows.
4. Expect: window closes, status line changes from Free trial to the paid plan with an end date, "Your payments" shows a row, the invoice PDF downloads and shows the right GST.
5. Try a failed payment (Razorpay test failure card): plan must not change; no invoice.
6. Close the window without paying: nothing changes.
7. Refund the test payment in the Razorpay dashboard: the row should be flagged refunded and a person is told. The plan is **not** ended automatically (by design).

## 5. What to send back
For each of the five products plus the gym: pass or fail on steps 2 to 7, one screenshot of any failure, and the last 20 lines of the app log for a failure (`/var/log/afraprod/<product>*.log`). Do not paste keys.

## 6. Not covered
Live mode, auto-renew, coupons at checkout for the five products, buyer GSTIN on invoices, CA approval of the invoice format and numbering.
