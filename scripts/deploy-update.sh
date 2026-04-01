#!/bin/bash
set -e

echo "── Pulling latest code ──"
git pull origin main

echo "── Rebuilding images ──"
docker compose build --no-cache

echo "── Running migrations ──"
docker compose run --rm migrate

echo "── Restarting containers ──"
docker compose up -d app worker

echo "✓ Deploy complete"
docker compose ps
