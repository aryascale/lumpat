#!/bin/bash
# deploy.sh — Build Docker, commit & push changes to GitHub
# Usage: bash deploy.sh "your commit message"

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo -e "${CYAN}=================================================${NC}"
echo -e "${CYAN}  Lumpat Deploy Script${NC}"
echo -e "${CYAN}=================================================${NC}"

# --- 1. Docker Build & Run ---
echo -e "\n${YELLOW}[1/4]${NC} Building & starting Docker containers..."

cd docker
docker compose up -d --build
cd "$PROJECT_DIR"

echo -e "${GREEN}  OK - Docker containers running${NC}"
docker compose -f docker/docker-compose.yml ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

# --- 2. Push Prisma Schema ---
echo -e "\n${YELLOW}[2/4]${NC} Syncing Prisma schema to database..."
npx prisma db push --skip-generate 2>/dev/null && echo -e "${GREEN}  OK - Database schema synced${NC}" || echo -e "${RED}  WARN - Schema sync skipped (DB may be unreachable from host)${NC}"

# --- 3. Git Commit ---
echo -e "\n${YELLOW}[3/4]${NC} Checking for changes..."

if [ -z "$(git status --porcelain)" ]; then
  echo -e "${GREEN}  OK - No changes to commit${NC}"
else
  git add -A

  if [ -n "$1" ]; then
    COMMIT_MSG="$1"
  else
    CHANGED=$(git diff --cached --stat | tail -1)
    COMMIT_MSG="deploy: update $(date '+%Y-%m-%d %H:%M') — ${CHANGED}"
  fi

  git commit -m "$COMMIT_MSG"
  echo -e "${GREEN}  OK - Committed: ${COMMIT_MSG}${NC}"
fi

# --- 4. Git Push ---
echo -e "\n${YELLOW}[4/4]${NC} Pushing to GitHub..."
git push origin main
echo -e "${GREEN}  OK - Pushed to origin/main${NC}"

# --- Done ---
echo -e "\n${CYAN}=================================================${NC}"
echo -e "${GREEN}  Deploy complete!${NC}"
echo -e "${CYAN}=================================================${NC}"
echo -e "  App:        http://localhost:5173"
echo -e "  API:        http://localhost:3069"
echo -e "  phpMyAdmin: http://localhost:8080"
echo ""
