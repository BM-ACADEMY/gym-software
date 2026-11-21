# Afra Ventures product suite: scope index

Written 28 Oct 2026. Owner decision (D-09): every product launches as real, competitive software, planned the way the gym was.
No demo-only or waitlist-only launches. Owner target dates below are Mohamed's; Claude's date confidence is reported in each Daily Brief.

| # | Product | Address (working) | Owner target: phase 1 starts (invite-only, 3 to 10 real businesses) | Scope file |
| --- | --- | --- | --- | --- |
| 1 | Gym | fit.afraventures.in | 10 Nov 2026 | `docs/SCOPE.md` |
| 2 | Salon, Spa, Barber (one product, 3 presets, D-11) | groom.afraventures.in | 13 Nov | `docs/products/salon/SCOPE.md` |
| 3 | Mini Mart / kirana | mart.afraventures.in | 16 Nov | `docs/products/mart/SCOPE.md` |
| 4 | Restaurant, Cafe and Pub (pub is a mode) | dine.afraventures.in | 19 Nov | `docs/products/dine/SCOPE.md` |
| 5 | Textile and garment retail | cloth.afraventures.in | 22 Nov | `docs/products/cloth/SCOPE.md` |
| 6 | Car wash and detailing | wash.afraventures.in | 25 Nov | `docs/products/wash/SCOPE.md` |
| 7 | Recruitment agency | hire.afraventures.in | 28 Nov | `docs/products/hire/SCOPE.md` |

Shared foundation for all of them: `docs/products/CORE.md`. Nothing in a product file may duplicate a core module.

## Rules that apply to every product (from the gym, do not relax)

1. Autopilot: sign-up, set-up, payment, help and renewal need no Afra person.
2. Every query on tenant data filters by tenant; every new route has a test (`CLAUDE.md`).
3. Every AI and WhatsApp feature has a per-plan monthly cap, a per-business usage view, a platform daily budget stop and a spend limit in the OpenAI dashboard (D-13).
4. Marketing says only what is built and tested by a human (`MARKETING_CLAIMS.md` for each product).
5. "Written, not yet tested" until a human runs it. A product reaches "invite-only start" only when its QA gate is green.
6. Prices here are drafts. Only the gym ladder is approved (D-10); the shop ladder needs the same cost check before each launch.
7. One WhatsApp number (Afra Ventures) at the start, template names prefixed by product (D-12).
8. Every claim in a scope file is tagged Fact (with source), Assumption, or Decision.

9. Business autopilot (watch, act, report for the owner) follows `docs/products/AUTOPILOT.md`: suggest by default, auto-send only when the owner switches a job on.

## Common phase structure (same as the gym)

- Phase 1: the scope file's "Phase 1 must-have" list. Gate: product QA workbook all P1 pass, Dev B attack suite clean, 3 to 10 invited businesses.
- Phase 2: the "Phase 2" list in each file (about 4 to 6 weeks after phase 1 start; assumption).
- Phase 3: later items.
