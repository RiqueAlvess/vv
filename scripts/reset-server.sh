#!/bin/bash
set -e

echo "⚠  This will stop all PM2 processes, clear the build, and re-run init."
read -p "Are you sure? Type 'yes' to continue: " confirm
[ "$confirm" = "yes" ] || exit 0

pm2 delete all 2>/dev/null || true
rm -rf .next
rm -rf node_modules/.prisma

bash scripts/init-server.sh
