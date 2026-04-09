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

## Claude Model Guidance

| Task | Model | Why |
|------|-------|-----|
| Architecture decisions, cross-repo schema changes | **Opus** | Deep reasoning across API, shared types, firmware |
| Complex refactors spanning multiple workspaces | **Opus** | Needs to track cascading type changes |
| Feature implementation, bug fixes | **Sonnet** | Good speed/quality for well-scoped coding |
| API endpoint implementation | **Sonnet** | Clear patterns with Fastify + Drizzle |
| Code review | **Sonnet** | Checklist-driven analysis |
| Simple questions, formatting, config edits | **Haiku** | Fast for low-complexity work |
| Running build/test/lint commands | **Haiku** | CLI execution, minimal reasoning |

## Common Development Patterns

1. **Schema change flow**: `apps/api/src/db/schema.ts` → `/db generate` → `/db migrate` → update `packages/shared/src/types/` → update API routes → update frontend
2. **Shared type change flow**: Edit `packages/shared/` → run `/lint all` → verify firmware `data/config.json` v2 compatibility
3. **New API endpoint**: Add route in `apps/api/src/routes/` → add Zod schema → add shared type → add frontend call
4. **Device config change**: Must update in BOTH `packages/shared/` AND firmware `data/config.json` v2

## Testing Strategy
- Before any commit: `npm run test --workspaces`
- Before deploy: `npm run lint --workspaces && npm run build --workspaces`
- After shared type changes: verify firmware config.json v2 compatibility

## Cross-Repo Sync
- `DeviceConfig` in `packages/shared/` must match firmware `data/config.json` v2 exactly
- `PrayerTimes` format must match firmware output
- `IslamicHoliday` enum must match firmware `IslamicHoliday` enum
- Any config schema change requires updates in BOTH repos

## Related
- Firmware repo: `my-athan/firmware` (ESP32-C3 firmware)
- GitHub issues: #1-#11 on core repo
- GitHub Project: https://github.com/orgs/My-Athan/projects/1
