# Recon — Create the `security-reviewer` Claude agent

## Agent
Drive via the existing `prompt-engineer` agent (`.claude/agents/prompt-engineer.md`).

## Skills
- Primary: `.claude/skills/spec-driven-development/`
- Supporting: (skill `exploit-safety` will be created in A4 — reference it forward)

## Dependencies
- A1 (so the recon-engineer agent exists and can call this reviewer)

## Task
Create a new specialist agent that reviews any diff touching the Recon surface for security correctness. This agent is invoked **before merging** any C/D/F prompt output.

### 1. Files to create
- `.claude/agents/security-reviewer.md`
- `.opencode/agent/security-reviewer.md`

### 2. Frontmatter
Match the style of `.claude/agents/api-designer.md`. Tools: Read, Glob, Grep, Bash (read-only — this agent does not write code, only reports).

### 3. Body — required review checklist
The agent's body must specify the following review passes, in order:

1. **Prompt-injection surface**: the scanned repository is untrusted input. Any code that reads files from the scanned repo and feeds them into an LLM must sanitize or sandbox the content. Flag any path that concatenates raw repo content into a prompt without a delimiter + instruction-isolation strategy.
2. **Authorization boundary**: every Recon endpoint must check `requireFlag('recon_enabled')` AND `requireFeature('recon_enabled')` AND credit gate AND a workspace-scoped permission check. Any handler missing one of these is a blocker.
3. **Per-scan authorization audit log**: scan creation must persist an `recon_scan_authorizations` row with the caller's user id, IP, timestamp, and the free-text justification. Reject any path that creates a scan without writing this row.
4. **Exploit-payload leakage**: structured logs must never serialize raw exploit payloads (SQL injection strings, XSS payloads, SSRF URLs) at INFO or above. Allowed only at DEBUG, and only when redaction is impossible. Flag any `console.log` / `logger.info` / `logger.warn` of payload-shaped strings.
5. **Cross-target contamination on resume**: on `POST /api/recon/scans/:id/resume`, the request URL must match the original scan's URL exactly (including scheme, host, port). Flag any resume path that accepts a mismatched URL.
6. **Browser-automation egress**: the executor's headless browser must not be able to reach private IP ranges (RFC1918, link-local, loopback) unless the target URL itself resolves there. Flag any code that disables this check.
7. **Findings storage**: the `recon_findings` table must store evidence as a discriminated union (text / file-ref / screenshot-ref) — never as raw HTML/JS that could be re-rendered unsanitized in the UI.

### 4. Output format
The agent must produce a structured report with: blockers, warnings, suggestions. Each item references a file and line range.

### Tests
- N/A for the agent file itself.

### i18n
- N/A — internal tooling.

### Documentation
- N/A.

### Files to modify
- Create: `.claude/agents/security-reviewer.md`
- Create: `.opencode/agent/security-reviewer.md`
