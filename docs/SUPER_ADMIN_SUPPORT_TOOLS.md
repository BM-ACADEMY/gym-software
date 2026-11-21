# Super Admin support tools: design for approval (SA-06 plan overrides, SA-07 view-as-gym)

Written 2 Nov 2026. **Not built.** Both touch real customers' accounts or data, so they are Tier 3 (docs/OPERATING_RULES.md). This file prepares everything up to the approval point.

## SA-06 Plan and limit overrides per business
**What:** Kamarudeen (owner role only) can give one business a different plan limit or switch a feature on or off for it (for example "extend this trial by 7 days", "allow 300 members on Starter for a month"). Each change needs a written reason and an end date, and appears in the audit trail.
**How (proposal):**
- Each product keeps its own `overrides` list per business: `{ key, value, reason, setBy, setAt, endsAt }`. The product's billing code reads it when it works out limits (`packages/core-billing` gets one new input).
- Super Admin calls a product route behind `INTERNAL_API_KEY`: `POST /api/internal/override` (set) and `DELETE` (remove). The product validates the key name against a fixed list, caps the value, and refuses an `endsAt` more than 90 days away.
- Only the owner role can use it (not the DM team). Every set and remove is written to both the product audit log and the Super Admin audit trail.
**Risks:** a wrong override gives away paid features; a leaked internal key could set overrides. Mitigation: fixed key list, caps, 90-day limit, key only in server settings, Dev B attacks the route.
**Decision needed (Tier 3):** which limits may be overridden (suggest: trial days, member cap, AI calls a month; never prices or GST), and the largest allowed extension.

## SA-07 View-as-business for support
**What:** support sees a business's screens read-only to help with a problem.
**The problem:** this lets staff see customers' members, phone numbers, payments and (in Hire) candidates' personal data. Under India's Digital Personal Data Protection Act this needs a clear purpose, minimum access and a record. The lawyer should confirm the wording in the privacy notice before it is switched on.
**Safer proposal (no member data):** instead of showing the real screens, a "support snapshot" per business with counts and settings only: plan status, limits and use, last sign-in, feature flags, last 20 error codes, WhatsApp and AI counts. This solves most support calls with no personal data. The health page (SA-01) is the first step towards this.
**If full view-as is still wanted:** read-only; owner role only; the business owner must switch on "allow support access" for 24 hours; every page view logged; sensitive fields (phone, email, amounts) masked by default; lawyer-approved notice.
**Decision needed (Tier 3):** snapshot only (recommended), or full view-as with owner permission; and lawyer's view on the notice (add to the M-15 questions).

## Order if approved
1. SA-07 snapshot (counts only): small, no personal data, can start without the lawyer.
2. SA-06 overrides: after the limits list is approved.
3. Full view-as: only after the lawyer's written approval is filed.
