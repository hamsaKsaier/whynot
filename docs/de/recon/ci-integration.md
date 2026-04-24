---
title: "Recon — CI-Integration"
description: "Recon-Scans aus Ihrer CI-Pipeline auslösen. Kommt bald."
lang: de
draft: false
---

# CI-Integration

> **Kommt bald.** CI-ausgelöste Scans sind in der Roadmap. Die Form der Integration wird unten beschrieben; die API ist noch nicht stabil.

Das Ziel der CI-Integration ist es, Ihnen zu erlauben, automatisch einen Recon-Scan auszuführen, wenn ein Deployment in einer Nicht-Produktionsumgebung landet, und die Funde dann auf dem Pull Request anzuzeigen, der das Deployment ausgelöst hat.

---

## Geplante Form

Ein typischer Workflow:

1. Ihre CI-Pipeline deployt einen Build in eine Staging- oder Preview-Umgebung.
2. Die Pipeline ruft einen Recon-Webhook mit der Umgebungs-URL, dem Commit-SHA und einem Per-Run-Autorisierungstoken auf.
3. Recon startet einen Scan, dessen Umfang auf die Umgebungs-URL beschränkt ist.
4. Wenn der Scan endet, postet Recon eine Zusammenfassung an den Pull Request: Schweregrad-Anzahlen, ein Diff zum vorherigen Scan und einen Link zum vollständigen Bericht.
5. Wenn ein kritischer oder hoher Fund neu eingeführt wird (also nicht im vorherigen Scan war), schlägt der CI-Check fehl. Bestehende Funde blockieren nicht.

Die Autorisierung ist pro Run, nicht pro Pipeline: Das CI-Token repräsentiert einen Workspace-Eigentümer, der Scans gegen eine spezifische Whitelist von Umgebungs-URLs vorautorisiert hat. Scans gegen jede andere URL erfordern eine frische, interaktive Autorisierung über den Assistenten.

## Warum das noch nicht ausgeliefert ist

CI-Integration vervielfacht die Angriffsfläche der Per-Scan-Autorisierungsschranke, und ein Fehler hier würde die gesamte Geschichte des verantwortungsvollen Einsatzes untergraben. Wir arbeiten an:

- Wie ein CI-Token Autorisierung bestätigen kann, ohne ein langlebiges Geheimnis in Ihrem CI-Anbieter zu sein.
- Wie wir Deployment-Previews handhaben, bei denen die URL pro Pull Request wechselt.
- Wie wir sicher fehlschlagen, wenn der CI-Anbieter das Blocken anhand eines Check-Status nicht unterstützt.

Wir liefern dies lieber einmal richtig als zweimal.

## Werden Sie Beta-Tester

Wenn Sie frühen Zugang wünschen, melden Sie sich unten an. Wir melden uns, sobald die API stabil genug ist, um sich darauf festzulegen.

> **Beta-Anmeldung:** E-Mail an `recon-beta@` Ihre Workspace-Domain, oder öffnen Sie das Recon → Einstellungen → CI-Panel und klicken Sie auf **Der CI-Beta-Warteliste beitreten**.

Wir priorisieren Teams, die:

- Bereits in ephemere Preview-Umgebungen pro Pull Request deployen.
- Ein internes Security- oder Plattform-Team haben, das die Integration überprüfen kann.
- Bereit sind, während der Beta wöchentliches Feedback zu geben.

## In der Zwischenzeit

- Verwenden Sie den [Schnellstart](quickstart.md), um Scans nach großen Deployments manuell zu starten.
- Verwenden Sie den [teilbaren Berichts-Link](reading-reports.md#einen-bericht-teilen), um Ergebnisse an Engineers zu senden, ohne ihnen Workspace-Zugang zu geben.
- Verwenden Sie das [Credit-Limit pro Scan](quotas.md#credit-limit-pro-scan), um die Kosten in geschäftigen Wochen zu kontrollieren.

---

Verwandt:

- [Schnellstart](quickstart.md)
- [Verantwortungsvoller Einsatz](responsible-use.md)
- [Berichte lesen](reading-reports.md)
