# Brief for the UI designer (agency designer oversees; draft 29 Oct)

Owner: Kamarudeen B (Afra Ventures). Decides names, prices, final look. Claude builds the code; the designer owns the look and checks the built screens.

## 1. Who the screens are for
Small business owners and staff in India (gym, salon, kirana, restaurant, cloth shop, car wash, recruitment agency). Mostly on a phone, often one hand, bright shops, patchy internet. Many are not comfortable with English or with software. Tamil and Hindi must fit (longer words, different scripts).

## 2. Design rules
- Phone first, then desktop. Big tap targets, one main action per screen, plain words, no jargon.
- Numbers first: today's money, who to call, what to do next. Reports readable at a glance.
- Autopilot must feel safe: every suggestion shows why, with Approve / Edit / Skip. Mode (off / suggest / auto) is always visible and one tap to pause.
- Money in rupees, no paise noise; GST always shown separately.
- Accessible: contrast, text size that can grow, no colour-only meaning, works in sunlight.
- Light and dark modes. Fast on cheap phones (no heavy images or animation).
- Fake data only in every mock-up, screenshot and demo.

## 3. What exists today (for the designer to improve, not start from zero)
- Hire: sign-in/sign-up, today list, pipeline, candidates, jobs, clients, fees, weekly report, autopilot settings (manifest-driven panel).
- Super Admin: overview with counts per product, "Products & Launch" page, sign-in.
- Fit (gym) owner app and admin; Mart preview.
- Clickable previews published as artifacts: Hire Screen Previews, Super Admin all-products mock-up, GymDesk and Mart previews (links in `docs/products/README.md` or ask Kamarudeen).
- Colour, type and spacing live in one place (`packages/core-ui/src/admin/admin.css` and the product style files). Panels are built from a data file (manifest) plus shared screens, so a design change there reaches every product. Designer sets tokens and component styles; Claude wires them. Please do not design one-off layouts that cannot be built from the shared screens without checking first.

## 4. Deliverables, in this order
1. Brand basics for Afra and each product name (Fit, groom, Mart, Dine, Cloth, Wash, Hire): logo direction, colours, type, icon style. Trademark check by Kamarudeen later.
2. Design tokens (colour, type scale, spacing, radius, shadows) for light and dark.
3. Component kit: buttons, forms, list rows, cards, tabs, tables that become cards on phone, empty states, error states, suggestion card (Approve/Edit/Skip), mode switch, report tiles.
4. Screens, priority order: Hire (today list, candidate card, pipeline, client share page), Fit (today, members, renewals), Super Admin (overview, marketing to-do, calendar), then groom, Mart, Dine, Cloth, Wash.
5. Landing page for each product (see `docs/BRAND_AND_TAGLINES.md`: chosen taglines, page order, what may be claimed).
6. Review of the built screens on a real phone (Dev A or staff share screenshots with fake data), with a list of fixes.

## 5. Copy and claims
Taglines are chosen (`docs/BRAND_AND_TAGLINES.md` section 6). Only claim what a person has seen working. Never "runs on its own" or "no work needed". No competitor claims. No fake testimonials or customer numbers.

## 6. Hand-off format
Figma (or similar) with named tokens and components, exported assets (SVG for icons and logos), and a short note per screen on states (loading, empty, error, read-only after plan ends). Claude turns this into code; the designer reviews the result against the file.

## 7. Open for Kamarudeen
- Which agency/designer, and their access (design files and fake-data previews only; no server, code or customer data).
- Budget and timeline.
- Whether Tamil and Hindi screens are in the first round (recommended: design for them from day one, translate after).
