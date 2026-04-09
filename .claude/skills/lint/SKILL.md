---
name: lint
description: Run TypeScript type checking and linting across all workspaces, analyze errors, and fix them. Use to check for errors or fix type issues.
allowed-tools: Bash Read Edit Grep Glob
argument-hint: "[api|web|admin|shared|all]"
---

# Lint & Type Check

Run TypeScript compiler checks across the monorepo, then analyze and fix errors.

## Steps

1. Run lint based on argument:
   - `api`: `npm run lint --workspace=apps/api`
   - `web`: `npm run lint --workspace=apps/web`
   - `admin`: `npm run lint --workspace=apps/admin`
   - `shared`: `npm run lint --workspace=packages/shared`
   - `all` or no argument: `npm run lint --workspaces`

2. **If errors found** — analyze and fix:
   - Read each file with errors
   - Identify the root cause (missing import, wrong type, unused variable, etc.)
   - Apply the fix using Edit tool
   - If the error is in shared types (`packages/shared/`), search for all usages across workspaces to ensure consistency
   - Re-run lint to verify the fix

3. **Post-fix validation**:
   - If shared types were modified, verify they still match firmware `data/config.json` v2 schema
   - Check for cascading type errors in dependent workspaces

## On Failure
1. Read the error output carefully
2. Search for the error pattern across the codebase to understand scope
3. Fix TypeScript errors in the reported files
4. If the error is in shared types, check that firmware config.json schema still matches
5. Re-run lint to verify fix
