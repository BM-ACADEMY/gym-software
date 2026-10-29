# AI on Velaivaaipu (public site, free student assessments): requirements and how to add the guards

Status: requirements written 29 Oct; nothing is built in the Velaivaaipu site. Its code is in a separate repository that this session has not seen (the repo list shows `BM-ACADEMY/CT_Jobportal`, which looks like CoreTalents; Kamarudeen to confirm which repo is Velaivaaipu). Facts from Kamarudeen: the site is public, has many free assessments for students, and keeps its code separate from Afra AI OS.

## Why guards come first
A public site lets anyone trigger AI, so cost is set by visitors, not by us. One bug or one script could use the whole key.

## Requirements (all must be true before AI goes live there)
1. Code marks what it can (multiple choice, numbers). AI only for written answers or feedback.
2. Sign-in with a phone code before AI feedback; per user 3 a day; per network address 20 a day (numbers are starting values, Assumption).
3. Same answer to the same question is served from saved feedback, not paid for again.
4. Own daily money stop. When reached, students still get their score; the page says AI feedback is resting.
5. Its own OpenRouter key with a small lifetime limit ($1 at the start), never the Afra products or Afra AI OS key.
6. Students answer fixed questions only; no free text prompt goes straight to the AI.
7. Zero-data-retention requested on every call (the shared provider file does this by default for OpenRouter).
8. Many students may be under 18. Ask the lawyer about parental consent and the privacy notice before any AI reads student answers (a question for the lawyer, not legal advice from Claude).
9. No names, phone numbers or emails in what is sent to the AI: only the question text and the answer.

## How the developer adds it (copy, no install)
1. Copy `packages/core-ai-guard/` (pure, no dependencies; `src/index.js` and its test) into the Velaivaaipu repo.
2. Copy `server/services/aiProvider.js` from the gym repo (needs Node 18+ for built-in fetch). Set `AI_PROVIDER=openrouter`, `OPENROUTER_API_KEY` (server settings only), `AI_MODEL=openai/gpt-4o-mini`, `AI_PLAN_MODEL=openai/gpt-4o-mini`.
3. Write a database-backed store for the guard (counts per key per day, cache with expiry, today's spend) following `memoryStore`; the in-memory one forgets everything on restart.
4. Before each AI call: `const d = await guard.check({ userId, ip, cacheParts: { assessmentId, questionId, answer } })`. If `d.cached` use `d.value`; if not `d.allow` show `d.message` and the score; else call the AI, then `guard.record(d, { value: feedback })`.
5. Test: 4th feedback in a day refused; second identical answer is free; spend at the budget refuses everyone; signed-out refused.

## Rough cost (Assumption, not measured)
One short feedback on gpt-4o-mini is about Rs 0.04. 1,000 students x 3 feedbacks is roughly Rs 120. Measure on the first day with the OpenRouter dashboard.
