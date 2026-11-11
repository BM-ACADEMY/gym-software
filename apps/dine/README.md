# Dine (restaurant, cafe, pub mode)

Written, not yet tested by a person. Scope: `docs/products/dine/SCOPE.md`. Items for CA and lawyer: `docs/products/dine/CA_LAWYER_ITEMS.md`. Dev A steps: `docs/products/dine/DEV_A_STEPS.md`.
`src/` pure rules first (menu, order flow, split, GST profiles, costing, pub, insights, accounts, reports, predictions, marketing, staff, summary); `routes.js` wires them to the database with a tenant filter on every query; `app.js` fails closed without settings.
