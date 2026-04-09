---
name: db
description: Database management — migrations, schema push, seed data, and schema analysis. Use for database operations and schema changes.
allowed-tools: Bash Read Write Edit Grep Glob
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

## Post-Command Validation

After any schema change (`push`, `generate`, `migrate`):
1. Search for affected code paths: `grep -r "tableName" apps/api/src/` to find all usages
2. Verify shared types in `packages/shared/src/types/` still match the schema
3. Check that API routes using modified tables are updated
4. If `devices` table config JSONB changed, verify it matches firmware `data/config.json` v2

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
5. Search for related API routes and update them if needed

## On Failure
1. If migration fails: check for conflicting column types or missing NOT NULL defaults
2. If push fails: verify PostgreSQL is running and DATABASE_URL is correct
3. Read the error output and fix the schema definition before retrying
