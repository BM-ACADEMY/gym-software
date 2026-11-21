# Wash floor price (WSH-P1, draft, 12 Nov 2026)
Full method, inputs and sources: `docs/products/FLOOR_PRICES.md`. Not approved (Tier 3); no price or cap in code has changed.

| Plan | Price (before GST) | AI cap | Photos a month | Storage a month (12 months kept) | Floor at full use | Above floor? |
| --- | --- | --- | --- | --- | --- | --- |
| Starter | 149 | 20 | 100 | Rs 0.45 | 34 | yes |
| Growth | 299 | 80 | 400 | Rs 1.8 | 134 | yes |
| Pro | 499 | 250 | 1,500 | Rs 6.8 | 421 | yes (16% room) |

- Storage uses the Cloudflare R2 price as a reference (Fact: $0.015 per GB-month, free egress); the real storage account is not chosen.
- It holds **only if photos are compressed to about 300 KB**. At 3 MB a photo, Pro storage is about Rs 70 a month and its floor about 507, above the Rs 499 price. Build rule: compress on upload, keep 12 months at most.
- No WhatsApp in any plan. GST rule not decided (code stores before GST).
