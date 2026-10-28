# Restaurant, Cafe and Pub: scope (pub is a mode)

Address (working): dine.afraventures.in. Owner target: phase 1 invite-only start 19 Nov 2026. Presets: Restaurant/Cafe, Pub/Bar. The master plan placed this later (Phase 3); the owner has now moved it forward (D-09), so the scope below is the smallest version that is still competitive.

## 1. Owner's problem (source: master plan 4.3 and 4.4)
Food cost creeping up unseen, wastage, aggregator commission, staff theft, slow weekdays. Pubs add pilferage and free pours, bottle stock not matching sales, tabs and split bills.

## 2. Evidence
| Item | Type | Detail |
| --- | --- | --- |
| Petpooja claims 75,000 to 100,000+ restaurants | Source | GetApp via master plan; vendor claim |
| Petpooja about Rs 10,000 first year, Rs 7,000 renewal per outlet | Source | Kitchen Business |
| Add-ons push year one to Rs 35,000 to 70,000 | Source | A rival's blog (DineOpen); biased |
| CRM, loyalty and inventory are add-ons; heavy for small cafes | Source | Master plan section 2 |
| Pub peg-level stock exists but is expensive or hardware-based | Source | Petpooja guide |
| State excise and stock register rules differ by state | Fact (stated in master plan) | Do not promise any excise report until a state is confirmed with a CA/lawyer |
| Zomato/Swiggy sync depends on partner access | Assumption | Not in phase 1. First research pass (`RESEARCH.md`): Petpooja lists food-aggregator integrations as a standard feature, so this is the top Phase 2 risk |

## 3. Phase 1 must-have (Restaurant/Cafe)
1. Menu with categories, variants, add-ons, GST rates; QR menu page.
2. Tables, dine-in orders, takeaway, **KOT** to a kitchen screen (browser) and printed KOT (browser print); split bills; hold; discounts with reason.
3. Billing: GST or plain bill, service charge option, cash/UPI/card split, bill copy on WhatsApp.
4. **Recipe costing**: each dish has ingredients; sales deduct stock; **daily food-cost percentage**.
5. Inventory for ingredients: purchases, stock, low-stock, wastage log with reasons.
6. Best and worst dish report (keep, reprice, drop), with the AI explaining it in one paragraph.
7. Customers (phone key), loyalty, birthday messages; **direct-order WhatsApp link** to move regulars off aggregators (owner shares link; orders arrive as a list the owner confirms).
8. Slow-hour offers: AI suggests a window and offer, owner taps to send to past customers (marketing messages prepaid).
9. Staff attendance, shifts, salary (core), expenses, day-end cash closing, owner WhatsApp summary.
10. Leakage alerts: voids, bill edits, heavy discounts, cash short.
11. Ask your business; English, Tamil, Hindi; PWA; CSV export.
14. **CSV import** (items with opening stock, customers with opening balance or points) with a preview before saving: written in `packages/core-pos` (written, not yet tested).

## 4. Phase 1 must-have (Pub/Bar mode, same app)
1. Each drink is a recipe with a measure (peg, ml); every sale deducts from bottle stock; daily variance report (sold vs opened).
2. Bar order tickets separate from kitchen; open tabs; split bills.
3. Happy-hour and ladies-night pricing that switches on by time.
4. Bartender-wise sales, voids, discounts, with alerts.
5. Guest-list/event invite to past customers by WhatsApp (marketing, prepaid).
6. **Not** in phase 1: state excise registers or reports (Tier 3: confirm each state's rules with a professional first). Alcohol sale is regulated; marketing wording to be reviewed by a lawyer before launch (Tier 3). Meta's WhatsApp policy on alcohol messaging must be checked before any bar template is submitted (task DIN-R2; Assumption that it is restricted).

## 5. Phase 2
Captain/waiter handheld app, zomato/swiggy sync (if partner access), kitchen printer direct, multi-outlet, recipe yield and wastage forecasting, shift planning from busy-hour data, table reservations.

## 6. AI and caps
Dish analysis, slow-hour suggestion, Ask your business, anomaly alerts. Monthly caps per plan; scheduled reports stay cheap and unlimited.

## 7. Pricing (draft, not approved)
Rs 499 for a restaurant plan is the master-plan Pro figure; Petpooja renewal is about Rs 583 a month (Rs 7,000 a year), so our price must be shown against it honestly. Claude produces a dine floor-price table (task DIN-P1). Tier 3.

## 8. External dependencies
Meta templates `dine_*`; lawyer on alcohol marketing and excise; FSSAI details on bill (owner enters); CA on restaurant GST (5 percent no-ITC vs others; confirm) .

## 9. QA gate
KOT flow tests on two real devices, split-bill maths, recipe deduction maths, variance report on a seeded night, time-based pricing, tenant isolation, plan limits. Invite-only start when P1 pass and 3 to 10 pilot venues found.

## 10. Backlog IDs
DIN-01 to DIN-16 (restaurant 11 + pub 5). Status of all: TODO.

## 11. Autopilot and owner reports (Decision to include, Assumption on the rules until owner interviews)
Same switch model as every product (`docs/products/AUTOPILOT.md`): off / suggest (default) / auto inside the app / auto send. Guardrails: this business's data only, customer consent, quiet hours, daily send limit, activity log, pause switch, plan caps, no voice calls.
- **Watches:** Slow items, stock for tomorrow, table turn time, bad reviews if connected
- **Acts:** Prep and purchase list (1); regular-guest offers (3)
- **Reports to the owner:** Daily sales by hour and item, wastage, weekly summary
- Reports and switches show in this product's own admin panel (manifest-driven) and the product counts show in Super Admin.
- Not promised on the landing page until a human has seen it work.

## 12. Marketing suggestions for the owner (Decision 29 Oct, build later)
See `docs/SUPER_ADMIN_AUTOPILOT.md` section 4 for this product's list. Owner confirms; nothing auto-posts or auto-sends in phase 1.
