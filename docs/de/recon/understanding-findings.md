---
title: "Recon — Funde verstehen"
description: "Schweregrad-Rubrik, Semantik der Exploit-Ergebnisse und Fehlalarm-Politik für Recon-Funde."
lang: de
draft: false
---

# Funde verstehen

Ein Recon-Scan produziert null oder mehr **Funde**. Jeder Fund repräsentiert ein bestätigtes oder vermutetes Sicherheitsproblem am Ziel, nach Schweregrad bewertet und mit einem reproduzierbaren Proof-of-Concept versehen.

Diese Seite erklärt, wie man einen Fund liest: was die Schweregrad-Labels bedeuten, was das Exploit-Ergebnis-Feld aussagt und wie Recon entscheidet, was in einen Bericht aufgenommen wird.

---

## Anatomie eines Fundes

Jeder Fund hat folgende Felder:

| Feld | Bedeutung |
|------|-----------|
| **Titel** | Eine kurze Zusammenfassung des Problems. |
| **Schweregrad** | Kritisch, Hoch, Mittel, Niedrig oder Info. Siehe Rubrik unten. |
| **Schwachstellenklasse** | Die Kategorie — SQL-Injection, reflektiertes XSS, SSRF, gebrochene Zugriffskontrolle usw. |
| **Ziel** | Der Endpunkt oder die Oberfläche, an der das Problem gefunden wurde. |
| **Proof-of-Concept** | Ein reproduzierbares Artefakt (Anfrage, Befehl oder Skript), das das Problem demonstriert. |
| **Exploit-Ergebnis** | Was der Proof-of-Concept tatsächlich erreicht hat. Siehe unten. |
| **Empfohlene Behebung** | Eine konkrete Korrektur, kein generischer Hinweis auf „sichere Programmierpraktiken". |
| **Konfidenz** | Hoch, Mittel oder Niedrig — wie sicher Recon ist, dass dies ein echtes Problem ist. |
| **Erstmals / Zuletzt gesehen** | Zeitstempel über Scans hinweg. Re-Scan aktualisiert sie. |

## Schweregrad-Rubrik

Recon verwendet eine fünfstufige Rubrik. Der Schweregrad wird aus drei Eingaben berechnet: technische Auswirkung, Ausnutzbarkeit und Menge der freigelegten sensiblen Daten oder privilegierten Aktionen.

### Kritisch

Das Problem ermöglicht es einem entfernten, nicht authentifizierten Angreifer, eines der folgenden zu erreichen:

- Ausführung beliebigen Codes auf dem Ziel.
- Lesen oder Ändern beliebiger Produktionsdaten.
- Übernahme der Identität eines anderen Benutzers ohne dessen Mitwirkung.
- Umgehung einer zentralen Sicherheitskontrolle (Authentifizierung, Abrechnung, Mandantentrennung) mit einer einzigen Anfrage.

Kritische Funde sollten als Vorfälle behandelt werden. Gehen Sie davon aus, dass eine Ausnutzung unmittelbar bevorsteht.

### Hoch

Das Problem ermöglicht Privilegienerhöhung, unautorisierten Datenzugriff oder Umgehung einer Sicherheitskontrolle, erfordert aber mindestens eines der folgenden:

- Ein gültiges Konto mit niedrigen Privilegien.
- Benutzerinteraktion (z. B. Klick auf einen präparierten Link).
- Mehrere verkettete Anfragen.

Hohe Funde sollten innerhalb von Tagen, nicht Wochen behoben werden.

### Mittel

Das Problem legt sensible Informationen offen, schwächt eine Sicherheitskontrolle oder ermöglicht einen Angriff, der erheblichen zusätzlichen Aufwand erfordert (z. B. einen verketteten Exploit oder ein gestohlenes Sitzungstoken). Mittlere Funde sollten im nächsten Release-Zyklus behoben werden.

### Niedrig

Das Problem ist eine Härtungslücke oder eine schwache Verteidigungsschicht in der Tiefe. Es isoliert auszunutzen bringt wenig. Beispiele: fehlende Sicherheits-Header, ausführliche Fehlermeldungen, veraltete Server-Banner.

### Info

Das Problem ist keine Schwachstelle, sondern ein Stück Angriffsflächen-Kontext, den Sie kennen sollten: ein freigelegtes Admin-Panel, eine von Suchmaschinen indexierte Staging-Domain, eine Subdomain, die nicht öffentlich sein sollte.

## Exploit-Ergebnisse

Jeder Fund in einem Bericht wird durch einen konkreten Exploit-Versuch gestützt. Das Feld **Exploit-Ergebnis** sagt Ihnen, was dieser Versuch tatsächlich getan hat:

| Ergebnis | Bedeutung |
|----------|-----------|
| **Lesen-bestätigt** | Ein nicht-zerstörerischer Proof-of-Concept war erfolgreich: Daten wurden gelesen, ein Marker wurde zurückgegeben oder ein Fehler hat Informationen geleakt. Sicher zu wiederholen. |
| **Schreiben-bestätigt** | Eine zerstörerische Payload war erfolgreich: Zustand wurde geändert, ein Datensatz erstellt, aktualisiert oder gelöscht. Recon führt Schreibklasse-Exploits genau einmal pro Scan aus und wiederholt sie nie (siehe [Verantwortungsvoller Einsatz](responsible-use.md)). |
| **Schreiben-versucht, Ergebnis unbekannt** | Eine zerstörerische Payload wurde gesendet, aber die Antwort hat Erfolg oder Misserfolg nicht eindeutig angezeigt. Behandeln Sie es als vermutete Schwachstelle und verifizieren Sie manuell. |
| **Lesen-versucht, ergebnislos** | Eine nicht-zerstörerische Sonde lief, aber die Beweise sind mehrdeutig. Wird üblicherweise auf Info heruntergestuft oder unterdrückt. |

## Kein Exploit, kein Bericht

Recon folgt einer strikten **„kein Exploit, kein Bericht"**-Politik. Ein Fund erscheint im Bericht **nur**, wenn er einen nicht-leeren, exakt reproduzierbaren `proof_of_concept` hat. Wenn eine Sonde kein funktionierendes Artefakt erzeugen konnte, wird der Fund entweder unterdrückt oder als Info ohne Berichtseintrag veröffentlicht.

Das ist beabsichtigt. Ein Bericht voller „vermutete SQL-Injection"-Einträge, die Sie nicht reproduzieren können, ist schlimmer als kein Bericht, weil er Triage-Zeit verschwendet und Vertrauen untergräbt. Wenn Recon einen Fund liefert, können Sie ihn reproduzieren.

## Fehlalarm-Politik

Ein Fehlalarm ist ein Fund, der für die automatisierte Pipeline echt aussah, aber tatsächlich nicht ausnutzbar ist. Die Recon-Pipeline hat drei Schutzmechanismen gegen Fehlalarme:

1. **Aktive Bestätigung.** Jeder gemeldete Fund enthält einen Proof-of-Concept, der tatsächlich ausgeführt wurde und das behauptete Ergebnis nachweislich produziert hat.
2. **Konfidenz-Kennzeichnung.** Funde, bei denen die Bestätigung gelang, der Kontext aber mehrdeutig ist, werden mit Konfidenz `medium` oder `low` gekennzeichnet und mit einem Hinweis versehen.
3. **Benutzer-Verwerfung.** Sie können jeden Fund mit einem Grund verwerfen: `false_positive`, `accepted_risk`, `duplicate` oder `out_of_scope`. Verworfene Funde zählen nicht in Schweregrad-Aggregaten und werden im Diff des nächsten Scans unterdrückt, sofern sich die zugrunde liegenden Beweise nicht ändern.

Wenn Sie einen Fehlalarm finden, den die Pipeline hätte fangen sollen, verwenden Sie den Link **Fehlalarm melden** auf der Fund-Karte. Wir nutzen diese Meldungen zur Verbesserung der Konfidenz-Bewertung.

## Re-Scans und Diffs

Beim erneuten Scan desselben Ziels:

- Funde, die noch vorhanden sind, aktualisieren ihren `last_seen`-Zeitstempel.
- Funde, die zuvor vorhanden waren und nun fehlen, werden als **behoben** markiert.
- Neue Funde erscheinen mit einem `new`-Abzeichen.

So verifizieren Sie, dass eine Behebung tatsächlich angekommen ist. Ein Bericht, in dem ein zuvor kritischer Fund jetzt als **behoben** markiert ist, ist die nützlichste einzelne Ausgabe, die Recon produzieren kann.

---

Verwandt:

- [Berichte lesen](reading-reports.md) — Berichtsstruktur, Teilen, PDF-Export.
- [Beispielbericht](sample-report.md) — ein redigiertes Beispiel.
- [Verantwortungsvoller Einsatz](responsible-use.md) — warum Schreibklasse-Exploits nie wiederholt werden.
