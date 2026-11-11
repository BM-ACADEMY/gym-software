# Mart floor price (MRT-P1, draft, 12 Nov 2026)
Full method, inputs and sources: `docs/products/FLOOR_PRICES.md`. Not approved (Tier 3); no price or cap in code has changed.

**Mart fails its floor at full use today.** Cause: bill-photo reading (Assumption: Rs 6.07 per photo at 10 times safety on the mini model).

| Plan | Price (before GST) | Caps now (AI, photos) | Floor now | Suggested caps (AI, photos on nano) | Floor with them |
| --- | --- | --- | --- | --- | --- |
| Starter | 127 | 30, 15 | 176 | 30, 30 | 119 |
| Growth | 254 | 100, 60 | 669 | 80, 50 | 247 |
| Pro | 423 | 300, 150 | 1,755 | 150, 75 | 421 (tight) |

- If photos need the mini model for accuracy, photo caps that fit are about 9 / 14 / 20.
- Dev A: read one real supplier bill on each model; report tokens and correctness before caps are final.
- Mart is the only product whose code already assumes the master-plan "GST included" ladder (127 plus GST is about 150). Decide one GST rule for all products.
- A free entry tier is proposed but not built; it needs its own cost check. No WhatsApp in any plan (prepaid packs, not built).
