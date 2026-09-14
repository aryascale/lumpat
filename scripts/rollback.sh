#!/bin/bash
# ==========================================
# LUMPAT - ROLLBACK LAST COMMIT
# ==========================================
# Undoes the latest commit on the current working branch
# (git revert -> history preserved, no force push), then
# pushes to origin <branch> and origin <branch>:staging.
#
# Add --prod to also cherry-pick the revert onto prod.
# Push != deploy. Redeploy manually on the VPS afterwards:
#   staging: bash scripts/deploy-staging.sh
#   prod:    bash scripts/deploy.sh
#
# Execute with: bash scripts/rollback.sh [--prod]
# ==========================================

set -e

cd "$(dirname "$0")/.."

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" = "prod" ] || [ "$BRANCH" = "staging" ]; then
  echo "Run from a working branch (e.g. layoutadmin), not '$BRANCH'."
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is not clean. Commit or stash first."
  exit 1
fi

echo "Reverting last commit on $BRANCH..."
git revert --no-edit HEAD
REVERT_SHA=$(git rev-parse HEAD)

echo "Pushing to origin $BRANCH + staging..."
git push origin "$BRANCH"
git push origin "$BRANCH":staging

if [ "$1" = "--prod" ]; then
  echo "Cherry-picking revert onto prod..."
  git fetch origin prod
  git checkout prod
  git reset --hard origin/prod
  git cherry-pick "$REVERT_SHA"
  git push origin prod
  git checkout "$BRANCH"
fi

echo "=========================================="
echo "Rollback pushed. Redeploy on VPS if needed:"
echo "  staging: bash scripts/deploy-staging.sh"
echo "  prod:    bash scripts/deploy.sh"
echo "=========================================="
