> **Single source of truth**: Before proposing any change, read [`../../../../ARCHITECTURE.md`](../../../../ARCHITECTURE.md) (adjust relative path to the file's depth). When this document conflicts with `ARCHITECTURE.md`, `ARCHITECTURE.md` wins.

# Deduplication Policy

## Overview

Findings are deduplicated by a composite key to prevent the same vulnerability from appearing multiple times in a report. The deduper keeps the highest-severity instance and merges lower-severity duplicates into a JSONB array.

## Dedup Key Components

```
(scan_id, vuln_class, normalized_endpoint, normalized_param)
```

| Component | Type | Description |
|-----------|------|-------------|
| `scan_id` | UUID | The scan that produced this finding |
| `vuln_class` | `recon_vuln_class` enum | One of: `injection`, `xss`, `ssrf`, `auth`, `authz` |
| `normalized_endpoint` | TEXT | URL path with numeric segments replaced by `{id}` |
| `normalized_param` | TEXT | Lowercased parameter name with index suffixes stripped |

## Normalization Functions

### `normalize_endpoint(endpoint: str) -> str`

Replaces every numeric-only path segment with `{id}`:

```python
import re

def normalize_endpoint(endpoint: str) -> str:
    return re.sub(r"/(?=\d)(\d+)(?=/|$)", "/{id}", endpoint)
```

| Input | Output |
|-------|--------|
| `/users/123/settings` | `/users/{id}/settings` |
| `/orgs/5/projects/42/labels` | `/orgs/{id}/projects/{id}/labels` |
| `/api/v1/health` | `/api/v1/health` |
| `/api/v2/users/0` | `/api/v2/users/{id}` |

### `normalize_param(param: str) -> str`

Lowercases and strips array-index or numeric suffixes:

```python
def normalize_param(param: str) -> str:
    lower = param.lower()
    lower = re.sub(r"\[\d+\]$", "", lower)
    lower = re.sub(r"_\d+$", "", lower)
    return lower
```

| Input | Output |
|-------|--------|
| `Filters[0]` | `filters` |
| `items[3]` | `items` |
| `sort_order` | `sort_order` |
| `TAG_2` | `tag` |
| `q` | `q` |
| `Hello世界` | `hello世界` |

## SQL Schema

### Unique Constraint

```sql
CREATE UNIQUE INDEX idx_recon_findings_dedup
    ON recon_findings (scan_id, vuln_class, normalized_endpoint, normalized_param);
```

### Duplicates Column

The surviving row has a `duplicates` JSONB column:

```sql
ALTER TABLE recon_findings
ADD COLUMN duplicates JSONB NOT NULL DEFAULT '[]'::jsonb;
```

Each entry is:

```json
{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "severity": "medium",
    "created_at": "2025-04-21T10:30:00Z"
}
```

## Python Helper

```python
from datetime import datetime
from typing import Optional
import asyncpg

from severity import compute_severity, Severity


def _severity_rank(s: Severity) -> int:
    return {"low": 1, "medium": 2, "high": 3, "critical": 4}[s.value]


async def dedup_finding(
    db: asyncpg.Connection,
    scan_id: str,
    vuln_class: str,
    raw_endpoint: str,
    raw_param: str,
    impact: int,
    exploitability: int,
    blast_radius: int,
    proof_of_concept: str,
    exploit_outcome: str,
) -> dict:
    norm_endpoint = normalize_endpoint(raw_endpoint)
    norm_param = normalize_param(raw_param)
    severity = compute_severity(impact, exploitability, blast_radius)
    total = impact + exploitability + blast_radius

    row = await db.fetchrow(
        """
        SELECT id, impact, exploitability, blast_radius, severity, duplicates
        FROM recon_findings
        WHERE scan_id = $1
          AND vuln_class = $2
          AND normalized_endpoint = $3
          AND normalized_param = $4
        """,
        scan_id, vuln_class, norm_endpoint, norm_param,
    )

    if row is None:
        new_id = await db.fetchval(
            """
            INSERT INTO recon_findings (
                scan_id, vuln_class, normalized_endpoint, normalized_param,
                impact, exploitability, blast_radius, severity,
                proof_of_concept, exploit_outcome, status, duplicates
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'confirmed', '[]'::jsonb)
            RETURNING id
            """,
            scan_id, vuln_class, norm_endpoint, norm_param,
            impact, exploitability, blast_radius, severity.value,
            proof_of_concept, exploit_outcome,
        )
        return {"id": str(new_id), "action": "created", "severity": severity.value}

    existing_total = row["impact"] + row["exploitability"] + row["blast_radius"]
    existing_severity = Severity(row["severity"])
    existing_dupes = row["duplicates"]

    if total > existing_total:
        loser_entry = {
            "id": str(row["id"]),
            "severity": existing_severity.value,
            "created_at": datetime.utcnow().isoformat() + "Z",
        }
        new_dupes = [loser_entry] + list(existing_dupes or [])

        await db.execute(
            """
            UPDATE recon_findings
            SET impact = $5, exploitability = $6, blast_radius = $7,
                severity = $8, proof_of_concept = $9, exploit_outcome = $10,
                duplicates = $11, updated_at = now()
            WHERE id = $4
            """,
            row["id"],
            scan_id,
            vuln_class,
            row["id"],
            impact, exploitability, blast_radius, severity.value,
            proof_of_concept, exploit_outcome,
            json.dumps(new_dupes),
        )
        return {"id": str(row["id"]), "action": "replaced", "severity": severity.value}
    else:
        winner_entry = {
            "id": str(row["id"]),
            "severity": severity.value,
            "created_at": datetime.utcnow().isoformat() + "Z",
        }
        new_dupes = list(existing_dupes or []) + [winner_entry]

        await db.execute(
            """
            UPDATE recon_findings
            SET duplicates = $5, updated_at = now()
            WHERE id = $4
            """,
            row["id"],
            scan_id,
            vuln_class,
            row["id"],
            json.dumps(new_dupes),
        )
        return {"id": str(row["id"]), "action": "merged", "severity": existing_severity.value}
```

## Worked Examples

### Example 1: New Finding (No Duplicate)

```
scan_id:    abc-123
vuln_class: injection
endpoint:   /api/users/42
param:      sort

→ normalized_endpoint: /api/users/{id}
→ normalized_param:    sort
→ No existing row → INSERT new finding
→ action: "created"
```

### Example 2: Duplicate with Higher Severity

```
Existing:
  scan_id: abc-123, vuln_class: injection, endpoint: /api/users/{id}, param: sort
  impact=1, exploitability=2, blast_radius=1 → total=4 (low)

Incoming:
  scan_id: abc-123, vuln_class: injection, endpoint: /api/users/99, param: sort
  impact=3, exploitability=4, blast_radius=3 → total=10 (high)

→ normalized_endpoint matches: /api/users/{id}
→ Incoming total (10) > existing total (4)
→ UPDATE existing row with new scores
→ Old finding moved to duplicates: [{id: "...", severity: "low", created_at: "..."}]
→ action: "replaced"
```

### Example 3: Duplicate with Lower Severity

```
Existing:
  scan_id: abc-123, vuln_class: xss, endpoint: /dashboard/{id}, param: q
  impact=3, exploitability=3, blast_radius=3 → total=9 (high)

Incoming:
  scan_id: abc-123, vuln_class: xss, endpoint: /dashboard/7, param: q
  impact=2, exploitability=2, blast_radius=2 → total=6 (medium)

→ normalized_endpoint matches: /dashboard/{id}
→ Incoming total (6) < existing total (9)
→ Existing row survives unchanged
→ Incoming finding appended to duplicates: [..., {id: "...", severity: "medium", created_at: "..."}]
→ action: "merged"
```

### Example 4: Tie — First Inserted Survives

```
Existing:
  impact=2, exploitability=3, blast_radius=2 → total=7 (medium)

Incoming:
  impact=3, exploitability=2, blast_radius=2 → total=7 (medium)

→ Same total (7). Existing wins by first-inserted rule.
→ Incoming appended to duplicates.
→ action: "merged"
```

## Test Cases

| Test | Description |
|------|-------------|
| `test_normalize_endpoint_single_id` | `/users/123` → `/users/{id}` |
| `test_normalize_endpoint_multiple_ids` | `/orgs/5/projects/42` → `/orgs/{id}/projects/{id}` |
| `test_normalize_endpoint_no_ids` | `/api/v1/health` → `/api/v1/health` unchanged |
| `test_normalize_endpoint_zero` | `/users/0` → `/users/{id}` |
| `test_normalize_param_bracket_index` | `Filters[0]` → `filters` |
| `test_normalize_param_underscore_index` | `items_2` → `items` |
| `test_normalize_param_no_index` | `sort_order` → `sort_order` unchanged |
| `test_normalize_param_lowercases` | `ContentType` → `contenttype` |
| `test_normalize_param_non_ascii` | `FiltroPrincipal[0]` → `filtroprincipal` |
| `test_dedup_creates_first` | No existing row → INSERT |
| `test_dedup_replaces_with_higher` | Incoming higher → replaces, old in `duplicates` |
| `test_dedup_merges_lower` | Incoming lower → survives unchanged, incoming in `duplicates` |
| `test_dedup_tiebreak_first_inserted` | Same total → existing survives |
