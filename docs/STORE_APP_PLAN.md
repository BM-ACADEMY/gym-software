# Store app plan (Play Store first, App Store later)

Written 2 Nov 2026 night. Plan only, no code. Kamarudeen reversed his "skip" message and asked to plan it (D-26 withdrawn, D-27).
Facts below are marked **Fact** (source), **Assumption**, or **Unchecked**.

## 1. Do we need it?
Not for launch (the installable web app works). Reasons to do it: trust ("is it in the Play Store?"), findability, and one place for push alerts. Reason against: review rules, yearly cost and extra support. So the plan is staged, with a go/no-go gate.

## 2. Approach (Assumption: cheapest path that reuses the web app)
- **Android: Trusted Web Activity** (a thin Android shell that opens the installed web app full screen). Tool: Bubblewrap. Same code, no rewrite. Needs a `/.well-known/assetlinks.json` file on each product domain.
- **iPhone: Capacitor wrapper**, only after Android works. Apple often rejects apps that are only a website in a frame, so the iOS build needs real phone features (camera QR scan for check-in, push alerts, share) to be accepted. Assumption, not checked.
- **One app per product** (GymDesk first, then Hire; the rest later) because each has its own name, icon and domain. Customer apps (members) are NOT in this plan; owners only.

## 3. Accounts and costs
| Item | Detail | Status |
|---|---|---|
| Apple Developer Program | 99 USD a year, shown in local currency at enrollment. Organization needs a legal entity, a free 9-digit D-U-N-S number, someone who can sign for the company, a work email on the company domain and a working company website | **Fact** (developer.apple.com/support/enrollment) |
| Google Play developer account | One-time fee, about 25 USD | **Unchecked** (recalled, not confirmed this session) |
| Google closed-test rule | Personal accounts created after 13 Nov 2023 need a closed test with at least 12 testers opted in for 14 days before production. The page does not say whether organization accounts are exempt | **Fact** for personal (support.google.com/googleplay/android-developer/answer/14151465); **Unchecked** for organization |
| Time | Android about 3 to 4 working days of dev, plus store review; if the 12-tester rule applies, 14 more days | **Assumption** |
Register as **Afra Ventures Pvt Ltd (organization)**, not as an individual: avoids the personal-account test rule if it is exempt and looks right to customers. Needs the D-U-N-S number first (Kamarudeen applies; free; can take days to weeks, Unchecked).

## 4. Risks to settle before building
1. **Payments inside the app (Unchecked, important):** both stores have rules for selling digital subscriptions inside an app. Our plans are sold to businesses on Razorpay. Safest start: the app has no "buy plan" screen; owners subscribe on the website. Dev A / lawyer to confirm the rule that applies.
2. **Privacy:** both stores need a privacy policy link and a data-safety form that matches what we collect. Reuse the lawyer-approved policy (M-15); no store submission before it is approved.
3. **Push alerts, camera, offline:** the web app's service worker never stores personal data; keep that in the wrapper.
4. **No claims in the store listing** beyond `MARKETING_CLAIMS.md` and what a person has seen working.
5. **Signing keys:** the Android signing key is kept only in Dev A's password manager, never in git or chat.

## 5. Steps and owners
| # | Step | Owner | Needs |
|---|---|---|---|
| S1 | Apply for D-U-N-S for Afra Ventures Pvt Ltd | Kamarudeen | company papers |
| S2 | Phone-install tests PWA-T1 to T4 pass | Staff 1, 2 | sheet v4 |
| S3 | Create Play Console account (organization); pay fee | Kamarudeen / Dev A | S1 |
| S4 | Add `assetlinks.json` to the gym site; build the TWA with Bubblewrap; test on 3 real phones | Dev A | gym live on its domain |
| S5 | Store listing: name, screenshots (fake data only), Tamil and English text, privacy link, data-safety form | Claude drafts, Kamarudeen approves | M-15 privacy policy |
| S6 | Closed test (12 testers x 14 days if required), then production | Staff + friends gyms | S4, S5 |
| S7 | Go/no-go for iPhone: enroll in Apple program, Capacitor build with camera QR and push | Dev A | S6 results, 99 USD |
| S8 | Hire app (same method) | Dev A | Hire live |

## 6. Gate to start (suggested)
Start S3/S4 only when: gym is live on its domain, PWA tests pass, privacy policy approved, and at least a few paying gyms exist (the "n of 10" line in the Daily Brief stays as the reminder). Kamarudeen can bring the date forward.

## 7. What Claude does now (no waiting)
Draft the store listing text (S5, English and Tamil), the `assetlinks.json` template and a Bubblewrap checklist for Dev A. Nothing is built or submitted.
