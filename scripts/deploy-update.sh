#!/bin/bash
set -e

echo "── Pulling latest code ──"
git pull origin main

echo "── Installing dependencies ──"
npm install

echo "── Regenerating Prisma client ──"
npx prisma generate

echo "── Building ──"
npm run build

echo "── Restarting PM2 processes ──"
pm2 restart vv-app
pm2 restart vv-worker 2>/dev/null || true

echo "✓ Deploy complete"
pm2 status
