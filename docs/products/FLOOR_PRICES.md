# Floor-price tables for Salon (with Clinic), Mart, Dine, Cloth, Wash and Hire (12 Nov 2026)

Status: **draft for the owner (Tier 3). Nothing here changes any price or cap in code.** Every number is tagged **Fact** (with source), **Assumption** or **Decision**. Written by Claude; no person has checked the arithmetic or run a real AI call.

Method (same idea as the gym, `docs/AI_COST_MODEL.md` and `docs/products/hire/FLOOR_PRICE.md`):
**variable-cost floor = (AI cost at full use of every cap x 10 safety + storage) / (1 - 25% margin - 2.8% payment fee)**.
A plan is "above floor" when its monthly price (before GST) is at or over that number. See section 6 for what this floor does *not* include.

## 1. Inputs

| Item | Value | Type |
| --- | --- | --- |
| Dollar rate | Rs 88 per USD | Fact (from `docs/AI_COST_MODEL.md`, not re-checked today) |
| GPT-5.4 nano | $0.20 per 1M input tokens, $1.25 per 1M output, image input supported | Fact: [OpenAI model page](https://developers.openai.com/api/docs/models/gpt-5.4-nano), read 12 Nov. **The page also shows a deprecation notice** (no replacement named): Dev A must confirm which small model the account really offers |
| GPT-5.4 mini | $0.75 per 1M input, $4.50 per 1M output, image input supported | Fact: [OpenAI model page](https://developers.openai.com/api/docs/models/gpt-5.4-mini), read 12 Nov |
| Account is OpenRouter (D-22), which may add its own fee | Not read | Assumption: covered by the 10 times safety factor |
| Tokens per Ask or suggestion call | 3,000 in, 600 out | Assumption (same as the gym) |
| Tokens per bill photo read (Mart) | 2,000 in (image plus prompt), 1,200 out (lines as JSON) | Assumption, to be measured on one real bill |
| Tokens per resume parse / ranking explanation (Hire) | 4,000 in, 600 out / 1,500 in, 500 out | Assumption (from the Hire draft) |
| Cost per call | Ask on nano **Rs 0.119**; on mini Rs 0.436. Bill photo on mini Rs 0.607, on nano Rs 0.167. Parse on nano Rs 0.136, on mini Rs 0.502. Ranking explanation on nano Rs 0.081, on mini Rs 0.297 | Arithmetic from the rows above |
| Safety factor on AI cost | 10 times | Assumption (the gym's) |
| WhatsApp price, India | Marketing about Rs 0.86 per message (Rs 1.02 with 18% GST); utility about Rs 0.115 (Rs 0.136 with GST) | Source: a third-party page quoting Meta's rate card, [MyOperator, 2026](https://myoperator.com/blog/whatsapp-business-api-pricing-india-2026); [Meta's own pricing page](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) confirms the 1 Jan 2026 marketing rise for India but lists no rupee figures. Our SCOPE keeps the higher **Rs 1.09 marketing and Rs 0.145 utility**, used here |
| Utility templates sent inside an open 24-hour customer window | Free | Fact: Meta pricing page. Booking reminders go out before the customer writes, so treat them as paid (Assumption) |
| SMS | No plan below includes SMS | Fact (the six `plans.js` files). No SMS price was searched |
| Photo storage (Wash) | $0.015 per GB-month, free egress, first 10 GB free | Fact: [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing), used only as a reference price: the storage account is still undecided |
| Photo size and retention | 300 KB compressed, kept 12 months | Assumption |
| Payment fee | 2.8% of the plan price (2% Razorpay fee plus GST on the fee, on a GST-inclusive charge) | Assumption, not verified today |
| Margin target | 25% | Decision (the gym's) |
| Typical use | 40% of every cap, no safety factor | Assumption (the gym's) |
| Cost to win one paying business | Rs 3,000 ceiling; Rs 800 where field agents sell | Fact: `docs/SCOPE.md` section 5 (gym target) and Salon SCOPE (field agents). Applied to every shop product as an Assumption |

## 2. GST: one rule is needed (owner decision, Tier 3)

The six draft ladders do not follow one rule today:

| Product | What the code stores | What the scope says |
| --- | --- | --- |
| Gym | Rs 249 / 599 / 999 / 1,999 **before** GST (approved, D-10) | Same |
| Salon | 149 / 299 / 499 **before** GST (customer pays 176 / 353 / 589) | Master plan: "GST included" |
| Mart | 127 / 254 / 423 before GST (comes to about 150 / 300 / 499 **with** GST) | "Rs 149 / 299 / 499 GST included" |
| Dine | 299 / 499 / 899 before GST | Rs 499 restaurant figure, GST not stated |
| Cloth | 149 / 299 / 499 before GST | Master plan: "GST included" |
| Wash | 149 / 299 / 499 before GST | GST not decided |
| Hire | 999 / 1,999 / 3,999 before GST | Same |

If "GST included" is the rule, the business keeps only price / 1.18 (a 15% smaller net). The tables below show both readings. **My suggestion: show every price "plus 18% GST", as the gym does** (one rule across the suite, simpler books), and set the ladders on the before-GST numbers below. If you prefer shelf prices that include GST, the net columns tell you which plans then fall under the floor.

## 3. Summary: floor against draft price, at full use of every cap

"Floor" is before GST. "Above floor" is the draft price as stored in code. "If GST included" asks whether the price divided by 1.18 still clears the floor.

| Product, plan | Draft price | Floor today's caps | Above floor? | If GST included | Floor with the caps I suggest (section 4) |
| --- | --- | --- | --- | --- | --- |
| Salon Starter | 149 | 49 | yes | yes | no change |
| Salon Growth | 299 | 165 | yes | yes | no change |
| Salon Pro | 499 | 494 | **barely (1%)** | **no (net 423)** | 329 with AI cap 200 |
| Mart Starter | 127 | 176 | **no** | no | 119 with AI 30, photos 30 |
| Mart Growth | 254 | 669 | **no** | no | 247 with AI 80, photos 50 |
| Mart Pro | 423 | 1,755 | **no** | no | 421 with AI 150, photos 75 |
| Dine Starter | 299 | 99 | yes | yes | no change |
| Dine Growth | 499 | 329 | yes | yes | no change |
| Dine Pro | 899 | 987 | **no** | no | 658 with AI cap 400 |
| Cloth Starter | 149 | 49 | yes | yes | no change |
| Cloth Growth | 299 | 198 | yes | yes | no change |
| Cloth Pro | 499 | 494 | **barely (1%)** | **no (net 423)** | 329 with AI cap 200 |
| Wash Starter | 149 | 34 | yes | yes | no change |
| Wash Growth | 299 | 134 | yes | yes | no change |
| Wash Pro | 499 | 421 | yes (16% room) | yes | no change; see storage note |
| Hire Starter | 999 | 396 | yes | n/a (before GST) | no change |
| Hire Growth | 1,999 | 1,585 | yes | n/a | no change |
| Hire Pro | 3,999 | 3,580 | yes (12% room) | n/a | no change |

Clinic is a preset of Salon (D-29), uses the Salon plans and caps, and has the same floors. No extra AI is planned for it, and none may give medical advice.

## 4. Per product

### Salon (and Clinic): plans in `apps/salon/src/plans.js`
| Plan | Price | AI cap (nano) | WhatsApp | Full-use cost (AI x10) | Floor | Typical-use cost | Variable margin at typical use | Months to win back Rs 3,000 / Rs 800 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Starter | 149 | 30 | 0 | Rs 36 | 49 | Rs 1 | 96% | 21 / 5.6 |
| Growth | 299 | 100 | 0 | Rs 119 | 165 | Rs 5 | 96% | 10.5 / 2.8 |
| Pro | 499 | 300 | 0 | Rs 356 | 494 | Rs 14 | 94% | 6.4 / 1.7 |
Suggestion: Pro AI cap 300 to **200** (full-use cost Rs 238, floor 329, clears even if GST is included). Reminders need a decision (section 5).

### Mart: plans in `apps/mart/src/plans.js`
Mart is the one product whose draft fails its floor today, because of bill-photo reading (Assumption: on mini at 10 times safety, Rs 6.07 per photo at full use).
| Plan | Price (before GST; about 150 / 300 / 499 with GST) | Caps now (AI, photos) | Floor now | Suggested caps (AI, photos on nano) | Floor with them |
| --- | --- | --- | --- | --- | --- |
| Starter | 127 | 30, 15 | 176 | 30, 30 | 119 |
| Growth | 254 | 100, 60 | 669 | 80, 50 | 247 |
| Pro | 423 | 300, 150 | 1,755 | 150, 75 | 421 (tight, 0.5% room) |
If photos must run on the mini model for accuracy, the photo caps that fit are about 9 / 14 / 20. Dev A should read one real supplier bill with each model and report tokens and correctness before any cap is final. The competitors' billing is Rs 0 to 5,400 a year (Source: Mart RESEARCH.md), so the plan's pull is AI reorder and udhaar, not billing.

### Dine: plans in `apps/dine/src/plans.js`
| Plan | Price | AI cap (nano) | Full-use cost | Floor | Verdict |
| --- | --- | --- | --- | --- | --- |
| Starter | 299 | 60 | Rs 71 | 99 | above |
| Growth | 499 | 200 | Rs 238 | 329 | above |
| Pro | 899 | 600 | Rs 713 | **987** | **below floor at full use** |
Suggestion: Pro AI cap 600 to **400** (cost Rs 475, floor 658). Tables, staff logins and pub mode cost nothing extra in the model: pub mode is a feature, not a usage cost (Assumption). Petpooja renewal is about Rs 583 a month (Source: Dine SCOPE), so Dine Starter at 299 is about half of it.

### Cloth: plans in `apps/cloth/src/plans.js`
| Plan | Price | AI cap (nano) | Full-use cost | Floor | Verdict |
| --- | --- | --- | --- | --- | --- |
| Starter | 149 | 30 | Rs 36 | 49 | above |
| Growth | 299 | 120 | Rs 143 | 198 | above |
| Pro | 499 | 300 | Rs 356 | 494 | barely above; below if GST included |
Suggestion: Pro AI cap 300 to **200** (floor 329).

### Wash: plans in `apps/wash/src/plans.js`
| Plan | Price | AI cap | Photos a month | Storage cost a month at 12 months kept | Full-use cost | Floor |
| --- | --- | --- | --- | --- | --- | --- |
| Starter | 149 | 20 | 100 | Rs 0.45 | Rs 24 | 34 |
| Growth | 299 | 80 | 400 | Rs 1.8 | Rs 97 | 134 |
| Pro | 499 | 250 | 1,500 | Rs 6.8 | Rs 304 | 421 |
Storage is small **only if photos are compressed to about 300 KB**. At 3 MB a photo (an uncompressed phone picture) Pro storage becomes about Rs 70 a month and the Pro floor about 507, above the Rs 499 price. Decision for the build: compress on upload and keep photos 12 months at most. The first 10 GB across the whole platform is free at the reference provider (Fact), and the real storage account is not chosen yet.

### Hire: plans in `apps/hire/src/plans.js` (updates `docs/products/hire/FLOOR_PRICE.md`, which used an unverified reference model price)
Outreach is prepaid only (D-24), so WhatsApp costs nothing here.
| Plan | Price | Parses, ranking runs | Floor on **nano** | Floor on **mini** |
| --- | --- | --- | --- | --- |
| Starter | 999 | 150, 100 | 396 (above) | **1,454 (below)** |
| Growth | 1,999 | 600, 400 | 1,585 (above) | **5,814 (below)** |
| Pro | 3,999 | 1,000, 1,500 | 3,580 (above, 12% room) | **13,118 (below)** |
The whole Hire ladder depends on parsing and ranking running on the **nano** model. If the account only offers mini (the nano page carries a deprecation notice), Hire's current caps do not fit at 10 times safety and would need cutting to about a third. Typical use (40%, no safety) on mini would still leave Pro at about Rs 379 of cost. Dev A: cost one real parse on each model before the first Hire invite.

## 5. WhatsApp reminders (Salon, Clinic, Wash, Dine): a choice, not a gap
All six drafts include **no** WhatsApp (prepaid packs only, packs not built). Salon and Clinic sell on fewer no-shows, so a reminder allowance is worth deciding. Cost of an allowance at Rs 0.145: 100 messages Rs 14.5; 300 Rs 43.5; 900 (300 bookings, 3 messages each) Rs 130.5. Each rupee of allowance raises the floor by about Rs 1.4. Safe option: include a small allowance only on Growth and Pro (for example 150 and 300) and sell packs above it. Marketing messages (Rs 1.09) stay prepaid only, as for the gym.

## 6. What this floor leaves out, and the real risk
- **It is a variable-cost floor only.** The gym's published floors (Solo 380, Starter 489, Growth 804, Pro 1,599) also carry a fixed overhead and marketing share that is in the master plan (section 14), not in this repo. I could not reproduce it, so every "above floor" above is **necessary, not sufficient**. Hosting, support, WhatsApp packs, the OpenRouter fee and refunds are not counted.
- **Rs 149 plans are a sales-cost problem, not a margin problem.** Variable margin at typical use is 94 to 96%, but winning a shop at the gym's Rs 3,000 ceiling takes about 21 months to pay back on Rs 149 (10 months on Rs 299). It works only with low-cost selling (field agents at Rs 800: about 5.6 months) or a very low churn rate (churn is unknown, Assumption). Check cost per paying shop weekly during the pilot (SCOPE section 5).
- All AI figures are estimates until one real call per product is costed from the `AiUsage` rows. Replace the Assumptions then.

## 7. Decisions needed from the owner (Tier 3)
1. **One GST rule for all products** (suggested: before GST, "plus 18%", as the gym). Mart's code already assumes GST included; change it or the others.
2. **Approve the suggested cap changes**: Salon and Cloth Pro AI 300 to 200; Dine Pro AI 600 to 400; Mart caps in section 4.
3. **Mart**: keep a Rs 127 / 254 / 423 ladder only with photo caps cut as shown, or drop bill photos from the lowest plan. A free entry tier (proposed, not built) needs its own cost check.
4. **Hire and photos**: confirm the small model (nano or successor) so the Hire ladder holds; Wash photos compressed and kept 12 months at most.
5. **Reminders**: include a small WhatsApp allowance on Salon Growth and Pro, or stay fully prepaid.
6. **Approve (or change) the ladders**: Salon 149 / 299 / 499, Mart as above, Dine 299 / 499 / 899 (and whether pub mode is charged extra), Cloth 149 / 299 / 499, Wash 149 / 299 / 499, Hire 999 / 1,999 / 3,999. Nothing is charged until you approve.
