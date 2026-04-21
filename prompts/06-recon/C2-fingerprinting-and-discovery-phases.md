# Recon — Fingerprinting + Discovery phases (phases 1 & 2)

## Agent
`recon-engineer` (A1).

## Skills
- Primary: `.claude/skills/pentest-orchestration/` (A3), `.claude/skills/exploit-safety/` (A4)
- Rules: `.claude/rules/recon-safety.md` (A7)

## Dependencies
- A1, A3, A4, A7, C1

## Task
Implement phases 1 and 2 of the Recon pipeline inside `services/recon-executor/`. Phase 1 is **Fingerprinting** (renamed from upstream "Pre-Reconnaissance"). Phase 2 is **Discovery** (renamed from upstream "Reconnaissance" to avoid colliding with the product name "Recon").

### 1. Fingerprinting phase (`services/recon-executor/app/phases/fingerprinting.py`)
External + source-code surface scan. Tools (internal use only — never named in user-facing copy):
- `nmap -sV --top-ports 100 <host>` — service fingerprinting
- `subfinder -d <domain> -silent` — subdomain enumeration
- `whatweb -a 3 <url>` — tech stack detection
- Source-code scan: walk the project's connected GitHub repo (read-only mount), build a tech-stack manifest (framework, package manager, ORM, auth library) using LLM-assisted classification — file content wrapped per `exploit-safety/references/prompt-injection-hardening.md`.

Output: a `FingerprintingResult` JSON artifact, persisted via `recon-scan-artifact-repository`. Phase row UPSERTed to `completed`.

### 2. Discovery phase (`services/recon-executor/app/phases/discovery.py`)
Builds the attack-surface map:
- Headless browser session (already in C1's image) crawls the target URL starting from the entry URL, follows internal links up to depth 3.
- Authenticated crawl: if `recon_scans.config_yaml` includes a login flow, drive it (form-fill) and continue crawling as the authenticated user.
- API endpoint discovery: parse JS bundles for fetch/axios calls; if `schemathesis` can pull an OpenAPI spec from the host, add those endpoints.
- LLM correlation pass: take the fingerprinting output + crawled URLs and emit a `DiscoveryResult` with categorized endpoints (auth endpoints, data-mutation endpoints, file-upload endpoints, redirect endpoints, etc.).

Output: `DiscoveryResult` artifact + phase row UPSERTed to `completed`.

### 3. Heartbeats + cancellation
Both phases honor the heartbeat (30s) and cancellation (10s) loops from C1.

### 4. Per-phase billing
On phase completion, the orchestrator writes a `recon_phase_fingerprinting` / `recon_phase_discovery` PAYG event via the gateway (per B3). The orchestrator suppresses per-phase events when the scan completes the full pipeline (single `recon_scan_run` event in C5).

### Tests
- Mock the tool subprocess calls; assert correct argv was constructed.
- Source-code scanner respects 64 KB per-file cap (per A4).
- Discovery crawler stops at depth 3 even when more links are found.
- Authenticated crawl uses the supplied login flow and never logs the password (redaction tested).
- Cancellation between fingerprinting and discovery: discovery never starts; phase row stays `pending`.
- 100% coverage on new files.

### i18n
- Phase labels (5 locales, `frontend/public/locales/{lng}/recon.json` — added in D-section but referenced here):
  - `recon.phases.fingerprinting.label` = "Fingerprinting" (en) / matching translations
  - `recon.phases.discovery.label` = "Discovery" (en) / matching translations
- Backend status messages (5 locales, `gateway/src/i18n/translations/{lng}/success.json`):
  - `success:recon.phase.fingerprinting.completed`
  - `success:recon.phase.discovery.completed`

### Documentation
- E3 (docs prompt) covers the phase-by-phase user explanation.

### Files to modify
- `services/recon-executor/app/phases/fingerprinting.py`
- `services/recon-executor/app/phases/discovery.py`
- Tests for both
- 5 frontend locale files (recon.json) and 5 gateway locale files (success.json)
