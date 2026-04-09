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

## Claude Model & Configuration Rules

### Decision Matrix — Pick the cheapest option that gets the job done

| Task | Model | Version | Effort | Thinking | 1M | Cost Tier |
|------|-------|---------|--------|----------|----|-----------|
| Architecture decisions, cross-repo schema changes | **Opus** | 4.6 | max | ON | if >50 files | $$$$ |
| Complex refactors spanning multiple workspaces | **Opus** | 4.6 | high | ON | if >50 files | $$$$ |
| Database schema design + migration planning | **Opus** | 4.6 | high | ON | no | $$$ |
| Debugging complex multi-file issues | **Opus** | 4.6 | high | ON | if needed | $$$ |
| Feature implementation (multi-file) | **Sonnet** | 4.6 | high | OFF | no | $$ |
| Bug fixes, single-feature work | **Sonnet** | 4.6 | med | OFF | no | $$ |
| API endpoint implementation | **Sonnet** | 4.6 | med | OFF | no | $$ |
| Code review | **Sonnet** | 4.6 | high | OFF | no | $$ |
| TypeScript type definitions | **Sonnet** | 4.6 | med | OFF | no | $$ |
| Simple questions, formatting, config edits | **Haiku** | 4.5 | low | OFF | no | $ |
| Running build/test/lint/dev commands | **Haiku** | 4.5 | low | OFF | no | $ |
| Git operations, file lookups | **Haiku** | 4.5 | low | OFF | no | $ |

### Automation Rules

**Version selection:**
- Always use **4.6** for Opus and Sonnet — latest generation, strictly better
- Haiku is **4.5** only (latest available)

**When to enable thinking:**
- ON: Multi-step logic, debugging across files, algorithm design, schema cascades
- OFF: Everything else — thinking burns output tokens with diminishing returns on simple tasks

**When to use 1M context:**
- Only when actively reading/analyzing >50 files or files >5000 lines in a single session
- Never for single-file edits, CLI commands, or standard feature work
- This repo has ~30 source files — standard context handles it fine for most tasks

**Effort level guide:**
- `max`: Only for architectural decisions where a wrong call is expensive to undo
- `high`: Multi-file changes, debugging, code review, anything safety-critical
- `med`: Standard feature work, bug fixes, well-scoped single tasks
- `low`: CLI execution, simple lookups, formatting, git commands

**Cost awareness (relative per task):**
- Haiku 4.5 low/no-think = **1x baseline** (~$0.25/M in, $1.25/M out)
- Sonnet 4.6 med/no-think = **~12x** (~$3/M in, $15/M out)
- Opus 4.6 high/thinking = **~100x** (~$15/M in, $75/M out + thinking tokens)
- 1M context adds premium on top — only use when standard context is genuinely insufficient
- **Default to Sonnet 4.6 med/no-think** unless the task clearly needs more or less

## Cost & Performance Optimization

**Prompt caching (automatic):**
- Claude caches repeated context (CLAUDE.md, skill definitions) at 90% discount
- Keep CLAUDE.md stable — frequent edits invalidate the cache
- Put rarely-changing content (tech stack, architecture) at the top, volatile content (branch names) at the bottom

**Context management:**
- Claude Code auto-compresses conversation history approaching limits — no action needed
- For long sessions: start new sessions rather than accumulating stale context
- Avoid reading entire large files when you only need a specific section — use offset/limit

**Subagent cost delegation:**
- Use `subagent_type: "Explore"` with Haiku/Sonnet for codebase searches before invoking Opus
- Delegate independent research tasks to parallel subagents — faster AND cheaper than serial Opus calls
- Never use Opus for file discovery — use Grep/Glob tools directly (zero LLM cost)

**Token-saving patterns:**
- Skills with `disable-model-invocation: true` use zero reasoning tokens — keep this on pure CLI skills
- Auto-allowed tools in settings.json skip permission prompts — saves round-trip tokens
- Tables and lists in CLAUDE.md are 30-50% more token-efficient than prose paragraphs
- Reference files by path instead of describing them — Claude reads the file instead of guessing

**Avoid these cost traps:**
- Don't enable thinking mode for simple edits — adds ~2-5x output tokens with no quality gain
- Don't use 1M context "just in case" — standard context covers this repo comfortably
- Don't re-read files already in conversation context — Claude remembers what it read
- Don't ask Opus to run build/test/lint — Haiku executes CLI commands identically at 60x less cost

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
