# Recon report — {{project}} / {{environment}}
**Scan ID:** {{scan_id}}
**Generated:** {{generated_at}}
**Authorized by:** {{authorized_by}} on {{authorized_at}}

## Executive summary
- Total findings: {{total_findings}} (Critical: {{critical_count}}, High: {{high_count}}, Medium: {{medium_count}}, Low: {{low_count}})
- Top 3 risks:
{{top_risks}}

## Methodology
This scan followed a five-phase pipeline: Fingerprinting (external + source surface), Discovery (endpoints and attack surface), Vulnerability Analysis (per-class hypotheses), Exploitation (authorized proof-of-concept attempts), and Reporting (this document). Each phase is checkpointed and every write-class exploit is attempted at most once.

## Findings
{{findings_section}}

## Discarded hypotheses
{{discarded_table}}

## Authorization & legal
{{authorization_block}}
