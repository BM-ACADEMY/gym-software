# DNS records to add (for Arshad or Kamar), 13 Nov 2026
Domain: afraventures.in. Add one **A record** for each name, all pointing to the server **200.141.15.246**. TTL: the lowest the panel allows (300 or 600) until everything works.

| Name (host) | Becomes | Product |
|---|---|---|
| fit | fit.afraventures.in | Fit (gym) |
| groom | groom.afraventures.in | Salon / Clinic |
| mart | mart.afraventures.in | Mart |
| dine | dine.afraventures.in | Dine |
| cloth | cloth.afraventures.in | Cloth |
| wash | wash.afraventures.in | Wash |
| hire | hire.afraventures.in | Hire |
| admin | admin.afraventures.in | Super Admin |

Kamar confirmed on 13 Nov: use these names (all but `fit` were drafts). If the panel already has an old record for `fit`, check it points to the same address before changing it.
Check (anyone): `dig +short groom.afraventures.in` should print 200.141.15.246. It can take up to an hour.
Do not add any other record, and do not touch the email (MX, SPF, DKIM) records.
