---
name: db
description: Database management — migrations, schema push, seed data. Use for database operations.
disable-model-invocation: true
allowed-tools: Bash Read Write
argument-hint: "[push|generate|migrate|seed|studio]"
---

# Database Management

Manage the PostgreSQL database via Drizzle ORM.

## Commands

Based on argument:
- `push`: `npm run db:push --workspace=apps/api` — Push schema to database (dev only)
- `generate`: `npm run db:generate --workspace=apps/api` — Generate migration SQL
- `migrate`: `npm run db:migrate --workspace=apps/api` — Run pending migrations
- `seed`: Run seed script to populate test data
- `studio`: `npx drizzle-kit studio` — Open Drizzle Studio UI

## Prerequisites
- PostgreSQL running (use `docker compose -f infra/docker/docker-compose.yml up db -d`)
- DATABASE_URL set in environment or .env file

## Schema Location
`apps/api/src/db/schema.ts` — 6 tables:
- `users` — app users
- `devices` — registered MyAthan devices
- `device_groups` — multi-room groups
- `releases` — firmware versions for OTA
- `stats` — daily device statistics
- `sync_triggers` — multi-room sync epochs

## Adding a New Table
1. Add table definition to `apps/api/src/db/schema.ts`
2. Run `/db generate` to create migration
3. Run `/db migrate` to apply
4. Add corresponding type to `packages/shared/src/types/`
