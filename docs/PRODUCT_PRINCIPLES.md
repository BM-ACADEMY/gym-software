# Product principles: what must hit a small business owner (12 Nov 2026)

Owner's brief (Kamar, 12 Nov): every product must help the owner in today's AI world, hit them the way a good salesperson would, and miss nothing. Every line is tagged **Fact** (source), **Assumption** (to check with real owners) or **Decision**. Nothing here is a marketing claim until a human has seen it work (`MARKETING_CLAIMS.md`).

## 1. What the owner is afraid of (Assumption until the owner interviews, SAL-R1 and equivalents)
1. Money leaking: staff taking cash, discounts nobody approved, stock that disappears.
2. Customers who come once and never return.
3. Empty hours and no-shows.
4. GST and bills going wrong; a notice from the department.
5. Being cheated by, or dependent on, one key staff member.
6. No time: the owner is also the cashier, buyer and manager.
7. Falling behind: "AI is coming, everyone else is using it, I will lose customers."

## 2. How each product answers, in the owner's language
| Fear | What the product does (suggest by default, owner switches on sending) |
| --- | --- |
| Leak | Daily "things that look wrong" list: heavy discounts, voided bills, cash that does not match, stock that does not add up (AI-07 pattern) |
| Customers vanish | Who to call back today, with the message already written in Tamil, Hindi or English; one tap to send |
| Empty hours / no-shows | Reminders, small advance for long services, a "fill this slot" message to people due to return |
| GST | Correct bill split by default; monthly summary ready for the CA; nothing filed by us |
| Dependence on staff | Everything is in the owner's phone: today's sales, who sold what, commission worked out, no argument |
| No time | One WhatsApp summary each morning: yesterday's sales, today's bookings, **three things to do today** |
| Falling behind | "Ask your business" in plain words (cap per plan), no setup, no jargon |

## 3. Behaviour rules for every screen and message (Fact: well-known behavioural findings, not tested on our users; treat as design hypotheses)
- **Show the loss in rupees, not the feature.** "Rs 4,800 of regular customers have not been back in 60 days" beats "win-back module". Money is whole rupees with a currency code.
- **First win in five minutes.** The first screen after sign-up must show something true about the owner's own business (the demo-in-5-minutes feature); otherwise the trial dies.
- **Defaults do the work.** Pre-fill from the preset; the owner edits, never builds from empty.
- **One next action.** Every screen ends with one clearly best button. Never a menu of twelve.
- **Small steps, visible progress.** Set-up checklist with a bar (services, staff, first bill, first message sent).
- **Reciprocity before the ask.** Give the daily summary and the win-back list during the trial; the ask to pay comes after the owner has seen a number they care about.
- **Honest scarcity only.** Trial end dates are real. No fake countdowns, no invented "only 3 left".
- **Plain language, local language.** Tamil, Hindi, English; no English-only jargon; large buttons for phones.
- **Trust.** Say what we store and what we never do (no calls by AI, nothing sent without the owner's switch, data export any time).

## 4. AI rules
- Suggest by default; auto-send only when the owner switches a job on (`docs/products/AUTOPILOT.md`).
- Per-plan cap, per-business usage view, platform daily budget stop, spend limit set in the AI provider dashboard (D-13).
- No customer names sent to the model unless the claims file lists it. No medical advice from AI (Clinic). No AI voice calls.
- Every AI suggestion shows its reason ("because she comes every 6 weeks and it has been 9") so the owner can trust or reject it.

## 5. "Are we missing anything?" gate (each product must tick all before invite-only start)
1. Sign-up, trial, payment, renewal, cancel, refund: no Afra person needed.
2. First-win screen with the owner's own numbers.
3. Daily WhatsApp or in-app summary with three actions.
4. Win-back or repeat-purchase list with ready messages.
5. Leak checks suited to that business.
6. Tenant isolation test for every route; plan limit tests; export and delete my data.
7. Tamil, Hindi, English; phone first; installable.
8. Landing page and claims file that match only what was seen working.
9. Everything the owner may want to change is editable without a deploy (D-28).
10. QA workbook and Dev B attack list written; Dev A test steps in plain words.
11. Legal: terms, privacy with AI wording, refund and grievance pages; product-specific lawyer or CA items listed (e.g. clinic records, textile HSN, food FSSAI wording).

## 6. What we cannot finish by writing code (stays on the human list)
Running anything against a real database; Meta template approvals; CA wording on SAC/HSN and invoices; lawyer review; real owner interviews; Dev B attacks; screen tests by staff.

## 7. All-in-one standard (owner, 12 Nov): a business on one of our products needs no other software
Every product covers these eleven areas, in that business's own words. Where a core module already exists (CORE.md) the product uses it; it does not rebuild it.
1. **Accounts:** cash book, day close (cash counted vs expected), expenses by category, supplier dues, customer dues, profit and loss in plain words, GST summary and a CSV or Tally-style export for the CA. We do not file GST (Decision).
2. **Operations:** the daily work of that business (appointments, orders, job cards, stock, tables) with staff roles and permissions, so each person sees only what they need.
3. **Staff:** attendance, shifts, commission or incentive, payslip (core payroll), leave.
4. **Sales and revenue:** bills, split payments, UPI and payment links, returns, discounts with a reason, day, week and month sales by item, staff and hour.
5. **Customers:** phone-keyed record, history, notes, birthdays, loyalty and packages, dues, do-not-contact, import from the old register or sheet.
6. **Appointments or orders:** a booking link or QR, reminders, reschedule and cancel without a phone call, walk-ins.
7. **Marketing:** win-back list with ready messages, festival and season offers, review requests, a shareable page or QR. Suggest first; sending only when the owner switches it on, and only approved WhatsApp templates.
8. **Prediction (estimates, labelled as estimates, Assumption until checked against real data):** next month's sales range from the last months, expected busy and slow days and hours, stock that will run out in N days, customers likely to lapse, cash needed for dues. Always show the reason and the data it used; never present a forecast as a promise.
9. **Alerts and leak checks:** unusual discounts, voids, cash difference, stock mismatch, sudden drop in repeat customers.
10. **Control and safety:** daily and weekly owner summary, audit trail, data export and delete on request, backups, works on a slow phone, installable.
11. **Growth later (not Phase 1):** multiple branches, online ordering or a marketplace, accounting software integrations, e-invoice when a business crosses the limit.

Each product's scope file lists which of these are Phase 1 and which are later; none may be silently dropped. Claude checks this list in every product's QA workbook.
