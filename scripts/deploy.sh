#!/bin/bash
# ==========================================
# LUMPAT - PRODUCTION DEPLOYMENT SCRIPT
# ==========================================
# Script to automate deployment on VPS
# Execute with: bash deploy.sh
# ==========================================

set -e

# Navigate to project root relative to script location
cd "$(dirname "$0")/.."

echo "[1/5] Fetching latest updates from Git repository..."
git fetch origin
git reset --hard origin/main

echo "[2/5] Navigating to docker directory..."
cd docker || exit 1

echo "[3/5] Rebuilding application container..."
docker compose build app

echo "[4/5] Starting containers..."
docker compose up -d

echo "[5/5] Synchronizing database schema..."
# Wait a few seconds to ensure MySQL is ready and App container is running
sleep 3
docker exec lumpat-app npx prisma db push

echo "=========================================="
echo "Deployment process completed successfully."
echo "=========================================="
