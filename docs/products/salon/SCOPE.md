# Salon, Spa and Barber: scope (one product, three presets)

Address (working): groom.afraventures.in. Owner target: phase 1 invite-only start 13 Nov 2026. Decision D-11 (one product, three presets) is waiting for Mohamed's OK; Claude plans one product. Spelling: "salon".

## 1. Owner's problem (source: master plan 4.1)
Empty slots from no-shows, customers who come once and vanish, staff who take clients away, commission arguments, software that charges per staff login.

## 2. Evidence
| Item | Type | Detail |
| --- | --- | --- |
| Competitors Dingg, MioSalon, Invoay, Salonist at Rs 800 to 2,500 a month plus Rs 200 to 500 per extra staff login | Source | CodingClave, via master plan section 2; vendor pages, not audited |
| Marketing and win-back weak or paid extra | Source | master plan section 2 |
| Our price band Rs 149 to 499 is a 70 to 88 percent cut | Fact (arithmetic) | Not yet approved: the shop ladder needs a cost check (D-10 covers gym only) |
| Live comparison of each competitor's current feature list | Source (first pass, 28 Oct) | Invoay, SalonBoost, Easy Salon read; see `RESEARCH.md`. Vendor pricing pages and owner interviews still open (SAL-R1) |

## 3. Presets
Salon (hair, skin, nails), Spa (long services, rooms, therapist slots, packages), Barber/Grooming (fast walk-in queue, short services, shaving/beard add-ons). Preset sets the service list, durations, GST/SAC defaults, queue vs appointment default and message wording.
14. **CSV import** (items with opening stock, customers with opening balance or points) with a preview before saving: written in `packages/core-pos` (written, not yet tested).

## 4. Phase 1 must-have (invite-only start)
1. Sign-up, 14-day trial, business-type pick, preset pre-fills services (core).
2. Services and price list; staff list with **unlimited staff logins at one price**.
3. Appointments: day view per staff, walk-in queue, booking by owner/staff, booking link for customers, WhatsApp confirmation and reminder (template), one-tap reschedule/cancel.
4. No-show control: optional small advance by UPI/Razorpay link for long services (owner sets rule).
5. Billing: service + product lines, staff on each line, GST or plain bill by owner choice, split payments (cash/UPI/card), discounts with reason, bill copy on WhatsApp.
6. Customers: phone-keyed record, visit history, notes, preferred staff, birthday/anniversary.
7. Loyalty points (core) and packages/memberships with balance (core).
8. Staff commission and incentive rules per service/staff, auto-calculated, payslip (core payroll).
9. Rebooking nudge by service cycle (haircut about 4 to 6 weeks, colour about 8, facial about 4; defaults from master plan, owner can edit; Assumption: cycles).
10. Owner daily summary on WhatsApp; "who has not visited in 60 days" win-back list with one-tap message (the demo-in-5-minutes feature from master plan section 5).
11. Product consumption per service to catch stock leakage (simple: service uses N units of item).
12. Ask your business (AI on own data) and Renewal-style AI: "who to bring back today, with message" (shared with gym AI-01 pattern). Caps per plan.
13. English, Tamil, Hindi UI; PWA install; data export CSV.

## 5. Not in phase 1
Customer photos before/after (Phase 2), online prepaid bookings marketplace, bridal/event multi-day booking (Phase 2), WhatsApp booking chatbot for customers (Phase 2, needs live WhatsApp), thermal printer direct (Phase 2), multi-branch (Pro, Phase 2).

## 6. AI features and caps
Win-back list and message writer, rebooking nudges, Ask your business, weekly owner coach. Per-plan monthly caps in the plans file; no member/customer names sent to the model unless the claims file lists it.

## 7. Pricing (draft, not approved)
Shop ladder Rs 149 / 299 / 499 GST included is the master-plan draft. It works only if each shop's cost to win stays well under Rs 3,000 (field agents at Rs 800) and WhatsApp stays prepaid. Claude produces a salon floor-price table before 13 Nov, as was done for the gym (task SAL-P1). Tier 3: Mohamed approves.

## 8. External dependencies
Meta WhatsApp approval and templates `salon_*` (shared Afra number, D-12); Razorpay (existing); CA on SAC codes for salon and spa services (Tier 3).

## 9. QA gate
Product QA workbook (to be written by Claude, same layout as the gym workbook): booking clash tests, commission maths, GST split, loyalty balance, tenant isolation, plan limits. Dev B attack list reused. Invite-only start only when all P1 pass and 3 pilot salons are identified by the owner/agents.

## 10. Backlog IDs
SAL-01 to SAL-14 map to the 13 phase 1 items above; created in `docs/BACKLOG.md` when core packages exist (C-02). Status of all: TODO.

## 11. Autopilot and owner reports (Decision to include, Assumption on the rules until owner interviews)
Same switch model as every product (`docs/products/AUTOPILOT.md`): off / suggest (default) / auto inside the app / auto send. Guardrails: this business's data only, customer consent, quiet hours, daily send limit, activity log, pause switch, plan caps, no voice calls.
- **Watches:** Customers not back in their usual gap, tomorrow's no-show risk, low stock, idle slots
- **Acts:** Rebooking nudges, appointment reminders (3); staff tasks (2)
- **Reports to the owner:** Daily sales and bookings, weekly top services and staff, slow hours
- Reports and switches show in this product's own admin panel (manifest-driven) and the product counts show in Super Admin.
- Not promised on the landing page until a human has seen it work.

## 12. Marketing suggestions for the owner (Decision 29 Oct, build later)
See `docs/SUPER_ADMIN_AUTOPILOT.md` section 4 for this product's list. Owner confirms; nothing auto-posts or auto-sends in phase 1.
