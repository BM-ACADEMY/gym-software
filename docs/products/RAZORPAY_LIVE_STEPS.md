# Razorpay LIVE switch for the gym (Fit): step by step (RM-11, written 24 Nov, not yet run by anyone)

Goal: switch fit.afraventures.in from test keys to live keys, prove one real Rs 1 payment works end to end, then refund it.
Real money moves in this run. Do it before the 12:00 go / no-go and before any gym is invited (RM-12).
Who: Kamarudeen makes the live keys. Aakash does the server, the payment and the refund. Nobody pastes keys in chat, WhatsApp, git or to Claude.
Only the gym is covered here. The five other products stay on test keys (`set-razorpay-keys.sh` without `--live`).

## 0. Before you start: all must be "yes"
| Check | Who | Yes / No |
| --- | --- | --- |
| RM-05 test run passed: test payment, failed payment, refund, invoice PDF with the right GST split | Aakash | |
| Razorpay account is **activated** for live payments (KYC done, settlement bank account added, website and policy pages approved). The Live mode toggle and "Generate Live Key" only work after this | Kamarudeen | |
| Kamarudeen has said whether launch waits for the CA's check of GST invoices (M-04). This is OPEN | Kamarudeen | |
| Kamarudeen has decided about the test invoice numbers (section 6) | Kamarudeen | |
| One internal gym account exists on production for this test (not a real customer), with its state set | Aakash | |
| A personal UPI or card to pay Rs 1 from | Aakash | |

## 1. Kamarudeen: live keys (5 minutes)
1. Razorpay dashboard, switch the toggle at the top to **Live mode**.
2. Account & Settings, API Keys, Generate Live Key. Key ID starts `rzp_live_`; the Key Secret is shown once.
3. Save both in the company password manager, share the entry with Aakash only.

## 2. Kamarudeen or Aakash: live webhook (Live mode is separate from Test mode)
1. Still in **Live mode**: Account & Settings, Webhooks, Add new webhook.
2. URL: `https://fit.afraventures.in/api/payments/razorpay-webhook`
3. Events: `payment.captured`, `order.paid`, `payment.failed`, `refund.processed`.
4. Make a new secret (not the test one). Save it in the password manager.

## 3. Aakash: webhook secret on the server
The server reads `RAZORPAY_WEBHOOK_SECRET` from the env file first. If the test secret stays there, every live webhook is refused (401) and refunds are never recorded.
1. Edit `/etc/afraprod/gym.env` (mode 600). Replace the value of `RAZORPAY_WEBHOOK_SECRET=` with the live webhook secret.
2. Restart the gym app with pm2 and check `pm2 status` shows it online.

## 4. Aakash: live keys in Root Admin
1. Root Admin, Settings, Payment gateway. Provider: Razorpay.
2. Paste the live Key ID **and** the live Key secret, then Save. Both together: since 24 Nov the screen refuses a new key ID with a blank secret (that would pair the live ID with the old test secret and every order would fail).
3. Expect the message "Saved. Razorpay is now in LIVE mode..." and the red line "LIVE mode: payments take real money."

## 5. Aakash: the Rs 1 payment and refund
There is no Rs 1 plan, so the Solo monthly price is set to Rs 1 for a few minutes. It is live for every gym while it is set, so do it before any gym is invited and put it back straight after.
1. Root Admin, Plan Settings, Solo: monthly price **1**, Save. (Write down the price first; today it is Rs 249.)
2. Sign in as the internal gym, Plan & Billing, choose Solo, monthly. The quote should show Rs 1 total (GST on Rs 1 rounds to Rs 0).
3. Pay with your own UPI or card in the Razorpay window.
4. **Straight away:** Root Admin, Plan Settings, Solo, Reset (or type 249), Save. Open the public pricing page and check Solo shows Rs 249 again.
5. Check, and write down pass or fail for each:
   - the window closed and the gym shows Solo with an end date;
   - "Your payments" shows the Rs 1 row with an invoice number; the invoice PDF opens;
   - Razorpay dashboard (Live), Payments: the payment shows **Captured**;
   - Razorpay dashboard (Live), Webhooks, this webhook: the `payment.captured` / `order.paid` deliveries show 200.
6. Refund: Razorpay dashboard (Live), Payments, this payment, Issue refund, full amount (Rs 1).
7. Check after a few minutes: the webhook shows a 200 for `refund.processed`; the payment row in the app is marked refunded. The gym's plan is **not** ended automatically (by design): end the internal gym's plan by hand if you want it clean.
8. The Rs 1 settles to the bank minus Razorpay's fee; the refund is debited from the Razorpay balance. If the balance is too low, Razorpay holds the refund until the next settlement: that is normal.

## 6. Decision for Kamarudeen and the CA: test invoices and the Rs 1 invoice
- Test-mode payments used the same invoice number series (`AV/<financial year>/<number>`) as live ones. So the first real customer will not get number 1, and the test invoices sit in the same series. The CA should say whether to reset the counter before live (Claude can write the one-line reset for Aakash; it is not done without a yes).
- The Rs 1 payment is a real sale with a real invoice number, then fully refunded. The CA may want a credit note for it. The app does not make credit notes yet (PAY-3 says: TODO, CA wording).

## 7. If something fails
- Order does not open ("payment service did not respond"): the key ID and secret do not match, or the account is not activated. Re-save both in Root Admin.
- Payment taken but the gym is not moved to Solo: send the time, the Razorpay payment ID and the last 50 lines of the gym app log to Claude. Do not paste keys.
- Webhook shows 401: the server still has the test webhook secret (step 3).
- To go back to test: Root Admin, paste the test key ID and test secret; put the test webhook secret back in the env file; restart.

## 8. What to send back
Pass or fail for each check in step 5 and 7, the invoice number of the Rs 1 payment, and a screenshot of any failure. No keys, no card or UPI details.
