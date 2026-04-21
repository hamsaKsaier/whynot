# Recon-Bericht — {{project}} / {{environment}}
**Scan-ID:** {{scan_id}}
**Erstellt am:** {{generated_at}}
**Autorisiert von:** {{authorized_by}} am {{authorized_at}}

## Zusammenfassung
- Gesamtzahl der Befunde: {{total_findings}} (Kritisch: {{critical_count}}, Hoch: {{high_count}}, Mittel: {{medium_count}}, Niedrig: {{low_count}})
- Top 3 Risiken:
{{top_risks}}

## Methodik
Dieser Scan folgte einer fünfphasigen Pipeline: Fingerprinting (externe und Quellcode-Oberfläche), Discovery (Endpunkte und Angriffsfläche), Schwachstellenanalyse (Hypothesen pro Klasse), Exploitation (autorisierte Proof-of-Concept-Versuche) und Reporting (dieses Dokument). Jede Phase wird per Checkpoint gespeichert und jeder schreibende Exploit wird höchstens einmal versucht.

## Befunde
{{findings_section}}

## Verworfene Hypothesen
{{discarded_table}}

## Autorisierung und Rechtliches
{{authorization_block}}
