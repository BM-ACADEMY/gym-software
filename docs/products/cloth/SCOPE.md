# Textile and Garment Retail (billing and stock): scope

Address (working): cloth.afraventures.in. Owner target: phase 1 invite-only start 22 Nov 2026.

## 1. Owner's problem (source: master plan 4.5)
Money stuck in unsold sizes and colours, big swings around festivals and seasons, exchanges, alterations, credit to regular buyers.

## 2. Evidence
| Item | Type | Detail |
| --- | --- | --- |
| Competitors: Vyapar garment billing, Busy, Marg-type tools, same price range as retail billing | Source | Master plan section 2 |
| Size/colour variants and season forecasting are thin in general tools | Source/Assumption | First pass 28 Oct (`RESEARCH.md`): variants, barcodes and exchange are standard at myBillBook, Vyapar and Busy, so the variants claim is NOT supported. Season forecasting and stuck-stock advice were not on the pages read. CLO-R1 still open |
| Festival demand swings (Pongal, Deepavali etc.) | Assumption | Founder knowledge; validate with 3 pilot shops' last-year sales |

## 3. Phase 1 must-have
1. Sign-up, trial, "Cloth" preset (categories: saree, shirt, kids, inner wear, fabric by metre; GST slabs by price band as per current rules, CA to confirm).
2. **Item with variants**: design/style, size, colour, MRP, cost, barcode per variant; bulk add by grid (sizes x colours).
3. **Barcode label printing** (PDF sheet for common label sizes) and scan billing (camera, USB, Bluetooth).
4. Billing: GST or plain bill, retail and wholesale price lists, discount with reason, split payment, hold, bill copy on WhatsApp, offline billing with later sync.
5. **Exchange and return** tracking (against old bill, credit note or new item, reason).
6. **Alteration jobs**: tailoring/alteration order with ready date and "your item is ready" WhatsApp.
7. Customer record with remembered sizes, purchase history; credit (udhaar) ledger for regulars with limits and reminders.
8. Stock by variant, low-stock, **slow-mover report** with markdown suggestions before season end.
9. Supplier purchases, supplier dues, cheque reminders, agent commission.
10. Loyalty points (core), festival offers to past buyers (prepaid marketing messages).
11. **Festival and season forecast** from last year's sales: Phase 1 is a simple rule (last year's same-window sales plus growth percent the owner sets); AI explanation on top. Needs one year of data, which new shops will not have, so import of past sales (Excel) is part of set-up.
12. Daily report, staff attendance and salary, expenses, day-end closing, Ask your business, Tamil/Hindi/English, PWA, CSV export.

## 4. Phase 2
Fabric by metre with roll tracking, multi-branch/godown transfer, e-way bill help, tailoring workshop workflow, direct thermal/label printer, marketplace listing export.

## 5. AI and caps
Slow-mover and festival suggestions, Ask your business, purchase bill photo reading (shared with Mart, same caps). Platform daily budget stop applies.

## 6. Pricing (draft, not approved)
Rs 149 / 299 / 499 draft. Textile shops hold large stock, so Rs 299 to 499 should be easy to justify, but untested. Claude produces a cloth floor-price table (CLO-P1). Tier 3.

## 7. External dependencies
Label printer and scanner for tests; CA on GST rate rules by invoice value and composition; Meta templates `cloth_*`.

## 8. QA gate
Variant grid creation, label print scan test with a real scanner, exchange/credit-note maths, alteration status flow, forecast rule test with seeded data, tenant isolation, plan limits. Start when P1 pass and 3 to 10 pilot shops found.

## 9. Backlog IDs
CLO-01 to CLO-12. Status of all: TODO. It shares the POS, inventory and purchase-bill modules with Mart, so Mart's C-02 work comes first.
