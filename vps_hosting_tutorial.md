# Tutorial Hosting WhatsApp Gateway di VPS

## Prerequisites
- VPS dengan Ubuntu 20.04 atau lebih baru
- Domain sudah di-point ke IP VPS (wa.gempaforecast.my.id)
- Akses SSH ke VPS

## 1. Setup Awal VPS

### Update sistem
```bash
sudo apt update && sudo apt upgrade -y
```

### Install Node.js 18
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Install PM2 (Process Manager)
```bash
sudo npm install -g pm2
```

### Install Nginx
```bash
sudo apt install nginx -y
```

### Install Certbot untuk SSL
```bash
sudo apt install certbot python3-certbot-nginx -y
```

## 2. Setup Aplikasi WhatsApp Gateway

### Clone/Upload aplikasi ke VPS
```bash
# Buat direktori aplikasi
sudo mkdir -p /var/www/whatsapp-gateway
cd /var/www/whatsapp-gateway

# Upload file aplikasi Anda ke direktori ini
# Atau clone dari repository
```

### Install dependencies
```bash
npm install
```

### Setup environment file
```bash
cp .env.example .env
nano .env
```

Edit file `.env`:
```env
# Application
NODE_ENV=production
PORT=3000

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production-RANDOM123
JWT_EXPIRES_IN=24h

# CORS
CORS_ORIGIN=https://wa.gempaforecast.my.id

# WhatsApp
WA_SESSION_PATH=./sessions
WA_HEADLESS=true

# Default Admin User
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password-123
ADMIN_API_KEY=your-secure-api-key-change-this-456
```

### Setup aplikasi
```bash
npm run setup
```

### Set permissions
```bash
sudo chown -R www-data:www-data /var/www/whatsapp-gateway
sudo chmod -R 755 /var/www/whatsapp-gateway
```

## 3. Setup Systemd Service (Production-Ready)

### Buat systemd service file
```bash
sudo nano /etc/systemd/system/whatsapp-gateway.service
```

Isi file service:
```ini
[Unit]
Description=WhatsApp Gateway Service
After=network.target

[Service]
Type=simple
User=lukmanfarid
Group=lukmanfarid
WorkingDirectory=/var/www/whatsapp-gateway
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node src/app.js
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal
SyslogIdentifier=whatsapp-gateway

# Resource limits
LimitNOFILE=65536
LimitNPROC=32768

[Install]
WantedBy=multi-user.target
```

### Enable dan start service
```bash
sudo systemctl daemon-reload
sudo systemctl enable whatsapp-gateway
sudo systemctl start whatsapp-gateway
```

### Verifikasi service status
```bash
sudo systemctl status whatsapp-gateway
sudo journalctl -u whatsapp-gateway -f
```

## 4. Setup Nginx

### Backup konfigurasi default
```bash
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup
```

### Buat konfigurasi baru untuk WhatsApp Gateway
```bash
sudo nano /etc/nginx/sites-available/whatsapp-gateway
```

Isi file konfigurasi:
```nginx
server {
    listen 80;
    server_name wa.gempaforecast.my.id;

    # Root directory untuk frontend
    root /var/www/whatsapp-gateway/public;
    index index.html;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # Serve static files
    location / {
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API routes
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # File uploads
    location /uploads/ {
        alias /var/www/whatsapp-gateway/uploads/;
        expires 1d;
        add_header Cache-Control "public";
    }

    # Session stream (Server-Sent Events)
    location /api/v1/session/stream {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # SSE specific settings
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Cache-Control "no-cache";
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Error pages
    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;
}
```

### Buat direktori public dan copy frontend
```bash
sudo mkdir -p /var/www/whatsapp-gateway/public
```

Copy file HTML frontend yang sudah dibuat ke:
```bash
sudo nano /var/www/whatsapp-gateway/public/index.html
```

### Enable site
```bash
sudo ln -s /etc/nginx/sites-available/whatsapp-gateway /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
```

### Test konfigurasi Nginx
```bash
sudo nginx -t
```

### Restart Nginx
```bash
sudo systemctl restart nginx
```

## 5. Setup SSL dengan Let's Encrypt

### Generate SSL certificate
```bash
sudo certbot --nginx -d wa.gempaforecast.my.id
```

### Auto-renewal SSL
```bash
sudo crontab -e
```

Tambahkan line ini:
```bash
0 12 * * * /usr/bin/certbot renew --quiet
```

## 6. Setup Firewall (UFW)

### Enable UFW
```bash
sudo ufw enable
```

### Allow necessary ports
```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw allow 3000  # Port aplikasi (optional, untuk debugging)
```

### Check status
```bash
sudo ufw status
```

## 7. Setup Monitoring dan Logging

### Install htop untuk monitoring
```bash
sudo apt install htop -y
```

### Setup log rotation untuk PM2
```bash
pm2 install pm2-logrotate
```

### Setup logrotate untuk Nginx
```bash
sudo nano /etc/logrotate.d/whatsapp-gateway
```

Isi:
```
/var/www/whatsapp-gateway/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        pm2 reload whatsapp-gateway
    endscript
}
```

## 8. Script Deployment Otomatis

Buat script untuk memudahkan deployment:

```bash
sudo nano /var/www/whatsapp-gateway/deploy.sh
```

Isi script:
```bash
#!/bin/bash

echo "🚀 Starting WhatsApp Gateway deployment..."

# Navigate to app directory
cd /var/www/whatsapp-gateway

# Pull latest code (if using git)
# git pull origin main

# Install/update dependencies
npm install --production

# Restart systemd service
sudo systemctl restart whatsapp-gateway

# Reload Nginx
sudo systemctl reload nginx

# Show status
echo "📊 Application Status:"
sudo systemctl status whatsapp-gateway --no-pager
echo "✅ Deployment completed!"
```

Buat executable:
```bash
sudo chmod +x /var/www/whatsapp-gateway/deploy.sh
```

## 9. Testing dan Verifikasi

### Test aplikasi backend
```bash
curl http://localhost:3000/health
```

### Test melalui domain
```bash
curl https://wa.gempaforecast.my.id/health
```

### Check logs
```bash
# PM2 logs
pm2 logs whatsapp-gateway

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Application logs
tail -f /var/www/whatsapp-gateway/logs/combined.log
```

## 10. Maintenance dan Monitoring

### Perintah untuk monitoring
```bash
# Status aplikasi
sudo systemctl status whatsapp-gateway
sudo journalctl -u whatsapp-gateway -f

# Resource usage
htop
df -h
free -h

# SSL certificate status
sudo certbot certificates

# Service status
sudo systemctl status nginx
sudo systemctl status whatsapp-gateway
```

### Backup database (messages dan users)
```bash
# Create backup script
sudo nano /var/www/whatsapp-gateway/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/whatsapp-gateway"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup data files
cp -r /var/www/whatsapp-gateway/data $BACKUP_DIR/data_$DATE
cp -r /var/www/whatsapp-gateway/sessions $BACKUP_DIR/sessions_$DATE

# Compress backup
tar -czf $BACKUP_DIR/backup_$DATE.tar.gz $BACKUP_DIR/data_$DATE $BACKUP_DIR/sessions_$DATE

# Remove individual folders
rm -rf $BACKUP_DIR/data_$DATE $BACKUP_DIR/sessions_$DATE

# Keep only last 7 backups
find $BACKUP_DIR -name "backup_*.tar.gz" -mtime +7 -delete

echo "Backup completed: backup_$DATE.tar.gz"
```

Setup cron untuk backup otomatis:
```bash
sudo crontab -e
```

Tambahkan:
```bash
0 2 * * * /var/www/whatsapp-gateway/backup.sh
```

## 11. Troubleshooting

### Jika aplikasi tidak bisa start
```bash
# Check systemd logs
sudo journalctl -u whatsapp-gateway -n 50

# Check port availability
sudo netstat -tlnp | grep :3000

# Restart aplikasi
sudo systemctl restart whatsapp-gateway
sudo systemctl reload whatsapp-gateway
```

### Jika QR Code tidak muncul
```bash
# Check if headless mode is properly set
cat .env | grep WA_HEADLESS

# Check Chrome dependencies
sudo apt install -y gconf-service libasound2 libatk1.0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget libgbm-dev
```

### Jika SSL bermasalah
```bash
# Renew SSL certificate
sudo certbot renew

# Check certificate
sudo certbot certificates

# Test SSL
openssl s_client -connect wa.gempaforecast.my.id:443
```

## Keamanan Tambahan

### Ganti default credentials
1. Login ke aplikasi dengan credentials default
2. Ganti API Key dan password admin
3. Update file `.env` dengan credentials baru

### Setup fail2ban (optional)
```bash
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### Regular updates
```bash
# Update sistem
sudo apt update && sudo apt upgrade

# Update Node.js packages
npm audit
npm audit fix
```

Sekarang WhatsApp Gateway Anda sudah siap digunakan di https://wa.gempaforecast.my.id/!

## Default Login
- API Key: `admin-api-key-change-this` (ganti setelah setup)
- Username: `admin`
- Password: `admin123` (ganti setelah setup)