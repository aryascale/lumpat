#!/bin/bash
# ============================================
# BCR-2025 (Lumpat) — VPS Start Script
# Usage: bash start.sh
# ============================================

set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

echo "============================================"
echo "  🏃 Lumpat — Starting Application"
echo "============================================"

# 1. Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Install it first:"
  echo "   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
  echo "   sudo apt install -y nodejs"
  exit 1
fi
echo "✅ Node.js $(node -v)"

# 2. Install dependencies
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
else
  echo "✅ Dependencies already installed"
fi

# 3. Create .env if not exists
if [ ! -f ".env" ]; then
  echo ""
  echo "⚠️  No .env file found. Creating template..."
  cat > .env << 'EOF'
NODE_ENV=production
PORT=3001

# Database — update with your MySQL/MariaDB credentials
DATABASE_URL="mysql://bcr_user:bcr_password@localhost:3306/bcr_db"

# Upload directory (absolute path recommended)
UPLOAD_DIR=./uploads
EOF
  echo "📝 Created .env — EDIT IT with your database credentials!"
  echo "   nano .env"
  echo ""
  read -p "Press Enter after editing .env, or Ctrl+C to abort..."
fi

# 4. Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# 5. Push database schema
echo "🗄️  Pushing database schema..."
npx prisma db push --skip-generate

# 6. Build frontend
echo "🏗️  Building frontend..."
npm run build

# 7. Create uploads directory
mkdir -p uploads

# 8. Stop existing process (if using PM2)
if command -v pm2 &> /dev/null; then
  pm2 delete lumpat 2>/dev/null || true
  echo "🚀 Starting server with PM2..."
  pm2 start "npx tsx server.ts" --name lumpat --env production
  pm2 save
  echo ""
  echo "============================================"
  echo "  ✅ Server running with PM2!"
  echo "  📊 pm2 status    — check status"
  echo "  📋 pm2 logs lumpat — view logs"
  echo "  🔄 pm2 restart lumpat — restart"
  echo "  🛑 pm2 stop lumpat — stop"
  echo "============================================"
else
  echo ""
  echo "💡 TIP: Install PM2 for auto-restart & background running:"
  echo "   sudo npm install -g pm2"
  echo "   Then run: bash start.sh"
  echo ""
  echo "🚀 Starting server directly..."
  echo "============================================"
  echo "  Server: http://localhost:${PORT:-3001}"
  echo "  Press Ctrl+C to stop"
  echo "============================================"
  NODE_ENV=production npx tsx server.ts
fi
