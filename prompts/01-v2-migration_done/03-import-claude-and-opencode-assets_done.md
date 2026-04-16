# Import `.claude/` and `.opencode/` assets from serverless-v2

## Agent
`base-template-generator` (lead) + `prompt-engineer` (for adaptation pass)

## Depends on
`01-create-architecture-md.md`, `02-validate-architecture-md.md`

## Goal
Copy frontend/product/design/content/i18n/payment-relevant Claude agents, skills, rules, and opencode agents/commands/config from `/home/serverlessbase/serverless-v2` into `/home/serverlessbase/whynot`. Adapt every file to this project's paths, tech stack (Vite, not Next.js), and conventions. Each imported file MUST carry a "Single source of truth" header pointing at `ARCHITECTURE.md`.

## Reference
- `ARCHITECTURE.md` sections 2, 7, 8, 17, 18.
- Source root: `/home/serverlessbase/serverless-v2/.claude/` and `/home/serverlessbase/serverless-v2/.opencode/`.

## Task

### 1. Establish target directory structure
Create (mkdir -p):
- `.claude/agents/`
- `.claude/agents/design/`
- `.claude/agents/content/`
- `.claude/skills/`
- `.claude/rules/`
- `.opencode/agent/`
- `.opencode/command/`

### 2. Import `.claude/agents/` — allowed list (copy + adapt)
From `/home/serverlessbase/serverless-v2/.claude/agents/` copy these files, then adapt (see step 5):
- `design/design-ui-designer.md`
- `design/design-ux-architect.md`
- `design/design-ux-researcher.md`
- `design/design-brand-guardian.md`
- `design/design-image-prompt-engineer.md`
- `design/design-visual-storyteller.md`
- `design/design-whimsy-injector.md`
- `design/design-inclusive-visuals-specialist.md`
- `design/api-designer.md` → move to `.claude/agents/api-designer.md` (top level, not design).
- `design/bulk-selection-specialist.md` → keep under `design/`.
- `content/*.md` (every file)
- `backend-i18n-developer.md`
- `translation-manager.md`
- `base-template-generator.md`
- `prompt-engineer.md`
- Any additional top-level agent whose name clearly signals frontend/product/content (e.g., `frontend-developer.md` if it exists). Inspect the source tree and decide inclusion on a per-file basis.

**Excluded from `.claude/agents/`** (do NOT copy):
- Any agent with `backend`, `devops`, `deploy`, `infra`, `ci-cd`, `docker`, `kubernetes`, `terraform`, `database-migration`, `redis`, `cache`, `observability`, `oncall` in the filename, unless the content is clearly frontend/product.

### 3. Import `.claude/skills/` — allowed list
From `/home/serverlessbase/serverless-v2/.claude/skills/` copy these directories and any `.md` files at the top level:
- `shadcn-design-system-compliance/`
- `app-studio/`
- `artifacts-builder/`
- `canvas-design/`
- `blog-development/`
- `brand-guidelines/`
- `landing-page-optimization/`
- `serverlessbase-dashboard/` → rename to `whynot-dashboard/`
- `backend-i18n/`
- `payment-orchestrator/`
- `shadcn-design-system-compliance.md`
- `design-system-integration.md`
- `component-auditing.md`
- Any other skill whose purpose is clearly UI/content/i18n/payment/landing.

**Excluded**: `redis-*`, `database-*`, `docker-*`, `deploy-*`, `infra-*`, `ci-*`.

### 4. Import `.claude/rules/` — allowed list
- `rtl-support-arabic.md`
- `uncodixify-ui.md` → rename the concept to fit this project, keep the file name if unambiguous.
- `switch-component-styling.md`
- `url-tab-state.md`
- `spec-driven-development.md`

### 5. Adaptation pass (MANDATORY on every copied file)
For every copied file, apply these transformations in order:
1. **Prepend Single-Source-of-Truth header** (literal, verbatim):
   ```markdown
   > **Single source of truth**: Before proposing any change, read [`ARCHITECTURE.md`](../../ARCHITECTURE.md) (adjust relative path to the file's depth). When this document conflicts with `ARCHITECTURE.md`, `ARCHITECTURE.md` wins.
   ```
2. **Replace project names**: `serverlessbase` → `whynot`, `serverless-v2` → `whynot`. Do this case-insensitively and in all path fragments.
3. **Replace stack references**: `Next.js` / `next/` / `pages/` → `Vite + React` with the matching path from this repo (`frontend/src/pages/` or `admin-frontend/src/pages/`). `tRPC router` → `Express route in gateway/src/api/`. `Drizzle` / `Prisma` → `raw SQL in shared/database/repositories/`.
4. **Replace path fragments**: `client/src/` → `frontend/src/`. `serverlessbase/apps/serverlessbase/` → `frontend/` (for user-facing) or `admin-frontend/` (for admin). Use judgment per file.
5. **Rewrite ambiguous examples** where the reference code sample would not compile in this project.
6. **Remove any mention of devops tooling** that does not exist here (e.g., Terraform, Helm, Kubernetes).
7. **Add "Consults ARCHITECTURE.md section N"** at the end of the file's frontmatter, citing the section number from `ARCHITECTURE.md` that this agent/skill/rule most depends on.

### 6. Import `.opencode/`
- Copy `.opencode/opencode.jsonc` from the reference. Adapt the provider config to this project's env vars (use `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY` — whichever are present in the existing `.env.example`). Preserve the Z.AI / GLM provider block but make it optional.
- Copy `.opencode/agent/*.md` — only frontend/product/design/marketing/content/payment agents. Explicitly **exclude** `devops-engineer.md`, `redis-caching-specialist.md`, any `backend-*` agent (unless clearly product-tier), any `*deploy*`, `*infra*`, `*ci*`, `*kubernetes*`, `*docker*` agent.
- Copy `.opencode/command/speckit.*.md` — the speckit workflow commands.
- Apply the same adaptation pass (step 5) to every opencode file.

### 7. Write `.claude/README.md` and `.opencode/README.md`
Each README (≤60 lines) must:
- State that the directory contains agents/skills/rules imported and adapted from `serverless-v2`.
- Link to `ARCHITECTURE.md` as the single source of truth.
- List the imported files grouped by purpose (design / content / i18n / payment / ux / etc.).
- Explicitly list which reference files were **excluded and why** (devops/deploy/infra/backend-core).

### 8. Update `ARCHITECTURE.md` section 18 (Agent & skill registry)
Replace the placeholder row with a complete table of every imported agent/skill/rule. Columns: Name | Type | Path | Purpose | Primary `ARCHITECTURE.md` section. The table row count MUST equal `find .claude/agents .claude/skills .claude/rules .opencode/agent .opencode/command -type f -name '*.md' | wc -l`.

### Files to create/modify
- `.claude/agents/**` — copied + adapted (expect ≥15 files).
- `.claude/skills/**` — copied + adapted (expect ≥8 directories + loose files).
- `.claude/rules/**` — copied + adapted (expect 5 files).
- `.opencode/opencode.jsonc` — copied + adapted.
- `.opencode/agent/**` — copied + adapted (expect ≥20 agents after exclusions).
- `.opencode/command/**` — copied + adapted (expect ≥5 speckit commands).
- `.claude/README.md` — new.
- `.opencode/README.md` — new.
- `ARCHITECTURE.md` — section 18 updated.

### Untouchable paths (reminder)
- `services/qa-loop-executor/src/v2/`
- `services/qa-loop-executor/src/mcp-browser.ts`
- `services/database/migrations/`

### Tests
Only file-system + string assertions in this prompt (runtime tests come in prompt 05):
- `find .claude -type f | wc -l` ≥ 25.
- `find .opencode -type f | wc -l` ≥ 25.
- Every `.md` under `.claude/` and `.opencode/` contains the string `ARCHITECTURE.md`.
- Every `.md` under `.claude/` and `.opencode/` contains the string `Single source of truth`.
- No file under `.claude/agents/` has `devops`, `deploy`, `kubernetes`, `redis-caching`, `infra` in its filename.
- `grep -r "serverlessbase" .claude .opencode` returns only README/docs entries that explicitly discuss the migration origin (or zero hits — prefer zero).
- `grep -r "client/src/" .claude .opencode` returns zero hits (all adapted to `frontend/src/`).
- `grep -r "pages/api/" .claude .opencode` returns zero hits (Express routes, not Next.js).

### i18n
N/A — agent definitions themselves are English.

### Documentation
- `.claude/README.md` and `.opencode/README.md` as specified in step 7.
- Update the agent registry table in `ARCHITECTURE.md` section 18.

### Acceptance criteria
- [ ] All required directories exist.
- [ ] At least 25 files under `.claude/`, at least 25 under `.opencode/`.
- [ ] Every imported file carries the SSOT header pointing at `ARCHITECTURE.md`.
- [ ] No banned (devops/infra/deploy/redis) files imported.
- [ ] All `serverlessbase`/`client/src/`/`pages/api/` references rewritten.
- [ ] `ARCHITECTURE.md` section 18 populated with the real file list.
- [ ] `git status` shows only `.claude/**`, `.opencode/**`, `ARCHITECTURE.md`, `prompts/**` as changed.
