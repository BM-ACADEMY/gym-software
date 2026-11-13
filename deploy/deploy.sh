#!/usr/bin/env bash
# Deploy a RELEASE BRANCH to the Hostinger VPS: clone into a new release folder, install, build the front-ends, flip the
# "current" link, restart under pm2, health-check every product, and roll back to the previous release if a check fails.
# Written 13 Nov 2026, not yet run by a person.
#
# Usage (as the app user, `afraprod` on the shared server):
#   RELEASE_BRANCH=release-20261113 bash deploy/deploy.sh [--dry-run] [--products "salon mart"] [--skip-clients]
# Rules:
#  - RELEASE_BRANCH is required. Production never follows phase1-autopilot by itself, and `main` is refused (nobody pushes to main by hand).
#  - No secrets here. Settings live in /etc/afraprod/<product>.env (mode 600), read by the apps via node --env-file.
#  - Safe to run again: each run makes a new release folder; the link flips only after install and build succeed.
set -euo pipefail

# Shared server (13 Nov): Node 22 is already installed by the Lead Hub at /opt/node-22 (we do NOT install or change it), and pm2 lives in our own folder, not globally.
export PATH="/opt/node-22/bin:${AFRA_BASE:-/srv/afraprod}/tools/node_modules/.bin:$PATH"

BASE="${AFRA_BASE:-/srv/afraprod}"
REPO_URL="${REPO_URL:-git@github.com:BM-ACADEMY/gym-software.git}"   # read-only deploy key, see docs/DEPLOY_PRODUCTS.md
BRANCH="${RELEASE_BRANCH:-}"
ALL_PRODUCTS="gym hire salon mart dine cloth wash admin"
PRODUCTS="$ALL_PRODUCTS"
DRY=no; SKIP_CLIENTS=no; KEEP=5
LOG_DIR="/var/log/afraprod"

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=yes ;;
    --skip-clients) SKIP_CLIENTS=yes ;;
    --products) shift; PRODUCTS="${1:?--products needs a quoted list}" ;;
    --branch) shift; BRANCH="${1:?--branch needs a name}" ;;
    -h|--help) sed -n 2,14p "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac; shift
done

if [ "$PRODUCTS" != "$ALL_PRODUCTS" ] && [ "$DRY" = no ]; then
  echo "REFUSED: a partial deploy builds only some front-ends into the new release and the other sites lose their pages (found 13 Nov). Deploy all products, or use --dry-run." >&2; exit 2
fi

declare -A PORT=( [gym]=5000 [hire]=5006 [salon]=5007 [mart]=5008 [dine]=5009 [cloth]=5010 [wash]=5011 [admin]=5012 )
declare -A SERVERDIR=( [gym]=server [hire]=apps/hire [salon]=apps/salon [mart]=apps/mart [dine]=apps/dine [cloth]=apps/cloth [wash]=apps/wash [admin]=apps/admin )
declare -A CLIENTDIR=( [gym]=client [hire]=apps/hire/client [salon]=apps/salon/client [mart]=apps/mart/client [dine]=apps/dine/client [cloth]=apps/cloth/client [wash]=apps/wash/client [admin]=apps/admin/client )

say()  { printf '\n==> %s\n' "$*"; }
run()  { if [ "$DRY" = yes ]; then printf '   [dry-run] %s\n' "$*"; else "$@"; fi; }
die()  { printf '\nDEPLOY STOPPED: %s\n' "$*" >&2; exit 1; }

[ -n "$BRANCH" ] || die "RELEASE_BRANCH is not set. Name the release branch, e.g. RELEASE_BRANCH=release-20261113"
case "$BRANCH" in main|master) die "refusing to deploy '$BRANCH' (nobody pushes to main by hand; use a release branch)";; esac
for p in $PRODUCTS; do [ -n "${PORT[$p]:-}" ] || die "unknown product '$p' (known: $ALL_PRODUCTS)"; done
if [ "$(id -un)" = "root" ] && [ "${AFRA_ALLOW_ROOT:-no}" != "yes" ]; then die "run as the app user: sudo -u afraprod RELEASE_BRANCH=$BRANCH bash deploy/deploy.sh"; fi

if [ "$DRY" = no ]; then
  mkdir -p "$BASE/releases" 2>/dev/null || die "cannot create $BASE/releases (sudo mkdir -p $BASE/releases && sudo chown -R afraprod:afraprod $BASE)"
  [ -w "$LOG_DIR" ] && exec > >(tee -a "$LOG_DIR/deploy.log") 2>&1
  exec 9>"$BASE/.deploy.lock"; flock -n 9 || die "another deploy is running"
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
NEW="$BASE/releases/$STAMP"
CUR="$BASE/current"
PREV=""; [ -L "$CUR" ] && PREV="$(readlink -f "$CUR")"
say "Deploy $BRANCH to $NEW (products: $PRODUCTS). Previous release: ${PREV:-none (first deploy)}"

say "1. Preflight (read-only checks)"
PF="$(dirname "$0")/preflight.sh"
if [ -x "$PF" ] || [ -f "$PF" ]; then
  if [ -n "$PREV" ]; then run bash "$PF" --allow-running $PRODUCTS || die "preflight failed"; else run bash "$PF" $PRODUCTS || die "preflight failed (a first deploy needs every port free and every settings file ready)"; fi
fi

say "2. Fetch the release"
run git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$NEW"
if [ "$DRY" = no ]; then COMMIT="$(git -C "$NEW" rev-parse --short HEAD)"; echo "   commit $COMMIT" ; echo "$BRANCH $COMMIT $STAMP" > "$NEW/RELEASE"; fi

say "3. Install server packages"
# One install at the repo root covers the shared packages and the product servers (npm workspaces).
if [ "$DRY" = no ]; then ( cd "$NEW" && npm install --omit=dev --no-audit --no-fund ); else echo "   [dry-run] (cd $NEW && npm install --omit=dev)"; fi
case " $PRODUCTS " in *" gym "*) if [ "$DRY" = no ]; then ( cd "$NEW/server" && npm ci --omit=dev --no-audit --no-fund ); else echo "   [dry-run] (cd $NEW/server && npm ci --omit=dev)"; fi ;; esac

if [ "$SKIP_CLIENTS" = no ]; then
  say "4. Build the front-ends"
  for p in $PRODUCTS; do
    d="${CLIENTDIR[$p]}"
    if [ "$DRY" = yes ]; then echo "   [dry-run] build $d"; continue; fi
    [ -f "$NEW/$d/package.json" ] || { echo "   (no front-end for $p)"; continue; }
    echo "   building $p ($d)"
    if [ "$p" = gym ]; then ( cd "$NEW/$d" && npm ci --no-audit --no-fund && VITE_API_URL=/api npm run build ) || die "front-end build failed for $p (nothing was switched)"
    else ( cd "$NEW/$d" && npm install --no-audit --no-fund && npm run build ) || die "front-end build failed for $p (nothing was switched)"; fi
    [ -f "$NEW/$d/dist/index.html" ] || die "front-end build for $p produced no dist/index.html"
  done
else say "4. Front-ends skipped (--skip-clients)"; fi

say "5. Switch the current link"
# nginx runs as www-data and must be able to walk through the base folder to the built pages (traverse only, no listing). Found 13 Nov: without this every site gave 403.
run chmod o+x "$BASE"
if [ "$DRY" = no ]; then ln -sfn "$NEW" "$CUR.next" && mv -Tf "$CUR.next" "$CUR"; else echo "   [dry-run] ln -sfn $NEW $CUR"; fi

rollback() {
  echo; echo "!! ROLLING BACK"
  if [ -n "$PREV" ] && [ -d "$PREV" ]; then
    ln -sfn "$PREV" "$CUR.next" && mv -Tf "$CUR.next" "$CUR"
    pm2 startOrRestart "$CUR/deploy/ecosystem.config.js" --update-env >/dev/null 2>&1 || true
    echo "   back on $PREV. The failed release is kept for reading at $NEW"
  else
    echo "   there is no previous release (first deploy): stopping the failed apps. Read the pm2 logs: pm2 logs --lines 50"
    for p in $PRODUCTS; do pm2 stop "$p" >/dev/null 2>&1 || true; done
  fi
}

say "6. Restart under pm2 (one copy of each product)"
ONLY=$(echo "$PRODUCTS" | tr ' ' ',')
if [ "$DRY" = no ]; then
  if [ "$PRODUCTS" = "$ALL_PRODUCTS" ]; then pm2 startOrRestart "$CUR/deploy/ecosystem.config.js" --update-env || { rollback; die "pm2 could not start the apps"; }
  else pm2 startOrRestart "$CUR/deploy/ecosystem.config.js" --only "$ONLY" --update-env || { rollback; die "pm2 could not start the apps"; }; fi
  pm2 save >/dev/null
else echo "   [dry-run] pm2 startOrRestart $CUR/deploy/ecosystem.config.js --only $ONLY"; fi

say "7. Health check each product (waits up to 60 seconds each)"
FAILED=""
for p in $PRODUCTS; do
  port="${PORT[$p]}"
  if [ "$DRY" = yes ]; then echo "   [dry-run] curl http://127.0.0.1:$port/api/health"; continue; fi
  okp=no
  for i in $(seq 1 20); do
    body="$(curl -fsS --max-time 4 "http://127.0.0.1:$port/api/health" 2>/dev/null || true)"
    case "$body" in *'"ok":true'*|*'"success":true'*) okp=yes; break;; esac
    sleep 3
  done
  if [ "$okp" = yes ]; then echo "   PASS  $p (port $port)"; else echo "   FAIL  $p (port $port) answered: ${body:-nothing}"; FAILED="$FAILED $p"; fi
done
for p in $PRODUCTS; do
  [ "$DRY" = yes ] && continue
  if ss -ltn "( sport = :${PORT[$p]} )" 2>/dev/null | grep -q "0.0.0.0:${PORT[$p]}\|\*:${PORT[$p]}\|\[::\]:${PORT[$p]}"; then FAILED="$FAILED $p(open-to-outside)"; fi
done
if [ -n "$FAILED" ]; then rollback; die "health check failed for:$FAILED. A health answer of ok:false means a required setting is missing (see preflight)"; fi

say "8. Tidy old releases (keep the newest $KEEP, never the current or the previous)"
if [ "$DRY" = no ]; then
  ls -1dt "$BASE"/releases/*/ 2>/dev/null | tail -n +$((KEEP+1)) | while read -r d; do
    d="${d%/}"; [ "$d" = "$NEW" ] && continue; [ -n "$PREV" ] && [ "$d" = "$PREV" ] && continue
    rm -rf -- "$d"
  done
else echo "   [dry-run] keep $KEEP releases"; fi

if [ "$DRY" = yes ]; then say "DRY RUN ONLY. Nothing was changed and nothing is live. Run again without --dry-run to deploy."; else say "DONE. $BRANCH is live (release $STAMP). Next: the smoke tests in docs/DEPLOY_PRODUCTS.md section 6."; fi
