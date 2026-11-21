# Cloth floor price (CLO-P1, draft, 12 Nov 2026)
Full method, inputs and sources: `docs/products/FLOOR_PRICES.md`. Not approved (Tier 3); no price or cap in code has changed.

| Plan | Price (before GST) | AI cap | Floor at full use | Above floor? |
| --- | --- | --- | --- | --- |
| Starter | 149 | 30 | 49 | yes |
| Growth | 299 | 120 | 198 | yes |
| Pro | 499 | 300 | 494 | barely; **no if GST is included** |

- Suggestion: Pro AI cap 300 to 200 (floor 329).
- Variant limits (500 / 3,000 / 20,000) and staff limits cost nothing in this model (Assumption: database size is small per shop).
- The code comment says "GST extra here"; the master plan says "GST included". Decide one rule for all products.
