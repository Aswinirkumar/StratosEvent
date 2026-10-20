# StratosEvent — Production Deployment Checklist & Operational Guide

**Platform**: StratosEvent — Enterprise Event Management & Registration Platform  
**Target Environments**: Docker, Ubuntu/Debian Linux (Systemd / Nginx), Cloud Platforms (Render, Railway, AWS ECS/EC2)  
**Security Standard**: CIS Node.js / OWASP Top 10 Aligned  
**Revision Date**: October 20, 2026  

---

## 📋 1. Pre-Deployment Verification Checklist

Complete and sign off every item prior to promoting StratosEvent to staging or production.

| Category | Verification Item | Status | Verification Command / Evidence |
| :--- | :--- | :---: | :--- |
| **Security** | `JWT_SECRET` is set to strong random string (>= 32 chars) | `REQUIRED` | Server fails to boot if `JWT_SECRET` is default in `NODE_ENV=production`. |
| **Security** | CWE-269 privilege escalation prevented on registration | `VERIFIED` | Server forces `role: 'participant'` on `POST /api/auth/register`. |
| **Security** | `.env` and sensitive credentials excluded from Git | `VERIFIED` | Root `.gitignore` ignores `.env`, `backend/.env`, and credential logs. |
| **Database** | MySQL InnoDB storage engine with UTF8MB4 charset | `VERIFIED` | Foreign keys with `ON DELETE CASCADE` and index constraints verified. |
| **Database** | Database migration runner used instead of destructive SQL | `REQUIRED` | Never re-run `schema.sql` (contains `DROP TABLE`). Use `database/migrations/`. |
| **Automated Tests** | Backend unit & integration test suite passes 100% | `VERIFIED` | 35/35 passing in `backend/tests/api.test.js`. |
| **Automated Tests** | End-to-end verification suite passes 100% | `VERIFIED` | 26/26 passing in `backend/tests/e2e_verification.js`. |
| **Frontend** | Responsive layout tested at 375px (mobile) and 1400px (desktop) | `VERIFIED` | 0px horizontal scroll, fluid cards, responsive drawer navigation. |
| **CORS** | CORS origin restricted to authorized frontend domains | `REQUIRED` | Configure `CORS_ORIGIN` in production environment. |
| **Observability** | `/api/health` endpoint responds with 200 OK and DB status | `VERIFIED` | Healthcheck reports API readiness and live DB connectivity. |

---

## ⚙️ 2. Environment Variables Configuration

Create a `.env` file in the `backend/` directory or inject through your cloud provider's secret manager:

```ini
# ==========================================
# StratosEvent Backend Environment Variables
# ==========================================

# Server Configuration
PORT=5000
NODE_ENV=production

# Database Connection (MySQL 8.0+)
DB_HOST=your-mysql-hostname.provider.com
DB_PORT=3306
DB_USER=stratosevent_user
DB_PASSWORD=your_secure_db_password
DB_NAME=stratosevent_db
DB_CONNECTION_LIMIT=15

# Security & Authentication
# MUST be at least 32 characters long in production
JWT_SECRET=c8e7f1a9b4d3e2f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9
JWT_EXPIRES_IN=24h

# Cross-Origin Resource Sharing (CORS)
# Whitelist only the domain hosting the frontend
CORS_ORIGIN=https://stratosevent.example.com
```

> [!WARNING]
> In `NODE_ENV=production`, `backend/middleware/auth.js` strictly validates that `JWT_SECRET` is not set to default fallback strings (`your_super_secret_jwt_key_change_in_production`). Boot will immediately terminate with an error code if this is not met.

---

## 🗄️ 3. Database Migration Strategy

### Initial Provisioning (Clean Database)
Run the initial schema and seed on an empty database:
```bash
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < database/schema.sql
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < database/seed.sql
```

### Incremental Migrations (Existing Database)
> [!CAUTION]
> NEVER re-run `database/schema.sql` against an existing production or staging database, as it contains destructive `DROP TABLE IF EXISTS` statements.

Apply incremental migrations from `database/migrations/`:
```bash
# Example: Adding Ticket Tiers
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < database/migrations/001_add_ticket_tiers.sql
```

---

## 🚀 4. Deployment Guides

### Option A: Node.js + Systemd + Nginx Reverse Proxy (Virtual Machine / EC2)

1. **Clone & Install Dependencies**:
   ```bash
   git clone <repo-url> /var/www/stratosevent
   cd /var/www/stratosevent/backend
   npm ci --production
   ```

2. **Configure Systemd Service** (`/etc/systemd/system/stratosevent.service`):
   ```ini
   [Unit]
   Description=StratosEvent Backend API Service
   After=network.target mysql.service

   [Service]
   Type=simple
   User=www-data
   WorkingDirectory=/var/www/stratosevent/backend
   ExecStart=/usr/bin/node server.js
   Restart=on-failure
   RestartSec=5s
   EnvironmentFile=/var/www/stratosevent/backend/.env

   [Install]
   WantedBy=multi-user.target
   ```
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now stratosevent
   ```

3. **Configure Nginx Reverse Proxy & Static Host**:
   ```nginx
   server {
       listen 80;
       server_name stratosevent.example.com;
       return 301 https://$host$request_uri;
   }

   server {
       listen 443 ssl http2;
       server_name stratosevent.example.com;

       ssl_certificate /etc/letsencrypt/live/stratosevent.example.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/stratosevent.example.com/privkey.pem;

       # Frontend Static Files
       root /var/www/stratosevent/frontend;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }

       # Backend API Reverse Proxy
       location /api/ {
           proxy_pass http://127.0.0.1:5000/api/;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

---

## 🧪 5. Post-Deployment Smoke Tests

Execute the following smoke tests immediately after deployment:

1. **API Readiness Check**:
   ```bash
   curl -s -f https://stratosevent.example.com/api/health | jq .
   # Expected: {"status":"UP","database":{"status":"connected"}}
   ```

2. **Public Events Discovery**:
   ```bash
   curl -s -f https://stratosevent.example.com/api/events | jq '.events | length'
   # Expected: Integer >= 1
   ```

3. **Participant Login**:
   ```bash
   curl -s -X POST https://stratosevent.example.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"participant1@example.com","password":"Password123!"}' | jq '.success'
   # Expected: true
   ```

4. **Security Privilege Guard Test**:
   ```bash
   curl -s -X POST https://stratosevent.example.com/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"full_name":"Hacker","email":"hacker@test.com","password":"Password123!","role":"admin"}' | jq '.user.role'
   # Expected: "participant" (Admin role must be strictly rejected)
   ```

---

## 🔄 6. Rollback & Disaster Recovery Procedures

1. **Application Rollback**:
   - Revert Git commit: `git revert HEAD && git push origin main`
   - Restart service: `sudo systemctl restart stratosevent`
2. **Database Rollback**:
   - Restore latest snapshot:
     ```bash
     mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < backups/stratosevent_backup_YYYYMMDD.sql
     ```
3. **Emergency Secret Rotation**:
   - If `JWT_SECRET` is compromised, update in `.env` immediately.
   - Restart backend server. All existing active sessions will be instantly invalidated and require re-authentication.
