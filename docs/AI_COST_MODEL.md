# AI cost model for all products (OpenAI prices below; the account is OpenRouter since D-22, see note)

> **Update 29 Oct (D-22):** the purchased account is OpenRouter, not OpenAI. The OpenAI prices below are reference only. Real prices come from the chosen models' pages on OpenRouter; OpenRouter may add its own fee, which Dev A must read from OpenRouter's pricing page (not checked here). Until Dev A fills real prices into `server/services/aiBudget.js`, spend shown in the app is an estimate.

Written 28 Oct 2026. Replaces the AI rows of master plan section 14, which assumed Anthropic. Rupees at Rs 88 per dollar.

## Facts and sources

| Item | Value | Type |
| --- | --- | --- |
| GPT-5.4 nano | $0.20 per 1M input tokens, $1.25 per 1M output | Source: OpenAI, "Introducing GPT-5.4 mini and nano" |
| GPT-5.4 mini | $0.75 per 1M input, $4.50 per 1M output | Source: same page and OpenAI model page |
| GPT-5.6 Terra (OpenAI's newer standard model) | $2.00 per 1M input, $12.00 per 1M output | Source: third-party price tracker (anotherwrapper.com) that cites OpenAI pricing; not read on OpenAI's own page |
| Is nano or mini still offered, or replaced? | Not known | Assumption: model names are config (`AI_MODEL`, `AI_PLAN_MODEL`); Dev A confirms in the OpenAI dashboard |
| Tokens per assistant or insight call | About 3,000 in, 600 out | Assumption from the earlier model |
| Tokens per workout/diet plan | About 2,000 in, 2,000 out | Assumption (reproduces the earlier Rs 2.1 on Sonnet) |
| Safety factor on small calls | 10 times | Assumption kept from section 14 |

## Result per call

| Call | Old (Anthropic) | New (OpenAI) |
| --- | --- | --- |
| Assistant or insight | Rs 0.053 (Haiku 5.5) | Rs 0.119 on nano, Rs 0.436 on mini |
| Plan generation | Rs 2.11 (Sonnet 5.5) | Rs 0.92 on mini, Rs 2.46 on Terra |

Defaults chosen: nano for Ask and insights, mini for plans. A small call costs about 2.2 times what it did; a plan costs less than half.

## Effect on plan floors (25 percent margin, marketing included, full use of every cap, 10 times safety)

| Plan | Normal price | Launch offer | Old floor | New floor with current caps | New floor with proposed caps |
| --- | --- | --- | --- | --- | --- |
| Solo | 249 | none | 366 | 380 | 380 (cap 15, no change; still not for paid ads) |
| Starter | 599 | 499 | 469 | **522 (above the offer)** | 489 with 40 AI calls |
| Growth | 999 | 849 | 802 | **931 (above the offer)** | 804 with 120 AI calls |
| Pro | 1,999 | 1,799 | 1,705 | **2,074 (above the normal price)** | 1,599 with 300 AI calls |

Floors are approximate (rebuilt from the section 14 method; they reproduce the old numbers within a few rupees).
At typical use (40 percent of caps) the tech cost per gym a month is about Solo Rs 23, Starter Rs 52, Growth Rs 121, Pro Rs 310 (Assumption).

## What this means

- The approved prices (D-10) are safe at typical use. They are not safe at full use of today's AI caps on Starter offer, Growth offer and Pro, because the 10 times safety factor on nano calls is now larger in rupees.
- PRICE-02 (Tier 3, plan limits, needs Mohamed): set AI calls a month to Solo 15, Starter 40, Growth 120, Pro 300. Then every offer and normal price sits above its floor even at full use.
- Until Mohamed answers, `server/config/plans.js` is unchanged (Solo 15, Starter 60, Growth 200, Pro 600).
- The 10 times factor is a guess. After one week of real use, read tokens per call from the `AiUsage` rows (model, inTokens, outTokens, written by AI-00) and replace it with the measured number (task 1E-05).

## Central caps for every product

- Per-plan monthly AI caps live in each product's plan file; the same `AiUsage` collection and provider layer serve all products.
- Super Admin shows usage per business and per product (SA-03), a platform daily budget stop (to be built: when the day's token total passes a set limit, AI switches to the free fallback), and the real token and rupee cost per call.
- Hard backstop outside our code: a monthly spend limit in the OpenAI dashboard (Dev Task A-11).
