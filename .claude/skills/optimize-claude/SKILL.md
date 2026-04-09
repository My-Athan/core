---
name: optimize-claude
description: Audit and optimize Claude Code configuration, skills, and CLAUDE.md for maximum AI performance. Use to tune Claude's effectiveness on this repo.
allowed-tools: Bash Read Grep Glob Edit Write
argument-hint: "[audit|fix|report]"
---

# Optimize Claude Configuration

Audit and optimize Claude Code setup for the MyAthan core monorepo.

## Model Selection Engine

### Available Models
- **Opus 4.6** (`claude-opus-4-6`) — Best reasoning. ~$15/M in, $75/M out. Use for hard problems.
- **Sonnet 4.6** (`claude-sonnet-4-6`) — Best value. ~$3/M in, $15/M out. Default choice.
- **Haiku 4.5** (`claude-haiku-4-5-20251001`) — Fastest/cheapest. ~$0.25/M in, $1.25/M out. Use for simple tasks.

### Decision Matrix — Always pick the cheapest option that gets the job done

| Task Type | Model | Version | Effort | Thinking | 1M Context | Cost |
|-----------|-------|---------|--------|----------|------------|------|
| Architecture, cross-repo schema cascades | Opus | 4.6 | max | ON | if >50 files | $$$$ |
| Complex refactors across workspaces | Opus | 4.6 | high | ON | if >50 files | $$$$ |
| DB schema design + migration planning | Opus | 4.6 | high | ON | no | $$$ |
| Debugging complex multi-file issues | Opus | 4.6 | high | ON | if needed | $$$ |
| Feature implementation (multi-file) | Sonnet | 4.6 | high | OFF | no | $$ |
| Bug fixes, single-feature work | Sonnet | 4.6 | med | OFF | no | $$ |
| API endpoint implementation | Sonnet | 4.6 | med | OFF | no | $$ |
| Code review | Sonnet | 4.6 | high | OFF | no | $$ |
| TypeScript type definitions | Sonnet | 4.6 | med | OFF | no | $$ |
| Simple questions, formatting, config | Haiku | 4.5 | low | OFF | no | $ |
| Build/test/lint/dev commands | Haiku | 4.5 | low | OFF | no | $ |
| Git operations, file lookups | Haiku | 4.5 | low | OFF | no | $ |

### Configuration Rules

**Version:** Always 4.6 for Opus/Sonnet (strictly better). Haiku = 4.5 (only version).

**Thinking mode:**
- **ON** when: multi-step logic, debugging across >3 files, algorithm design, schema cascade planning, security analysis
- **OFF** when: everything else. Thinking burns output tokens; diminishing returns on straightforward tasks.
- Rule of thumb: if you can describe the change in one sentence, thinking is OFF.

**1M context:**
- **ON** only when reading/analyzing >50 files or individual files >5000 lines in one session
- **OFF** for all standard work. This monorepo has ~30 source files — standard context handles it.
- 1M adds cost premium — never use "just in case."

**Effort levels:**
- `max` — Architectural decisions where a wrong call is expensive to undo. Rare.
- `high` — Multi-file changes, code review, debugging, safety-critical paths.
- `med` — Standard feature work, bug fixes, well-scoped single tasks. **This is the default.**
- `low` — CLI commands, lookups, formatting, git operations.

**Cost escalation rule:** Start at the cheapest tier. Only escalate if:
1. The task failed or produced poor results at the current tier
2. The task inherently requires deeper reasoning (see matrix above)
3. Never pre-escalate "just to be safe" — that wastes budget

## Steps

Based on argument:

### `audit` (default)
1. Read `CLAUDE.md` and check for:
   - [ ] Project overview and tech stack documented
   - [ ] Architecture section with file paths
   - [ ] Database schema summary
   - [ ] Key types listed with locations
   - [ ] Development commands documented
   - [ ] Cross-repo references (firmware repo link)
   - [ ] Model selection decision matrix (model + version + effort + thinking + 1M)
   - [ ] Cost tier guidance with escalation rules
   - [ ] Common development patterns
   - [ ] Testing strategy documented
2. Scan all skills in `.claude/skills/*/SKILL.md`:
   - [ ] Each skill has a clear, trigger-friendly description
   - [ ] `allowed-tools` matches the skill's actual needs
   - [ ] `disable-model-invocation` is only set for pure CLI-runner skills
   - [ ] Error recovery instructions included for skills that can fail
   - [ ] Skills that analyze code have `Grep` and `Glob` tools
   - [ ] Skills that fix code have `Edit` tool
3. Check `.claude/settings.json`:
   - [ ] Read-only tools auto-allowed (Read, Glob, Grep)
   - [ ] No overly permissive settings
4. Check `.github/workflows/claude.yml`:
   - [ ] Claude Code Action configured
   - [ ] Proper permissions (contents: read, pull-requests: write, issues: write)
5. Calculate optimization score (checklist items passed / total)
6. Report findings with specific recommendations

### `fix`
1. Run the `audit` checklist above
2. Automatically fix issues found:
   - Add missing tools to skill `allowed-tools`
   - Remove unnecessary `disable-model-invocation` flags
   - Add missing sections to CLAUDE.md
   - Create settings.json if missing
3. Report what was fixed

### `report`
1. Run `audit` and output a concise summary:
   - Overall score: X/Y checks passing
   - Top 3 highest-impact improvements
   - Model selection recommendations for recent git activity

## Skill Optimization Checklist

When reviewing any skill, verify:
- **Description**: Should clearly state WHEN to use it (trigger words help Claude match user intent)
- **Tools**: Minimum set needed. Read-only analysis needs `Read Grep Glob`. Code changes need `Edit`. File creation needs `Write`.
- **Model invocation**: Disable ONLY for pure CLI runners (build, flash, dev server). Enable for anything requiring analysis, diagnosis, or decision-making.
- **Error recovery**: Skills that run commands should include "On Failure" instructions
- **Context**: Skills should reference project-specific paths, constraints, and patterns

## Token Efficiency Tips

- CLAUDE.md should be under 100 lines — dense, structured, no prose
- Use tables and lists over paragraphs
- Include file paths so Claude doesn't need to search
- Reference specific types/functions by name
- Keep cross-repo sync notes brief but actionable
