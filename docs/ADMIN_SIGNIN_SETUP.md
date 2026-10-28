# Super Admin sign-in: set-up (for Dev A, owner types the password)

Written 29 Oct 2026. Code: `apps/admin/src/auth*`. Written, not yet tested by a person. No extra npm packages are needed.

## What it does
Email + password (scrypt) then a 6-digit code from an authenticator app (TOTP). Eight one-time recovery codes. Session cookie lasts 8 hours (HttpOnly, Secure, SameSite=Strict). Five wrong tries lock that email and address for 15 minutes. A code can be used once. Every sign-in, failure and recovery-code use is written to an audit file (never a password or code). If any setting below is missing, the server answers 503 on every route and stays closed.

## Settings (server settings file only, mode 600, never in git or chat)
| Name | Value |
| --- | --- |
| ADMIN_SESSION_SECRET | 40+ random characters: `openssl rand -base64 48` |
| ADMIN_MFA_KEY | 32 random bytes, base64: `openssl rand -base64 32` (encrypts the two-step secrets; losing it means re-creating the admin) |
| ADMIN_USERS_FILE | e.g. `/var/lib/afra-admin/users.json` (folder owned by the admin service user, mode 700) |
| ADMIN_AUDIT_FILE | e.g. `/var/lib/afra-admin/audit.log` |
| ADMIN_PRODUCTS | `gym,hire` (add a name when a product goes live) |
| ADMIN_URL_GYM / ADMIN_KEY_GYM | `https://fit.afraventures.in` and that product's `INTERNAL_API_KEY` (24+ characters) |
| PORT | 5010 (nginx proxies `admin.afraventures.in` to it) |

## Steps
1. Create the folder and service user like the other apps (`docs/DEPLOY_VPS.md` recipe), port 5010, nginx name `admin.afraventures.in`, HTTPS from Let's Encrypt.
2. In nginx pass the real client address (`proxy_set_header X-Real-IP`) and set `app.set('trust proxy', 1)` if the lock-out should use it (Claude to confirm this with Dev A when testing).
3. Put the settings in the settings file. Run `node apps/admin/scripts/create-admin.js --email <owner email>` AS THE OWNER at the server terminal. It asks for the password twice (hidden), then shows the authenticator secret and 8 recovery codes once. Save recovery codes in the password manager.
4. Start the service. `GET /api/health` should say `signIn: true`.
5. Test: wrong password fails; right password then a wrong code fails; right code works; the same code again fails; after 5 failures the lock message appears.
6. Optional extra: allow only the owner's IP at nginx for `admin.afraventures.in`.

## Not covered yet
Adding more admins from the screen (use the script for now), password change screen, resetting a lost phone (run the script again with the same email after removing the user from the file). Dev B to attack this before real use.
