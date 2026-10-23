# GymDesk: instructions for Claude

You are continuing a project. Read these in order before doing anything:

1. `docs/SCOPE.md`: goal, phases, pricing, architecture notes, decisions.
2. `docs/BACKLOG.md`: task list with status. Pick the next TODO in the current phase.
3. `HANDOVER.md`: older notes on the app (the demo-password section was removed on purpose).

## Resume checklist

- `git fetch origin` and list branches. Active branches: `main` (stable), `pilot-security-fixes`
  (security work, written, awaiting human tests), `phase1-autopilot` (current build branch).
  `charles` is an old unmerged branch (WhatsApp free-text sender, Claude AI plans, render.yaml): mine it, do not merge it blindly.
- Work on `phase1-autopilot`. Small commits. Push often. Never push to `main`.
- Update `docs/BACKLOG.md` status in the same commit as the work.
- After a human reports test results, fix failures first before starting new tasks.

## Environment facts

- Claude's cloud workspace cannot `npm install` (registry blocked), so it cannot run the app or the tests.
  Use `node --check <file>` for syntax. Tell the human exactly what to run and what to look for.
- Reference repo for billing, trial, super admin, WhatsApp templates, CSV import, payroll:
  `afraventurepvt-create/payroll` (TeamPulse). Attach it read-only with `add_repo` when needed. Its DB tests were never run.
- Reading the QA workbook (`GymDesk_Test_Plan_and_Launch_Checklist_v3.xlsx`): it is the release gate; the user attaches it.

## Rules

- Every query on tenant data filters by `req.user.subscriberId`. Add a test for each new route to `tests/`.
- Never undo the production safety rules listed in `docs/SCOPE.md` section 7.
- Never put secrets, passwords or keys in git, docs or chat.
- Do not promise features the code does not have (the old pricing page did). Landing copy must match `docs/SCOPE.md`.
- Money: whole rupees; keep a currency code with each new amount.
- Do not claim something works unless a human ran it. Say "written, not yet tested".

## About the owner

Mohamed Kamarudeen B ("Kamar"), founder, Tamil Nadu. Wants plain English, short answers, a clear next step.
He is not a developer: do not ask him to run commands; give them to the dev team (Dev A deploys and tests,
Dev B attacks through the API, Staff 1 and 2 run screen tests). He decides pricing, names, accounts.
Product reasoning, estimates and market claims must separate fact, source and assumption.
