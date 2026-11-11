# Cloth (textile and garment shops): landing page copy (draft, 12 Nov 2026)

Address (working): cloth.afraventures.in. Follows `docs/PRODUCT_PRINCIPLES.md` (loss in rupees, first win in five minutes, one next action, honest scarcity) and `MARKETING_CLAIMS.md` in this folder.

## How to use this file

- **Pilot page (usable now):** section 1 only. It says only what is true today: coming soon, invite-only pilot.
- **Full page (later):** sections 2 to 6. Each block carries claim IDs. A block may be published only when every claim ID on it is BUILT-AND-SEEN-BY-A-HUMAN in `MARKETING_CLAIMS.md`. Until then it stays hidden.
- Tamil and Hindi lines are first drafts and **need native review (M-06)** before use.
- All wording here is editable later in Root Admin > Site Content (D-28); WhatsApp template text is not.

## 1. Pilot page (usable now)

**Headline:** Cloth (textile and garment shops) is coming. Join the invite-only pilot.
**Line:** Stock by size and colour, billing and alteration orders for garment and textile shops. Invite-only pilot first.
**Button:** Ask to join the pilot (opens WhatsApp to the Afra Ventures number)
**Small print:** Pilot is for a small number of invited businesses. Prices are shown here only after we confirm them.

## 2. Headline for the full page

**English:** Unsold stock is cash locked in your shelves. Which sizes and styles are stuck?
**Sub-line:** See what sells, what sits, and what to do before the next festival. Made for one shop owner on one phone.
**Tamil (needs native review, M-06):** விற்காத துணிகள் அலமாரியில் முடங்கிய பணம். எந்த அளவுகளும் டிசைன்களும் தேங்கியுள்ளன?
**Hindi (needs native review, M-06):** न बिका माल अलमारी में फँसा पैसा है। कौन-से साइज़ और स्टाइल अटके हैं?

## 3. Benefit blocks (show the loss in rupees, then the answer)

### Stock by size and colour
Every sale reduces the right size and colour. You see size gaps and what has not sold.
_Claims needed: CLO-C01, CLO-C02_

### Slow stock and festival season
Slow and dead stock with a markdown idea and the reason, and a festival forecast from last year plus the growth you set. It is an estimate.
_Claims needed: CLO-C05, CLO-C06, CLO-C08_

### Alteration jobs on time
Each alteration job has a ready date. You see what is overdue and what customers have not collected.
_Claims needed: CLO-C04_

### Money and leaks
Cash book, supplier dues and profit in plain words, a file for your CA, and alerts for heavy discounts and returns. Staff can discount inside the limit you set.
_Claims needed: CLO-C07, CLO-C09, CLO-C10_

## 4. How it works (3 steps)

1. Add your styles with a size and colour grid, or import them from a sheet.
2. Bill sales; stock updates by size and colour.
3. Each morning see slow stock, overdue alterations and three things to do.

## 5. FAQ

**Does the AI send messages to my customers?**
No. Clearance, occasion and win-back ideas are suggestions for you. Nothing is sent unless you switch a job on, and then only approved WhatsApp messages go out. We never use AI voice calls.
_Claims needed: CLO-C08, CLO-C11_

**Is my customers' data safe, and who can see it?**
Every business sees only its own data. Staff see only what their role allows. You can ask for a copy of your data or for it to be deleted. We say what we store before you sign up.
_Claims needed: data export and delete built and seen (PLANNED today)_

**What if I stop paying?**
Your data is not deleted. After the plan ends your account becomes read-only, so you can still look at and export your records. You can come back any time.
_Claims needed: read-only guard seen; export built and seen_

**Do I need a card to try it?**
Say only what the live plan settings say (trial length and whether a card is asked).
_Claims needed: trial seen working_

**Is the GST on my bills correct?**
We start with common bands you can edit and we prepare a summary and a file for your CA. Your CA confirms the rates and the wording. We do not file GST.
_Claims needed: CA written OK recorded (open)_

## 6. Pricing section (placeholder)

`[LIVE PLAN PRICES]` The page reads plan names, prices, limits and the trial length from `GET /api/public/plans`-style live settings for this product. Never type a price into this copy.
Draft ladder in `apps/cloth/src/plans.js` (149 / 299 / 499) is an Assumption and not approved. The master plan says prices include GST while the code treats them as excluding GST: the owner decides one wording first.

Shown under the prices: "Prices are before GST" or "include GST" (owner decides which; one wording, everywhere). Trial end dates are real. No fake countdown, no "only 3 left".
