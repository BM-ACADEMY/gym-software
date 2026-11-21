#!/usr/bin/env bash
# Off-server copy of the nightly encrypted MongoDB backups, to the Cloudflare R2 bucket "afra-backups".
# WRITTEN, NOT YET RUN on the server. Dev A: read it first, run `dry-run`, then `setup`, `run`, `check`.
#
# Commands (run as root on the server):
#   setup     asks for the R2 key at hidden prompts and saves it in /etc/afraprod/r2.env (mode 600). The key is never printed or put in a command line.
#   dry-run   shows what `run` would upload and delete. Changes nothing.
#   run       uploads backup files that are not in R2 yet (size is checked after each upload), then deletes R2 copies older than KEEP_DAYS.
#   check     lists what is in R2 (name, size, date). Changes nothing.
#   fetch <name> <dir>   downloads one backup from R2 into <dir> (an empty folder) for the restore test, and checks its size.
#
# Settings (environment or /etc/afraprod/r2.env): R2_ENDPOINT, R2_BUCKET, R2_PREFIX, BACKUP_DIR, KEEP_DAYS, MIN_KEEP.
# Only encrypted dumps should be in BACKUP_DIR. Look at the dry-run list: if you see a plain .json, .bson or .gz that is not encrypted, stop.
# Schedule (after the 03:00 IST dump): add to root's crontab:  30 3 * * * /srv/afraprod/bootstrap/deploy/tools/backup-to-r2.sh run >> /var/log/afraprod/backup-r2.log 2>&1
set -u
ENV_FILE="${R2_ENV_FILE:-/etc/afraprod/r2.env}"
# shellcheck disable=SC1090
[ -r "$ENV_FILE" ] && . "$ENV_FILE"
R2_ENDPOINT="${R2_ENDPOINT:-https://14d7f2620d0f30a0c155d15ea926d0f9.r2.cloudflarestorage.com}"
R2_BUCKET="${R2_BUCKET:-afra-backups}"
R2_PREFIX="${R2_PREFIX:-mongo/}"
BACKUP_DIR="${BACKUP_DIR:-/srv/afraprod/backups}"
KEEP_DAYS="${KEEP_DAYS:-7}"
MIN_KEEP="${MIN_KEEP:-3}"     # never delete the newest MIN_KEEP objects, whatever their age
SETTLE_SECS="${SETTLE_SECS:-120}"  # skip a file changed in the last two minutes (still being written)
SIGV4="aws:amz:auto:s3"

die() { echo "ERROR: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "$1 is not installed"; }
need curl; need sed; need awk; need date; need stat

# Every call to R2 goes through here. The key is passed to curl through a config on stdin, so it never shows in `ps`.
r2() { # r2 <curl args...> URL
  [ -n "${R2_ACCESS_KEY_ID:-}" ] && [ -n "${R2_SECRET_ACCESS_KEY:-}" ] || die "no key yet: run 'setup' first"
  printf 'user = "%s:%s"\n' "$R2_ACCESS_KEY_ID" "$R2_SECRET_ACCESS_KEY" | curl -sS --fail-with-body --aws-sigv4 "$SIGV4" -K - "$@"
}
url() { printf '%s/%s/%s' "$R2_ENDPOINT" "$R2_BUCKET" "$1"; }

# Lists objects under the prefix as lines: "<key>\t<size>\t<epoch seconds>"
list() {
  local xml; xml="$(r2 "$R2_ENDPOINT/$R2_BUCKET?list-type=2&prefix=$R2_PREFIX&max-keys=1000")" || return 1
  printf '%s' "$xml" | sed 's/<Contents>/\n<Contents>/g' | grep '^<Contents>' | while IFS= read -r c; do
    k="$(printf '%s' "$c" | sed -n 's|.*<Key>\([^<]*\)</Key>.*|\1|p')"
    s="$(printf '%s' "$c" | sed -n 's|.*<Size>\([0-9]*\)</Size>.*|\1|p')"
    m="$(printf '%s' "$c" | sed -n 's|.*<LastModified>\([^<]*\)</LastModified>.*|\1|p')"
    e="$(date -u -d "$m" +%s 2>/dev/null || echo 0)"
    printf '%s\t%s\t%s\n' "$k" "$s" "$e"
  done
}

local_files() { # regular files that have settled
  local now; now="$(date +%s)"
  find "$BACKUP_DIR" -maxdepth 1 -type f 2>/dev/null | sort | while IFS= read -r f; do
    [ $(( now - $(stat -c %Y "$f") )) -ge "$SETTLE_SECS" ] && printf '%s\n' "$f"
  done
}

cmd_setup() {
  [ "$(id -u)" -eq 0 ] || die "run as root"
  umask 077
  local id sec
  read -r -p "R2 Access Key ID: " id
  read -r -s -p "R2 Secret Access Key (hidden): " sec; echo
  [ -n "$id" ] && [ -n "$sec" ] || die "both are needed"
  mkdir -p "$(dirname "$ENV_FILE")"
  { printf 'R2_ACCESS_KEY_ID=%q\n' "$id"; printf 'R2_SECRET_ACCESS_KEY=%q\n' "$sec"; } > "$ENV_FILE"
  chmod 600 "$ENV_FILE"; chown root:root "$ENV_FILE"
  echo "Saved to $ENV_FILE (mode 600). Next: $0 check"
}

plan() { # prints UPLOAD / DELETE lines
  local remote f key rsize; remote="$(list)" || die "could not list the bucket (wrong key, endpoint or bucket?)"
  local_files | while IFS= read -r f; do
    key="$R2_PREFIX$(basename "$f")"; rsize="$(printf '%s\n' "$remote" | awk -F'\t' -v k="$key" '$1==k{print $2}')"
    if [ -z "$rsize" ]; then echo "UPLOAD	$f"; elif [ "$rsize" != "$(stat -c %s "$f")" ]; then echo "UPLOAD	$f	(size differs: re-upload)"; fi
  done
  local cutoff n=0; cutoff=$(( $(date +%s) - KEEP_DAYS * 86400 ))
  # newest first; the newest MIN_KEEP are never deleted
  printf '%s\n' "$remote" | grep . | sort -t$'\t' -k3,3nr | while IFS=$'\t' read -r k s e; do
    n=$((n + 1))
    if [ "$n" -gt "$MIN_KEEP" ] && [ "$e" -gt 0 ] && [ "$e" -lt "$cutoff" ]; then echo "DELETE	$k"; fi
  done
}

cmd_dry() { echo "Bucket: $R2_BUCKET  prefix: $R2_PREFIX  backups: $BACKUP_DIR  keep: $KEEP_DAYS days (newest $MIN_KEEP always kept)"; local p; p="$(plan)" || exit 1; [ -n "$p" ] && printf '%s\n' "$p" || echo "Nothing to do."; echo "(dry-run: nothing changed)"; }

cmd_run() {
  local p line act arg rc=0 key; p="$(plan)" || exit 1
  [ -n "$p" ] || { echo "$(date -Is) nothing to do"; return 0; }
  while IFS=$'\t' read -r act arg _; do
    case "$act" in
      UPLOAD) key="$R2_PREFIX$(basename "$arg")"
        if r2 -o /dev/null -T "$arg" "$(url "$key")"; then
          got="$(r2 -I "$(url "$key")" | tr -d '\r' | awk 'tolower($1)=="content-length:"{print $2}')"
          if [ "$got" = "$(stat -c %s "$arg")" ]; then echo "$(date -Is) uploaded $key ($got bytes)"; else echo "$(date -Is) SIZE MISMATCH for $key (local $(stat -c %s "$arg"), R2 $got)" >&2; rc=1; fi
        else echo "$(date -Is) UPLOAD FAILED $key" >&2; rc=1; fi ;;
      DELETE) if [ "$rc" -eq 0 ]; then r2 -o /dev/null -X DELETE "$(url "$arg")" && echo "$(date -Is) deleted old $arg" || { echo "$(date -Is) DELETE FAILED $arg" >&2; rc=1; }; else echo "$(date -Is) skipped delete of $arg because an upload failed" >&2; fi ;;
    esac
  done <<EOF
$p
EOF
  return "$rc"
}

cmd_check() { local l; l="$(list)" || die "could not list the bucket"; [ -n "$l" ] || { echo "Bucket is empty."; return 0; }
  printf '%s\n' "$l" | sort -t$'\t' -k3,3nr | while IFS=$'\t' read -r k s e; do printf '%s  %12s bytes  %s\n' "$(date -u -d "@$e" +%F\ %T)" "$s" "$k"; done; }

cmd_fetch() { local name="${1:-}" dir="${2:-}"; [ -n "$name" ] && [ -n "$dir" ] || die "usage: fetch <file name> <empty folder>"
  mkdir -p "$dir"; [ -z "$(ls -A "$dir")" ] || die "$dir is not empty"
  r2 -o "$dir/$(basename "$name")" "$(url "$R2_PREFIX$(basename "$name")")" || die "download failed"
  echo "Downloaded $(stat -c %s "$dir/$(basename "$name")") bytes to $dir. Now restore it as in the restore test and compare with live."; }

case "${1:-}" in
  setup) cmd_setup ;;
  dry-run) cmd_dry ;;
  run) cmd_run ;;
  check) cmd_check ;;
  fetch) shift; cmd_fetch "$@" ;;
  *) sed -n '2,14p' "$0"; exit 2 ;;
esac
