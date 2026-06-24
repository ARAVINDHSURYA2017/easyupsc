#!/bin/bash
# EasyUPSC Deployment Script for Hostinger VPS
# Run this on your VPS as root

set -e

echo "=== EasyUPSC Deployment ==="

APP_DIR="/var/www/easyupsc"

# 1. Update system & install dependencies
echo "[1/8] Installing system dependencies..."
apt-get update -y
apt-get install -y nginx certbot python3-certbot-nginx curl git

# 2. Install Node.js 20
echo "[2/8] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 3. Install PM2
echo "[3/8] Installing PM2..."
npm install -g pm2

# 4. Create app directory
echo "[4/8] Setting up app directory..."
mkdir -p $APP_DIR

# 5. Copy files (assumes you've already uploaded via scp/sftp)
echo "[5/8] Installing backend dependencies..."
cd $APP_DIR/server
npm install --production

# 6. Configure Nginx
echo "[6/8] Configuring Nginx..."
cp $APP_DIR/nginx.conf /etc/nginx/sites-available/easyupsc
ln -sf /etc/nginx/sites-available/easyupsc /etc/nginx/sites-enabled/easyupsc
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 7. SSL Certificate
echo "[7/8] Getting SSL certificate..."
certbot --nginx -d easyupsc.com -d www.easyupsc.com --non-interactive --agree-tos -m aravindhsuryatce@gmail.com

# 8. Start backend with PM2
echo "[8/8] Starting backend..."
cd $APP_DIR/server
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

echo ""
echo "=== Deployment Complete ==="
echo "Site live at: https://easyupsc.com"
