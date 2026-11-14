#!/usr/bin/env bash
# Puts the Razorpay keys into the server env file of each billing product (salon mart dine cloth wash). Run as root on the server.
# WRITTEN, NOT YET RUN on the server. The gym keeps using Root Admin > Settings > Payment gateway (its own database); this is for the others,
# because each product has its own database and cannot see the gym's setting.
#
#   sudo bash deploy/tools/set-razorpay-keys.sh                 # all five products, TEST keys only (key id must start rzp_test_)
#   sudo bash deploy/tools/set-razorpay-keys.sh salon mart      # only these
#   sudo bash deploy/tools/set-razorpay-keys.sh --live          # allow a live key (rzp_live_). Only after the CA and Kamar have said go.
#   sudo bash deploy/tools/set-razorpay-keys.sh --remove        # take the keys out of the env files again
# Key id and secret are typed at hidden prompts, once, and never printed or put in a command line. Files stay mode 600.
# The webhook secret is different for each webhook in the Razorpay dashboard, so it is asked per product (press Enter to skip).
# Settings for testing: ENV_DIR (default /etc/afraprod), NO_RESTART=1 (do not restart the apps).
set -u
ENV_DIR="${ENV_DIR:-/etc/afraprod}"; LIVE=0; REMOVE=0; PRODUCTS=()
for a in "$@"; do case "$a" in --live) LIVE=1 ;; --remove) REMOVE=1 ;; salon|mart|dine|cloth|wash) PRODUCTS+=("$a") ;; *) echo "unknown argument: $a" >&2; exit 2 ;; esac; done
[ "${#PRODUCTS[@]}" -gt 0 ] || PRODUCTS=(salon mart dine cloth wash)
[ "${NO_RESTART:-0}" = 1 ] || [ "$(id -u)" -eq 0 ] || { echo "run as root" >&2; exit 1; }
umask 077

drop() { sed -i -e '/^RAZORPAY_KEY_ID=/d' -e '/^RAZORPAY_KEY_SECRET=/d' -e '/^RAZORPAY_WEBHOOK_SECRET=/d' "$1"; }
restart() {
  [ "${NO_RESTART:-0}" = 1 ] && return 0
  sudo -u afraprod env PATH=/opt/node-22/bin:$PATH PM2_HOME=/srv/afraprod/.pm2 /srv/afraprod/tools/node_modules/.bin/pm2 restart "$1" >/dev/null && echo "  restarted $1" || echo "  COULD NOT RESTART $1: restart it by hand" >&2
}

if [ "$REMOVE" = 1 ]; then
  for p in "${PRODUCTS[@]}"; do f="$ENV_DIR/$p.env"; [ -f "$f" ] || { echo "$p: no env file, skipped"; continue; }; drop "$f"; chmod 600 "$f"; echo "$p: keys removed"; restart "$p"; done
  exit 0
fi

read -r -p "Razorpay Key ID: " KID
[ -n "$KID" ] || { echo "no key id" >&2; exit 1; }
case "$KID" in
  rzp_test_*) : ;;
  rzp_live_*) [ "$LIVE" = 1 ] || { echo "That is a LIVE key. Not allowed without --live (use a test key for now)." >&2; exit 1; } ;;
  *) echo "That does not look like a Razorpay key id (rzp_test_... or rzp_live_...)." >&2; exit 1 ;;
esac
read -r -s -p "Razorpay Key Secret (hidden): " KSEC; echo
[ -n "$KSEC" ] || { echo "no secret" >&2; exit 1; }

for p in "${PRODUCTS[@]}"; do
  f="$ENV_DIR/$p.env"; [ -f "$f" ] || { echo "$p: $f not found, skipped" >&2; continue; }
  read -r -s -p "$p: webhook secret from the Razorpay dashboard (hidden, Enter to skip): " WH; echo
  cp -p "$f" "$f.bak-rzp"; chmod 600 "$f.bak-rzp"
  drop "$f"
  { printf 'RAZORPAY_KEY_ID=%s\n' "$KID"; printf 'RAZORPAY_KEY_SECRET=%s\n' "$KSEC"; [ -n "$WH" ] && printf 'RAZORPAY_WEBHOOK_SECRET=%s\n' "$WH"; } >> "$f"
  chmod 600 "$f"; echo "$p: keys saved ($( [ -n "$WH" ] && echo 'with webhook secret' || echo 'no webhook secret yet' ))"
  restart "$p"
done
KSEC=''; WH=''
echo "Done. A copy of each old env file is next to it as *.bak-rzp (mode 600; it can hold the previous keys and other secrets). Delete them once the apps work: rm $ENV_DIR/*.bak-rzp"
