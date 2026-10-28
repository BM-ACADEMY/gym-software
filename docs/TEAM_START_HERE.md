# Team start here: where to find things

For Dev A, Dev B, Staff 1 and 2. Nothing in this file is a password. Passwords, keys and tokens never go in git, the task sheet or chat.

## 1. Your task list
Live sheet (only today's tasks): https://docs.google.com/spreadsheets/d/1CU4QfKEwVggyD3QbV81GGDy9ldiwzS0MmD2KNym_agc/edit
Set Status and write results in Notes. Red error text goes in Notes (remove secrets first).

## 2. The code and the instructions
| What | Where |
| --- | --- |
| Gym code | GitHub repo `BM-ACADEMY/gym-software`, branch `phase1-autopilot` (ask Mohamed for access if you cannot open it) |
| How to run the tests | `docs/TEST_RUNBOOK.md` |
| Servers, backups, monitoring | `docs/OPS.md` |
| Variable names for settings | `server/.env.example` (names only, no values) |
| Other products' plans | `docs/products/README.md` |
| Afra AI OS server steps | repo `afraventurepvt-create/afra-ai-os`, folder `docs/runbooks` |

## 3. Logins and keys: where they live
- Not in the repo, not in the sheet, not in chat.
- They live in the team password manager. Which one, and who pays, is the owner's decision (task M-09 area). Until it exists, Dev A keeps a temporary encrypted note and tells Mohamed.
- Each service has one holder. Ask the holder for access to the shared item, not for the password in a message.

| Service | Holder | What you need from it |
| --- | --- | --- |
| GitHub | Mohamed | Repo access |
| MongoDB Atlas | Dev A | Database URL for staging and the test database (separate) |
| API host (staging/live) | Dev A | Environment variable settings |
| Razorpay (test mode first) | Mohamed | TEST key id and secret, webhook secret |
| OpenAI | Mohamed / Dev A | API key with a monthly spend limit |
| Meta / WhatsApp | Mohamed | Phone number id, token, templates |
| Domain DNS (afraventures.in) | Mohamed | Add records when asked |
| Hostinger (Afra AI OS server) | Mohamed | Server IP, then SSH key access for Dev A |
| Sentry / uptime monitor | Dev A | Alerts |

## 4. Test logins (after staging is up)
- Dev A creates the test gyms (Gym 1, Gym 2), a Root Admin test login, and test members, then shares them to Dev B and the staff through the password manager.
- Staging address: `fit.afraventures.in` (app) and `api.fit.afraventures.in` (API) once Dev A finishes task A-05. Not live yet.
- Payments: Razorpay TEST cards only (card 4111 1111 1111 1111, any future date, any CVV).
- Use fake data only. No real member or lead data on staging.

## 5. Who to ask
- Anything broken: write it in the sheet Notes with the task ID. Claude reads the sheet every day and fixes Failed items first.
- Money, accounts, anything customers see: Mohamed.
