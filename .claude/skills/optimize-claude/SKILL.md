---
name: optimize-claude
description: Audit and optimize Claude Code configuration, skills, and CLAUDE.md for maximum AI performance. Use to tune Claude's effectiveness on this repo.
allowed-tools: Bash Read Grep Glob Edit Write
argument-hint: "[audit|fix|report]"
---

# Optimize Claude Configuration

Audit and optimize Claude Code setup for the MyAthan core monorepo.

## Model Selection Guide

Choose the right Claude model for each task type:

| Task Type | Model | Reasoning |
|-----------|-------|-----------|
| Architecture decisions, complex refactors, cross-repo changes | **Opus** | Needs deep reasoning across multiple files and systems |
| Feature implementation, bug fixes, code review | **Sonnet** | Standard coding tasks with good speed/quality balance |
| Simple questions, formatting, single-file edits | **Haiku** | Fast responses for low-complexity work |
| Database schema design, migration planning | **Opus** | Schema changes cascade across API, shared types, and firmware |
| API endpoint implementation | **Sonnet** | Well-scoped coding with clear patterns |
| TypeScript type definitions | **Sonnet** | Type-level reasoning within bounded scope |
| Running build/test/lint commands | **Haiku** | CLI execution with minimal reasoning |

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
   - [ ] Model selection guidance section
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
