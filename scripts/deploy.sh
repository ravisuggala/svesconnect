#!/bin/bash
# One-step update of the live site: install, build, migrate the database, restart. Run by cPanel's "Deploy HEAD Commit"
# (see .cpanel.yml) or by hand:  bash scripts/deploy.sh   (after git pull). The output is also written to deploy.log.
set -e
cd "$(dirname "$0")/.."
exec > >(tee -a deploy.log) 2>&1
echo "=== deploy $(date '+%Y-%m-%d %H:%M:%S') $(git rev-parse --short HEAD 2>/dev/null) ==="
# Node environment made by cPanel "Setup Node.js App" (override with NODEVENV=/path/to/bin/activate)
source "${NODEVENV:-/home/svesconnect/nodevenv/svesconnect/26/bin/activate}"
npm install --include=dev --ignore-scripts --no-save   # --no-save: never rewrites package-lock.json, so the server copy stays clean (node_modules is cPanel's link, so no npm ci)
npm run build
npm run migrate
mkdir -p tmp && touch tmp/restart.txt      # tells Passenger to restart the app
echo "=== deploy finished ==="
