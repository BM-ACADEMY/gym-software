# Dine: items only a CA or a lawyer can settle (Tier 3). Nothing here is decided by the code.

Written 12 Nov 2026. Until each item has a written answer, the app shows the default shown and nothing is marketed on it.

## CA (restaurant GST and invoices)
| # | Question | What the app does today |
| --- | --- | --- |
| D-CA1 | Which GST profile applies to the owner (flat 5 percent without input credit, rates per item, or not registered)? Conditions, thresholds, composition scheme? | Three profiles: per item, flat 5, none. Default is **none** (plain bill). The bill screen says "GST profile is not yet confirmed by your CA" for the other two |
| D-CA2 | Service charge: allowed as a default? GST on it? Wording on the bill | Optional percent 0 to 20, default 0. Added after GST with **no GST on it**; the CA must say if that is wrong |
| D-CA3 | HSN/SAC and wording on the bill ("Tax invoice" vs "Bill of supply") | Not printed. Item HSN field exists in core-pos but is unused |
| D-CA4 | Takeaway, delivery and aggregator orders: same rate? | Same as dine-in. Aggregators are Phase 2 |
| D-CA5 | Alcohol: state VAT/excise on bar sales; how the owner should bill it | Liquor lines get **GST 0** and are tagged `stateTax: owner`. No VAT line exists yet. Pub mode is off by default and is a Pro-plan feature |
| D-CA6 | GST summary and CA export columns: what does your CA want? | Date, bill no, taxable, CGST, SGST, IGST, total. It is not a return and says so |
| D-CA7 | Is the draft price ladder (Rs 299 / 499 / 899) fine to charge, and SAC code for our own invoices (M-04) | Draft only, not approved |

## Lawyer
| # | Question | What the app does today |
| --- | --- | --- |
| D-LW1 | Alcohol marketing wording and state rules (pub mode) | No WhatsApp suggestion may name liquor; `blockedForPub` text check exists; no alcohol template will be submitted (DIN-R2) |
| D-LW2 | Excise registers and stock reports by state | **Not built, not promised.** Bottle variance is the owner's own stock check only |
| D-LW3 | FSSAI licence number and wording on the bill | Owner types it (field not built yet; Phase 2). We do not verify it |
| D-LW4 | Customer data: consent text for phone numbers, birthdays, marketing messages; do-not-contact | Phone is the key, do-not-contact is respected by win-back and lapse lists; consent text is not written yet |
| D-LW5 | Staff punches (attendance) and employee data notice | Punch in/out is stored with the user id only |
| D-LW6 | Terms, privacy (AI wording), refund and grievance pages for Dine | Reuse the company pages once approved |

## Meta
| # | Question |
| --- | --- |
| D-ME1 | Templates `dine_winback`, `dine_slow_hour`, `dine_review` named in code are not submitted. Submit only after Mohamed's approval of the exact text. `dine_*` for bar offers: not to be submitted until DIN-R2 is answered |
