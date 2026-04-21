# Recon — Create the `recon-safety` rule

## Agent
`recon-engineer` (A1).

## Skills
- Primary: `.claude/skills/exploit-safety/` (A4)
- Rules: `.claude/rules/spec-driven-development.md`

## Dependencies
- A1, A4

## Task
Create a strict rule file at `.claude/rules/recon-safety.md` that future agents and reviewers MUST consult before changing any Recon code path. Rules in this file are non-negotiable; violating one is a merge blocker.

### 1. File to create
- `.claude/rules/recon-safety.md`

### 2. Required structure
Mirror the format of existing rules in `.claude/rules/` (e.g., `spec-driven-development.md`, `rtl-support-arabic.md`). Use the same single-source-of-truth ARCHITECTURE.md preamble.

### 3. Mandatory rules to encode

1. **Per-scan authorization is required.** Every `POST /api/recon/scans` MUST validate, persist, and audit-log the `authorization` block per `exploit-safety` skill. Code that creates a scan without writing to `recon_scan_authorizations` is a merge blocker.
2. **Never auto-retry destructive (write-class) exploits.** A failed `write` exploit is recorded once and not retried within the same scan.
3. **Never log raw exploit payloads at INFO or above.** The `payload-redaction` reference in `exploit-safety` is mandatory at every log site.
4. **Scanned repository content is untrusted.** Any LLM call that ingests repo file content MUST use the prompt-injection wrapper from `exploit-safety/references/prompt-injection-hardening.md`.
5. **Resume requires URL match.** `POST /api/recon/scans/:id/resume` MUST reject any request whose URL doesn't byte-equal the original scan's URL.
6. **No banned vocabulary in user-facing output.** The strings Shannon, KeygraphHQ, nmap, subfinder, whatweb, schemathesis, Playwright, Anthropic, Claude MUST NOT appear in any file under `frontend/public/locales/**`, `gateway/src/i18n/translations/**`, `frontend/src/components/landing/**`, or `/docs/recon/**`.
7. **Single feature flag.** All Recon endpoints + UI surfaces gate on the single `recon_enabled` flag. Do not introduce per-phase or per-vuln-class flags without an architecture review.
8. **Multi-tenancy.** Every Recon DB query MUST filter by `workspace_id`. Tests MUST include a "wrong-workspace user gets 404" assertion per endpoint.
9. **No production-environment hard-block in v1**, but UI MUST surface a prominent warning when the selected environment is tagged `production`. (User explicitly chose authorization-only; the warning preserves the safety message without blocking.)
10. **PoC reproducibility.** Findings included in the report MUST have a non-null, exact-reproducible `proof_of_concept` (request/command/script). The "no exploit, no report" gate from `finding-severity` is mandatory.

### 4. Validation block
Add a "How to validate before merge" checklist:
- `make shell-gateway npm test -- recon`
- `make shell-frontend npm test -- recon`
- `make shell-recon-executor pytest`
- `grep -r -i 'shannon\|nmap\|subfinder\|whatweb\|schemathesis\|playwright\|anthropic\|claude' frontend/public/locales gateway/src/i18n/translations frontend/src/components/landing docs/recon` (must return zero matches).

### Tests
- N/A — rule files are documentation. The rule itself drives test requirements in B–G.

### i18n
- N/A.

### Documentation
- N/A.

### Files to modify
- Create: `.claude/rules/recon-safety.md`
