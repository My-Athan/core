---
name: dev
description: Start development servers for API, PWA, or admin. Use when developing, running, or debugging locally.
disable-model-invocation: true
allowed-tools: Bash Read Glob
argument-hint: "[api|web|admin|all]"
---

# Start Development Server

Run local development servers for MyAthan services.

## Steps

Based on argument:
- `api`: `npm run dev --workspace=apps/api` (Fastify on port 3000)
- `web`: `npm run dev --workspace=apps/web` (Vite PWA on port 5173)
- `admin`: `npm run dev --workspace=apps/admin` (Vite admin on port 5174)
- `all` or no argument: start all three in parallel

## Prerequisites
- `npm install` has been run at repo root
- For API: PostgreSQL running (`docker compose -f infra/docker/docker-compose.yml up db -d`)
- Environment variables set (copy `.env.example` to `.env`)

## Ports
| Service | Port | URL |
|---------|------|-----|
| API | 3000 | http://localhost:3000/health |
| PWA | 5173 | http://localhost:5173 |
| Admin | 5174 | http://localhost:5174 |
