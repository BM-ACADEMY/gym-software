# Launch gate (gym): tick each line, then Kamarudeen decides yes or no

Rule: a line is ticked only when a person has seen it work and wrote the date and name. Written, not yet tested, does not count.

## A. Before inviting any gym (soft launch)
- [ ] Staging server up; old demo passwords changed (A-01, A-15, M-11). Dev A, date: ____
- [ ] Server and Hire tests green with no red test, including the 3 Nov tenant fix (TST-S1, TST-S2, HIR-T1). Dev A
- [ ] Staff screen tests pass (GYM-T1 to T5, PWA-T1 to T4). Staff 1 and 2
- [ ] Dev B attack rows pass (ATK-N1 to N3, B-H1 to B-H3). Nothing from another gym; expired accounts read only. Dev B
- [ ] Razorpay: one real small payment works end to end and the invoice opens (PAY-1, PAY-2). Monisha
- [ ] CA has confirmed invoice wording and the SAC code (M-04, M-12). Kamarudeen
- [ ] Lawyer has approved terms, privacy and refund pages in writing; filed (M-15, LAW-1). Kamarudeen
- [ ] Refund window confirmed (M-16). Kamarudeen
- [ ] Support number and email work: someone answers +91 78269 97187 (M-14). Kamarudeen
- [ ] Backups on and one restore tested (BK-1). Dev A

## B. Soft launch (10 invited gyms, paid plans)
- [ ] 10 gyms active on paid plans
- [ ] No payment or data incident for 7 days
- [ ] AI cost per gym checked after one week (1E-05); limits adjusted if needed
- [ ] WhatsApp: Meta verified and templates approved, or the gym runs with "tap to open WhatsApp" only (decision recorded)

## C. Public launch and ads
- [ ] A and B all ticked
- [ ] Landing and pricing pages say only what MARKETING_CLAIMS.md allows and what a person saw working
- [ ] Tamil and Hindi text read by a native reader (M-06), or those languages left off the ads
- [ ] `PUBLIC_SIGNUP=true` switched on by Dev A on a quiet morning, not on deploy day
- [ ] Ads start at Rs 1,000 a day; cost per paying gym watched weekly (target under Rs 3,000)

## Not needed for the gym launch
Store app (STORE-01), Salon, Mart, Dine, Cloth, Wash, Hire (each has its own gate later).
