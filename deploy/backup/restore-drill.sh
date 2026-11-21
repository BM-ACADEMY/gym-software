#!/usr/bin/env bash
# Restore check. Written 13 Nov 2026, NOT YET RUN by a person. A backup counts only after this has worked once.
# Usage: restore-drill.sh <backup file .enc>
# It restores into a SCRATCH database called restore_drill_<time> (never the live ones), counts the collections, then drops the scratch database.
# Needs a connection string for a user who may create a scratch database (file path in RESTORE_MONGODB_URI_FILE) and the passphrase file.
set -euo pipefail
FILE="${1:-}"; [ -r "$FILE" ] || { echo "Usage: $0 <backup file>"; exit 2; }
ENV_FILE="${AFRA_BACKUP_ENV:-/etc/afraprod/backup.env}"; [ -r "$ENV_FILE" ] && . "$ENV_FILE"
for v in RESTORE_MONGODB_URI_FILE BACKUP_PASSPHRASE_FILE; do [ -r "${!v:-/nonexistent}" ] || { echo "Missing or unreadable $v"; exit 2; }; done
WORK="$(mktemp -d)"; chmod 700 "$WORK"; trap 'rm -rf "$WORK"' EXIT
SCRATCH="restore_drill_$(date -u +%H%M%S)"
URI="$(cat "$RESTORE_MONGODB_URI_FILE")"; printf 'uri: %s\n' "$URI" > "$WORK/r.yml"; chmod 600 "$WORK/r.yml"; unset URI
openssl enc -d -aes-256-cbc -pbkdf2 -pass "file:$BACKUP_PASSPHRASE_FILE" -in "$FILE" \
 | mongorestore --config="$WORK/r.yml" --archive --gzip --nsFrom='$db$.$col$' --nsTo="$SCRATCH.\$db\$_\$col\$" --quiet
echo "Restored into scratch database $SCRATCH (each collection is named <product database>_<collection>). Open it in Atlas or mongosh and check the shop and member counts look right."
echo "When you have looked, drop it: in mongosh run  use $SCRATCH; db.dropDatabase()"
echo "Then write today's date in docs/LAUNCH_GATE.md next to 'restore test'."
