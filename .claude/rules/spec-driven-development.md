> **Single source of truth**: Before proposing any change, read [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) (adjust relative path to the file's depth). When this document conflicts with `ARCHITECTURE.md`, `ARCHITECTURE.md` wins.

# Spec-Driven Development Rules

## Overview

Spec-Driven Development (SDD) is a mandatory development methodology for whynot project. All new features and significant enhancements must follow the complete Spec Kit workflow: constitution → specify → clarify → plan → tasks → analyze → checklist → implement.

## Core Principles

### 1. Spec-First Development

**Requirements:**
- All features must start with specification (`/speckit.specify`)
- Specifications must define problem space, not solution space
- No implementation details in specifications
- Specifications must have acceptance criteria

**Validation:**
```bash
# Check for implementation details in specification
grep -i "react\|shadcn\|trechart" spec/*.md

# Check for acceptance criteria
grep -A 5 "Acceptance Criteria:" spec/*.md
```

### 2. Complete Workflow

**Required Phases:**
1. Constitution (`/speckit.constitution`) - Define principles
2. Specification (`/speckit.specify`) - Define requirements
3. Clarification (`/speckit.clarify`) - Resolve gaps
4. Planning (`/speckit.plan`) - Technical implementation
5. Task Breakdown (`/speckit.tasks`) - Actionable steps
6. Analysis (`/speckit.analyze`) - Validate consistency
7. Quality Checklist (`/speckit.checklist`) - Validate completeness
8. Implementation (`/speckit.implement`) - Build feature

**Quality Gates:**
- Must pass `/speckit.checklist` before planning
- Must pass `/speckit.analyze` before implementation
- Must resolve all critical issues from analysis

### 3. Project Constitution Compliance

**Required in Constitution:**
- Docker-only development policy
- RTL support requirements (for Arabic interface)
- Design differentiation from whynot main app
- Express API integration patterns
- Service component structure
- Shadcn UI compliance
- Testing and documentation standards

**Validation:**
```bash
# Run analysis to check constitution compliance
/speckit.analyze

# Check for Docker-only violations
grep -r "npm install\|npm run" . --include="*.md" | grep -v "make shell"
```

## Mandatory Practices

### Specification Quality

**Required Elements:**
- Problem statement (what and why)
- User stories with acceptance criteria
- Functional requirements
- Non-functional requirements (performance, security, accessibility)
- Success criteria
- Edge cases and error handling

**Anti-Patterns (FORBIDDEN):**
- Specifying technologies (React, Shadcn UI, etc.)
- Specifying implementation details
- Using vague language ("fast", "easy")
- Skipping non-functional requirements
- Missing success criteria

**Examples:**

❌ **WRONG:**
```markdown
User can monitor PostgreSQL using Recharts and Shadcn UI.
```

✅ **CORRECT:**
```markdown
User can monitor PostgreSQL performance metrics.
- CPU usage displays as percentage (0-100%)
- Memory usage displays in MB with 2 decimal places
- Metrics update every 5 seconds (±500ms tolerance)
- Success: 95% of users report metrics accuracy > 90%
```

### Planning Quality

**Required Elements:**
- Tech stack matches existing whynot patterns
- Architecture follows service component structure
- Docker-only development enforced
- RTL support included (if UI components)
- Implementation strategy with phases
- Testing strategy

**Anti-Patterns (FORBIDDEN):**
- Introducing new tech stack without review
- Ignoring existing patterns
- Violating Docker-only policy
- Skipping RTL support
- No testing strategy

### Task Breakdown Quality

**Required Elements:**
- Tasks are completable in < 2 hours
- Each task has clear acceptance criteria
- Dependencies documented
- Testing included (not just implementation)
- RTL support tasks included (if applicable)

**Anti-Patterns (FORBIDDEN):**
- Single task for entire feature
- Tasks without acceptance criteria
- Tasks > 4 hours
- Skipping testing tasks
- Missing RTL support tasks

## whynot-Specific Rules

### Docker-Only Development (MANDATORY)

**FORBIDDEN:**
```bash
❌ cd client && npm install
❌ cd client && npm run dev
❌ cd client && npm run lint
❌ node script.js
```

**REQUIRED:**
```bash
✅ make shell-client npm install
✅ make start
✅ make shell-client npm run lint
✅ make shell-client node script.js
```

**Task Requirements:**
- All implementation tasks must include Docker commands
- Tasks must reference `make shell-*` commands
- No direct npm/node commands in tasks

### RTL Support (MANDATORY for UI)

**Required Patterns:**
```typescript
// Use logical properties
<div className="ms-4 me-2 ps-6 pe-4"> // ✅ CORRECT

// Mirror directional icons
<ArrowRight className="rtl:scale-x-[-1]" /> // ✅ CORRECT

// RTL flex direction — native dir="rtl" handles reversal, no extra class needed
<div className="flex-row"> // ✅ CORRECT
```

**FORBIDDEN:**
```typescript
<div className="ml-4 mr-2 pl-6 pr-4"> // ❌ WRONG
<ArrowRight /> // ❌ WRONG (not mirrored)
<div className="flex-row"> // ❌ WRONG (no RTL support)
```

**Task Requirements:**
- All UI component tasks must include RTL support
- Tasks must test with Arabic locale (ar-SA)
- Design reviews must check RTL

### Design Differentiation (MANDATORY)

**whynot Main App Patterns (DO NOT COPY):**
- Floating icon sidebar (left)
- Card grid (3-5 columns)
- 3-dot dropdown menus
- Multi-level nested cards

**Client Dashboard Patterns (REQUIRED):**
- Top navigation bar OR tab-based
- Table views OR compact cards
- Inline action buttons (always visible)
- Single-level cards only

**Task Requirements:**
- Tasks must specify UI layout different from main app
- Design reviews must verify differentiation
- Cannot copy main app components directly

### Service Component Pattern (MANDATORY for Services)

**Required Tab Structure:**
1. General - Connection info, credentials, status
2. Environment - Environment variables editor
3. Logs - Real-time log viewer
4. Monitoring - CPU/memory charts
5. Backups - Backup/restore (if applicable)
6. Advanced - Resource limits, ports

**Required File Structure:**
```
frontend/src/components/dashboard/{service}/
├── {service}-header.tsx
└── tabs/
    ├── general-tab.tsx
    ├── environment-tab.tsx
    ├── logs-tab.tsx
    ├── monitoring-tab.tsx
    ├── backups-tab.tsx
    └── advanced-tab.tsx
```

**Task Requirements:**
- Follow existing patterns from postgresService.ts
- Use standard tab structure
- Match file organization

## Quality Validation

### Before Implementation

**Required Checks:**
```bash
# 1. Quality checklist
/speckit.checklist

# 2. Consistency analysis
/speckit.analyze

# 3. Both must pass before implementation
```

**Required Outcomes:**
- All checklist items pass
- No critical issues from analysis
- Constitution compliance verified
- RTL support tasks present (if applicable)
- Testing tasks present

### During Implementation

**Required Checks:**
```bash
# 1. Type checking
make shell-client npm run typecheck

# 2. Linting
make shell-client npm run lint

# 3. Tests
make shell-client npm test
```

**Required Outcomes:**
- TypeScript compiles without errors
- Linting passes with no warnings
- Tests pass
- No Docker-only violations

### After Implementation

**Required Checks:**
- [ ] All tasks completed
- [ ] Requirements met
- [ ] User stories pass acceptance tests
- [ ] Non-functional requirements satisfied
- [ ] Constitution compliant
- [ ] RTL support verified (if applicable)
- [ ] Design differentiation verified
- [ ] Tests pass with sufficient coverage

## Enforcement

### Code Review Checklist

**PR reviewers must verify:**
- [ ] Spec Kit workflow completed (all 8 phases)
- [ ] Constitution compliance verified
- [ ] Docker-only development followed
- [ ] RTL support implemented (if applicable)
- [ ] Design differentiation from main app
- [ ] Service component pattern followed (if service)
- [ ] Testing included and passing
- [ ] Documentation updated

### CI/CD Validation

**Automated checks:**
- TypeScript strict mode (no `any` types)
- Biome linting
- Test coverage minimum 80%
- Docker container builds successfully
- No hardcoded secrets

### Failure Consequences

**Non-Compliant Code:**
- Rejected in PR review
- Must complete Spec Kit workflow
- Must fix violations
- Re-submit for review

**Incomplete Workflow:**
- Feature implementation blocked
- Must complete missing phases
- Must pass quality gates
- Cannot proceed to implementation

## Exceptions

**Allowed exceptions (with justification):**
1. **Bug fixes** - Can skip full Spec Kit workflow for critical bugs
2. **Emergency fixes** - Can expedite workflow with documentation
3. **Documentation updates** - Can skip technical phases
4. **Refactoring** - Can use simplified workflow if behavior unchanged

**Exception process:**
1. Document exception reason
2. Get approval from tech lead
3. Implement minimal quality checks
4. Follow-up with full workflow if major changes

## Integration with Other Rules

### Coexists with:
- [Docker Development Rules](docker-development-only.md) - Docker-only enforcement
- [RTL Support Rules](rtl-support-arabic.md) - RTL implementation
- [Service Component Patterns](service-component-patterns.md) - Service structure
- [Express API Patterns](trpc-api-patterns.md) - API integration

### Overrides:
No other rules override Spec-Driven Development rules for new features.

## Examples

### Example 1: Adding MySQL Service

**CORRECT Workflow:**
```bash
1. /speckit.specify (define requirements)
2. /speckit.clarify (resolve gaps)
3. /speckit.plan (match existing patterns)
4. /speckit.tasks (10+ tasks)
5. /speckit.analyze (check consistency)
6. /speckit.checklist (validate quality)
7. /speckit.implement (execute tasks)
```

**INCORRECT Workflow:**
```bash
1. Skip to implementation ❌
2. Write code without specification ❌
3. Create tasks as afterthought ❌
```

### Example 2: Adding Feature to Existing Service

**CORRECT Workflow:**
```bash
1. /speckit.specify (define enhancement)
2. /speckit.clarify (focus on integration)
3. /speckit.plan (plan integration)
4. /speckit.tasks (focused tasks)
5. /speckit.analyze (check integration)
6. /speckit.checklist (validate)
7. /speckit.implement (execute)
```

**INCORRECT Workflow:**
```bash
1. Directly edit existing code ❌
2. No specification or planning ❌
3. No testing added ❌
```

## Summary

Spec-Driven Development is **mandatory** for all new features and significant enhancements.

**Key Requirements:**
- Complete 8-phase workflow
- Pass quality gates (checklist, analysis)
- Follow whynot constraints
- Docker-only development
- RTL support (if applicable)
- Design differentiation
- Service component patterns

**Failure to comply** = Code rejected, implementation blocked.

**When in doubt**, run:
```bash
/speckit.checklist  # Validate requirements
/speckit.analyze   # Check consistency
```
