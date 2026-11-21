# Two-year market and money model (draft 1, 1 Nov 2026)

Status: a planning aid, not a forecast. Every number marked Assumption is a guess until measured. Replace each with real numbers after the December pilot. Written for Kamarudeen; no customer data inside.

## 1. What is fact, source or assumption

| Item | Value | Type |
| --- | --- | --- |
| Indian small businesses are interested in AI | Vi Business study: 57% see AI as vital, 25% already use it ([cxotoday](https://cxotoday.com/startups-smes/over-57-of-msmes-view-ai-as-a-vital-scale-driver-25-already-deploy-ai-tools/)); Salesforce report says 78% use it ([indiaai.gov.in](https://indiaai.gov.in/article/78-of-indian-smbs-leverage-ai-for-business-success-salesforce-report)) | Source (vendor surveys, headlines only read here, bigger and more online firms; direction only) |
| Indian SaaS growing | About $35 billion by 2027 ([Business Standard on Bain](https://www.business-standard.com/article/companies/indian-saas-companies-to-reach-35-bn-by-2027-bain-company-report-123012401483_1.html)) | Source (headline only) |
| Tiny and older owners' AI use | Not found | Unknown |
| Plan prices | Gym Solo 249, Starter 599, Growth 999, Pro 1,999 a month excl. GST; yearly = 10 months (docs/SCOPE.md section 6) | Fact (our decision); Hire 999/1,999/3,999 are assumptions |
| Average revenue per paying business | Rs 700 a month excl. GST | Assumption (Solo, yearly and launch offers pull the average below list) |
| Variable cost per business | Rs 114 a month = about Rs 100 AI and WhatsApp + 2% gateway | Assumption (AI from docs/AI_COST_MODEL.md at typical use, old OpenAI prices; gateway fee not checked) |
| Monthly cancellations | 5% | Assumption |
| Cost to win one paying business | Rs 3,000 (launch target in SCOPE) | Assumption |
| Servers and database | Rs 15,000 a month | Assumption (pilot size; Atlas M10 not included; M-09 decides) |
| People | **Rs 1,00,000 a month** (Kamarudeen, 1 Nov: "make it as 1L") | Decision for this model; the real split comes with the team plan |

## 2. Result (24 months, revenue excludes 18% GST, excludes the owner's own pay beyond the Rs 1 lakh)

| | Slow (10 new a month, Rs 30,000 ads) | Middle (25 new, Rs 75,000 ads) | Fast (60 new, Rs 1,80,000 ads) |
| --- | --- | --- | --- |
| Paying businesses, month 12 / 24 | 92 / 142 | 230 / 354 | 552 / 850 |
| Monthly revenue, month 24 | Rs 0.99 lakh | Rs 2.48 lakh | Rs 5.95 lakh |
| Monthly profit or loss, month 24 | loss Rs 62,000 | profit Rs 17,000 | profit Rs 2.03 lakh |
| First profitable month | not in 24 months | month 21 | month 11 |
| Most cash tied up at the low point | Rs 22.4 lakh | Rs 15.1 lakh | Rs 12.8 lakh |
| Total after 24 months | loss Rs 22.4 lakh | loss Rs 14.7 lakh | profit Rs 3.4 lakh |

## 3. Reading it

- **Break-even number of paying businesses** (at Rs 586 left per business after variable cost): about 196 with no ads, about 324 with Rs 75,000 of ads, about 503 with Rs 1,80,000 of ads.
- **Cancellations move the result most.** Middle case at 3% a month: 432 businesses, profit Rs 63,000 a month, first profit in month 17. At 8%: 270 businesses, loss Rs 32,000 a month, never profitable in 24 months. Keeping businesses is worth more than winning more.
- **Ads alone are not enough.** Rs 1,000 a day at Rs 3,000 each wins about 10 paying a month (the slow column). Referrals, partners or a sales person must lift it.
- **Cash need is real:** plan for Rs 12 to 22 lakh of working money unless sign-ups are fast.

## 4. Not in the model yet

GST claim rules (CA, M-04); the owner's and developers' real pay; real OpenRouter prices and a week of measured tokens (task 1E-05); Atlas M10 and a bigger server; competitor check by name; refunds (7-day draft); WhatsApp marketing packs (prepaid, so assumed neutral); payment gateway fee check.

## 5. Next

1. Kamarudeen sends: team cost split, cash limit, today's customers and income (gym and payroll).
2. Pilot (December) gives: cost per paying business, cancellations, plan mix, AI cost per business. Replace the four assumptions above and re-run.
3. Re-run with `python3` scenario script is not kept in the repo; rebuild from the table in section 1 if needed.
