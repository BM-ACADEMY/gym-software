# GymDesk roadmap

DRAFT, written 2026-11-20 by Claude from HANDOVER.md and a look at the repo (last commit 2026-09-15). Owners and dates are guesses: the web team should correct them from their own notes before this is used to plan a sprint.

Start: 2026-11-20

GymDesk is the gym management product (MERN: Node/Express/MongoDB server, React client). It has four roles: Root Admin, Gym Owner, Sub-Admin and Member. It is the first Afra product after ThePlotOne, Velai Vaaippu and Afra AI OS.
Tick a box when done. Dates are targets.

## Go live

### Put GymDesk on real hosting
- Owner: Kamar, with the web team
- Due: 2026-12-18
- Priority: High
Today it runs only on a dev setup. Needs a MongoDB Atlas database, a host for the client (Vercel config exists in client/vercel.json) and a host for the server, with production settings set on each. Hosting choice and cost need Kamar's decision.

### Take the demo passwords out of the repo
- Owner: Aakash
- Due: 2026-11-27
- Priority: High
HANDOVER.md lists demo accounts with their passwords. Move them out of the file (or make sure they never exist on a real server), and make sure OTP_MODE is live on any real server.

### Switch the payment gateway to live Razorpay
- Owner: Kamar
- Due: 2026-12-18
- Priority: Normal
Razorpay works in test mode. Going live needs Kamar's real Razorpay account and keys, entered through Root Admin settings, never in the repo. Test one real small payment before opening to a gym.

### Run the server tests and a full walkthrough on the live setup
- Owner: Aakash
- Due: 2026-12-11
- Priority: Normal
npm test in server/ against a separate test database, then the owner, trainer, member and root admin walkthrough on the hosted version.

## After launch

### Live AI for workout and diet plans
- Owner: Aakash
- Due: 2027-01-15
- Priority: Low
The AI service is rule-based today and shaped so a real model can be dropped in. Needs an API key and a monthly spending limit from Kamar.

### WhatsApp notifications
- Owner: Aakash
- Due: 2027-01-31
- Priority: Low
SMS and email work. WhatsApp needs a WhatsApp Business account and credentials. Could reuse the Nera (Getnera) WhatsApp work.

### Find the first pilot gym
- Owner: Kamar
- Due: 2026-12-18
- Priority: Normal
Pick one gym to run on GymDesk first and collect their feedback.

## Done (from HANDOVER.md, confirm with the team)

- All four roles with working flows: members, attendance, payments with PDF invoices and GST, staff, PT sessions and packages, workouts, trials, accounts, reports, notifications, settings, plans and coupons, support tickets.
- Razorpay test mode with signature check and no double crediting.
- Automated tests for gym separation, sub-admin permissions and payment idempotency.
