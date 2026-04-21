# Rapport de reconnaissance — {{project}} / {{environment}}
**ID du scan :** {{scan_id}}
**Généré le :** {{generated_at}}
**Autorisé par :** {{authorized_by}} le {{authorized_at}}

## Résumé exécutif
- Total des constatations : {{total_findings}} (Critique : {{critical_count}}, Élevée : {{high_count}}, Moyenne : {{medium_count}}, Faible : {{low_count}})
- Top 3 des risques :
{{top_risks}}

## Méthodologie
Ce scan a suivi un pipeline en cinq phases : Empreinte (surface externe et code source), Découverte (points de terminaison et surface d'attaque), Analyse de vulnérabilités (hypothèses par classe), Exploitation (tentatives de preuve de concept autorisées) et Rapport (ce document). Chaque phase est enregistrée par points de reprise et chaque exploit modifiant l'état est tenté une seule fois.

## Constatations
{{findings_section}}

## Hypothèses écartées
{{discarded_table}}

## Autorisation et mentions légales
{{authorization_block}}
