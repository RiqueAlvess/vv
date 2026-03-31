#!/usr/bin/env bash
set -e

# ─── PM2 Setup Script ───────────────────────────────────────────────────────
# Run this once on the VPS to register the BullMQ worker with PM2 and ensure
# it survives reboots via systemd.
#
# Usage: bash scripts/setup-pm2.sh
# ────────────────────────────────────────────────────────────────────────────

# 1. Install PM2 globally (idempotent — safe to re-run)
npm install -g pm2

# 2. Start the worker process using the PM2 ecosystem config
pm2 start ecosystem.config.js

# 3. Generate the systemd startup command for the current user.
#    PM2 will print a command beginning with "sudo env PATH=..."
#    Copy that command and run it manually in the terminal.
pm2 startup

# 4. Save the current PM2 process list so systemd restores it on reboot
pm2 save
