# AGENTS.md — whynot Platform

**Single source of truth**: See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for authoritative system architecture, conventions, untouchable paths, data model, API surface, and testing strategy. This file covers only per-branch conventions and agent invocation rules. When in conflict, `ARCHITECTURE.md` wins.

---

## Agent Registry Overview

The whynot platform uses **268 agent/skill/rule/command files** across two systems:

| System | Location | Count | Purpose |
|--------|----------|-------|---------|
| Claude Code agents | `.claude/agents/` | 15 | Specialized development agents |
| Claude Code skills | `.claude/skills/` | 28 directories | Task-specific skills (CRO, SEO, i18n, legal, billing, design) |
| Claude Code rules | `.claude/rules/` | 5 | Auto-loaded coding rules |
| OpenCode agents | `.opencode/agent/` | 148+ | Comprehensive agent library |
| OpenCode commands | `.opencode/command/` | 9 | SpecKit workflow commands |

---

## Claude Code Agents (`.claude/agents/`)

| Agent | Purpose |
|-------|---------|
| `api-designer` | API endpoint design and review |
| `base-template-generator` | Template and boilerplate generation |
| `frontend-developer` | Frontend component development |
| `prompt-engineer` | AI prompt authoring and optimization |
| `translation-manager` | i18n translation management |
| `content/blog-developer` | Blog content development |
| `content/legal-content-writer` | Legal content authoring |
| `design/bulk-selection-specialist` | Bulk selection UI patterns |
| `design/design-brand-guardian` | Brand consistency enforcement |
| `design/design-ui-designer` | UI component design |
| `design/design-ux-architect` | UX architecture |
| `design/design-ux-researcher` | UX research methods |
| `design/design-image-prompt-engineer` | Image prompt engineering |
| `design/design-inclusive-visuals-specialist` | Inclusive design |
| `design/design-visual-storyteller` | Visual narrative design |
| `design/design-whimsy-injector` | Delight and polish |

---

## Claude Code Rules (`.claude/rules/` — Auto-Loaded)

| Rule | Enforces |
|------|----------|
| `rtl-support-arabic` | RTL layout patterns, logical CSS properties, icon mirroring |
| `spec-driven-development` | Mandatory SDD workflow for new features |
| `switch-component-styling` | No `min-h-[44px]` on Switch; touch targets via parent |
| `uncodixify-ui` | Anti-codex UI standards (no lift effects, no gradient text, etc.) |
| `url-tab-state` | URL-based tab persistence via `validateSearch` + `navigate()` |

---

## SpecKit Workflow Commands (`.opencode/command/`)

Execute in order for new features:

1. `/speckit.constitution` — Define project principles
2. `/speckit.specify` — Define requirements (problem space, not solution)
3. `/speckit.clarify` — Resolve specification gaps
4. `/speckit.plan` — Technical implementation plan
5. `/speckit.tasks` — Break into actionable tasks (<2h each)
6. `/speckit.analyze` — Validate consistency
7. `/speckit.checklist` — Quality gate check
8. `/speckit.implement` — Execute the plan
9. `/speckit.taskstoissues` — Convert tasks to GitHub issues

---

## OpenCode Agent Categories

| Category | Example Agents | Count |
|----------|---------------|-------|
| Marketing | xiaohongshu, tiktok, linkedin, twitter, instagram, podcast, seo, content-creator | 30+ |
| Design | ui-designer, brand-guardian, ux-architect, ux-researcher, inclusive-visuals | 9 |
| Development | frontend-developer, javascript-pro, typescript-pro, react-specialist, tanstack-router | 15+ |
| Testing | e2e-playwright, qa-expert, test-automator, unit-test, performance-test, accessibility | 10+ |
| Infrastructure | build-engineer, ops-cicd-github, mcp-manager, performance-engineer | 5+ |
| Security | security-auditor, security-review, blockchain-security, auth-tester, compliance | 5 |
| Billing | stripe-billing, stripe-mcp-manager, lemonsqueezy, moyasar | 4 |
| Product | product-manager, feedback-synthesizer, sprint-prioritizer, trend-researcher | 5 |
| AI/Agents | agents-orchestrator, agents-prompt-engineer, meta-prompt-engineer, skill-creator | 5+ |
| Other | academic (4), game-designer, narrative-designer, technical-artist, transcription | 10+ |

---

## Top 10 Rules (Quick Reference)

1. **Docker-only execution** — all commands run inside Docker containers
2. **Untouchable paths** — `v2/`, `mcp-browser.ts`, existing migrations
3. **bigint cents for money** — no floats
4. **Org-scoped data access** — every query joins on `workspace_id`
5. **Cursor-based pagination** — no offset pagination
6. **ISO 8601 UTC timestamps** — all dates as ISO 8601
7. **camelCase API responses** — all JSON is camelCase
8. **Tests accompany every change** — no orphan code
9. **RTL support for Arabic** — logical properties, icon mirroring
10. **No backwards-compat shims** — delete old code when replacing

---

## Full Registry

See `ARCHITECTURE.md` Section 18 for the complete agent/skill/rule/command table with paths and primary sections.
