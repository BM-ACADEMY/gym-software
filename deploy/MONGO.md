# MongoDB Atlas for the products (written 13 Nov 2026, not yet tested by a person)

**Rule: one database per product, and one database user per product.** A mistake or a leak in one product can then never touch another product's data.

## What the owner does in Atlas (he types every password himself; nobody pastes one into chat, git or a doc)

1. Create one Atlas project, for example `afra-products`. Cluster region: **Mumbai (ap-south-1)**, the same city as the VPS. Free tier (M0) is fine for the first trial; move to a paid tier before real customers (see Backups).
2. Create eight database users, one per product, named `gym`, `hire`, `salon`, `mart`, `dine`, `cloth`, `wash`, `admin`.
   - Password: let Atlas generate it ("Autogenerate secure password"), copy it straight into that product's settings file on the server (`/etc/afraprod/<product>.env`), and do not keep it anywhere else.
   - Role: "Read and write to a specific database" and pick that product's database only (for example `afra_salon`). Nothing broader. Never use "Atlas admin" or "Read and write to any database".
3. Network Access (the IP allow-list): add **200.141.15.246 only** (the VPS). Delete the "0.0.0.0/0" entry if Atlas created one. If the VPS address ever changes, change it here too.
4. For each product, copy the connection string ("Drivers", Node.js) and set `MONGODB_URI` in `/etc/afraprod/<product>.env` with that product's user and database name, e.g. `mongodb+srv://<user>:<password>@<cluster-host>/afra_salon?retryWrites=true&w=majority`. The database name is the part after the host.
5. The Super Admin (`admin`) reads each product only through the product's own `/api/internal/admin-summary` route. It has its own small database (`afra_admin`) and no access to the product databases.

| Product | Database name (suggested) | Atlas user |
|---|---|---|
| Gym | afra_gym | gym |
| Hire | afra_hire | hire |
| Salon | afra_salon | salon |
| Mart | afra_mart | mart |
| Dine | afra_dine | dine |
| Cloth | afra_cloth | cloth |
| Wash | afra_wash | wash |
| Super Admin | afra_admin | admin |

If the Gym already has a live database, keep its existing name and user; only add the allow-list entry.

## Backups (decided 13 Nov: nightly dump, see deploy/backup/README.md; paid Atlas later)

- The **free tier (M0) has no backups.** Do not put real customer data on it. If it is used for the trial, say so to everyone who tests, and export by hand (`mongodump`) before any risky change.
- Before launch the owner decides: a paid Atlas tier with **continuous cloud backup** (simplest; the owner turns it on in Atlas under Backup), or a nightly `mongodump` from the VPS to storage outside the VPS. A backup on the same VPS is not a backup.
- A backup counts only after a **restore test** into a scratch database has been done once by a person. Write the date in the launch checklist.
- Owner decision needed: which option, and who checks the restore.

## Checks after setup

- Wrong password must fail; a product user must not be able to read another product's database (try it once from Atlas's own tools or `mongosh`).
- From anywhere except the VPS, the connection must be refused (the allow-list).
