# Coolify Deployment Guide for MyAthan

## Prerequisites
- Hostinger VPS (Ubuntu 22.04+, 2GB+ RAM recommended)
- Domain: myathan.com with DNS access
- Cloudflare account for R2 (firmware storage)

---

## 1. Install Coolify on VPS

```bash
ssh root@your-vps-ip
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Access Coolify at: `http://your-vps-ip:8000`

1. Create admin account
2. Add SSH key for server management
3. Verify server connection is green

---

## 2. Connect GitHub

1. **Settings → Sources → Add GitHub App**
2. Install on the **My-Athan** organization
3. Grant access to `core` and `firmware` repos

---

## 3. Create PostgreSQL Database

1. **Resources → New → Database → PostgreSQL**
2. Configuration:
   - Name: `myathan-db`
   - Version: `16`
   - Database: `myathan`
   - User: `myathan`
   - Password: (auto-generated — **save it**)
3. Click **Deploy**
4. Note the internal hostname (usually `myathan-db`)

---

## 4. Deploy API Service

1. **Resources → New → Application**
2. Source: **GitHub → My-Athan/core**
3. **General tab:**
   - Branch: `main`
   - Build Pack: **Docker**
   - Dockerfile Location: `infra/docker/Dockerfile.api`
   - Docker Compose Location: (leave empty)
   - Build Context: `/`
4. **Network tab:**
   - Ports Exposes: `3000`
   - Domain: `api.myathan.com`
   - HTTPS: Enabled (Let's Encrypt auto)
5. **Environment Variables:**
   ```
   DATABASE_URL=postgresql://myathan:YOUR_DB_PASSWORD@myathan-db:5432/myathan
   JWT_SECRET=<generate with: openssl rand -hex 32>
   NODE_ENV=production
   PORT=3000
   HOST=0.0.0.0
   CORS_ORIGINS=https://app.myathan.com,https://admin.myathan.com
   R2_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
   R2_ACCESS_KEY=your-r2-access-key
   R2_SECRET_KEY=your-r2-secret-key
   R2_BUCKET=myathan
   ```
6. **Health Check tab:**
   - Path: `/health`
   - Port: `3000`
   - Interval: `30`
7. Click **Deploy**
8. After deploy, run DB migrations:
   - Go to **Terminal** tab in Coolify
   - Run: `node -e "import('./dist/db/migrate.js')"`
   - Or SSH into VPS and exec into the container:
     ```bash
     docker exec -it <api-container-id> sh
     npx drizzle-kit push
     ```

---

## 5. Deploy PWA (app.myathan.com)

1. **Resources → New → Application**
2. Source: **GitHub → My-Athan/core**
3. **General tab:**
   - Branch: `main`
   - Build Pack: **Static**
   - Install Command: `npm install`
   - Build Command: `npm run build --workspace=packages/shared && npm run build --workspace=apps/web`
   - Publish Directory: `apps/web/dist`
4. **Network tab:**
   - Domain: `app.myathan.com`
   - HTTPS: Enabled
5. No environment variables needed (PWA uses BLE, not API)
6. Click **Deploy**

---

## 6. Deploy Admin Dashboard (admin.myathan.com)

1. **Resources → New → Application**
2. Source: **GitHub → My-Athan/core**
3. **General tab:**
   - Branch: `main`
   - Build Pack: **Static**
   - Install Command: `npm install`
   - Build Command: `npm run build --workspace=packages/shared && npm run build --workspace=apps/admin`
   - Publish Directory: `apps/admin/dist`
4. **Network tab:**
   - Domain: `admin.myathan.com`
   - HTTPS: Enabled
5. **Environment Variables (build-time):**
   ```
   VITE_API_URL=https://api.myathan.com
   ```
6. Click **Deploy**

---

## 7. Enable Auto-Deploy

For each of the 3 services:
1. **Settings → Git → Enable "Auto Deploy on Push"**
2. Branch: `main`

Now every merge to `main` auto-deploys.

---

## 8. DNS Configuration

Point your domain to the VPS. In your **domain registrar** (or Cloudflare if you transfer DNS there):

### Required DNS Records

| Type  | Name    | Value          | TTL  | Purpose                  |
|-------|---------|----------------|------|--------------------------|
| A     | `@`     | `YOUR_VPS_IP`  | 3600 | myathan.com (root)       |
| A     | `api`   | `YOUR_VPS_IP`  | 3600 | api.myathan.com (API)    |
| A     | `app`   | `YOUR_VPS_IP`  | 3600 | app.myathan.com (PWA)    |
| A     | `admin` | `YOUR_VPS_IP`  | 3600 | admin.myathan.com (dash) |

### Optional Records

| Type  | Name    | Value                            | TTL  | Purpose                  |
|-------|---------|----------------------------------|------|--------------------------|
| CNAME | `www`   | `myathan.com`                    | 3600 | www.myathan.com redirect |
| CAA   | `@`     | `0 issue "letsencrypt.org"`      | 3600 | SSL cert authority       |
| TXT   | `@`     | `v=spf1 -all`                    | 3600 | No email from this domain|

### If Using Cloudflare DNS (Recommended)

If you transfer DNS to Cloudflare:
- Set proxy status to **DNS only** (grey cloud) for all records
  - Coolify's Traefik handles SSL via Let's Encrypt
  - Cloudflare proxy would conflict with Let's Encrypt HTTP-01 challenge
- Or set to **Proxied** (orange cloud) BUT:
  - Go to **SSL/TLS → Full (Strict)** in Cloudflare dashboard
  - This double-proxies (Cloudflare → Traefik → app) but gives you Cloudflare DDoS protection
  - Let's Encrypt renewal needs **DNS-01 challenge** instead (configure in Coolify)

### Verify DNS Propagation

After adding records, verify:
```bash
dig api.myathan.com +short    # Should return YOUR_VPS_IP
dig app.myathan.com +short    # Should return YOUR_VPS_IP
dig admin.myathan.com +short  # Should return YOUR_VPS_IP
```

Or use https://dnschecker.org to check global propagation.

---

## 9. Post-Deploy Checklist

- [ ] `https://api.myathan.com/health` returns `{"status":"ok"}`
- [ ] `https://app.myathan.com` loads the PWA
- [ ] `https://admin.myathan.com` loads the admin login
- [ ] Admin login works (create first admin user via API or DB)
- [ ] Device heartbeats arrive at API (check Coolify logs)
- [ ] Map page shows devices at `/map`
- [ ] OTA releases upload to R2 successfully
- [ ] Auto-deploy triggers on push to main

### Create First Admin User

SSH into VPS and exec into the API container:
```bash
docker exec -it <api-container-id> sh
node -e "
  const bcrypt = require('bcrypt');
  const hash = bcrypt.hashSync('your-password', 10);
  console.log(hash);
"
```
Then insert into the database:
```sql
INSERT INTO users (email, password_hash, role)
VALUES ('admin@myathan.com', '<hash-from-above>', 'admin');
```

---

## 10. Set Up Backups

```bash
ssh root@your-vps-ip
```

Create `/opt/myathan/backup.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/opt/myathan/backups"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Dump database
docker exec myathan-db pg_dump -U myathan myathan | gzip > "$BACKUP_DIR/db_$TIMESTAMP.sql.gz"

# Keep last 14 days
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +14 -delete

echo "Backup completed: db_$TIMESTAMP.sql.gz"
```

```bash
chmod +x /opt/myathan/backup.sh
crontab -e
# Add: 0 3 * * * /opt/myathan/backup.sh
```

---

## Architecture Overview

```
                    ┌─────────────────┐
                    │  Cloudflare DNS  │
                    │  myathan.com     │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Hostinger VPS  │
                    │  (Coolify)      │
                    │                 │
                    │  ┌─ Traefik ──┐ │
                    │  │ SSL + Route│ │
                    │  └──┬──┬──┬───┘ │
                    │     │  │  │     │
               ┌────┘     │  │  └────┐│
               ▼          ▼  │       ▼│
          ┌────────┐ ┌───────┴┐ ┌────────┐
          │ API    │ │ PWA    │ │ Admin  │
          │ :3000  │ │ static │ │ static │
          └───┬────┘ └────────┘ └────────┘
              │
         ┌────▼────┐
         │ Postgres│
         │  :5432  │
         └─────────┘
```

## Monitoring

- Coolify dashboard: `https://your-vps-ip:8000`
- API health: `https://api.myathan.com/health`
- Logs: Coolify → Service → Logs tab

## Rollback

1. Coolify → Service → Deployments tab
2. Click **Redeploy** on any previous successful deployment

## Cost Estimate

| Item | Monthly Cost |
|------|-------------|
| Hostinger VPS (KVM 2) | ~$6 |
| Domain (myathan.com) | ~$1 |
| Cloudflare R2 (10GB) | ~$0.15 |
| **Total** | **~$7/month** |
