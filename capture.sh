#!/usr/bin/env bash
# Capture desktop + mobile screenshots of the deployed app.
# Env: CAPTURE_URL (exact page to open), CAPTURE_DIR (output directory).
# Writes final-desktop.png and final-mobile.png into CAPTURE_DIR.
# Exit 75: temporary navigation/browser infrastructure failure.
# Exit 1: script usage error or rendering defect.
set -euo pipefail
cd "$(dirname "$0")"

SESSION="omgithub-capture"

fail_temp() { echo "capture: temporary infrastructure failure: $1" >&2; exit 75; }
fail_defect() { echo "capture: rendering/script defect: $1" >&2; exit 1; }

[[ -n "${CAPTURE_URL:-}" ]] || fail_defect "CAPTURE_URL is not set"
[[ -n "${CAPTURE_DIR:-}" ]] || fail_defect "CAPTURE_DIR is not set"

/usr/bin/time -p mkdir -p "$CAPTURE_DIR"

cleanup() { /usr/bin/time -p playwright-cli -s="$SESSION" close >/dev/null 2>&1 || true; }
trap cleanup EXIT

/usr/bin/time -p playwright-cli -s="$SESSION" open "$CAPTURE_URL" >/dev/null 2>&1 \
  || fail_temp "could not open browser at $CAPTURE_URL"

# Wait for rendered content: WebGL canvas present and loading veil hidden.
ready=""
for ((i = 1; i <= 40; i++)); do
  probe="$(/usr/bin/time -p playwright-cli -s="$SESSION" eval \
    "() => (document.querySelector('#scene canvas') && document.getElementById('loading').classList.contains('hidden')) ? 'R3NDERED_OK' : 'STILL_LOADING'" 2>&1 || true)"
  if [[ "$probe" == *R3NDERED_OK* ]]; then ready="yes"; break; fi
  /usr/bin/time -p sleep 2
done
[[ "$ready" == "yes" ]] || fail_defect "app did not render within timeout at $CAPTURE_URL"

/usr/bin/time -p playwright-cli -s="$SESSION" eval \
  "() => document.title" 2>&1 | grep -i "nova" >/dev/null \
  || fail_defect "unexpected page content at $CAPTURE_URL"

# Desktop view.
/usr/bin/time -p playwright-cli -s="$SESSION" resize 1440 900 >/dev/null 2>&1 \
  || fail_temp "desktop resize failed"
/usr/bin/time -p sleep 4
/usr/bin/time -p playwright-cli -s="$SESSION" screenshot --filename="$CAPTURE_DIR/final-desktop.png" >/dev/null 2>&1 \
  || fail_temp "desktop screenshot failed"

# Mobile landscape view (game is landscape-first for phones/tablets).
/usr/bin/time -p playwright-cli -s="$SESSION" resize 844 390 >/dev/null 2>&1 \
  || fail_temp "mobile resize failed"
/usr/bin/time -p sleep 3
/usr/bin/time -p playwright-cli -s="$SESSION" screenshot --filename="$CAPTURE_DIR/final-mobile.png" >/dev/null 2>&1 \
  || fail_temp "mobile screenshot failed"

/usr/bin/time -p test -s "$CAPTURE_DIR/final-desktop.png" \
  || fail_defect "final-desktop.png missing or empty"
/usr/bin/time -p test -s "$CAPTURE_DIR/final-mobile.png" \
  || fail_defect "final-mobile.png missing or empty"

desk_bytes="$(/usr/bin/time -p stat -c%s "$CAPTURE_DIR/final-desktop.png")"
mob_bytes="$(/usr/bin/time -p stat -c%s "$CAPTURE_DIR/final-mobile.png")"
[[ "$desk_bytes" -gt 10000 ]] || fail_defect "final-desktop.png too small (${desk_bytes} bytes)"
[[ "$mob_bytes" -gt 10000 ]] || fail_defect "final-mobile.png too small (${mob_bytes} bytes)"

echo "capture: desktop=${desk_bytes}B mobile=${mob_bytes}B in $CAPTURE_DIR"
