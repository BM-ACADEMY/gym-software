# Nightly backup (written 13 Nov 2026, not yet run by a person)

Decision (Kamar, 13 Nov): nightly dump, not paid Atlas for now. The free Atlas tier (M0) has no backups of its own, so this is the only safety net.

## One-time set-up on the server (owner types every secret; Claude never sees them)
1. Install the tools: `sudo apt-get install -y mongodb-database-tools rclone openssl` (if the package name differs, say so and we adjust).
2. In Atlas create a **read-only** database user for backups and a second user for the restore drill. Save each connection string in a file only the server user can read:
   `sudo install -m 600 /dev/null /etc/afra/backup.uri` then paste into it with an editor. Same for `/etc/afra/restore.uri`.
3. Choose a passphrase of 20+ random characters. Put it in `/etc/afra/backup.pass` (mode 600) **and** in the owner's password manager. Without it a backup cannot be opened.
4. `rclone config` once: make a remote (for example Google Drive, folder `afra-backups`, a Google account that is NOT the server's). The owner signs in on his own screen.
5. Create `/etc/afra/backup.env` (mode 600):
   `BACKUP_MONGODB_URI_FILE=/etc/afra/backup.uri` / `BACKUP_PASSPHRASE_FILE=/etc/afra/backup.pass` / `BACKUP_RCLONE_REMOTE=<remote>:afra-backups` / `RESTORE_MONGODB_URI_FILE=/etc/afra/restore.uri` / `BACKUP_KEEP_DAYS=30`
6. Run once by hand: `sudo bash deploy/backup/backup.sh`. Expect `Backup OK`. Check the file appears in the remote.
7. Schedule: `sudo crontab -e` then `30 2 * * * /srv/afra/current/deploy/backup/backup.sh >> /var/log/afra-backup.log 2>&1` (02:30 server time).
8. **Restore drill (a person, once):** download one file from the remote, run `bash deploy/backup/restore-drill.sh <file>`, look at the scratch database, drop it, write the date in `docs/LAUNCH_GATE.md`.

## Rules
- A backup on the same server is not a backup: the remote must be somewhere else.
- A backup counts only after the restore drill worked once.
- Check `/var/log/afra-backup.log` weekly (the Monday checklist). If a night fails, nobody is told by itself: that is a gap until an alert is added.
- Backups hold customer personal data (names, phones). Keep the remote folder private and the passphrase safe. Deleting a customer on request does not remove them from old backups until those expire (30 days): say so in the privacy notice (lawyer item).
- Move to paid Atlas continuous backup before real customers' data goes in, when the owner decides.
