---
title: "Recon-Schnellstart"
description: "Führen Sie Ihren ersten Recon-Scan in etwa fünf Minuten durch."
lang: de
draft: false
---

# Recon-Schnellstart

Führen Sie Ihren ersten Recon-Scan in etwa fünf Minuten durch. Diese Anleitung führt Sie End-to-End durch den Neuer-Scan-Assistenten, von der Autorisierung bis zu den ersten Funden.

Bevor Sie beginnen:

- Sie müssen Workspace-Eigentümer sein oder die Berechtigung `recon.scan.create` besitzen.
- Im Workspace muss das Feature-Flag `recon_enabled` aktiviert sein. Fragen Sie Ihren Administrator, falls Sie den Recon-Bereich nicht in der Seitenleiste sehen.
- Sie müssen das gesetzliche Recht haben, die Zielumgebung zu scannen. Lesen Sie zuerst [Autorisierung & verantwortungsvoller Einsatz](responsible-use.md).

---

## Schritt 1 — Den Neuer-Scan-Assistenten öffnen

1. Klicken Sie in der Seitenleiste auf **Recon**.
2. Klicken Sie auf der Recon-Startseite auf **Neuer Scan**.

Der Assistent öffnet sich mit einem Vier-Schritte-Ablauf: **Ziel → Autorisierung → Umfang → Überprüfung**.

## Schritt 2 — Ziel wählen

Füllen Sie das Ziel-Panel aus:

| Feld | Was eingeben |
|------|--------------|
| **Umgebung** | Die zu scannende Umgebung. Mit `production` markierte Umgebungen zeigen eine deutlich sichtbare Warnung — siehe unten. |
| **Basis-URL** | Die Wurzel-URL, von der der Scan startet. In den meisten Workspaces muss sie `https://` sein. |
| **Repository (optional)** | Verbinden Sie ein angebundenes Git-Repository, damit Recon zusätzlich zur Live-Site auch über Ihren Quellcode argumentieren kann. |
| **Scan-Name** | Eine kurze Bezeichnung. Standard: Umgebungsname plus aktuelles Datum. |

> **Produktionswarnung.** Wenn Sie eine mit `production` markierte Umgebung wählen, zeigt Recon eine gelbe Warnung. Recon führt den Scan dennoch aus — Sie haben ihn ausdrücklich autorisiert —, aber stellen Sie sicher, dass Sie wirklich Live-Traffic und aktive Sonden gegen die Produktion senden möchten. Im Zweifel wählen Sie eine Staging- oder Preview-Umgebung.

## Schritt 3 — Autorisierung bestätigen

Jeder Scan benötigt einen **Per-Scan-Autorisierungseintrag**. Das ist eine rechtliche Schranke, keine UX-Annehmlichkeit: Sie teilen der Plattform schriftlich mit, dass Sie die Erlaubnis haben, dieses Ziel zu scannen.

Im Autorisierungs-Panel:

1. Setzen Sie ein Häkchen bei **Ich bin berechtigt, dieses Ziel zu scannen.**
2. Setzen Sie ein Häkchen bei **Ich verstehe, dass dieser Scan aktive Sonden sendet.**
3. Geben Sie die **juristische Person** ein, die Sie vertreten (z. B. Ihren Firmennamen).
4. Fügen Sie optional eine Referenz zu Ihrer schriftlichen Autorisierung ein (Ticket-ID, E-Mail-Verlauf, Vertrag).

Beim Absenden schreibt Recon eine unveränderliche Zeile in das Autorisierungs-Audit-Log, gebunden an Ihren Benutzer, Ihre IP, den Zeitstempel und die exakte Ziel-URL. Sie können sie später unter **Einstellungen → Recon → Audit-Log** einsehen.

Wenn Sie nicht alle drei Häkchen setzen können, hören Sie auf. Sie haben noch keine Autorisierung.

## Schritt 4 — Umfang wählen

Der Umfang steuert, wie breit und tief der Scan geht.

- **Oberflächen-Scan** — nur passive Reconnaissance. Schnell, kostengünstig, ohne aktive Sondierung.
- **Standard-Scan** — Oberflächen-Scan plus aktive Sonden für gängige Schwachstellenklassen. Für die meisten Workspaces empfohlen.
- **Tiefen-Scan** — Standard-Scan plus authentifizierte Sondierung und längere Crawl-Budgets. Verbraucht die meisten Credits.

Jede Option zeigt vor der Bestätigung ihre geschätzten Credit-Kosten. Sie können auch ein **Credit-Limit pro Scan** unter **Einstellungen → Recon** festlegen; Scans, die das Limit überschreiten würden, werden vor der nächsten kostenpflichtigen Phase beendet.

## Schritt 5 — Überprüfen und starten

Das letzte Panel fasst alles zusammen: Ziel, Autorisierung, Umfang, geschätzte Kosten und etwaige Warnungen. Wenn Sie auf **Scan starten** klicken, führt Recon Folgendes aus:

1. Schreibt die Scan-Zeile.
2. Schreibt die Autorisierungszeile.
3. Stellt den Scan in die Warteschlange.
4. Leitet Sie auf die Scan-Detailseite um.

## Was als Nächstes passiert

- Die Scan-Detailseite aktualisiert sich in Echtzeit, sobald jede Phase abgeschlossen ist.
- Wenn der Scan beendet ist, erscheinen die Funde im Tab **Funde**.
- Jeder Fund enthält eine Schweregrad-Bewertung, einen Proof-of-Concept und eine empfohlene Behebung. Siehe [Funde verstehen](understanding-findings.md).
- Berichte können geteilt und als PDF exportiert werden. Siehe [Berichte lesen](reading-reports.md).

## Sie sind fertig

Lesen Sie als Nächstes:

- [Autorisierung & verantwortungsvoller Einsatz](responsible-use.md) — Ihre rechtlichen Pflichten.
- [Funde verstehen](understanding-findings.md) — wie man Schweregrad, Exploit-Ergebnisse und Fehlalarm-Markierungen liest.
- [Kontingente und Abrechnung](quotas.md) — was ein Scan in jedem Plan kostet.
- [Fehlerbehebung](troubleshooting.md) — wenn ein Scan hängt oder fehlschlägt.
