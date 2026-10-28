# Recruitment Agency: scope

Address (working): hire.afraventures.in. Owner target: phase 1 invite-only start 28 Nov 2026. Different buyer, different sales cycle, and no POS: it shares only the core server, billing, AI and messaging modules.

## 1. Owner's problem (source: master plan 4.7)
Slow sourcing, resumes in WhatsApp and Excel, lost follow-ups, candidates who drop after offer, client updates that eat time, per-recruiter pricing.

## 2. Evidence
| Item | Type | Detail |
| --- | --- | --- |
| Zoho Recruit, CEIPAL, iSmartRecruit, greytHR Recruit at Rs 1,500 to 4,700 per recruiter a month | Source | factoHR via master plan |
| Per-seat pricing hurts small agencies; sourcing and outreach automation is the pain | Source/Assumption | Master plan reading; interview 5 agencies (task HIR-R1) |
| Resume data is personal data (Digital Personal Data Protection Act applies) | Assumption to confirm | Lawyer to confirm consent and retention wording (Tier 3) |

## 3. Phase 1 must-have
1. Sign-up, trial, agency profile, **unlimited recruiter logins at one flat price**.
2. Clients and jobs (role, location, salary range, openings, fee terms).
3. **Resume upload (PDF/Word) or forward from WhatsApp; AI parses** into a candidate record (name, phone, skills, experience, current/expected pay) with owner correction.
4. **AI ranking** of candidates against a job with a short reason; recruiter can override.
5. Candidate pipeline per job (sourced, screened, submitted, interview, offer, joined, dropped) with notes and tasks/follow-up reminders.
6. **WhatsApp outreach**: bulk message to selected candidates using an approved template, screening questions answered in chat, answers saved on the record. Marketing-category templates are prepaid; candidates must have an opt-in or reply window (compliance wording from lawyer).
7. Interview scheduling with reminders to candidate and client.
8. **Client share link**: read-only page of shortlisted candidates with the recruiter's notes, no email chains; client can mark interested/reject.
9. **Offer-drop warning**: simple rules first (no reply 48 hours after offer, multiple offers mentioned, notice-period risk), shown as a flag, not a prediction claim.
10. Placement fee and invoice tracking, GST invoices (core), payment reminders to clients.
11. Duplicate detection by phone/email; CSV import/export; Ask your business; Tamil/Hindi/English; PWA.

## 4. Phase 2
Job-board posting and email-inbox capture, candidate self-service form link, calendar sync, team targets and incentives, client portal login, background-verification partner links.

## 5. AI and caps
Resume parsing and ranking are the main AI cost. Per-plan monthly caps on resumes parsed and ranking runs; parsing uses the cheaper model first, with a monthly platform budget. Resume text is sent to the model, so the privacy page must say so and the claims file must list it.

## 6. Pricing (draft, not approved)
Flat price per agency instead of per recruiter. A starting point such as Rs 999 / 1,999 / 3,999 a month is an Assumption to test against the Rs 1,500 to 4,700 per recruiter rivals; Claude produces the floor-price table with parsing cost (HIR-P1). Tier 3.

## 7. External dependencies
Lawyer on candidate data, consent and WhatsApp outreach rules; Meta templates `hire_*` (marketing category, check policy); 3 to 10 pilot agencies.

## 8. QA gate
Resume parsing accuracy on 50 real resumes in mixed formats (target set by Dev A, Assumption), ranking sanity test, pipeline state tests, share-link access test (cannot guess other clients' links; Dev B), tenant isolation, plan limits. Start when P1 pass and 3 to 10 agencies found.

## 9. Backlog IDs
HIR-01 to HIR-11. Status of all: TODO.
