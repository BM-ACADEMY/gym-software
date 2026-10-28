# How Claude and Mohamed work together

Goal: Mohamed spends 5 to 10 minutes a day. Claude does everything else and never sits idle waiting for an answer.
Written 28 Oct 2026 on Mohamed's instruction. Read this before `docs/BACKLOG.md`.

## 1. The daily cycle

1. Claude starts from `docs/DECISIONS.md` (open questions) and `docs/BACKLOG.md` (tasks).
2. Claude works every task it is allowed to do without asking (tiers below), on branch `phase1-autopilot`, small commits.
3. Claude ends each working session with the **Daily Brief** (format in section 4) in chat.
4. Mohamed replies in one line, for example: `1 yes, 2 B, 3 no, 4 later`. That is the whole review.
5. Claude records the answers in `docs/DECISIONS.md` in the next commit and continues.

## 2. Who decides what

| Tier | Who | Rule | Examples |
| --- | --- | --- | --- |
| 1 | Claude decides, tells in the brief | Technical or editorial choices that are easy to change | Code structure, test design, file names, fixing bugs, help-article wording that matches `MARKETING_CLAIMS.md`, internal docs |
| 2 | Claude proceeds on its recommended default, marked `AUTO-DEFAULT` | Reversible and low risk. Mohamed can veto at any review; Claude then reverses it | Business rules R01 to R30 defaults, refund window draft, screen layout, message wording drafts, task order inside a phase |
| 3 | Mohamed must approve | Money, law, public promises, real customers, accounts, production. Claude prepares everything first | See list below |

**Tier 3 list (always Mohamed):** prices, plans, discounts and offers; anything that charges money or messages real customers;
GST, CA and legal wording; the public launch switch (`PUBLIC_SIGNUP`); product and brand names; accounts, keys and paid services;
touching production data; merging to `main` or deploying; changing a security rule; new marketing claims; starting a new product.

**A Tier 3 item blocks only the tasks that depend on it, never the whole queue.** Claude prepares the work up to the approval
point, parks it, and moves to another lane.

## 3. Never idle: lanes and runway

Claude keeps at least two working days of Tier 1 and Tier 2 tasks ready in each lane and switches lane when one is blocked.

| Lane | Work |
| --- | --- |
| A. Build | Code for the current phase in `BACKLOG.md` |
| B. Test prep | Runbooks, test cases, exact commands for Dev A, Dev B and Staff; fixing failures first when results arrive |
| C. Content | Help articles, Tamil and Hindi text, landing copy that matches the claims list, WhatsApp templates |
| D. Admin and AI | Super Admin features and AI features from `BACKLOG.md` (phases 1g and 3) |
| E. Research | Competitors, pricing checks, questions for owner interviews |

If a Tier 3 answer has not come in 48 hours and it blocks the launch path, it goes to the top of the brief marked `BLOCKING LAUNCH`.

## 4. The Daily Brief (keep it under one screen)

1. **Done since last review:** 3 lines at most.
2. **Needs your OK:** at most 5 items. Each one: the question, my recommendation, what happens if you do not answer, what it blocks.
3. **For the team:** Dev A, Dev B, Staff 1 and 2 tasks with the exact commands and what to look for.
4. **Next 2 days:** what Claude will do without asking.
5. **Numbers:** tests written / run / passing, launch-date confidence (high, medium, low and why), AI cost per gym when data exists.

## 5. Evidence rules (do not relax)

- "Written, not yet tested" until a human has run it. Never say "done" for untested code.
- Separate fact, source and assumption in every estimate, price or market claim.
- Marketing says only what `docs/MARKETING_CLAIMS.md` allows. Update that file in the same commit as any feature change.
- Every query on tenant data filters by subscriber. Every new route gets a test.
- Never put secrets or passwords in git, docs or chat.
- Never push to `main`, deploy, charge money or message real customers without a Tier 3 approval.

## 6. GitHub plan note

Repos are private on the GitHub Free plan, which has no protected branches or required reviews for private repos. "Never push to `main`"
is a rule we follow, not one GitHub enforces. Revisit if a paid plan is bought.
