# Super Admin autopilot: marketing and growth suggestions (plan)

Status: planned, not built. Decision by Mohamed (29 Oct): Super Admin should suggest marketing work (notifications, to-dos, calendar, session plans); Mohamed confirms; nothing goes out without his OK.
Confirmed by Mohamed (29 Oct): notifications are phone push notifications only (no SMS or email for this).

## 1. What it does (same watch / suggest / confirm pattern as product autopilot)
| Piece | What the owner sees | Example (Assumption until used) |
| --- | --- | --- |
| Morning brief | One screen, 5 items max: what to do today across all products | "Hire: 3 agencies in trial end this week. Send the help message. [Approve] [Skip]" |
| Marketing to-do list | Web checklist, each item with a reason, owner (Mohamed/designer/dev) and due date | "Post 1 short video: how Hire reads a resume (needs a fake-data screen recording)" |
| Calendar | Month view: festivals, product launches, posts, campaigns, sessions | Pongal, Diwali, Ramzan/Eid, Christmas, New Year, exam seasons (dates checked every year, not hardcoded) |
| Session plan | A weekly plan for Mohamed's time: calls with owners, content, follow-ups | "Tue 10-11: call 3 gym owners about renewals (list below)" |
| Push notification | Phone alert only for things that need a decision today | "2 trials expire tomorrow", "AI budget 80% used", "a test failed" |
| Growth numbers | Sign-ups, trials started, trials converted, churn, AI cost per product (counts only) | Pulled from each product's summary route |

## 2. Rules (guardrails)
- Suggest only. Mohamed confirms every outward action. Nothing is posted, sent, or paid for automatically in phase 1.
- No spending, no price changes, no deleting, no AI voice calls.
- Suggestions follow `docs/BRAND_AND_TAGLINES.md` section 4 (no claims a person has not seen working, no unverified competitor facts, no real customer data or testimonials without permission).
- Customer or candidate personal data never goes into a suggestion; counts and product-level numbers only.
- Every suggestion shows why it was made and what data it used; Approve / Edit / Skip / Snooze; all choices logged.
- Quiet hours for push (default 9 pm to 8 am IST); at most 3 pushes a day.
- AI use counts against the platform daily AI budget.

## 3. Where it lives
- Super Admin app (`apps/admin`), new manifest pages: Today, Marketing to-do, Calendar, Session plan, Growth, Settings (push, quiet hours, limits).
- Data: a `marketing_items` and `marketing_events` collection owned by the admin app (not product tenant data). Fields: title, reason, product, status (suggested / approved / done / skipped), due date, owner, source.
- Suggestions come from rules first (trial ending, no sign-ups this week, festival in 14 days, a product reaching a launch date); AI only writes the wording and gets no personal data.
- Push: web push from the admin web app (phone gets it as an installed web app). No new paid service without Mohamed's OK.

## 4. The same idea inside each product (for the shop owner, not for Mohamed)
Added to each product scope as "Marketing suggestions" (owner confirms; nothing auto-posts):
| Product | Owner sees |
| --- | --- |
| Fit | Festival and new-year offer ideas, "bring a friend" idea when joins are slow, message draft to lapsed members |
| groom | Slow-day offer, festival and wedding-season package ideas, review request after a visit |
| Mart | Festival stock reminders, weekly offer on slow items, message draft for udhaar dues |
| Dine | Slow-hour special, festival menu idea, "dish of the day" post text |
| Cloth | Festival and wedding-season stock plan, clearance idea for stuck stock |
| Wash | Rainy-day or weekend offer, "due for next wash" campaign |
| Hire | Client outreach reminders when a client has no open job, "candidates available" summary to clients |
Same guardrails: owner confirms, consent and quiet hours apply, daily send limit, plan caps, activity log.

## 5. Build order (written here; none built)
1. SA-13 marketing_items store + Today and To-do pages (manifest) + approve/skip logging + tests.
2. SA-14 calendar (festival list as editable data, Mohamed edits dates) and session plan page.
3. SA-15 rule-based suggestions (trial ending, flat sign-ups, upcoming festival, launch date) with test per rule.
4. SA-16 AI wording for suggestions (budget-checked, no personal data).
5. SA-17 push notifications (web push, quiet hours, 3 a day cap).
6. AP-02 owner-side marketing suggestions per product on `core-autopilot`.

## 6. Answers (Mohamed, 29 Oct)
- Notifications: phone push only.
- Channels: all (Instagram, YouTube, WhatsApp channel, others as they come). Each to-do item names its channel.
- Content: Mohamed's digital marketing (DM) team makes and posts it. Claude drafts the wording and plan; the DM team is the owner on to-do items by default; Mohamed approves.
- Implication: the to-do list needs a DM team login (role "marketing": sees and updates the to-do list, calendar and drafts; cannot see money, accounts or product data). Added as SA-18.

## 7. Still open (not blocking)
- Names and number of DM team members (for logins, M-ticket for Mohamed).
- Brand assets the DM team uses (logo, colours) come from the UI designer (M-19).
