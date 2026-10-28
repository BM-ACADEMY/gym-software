# Hand-off for the Afra AI OS session: sales work for the Afra software products

From: GymDesk/products session (Claude), 29 Oct 2026. For: whoever carries out `docs/work-queue-*.md` in `afra-ai-os`. Nothing here is a change to that repo. It is a request for a plan and Mohamed's OK.

## Ask (from Mohamed)
"We are building Afra AI OS. If possible connect there": use the Lead Hub as the sales and renewal follow-up tool for Afra's own SaaS products (Fit, groom, Mart, Dine, Cloth, Wash, Hire). Mohamed has a sales team and a lead sheet.

## What the product side will provide
- A daily labelled CSV (headings `phone,name,email,source,campaign`) of business owners to call: new sign-ups, trials ending in 3 days, renewals due in 7 days, expired/grace. `campaign` carries product and stage, e.g. `fit-renewal-7d`, `hire-trial-3d`. No end-customer data, no amounts.
- Source of truth for plan, dates and status stays in each product (status computed from dates by `packages/core-billing` in the gym repo).
- Real lead data never goes into git or chat.

## Decisions the Afra AI OS side needs (per its CLAUDE.md, plan first)
1. One brand ("AFRA Products") vs one brand per product. Adding a brand needs Mohamed's OK and is new to `docs/decisions.md`.
2. Roles: sales team members as telecallers, one manager (brand access via `grant_brand_access()`).
3. Pipeline statuses for sales (suggest: new, contacted, demo done, trial started, paid, renewal due, lost) and terminal outcomes (existing four stay).
4. Whether the daily import is manual (manager runs the dry-run then import) or later a service-user webhook (D21). Start manual.
5. Dedupe key is phone per brand; check that a returning owner merges into history.
6. Calling remains manual (Phase 1 rule). Do-not-contact enforced on the server. WhatsApp templates are a separate Meta task.

## Answers from Mohamed (29 Oct)
- Brand split: yes, one brand ("AFRA Products"); product and stage go in `campaign`. This is Mohamed's approval to add the brand; the Afra AI OS session still records it in `docs/decisions.md` and follows its plan-first rule before building.
- People: not fixed. A telecaller or a BD (business development) person handles these leads, and who it is will change. So do not hard-code names: use normal brand access (`grant_brand_access()`), and treat "BD" as a person with the telecaller (or manager) role on this brand. Question for that session: does BD need a role of its own, or is telecaller enough?

## Out of scope here
No calling engine, no AI agents, no new dependencies. Phase 3 work is untouched.
