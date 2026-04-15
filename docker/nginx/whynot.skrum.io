# ============================================
# whynot — Nginx Configuration
# Domains:
#   - whynot.skrum.io             → Frontend SPA (user-facing): 5183
#   - admin.whynot.skrum.io       → Admin Frontend SPA: 5184
#   - superadmin.whynot.skrum.io  → Admin Frontend SPA (superadmin namespace): 5184
#     (hostname alias — same upstream as admin, role-gated in the SPA)
# ============================================
# whynot.skrum.io routing:
#   - /           → Frontend SPA (React): 5183
#   - /api/       → Gateway API (Express, 3010, direct)
#   - /ws/        → test-executor browser stream (WebSocket)
#   - /ws/qa-loop → qa-loop-executor (WebSocket)
#   - /ws/perf    → qa-loop-executor perf metrics (WebSocket)
#
# admin.whynot.skrum.io routing:
#   - /           → Admin Frontend SPA (React): 5184
#   - /api/       → Gateway API (Express, 3010, direct)
#
# superadmin.whynot.skrum.io routing:
#   - /           → Admin Frontend SPA (React): 5184  (same upstream)
#   - /api/       → Gateway API (Express, 3010, direct)
#
# Prerequisites:
#   - DNS: A/AAAA records for superadmin.whynot.skrum.io must point to this host.
#   - If /etc/nginx/sites-available/whynot already exists (old non-versioned copy),
#     remove or replace it before creating the symlink below.
#
# Install (symlink approach — future edits auto-propagate):
#   sudo ln -sf /home/serverlessbase/whynot/docker/nginx/whynot.skrum.io \
#               /etc/nginx/sites-available/whynot.skrum.io
#   sudo ln -sf /etc/nginx/sites-available/whynot.skrum.io \
#               /etc/nginx/sites-enabled/whynot.skrum.io
#   sudo nginx -t && sudo systemctl reload nginx
#   sudo certbot --nginx -d whynot.skrum.io -d admin.whynot.skrum.io -d superadmin.whynot.skrum.io
#
# Manual sync (alternative to symlink):
#   sudo cp /home/serverlessbase/whynot/docker/nginx/whynot.skrum.io \
#           /etc/nginx/sites-available/whynot.skrum.io
#   sudo nginx -t && sudo systemctl reload nginx
#
# Stripe webhooks:
#   The /api/webhooks/stripe endpoint is accessible via all three hostnames.
#   In production, pin the Stripe webhook URL to https://whynot.skrum.io/api/webhooks/stripe
#   in the Stripe Dashboard to avoid signature mismatches across hostnames.
# ============================================

# Upstream definitions with keepalive for connection pooling
upstream whynot_frontend {
    server 127.0.0.1:5183;
    keepalive 64;
}

upstream whynot_admin_frontend {
    server 127.0.0.1:5184;
    keepalive 64;
}

upstream whynot_gateway {
    server 127.0.0.1:3010;
    keepalive 64;
}

upstream whynot_test_executor {
    server 127.0.0.1:3011;
    keepalive 64;
}

upstream whynot_qa_loop {
    server 127.0.0.1:3012;
    keepalive 64;
}

# ============================================
# Rate limiting zones
# ============================================
limit_req_zone $binary_remote_addr zone=whynot_api_limit:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=whynot_auth_limit:10m rate=5r/s;

# ============================================
# WebSocket upgrade map
# Note: defined globally in nginx.conf or another site, so reuse with
# care — if it collides, rename this block or move it to nginx.conf.
# ============================================
map $http_upgrade $whynot_connection_upgrade {
    default upgrade;
    ''      close;
}

# ============================================
# Main Server
# ============================================
server {
    server_name whynot.skrum.io;

    # Buffer and timeout configuration
    client_body_buffer_size 128K;
    client_header_buffer_size 2k;
    client_max_body_size 100M;
    large_client_header_buffers 8 32k;

    # Logging
    access_log /var/log/nginx/whynot_access.log combined;
    error_log  /var/log/nginx/whynot_error.log warn;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

    # Favicon and robots
    location = /favicon.ico { access_log off; log_not_found off; proxy_pass http://whynot_frontend; }
    location = /robots.txt  { access_log off; log_not_found off; proxy_pass http://whynot_frontend; }

    # ----------------------------------------
    # Auth endpoints — stricter rate limiting
    # ----------------------------------------
    location ~ ^/api/(auth|login|register|oauth) {
        limit_req zone=whynot_auth_limit burst=10 nodelay;

        proxy_pass http://whynot_gateway;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    # ----------------------------------------
    # Gateway API — direct proxy, bypasses the
    # frontend container's internal /api hop
    # ----------------------------------------
    location /api/ {
        limit_req zone=whynot_api_limit burst=50 nodelay;

        proxy_pass http://whynot_gateway;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
        proxy_buffering off;
    }

    # ----------------------------------------
    # WebSocket — QA loop orchestrator
    # (order matters: qa-loop must be matched before /ws/)
    # ----------------------------------------
    location /ws/qa-loop {
        proxy_pass http://whynot_qa_loop;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $whynot_connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # ----------------------------------------
    # WebSocket — k6 performance metrics
    # ----------------------------------------
    location /ws/perf {
        proxy_pass http://whynot_qa_loop;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $whynot_connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # ----------------------------------------
    # WebSocket — test-executor browser stream
    # ----------------------------------------
    location /ws/ {
        proxy_pass http://whynot_test_executor;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $whynot_connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # ----------------------------------------
    # Static assets — cache aggressively
    # (served by the frontend container's nginx)
    # ----------------------------------------
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://whynot_frontend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        expires 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";

        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }

    # ----------------------------------------
    # Frontend SPA (React) — catch-all
    # ----------------------------------------
    location / {
        proxy_pass http://whynot_frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $whynot_connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }

    # Deny sensitive files
    location ~ /\. { deny all; access_log off; log_not_found off; }
    location ~ ~$  { deny all; access_log off; log_not_found off; }

    listen 80;
    listen [::]:80;
    # Certbot (--nginx) will add the listen 443 ssl block and ssl_* directives
    # on the next run. See the install instructions at the top of this file.
}

# ============================================
# Admin Server — admin.whynot.skrum.io
# ============================================
server {
    server_name admin.whynot.skrum.io;

    # Buffer and timeout configuration
    client_body_buffer_size 128K;
    client_header_buffer_size 2k;
    client_max_body_size 100M;
    large_client_header_buffers 8 32k;

    # Logging
    access_log /var/log/nginx/whynot_admin_access.log combined;
    error_log  /var/log/nginx/whynot_admin_error.log warn;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

    # Favicon and robots
    location = /favicon.ico { access_log off; log_not_found off; proxy_pass http://whynot_admin_frontend; }
    location = /robots.txt  { access_log off; log_not_found off; proxy_pass http://whynot_admin_frontend; }

    # ----------------------------------------
    # Auth endpoints — stricter rate limiting
    # ----------------------------------------
    location ~ ^/api/(auth|login|register|oauth) {
        limit_req zone=whynot_auth_limit burst=10 nodelay;

        proxy_pass http://whynot_gateway;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    # ----------------------------------------
    # Gateway API — direct proxy
    # ----------------------------------------
    location /api/ {
        limit_req zone=whynot_api_limit burst=50 nodelay;

        proxy_pass http://whynot_gateway;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
        proxy_buffering off;
    }

    # ----------------------------------------
    # Static assets — cache aggressively
    # ----------------------------------------
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://whynot_admin_frontend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        expires 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";

        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }

    # ----------------------------------------
    # Admin SPA (React) — catch-all
    # ----------------------------------------
    location / {
        proxy_pass http://whynot_admin_frontend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }

    # Deny sensitive files
    location ~ /\. { deny all; access_log off; log_not_found off; }
    location ~ ~$  { deny all; access_log off; log_not_found off; }

    listen 80;
    listen [::]:80;
    # Certbot will add the SSL listen 443 block on the next run.
}

# ============================================
# Superadmin Server — superadmin.whynot.skrum.io
# Hostname alias for admin-frontend (superadmin namespace).
# Same upstream (whynot_admin_frontend:5184), same config.
# The SPA role-gates pages based on window.location.hostname.
# ============================================
server {
    server_name superadmin.whynot.skrum.io;

    # Buffer and timeout configuration
    client_body_buffer_size 128K;
    client_header_buffer_size 2k;
    client_max_body_size 100M;
    large_client_header_buffers 8 32k;

    # Logging
    access_log /var/log/nginx/whynot_superadmin_access.log combined;
    error_log  /var/log/nginx/whynot_superadmin_error.log warn;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

    # Favicon and robots
    location = /favicon.ico { access_log off; log_not_found off; proxy_pass http://whynot_admin_frontend; }
    location = /robots.txt  { access_log off; log_not_found off; proxy_pass http://whynot_admin_frontend; }

    # ----------------------------------------
    # Auth endpoints — stricter rate limiting
    # ----------------------------------------
    location ~ ^/api/(auth|login|register|oauth) {
        limit_req zone=whynot_auth_limit burst=10 nodelay;

        proxy_pass http://whynot_gateway;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    # ----------------------------------------
    # Gateway API — direct proxy
    # ----------------------------------------
    location /api/ {
        limit_req zone=whynot_api_limit burst=50 nodelay;

        proxy_pass http://whynot_gateway;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
        proxy_buffering off;
    }

    # ----------------------------------------
    # Static assets — cache aggressively
    # ----------------------------------------
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://whynot_admin_frontend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        expires 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";

        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }

    # ----------------------------------------
    # Admin SPA (React) — catch-all
    # ----------------------------------------
    location / {
        proxy_pass http://whynot_admin_frontend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }

    # Deny sensitive files
    location ~ /\. { deny all; access_log off; log_not_found off; }
    location ~ ~$  { deny all; access_log off; log_not_found off; }

    listen 80;
    listen [::]:80;
    # Certbot will add the SSL listen 443 block on the next run.
}
