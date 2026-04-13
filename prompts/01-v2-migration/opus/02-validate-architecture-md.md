# Validate: ARCHITECTURE.md is complete, accurate, and actively referenced

## Agent
`api-designer` (for technical accuracy review) — run in read-only verification mode.

## Depends on
`01-create-architecture-md.md`

## Goal
Verify `/home/serverlessbase/whynot/ARCHITECTURE.md` is complete, structurally correct, factually grounded in the current repo, and referenced from `CLAUDE.md` + `AGENTS.md`. No subsequent prompt (03–62) may start until this validation passes.

## Validation steps

### 1. Structural checks (fast — run first)
```bash
# 1.1 File exists
test -f /home/serverlessbase/whynot/ARCHITECTURE.md || exit 1

# 1.2 Exactly 20 top-level H2 sections
SECTIONS=$(grep -c '^## ' /home/serverlessbase/whynot/ARCHITECTURE.md)
[ "$SECTIONS" -eq 20 ] || { echo "expected 20 sections, found $SECTIONS"; exit 1; }

# 1.3 Each of the 20 section names appears in order
expected=(
  "System overview"
  "Monorepo layout"
  "Runtime topology"
  "Data plane"
  "API surface"
  "AI subsystem"
  "Frontend architecture"
  "Admin architecture"
  "Billing & payments"
  "Feature flag system"
  "Usage tracking"
  "Observability"
  "Security model"
  "i18n & accessibility"
  "Testing"
  "Untouchable paths"
  "Conventions"
  "Agent & skill registry"
  "How to update this file"
  "Glossary"
)
# For each, grep in order — fail if out of order.

# 1.4 Minimum line count (substantive content)
LINES=$(wc -l < /home/serverlessbase/whynot/ARCHITECTURE.md)
[ "$LINES" -ge 1500 ] || { echo "too short: $LINES"; exit 1; }
```

### 2. Path-existence sweep
Every code-span that looks like a file path in `ARCHITECTURE.md` must resolve. Script:

```bash
# Extract code spans (`...`) that contain a slash or end in a known extension.
grep -oE '`[^`]*(/[^`]*|\.(ts|tsx|js|jsx|md|sql|json|yml|yaml|py|toml))`' ARCHITECTURE.md \
  | tr -d '`' \
  | sort -u > /tmp/arch-paths.txt

missing=0
while read p; do
  # Skip obvious non-paths (URLs, glob stars, placeholders).
  [[ "$p" =~ ^https? ]] && continue
  [[ "$p" =~ \\* ]] && continue
  [[ "$p" =~ ^NNN ]] && continue  # placeholder migration ordinals
  if ! [ -e "/home/serverlessbase/whynot/$p" ] && ! [ -e "$p" ]; then
    echo "MISSING: $p"
    missing=$((missing+1))
  fi
done < /tmp/arch-paths.txt
[ "$missing" -eq 0 ] || exit 1
```

### 3. Section 2 covers every top-level folder
```bash
# Every directory at repo root (excluding hidden except .claude/.opencode and node_modules) must appear in section 2.
for d in $(ls -d /home/serverlessbase/whynot/*/ | xargs -n1 basename); do
  grep -q "\`$d/\`" /home/serverlessbase/whynot/ARCHITECTURE.md || { echo "section 2 missing $d"; exit 1; }
done
# And .claude/ and .opencode/ must be mentioned (even if they are to be populated by prompt 03).
grep -q '\.claude/' /home/serverlessbase/whynot/ARCHITECTURE.md || exit 1
grep -q '\.opencode/' /home/serverlessbase/whynot/ARCHITECTURE.md || exit 1
```

### 4. Section 4 references the current latest migration
```bash
LATEST=$(ls /home/serverlessbase/whynot/services/database/migrations/ | sort | tail -1)
grep -q "$LATEST" /home/serverlessbase/whynot/ARCHITECTURE.md || { echo "latest migration $LATEST not referenced"; exit 1; }
```

### 5. Section 16 contains the three untouchable paths verbatim
```bash
grep -q 'services/qa-loop-executor/src/v2/' /home/serverlessbase/whynot/ARCHITECTURE.md || exit 1
grep -q 'services/qa-loop-executor/src/mcp-browser.ts' /home/serverlessbase/whynot/ARCHITECTURE.md || exit 1
grep -q 'services/database/migrations/' /home/serverlessbase/whynot/ARCHITECTURE.md || exit 1
```

### 6. CLAUDE.md and AGENTS.md wiring
```bash
test -f /home/serverlessbase/whynot/CLAUDE.md || exit 1
test -f /home/serverlessbase/whynot/AGENTS.md || exit 1
grep -q 'ARCHITECTURE.md' /home/serverlessbase/whynot/CLAUDE.md || exit 1
grep -q 'ARCHITECTURE.md' /home/serverlessbase/whynot/AGENTS.md || exit 1
grep -q 'Single source of truth' /home/serverlessbase/whynot/CLAUDE.md || exit 1
grep -q 'Single source of truth' /home/serverlessbase/whynot/AGENTS.md || exit 1
```

### 7. No unrelated file changes
```bash
cd /home/serverlessbase/whynot
# Only ARCHITECTURE.md, CLAUDE.md, AGENTS.md, prompts/ should be new/modified in this phase.
CHANGED=$(git status --porcelain | awk '{print $2}')
for f in $CHANGED; do
  case "$f" in
    ARCHITECTURE.md|CLAUDE.md|AGENTS.md|prompts/*) ;;
    *) echo "unexpected change: $f"; exit 1 ;;
  esac
done
```

### 8. Comprehension sanity pass (human-verifiable)
Open `ARCHITECTURE.md` and answer these 10 questions from the document alone. Every answer must be found in the doc without external context:

1. What are the three untouchable paths? (section 16)
2. How is money represented in this codebase, and why? (section 4 or 17)
3. Which command runs the full unit test suite? (section 15)
4. How is multi-tenancy enforced in repositories? (section 5 or 13)
5. What does the v2 engine do, and what file is its orchestrator entry? (section 6)
6. How many languages does the frontend support and which library? (section 14)
7. What are the two billing tiers? (section 9)
8. Where is the feature-flag registry defined? (section 10)
9. What are the three keys used for secret storage? (section 13)
10. Which script/command generates the sitemap? (section 15 or 14 — if TBD, that's acceptable with a note)

If any cannot be answered from the doc → fail, return to prompt 01.

### 9. Static grep: every subsequent prompt file (once it exists) must reference ARCHITECTURE.md
This is a soft check for now (only 01 and 02 exist), but every prompt added after this must include the string `ARCHITECTURE.md`. The validator for later prompts re-asserts this.

```bash
for f in /home/serverlessbase/whynot/prompts/01-v2-migration/0[3-9]*.md \
         /home/serverlessbase/whynot/prompts/01-v2-migration/[1-6][0-9]*.md 2>/dev/null; do
  [ -f "$f" ] || continue
  grep -q 'ARCHITECTURE.md' "$f" || { echo "$f does not reference ARCHITECTURE.md"; exit 1; }
done
```

## Pass criteria
- [ ] All 8 numbered checks above exit 0.
- [ ] All 10 comprehension questions are answerable from `ARCHITECTURE.md` alone.
- [ ] `git status` shows only the allowed file list.
- [ ] `ARCHITECTURE.md` has ≥1500 lines and exactly 20 H2 sections.
- [ ] Every code-span path in `ARCHITECTURE.md` resolves to a real file/directory.

## On failure
- Re-open `01-create-architecture-md.md`; correct the specific failure; re-run this validation.
- Do NOT proceed to prompt 03 until every check passes.
- If a path fails because it's planned-for-later (e.g., `gateway/src/utils/ai/select-ai-provider.ts`), the reference must be phrased as "will be created in phase 6, prompt 27" rather than asserted as current — fix in prompt 01 and re-run.
