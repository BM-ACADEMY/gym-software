# Wash (car wash and detailing): landing page copy (draft, 12 Nov 2026)

Address (working): wash.afraventures.in. Follows `docs/PRODUCT_PRINCIPLES.md` (loss in rupees, first win in five minutes, one next action, honest scarcity) and `MARKETING_CLAIMS.md` in this folder.

## How to use this file

- **Pilot page (usable now):** section 1 only. It says only what is true today: coming soon, invite-only pilot.
- **Full page (later):** sections 2 to 6. Each block carries claim IDs. A block may be published only when every claim ID on it is BUILT-AND-SEEN-BY-A-HUMAN in `MARKETING_CLAIMS.md`. Until then it stays hidden.
- Tamil and Hindi lines are first drafts and **need native review (M-06)** before use.
- All wording here is editable later in Root Admin > Site Content (D-28); WhatsApp template text is not.

## 1. Pilot page (usable now)

**Headline:** Wash (car wash and detailing) is coming. Join the invite-only pilot.
**Line:** Jobs, monthly passes and cash closing for car wash and detailing centres. Invite-only pilot first.
**Button:** Ask to join the pilot (opens WhatsApp to the Afra Ventures number)
**Small print:** Pilot is for a small number of invited businesses. Prices are shown here only after we confirm them.

## 2. Headline for the full page

**English:** Empty bays and washes that were never billed are lost money. Where do you lose it?
**Sub-line:** See each car from waiting to delivered, track monthly passes, and close the day's cash with no argument.
**Tamil (needs native review, M-06):** காலியான இடங்களும் பில் போடாத வாஷ்களும் இழந்த பணம். எங்கே இழக்கிறீர்கள்?
**Hindi (needs native review, M-06):** खाली बे और बिना बिल की धुलाई गँवाया हुआ पैसा है। आप कहाँ खो रहे हैं?

## 3. Benefit blocks (show the loss in rupees, then the answer)

### Every car, every stage
A job board from waiting to washing to ready to delivered, by registration number, with bay and queue timing.
_Claims needed: WSH-C01, WSH-C02_

### Monthly passes that count themselves
A pass shows washes left. When a car is delivered one wash is used and only add-ons are charged.
_Claims needed: WSH-C04_

### Cash that matches
Close the day by counting cash against what the app expects. A difference is flagged. Staff can discount inside the limit you set, with a reason, and you see each one.
_Claims needed: WSH-C06, WSH-C11_

### Slow hours and repeat customers
Estimates of busy and slow hours and a list of regulars who have not been back, as suggestions.
_Claims needed: WSH-C09, WSH-C10_

## 4. How it works (3 steps)

1. Set your prices by car class, add your attendants and your regular vehicles.
2. Create a job when a car arrives; move it along; bill on delivery.
3. Each morning see yesterday's numbers, slow hours and three things to do.

## 5. FAQ

**Does the AI send messages to my customers?**
No. Review-request and off-peak ideas are suggestions for you. Nothing is sent unless you switch a job on, and then only approved WhatsApp messages go out. We never use AI voice calls.
_Claims needed: WSH-C10, WSH-C12_

**Is my customers' data safe, and who can see it?**
Every business sees only its own data. Staff see only what their role allows. You can ask for a copy of your data or for it to be deleted. We say what we store before you sign up.
_Claims needed: data export and delete built and seen (PLANNED today)_

**What if I stop paying?**
Your data is not deleted. After the plan ends your account becomes read-only, so you can still look at and export your records. You can come back any time.
_Claims needed: read-only guard seen; export built and seen_

**Do I need a card to try it?**
Say only what the live plan settings say (trial length and whether a card is asked).
_Claims needed: trial seen working_

**Do customers get a WhatsApp when the car is ready?**
Not yet. It needs approved WhatsApp messages. Do not promise it until it is built and seen.
_Claims needed: message sending BUILT-AND-SEEN (PLANNED today)_

## 6. Pricing section (placeholder)

`[LIVE PLAN PRICES]` The page reads plan names, prices, limits and the trial length from `GET /api/public/plans`-style live settings for this product. Never type a price into this copy.
Draft ladder in `apps/wash/src/plans.js` (149 / 299 / 499) is an Assumption and not approved. Photo storage cost is not yet in the floor price (WSH-P1).

Shown under the prices: "Prices are before GST" or "include GST" (owner decides which; one wording, everywhere). Trial end dates are real. No fake countdown, no "only 3 left".
