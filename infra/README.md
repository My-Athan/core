# MyAthan Infrastructure

Production deployment on Hostinger VPS with Coolify.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 Hostinger VPS                     │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Coolify  │  │ Traefik  │  │  PostgreSQL   │  │
│  │ (manager) │  │ (proxy)  │  │  (database)   │  │
│  └──────────┘  └──────────┘  └───────────────┘  │
│                      │                            │
│       ┌──────────────┼──────────────┐            │
│       ▼              ▼              ▼            │
│  ┌─────────┐  ┌───────────┐  ┌──────────┐      │
│  │   API   │  │    PWA    │  │  Admin   │      │
│  │ :3000   │  │  (static) │  │ (static) │      │
│  └─────────┘  └───────────┘  └──────────┘      │
│                                                   │
│  External: Cloudflare R2 (firmware bins, audio)  │
└─────────────────────────────────────────────────┘
```

## DNS Records

| Subdomain | Type | Target | Service |
|-----------|------|--------|---------|
| `api.myathan.com` | A | VPS IP | Backend API |
| `app.myathan.com` | A | VPS IP | PWA (mobile) |
| `admin.myathan.com` | A | VPS IP | Admin dashboard |
| `myathan.com` | A | VPS IP | Marketing site |

## Quick Start (Development)

```bash
# Start PostgreSQL only
docker compose -f docker/docker-compose.yml up db -d

# Start everything (API + DB)
docker compose -f docker/docker-compose.yml up -d

# View logs
docker compose -f docker/docker-compose.yml logs -f api

# Stop
docker compose -f docker/docker-compose.yml down
```

## Production Deployment

See [coolify-setup.md](coolify-setup.md) for step-by-step Coolify setup.

## Backups

Daily PostgreSQL backups to Cloudflare R2 with 30-day retention.
See backup script in [coolify-setup.md](coolify-setup.md).

## Cost Estimate

| Item | Monthly Cost |
|------|-------------|
| Hostinger VPS (KVM 2) | ~$6 |
| Domain (myathan.com) | ~$1 |
| Cloudflare R2 (10GB) | ~$0.15 |
| **Total** | **~$7/month** |
