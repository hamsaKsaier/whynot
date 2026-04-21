# Informe de reconocimiento — {{project}} / {{environment}}
**ID del escaneo:** {{scan_id}}
**Generado:** {{generated_at}}
**Autorizado por:** {{authorized_by}} el {{authorized_at}}

## Resumen ejecutivo
- Total de hallazgos: {{total_findings}} (Crítico: {{critical_count}}, Alto: {{high_count}}, Medio: {{medium_count}}, Bajo: {{low_count}})
- Top 3 riesgos:
{{top_risks}}

## Metodología
Este escaneo siguió una canalización de cinco fases: Huellas digitales (superficie externa y de código fuente), Descubrimiento (endpoints y superficie de ataque), Análisis de vulnerabilidades (hipótesis por clase), Explotación (intentos autorizados de prueba de concepto) e Informe (este documento). Cada fase se guarda por puntos de control y cada explotación que modifica estado se intenta como máximo una vez.

## Hallazgos
{{findings_section}}

## Hipótesis descartadas
{{discarded_table}}

## Autorización y legal
{{authorization_block}}
