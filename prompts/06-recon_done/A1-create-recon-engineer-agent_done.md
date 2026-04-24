# Recon — Create the `recon-engineer` Claude agent

## Agent
You are authoring a NEW agent definition. The driver for this prompt is the existing `prompt-engineer` agent (`.claude/agents/prompt-engineer.md`).

## Skills
- Primary: `.claude/skills/spec-driven-development/`
- Supporting: `.claude/skills/whynot-dashboard/`
- Rules: `.claude/rules/spec-driven-development.md`

## Dependencies
None — this is the first prompt in `prompts/06-recon/`.

## Task
Create a new specialist agent that owns all Recon-feature code. This agent is invoked for every subsequent Recon prompt (B–G) that touches backend pipeline code, executor logic, attack-domain reasoning, or finding-quality decisions.

### 1. Files to create
- `.claude/agents/recon-engineer.md` (Claude Code)
- `.opencode/agent/recon-engineer.md` (Opencode mirror — same body)

### 2. Frontmatter
Use the same YAML frontmatter style as existing agents (e.g. `.claude/agents/api-designer.md`, `.claude/agents/frontend-developer.md`). Include `name`, `description`, `model` (default to the project's standard), and `tools` (Read, Edit, Write, Glob, Grep, Bash).

### 3. Body — required sections
- **Mission**: own the Recon feature end-to-end — DB tables, executor service, gateway endpoints, frontend integration, tests.
- **Domain knowledge**: the 5-phase pipeline (Fingerprinting → Discovery → Vulnerability Analysis → Exploitation → Reporting), the 5 vuln classes (injection, XSS, SSRF, auth, authz), the strict "no exploit, no report" policy.
- **Architectural constraints**: must read `ARCHITECTURE.md` first; must follow the sync HTTP + DB-status-polling pattern from `services/qa-loop-executor/`; must reuse `LLMClient` from `services/ai-service/` rather than instantiating new clients.
- **Naming discipline**: internal namespace is `recon` (e.g. `recon_scans`, `recon_enabled`); user-facing brand is "Recon"; the upstream tool's "Reconnaissance" phase is renamed to **Discovery** to avoid collision; "Pre-Reconnaissance" is renamed to **Fingerprinting**.
- **Banned vocabulary in user-facing output**: never write the words Shannon, KeygraphHQ, nmap, subfinder, whatweb, schemathesis, Playwright, Anthropic, or Claude in any string that ships to users (UI labels, locale files, marketing copy, docs).
- **Quality gates**: every change must include tests with 100% coverage, all 5 i18n locales, and follow `.claude/rules/uncodixify-ui.md`, `.claude/rules/rtl-support-arabic.md`, `.claude/rules/url-tab-state.md`, `.claude/rules/switch-component-styling.md`.
- **Hand-off rules**: defer landing-page copy to `landing-page-optimization` + `copywriting` skills; defer translations to the `translation-manager` agent; defer pre-implementation security review to the `security-reviewer` agent (created in A2).

### 4. Verification block (in the agent body)
Add a "Before you finish" checklist the agent must run on every change:
- `make shell-client npm run typecheck`
- `make shell-client npm run lint`
- `make shell-client npm test`
- `make shell-gateway npm test`
- Visual confirmation that no banned vocabulary leaked into `frontend/public/locales/**`.

### Tests
- N/A for the agent file itself, but the agent body MUST instruct future executions to write tests with 100% coverage. Include a worked example of an acceptance criterion in the agent body.

### i18n
- N/A for this prompt — agent files are not user-facing. The agent body, however, must enforce 5-locale coverage on every downstream change.

### Documentation
- N/A — agent definitions live in `.claude/agents/`, not `/docs/`.

### Files to modify
- Create: `.claude/agents/recon-engineer.md`
- Create: `.opencode/agent/recon-engineer.md`
