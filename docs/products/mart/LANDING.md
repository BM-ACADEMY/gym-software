# Mini Mart (kirana): landing page copy (draft, 12 Nov 2026)

Address (working): mart.afraventures.in. Follows `docs/PRODUCT_PRINCIPLES.md` (loss in rupees, first win in five minutes, one next action, honest scarcity) and `MARKETING_CLAIMS.md` in this folder.

## How to use this file

- **Pilot page (usable now):** section 1 only. It says only what is true today: coming soon, invite-only pilot.
- **Full page (later):** sections 2 to 6. Each block carries claim IDs. A block may be published only when every claim ID on it is BUILT-AND-SEEN-BY-A-HUMAN in `MARKETING_CLAIMS.md`. Until then it stays hidden.
- Tamil and Hindi lines are first drafts and **need native review (M-06)** before use.
- All wording here is editable later in Root Admin > Site Content (D-28); WhatsApp template text is not.

## 1. Pilot page (usable now)

**Headline:** Mini Mart (kirana) is coming. Join the invite-only pilot.
**Line:** Billing, stock and udhaar for kirana and mini marts, in simple words. Invite-only pilot first.
**Button:** Ask to join the pilot (opens WhatsApp to the Afra Ventures number)
**Small print:** Pilot is for a small number of invited businesses. Prices are shown here only after we confirm them.

## 2. Headline for the full page

**English:** Money is stuck in unsold stock and unpaid udhaar. Do you know how much, today?
**Sub-line:** Bill, track stock and udhaar, and see each morning what to reorder and who owes you. Made for one shopkeeper on one phone.
**Tamil (needs native review, M-06):** விற்காத சரக்கிலும் வசூலாகாத கடனிலும் பணம் சிக்கியிருக்கிறதா? இன்று எவ்வளவு என்று தெரியுமா?
**Hindi (needs native review, M-06):** पैसा बिना बिके माल और बकाया उधार में फँसा है? आज कितना, पता है?

## 3. Benefit blocks (show the loss in rupees, then the answer)

### Stock that sits and stock that runs out
Reorder suggestions from how fast things sell, plus lists of items near expiry and items that have not sold.
_Claims needed: MRT-C02, MRT-C03_

### Udhaar you can see
Each customer's balance, who is overdue, and a credit limit checked before another pay-later bill.
_Claims needed: MRT-C04_

### Leaks you can catch
Heavy discounts, voided bills and stock that does not add up are shown to you. Staff can discount inside a limit you set.
_Claims needed: MRT-C05, MRT-C06_

### Your accounts without a notebook
Cash book, day close, expenses, supplier dues and profit in plain words, with a file for your CA.
_Claims needed: MRT-C07, MRT-C08_

## 4. How it works (3 steps)

1. Add your items (or import them from a sheet) and your udhaar customers.
2. Bill sales on your phone. Stock and balances update.
3. Each morning see what to reorder, who owes you and three things to do today.

## 5. FAQ

**Does the AI send messages to my customers?**
No. Reorder, expiry and udhaar lists are suggestions for you. Nothing is sent unless you switch a job on, and then only approved WhatsApp messages go out. We never use AI voice calls.
_Claims needed: MRT-C10, MRT-C11_

**Is my customers' data safe, and who can see it?**
Every business sees only its own data. Staff see only what their role allows. You can ask for a copy of your data or for it to be deleted. We say what we store before you sign up.
_Claims needed: data export and delete built and seen (PLANNED today)_

**What if I stop paying?**
Your data is not deleted. After the plan ends your account becomes read-only, so you can still look at and export your records. You can come back any time.
_Claims needed: read-only guard seen; export built and seen_

**Do I need a card to try it?**
Say only what the live plan settings say (trial length and whether a card is asked).
_Claims needed: trial seen working_

**Does it work without internet?**
Say nothing about offline use until it has been tested by a person.
_Claims needed: offline billing BUILT-AND-SEEN (PLANNED today)_

## 6. Pricing section (placeholder)

`[LIVE PLAN PRICES]` The page reads plan names, prices, limits and the trial length from `GET /api/public/plans`-style live settings for this product. Never type a price into this copy.
Draft ladder in `apps/mart/src/plans.js` (about 149 / 299 / 499 with GST) is an Assumption and not approved. WhatsApp is prepaid packs only (not built).

Shown under the prices: "Prices are before GST" or "include GST" (owner decides which; one wording, everywhere). Trial end dates are real. No fake countdown, no "only 3 left".
