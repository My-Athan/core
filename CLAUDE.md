# MyAthan Core — Claude Code Project Context

## Project Overview
Monorepo for the MyAthan smart prayer device platform.
Backend API, mobile PWA, admin dashboard, shared types.

## Tech Stack
- **Monorepo**: npm workspaces
- **API**: Fastify 5, TypeScript, Drizzle ORM, PostgreSQL
- **PWA**: React 19, Vite 6, Tailwind CSS, Web Bluetooth API
- **Admin**: React 19, Vite 6, MUI 6
- **Shared**: TypeScript types matching firmware config.json v2
- **Infra**: Docker Compose, Coolify on Hostinger VPS, Cloudflare R2

## Architecture
```
apps/api/     — Fastify backend (device registry, config sync, OTA, multi-room)
apps/web/     — React PWA (BLE provisioning, prayer times, audio config, Ramadan)
apps/admin/   — React admin (fleet management, releases, analytics)
packages/shared/ — TypeScript types (DeviceConfig, PrayerTimes, HijriDate, holidays)
infra/docker/ — Docker Compose + Dockerfile
```

## Database Schema (Drizzle)
- `users` — id, email, passwordHash, role
- `devices` — deviceId, apiKey, userId, groupId, firmwareVersion, config (JSONB)
- `device_groups` — multi-room groups
- `releases` — OTA firmware versions with staged rollout
- `stats` — daily device stats (prayer plays, errors, uptime)
- `sync_triggers` — multi-room sync epoch triggers

## Key Types (packages/shared)
- `DeviceConfig` — matches firmware config.json v2 exactly
- `PrayerTimes` — HH:MM format prayer times
- `HijriDate` — day/month/year/monthName
- `IslamicHoliday` — enum for 7 holidays
- `DeviceStatus` — real-time device state

## PWA Pages
Home, Setup (BLE), PrayerTimes, AudioSettings (preview!),
RamadanSettings, MultiRoom, DeviceSettings

## Development
- Branch: `claude/firmware-implementation-plan-t2Mc1`
- API dev: `npm run dev:api`
- PWA dev: `npm run dev:web`
- Admin dev: `npm run dev:admin`
- DB migrate: `npm run db:push --workspace=apps/api`

## Related
- Firmware repo: `my-athan/firmware` (ESP32-C3 firmware)
- GitHub issues: #1-#11 on core repo
- GitHub Project: https://github.com/orgs/My-Athan/projects/1
