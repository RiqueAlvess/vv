#!/bin/bash
set -e  # exit immediately on any error

echo "=========================================="
echo " vivamente360 — Server Init Script"
echo "=========================================="
echo ""

# ─── COLORS ───────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ok()   { echo -e "${GREEN}✓ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }

# ─── REQUIREMENTS CHECK ───────────────────────
echo "── Checking requirements ──"

command -v node >/dev/null 2>&1 || fail "Node.js not found. Install Node 18+ first: https://nodejs.org"
command -v npm  >/dev/null 2>&1 || fail "npm not found."
command -v git  >/dev/null 2>&1 || fail "git not found."

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  fail "Node.js 18+ required. Current: $(node -v)"
fi

ok "Node.js $(node -v)"
ok "npm $(npm -v)"

# ─── ENV FILE CHECK ───────────────────────────
echo ""
echo "── Checking environment ──"

if [ ! -f ".env.local" ]; then
  if [ -f ".env.local.example" ]; then
    cp .env.local.example .env.local
    warn ".env.local not found — copied from .env.local.example"
    warn "IMPORTANT: Edit .env.local with your real values before continuing."
    echo ""
    echo "  Required variables:"
    echo "  - DATABASE_URL"
    echo "  - DIRECT_URL"
    echo "  - NEXTAUTH_SECRET (or JWT_SECRET)"
    echo "  - RESEND_API_KEY"
    echo "  - NEXT_PUBLIC_APP_URL"
    echo "  - NEXT_PUBLIC_LOGO_URL"
    echo "  - NEXT_PUBLIC_AUTH_BG_IMAGE_URL"
    echo ""
    read -p "Press ENTER after editing .env.local to continue..." _
  else
    fail ".env.local not found and no .env.local.example to copy from. Create .env.local manually."
  fi
else
  ok ".env.local found"
fi

# ─── INSTALL DEPENDENCIES ─────────────────────
echo ""
echo "── Installing dependencies ──"
npm install || fail "npm install failed"
ok "Dependencies installed"

# ─── PRISMA GENERATE ──────────────────────────
echo ""
echo "── Generating Prisma client ──"
npx prisma generate || fail "prisma generate failed"
ok "Prisma client generated"

# ─── RUN MIGRATIONS ───────────────────────────
echo ""
echo "── Applying database migrations ──"

# Check if we have supabase migrations or prisma migrations
if [ -d "supabase/migrations" ] && [ "$(ls -A supabase/migrations/*.sql 2>/dev/null | wc -l)" -gt 0 ]; then
  warn "Supabase SQL migrations detected."
  warn "These must be applied manually in the Supabase SQL editor."
  warn "Files to apply in order:"
  for f in supabase/migrations/*.sql; do
    echo "    → $f"
  done
  echo ""
  read -p "Press ENTER after applying migrations in Supabase dashboard to continue..." _
  ok "Migrations acknowledged"
else
  # Fallback: try prisma migrate deploy
  npx prisma migrate deploy || fail "prisma migrate deploy failed"
  ok "Migrations applied"
fi

# ─── SEED ADMIN ───────────────────────────────
echo ""
echo "── Creating default admin user ──"
npm run seed:admin || fail "seed:admin failed"
ok "Admin user created"

# ─── BUILD ────────────────────────────────────
echo ""
echo "── Building application ──"
npm run build || fail "npm run build failed"
ok "Build complete"

# ─── PM2 SETUP ────────────────────────────────
echo ""
echo "── Setting up PM2 process manager ──"

if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2 || fail "Failed to install PM2"
  ok "PM2 installed"
else
  ok "PM2 already installed ($(pm2 -v))"
fi

# Stop existing processes if running
pm2 delete vv-app    2>/dev/null && warn "Stopped existing vv-app process" || true
pm2 delete vv-worker 2>/dev/null && warn "Stopped existing vv-worker process" || true

# Start Next.js app
pm2 start npm --name "vv-app" -- start || fail "Failed to start app with PM2"
ok "Next.js app started via PM2"

# Start BullMQ worker (if worker script exists)
if [ -f "ecosystem.config.js" ]; then
  pm2 start ecosystem.config.js || fail "Failed to start worker via PM2"
  ok "BullMQ worker started via PM2"
else
  warn "ecosystem.config.js not found — worker not started. Run 'npm run worker' manually."
fi

# Save PM2 process list
pm2 save || warn "pm2 save failed — processes may not survive reboot"

# Setup PM2 startup
echo ""
echo "── PM2 startup (survives reboots) ──"
warn "Run the command below as root/sudo to enable PM2 on system startup:"
echo ""
pm2 startup | tail -1
echo ""

# ─── DONE ─────────────────────────────────────
echo ""
echo "=========================================="
echo -e "${GREEN} Init complete!${NC}"
echo "=========================================="
echo ""
echo "  App:    http://localhost:3000"
echo "  Admin:  admin@admin.com / administrador.230H"
echo ""
echo "  PM2 status:  pm2 status"
echo "  App logs:    pm2 logs vv-app"
echo "  Worker logs: pm2 logs vv-worker"
echo ""
echo "  Next step: point your domain/reverse proxy to port 3000"
echo "=========================================="
