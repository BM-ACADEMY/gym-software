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
