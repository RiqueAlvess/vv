#!/bin/bash
set -e

echo "=========================================="
echo " vivamente360 — Docker Init"
echo "=========================================="

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✓ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }

# Check Docker
command -v docker >/dev/null 2>&1 || fail "Docker not found. Install: https://docs.docker.com/engine/install/"
command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 || fail "Docker Compose not found."
ok "Docker $(docker -v)"

# Check env
if [ ! -f ".env.local" ]; then
  if [ -f ".env.local.example" ]; then
    cp .env.local.example .env.local
    warn ".env.local created from example. Edit it now with real values."
    echo ""
    echo "  Required:"
    echo "  - DATABASE_URL"
    echo "  - DIRECT_URL"
    echo "  - NEXTAUTH_SECRET"
    echo "  - RESEND_API_KEY"
    echo "  - NEXT_PUBLIC_APP_URL"
    echo "  - NEXT_PUBLIC_LOGO_URL"
    echo "  - NEXT_PUBLIC_AUTH_BG_IMAGE_URL"
    echo "  - CRON_SECRET"
    echo "  - DEFAULT_FROM_EMAIL"
    echo ""
    read -p "Press ENTER after editing .env.local..." _
  else
    fail ".env.local not found. Create it before running init."
  fi
else
  ok ".env.local found"
fi

# Stop any existing containers
echo ""
echo "── Stopping existing containers ──"
docker compose down --remove-orphans 2>/dev/null && warn "Stopped existing containers" || true

# Build images
echo ""
echo "── Building Docker images ──"
docker compose build --no-cache || fail "Docker build failed"
ok "Images built"

# Run migrate + seed (runs to completion before app starts)
echo ""
echo "── Running migrations and seeding admin ──"
docker compose run --rm migrate || fail "Migration or seed failed"
ok "Database ready"

# Start app and worker
echo ""
echo "── Starting application ──"
docker compose up -d app worker || fail "Failed to start containers"
ok "Containers started"

# Health check
echo ""
echo "── Waiting for app to be ready ──"
for i in $(seq 1 30); do
  if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
    ok "App is responding"
    break
  fi
  if [ "$i" -eq 30 ]; then
    warn "App did not respond in 30s. Check logs: docker compose logs app"
  fi
  sleep 2
done

echo ""
echo "=========================================="
echo -e "${GREEN} Init complete!${NC}"
echo "=========================================="
echo ""
echo "  App:    http://localhost:3000"
echo "  Admin:  admin@admin.com / administrador.230H"
echo ""
echo "  Logs:   docker compose logs -f app"
echo "  Worker: docker compose logs -f worker"
echo "  Stop:   docker compose down"
echo "  Update: npm run deploy:update"
echo "=========================================="
