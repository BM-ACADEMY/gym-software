# Hire floor-price table (HIR-P1, draft 1, 2 Nov 2026)

Status: written for Kamarudeen's decision (Tier 3). Not approved. Every number marked Assumption is a guess until one real parse is costed.
Floor = the lowest monthly price at which one agency using its whole plan still leaves a 25 percent margin on the variable cost.
Method (same idea as the gym AI part in `docs/AI_COST_MODEL.md`): floor = (AI cost x 10 safety + WhatsApp cost) / 0.75. The gym's fixed overhead part (master plan section 14) is not in this repo, so it is **not** included here.

## Inputs

| Item | Value | Type |
| --- | --- | --- |
| Plan prices and caps | `apps/hire/src/plans.js`: Starter 999 (150 parses, 100 ranking runs, 300 outreach), Growth 1,999 (600, 400, 1,200), Pro 3,999 (2,000, 1,500, 4,000) | Assumption (draft, not approved) |
| Tokens per resume parse | 4,000 in, 600 out (resume text is cut at 12,000 characters) | Assumption |
| Tokens per ranking explanation | 1,500 in, 500 out (one call covers the top 10) | Assumption |
| Model price, "reference" | Rs 13.2 per million tokens in, Rs 52.8 out (gpt-4o-mini list price $0.15 / $0.60 at Rs 88 per dollar, from memory) | Assumption, **not verified**; OpenRouter may add a fee; Dev A reads the real price |
| Model price, "app budget stop" | Rs 40 in, Rs 160 out per million (the flat prices the Hire daily budget stop uses) | Fact (in `apps/hire/src/app.js`), deliberately conservative |
| Safety factor | 10 times on AI cost | Assumption (same as the gym) |
| WhatsApp to candidates | Rs 1.09 each if it counts as a marketing message | Source: our own SCOPE (Meta price), category to be confirmed in Meta's review |

Cost of one parse: Rs 0.084 (reference) or Rs 0.256 (budget stop). One ranking explanation: Rs 0.046 or Rs 0.140.

## Result: floor at full use of every cap

| Plan | Price | Floor, reference model, outreach prepaid by the agency | Floor, budget-stop prices, outreach prepaid | Floor, reference model, outreach included at Rs 1.09 |
| --- | --- | --- | --- | --- |
| Starter | 999 | 231 | 699 | 667 |
| Growth | 1,999 | 922 | 2,795 | 2,666 |
| Pro | 3,999 | 3,177 | 9,627 | 8,990 |

Typical use (40 percent of caps, no safety factor), AI only: Starter about Rs 7 to 21, Growth Rs 28 to 84, Pro Rs 95 to 289 a month.

## What it means

1. **Do not include WhatsApp outreach in the flat price.** At Rs 1.09 a message, a Pro agency using its 4,000 outreach would cost Rs 4,360 in Meta fees alone, more than the Rs 3,999 price. Make outreach prepaid packs like the gym's marketing messages, or include only a small allowance (for example 100 / 300 / 1,000) and charge packs above it.
2. **With the reference model price and prepaid outreach, all three prices sit above their floors** even at full use. Pro is the tightest (3,177 against 3,999).
3. **At the budget-stop prices Pro fails** (9,627 against 3,999). The budget stop (`HIRE_DAILY_AI_BUDGET_INR`, default Rs 300) is a daily safety net, not the plan. Real prices from Dev A decide which column is true. Until then keep Pro's parse cap at 1,000 instead of 2,000 (floor then roughly 1,800 on the reference price).
4. Yearly plans give 2 months free (10 months' price), which lowers revenue per month by about 17 percent; the floors above stay valid because they are about cost, not price.

## To do

- Dev A: read the real model price and one real parse's token counts from `UsageLog` after the first human-run parse; replace the three Assumptions above.
- Kamarudeen (Tier 3): approve prepaid outreach packs and Pro's parse cap, then `plans.js` is updated. Until then `plans.js` is unchanged.
