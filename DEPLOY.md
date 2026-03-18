# Samity App — Deployment Guide
# =====================================================

## What's in this package
- server.js      → Node.js backend (API + serves frontend)
- database.js    → SQLite database setup + seed data
- public/        → Frontend (HTML app)
- package.json   → Dependencies
- .env.example   → Configuration template

## Step 1 — Upload files to your server
Upload the entire samity-app/ folder to your server.
Recommended path: /var/www/samity-app/

## Step 2 — Install Node.js (if not installed)
SSH into your server and run:

  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs

Verify: node --version   (should show v20.x)

## Step 3 — Install dependencies
  cd /var/www/samity-app
  npm install

## Step 4 — Create your .env file
  cp .env.example .env
  nano .env

Edit these values:
  PORT=3000
  JWT_SECRET=any_long_random_string_at_least_32_chars
  ADMIN_USERNAME=admin
  ADMIN_PASSWORD=your_secure_password

## Step 5 — Test it works
  node server.js

Open http://your-server-ip:3000 in browser.
If it loads, press Ctrl+C and continue to Step 6.

## Step 6 — Install PM2 (keeps app running forever)
  sudo npm install -g pm2
  pm2 start server.js --name samity
  pm2 save
  pm2 startup    # follow the command it gives you

Useful PM2 commands:
  pm2 status          → see if app is running
  pm2 logs samity     → view logs
  pm2 restart samity  → restart after changes

## Step 7 — Configure Nginx reverse proxy
(So your domain points to the Node app)

Create config file:
  sudo nano /etc/nginx/sites-available/samity

Paste this (replace YOUR_DOMAIN):
---
server {
    listen 80;
    server_name YOUR_DOMAIN;  # e.g. test.sleekdigitalsolution.com

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
---

Enable it:
  sudo ln -s /etc/nginx/sites-available/samity /etc/nginx/sites-enabled/
  sudo nginx -t
  sudo systemctl reload nginx

## Step 8 — HTTPS with Let's Encrypt (recommended)
  sudo apt install certbot python3-certbot-nginx
  sudo certbot --nginx -d YOUR_DOMAIN

## Done!
Your app is now live at https://YOUR_DOMAIN

## Database location
Data is stored in: /var/www/samity-app/db/samity.db
Back it up regularly:
  cp /var/www/samity-app/db/samity.db /backup/samity_$(date +%Y%m%d).db

## Updating the app
  cd /var/www/samity-app
  # upload new files
  pm2 restart samity
