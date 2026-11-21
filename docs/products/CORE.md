# Shared core: built once, used by every product

Status: plan. Extraction starts from the gym code (`phase1-autopilot`) and the TeamPulse repo (`afraventurepvt-create/payroll`).
Source for the module list: master plan section 3 (80 percent of each product is shared; Assumption from the founder discussion, validate during extraction).

## Decision (Tier 1, Claude): how to share code

Monorepo with shared packages; each product is its own app and deploy at its own address:

```
apps/gym  apps/salon  apps/mart  apps/dine  apps/cloth  apps/wash  apps/hire
packages/core-server   (auth, tenancy, plans, billing, GST, invoices, audit, caps)
packages/core-messaging (WhatsApp templates, owner email, dedupe, quotas)
packages/core-ai        (model client, tools, per-plan caps, daily budget stop)
packages/core-ui        (layout, i18n en/ta/hi, forms, tables, PWA shell)
packages/core-pos       (billing, customers, loyalty, inventory, staff, expenses)
```

Why: a fix to billing or tenant security is made once. The gym app moves in after its first human test run is green, not before,
so the launch branch is never destabilised (Decision, protects the 10 Nov gym date).

## Modules and where they come from

| Module | Source today | Used by | Notes |
| --- | --- | --- | --- |
| Tenant scoping, fail-closed | TeamPulse Mongoose plugin with AsyncLocalStorage; gym uses hand-written `subscriberId` filters | all | Replace hand-written filters; Dev B attack suite is the proof |
| Plans, limits, trial, status from dates | gym `config/plans.js`, `services/subscription.js` | all | Plans per product, same engine |
| Razorpay billing, GST invoices, webhook | gym `services/subscriptionBilling.js`, `billingMath.js` | all | GST rule: buyer in Puducherry CGST+SGST, others IGST |
| Super Admin back office | gym 1F-01, 1A-07; backlog 1g | all | One back office for all products, product filter |
| WhatsApp template sender, automations, dedupe, quota | gym `utils/whatsapp.js`, `services/automations.js` | all | One Afra number, product-prefixed templates (D-12) |
| Owner emails | gym 1F-02 | all | |
| i18n en/ta/hi | gym `client/src/i18n` | all | Native review needed for ta and hi |
| Customer record (phone is the key) | new, generalises gym Member | all except hire | |
| Billing / POS (GST or plain bill, split payment, hold, return, offline) | new | salon, mart, dine, cloth, wash | Biggest new module; see below |
| Loyalty points, memberships, packages, gift cards | new | salon, mart, dine, cloth, wash | Owner request: loyalty fixed for all businesses |
| Inventory (barcode scan, labels, stock, expiry, suppliers) | new | mart, cloth, dine, salon (consumables) | Camera scan in the browser plus USB/Bluetooth scanner |
| Staff, attendance, payroll, commission | gym 2-05, 1B-07; TeamPulse engine | all | Commission rules differ by product (config, not code) |
| Expenses and cash closing | gym accounts | all | |
| Owner daily report on WhatsApp | gym 1B-04 | all | |
| Ask your business (AI on own data) | gym 1E-01 plus AI-02 | all | Read-only, tenant-scoped tools only |
| Leakage alerts | new (AI-07 pattern) | mart, dine, salon, wash | |
| Feedback and review booster | new | all | |
| PWA install | gym PWA-01 | all | Offline cache for billing screens |

## Core build order (Claude, in parallel with the gym launch items)

1. C-01 Write the package boundaries and move nothing yet; add an architecture note and a script that checks no product imports another product.
2. C-02 Generic Customer + Billing/POS + Loyalty + Inventory modules with tests, as `packages/core-pos`, first consumed by Salon (13 Nov target) and Mart (16 Nov target).
3. C-03 Tenant plugin (fail-closed) in `core-server`, with a test per model.
4. C-04 Move billing, plans, WhatsApp, caps and Super Admin into packages; the gym app consumes them after Dev A's first green run.
5. C-05 Business-type switch: a tenant has one `businessType`; menus, presets and report packs load from a per-product config.

## Risks (Assumption unless stated)

- Offline billing with sync is the hardest part of POS. Phase 1 target: the billing screen keeps working when the network drops and syncs later; conflicts resolved by "bill number from the device prefix". Needs a human offline test.
- Barcode scanning in a browser depends on the phone camera and the scanner type. Needs a real scanner and a real phone in the test plan.
- Thermal printer support differs by shop (58 mm / 80 mm, USB / Bluetooth). Phase 1: browser print and PDF; direct thermal printing in Phase 2.

## Progress note (29 Oct)
- C-04a `packages/core-billing` written (status, quote, GST, proration, limits, read-only guard); parity-checked against the gym's code; gym not switched yet (waits for Dev A's first green run).
- Hire has its own sign-up, sign-in and session (`apps/hire/src/signup.js`, `session.js`, `authRoutes.js`). When C-04 moves accounts into core, Hire's and the gym's move together; until then each product keeps its own.
- `packages/core-autopilot` still to build (second product needing it triggers the move).
