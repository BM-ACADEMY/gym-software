#!/usr/bin/env bash
# Nightly database backup. Written 13 Nov 2026, NOT YET RUN by a person.
# What it does: mongodump of every product database, compressed, encrypted with a passphrase file, copied OFF the server with rclone.
# What it never does: print a password, a connection string or the passphrase. It reads them from files only the server user can read.
# Settings file (default /etc/afra/backup.env, mode 600), names only here:
#   BACKUP_MONGODB_URI_FILE   a file holding the Atlas connection string for a READ-ONLY backup user (one line)
#   BACKUP_PASSPHRASE_FILE    a file holding the encryption passphrase (keep a second copy in the owner's password manager)
#   BACKUP_RCLONE_REMOTE      e.g. gdrive-backup:afra-backups   (an rclone remote set up once by the owner)
#   BACKUP_KEEP_DAYS          how many days to keep on the remote (default 30)
set -euo pipefail
ENV_FILE="${AFRA_BACKUP_ENV:-/etc/afra/backup.env}"
[ -r "$ENV_FILE" ] || { echo "No settings file at $ENV_FILE"; exit 2; }
# shellcheck disable=SC1090
. "$ENV_FILE"
for v in BACKUP_MONGODB_URI_FILE BACKUP_PASSPHRASE_FILE BACKUP_RCLONE_REMOTE; do [ -n "${!v:-}" ] || { echo "Missing setting $v"; exit 2; }; done
for f in "$BACKUP_MONGODB_URI_FILE" "$BACKUP_PASSPHRASE_FILE"; do [ -r "$f" ] || { echo "Cannot read $f"; exit 2; }; done
for c in mongodump openssl rclone; do command -v "$c" >/dev/null || { echo "Install $c first"; exit 2; }; done
KEEP="${BACKUP_KEEP_DAYS:-30}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK="$(mktemp -d)"; chmod 700 "$WORK"; trap 'rm -rf "$WORK"' EXIT
OUT="$WORK/afra-db-$STAMP.archive.gz.enc"
# The connection string is passed through a config file, not the command line, so it never shows in the process list.
URI="$(cat "$BACKUP_MONGODB_URI_FILE")"; printf 'uri: %s\n' "$URI" > "$WORK/dump.yml"; chmod 600 "$WORK/dump.yml"; unset URI
mongodump --config="$WORK/dump.yml" --archive --gzip 2>"$WORK/dump.log" \
  | openssl enc -aes-256-cbc -pbkdf2 -salt -pass "file:$BACKUP_PASSPHRASE_FILE" -out "$OUT" \
  || { echo "Backup FAILED (details are in a temporary log that is deleted; run by hand to see)"; exit 1; }
SIZE=$(stat -c %s "$OUT"); [ "$SIZE" -gt 1024 ] || { echo "Backup FAILED: the file is suspiciously small ($SIZE bytes)"; exit 1; }
sha256sum "$OUT" | cut -d' ' -f1 > "$OUT.sha256"
rclone copyto "$OUT" "$BACKUP_RCLONE_REMOTE/$(basename "$OUT")" --quiet
rclone copyto "$OUT.sha256" "$BACKUP_RCLONE_REMOTE/$(basename "$OUT").sha256" --quiet
rclone delete "$BACKUP_RCLONE_REMOTE" --min-age "${KEEP}d" --quiet || true
echo "Backup OK: $(basename "$OUT") ($SIZE bytes), copied to the remote, files older than ${KEEP} days removed."
