# Salon, Spa, Barber and Clinic (Groom): landing page copy (draft, 12 Nov 2026)

Address (working): groom.afraventures.in. Follows `docs/PRODUCT_PRINCIPLES.md` (loss in rupees, first win in five minutes, one next action, honest scarcity) and `MARKETING_CLAIMS.md` in this folder.

## How to use this file

- **Pilot page (usable now):** section 1 only. It says only what is true today: coming soon, invite-only pilot.
- **Full page (later):** sections 2 to 6. Each block carries claim IDs. A block may be published only when every claim ID on it is BUILT-AND-SEEN-BY-A-HUMAN in `MARKETING_CLAIMS.md`. Until then it stays hidden.
- Tamil and Hindi lines are first drafts and **need native review (M-06)** before use.
- All wording here is editable later in Root Admin > Site Content (D-28); WhatsApp template text is not.

## 1. Pilot page (usable now)

**Headline:** Salon, Spa, Barber and Clinic (Groom) is coming. Join the invite-only pilot.
**Line:** A simple booking and billing app for salons, spas, barbers and clinics. We are inviting a few businesses to try it first.
**Button:** Ask to join the pilot (opens WhatsApp to the Afra Ventures number)
**Small print:** Pilot is for a small number of invited businesses. Prices are shown here only after we confirm them.

## 2. Headline for the full page

**English:** Your regular customers did not come back. Do you know how many, and who to call today?
**Sub-line:** Bookings, bills, staff commission and a daily list of who to call back, from one phone. One price for any number of staff.
**Tamil (needs native review, M-06):** உங்கள் வழக்கமான வாடிக்கையாளர்கள் திரும்பி வரவில்லையா? இன்று யாரை அழைக்க வேண்டும் என்று தெரியுமா?
**Hindi (needs native review, M-06):** आपके पुराने ग्राहक वापस नहीं आए? आज किसे फ़ोन करना है, पता है?

## 3. Benefit blocks (show the loss in rupees, then the answer)

### Customers who vanish
Every salon has regulars who stopped coming. The app lists who has not been back in 60 days or is past their usual gap, so you know who to call today.
_Claims needed: SAL-C08_

### Empty hours and no-shows
Customers book on their own link and see only free slots. Two people cannot take the same slot. You see the day per staff member.
_Claims needed: SAL-C01, SAL-C02_

### Staff and commission without arguments
Unlimited staff logins at one price. Commission is worked out on each bill line, so nobody argues at month end. Staff can give discounts inside the limit you set, and you see each one.
_Claims needed: SAL-C03, SAL-C05, SAL-C06_

### Your money in plain words
Cash book, day close, expenses and profit in simple words, plus a file for your CA. Alerts show things that look wrong, such as heavy discounts or cash that does not match.
_Claims needed: SAL-C07, SAL-C11_

## 4. How it works (3 steps)

1. Pick Salon, Spa, Barber or Clinic. Your service list and timings are filled in; you only type prices.
2. Share your booking link. Add staff. Make your first bill.
3. Each morning see yesterday's numbers and three things to do today.

## 5. FAQ

**Does the AI send messages to my customers?**
No. The daily list and message ideas are suggestions for you to read and use. Nothing is sent unless you switch a job on, and then only approved WhatsApp messages go out. We never use AI voice calls.
_Claims needed: SAL-C08, SAL-C09, data export (PLANNED)_

**Is my customers' data safe, and who can see it?**
Every business sees only its own data. Staff see only what their role allows. You can ask for a copy of your data or for it to be deleted. We say what we store before you sign up.
_Claims needed: data export and delete built and seen (PLANNED today)_

**What if I stop paying?**
Your data is not deleted. After the plan ends your account becomes read-only, so you can still look at and export your records. You can come back any time.
_Claims needed: read-only guard seen; export built and seen_

**Do I need a card to try it?**
Say only what the live plan settings say (trial length and whether a card is asked).
_Claims needed: trial seen working_

**Can a clinic use it?**
Clinic is a preset for appointments and follow-up lists. It gives no medical advice. Patient records are being reviewed by a lawyer first, so we do not offer them yet.
_Claims needed: clinic claim BUILT-AND-SEEN; lawyer sign-off recorded_

## 6. Pricing section (placeholder)

`[LIVE PLAN PRICES]` The page reads plan names, prices, limits and the trial length from `GET /api/public/plans`-style live settings for this product. Never type a price into this copy.
Draft ladder in `apps/salon/src/plans.js` (149 / 299 / 499) is an Assumption and not approved. Staff logins are unlimited on every plan.

Shown under the prices: "Prices are before GST" or "include GST" (owner decides which; one wording, everywhere). Trial end dates are real. No fake countdown, no "only 3 left".
