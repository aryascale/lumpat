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

echo "[3/5] Rebuilding and starting containers..."
docker compose up -d --build

echo "[4/5] Waiting for database..."
# Wait a few seconds to ensure MySQL is ready
sleep 5

echo "[5/5] Synchronizing database schema..."
docker exec lumpat-app npx prisma db push --accept-data-loss

echo "=========================================="
echo "Deployment process completed successfully."
echo "=========================================="
