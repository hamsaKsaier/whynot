---
title: "Recon — Autorisierung & verantwortungsvoller Einsatz"
description: "Per-Scan-Autorisierung, Audit-Log und rechtliche Pflichten beim Einsatz von Recon."
lang: de
draft: false
---

# Autorisierung & verantwortungsvoller Einsatz

Recon führt aktive Sonden gegen Web-Ziele aus. Unautorisierte Sondierung ist in nahezu jeder Rechtsordnung illegal, und Recon ist um eine **Per-Scan-Autorisierungsschranke** herum gestaltet, sodass Sie — die Person, die den Scan startet — bei jedem einzelnen Scan ausdrücklich die Verantwortung übernehmen.

Diese Seite erklärt, was diese Schranke ist, was das Audit-Log erfasst und wie das zugrunde liegende Recht aussieht.

---

## Die Per-Scan-Autorisierungsschranke

Jeder Scan benötigt vor der Einreihung in die Warteschlange einen signierten Autorisierungsblock. Das Gateway lehnt jede Scan-Anfrage ohne diesen Block ab.

Das Starten eines Scans erfasst:

- Den Benutzer, der ihn gestartet hat.
- Den Workspace, unter dem der Scan lief.
- Die exakte Ziel-URL (byte-identisch zur Eingabe).
- Die Umfangsstufe.
- Drei explizite Bestätigungen des Starters:
  1. „Ich bin berechtigt, dieses Ziel zu scannen."
  2. „Ich verstehe, dass dieser Scan aktive Sonden sendet."
  3. Die juristische Person, die der Starter vertritt.
- Eine optionale Referenz zur schriftlichen Autorisierung (Ticket-ID, E-Mail-Verlauf, Vertrag).
- Die IP-Adresse des Starters und den Zeitstempel.

Diese Zeile ist **unveränderlich**. Sie kann weder bearbeitet noch gelöscht werden und wird für die Lebensdauer des Workspace aufbewahrt.

Sie können jede jemals erfasste Autorisierung unter **Einstellungen → Recon → Audit-Log** überprüfen.

## Warum pro Scan, nicht pro Workspace

„Pro-Workspace"-Autorisierung — einmaliges Häkchen beim Setup — ist verbreitet, aber gefährlich schwach. Sie bedeutet, dass ein neues Teammitglied oder ein Operator Monate später einen Scan gegen das falsche Ziel starten könnte, ohne neue Bestätigung.

Per-Scan-Autorisierung erzwingt jedes Mal eine bewusste Handlung. Die Reibung ist das Feature.

## Wiederaufnahme erfordert URL-Übereinstimmung

Wenn ein Scan pausiert und fortgesetzt wird — manuell oder automatisch nach einem vorübergehenden Fehler —, vergleicht Recon die Ziel-URL der Wiederaufnahme **byteweise** mit der ursprünglich autorisierten URL. Jeder Unterschied (anderer Host, anderer Pfad, anderes Schema, sogar ein abschließender Schrägstrich) führt zur Ablehnung der Wiederaufnahme.

Das verhindert zwei reale Angriffsmuster:

- **Redirect-Drift.** DNS oder HTTP-Redirect des Ziels ändern sich zwischen Pause und Fortsetzung und lenken Sonden unbemerkt zu einem anderen Host.
- **Tippfehler-Drift.** Ein Operator bearbeitet die URL beim Troubleshooting und weitet den Umfang versehentlich aus.

Wenn eine Wiederaufnahme wegen URL-Diskrepanz abgelehnt wird, starten Sie einen neuen Scan mit einem neuen Autorisierungsblock.

## Schreibklasse-Exploits werden niemals automatisch wiederholt

Recon klassifiziert jeden Kandidaten-Exploit als `read` (nicht-zerstörerisch — liest Daten, beweist Existenz) oder `write` (zerstörerisch — verändert Zustand, erzeugt, löscht oder ändert). Ein fehlgeschlagener **read**-Exploit kann unter Raten- und Wiederholungsgrenzen erneut versucht werden. Ein fehlgeschlagener **write**-Exploit wird einmal protokolliert und innerhalb desselben Scans niemals wiederholt, selbst wenn der Executor abstürzt und fortsetzt.

Das ist eine bewusste Sicherheitseigenschaft: Eine zerstörerische Payload, die teilweise erfolgreich war, könnte das Ziel in einem unvollständigen oder beschädigten Zustand zurücklassen. Wiederholen könnte den Schaden vergrößern. Wenn der Fund neu verifiziert werden muss, starten Sie einen frischen Scan.

## Was Recon nicht tut

- Recon führt **keine** Denial-of-Service-Tests durch. Stresstests, volumetrische Angriffe und Ressourcen-Erschöpfungssonden sind außerhalb des Umfangs und können nicht aktiviert werden.
- Recon scannt **keine** Ziele, die Sie nicht ausdrücklich autorisieren. Es gibt keine „scanne meine ganze Organisation"-Schaltfläche.
- Recon speichert **keine** rohen Exploit-Payloads in Logs auf INFO-Ebene oder höher. Payload-förmige Strings werden vor der Protokollierung redigiert. Die vollständige Liste finden Sie in der internen Plattform-Dokumentation.

## Ihre rechtlichen Pflichten — verständliche Zusammenfassung

> **Dies ist eine verständliche Zusammenfassung, keine Rechtsberatung.** Im Zweifel konsultieren Sie einen auf Ihre Rechtsordnung spezialisierten Anwalt.

### USA — Computer Fraud and Abuse Act (CFAA)

Der CFAA (18 U.S.C. § 1030) macht den Zugriff auf einen Computer „ohne Autorisierung" oder das „Überschreiten autorisierten Zugriffs" zu einer Bundesstraftat. Im Recon-Kontext bedeutet das, dass Sie ausdrückliche Erlaubnis — von jemandem, der rechtlich befugt ist, sie zu erteilen — benötigen, um das Ziel zu scannen. Der Geltungsbereich eines Bug-Bounty-Programms, ein schriftlicher Pentest-Auftrag oder ein unterzeichneter Vertrag erfüllen das in der Regel. Ein Ziel zu scannen, weil Sie es „interessant fanden", reicht nicht.

### Europäische Union — NIS2 und nationale Entsprechungen

Die meisten EU-Mitgliedstaaten haben Strafnormen, die den CFAA spiegeln (z. B. § 202c StGB in Deutschland, Loi Godfrain in Frankreich, Art. 197 Código Penal in Spanien). Die NIS2-Richtlinie (EU 2022/2555) erlegt wesentlichen und wichtigen Einrichtungen zusätzliche Pflichten auf. Die Kurzfassung ist dieselbe wie beim CFAA: keine Autorisierung, kein Scan.

### Vereinigtes Königreich — Computer Misuse Act 1990

Die Abschnitte 1–3 stellen unautorisierten Zugriff, unautorisierten Zugriff mit Vorsatz und unautorisierte Modifikation unter Strafe. Strafen umfassen Freiheitsentzug. Das Gesetz gilt für Scans, die aus dem UK gestartet werden, und für Scans gegen UK-Systeme.

### Andere Rechtsordnungen

Die meisten Rechtsordnungen haben äquivalente Gesetze. Wenn Sie ein Ziel scannen, das mehrere Rechtsordnungen umfasst (z. B. ein EU-Rechenzentrum eines US-Unternehmens), gehen Sie davon aus, dass das strengste anwendbare Recht Ihr Verhalten bestimmt.

## Bug-Bounty-Programme

Wenn Sie Recon gegen ein Bug-Bounty-Ziel einsetzen:

- Bestätigen Sie, dass Ihre Aktivität im veröffentlichten Geltungsbereich des Programms liegt.
- Bestätigen Sie, dass aktive Sondierung erlaubt ist (manche Programme beschränken auf passives Testen).
- Fügen Sie die Autorisierungs-URL des Programms beim Scan-Start in das Feld für die schriftliche Autorisierungsreferenz ein.
- Speichern Sie den Audit-Log-Eintrag der Autorisierung — Sie könnten ihn vorlegen müssen, falls ein Fund bestritten wird.

## Rote Flaggen — nicht scannen

Starten Sie **keinen** Scan, wenn einer dieser Punkte zutrifft:

- Sie sind sich nicht sicher, wem das Ziel gehört.
- Ihre Autorisierung ist mündlich und undokumentiert.
- Sie scannen, um „mal zu sehen, was passiert".
- Das Ziel ist Live-Produktion und der Eigentümer hat aktiver Sondierung nicht ausdrücklich zugestimmt.
- Sie verstehen die Umfangsoptionen und ihre Auswirkungen nicht.

---

Verwandt:

- [Schnellstart](quickstart.md) — wie man einen Scan startet.
- [Funde verstehen](understanding-findings.md) — wie man Schweregrad und Exploit-Ergebnisse liest.
- [Fehlerbehebung](troubleshooting.md) — Autorisierungsfehler und ihre Bedeutung.
