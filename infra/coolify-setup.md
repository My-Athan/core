# Coolify Setup Guide for MyAthan

## Prerequisites
- Hostinger VPS (Ubuntu 22.04+, 2GB+ RAM recommended)
- Domain: myathan.com with DNS access
- Cloudflare account for R2

## Step-by-Step

### 1. Install Coolify on VPS

```bash
ssh root@your-vps-ip
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Access: `https://your-vps-ip:8000`

### 2. Initial Coolify Setup

1. Create admin account
2. Add SSH key for server management
3. Verify server connection

### 3. Connect GitHub

1. Settings → Sources → Add GitHub App
2. Install on My-Athan organization
3. Grant access to `core` and `firmware` repos

### 4. Create Database

1. Resources → New → PostgreSQL
2. Configuration:
   - Name: `myathan-db`
   - Version: `16`
   - Database: `myathan`
   - User: `myathan`
   - Password: (auto-generated, save it)
3. Deploy

### 5. Deploy API Service

1. Resources → New → Application
2. Source: GitHub → `My-Athan/core`
3. Build configuration:
   - Branch: `main`
   - Build Pack: Docker
   - Dockerfile: `infra/docker/Dockerfile.api`
   - Build Context: `/`
4. Network:
   - Port: `3000`
   - Domain: `api.myathan.com`
   - HTTPS: auto (Let's Encrypt)
5. Environment Variables:
   ```
   DATABASE_URL=postgresql://myathan:<password>@myathan-db:5432/myathan
   JWT_SECRET=<openssl rand -hex 32>
   NODE_ENV=production
   ```
6. Health Check: `GET /health`
7. Deploy

### 6. Deploy PWA (Static)

1. Resources → New → Application
2. Source: GitHub → `My-Athan/core`
3. Build configuration:
   - Branch: `main`
   - Build Pack: Nixpacks
   - Build Command: `npm install && npm run build --workspace=packages/shared && npm run build --workspace=apps/web`
   - Install Command: (leave empty)
   - Start Command: (leave empty, static)
   - Publish Directory: `apps/web/dist`
4. Domain: `app.myathan.com`
5. Deploy

### 7. Deploy Admin (Static)

Same as PWA but:
- Build Command: `npm install && npm run build --workspace=packages/shared && npm run build --workspace=apps/admin`
- Publish Directory: `apps/admin/dist`
- Domain: `admin.myathan.com`

### 8. Configure Auto-Deploy

Each service in Coolify:
1. Settings → Git → Enable "Auto Deploy on Push"
2. Branch: `main`
3. Coolify will redeploy on every push to main

### 9. Set Up Backups

1. SSH to VPS
2. Create backup script: `/opt/myathan/backup.sh` (see infra/README.md)
3. Add cron: `crontab -e` → `0 3 * * * /opt/myathan/backup.sh`

### 10. DNS Configuration

In your domain registrar / Cloudflare:

| Type | Name | Value |
|------|------|-------|
| A | api | VPS IP |
| A | app | VPS IP |
| A | admin | VPS IP |
| A | @ | VPS IP |

## Monitoring

- Coolify dashboard: `https://your-vps-ip:8000`
- API health: `https://api.myathan.com/health`
- Logs: Coolify → Service → Logs tab

## Rollback

1. Coolify → Service → Deployments tab
2. Click "Redeploy" on any previous successful deployment
3. Or via git: `git revert HEAD && git push origin main`

## Cost Estimate

| Item | Monthly Cost |
|------|-------------|
| Hostinger VPS (KVM 2) | ~$6 |
| Domain (myathan.com) | ~$1 |
| Cloudflare R2 (10GB) | ~$0.15 |
| **Total** | **~$7/month** |
