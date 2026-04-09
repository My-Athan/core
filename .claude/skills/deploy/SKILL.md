---
name: deploy
description: Deploy services to staging or production via Coolify. Use for deployments, releases, and shipping code.
allowed-tools: Bash Read Grep Glob
argument-hint: "[staging|prod] [api|web|admin|all]"
---

# Deploy to Environment

Deploy MyAthan services via Coolify on Hostinger VPS.

## Steps

1. **Pre-deploy safety checks** (Claude analyzes before deploying):
   - Run `git status` — abort if uncommitted changes exist
   - Run `git log --oneline -5` — review what's being deployed
   - Scan for secrets: `grep -r "password\|secret\|api_key" --include="*.ts" apps/ packages/` — abort if hardcoded secrets found
2. Verify all tests pass: `npm run test --workspaces`
3. Verify build succeeds: `npm run build --workspaces`
4. Deploy based on arguments:
   - First arg: environment (`staging` or `prod`)
   - Second arg: service (`api`, `web`, `admin`, or `all`)
5. **Post-deploy verification**: Check deployment health

## Deployment Method
- Coolify watches the git branch and auto-deploys on push
- Staging: pushes to `staging` branch → auto-deploy
- Production: pushes to `main` branch → auto-deploy

## Pre-deploy Checklist
- [ ] All tests passing
- [ ] No TypeScript errors (`npm run lint --workspaces`)
- [ ] Database migrations applied
- [ ] Environment variables updated if needed
- [ ] No secrets committed
- [ ] Shared types in sync with firmware config.json v2

## On Failure
1. Check deployment logs for errors
2. If build fails: run `npm run lint --workspaces` to identify TypeScript errors
3. If tests fail: run `npm run test --workspaces` and read failing test output
4. If health check fails after deploy: check Coolify dashboard logs

## Rollback
- Via Coolify dashboard: redeploy previous version
- Via git: `git revert HEAD && git push`
