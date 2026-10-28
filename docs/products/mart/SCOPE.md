# Mini Mart / Kirana: scope

Address (working): mart.afraventures.in. Owner target: phase 1 invite-only start 16 Nov 2026.

## 1. Owner's problem (source: master plan 4.2)
Thin margins, expiry and dead stock, udhaar (credit) that never returns, supplier price creep, customers drifting to quick-commerce apps.

## 2. Evidence
| Item | Type | Detail |
| --- | --- | --- |
| About 13 million kirana stores, about 1.4 million digitised | Source | Commmerce briefing citing AICPDF, via master plan |
| Competitors Vyapar, myBillBook, Zoho Books, GoFrugal, Busy; tools from about Rs 2,000 to 20,000 a year | Source | Commmerce 2026 roundup, via master plan |
| Billing is solved; AI reorder, expiry clearance, udhaar recovery, WhatsApp are not | Source/Assumption | First pass 28 Oct (`RESEARCH.md`): billing is cheap or free (Swipe free plan, others about Rs 800 to 5,400 a year) and offline billing exists at competitors; the AI and udhaar parts were not on the pages read. Per-vendor feature pages still open (MRT-R1) |
| Only 3 to 13 percent of kiranas tech-enabled in an old estimate | Source | RedSeer via Quartz; old data |
| Billing must work with weak internet | Assumption | Field-agent feedback needed |

## 3. Phase 1 must-have
1. Sign-up, trial, pick "Mart" preset: categories, GST slabs, units (kg, g, piece, litre).
2. **Fast billing**: scan (phone camera, USB or Bluetooth scanner) or search by name/code; quantity/weight entry; hold bill; returns; discounts; GST bill or plain bill by owner choice (composition and tax-inclusive options); split cash/UPI/card; bill copy on WhatsApp; PDF/print.
3. **Offline billing** that syncs later (needs a human offline test; see CORE.md risks).
4. Item master: barcode, own label printing for loose items, units, purchase and sale price, GST rate, category, expiry/batch.
5. Stock in/out, low-stock alert, expiry alert, supplier purchase entry.
6. **Purchase bill by photo**: AI reads the supplier bill, shows lines for the owner to correct, then updates stock and cost price. Never auto-saves without confirmation.
7. **AI reorder list** from sales history (simple rule first: days of stock left; festival calendar uplift as a second step). Marked clearly as a suggestion.
8. **Udhaar ledger**: customer credit with limit, due list, polite WhatsApp reminder templates (utility), payment recording.
9. Customers (phone key), loyalty points, WhatsApp offers to regulars (marketing messages are prepaid packs).
10. Expiry clearance: list of items near expiry with a suggested discount and a one-tap message to regulars.
11. Daily report: sales, profit by category, cash vs UPI, low stock, udhaar due. Owner WhatsApp summary.
12. Staff attendance and salary (core), expenses, day-end cash closing.
13. Ask your business (AI on own data). English, Tamil, Hindi; PWA; CSV export.

## 4. Phase 2
Weighing-scale integration, WhatsApp catalogue and order taking for regulars, supplier rate comparison, direct thermal printer, multi-branch, e-way/GST filing help (CA review), delivery planning.

## 5. AI and caps
Bill photo reading is the costly call (vision). Per-plan monthly cap on bill photos; fallback is manual entry. Daily platform budget stop applies.

## 6. Pricing (draft, not approved)
Rs 149 / 299 / 499 draft ladder. First research pass says billing-only competitors cost Rs 0 to 5,400 a year, so this ladder is not cheaper on billing; a free entry tier with paid AI/WhatsApp is the proposal for MRT-P1 (not approved). A kirana can trial and quit easily, so the cost per shop must be measured in week one. Claude produces a mart floor-price table (task MRT-P1) before 16 Nov. Tier 3: Mohamed approves.

## 7. External dependencies
Meta templates `mart_*`; a real barcode scanner, phone and thermal printer for testing (Dev task); CA on GST bill formats for composition dealers (Tier 3).

## 8. QA gate
Billing maths (GST, discounts, rounding, returns), offline sync conflict test, bill photo accuracy test on 20 real supplier bills (target set by Dev A, Assumption), udhaar balance tests, tenant isolation, plan limits. Invite-only start when P1 pass and 3 to 10 pilot marts are found.

## 9. Backlog IDs
MRT-01 to MRT-13 map to the phase 1 list. Status of all: TODO.
