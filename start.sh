#!/usr/bin/env bash
# NOVA STRIKE launcher: sync the static game into dist/, publish deployment
# output metadata, and serve dist/ in the foreground on PORT (default 3000).
set -euo pipefail
cd "$(dirname "$0")"

PROJECT_DIR="$PWD"
PORT="${PORT:-3000}"
export PORT
DIST="$PROJECT_DIR/dist"
WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"

/usr/bin/time -p mkdir -p "$DIST" "$WEB_DIR"
/usr/bin/time -p rm -rf "$DIST"
/usr/bin/time -p mkdir -p "$DIST"
/usr/bin/time -p cp -r "$PROJECT_DIR/nova-strike/." "$DIST/"

# Install dependencies and build only when the project needs it.
if /usr/bin/time -p test -f "$PROJECT_DIR/package.json"; then
  /usr/bin/time -p npm --prefix "$PROJECT_DIR" ci --no-audit --no-fund
  if /usr/bin/time -p node -e "process.exit(require('$PROJECT_DIR/package.json').scripts?.build ? 0 : 1)"; then
    /usr/bin/time -p npm --prefix "$PROJECT_DIR" run build
  fi
fi

/usr/bin/time -p test -f "$DIST/index.html"

/usr/bin/time -p env DEPLOY_JSON="$WEB_DIR/deployment-output.json" PROJECT_DIR="$PROJECT_DIR" DIST="$DIST" node -e '
const fs = require("fs");
const out = process.env.DEPLOY_JSON;
fs.writeFileSync(out, JSON.stringify({
  project: process.env.PROJECT_DIR,
  directory: process.env.DIST,
}));
console.log("deployment-output.json -> " + out);
'

/usr/bin/time -p node "$PROJECT_DIR/scripts/serve.mjs" "$DIST"
