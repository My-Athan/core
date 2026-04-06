---
name: lint
description: Run TypeScript type checking and linting across all workspaces. Use to check for errors.
disable-model-invocation: true
allowed-tools: Bash Read
argument-hint: "[api|web|admin|shared|all]"
---

# Lint & Type Check

Run TypeScript compiler checks across the monorepo.

## Steps

Based on argument:
- `api`: `npm run lint --workspace=apps/api`
- `web`: `npm run lint --workspace=apps/web`
- `admin`: `npm run lint --workspace=apps/admin`
- `shared`: `npm run lint --workspace=packages/shared`
- `all` or no argument: `npm run lint --workspaces`

## On Failure
1. Read the error output carefully
2. Fix TypeScript errors in the reported files
3. If the error is in shared types, check that firmware config.json schema still matches
4. Re-run lint to verify fix
