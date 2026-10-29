# Velaivaaipu: AI cost and privacy review (read-only, 29 Oct)

Repo read: https://github.com/BM-ACADEMY/CT_Jobportal (shallow copy, read only; this session cannot change it). Facts below come from its code, not from running it. Cost figures are Assumptions (tokens guessed, Gemini 2.5 Flash price not checked).

## What it does today
- Already uses OpenRouter (`server/utils/aiHelper.js`, one key `OPENROUTER_API_KEY` for every AI feature, model `google/gemini-2.5-flash` unless `AI_MODEL` is set).
- Free public assessment: `GET /api/assessments/public` makes the AI write a fresh 10-question set on every start (`controllers/assessmentController.js`, `buildSet`). **Student answers are scored by code and never sent to the AI** (good for privacy and cost).
- Other AI features (resume review, candidate matching, job tools) call the same helper from `userController.js`, `applicationController.js`, `jobController.js`, `requestController.js`.

## Findings, most important first
1. **Public start has no sign-in, no daily cap and no site-wide cap.** The only limit is 40 starts per 15 minutes per IP address (`routes/assessmentRoutes.js`), held in memory (`middlewares/rateLimit.js`), so it resets on restart. One address could make about 3,800 AI calls a day; many addresses have no limit. Rough worst case from ONE address: Rs 1,000+ a day (Assumption: about Rs 0.3 per start).
2. **A fresh AI set is made every time,** even when stored sets for the same skill and level exist. Stored sets are used only when the AI fails.
3. **The skill is free text** (cleaned, up to 60 characters), so each odd skill is a new AI prompt. The site already has a category list (`getCategories`).
4. **No zero-data-retention** is requested in `aiHelper.js`. The assessment prompt holds no personal data, but resume review and candidate matching do. Those need zero retention on and the privacy notice to say AI is used.
5. **One key for everything,** with no limit visible in code. A bug in any feature can use the whole balance.
6. **Error text:** `aiHelper.js` puts the provider's reply body into the thrown error, which is then logged. A reply can echo prompt text, so personal data could reach the logs. Cut it to the status code.
7. `HTTP-Referer` is set to `http://localhost:5000`. Cosmetic: set it to the real site address.

## Fix list for the Velaivaaipu developer (in order of value)
1. **Reuse stored question sets.** For a skill and level, if 5 or more sets already exist, hand out a random stored one (copy it into a new attempt document, options re-shuffled as now) and make a new AI set only now and then. After warm-up the AI cost of free tests is close to zero.
2. **Limit the skill to the category list,** or map free text to the nearest category, so prompts are bounded.
3. **Add the guard in anonymous mode** (`packages/core-ai-guard`, `requireUser: false`): about 10 AI starts per address per day and a site-wide daily count (suggest 300, Assumption), with the friendly "try again tomorrow" fallback to a stored set. A database store replaces the in-memory one.
4. **Own key with a small limit** ($1 to start) for Velaivaaipu, separate from every other key. Per-feature keys later.
5. **Ask OpenRouter for zero data retention** (`provider: { zdr: true }` in the request body, from OpenRouter's ZDR page) on the features that send personal data; check the model still answers (if no endpoint is found the call fails, tell Kamarudeen).
6. **Trim the error text** and set a real `HTTP-Referer`.
7. Ask the lawyer about under-18 students and the privacy notice before AI reads any student data beyond the skill name.

## Message to send to the Velaivaaipu developer
Please read `VELAIVAAIPU_AI_REVIEW.md` (attached). Do items 1 to 6 in the fix list in that order, one small change each, with a test for each. Item 3 uses the folder `core-ai-guard` from the gym repo (copy it in; no install). Do not put any key in git. Tell Kamarudeen when each is done and show the OpenRouter usage page after one day.
