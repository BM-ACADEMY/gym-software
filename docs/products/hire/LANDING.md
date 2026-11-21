# Hire (recruitment agencies): landing page copy (draft, 12 Nov 2026)

Address (working): hire.afraventures.in. Follows `docs/PRODUCT_PRINCIPLES.md` (loss in rupees, first win in five minutes, one next action, honest scarcity) and `MARKETING_CLAIMS.md` in this folder.

## How to use this file

- **Pilot page (usable now):** section 1 only. It says only what is true today: coming soon, invite-only pilot.
- **Full page (later):** sections 2 to 6. Each block carries claim IDs. A block may be published only when every claim ID on it is BUILT-AND-SEEN-BY-A-HUMAN in `MARKETING_CLAIMS.md`. Until then it stays hidden.
- Tamil and Hindi lines are first drafts and **need native review (M-06)** before use.
- All wording here is editable later in Root Admin > Site Content (D-28); WhatsApp template text is not.

## 1. Pilot page (usable now)

**Headline:** Hire (recruitment agencies) is coming. Join the invite-only pilot.
**Line:** A simple hiring tool for small recruitment agencies. Invite-only pilot first.
**Button:** Ask to join the pilot (opens WhatsApp to the Afra Ventures number)
**Small print:** Pilot is for a small number of invited businesses. Prices are shown here only after we confirm them.

## 2. Headline for the full page

**English:** Resumes in WhatsApp and Excel, follow-ups that slip, candidates who drop after the offer. Every slip is a fee lost.
**Sub-line:** Keep every candidate, job and client in one place, and see each morning who to follow up. One flat price for any number of recruiters.
**Tamil (needs native review, M-06):** வாட்ஸ்அப்பிலும் எக்செலிலும் ரெஸ்யூம்கள், தவறும் ஃபாலோ-அப்கள், ஆஃபருக்குப் பிறகு விலகும் வேட்பாளர்கள். ஒவ்வொரு தவறும் இழந்த கட்டணம்.
**Hindi (needs native review, M-06):** व्हाट्सऐप और एक्सेल में रिज़्यूमे, छूटते फ़ॉलो-अप, ऑफ़र के बाद पीछे हटते उम्मीदवार। हर चूक एक खोई हुई फ़ीस है।

## 3. Benefit blocks (show the loss in rupees, then the answer)

### Resumes that organise themselves
Upload a PDF or Word resume; the AI fills the candidate record and you review it. Duplicates are caught by phone or email.
_Claims needed: HIR-C03, HIR-C10_

### Better shortlists, faster
The AI ranks candidates for a job with a short reason. You can override it. Share a read-only page with your client instead of email chains.
_Claims needed: HIR-C04, HIR-C06_

### Follow-ups that do not slip
A morning list per recruiter and a pipeline with notes and tasks. Flags warn when an offer may drop. These are suggestions, not predictions.
_Claims needed: HIR-C05, HIR-C07, HIR-C09_

### Fees you can chase
Track placement fees and GST invoices for each client.
_Claims needed: HIR-C08_

## 4. How it works (3 steps)

1. Add your clients and jobs.
2. Upload resumes, review the records, shortlist and share with the client.
3. Each morning see who to follow up, which offers need attention and which fees are due.

## 5. FAQ

**Does the AI send messages to my customers?**
No. The AI reads resumes and ranks candidates for you to review. Message ideas are suggestions for you to approve. Nothing is sent unless you switch a job on, and then only approved WhatsApp messages go out. We never use AI voice calls.
_Claims needed: HIR-C03, HIR-C04, HIR-C09_

**Is my customers' data safe, and who can see it?**
Every business sees only its own data. Staff see only what their role allows. You can ask for a copy of your data or for it to be deleted. We say what we store before you sign up.
_Claims needed: data export and delete built and seen (PLANNED today)_

**What if I stop paying?**
Your data is not deleted. After the plan ends your account becomes read-only, so you can still look at and export your records. You can come back any time.
_Claims needed: read-only guard seen; export built and seen_

**Do I need a card to try it?**
Say only what the live plan settings say (trial length and whether a card is asked).
_Claims needed: trial seen working_

**Is candidate data safe and legal to store?**
Each agency sees only its own data. Candidate consent wording is being reviewed by a lawyer before we use it. We do not claim legal compliance until that is done.
_Claims needed: lawyer sign-off recorded (open)_

## 6. Pricing section (placeholder)

`[LIVE PLAN PRICES]` The page reads plan names, prices, limits and the trial length from `GET /api/public/plans`-style live settings for this product. Never type a price into this copy.
Plans in `apps/hire/src/plans.js` and `docs/products/hire/FLOOR_PRICE.md`: do not include WhatsApp outreach in the flat price (Meta cost per message). Prices not approved (Tier 3, HIR-P1).

Shown under the prices: "Prices are before GST" or "include GST" (owner decides which; one wording, everywhere). Trial end dates are real. No fake countdown, no "only 3 left".

## Candidate data: extra rules

- Resumes and phone numbers are personal data. No real candidate data in screenshots, ads, demos or chat.
- Public copy says only that candidate messages are "suggestions you approve" until the lawyer has approved the consent wording.
- A client share link shows only what the recruiter chose to share.
