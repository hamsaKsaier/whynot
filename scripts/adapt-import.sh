#!/usr/bin/env bash
# Adaptation script: copy files from serverless-v2 and apply transformations
set -euo pipefail

SRC="/home/serverlessbase/serverless-v2"
DST="/home/serverlessbase/whynot"

adapt_file() {
  local src="$1"
  local dst="$2"
  local depth="${3:-2}"
  local rel_arch=""
  
  # Compute relative path to ARCHITECTURE.md
  case "$depth" in
    1) rel_arch="ARCHITECTURE.md" ;;
    2) rel_arch="../../ARCHITECTURE.md" ;;
    3) rel_arch="../../../ARCHITECTURE.md" ;;
    4) rel_arch="../../../../ARCHITECTURE.md" ;;
    5) rel_arch="../../../../../ARCHITECTURE.md" ;;
    *) rel_arch="../../ARCHITECTURE.md" ;;
  esac

  local ssot_header
  ssot_header="> **Single source of truth**: Before proposing any change, read [\`${rel_arch}\`](${rel_arch}) (adjust relative path to the file's depth). When this document conflicts with \`ARCHITECTURE.md\`, \`ARCHITECTURE.md\` wins."

  mkdir -p "$(dirname "$dst")"
  
  # Start with SSOT header
  echo "$ssot_header" > "$dst"
  echo "" >> "$dst"
  
  # Apply transformations via sed
  cat "$src" | \
    sed -E \
      -e 's/[Ss]erverless[-]?[Vv]2/whynot/g' \
      -e 's/[Ss]erverless[Bb]ase/whynot/g' \
      -e 's|apps/serverlessbase/|frontend/|g' \
      -e 's|client/src/|frontend/src/|g' \
      -e 's|[Nn]ext\.?js|Vite + React|g' \
      -e 's|next/|vite/|g' \
      -e 's|pages/api/|gateway/src/api/|g' \
      -e 's|pages/|frontend/src/pages/|g' \
      -e 's|tRPC router|Express route in gateway/src/api/|g' \
      -e 's|tRPC|Express|g' \
      -e 's|[Dd]rizzle ORM|raw SQL in shared/database/repositories/|g' \
      -e 's|[Dd]rizzle|raw SQL in shared/database/repositories/|g' \
      -e 's|[Pp]risma ORM|raw SQL in shared/database/repositories/|g' \
      -e 's|[Pp]risma|raw SQL in shared/database/repositories/|g' \
    >> "$dst"
}

# ─── .claude/agents/design/ ───────────────────────────────────────────
for f in \
  design-ui-designer.md \
  design-ux-architect.md \
  design-ux-researcher.md \
  design-brand-guardian.md \
  design-image-prompt-engineer.md \
  design-visual-storyteller.md \
  design-whimsy-injector.md \
  design-inclusive-visuals-specialist.md \
  bulk-selection-specialist.md; do
  if [ -f "$SRC/.claude/agents/design/$f" ]; then
    adapt_file "$SRC/.claude/agents/design/$f" "$DST/.claude/agents/design/$f" 3
    echo "  agents/design/$f"
  fi
done

# api-designer.md -> top level
if [ -f "$SRC/.claude/agents/design/api-designer.md" ]; then
  adapt_file "$SRC/.claude/agents/design/api-designer.md" "$DST/.claude/agents/api-designer.md" 2
  echo "  agents/api-designer.md"
fi

# ─── .claude/agents/content/ ──────────────────────────────────────────
for f in "$SRC/.claude/agents/content/"*.md; do
  bn=$(basename "$f")
  adapt_file "$f" "$DST/.claude/agents/content/$bn" 3
  echo "  agents/content/$bn"
done

# ─── .claude/agents/ top-level ────────────────────────────────────────
for f in translation-manager.md base-template-generator.md prompt-engineer.md; do
  if [ -f "$SRC/.claude/agents/$f" ]; then
    adapt_file "$SRC/.claude/agents/$f" "$DST/.claude/agents/$f" 2
    echo "  agents/$f"
  fi
done

# frontend-developer.md (development folder)
if [ -f "$SRC/.claude/agents/development/frontend-developer.md" ]; then
  adapt_file "$SRC/.claude/agents/development/frontend-developer.md" "$DST/.claude/agents/frontend-developer.md" 2
  echo "  agents/frontend-developer.md"
fi

# ─── .claude/skills/ ──────────────────────────────────────────────────
SKILL_DIRS=(
  shadcn-design-system-compliance
  backend-i18n
  landing-page-optimization
  brand-guidelines
  canvas-design
  theme-factory
  pricing-strategy
  paywall-upgrade-cro
  page-cro
  copywriting
  content-strategy
  ad-creative
  ab-test-setup
  paid-ads
  signup-flow-cro
  referral-program
  programmatic-seo
  competitor-alternatives
  social-content
  marketing-ideas
  popup-cro
  churn-prevention
  spec-driven-development
  legal-content-generator
)

for skill in "${SKILL_DIRS[@]}"; do
  if [ -d "$SRC/.claude/skills/$skill" ]; then
    find "$SRC/.claude/skills/$skill" -name '*.md' -type f | while read f; do
      rel="${f#$SRC/.claude/skills/}"
      # Count depth for relative path
      slash_count=$(echo "$rel" | tr -cd '/' | wc -c)
      depth=$((slash_count + 2))
      adapt_file "$f" "$DST/.claude/skills/$rel" "$depth"
      echo "  skills/$rel"
    done
  fi
done

# serverlessbase-dashboard -> whynot-dashboard
if [ -d "$SRC/.claude/skills/serverlessbase-dashboard" ]; then
  find "$SRC/.claude/skills/serverlessbase-dashboard" -name '*.md' -type f | while read f; do
    rel="${f#$SRC/.claude/skills/serverlessbase-dashboard/}"
    adapt_file "$f" "$DST/.claude/skills/whynot-dashboard/$rel" 3
    echo "  skills/whynot-dashboard/$rel"
  done
fi

# Loose .md skill files
for f in refactor-safely.md debug-issue.md review-changes.md; do
  if [ -f "$SRC/.claude/skills/$f" ]; then
    adapt_file "$SRC/.claude/skills/$f" "$DST/.claude/skills/$f" 2
    echo "  skills/$f"
  fi
done

# ─── .claude/rules/ ───────────────────────────────────────────────────
RULE_FILES=(
  rtl-support-arabic.md
  uncodixify-ui.md
  switch-component-styling.md
  url-tab-state.md
  spec-driven-development.md
)

for f in "${RULE_FILES[@]}"; do
  if [ -f "$SRC/.claude/rules/$f" ]; then
    adapt_file "$SRC/.claude/rules/$f" "$DST/.claude/rules/$f" 2
    echo "  rules/$f"
  fi
done

# ─── .opencode/opencode.jsonc ─────────────────────────────────────────
echo "  opencode.jsonc (manual adaptation)"

# ─── .opencode/agent/ ─────────────────────────────────────────────────
# Allowed: frontend/product/design/marketing/content/payment
# Excluded: devops, redis-caching, deploy*, infra*, ci*, kubernetes, docker, backend-* (unless product-tier)
EXCLUDE_PATTERNS="devops|redis-caching|deploy|infra|ci-|kubernetes|docker|backend-developer|opentofu-specialist|stalwart-|nginx-proxy|traefik-routing|uptime-monitor|external-service-monitor|cost-optimization|clawdbot-|wp-compose|godot-|roblox-|unity-|unreal-|game-audio|level-designer|macos-spatial|visionos-spatial|xr-|postal-transactional|identity-graph|supply-chain|video-processing|corporate-training|academic-psychologist|security-test|accessibility-test|recruitment|sales-|hiring|investor-relations|government-|healthcare-|study-abroad|openai-integration|gemini-integration|specialized-french|specialized-model-qa|specialized-workflow|clickhouse|lsp-index|model-routing|data-ml|data-consolidation|accounts-payable|subscription-workflow|fullstack-developer|dependency-manager|agent-organizer|operations-manager|project-management|support-|team-coordinator|analytics-dashboard|ai-chat-streaming|youtube-api|marketplace-specialist"

for f in "$SRC/.opencode/agent/"*.md; do
  bn=$(basename "$f" .md)
  if echo "$bn" | grep -qE "$EXCLUDE_PATTERNS"; then
    echo "  SKIP agent/$bn.md"
    continue
  fi
  adapt_file "$f" "$DST/.opencode/agent/$bn.md" 2
  echo "  agent/$bn.md"
done

# ─── .opencode/command/ (speckit) ─────────────────────────────────────
for f in "$SRC/.opencode/command/speckit."*.md; do
  bn=$(basename "$f")
  adapt_file "$f" "$DST/.opencode/command/$bn" 2
  echo "  command/$bn"
done

echo "Done."
