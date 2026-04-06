---
name: deploy
description: Deploy services to staging or production via Coolify. Use for deployments and releases.
disable-model-invocation: true
allowed-tools: Bash Read
argument-hint: "[staging|prod] [api|web|admin|all]"
---

# Deploy to Environment

Deploy MyAthan services via Coolify on Hostinger VPS.

## Steps

1. Verify all tests pass: `npm run test --workspaces`
2. Verify build succeeds: `npm run build --workspaces`
3. Deploy based on arguments:
   - First arg: environment (`staging` or `prod`)
   - Second arg: service (`api`, `web`, `admin`, or `all`)

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

## Rollback
- Via Coolify dashboard: redeploy previous version
- Via git: `git revert HEAD && git push`
