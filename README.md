<p align="center">
  <h1 align="center">MyAthan Core</h1>
  <p align="center">
    Backend API, mobile PWA, and admin dashboard for the MyAthan smart prayer device
    <br />
    <em>Device management &bull; Prayer times API &bull; OTA updates &bull; Fleet analytics</em>
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/backend-Fastify-black" alt="Fastify" />
  <img src="https://img.shields.io/badge/database-PostgreSQL-blue" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/frontend-React-61dafb" alt="React" />
  <img src="https://img.shields.io/badge/deploy-Coolify-purple" alt="Coolify" />
</p>

---

## Overview

MyAthan Core is the cloud platform for [MyAthan firmware](https://github.com/My-Athan/firmware) devices. It provides device registration, config sync, OTA firmware updates, multi-room coordination, and fleet management.

**The device works fully offline** for prayer time calculation. This platform adds:
- Remote config management (change settings from anywhere)
- OTA firmware updates with staged rollouts
- Multi-room synchronized playback across devices
- Fleet analytics and monitoring
- Mobile PWA for device setup and control

---

## Architecture

```
                    ┌──────────────────┐
                    │   MyAthan PWA    │ ◀── React + Tailwind
                    │  (app.myathan.com)│     BLE + HTTP
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │    Fastify API    │ ◀── TypeScript + Drizzle
                    │ (api.myathan.com) │     JWT + API Key auth
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
       ┌────────────┐ ┌──────────┐ ┌──────────────┐
       │ PostgreSQL │ │ Cloudflare│ │ Admin Panel  │
       │ (Drizzle)  │ │ R2       │ │ (admin.      │
       │            │ │ (storage)│ │  myathan.com)│
       └────────────┘ └──────────┘ └──────────────┘

       ┌──────────────────────────────────────────┐
       │          MyAthan Devices (ESP32)          │
       │  Register → Config Sync → Heartbeat → OTA│
       └──────────────────────────────────────────┘
```

---

## Monorepo Structure

```
core/
├── apps/
│   ├── api/                 # Fastify backend API
│   │   ├── src/
│   │   │   ├── index.ts            # Server entry + plugins
│   │   │   ├── db/
│   │   │   │   ├── schema.ts       # Drizzle ORM (6 tables)
│   │   │   │   └── index.ts        # DB connection pool
│   │   │   ├── middleware/
│   │   │   │   └── device-auth.ts  # API key + JWT auth
│   │   │   ├── routes/
│   │   │   │   ├── device/         # Device endpoints (7)
│   │   │   │   └── admin/          # Admin endpoints (12)
│   │   │   └── services/
│   │   │       ├── prayer-times.ts # adhan-js wrapper
│   │   │       ├── hijri.ts        # Hijri calendar
│   │   │       ├── multi-room.ts   # Sync coordinator
│   │   │       └── audio-catalog.ts# R2 audio storage
│   │   └── vitest.config.ts
│   │
│   ├── web/                 # Mobile PWA
│   │   ├── src/
│   │   │   ├── pages/              # 7 pages
│   │   │   ├── components/         # Shared UI components
│   │   │   ├── hooks/              # useDeviceStatus, useDeviceConfig
│   │   │   └── lib/
│   │   │       ├── device-api.ts   # HTTP client (with timeout)
│   │   │       └── ble-provisioning.ts  # Web Bluetooth
│   │   └── index.html
│   │
│   └── admin/               # Admin dashboard
│       ├── src/
│       │   ├── pages/              # 5 pages + login
│       │   ├── components/         # AdminLayout
│       │   └── lib/api.ts          # Admin API client
│       └── index.html
│
├── packages/
│   └── shared/              # Shared TypeScript types
│       └── src/types/
│           ├── device.ts           # DeviceConfig (matches firmware)
│           ├── prayer.ts           # PrayerTimes, HijriDate
│           ├── multi-room.ts       # Group sync types
│           └── holidays.ts         # 7 Islamic holidays enum
│
├── infra/
│   ├── docker/
│   │   ├── docker-compose.yml      # Dev (API + PostgreSQL)
│   │   ├── docker-compose.prod.yml # Production with healthchecks
│   │   ├── Dockerfile.api          # Multi-stage build
│   │   └── init.sql                # DB initialization
│   ├── coolify-setup.md            # Production deployment guide
│   └── README.md                   # Infrastructure docs
│
├── .github/workflows/
│   ├── ci.yml                      # Lint → Test → Build → Docker
│   └── deploy.yml                  # Coolify webhook deploy
│
├── package.json                    # npm workspaces root
├── tsconfig.base.json              # Shared TypeScript config
├── .env.example                    # Environment variables template
└── CLAUDE.md                       # AI assistant project context
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **API** | Fastify 5, TypeScript | REST API (20+ endpoints) |
| **ORM** | Drizzle ORM | Type-safe PostgreSQL queries |
| **Database** | PostgreSQL 16 | Device registry, stats, releases |
| **Auth** | bcrypt + JWT + HMAC API keys | Admin login + device auth |
| **Validation** | Zod | Input schemas on all endpoints |
| **Storage** | Cloudflare R2 | Firmware binaries + audio files |
| **PWA** | React 19, Vite, Tailwind | Mobile device management |
| **Admin** | React 19, Vite | Fleet management dashboard |
| **Deploy** | Coolify on Hostinger VPS | Auto-deploy from git |
| **CI/CD** | GitHub Actions | Lint, test, build, deploy |

---

## API Endpoints

### Device Endpoints (authenticated via API key)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/device/register` | Register device, receive API key |
| `GET` | `/api/device/config` | Poll for config updates |
| `PUT` | `/api/device/config` | Push config changes |
| `POST` | `/api/device/heartbeat` | Status update + stats + sync triggers |
| `GET` | `/api/device/timetable` | Server-side prayer times + Hijri date |
| `GET` | `/api/device/ota/check` | Check for firmware updates |
| `GET` | `/api/device/sync` | Get pending multi-room triggers |

### Admin Endpoints (authenticated via JWT)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/admin/auth/login` | Admin login, returns JWT |
| `GET` | `/api/admin/devices` | Paginated device fleet (with online status) |
| `GET` | `/api/admin/devices/:id` | Device detail + 7-day stats |
| `PUT` | `/api/admin/devices/:id/config` | Push config to device |
| `GET` | `/api/admin/releases` | List firmware releases |
| `POST` | `/api/admin/releases` | Register new release |
| `PUT` | `/api/admin/releases/:version` | Update rollout % / mark stable |
| `GET` | `/api/admin/groups` | List multi-room groups |
| `POST` | `/api/admin/groups` | Create group |
| `POST` | `/api/admin/groups/:id/sync` | Trigger synchronized playback |
| `GET` | `/api/admin/stats` | Fleet analytics |

---

## Database Schema

```
users           devices              device_groups
┌──────────┐   ┌──────────────────┐  ┌──────────────┐
│ id (PK)  │◀──│ userId (FK)      │  │ id (PK)      │
│ email    │   │ id (PK)          │──│              │
│ password │   │ deviceId (unique)│  │ name         │
│ role     │   │ apiKey           │  │ syncEnabled  │
└──────────┘   │ groupId (FK) ────│─▶│ createdBy    │
               │ firmwareVersion  │  └──────────────┘
               │ lastHeartbeat    │
               │ config (JSONB)   │  sync_triggers
               └──────────────────┘  ┌──────────────┐
                                     │ groupId (FK) │
releases          stats              │ prayer       │
┌────────────┐   ┌──────────────┐   │ triggerEpoch │
│ version    │   │ deviceId     │   │ consumed     │
│ sha256     │   │ date         │   └──────────────┘
│ size       │   │ prayerPlays  │
│ r2Url      │   │ errors       │
│ rollout %  │   │ uptime       │
│ isStable   │   │ freeHeap     │
└────────────┘   └──────────────┘
```

**Indexes:** `devices(groupId)`, `devices(lastHeartbeat)`, `stats(deviceId, date)`, `syncTriggers(groupId, consumed)`

---

## Mobile PWA

The PWA at `app.myathan.com` provides:

| Page | Features |
|------|----------|
| **Home** | Next prayer countdown, quick play/preview, Hijri date, device info |
| **Setup** | BLE WiFi provisioning (Web Bluetooth API) |
| **Prayer Times** | All 6 times with next-prayer highlight, Hijri date + holidays |
| **Audio Settings** | Per-prayer track with **preview button**, volume schedule, iqama delay |
| **Ramadan** | Auto-detect toggle, suhoor mode (none/sound/LED/custom), Hijri adjustment |
| **Multi-Room** | Join/leave group, test sync |
| **Settings** | Location, calculation method, ASR (Standard/Hanafi), high-latitude, holidays |

### BLE Provisioning Flow
1. User opens PWA and taps "Set Up Device"
2. Browser scans for `MyAthan-XXXXXX` via Web Bluetooth
3. Connects and writes WiFi SSID + password via GATT characteristics
4. Device connects to WiFi and begins operation

---

## Admin Dashboard

The admin panel at `admin.myathan.com` provides:

| Page | Features |
|------|----------|
| **Dashboard** | Fleet summary (total/online devices), firmware distribution, 7-day activity |
| **Devices** | Paginated table with online status, detail modal (config + stats + RSSI) |
| **Releases** | Firmware versions with staged rollout (10% &rarr; 50% &rarr; 100% &rarr; Stable) |
| **Groups** | Multi-room management, per-prayer sync trigger buttons |
| **Analytics** | Prayer play bar charts, error trends, firmware distribution, online rate |

---

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 16+ (or Docker)
- npm 9+

### 1. Clone

```bash
git clone https://github.com/My-Athan/core.git
cd core
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment

```bash
cp .env.example .env
# Edit .env with your values:
#   DATABASE_URL=postgresql://myathan:myathan@localhost:5432/myathan
#   JWT_SECRET=<generate: openssl rand -hex 32>
```

### 4. Start Database

```bash
# Using Docker (recommended)
docker compose -f infra/docker/docker-compose.yml up db -d

# Push schema to database
npm run db:push --workspace=apps/api
```

### 5. Start Development Servers

```bash
# API (port 3000)
npm run dev:api

# PWA (port 5173)
npm run dev:web

# Admin (port 5174)
npm run dev:admin

# Or start all at once
npm run dev:api & npm run dev:web & npm run dev:admin
```

### 6. Verify

```bash
# API health check
curl http://localhost:3000/health
# Expected: {"status":"ok","version":"0.2.0","timestamp":"..."}

# PWA
open http://localhost:5173

# Admin
open http://localhost:5174
```

---

## Testing

```bash
# Run all tests
npm run test --workspace=apps/api

# Tests include:
# - Hijri calendar (7 tests): conversion, Ramadan, holidays, adjustment
# - Prayer times (5 tests): cities, methods, Hanafi, equator
```

---

## Deployment

### Production (Coolify)

See [`infra/coolify-setup.md`](infra/coolify-setup.md) for step-by-step guide.

**Cost:** ~$7/month (Hostinger VPS + domain + R2)

```
Hostinger VPS ($6/mo)
├── Coolify (manages everything)
├── PostgreSQL 16
├── API service (Fastify)
├── PWA (static build)
├── Admin (static build)
└── Traefik (auto-SSL)

Cloudflare R2 (~$0.15/mo)
├── firmware/       # OTA binaries
└── audio/          # Athan/doaa files

Domain (~$1/mo)
├── api.myathan.com
├── app.myathan.com
└── admin.myathan.com
```

### Docker (Manual)

```bash
# Build and start everything
docker compose -f infra/docker/docker-compose.yml up -d

# Production config
docker compose -f infra/docker/docker-compose.prod.yml up -d
```

---

## Security

| Feature | Implementation |
|---------|---------------|
| Device auth | HMAC-SHA256 API key derived from device MAC |
| Admin auth | bcrypt password hashing + JWT (24h expiry) |
| Input validation | Zod schemas on all endpoints |
| Rate limiting | 100 req/min via @fastify/rate-limit |
| CORS | Whitelist in production, open in dev |
| Config merge | Whitelist of allowed keys (firmware-side) |
| OTA safety | SHA256 verification + dual-partition rollback |
| DB indexes | Optimized queries for fleet-scale operations |

---

## Claude Code Skills

| Command | Description |
|---------|-------------|
| `/dev` | Start development servers |
| `/db` | Database management (push/generate/migrate) |
| `/deploy` | Deploy to staging/production |
| `/review` | TypeScript + API + security review checklist |
| `/lint` | Type checking across all workspaces |

---

## Related

| Repository | Description |
|------------|-------------|
| [**firmware**](https://github.com/My-Athan/firmware) | ESP32-C3 device firmware |

## License

Copyright 2026 MyAthan Contributors.
