#!/usr/bin/env bash
# Read-only checks before a deploy. Changes nothing. Never prints a secret value (only whether a setting is present and long enough).
# Usage: sudo bash deploy/preflight.sh [--allow-running] [product ...]    (default: all products)
# --allow-running: ports already used by our own pm2 apps are fine (a re-deploy). On a first deploy ports must be free.
# Written 13 Nov 2026, not yet run by a person.
set -u
ENV_DIR="${AFRA_ENV_DIR:-/etc/afra}"
BASE="${AFRA_BASE:-/srv/afra}"
ALLOW_RUNNING=no
[ "${1:-}" = "--allow-running" ] && { ALLOW_RUNNING=yes; shift; }

declare -A PORT=( [gym]=5000 [hire]=5006 [salon]=5007 [mart]=5008 [dine]=5009 [cloth]=5010 [wash]=5011 [admin]=5012 )
# Settings that must be present (non-empty) per product, and settings that must be at least N characters.
declare -A REQ=(
  [gym]="MONGODB_URI JWT_SECRET CORS_ORIGINS"
  [hire]="MONGODB_URI HIRE_SESSION_SECRET"
  [salon]="MONGODB_URI SALON_SESSION_SECRET"
  [mart]="MONGODB_URI MART_SESSION_SECRET"
  [dine]="MONGODB_URI DINE_SESSION_SECRET"
  [cloth]="MONGODB_URI CLOTH_SESSION_SECRET"
  [wash]="MONGODB_URI WASH_SESSION_SECRET"
  [admin]="ADMIN_SESSION_SECRET ADMIN_MFA_KEY ADMIN_USERS_FILE ADMIN_AUDIT_FILE"
)
declare -A MIN32=(
  [gym]="JWT_SECRET" [hire]="HIRE_SESSION_SECRET" [salon]="SALON_SESSION_SECRET" [mart]="MART_SESSION_SECRET"
  [dine]="DINE_SESSION_SECRET" [cloth]="CLOTH_SESSION_SECRET" [wash]="WASH_SESSION_SECRET" [admin]="ADMIN_SESSION_SECRET"
)
ALL="gym hire salon mart dine cloth wash admin"
PRODUCTS="${*:-$ALL}"

FAIL=0; WARN=0
ok()   { printf '  PASS  %s\n' "$*"; }
bad()  { printf '  FAIL  %s\n' "$*"; FAIL=$((FAIL+1)); }
warn() { printf '  WARN  %s\n' "$*"; WARN=$((WARN+1)); }

# Value of KEY in an env file, without printing it. Handles KEY=value and quotes; ignores comments.
val() { grep -E "^[[:space:]]*$2=" "$1" 2>/dev/null | tail -n1 | sed -E "s/^[[:space:]]*$2=//; s/[[:space:]]+#.*$//; s/^['\"]//; s/['\"]$//"; }

echo "== Machine"
if [ "$(id -u)" -ne 0 ]; then warn "not running as root: some checks (file modes of other users, nginx -t) may be incomplete"; fi
for c in node npm git nginx pm2 curl ss openssl; do command -v "$c" >/dev/null 2>&1 && ok "$c found" || bad "$c is not installed"; done
command -v certbot >/dev/null 2>&1 && ok "certbot found" || warn "certbot not installed yet (needed for HTTPS)"
if command -v node >/dev/null 2>&1; then
  v="$(node -v | sed 's/^v//; s/\..*//')"
  [ "${v:-0}" -ge 22 ] && ok "Node $(node -v)" || bad "Node is $(node -v); Node 22 or newer is needed (--env-file)"
fi
free_gb=$(df -P "$BASE" 2>/dev/null | awk 'NR==2{printf "%d", $4/1048576}')
[ -z "$free_gb" ] && free_gb=$(df -P / | awk 'NR==2{printf "%d", $4/1048576}')
[ "${free_gb:-0}" -ge 5 ] && ok "disk free ${free_gb} GB" || bad "disk free only ${free_gb:-0} GB (need 5 GB or more for a release plus builds)"
mem_mb=$(awk '/MemAvailable/{printf "%d", $2/1024}' /proc/meminfo 2>/dev/null)
[ "${mem_mb:-0}" -ge 1500 ] && ok "memory available ${mem_mb} MB" || warn "memory available only ${mem_mb:-?} MB (builds need about 1.5 GB; HOSTING_PLAN says measure after deploy)"
[ -d "$BASE" ] && ok "$BASE exists" || warn "$BASE does not exist yet (deploy.sh creates it)"
[ -d /var/log/afra ] && ok "/var/log/afra exists" || warn "/var/log/afra missing: sudo mkdir -p /var/log/afra && sudo chown afra:afra /var/log/afra"

echo "== Settings files in $ENV_DIR"
for p in $PRODUCTS; do
  f="$ENV_DIR/$p.env"
  echo " [$p]"
  if [ ! -f "$f" ]; then bad "$f does not exist (copy deploy/env/$p.env.example, fill it in on the server)"; continue; fi
  mode=$(stat -c %a "$f" 2>/dev/null); owner=$(stat -c %U "$f" 2>/dev/null)
  [ "$mode" = "600" ] && ok "mode 600 (owner $owner)" || bad "$f mode is $mode; run: sudo chmod 600 $f"
  for k in ${REQ[$p]:-}; do
    [ -n "$(val "$f" "$k")" ] && ok "$k is set" || bad "$k is empty or missing"
  done
  for k in ${MIN32[$p]:-}; do
    x="$(val "$f" "$k")"; [ "${#x}" -ge 32 ] && ok "$k has 32+ characters" || bad "$k is shorter than 32 characters"
  done
  if [ -n "$(val "$f" INTERNAL_API_KEY)" ]; then x="$(val "$f" INTERNAL_API_KEY)"; [ "${#x}" -ge 24 ] && ok "INTERNAL_API_KEY has 24+ characters" || bad "INTERNAL_API_KEY is shorter than 24 characters"
  elif [ "$p" != "admin" ]; then warn "INTERNAL_API_KEY not set: Super Admin counts for $p stay off"; fi
  m="$(val "$f" MONGODB_URI)"
  if [ -n "$m" ]; then case "$m" in mongodb://*|mongodb+srv://*) ok "MONGODB_URI looks like a MongoDB address";; *) bad "MONGODB_URI does not start with mongodb:// or mongodb+srv://";; esac; fi
  case "$m" in *test*) warn "MONGODB_URI contains the word test: is this a test database?";; esac
  if [ "$p" = "admin" ]; then
    for k in ADMIN_USERS_FILE ADMIN_AUDIT_FILE; do x="$(val "$f" $k)"; [ -n "$x" ] && { [ -e "$x" ] || [ "$k" = "ADMIN_AUDIT_FILE" ] || bad "$k points to $x which does not exist"; }; done
    mk="$(val "$f" ADMIN_MFA_KEY)"; [ -n "$mk" ] && { [ "$(printf '%s' "$mk" | base64 -d 2>/dev/null | wc -c)" -eq 32 ] && ok "ADMIN_MFA_KEY decodes to 32 bytes" || bad "ADMIN_MFA_KEY must be 32 random bytes in base64 (openssl rand -base64 32)"; }
  fi
  if [ "$p" = "gym" ] && [ "$(val "$f" NODE_ENV)" != "production" ]; then warn "gym.env: NODE_ENV is not production (ecosystem sets it, but check the file)"; fi
done

echo "== Ports (apps listen on 127.0.0.1 only)"
for p in $PRODUCTS; do
  port="${PORT[$p]}"
  if ss -ltn "( sport = :$port )" 2>/dev/null | grep -q LISTEN; then
    if ss -ltn "( sport = :$port )" | grep -q "0.0.0.0:$port\|\*:$port\|\[::\]:$port"; then bad "port $port is open to the outside (must be 127.0.0.1 only)"
    elif [ "$ALLOW_RUNNING" = yes ]; then ok "port $port in use on 127.0.0.1 (re-deploy)"
    else bad "port $port ($p) is already in use; use --allow-running for a re-deploy, or stop what is using it (an old systemd gymdesk service?)"; fi
  else ok "port $port ($p) is free"; fi
done

echo "== nginx"
if command -v nginx >/dev/null 2>&1; then
  if nginx -t >/dev/null 2>&1; then ok "nginx -t passes"; else bad "nginx -t fails (run it to read the message)"; fi
  [ -f /etc/nginx/conf.d/00-afra-common.conf ] && ok "00-afra-common.conf installed" || warn "00-afra-common.conf not in /etc/nginx/conf.d yet"
  for s in afra-proxy.conf afra-security-headers.conf; do [ -f "/etc/nginx/snippets/$s" ] && ok "$s installed" || warn "$s not in /etc/nginx/snippets yet"; done
fi

echo "== Firewall"
if command -v ufw >/dev/null 2>&1; then ufw status 2>/dev/null | head -12; else warn "ufw not found; check the Hostinger firewall allows only 22, 80, 443"; fi

echo
echo "Result: $FAIL failed, $WARN warnings"
[ "$FAIL" -eq 0 ] && { echo "Preflight PASSED"; exit 0; } || { echo "Preflight FAILED: fix the FAIL lines, then run again"; exit 1; }
