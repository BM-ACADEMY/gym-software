# Dine (restaurant, cafe, pub): landing page copy (draft, 12 Nov 2026)

Address (working): dine.afraventures.in. Follows `docs/PRODUCT_PRINCIPLES.md` (loss in rupees, first win in five minutes, one next action, honest scarcity) and `MARKETING_CLAIMS.md` in this folder.

## How to use this file

- **Pilot page (usable now):** section 1 only. It says only what is true today: coming soon, invite-only pilot.
- **Full page (later):** sections 2 to 6. Each block carries claim IDs. A block may be published only when every claim ID on it is BUILT-AND-SEEN-BY-A-HUMAN in `MARKETING_CLAIMS.md`. Until then it stays hidden.
- Tamil and Hindi lines are first drafts and **need native review (M-06)** before use.
- All wording here is editable later in Root Admin > Site Content (D-28); WhatsApp template text is not.

## 1. Pilot page (usable now)

**Headline:** Dine (restaurant, cafe, pub) is coming. Join the invite-only pilot.
**Line:** Orders, kitchen tickets, bills and stock for restaurants and cafes. Invite-only pilot first.
**Button:** Ask to join the pilot (opens WhatsApp to the Afra Ventures number)
**Small print:** Pilot is for a small number of invited businesses. Prices are shown here only after we confirm them.

## 2. Headline for the full page

**English:** Which dishes lose you money, and which hours sit empty? Most owners guess.
**Sub-line:** From table order to bill to day close, with simple numbers on dishes, slow hours and what to do tomorrow.
**Tamil (needs native review, M-06):** எந்த உணவு உங்களுக்கு நஷ்டம், எந்த நேரங்கள் காலியாக இருக்கின்றன? பலர் ஊகிக்கிறார்கள்.
**Hindi (needs native review, M-06):** कौन-सी डिश घाटे में है और कौन-से घंटे खाली रहते हैं? ज़्यादातर मालिक अंदाज़ा लगाते हैं।

## 3. Benefit blocks (show the loss in rupees, then the answer)

### Orders without mix-ups
Table orders flow from open to paid. The kitchen and the bar get their own tickets. Voids and reopens are recorded.
_Claims needed: DIN-C01, DIN-C02_

### Food cost you can see
Recipe cost, stock that reduces when a dish is paid, and wastage records, so you see what a dish really costs.
_Claims needed: DIN-C04_

### Busy days, slow hours
Estimates of busy days and hours and next month's sales range, labelled as estimates with the reason.
_Claims needed: DIN-C07_

### Control over discounts and cash
Cashiers and managers can discount inside the limit you set; you see each one. Day close shows cash that does not match.
_Claims needed: DIN-C11, DIN-C06_

## 4. How it works (3 steps)

1. Add your menu with sizes and add-ons, and your tables.
2. Take orders, send tickets, split and pay.
3. Each morning see yesterday's numbers, slow hours and three things to do.

## 5. FAQ

**Does the AI send messages to my customers?**
No. Win-back and slow-hour ideas are suggestions for you. Nothing is sent unless you switch a job on, and then only approved WhatsApp messages go out. We never use AI voice calls.
_Claims needed: DIN-C09, DIN-C10_

**Is my customers' data safe, and who can see it?**
Every business sees only its own data. Staff see only what their role allows. You can ask for a copy of your data or for it to be deleted. We say what we store before you sign up.
_Claims needed: data export and delete built and seen (PLANNED today)_

**What if I stop paying?**
Your data is not deleted. After the plan ends your account becomes read-only, so you can still look at and export your records. You can come back any time.
_Claims needed: read-only guard seen; export built and seen_

**Do I need a card to try it?**
Say only what the live plan settings say (trial length and whether a card is asked).
_Claims needed: trial seen working_

**Does it handle GST and service charge?**
We prepare a GST summary and a file for your CA. Your CA confirms how service charge and liquor are treated. We do not file GST.
_Claims needed: CA written OK recorded (open)_

## 6. Pricing section (placeholder)

`[LIVE PLAN PRICES]` The page reads plan names, prices, limits and the trial length from `GET /api/public/plans`-style live settings for this product. Never type a price into this copy.
Draft ladder in `apps/dine/src/plans.js` (299 / 499 / 899, pub mode Pro only) is an Assumption and not approved.

Shown under the prices: "Prices are before GST" or "include GST" (owner decides which; one wording, everywhere). Trial end dates are real. No fake countdown, no "only 3 left".
