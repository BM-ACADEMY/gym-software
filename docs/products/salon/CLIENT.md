# Groom (Salon, Spa, Barber, Clinic): front end (client)

Status: written, not yet tested. The folder `apps/salon/client` is a Vite and React page, copied from the Hire client. It has sign-in and sign-up, the owner panel built from `apps/salon/admin/manifest.json`, an install-to-home-screen file and a language box where menu names exist. Nothing here has been built or opened in a browser. The files were only syntax-checked with esbuild, and a test bundle resolved every import.

Wording on the page is limited to what is true today: an invite-only pilot. No prices and no promises.

## What is in it
- `src/AuthGate.jsx`: sign in or ask to join the pilot, against `/api/salon/auth`. Shows a read-only banner when the plan has ended.
- `src/main.jsx`: top bar (business name, language box when the product has Tamil/Hindi names, sign out) and the owner panel. The panel gets the signed-in role, so each person sees only the menu items their role may see.
- `src/product.js`: name, colour, server address and header, in one place.
- `public/`: install file, service worker (never stores `/api`), icons (plain placeholder letters in the product colour; replace with real artwork).

## Billing
No shared billing screen: Salon bills through its own `/api/salon/bills` route (service lines with the staff member on each line, discount reason), so billing needs a Salon screen.

## Still needs product-specific screens
- Appointment day view per staff (free slots, reschedule, cancel) and the walk-in queue
- Billing screen: pick service lines, staff on each line, discount with a reason, split payments
- Customer search and the Clinic extras (doctor-only notes, body-area picker)
- Add-a-login for staff (needs a password field type in core-ui, CORE-UI-01)

## Dev A: build and try it
1. `cd apps/salon/client && npm install && npm run build` (should end with a `dist` folder; if the build complains about `core-pos` being CommonJS, tell Claude the exact message).
2. For a local look: start the product server on port 5007 with its settings, then `npm run dev` in the client folder and open the address it prints. Sign up, then open each menu item.
3. Check: sign up works, sign in works, the menu shows, a staff login sees fewer items than the owner, Sign out returns to the sign-in page.
4. Check installing to the home screen works on a phone (production build only).

## Dev A: serve it on the same domain
Best: the web server (nginx) serves `apps/salon/client/dist` for the product's address and passes `/api` to port 5007. If it is easier to serve it from the product's Express app, this is the exact change to `apps/salon/src/app.js`, just before `return app;` (not applied yet, because other workers are editing that file):

```js
const path = require('path');
app.use(express.static(path.join(__dirname, '../client/dist')));
app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(__dirname, '../client/dist/index.html')));
```

## Known limits
- The page was never run. Treat every screen as untested.
- Tamil and Hindi menu names (where present) are drafts and need a native speaker (M-06). Text inside the shared panel and billing screens is English only.
- Icons are placeholders.

## Screens added (CLIENT-02, written, not yet tested by a person)

Files in `apps/salon/client/src`: `Screens.jsx` (the four screens), `strings.js` (all English wording, a draft Tamil set, Patient/Doctor wording for the Clinic preset), `main.jsx` (tabs: Day, Walk-ins, Bill, Customers, Owner panel). The owner panel is still the manifest panel, one tab away.

| Tab | What it does | Routes used (all under `/api/salon`) |
| --- | --- | --- |
| Day | Day picker, filter by staff member, list of visits, book (service, staff, free time, name, phone, consent), move, cancel, Done, No-show, Accept (owner) | `GET /staff`, `/services`, `/appointments`, `/slots`; `POST /appointments`, `/appointments/:id/{cancel,accept,reschedule,done,noshow}` |
| Walk-ins | Add a walk-in, Start, Finished, Left | `GET/POST /queue`, `POST /queue/:id/status` |
| Bill | Services with the staff member on each line, discount (percent or rupees) with a reason, split payments (cash, UPI, card), saved bill with change and still-to-pay | `POST /bills` (price, GST, discount limit all decided by the server) |
| Customers | Search by name or number, open one to see visits. Staff logins get masked numbers from the server | `GET /customers`, `GET /customers/:id` |

- **Clinic:** when the business preset is `clinic`, labels say Doctor and Patient, and the booking form has the problem-area picker (sent as `bodyArea`).
- **Discount limit:** the page never decides it. If a staff login goes over the owner's limit, the server's message ("Staff can give a discount up to 10%...") is shown above the Save button.
- **Rough total:** the bill screen shows "~ Rs N" from service prices only. The real total, GST and rounding come back from the server after saving.
- **Safe retry:** each bill carries a `clientId`, so tapping Save twice on a bad network does not make two bills.
- **Language:** the select in the top bar switches the screens between English and a draft Tamil (needs a native speaker, M-06). Missing Tamil words show in English.

**Checked here:** esbuild syntax check on every file, and a server-side render of all four tabs for salon and clinic in English and Tamil. Nothing was run in a browser or against the server.

**Added in the final list (13 Nov, written, not yet tested by a person):**
- Day: a **Time grid** view next to the list (one column per person, one row per half hour; tap an empty box to start a booking for that person).
- Bill: a **customer picker** (search by name or number) and a **New customer** form (name, 10-digit mobile, consent tick); the bill is saved with `customerId`. **Retail product lines** (`GET /products`, sent as `productId` + `qty`; price and GST come from the server). After saving: **Print bill** (A5 or A4, opens the server's printable page in a new tab via `GET /bills/:id/print`) and **Copy bill message** (copies plain text to paste into WhatsApp yourself; nothing is sent).
- Owner panel: Reminders for tomorrow, Sales 7/30/90 days, Profit 30/90 days, GST 30 days.
- Customer booking page: after booking, **Change time** and **Cancel booking** (the customer's own phone is the key).

**Still not built (gaps):**
- No card or wallet detail on payments.
- Reminders are suggest only: no message is sent from the app (needs approved WhatsApp templates).
- A retail line cannot carry a per-line discount on the bill screen.
- Appointments with `pending` status can be accepted only by the owner (server rule).
- The QR picture is a link (`/api/salon/settings/booking-qr.svg`, owner signed in); there is no button for it in the owner panel yet.

**Dev A steps:** (1) `cd apps/salon/client && npm install && npm run build`. (2) Start the Salon server and `npm run dev`. (3) Sign up as a clinic once and a salon once and check the wording. (4) As owner: book a visit, move it, mark Done, make a bill with a 50% discount, then sign in as a staff login and try the same discount: it must be refused with the limit message. (5) As staff: Customers must show masked numbers. (6) Tap Save twice quickly on a bill: only one bill should exist.
