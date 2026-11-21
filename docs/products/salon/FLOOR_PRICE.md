# Salon and Clinic floor price (SAL-P1, draft, 12 Nov 2026)
Full method, inputs and sources: `docs/products/FLOOR_PRICES.md`. Not approved (Tier 3); no price or cap in code has changed.

| Plan | Price (before GST) | AI cap | Floor at full use | Above floor? |
| --- | --- | --- | --- | --- |
| Starter | 149 | 30 | 49 | yes |
| Growth | 299 | 100 | 165 | yes |
| Pro | 499 | 300 | 494 | barely; **no if GST is included** |

- Suggestion: Pro AI cap 300 to 200 (floor 329).
- Clinic is a preset (D-29): same plans, same floors. No medical advice from AI.
- WhatsApp reminders are not in any plan; a small allowance on Growth and Pro is an owner choice (section 5 of the main file).
- Rs 149 pays back a Rs 3,000 sales cost in about 21 months; with field agents at Rs 800, about 5.6 months (Assumption, churn unknown).
- Open: one GST rule across products (code stores before GST; master plan says GST included).
