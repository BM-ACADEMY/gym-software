# Car Wash and Detailing: scope

Address (working): wash.afraventures.in. Owner target: phase 1 invite-only start 25 Nov 2026.

## 1. Owner's problem (source: master plan 4.6)
Idle bays, customers who do not return, attendants under-reporting cash, pricing by vehicle size.

## 2. Evidence
| Item | Type | Detail |
| --- | --- | --- |
| Mostly global tools (WashPro from USD 9.99 a month, Washa about EUR 50), priced in USD/EUR | Source | Slashdot, Capterra via master plan |
| No clear India-first, rupee-priced, WhatsApp-led leader found | Source (absence in a limited search) | Treat as weak evidence; widen search in task WSH-R1 |
| Number of car wash businesses in India | Not known | Do not quote a number until sourced |

## 3. Phase 1 must-have
1. Sign-up, trial, "Wash" preset: vehicle classes (bike, hatchback, sedan, SUV, others), services, add-ons (wax, interior, engine, underbody).
2. **Vehicle record by number plate** (phone key plus plate); owner can add several vehicles per customer.
3. **Job board**: waiting, washing, ready, delivered; assign attendant; timer per job; "Your car is ready" WhatsApp.
4. **Price by vehicle class** with add-on upsell prompt at job creation.
5. **Before and after photos** per job (phone camera), kept to settle damage claims; storage cap per plan (storage costs are real).
6. **Monthly pass**: N washes per month for a vehicle, balance shown, reminder when the next wash is due or pass expires, renewal via Razorpay link.
7. Billing: GST or plain bill, cash/UPI/card, bill copy on WhatsApp.
8. **Attendant commission** per job and day-end **cash closing** that compares jobs billed with cash declared (the leakage check).
9. Customers, loyalty (core), win-back for vehicles not seen in N days, review request after delivery.
10. Daily owner WhatsApp summary: jobs, revenue, idle hours, cash vs UPI, attendant ranking.
11. Staff attendance and salary (core), expenses, Ask your business, Tamil/Hindi/English, PWA, CSV export.

## 4. Phase 2
Vehicle number recognition from camera, online booking link, multi-bay scheduling, fleet/corporate accounts, water and consumables tracking, pickup-and-drop.

## 5. AI and caps
Idle-hour offer suggestions, win-back messages, Ask your business. Photo storage and AI calls have per-plan caps.

## 6. Pricing (draft, not approved)
Draft Rs 149 / 299 / 499. Global rivals cost USD 10 and more, so even Rs 299 is a large cut, but that is a price comparison, not proof of demand. Claude produces a wash floor-price table (WSH-P1), including photo storage cost. Tier 3.

## 7. External dependencies
Cloud file storage account for photos (Tier 3, cost to be added to the model); Meta templates `wash_*`; CA on SAC code for car wash services.

## 8. QA gate
Job flow tests on a phone in real conditions (wet hands, bright sun: large buttons), photo upload on weak network, monthly pass balance maths, commission and cash closing maths, tenant isolation, plan limits. Start when P1 pass and 3 to 10 pilot washes found.

## 9. Backlog IDs
WSH-01 to WSH-11. Status of all: TODO.

## 11. Autopilot and owner reports (Decision to include, Assumption on the rules until owner interviews)
Same switch model as every product (`docs/products/AUTOPILOT.md`): off / suggest (default) / auto inside the app / auto send. Guardrails: this business's data only, customer consent, quiet hours, daily send limit, activity log, pause switch, plan caps, no voice calls.
- **Watches:** Customers due for next wash, unpaid jobs, pickup delays
- **Acts:** Wash-due reminders, ready-for-pickup messages (3)
- **Reports to the owner:** Daily jobs and revenue, repeat rate, staff work done
- Reports and switches show in this product's own admin panel (manifest-driven) and the product counts show in Super Admin.
- Not promised on the landing page until a human has seen it work.

## 12. Marketing suggestions for the owner (Decision 29 Oct, build later)
See `docs/SUPER_ADMIN_AUTOPILOT.md` section 4 for this product's list. Owner confirms; nothing auto-posts or auto-sends in phase 1.
