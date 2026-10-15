#!/usr/bin/env bash
# Once-per-worker prerequisites for PlayGround validation.
set -euo pipefail

# Headless Chromium powers capture.sh. Install once; skip when present.
if compgen -G "$HOME/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/headless_shell" > /dev/null 2>&1 \
  || compgen -G "$HOME/.cache/ms-playwright/chromium-*/chrome-linux*/chrome" > /dev/null 2>&1; then
  echo 'startup: chromium already installed'
else
  /usr/bin/time -p playwright-cli install-browser chromium
fi
