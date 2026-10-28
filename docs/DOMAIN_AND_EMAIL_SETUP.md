# Domain, email and website pages: list for the dev team

Written 29 Oct 2026. For Dev A to implement. Mohamed owns the domain `afraventures.in`. The server IP is not a secret; passwords and keys never go in this file.

## 1. DNS records (at the domain registrar)
| Name | Type | Value | Note |
| --- | --- | --- | --- |
| fit | A | 200.141.15.246 | Gym |
| salon, mart, dine, cloth, wash, hire | A | 200.141.15.246 | Add each when that product is deployed, not before |
| @ and www | A / CNAME | the company website host | `www` redirects to the main name |
| @ | CAA | letsencrypt.org | Only this authority may issue certificates |
Lower the TTL to 300 before changing, so mistakes are quick to undo. HTTPS comes from the free Let's Encrypt certificate (see `docs/DEPLOY_VPS.md`); never open the site on plain http.

## 2. Company email addresses (same domain, Meta needs one)
| Address | Purpose |
| --- | --- |
| hello@afraventures.in | General and Meta business verification |
| support@afraventures.in | Customer help (shown in the apps) |
| billing@afraventures.in | Invoices and payment questions |
| privacy@afraventures.in | Candidate and customer data requests (DPDP) and the grievance contact |
| noreply@afraventures.in | Sending system email (founder brief, sign-up, reset). Nobody reads it |
Where to host the mailboxes is Mohamed's choice (Hostinger email or Google Workspace). Claude's suggestion: Google Workspace for reliability, a small monthly cost per mailbox (Tier 3, Mohamed decides).

## 3. Email sending set-up (so mail does not land in spam)
- SPF record for the mail host; DKIM enabled in the mail host; DMARC record `v=DMARC1; p=none; rua=mailto:privacy@afraventures.in` to start, tighten to quarantine after a month.
- Put the SMTP settings in `/etc/gymdesk/gymdesk.env` on the server only (never git). Then run the app's test email.
- Send one test email to a Gmail and an Outlook address and check it arrives in the inbox.

## 4. Pages the company website must have (Meta checks these, and the law expects them)
Home (company name exactly as in the Meta business account, what the company does, the address), About, Contact (support email and phone), Privacy Policy, Terms of Service, Refund and Cancellation Policy, and a Grievance contact (name and email). A page per product comes with the landing pages.
- The privacy policy must say: what data is collected, why, how long it is kept, that AI (OpenAI) reads some text such as resumes and questions, and how to ask for deletion.
- Wording of privacy, terms and refund pages: the lawyer reviews them (Mohamed reports the lawyer is engaged; get the approval in writing and file it).
- The pages must not promise anything the products do not do (`docs/MARKETING_CLAIMS.md`).

## 5. Checks before submitting to Meta
1. https://afraventures.in opens and shows the company name and address.
2. All pages above open. 3. support@ and hello@ receive mail. 4. The legal name in the business account matches the certificates.
