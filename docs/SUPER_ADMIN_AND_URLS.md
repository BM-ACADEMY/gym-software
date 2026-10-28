# URL map and the Super Admin for all products (plan)

Written 29 Oct 2026. Status: PLAN plus a mock-up screen. Nothing here is built except the gym's own Super Admin. Decisions marked "Mohamed" need his yes (Tier 2/3).

## 1. Address map (proposal)
| Address | What it is | Status |
| --- | --- | --- |
| afraventures.in | Company website: home, about, contact, privacy, terms, refund, grievance, links to each product | Dev A task DOM-4 |
| fit.afraventures.in | Gym: landing page, sign-up and the app (one site). Its API is on the same name under `/api` | Decided (D, 28 Oct); see question below |
| salon / mart / dine / cloth / wash / hire .afraventures.in | Same recipe for each product, one name per product, one local port each | Names are drafts (D-08). The hosting plan says `groom` for the salon product; the DNS list says `salon`. Mohamed decides the name, then both files change |
| admin.afraventures.in | Super Admin for all products (new, section 3) | Plan only |
| app.afraventures.in, staging.afraventures.in | Afra AI OS (internal sales and lead hub) | Exists, separate |
| mail.afraventures.in | Sending domain for system email | Runbook V-07 |
| hire.afraventures.in/share/&lt;secret&gt; | Public client shortlist page | Written |
| hire.afraventures.in/c/&lt;secret&gt; | Candidate consent and details form (Phase 2 of Hire) | Not built |
Question for Mohamed/Dev A: the gym decision of 28 Oct also mentions `api.fit.afraventures.in`. The hosting plan serves the API on the same name. Same name is simpler (one certificate, no cross-site settings). Keep `api.fit` only if Dev A has already set it up.

## 2. What the Super Admin does today
The gym has its own Super Admin inside the gym app: businesses by status, MRR, trials (extend with a reason), plans, coupons, promo codes, AI and WhatsApp usage with the daily budget stop, billing, support tickets, and the new Products & Launch page. It sees gym data only.

## 3. Plan for one Super Admin across all products (Decision needed: Mohamed)
**Stage 1, now.** Each product keeps its own admin screens, built from the shared core where possible. No cross-product screen yet. Reason: only the gym will have real customers for a few weeks, and a big back office built early would be guessed, not learned.

**Stage 2, when the second product is live: `admin.afraventures.in`.** A small separate app with its own sign-in (two-step required, owner and named staff only).
- It reads each product through a server-to-server summary route (the gym already has the same kind of route, protected by `INTERNAL_API_KEY`). Each product returns counts and rupee totals only: businesses by status, trials ending, paid, MRR, AI calls and cost today, WhatsApp sent, open tickets, errors. No customer, member, candidate or resume data crosses.
- Read-only first. Actions (extend a trial, suspend, change a plan) come later as signed calls to the product, each with a reason, written to an audit log in both places.
- Screens: Overview (all products), one page per product, Businesses (product filter), Money (MRR, invoices, failed payments), AI and WhatsApp cost against the daily budget, Support, Launch status (the Products & Launch page moves here), Audit log.
- Keys for each product live in the admin server's settings file only; rotating a key does not need a code change.

**Stage 3, later: shared accounts and billing (backlog C-04).** Plans, billing, caps and usage move into shared packages so a customer who uses two products has one login and one invoice. Do this only after Stage 2 shows what owners actually need.

## 4. Safety rules (apply to every stage)
- Admin is a separate address with its own cookie and no link from product pages.
- Two-step sign-in is required. An optional IP allow-list can be added at the server.
- Every action is audited with who, what, which business and the reason.
- A stolen product key can read counts only; it cannot act.
- The admin screen never shows personal data of customers' customers.
- Written, not yet tested: until a person has run it, it is described as a plan.

## 5. Tasks
SA-10 (Stage 2 design and summary route in the gym), SA-11 (admin app skeleton), SA-12 (per-product summary route in each product), SA-13 (actions with audit). Start SA-10 when Mohamed says yes and the gym tests are green.
