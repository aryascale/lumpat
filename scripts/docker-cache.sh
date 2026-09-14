#!/bin/bash
# ==========================================
# LUMPAT - DOCKER CACHE MAINTENANCE
# ==========================================
# Frees disk eaten by stale Docker build cache and dangling
# images on the VPS. Keeps recent cache layers so deploys
# stay fast, and never touches volumes (MySQL data is safe).
# Execute with: bash scripts/docker-cache.sh [--all]
#   --all : drop ALL build cache (next deploy rebuilds from scratch)
# ==========================================

set -e

cd "$(dirname "$0")/.."

echo "Docker disk usage before cleanup:"
docker system df

if [ "$1" = "--all" ]; then
  echo "Dropping ALL build cache..."
  docker builder prune -f
else
  echo "Dropping build cache older than 7 days..."
  docker builder prune -f --filter "until=168h"
fi

echo "Removing dangling images..."
docker image prune -f

echo "Docker disk usage after cleanup:"
docker system df
