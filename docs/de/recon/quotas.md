---
title: "Recon — Kontingente und Abrechnung"
description: "Plan-Inklusivleistungen, PAYG-Tarife, Teil-Scan-Abrechnung und Credit-Limits pro Scan für Recon."
lang: de
draft: false
---

# Kontingente und Abrechnung

Recon-Scans verbrauchen **Credits** aus dem monatlichen Kontingent Ihres Workspace. Wenn Sie das Kontingent überschreiten, werden zusätzliche Credits zum Pay-as-you-go-Tarif (PAYG) abgerechnet. Diese Seite erklärt, was inklusive ist, was extra kostet und wie Teil-Scan-Abrechnung funktioniert.

Für die Preisgestaltung der zugrunde liegenden Pläne (Free, Pro BYO, Pro Managed) siehe die Live-[Preisseite](/pricing).

---

## Was im Plan enthalten ist

| Plan | Enthaltene Recon-Scans | Oberflächen-Scan | Standard-Scan | Tiefen-Scan |
|------|-------------------------|------------------|---------------|-------------|
| **Free** | 1/Monat, nur Oberfläche | ✓ | — | — |
| **Pro BYO** | 5/Monat, beliebiger Umfang | ✓ | ✓ | ✓ |
| **Pro Managed** | Unbegrenzt (faire Nutzung), beliebiger Umfang | ✓ | ✓ | ✓ |

Enthaltene Scans werden auf die enthaltenen Credits Ihres monatlichen Kontingents angerechnet. Sind diese aufgebraucht, werden weitere Scans zu PAYG-Tarifen abgerechnet.

## Credit-Kosten pro Scan

Die genauen Credit-Kosten hängen von der Komplexität des Ziels ab (Anzahl Endpunkte, Parameter, Antwortgröße), aber typische Bereiche sind:

| Umfang | Typische Credits | Hinweise |
|--------|------------------|----------|
| Oberfläche | 50–200 | Passive Reconnaissance, keine aktive Sondierung. |
| Standard | 500–2.000 | Oberfläche + aktive Sonden für gängige Schwachstellenklassen. |
| Tiefe | 2.000–10.000 | Standard + authentifizierte Sondierung + erweiterter Crawl. |

Der Assistent zeigt vor dem Start die **geschätzten Kosten** für den gewählten Umfang. Die Endkosten werden nach Abschluss des Scans berechnet und auf der Detailseite angezeigt.

## Pay-as-you-go-Tarife

Wenn Sie Ihre enthaltenen Credits überschreiten, werden zusätzliche Credits zum Standard-PAYG-Tarif abgerechnet. Siehe die [PAYG-Dokumentation](../pricing/payg.md) für den aktuellen Preis pro Credit und etwaige Mengenrabatte.

## Teil-Scan-Abrechnung

Manchmal endet ein Scan, bevor jede Phase abgeschlossen ist — Sie brechen ihn ab, das Credit-Limit pro Scan ist erreicht oder ein vorübergehender Fehler beendet ihn. In diesen Fällen:

- Es werden **nur abgeschlossene Phasen** berechnet.
- Eine Phase, die begonnen, aber nicht abgeschlossen wurde, wird **nicht** berechnet.
- Die Detailseite zeigt die exakte phasenweise Kostenaufschlüsselung.

Wenn ein Scan vollständig fehlschlägt, ohne nützliche Daten zu produzieren, werden die Kosten innerhalb von 24 Stunden automatisch zurückerstattet. Sie müssen für routinemäßige Fehler kein Support-Ticket öffnen.

## Credit-Limit pro Scan

Um Überraschungsrechnungen bei einem fehlkonfigurierten Ziel zu vermeiden, setzen Sie ein **Credit-Limit pro Scan** unter **Einstellungen → Recon**.

| Limit-Wert | Wirkung |
|------------|---------|
| `0` | Kein Workspace-Limit. Der Plattform-Standard gilt. |
| `1` bis `100000` | Hartes Limit für einen einzelnen Scan. Recon beendet den Scan vor der nächsten kostenpflichtigen Phase, die das Limit überschreiten würde. |

Das Limit wird vor jedem Phasenstart durchgesetzt, sodass Sie etwas weniger als das Limit zahlen können (je nach Kosten der letzten abgeschlossenen Phase), aber nie mehr.

Empfohlene Startwerte:

- **Free / Evaluation** — bei `0` belassen (kein Limit; auf das enthaltene Kontingent vertrauen).
- **Pro BYO** — auf `5000` setzen, wenn Sie regelmäßig Produktionsziele scannen.
- **Pro Managed** — auf `15000` setzen, wenn Sie häufig Tiefen-Scans durchführen.

Passen Sie auf Basis Ihres tatsächlichen Scan-Verlaufs an; die Detailseite zeigt die Kosten jedes vorherigen Scans.

## Kontingent-Sichtbarkeit

Die Recon-Nutzung wird an zwei Stellen angezeigt:

- **Einstellungen → Abrechnung → Nutzung**, neben anderer Produktnutzung (Test-Läufe, KI-Generierungen usw.).
- **Recon → Einstellungen → Recon → Nutzung**, mit einer Recon-spezifischen Aufschlüsselung inklusive PAYG-Gebühren.

Beide Ansichten sind in Echtzeit. Keine Überraschung am Monatsende.

## Harte Garantien

- **Keine Überraschungsgebühren.** Ein Scan, der Ihr Limit pro Scan überschreiten würde, wird beendet, nicht über das Limit hinaus berechnet.
- **Keine rückwirkenden Preisänderungen.** Wenn wir PAYG-Tarife ändern, gilt der neue Tarif für nach der Änderung gestartete Scans. Laufende Scans werden zum Tarif zum Startzeitpunkt abgerechnet.
- **Keine Überschreitung ohne Warnung.** Wenn Sie 80 % Ihres monatlichen Kontingents überschreiten, wird der Abrechnungskontakt per E-Mail benachrichtigt.

## Häufig gestellte Fragen

**Kostet ein fehlgeschlagener Scan Credits?**
Es werden nur abgeschlossene Phasen berechnet. Eine nicht abgeschlossene Phase wird nicht berechnet. Ein Scan, der fehlschlägt, bevor irgendeine Phase abgeschlossen ist, wird innerhalb von 24 Stunden vollständig erstattet.

**Kostet ein Re-Scan desselben Ziels weniger?**
Nein. Jeder Scan ist unabhängig. Wir bieten derzeit kein Caching über Scans hinweg an.

**Kann ich enthaltene Scans über Workspaces hinweg teilen?**
Nein. Enthaltene Scans gehören zum Workspace, dem sie ausgegeben wurden.

**Was zählt als „Scan" für das monatliche Limit des Free-Plans?**
Jeder erfolgreich gestartete Scan, auch wenn Sie ihn vor Abschluss abbrechen. Ein vom Gateway abgelehnter Scan (z. B. fehlende Autorisierung, deaktiviertes Flag) zählt nicht.

---

Verwandt:

- [Preisgestaltung — Pläne](../pricing/plans.md) — gesamte Plan-Inklusivleistungen.
- [Preisgestaltung — Pay-as-you-go](../pricing/payg.md) — PAYG-Tarife und Mengenrabatte.
- [Schnellstart](quickstart.md) — wie Sie Ihren ersten Scan starten.
