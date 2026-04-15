#!/bin/bash
# ============================================
# First-time VPS Setup (Ubuntu/Debian)
# Run once: sudo bash setup-vps.sh
# ============================================

set -e

echo "============================================"
echo "  Setting up VPS for Lumpat"
echo "============================================"

# 1. Update system
echo "Updating system..."
apt update && apt upgrade -y

# 2. Install Node.js 20
echo "Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 3. Install PM2
echo "Installing PM2..."
npm install -g pm2

# 4. Install Nginx
echo "Installing Nginx..."
apt install -y nginx

# 5. Install MySQL
echo "Installing MySQL..."
apt install -y mysql-server
systemctl start mysql
systemctl enable mysql

# 6. Setup MySQL database
echo ""
echo "Setting up database..."
mysql -e "CREATE DATABASE IF NOT EXISTS bcr_db;"
mysql -e "CREATE USER IF NOT EXISTS 'bcr_user'@'localhost' IDENTIFIED BY 'bcr_password';"
mysql -e "GRANT ALL PRIVILEGES ON bcr_db.* TO 'bcr_user'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"
echo "[OK] Database created: bcr_db"
echo "[WARN] CHANGE the password! Run: mysql -e \"ALTER USER 'bcr_user'@'localhost' IDENTIFIED BY 'YOUR_STRONG_PASSWORD';\""

# 7. Configure Nginx
echo "Configuring Nginx..."
cp nginx/nginx.conf /etc/nginx/sites-available/lumpat
ln -sf /etc/nginx/sites-available/lumpat /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
systemctl enable nginx

# 8. Setup PM2 startup
pm2 startup systemd -u $SUDO_USER --hp /home/$SUDO_USER
echo ""
echo "============================================"
echo "  VPS Setup Complete!"
echo ""
echo "  Next steps:"
echo "  1. Edit .env with your DB password"
echo "  2. Run: bash start.sh"
echo "  3. Access: http://YOUR_VPS_IP"
echo "============================================"
