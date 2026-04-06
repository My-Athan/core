# My-Athan Core

Monorepo for the MyAthan smart prayer device platform — backend API, mobile PWA, and admin dashboard.

## Architecture

```
core/
├── apps/
│   ├── api/              # Fastify + TypeScript backend API
│   ├── web/              # React + Vite PWA (mobile app)
│   └── admin/            # React + MUI admin dashboard
├── packages/
│   └── shared/           # Shared TypeScript types & utilities
├── infra/                # Docker, deployment configs
├── docs/                 # Architecture docs, API specs
└── .github/              # GitHub Actions workflows
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **API** | Fastify, TypeScript, Drizzle ORM, PostgreSQL |
| **PWA** | React, Vite, Tailwind CSS, Web Bluetooth API |
| **Admin** | React, MUI, Vite |
| **Database** | PostgreSQL (via Coolify) |
| **Storage** | Cloudflare R2 (firmware binaries, audio files) |
| **Deploy** | Coolify on Hostinger VPS |

## Related Repositories

| Repository | Description |
|------------|-------------|
| [`firmware`](https://github.com/My-Athan/firmware) | ESP32-C3 device firmware (PlatformIO) |

## Getting Started

```bash
# Install dependencies
npm install

# Start API in development
npm run dev --workspace=apps/api

# Start PWA in development
npm run dev --workspace=apps/web

# Start admin in development
npm run dev --workspace=apps/admin
```

## Project Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1.5 | Infrastructure (VPS, Coolify, PostgreSQL, R2) | 🔲 TODO |
| 2 | Backend API + Device Connectivity | 🔲 TODO |
| 3 | OTA Update System | 🔲 TODO |
| 4 | Mobile PWA | 🔲 TODO |
| 5 | Admin Dashboard | 🔲 TODO |
| 6 | Polish & v2 | 🔲 TODO |
