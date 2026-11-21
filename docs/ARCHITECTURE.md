# Architecture note: shared core and products (C-01)

Status: boundaries written and checked; nothing moved yet. Plan and module list: `docs/products/CORE.md`.

## Layout (target)
```
apps/gym  apps/salon  apps/mart  apps/dine  apps/cloth  apps/wash  apps/hire
packages/core-server  core-messaging  core-ai  core-ui  core-pos
```
Until C-04 the gym app stays where it is (`server/` and `client/`). The checker treats those two folders as "gym".

## Rules (enforced by `node scripts/check-boundaries.js`)
1. A product never imports another product. Shared code goes into a package.
2. A package never imports a product.
3. Packages use only the packages their level allows:

| Package | May use |
| --- | --- |
| core-server (auth, tenancy, plans, billing, GST, invoices, audit, caps) | none (the base) |
| core-messaging (WhatsApp templates, owner email, dedupe, quotas) | core-server |
| core-ai (model client, tools, caps, daily budget stop) | core-server |
| core-pos (customers, billing/POS, loyalty, inventory, staff, expenses) | core-server, core-messaging |
| core-ui (layout, i18n, forms, PWA shell) | none (browser code only, no server code) |

4. Nobody reaches inside another package's folders. Import the package name (`@afra/core-pos`), not `../core-pos/src/x`.

## How to run the check
- `node scripts/check-boundaries.js` prints "Boundaries OK" or the list of broken imports and exits with an error.
- Run it in CI on every push once CI exists (Dev A task). Today it passes on the gym code.
- Tested here on a throw-away tree with one example of each rule; it flagged all three broken cases and passed the valid one.

## Tenant safety (rule for every package)
Every query on tenant data filters by the tenant id. C-03 replaces hand-written filters with a fail-closed plugin and one test per model. Until then the rule in `CLAUDE.md` applies: every new route filters by `req.user.subscriberId` and has a test.

## Extraction order
C-02 `core-pos` (first user Salon) then C-03 tenant plugin then C-04 move billing, plans, WhatsApp, caps and Super Admin (the gym app switches only after Dev A's first green run) then C-05 business-type switch.
Money in every package: whole rupees with a currency code.
