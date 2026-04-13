# Validate: `.claude/` and `.opencode/` assets imported and adapted

## Agent
`prompt-engineer` (verifier)

## Depends on
`03-import-claude-and-opencode-assets.md`

## Goal
Verify that the imported agents, skills, rules, and opencode assets are present, correctly adapted, free of forbidden content, and properly wired to `ARCHITECTURE.md`.

## Validation steps

### 1. Directory and file-count assertions
```bash
cd /home/serverlessbase/whynot
test -d .claude/agents && test -d .claude/skills && test -d .claude/rules || exit 1
test -d .opencode/agent && test -d .opencode/command || exit 1
test -f .opencode/opencode.jsonc || exit 1

CLAUDE_COUNT=$(find .claude -type f | wc -l)
OPENCODE_COUNT=$(find .opencode -type f | wc -l)
[ "$CLAUDE_COUNT" -ge 25 ] || { echo "expected ≥25 .claude files, got $CLAUDE_COUNT"; exit 1; }
[ "$OPENCODE_COUNT" -ge 25 ] || { echo "expected ≥25 .opencode files, got $OPENCODE_COUNT"; exit 1; }
```

### 2. Banned-filename sweep
```bash
# None of these substrings may appear in imported agent filenames.
banned='devops|deploy|kubernetes|terraform|helm|redis-caching|infra|oncall|ci-cd|docker-build'
if find .claude/agents .opencode/agent -type f -name '*.md' | grep -iE "$banned"; then
  echo "banned files imported"; exit 1
fi
```

### 3. Every .md file carries the SSOT header and references ARCHITECTURE.md
```bash
missing=0
while IFS= read -r f; do
  grep -q 'Single source of truth' "$f" || { echo "MISSING SSOT: $f"; missing=$((missing+1)); }
  grep -q 'ARCHITECTURE.md' "$f" || { echo "MISSING ARCHITECTURE ref: $f"; missing=$((missing+1)); }
done < <(find .claude .opencode -name '*.md')
[ "$missing" -eq 0 ] || exit 1
```

### 4. No leaked reference project names or stack artifacts
```bash
BAD=$(grep -rln 'serverlessbase\|serverless-v2\|client/src/\|pages/api/\|next/router\|Drizzle\|tRPC' .claude .opencode | grep -v README.md || true)
[ -z "$BAD" ] || { echo "stale refs: $BAD"; exit 1; }
```
Note: `README.md` is allowed to mention `serverless-v2` as the import origin (the one historical allowance).

### 5. ARCHITECTURE.md section 18 is populated
```bash
# The registry table row count must match the imported file count.
ROW_COUNT=$(awk '/^## .*Agent & skill registry/,/^## /' ARCHITECTURE.md | grep -c '^|' || echo 0)
# Subtract 2 for table header + separator rows.
ROWS=$((ROW_COUNT - 2))
FILES=$(find .claude/agents .claude/skills .claude/rules .opencode/agent .opencode/command -type f -name '*.md' | wc -l)
[ "$ROWS" -ge "$FILES" ] || { echo "registry table ($ROWS rows) does not match file count ($FILES)"; exit 1; }
```

### 6. `.claude/README.md` and `.opencode/README.md` exist and are linked
```bash
test -f .claude/README.md && test -f .opencode/README.md || exit 1
grep -q 'ARCHITECTURE.md' .claude/README.md || exit 1
grep -q 'ARCHITECTURE.md' .opencode/README.md || exit 1
```

### 7. Opencode provider config parses as JSONC
```bash
# Strip comments; parse as JSON.
sed 's|//.*||g' .opencode/opencode.jsonc | jq . > /dev/null || { echo "opencode.jsonc invalid"; exit 1; }
```

### 8. Git status scope
```bash
git status --porcelain | awk '{print $2}' | while read f; do
  case "$f" in
    .claude/*|.opencode/*|ARCHITECTURE.md|prompts/*) ;;
    *) echo "unexpected: $f"; exit 1 ;;
  esac
done
```

### 9. Spot-check adaptation quality (manual / human-in-the-loop)
Open 3 random imported agent files. For each, verify:
- SSOT header at top.
- Example code snippets reference this project's paths (not Next.js / tRPC / Drizzle).
- "Consults ARCHITECTURE.md section N" footer is present and the section number is valid (1–20).

## Pass criteria
- [ ] All 9 checks above pass.
- [ ] At least 50 total files imported (25 claude + 25 opencode).
- [ ] Zero banned filenames.
- [ ] Zero stale `serverlessbase` / `client/src/` / `pages/api/` / `Drizzle` / `tRPC` references outside READMEs.
- [ ] `ARCHITECTURE.md` section 18 registry matches file count.
- [ ] JSONC config parses cleanly.

## On failure
- Re-open `03-import-claude-and-opencode-assets.md`.
- If the failure is the banned-filename sweep → delete the offending file.
- If the failure is missing SSOT headers → run a sed script to prepend them.
- Re-run this validation until all 9 checks pass.
- Do NOT advance to prompt 05 until pass.
