---
title: "Recon — Berichte lesen"
description: "Berichtsstruktur, Teilen und PDF-Export für Recon-Scan-Ergebnisse."
lang: de
draft: false
---

# Berichte lesen

Ein Recon-Bericht ist die menschenlesbare Ausgabe eines Scans. Er ist so organisiert, dass er drei Zielgruppen im selben Dokument dient: einem Engineer, der das Problem beheben muss, einem Security-Reviewer, der es validieren muss, und einer Führungskraft, die das Schadenspotenzial kennen muss.

Diese Seite erklärt die Berichtsstruktur, wie er geteilt und als PDF exportiert wird.

---

## Wo Sie Berichte finden

Jeder Scan produziert einen Bericht, der unmittelbar nach Abschluss verfügbar ist.

- Klicken Sie auf der Recon-Startseite auf eine Scan-Zeile, um die Detailseite zu öffnen.
- Auf der Scan-Detailseite rendert der Tab **Bericht** den vollständigen Bericht inline.
- Jeder Scan hat zudem eine stabile URL — Sie können sie teilen (vorbehaltlich der Berechtigungen unten).

## Berichtsstruktur

Ein Bericht hat sechs Abschnitte, immer in dieser Reihenfolge:

### 1. Zusammenfassung

Ein Absatz für Führungs-Leser. Nennt das Ziel, den Umfang, die Gesamtzahl der Funde nach Schweregrad und die wichtigste Einzelaussage („Ein kritischer Fund wurde bestätigt." oder „Keine ausnutzbaren Funde.").

### 2. Risiko-Überblick

Eine Tabelle der Fund-Anzahlen nach Schweregrad, mit Vergleich zum vorherigen Scan desselben Ziels, falls vorhanden.

| Schweregrad | Dieser Scan | Vorheriger Scan | Veränderung |
|-------------|-------------|------------------|-------------|
| Kritisch | 1 | 0 | +1 |
| Hoch | 3 | 5 | -2 |
| Mittel | 7 | 6 | +1 |
| Niedrig | 12 | 14 | -2 |
| Info | 22 | 19 | +3 |

Die Veränderungs-Spalte ist der beste einzelne Indikator dafür, ob die Behebung wirkt.

### 3. Funde

Jeder Fund wird als vollständige Karte gerendert mit:

- Titel und Schweregrad-Abzeichen.
- Ziel (Endpunkt, Parameter oder Oberfläche).
- Schwachstellenklasse.
- **Was passiert ist** — eine verständliche Beschreibung.
- **Proof-of-Concept** — das reproduzierbare Artefakt mit Syntaxhervorhebung.
- **Exploit-Ergebnis** — Lesen-bestätigt, Schreiben-bestätigt usw. Siehe [Funde verstehen](understanding-findings.md).
- **Warum es wichtig ist** — die reale Auswirkung.
- **Empfohlene Behebung** — eine spezifische, umsetzbare Korrektur.
- **Referenzen** — Links zu CWE, OWASP und Anbieter-Hinweisen, sofern relevant.

Funde werden absteigend nach Schweregrad und dann absteigend nach Konfidenz sortiert.

### 4. Umfang und Methodik

Listet auf, was gescannt wurde (URLs, entdeckte Endpunkte, getestete Parameter), was ausdrücklich außerhalb des Umfangs lag, die Autorisierungsreferenz und die Umfangsstufe (Oberfläche, Standard, Tiefe).

### 5. Abdeckungslücken

Offene Offenlegung dessen, was der Scan nicht erreicht hat: Endpunkte, die Authentifizierung erforderten, die Recon nicht hatte, durch WAF-Regeln blockierte Endpunkte, Bereiche, in denen das Crawl-Budget aufgebraucht war. Ein Scan, der seine Lücken nicht offenlegt, verkauft sich zu hoch.

### 6. Audit-Spur

Der Autorisierungseintrag (wer, wann, welches Ziel, welche Referenz), die Start- und End-Zeitstempel des Scans und ein einzeiliger Provenienz-Eintrag für jede Phase.

## Einen Bericht teilen

Es gibt drei Wege, einen Bericht zu teilen:

### Workspace-Mitglieder

Jedes Workspace-Mitglied mit der Berechtigung `recon.scan.view` kann den Bericht direkt öffnen. Keine zusätzliche Aktion nötig.

### Teilbarer Link (extern)

Generieren Sie einen zeitlich begrenzten Nur-Lese-Link für einen Reviewer, der nicht Workspace-Mitglied ist.

1. Öffnen Sie die Scan-Detailseite.
2. Klicken Sie im Header auf **Teilen**.
3. Wählen Sie ein Ablaufdatum (24 Stunden, 7 Tage oder 30 Tage) und optional eine Passphrase.
4. Kopieren Sie den Link und senden Sie ihn.

Externe Betrachter sehen eine bereinigte Ansicht: den Berichtsinhalt, aber keine Workspace-Navigation, Abrechnungsdaten oder andere Scans. Sie können weder einen Re-Scan auslösen noch etwas ändern.

### PDF-Export

Klicken Sie im Berichts-Header auf **PDF exportieren**. Recon rendert den Bericht in PDF mit derselben Vorlage wie die Web-Ansicht. Das PDF:

- Enthält jeden obigen Abschnitt.
- Bettet Proof-of-Concepts als formatierte Code-Blöcke ein.
- Ist mit einem wiederholten Header (Scan-Name, Ziel, Datum) paginiert.
- Eignet sich zum Anhängen an ein Audit-Ticket oder zum Versand an eine Führungskraft.

Der PDF-Export wird auf Anfrage erzeugt und nicht zwischengespeichert — ein erneuter Export nach einem Re-Scan greift die neuesten Daten ab.

## Berechtigungs-Übersicht

| Aktion | Erforderliche Berechtigung |
|--------|----------------------------|
| Bericht im Workspace ansehen | `recon.scan.view` |
| Teilbaren Link erstellen | `recon.scan.share` |
| Als PDF exportieren | `recon.scan.view` |
| Teilbaren Link widerrufen | `recon.scan.share` oder Workspace-Eigentümer |
| Scan und Bericht löschen | Workspace-Eigentümer |

## Aufbewahrung

Berichte werden für das volle Datenaufbewahrungsfenster Ihres Plans aufbewahrt (siehe [Kontingente](quotas.md) — Free: 7 Tage, Pro BYO: 30 Tage, Pro Managed: 90 Tage). Nach Ablauf wird der Bericht gelöscht; die Audit-Log-Zeile der Autorisierung bleibt für die Lebensdauer des Workspace erhalten.

## Wann erneut scannen

Scannen Sie erneut, wenn:

- Sie glauben, mindestens einen Fund behoben zu haben. Der Diff in Abschnitt 2 ist die Verifikation.
- Das Ziel sich substanziell geändert hat (neue Endpunkte, neues Auth-Modell).
- Mehr als 30 Tage seit dem letzten Scan eines kritischen Ziels vergangen sind.

Scannen Sie nicht erneut, nur um den Bericht aufzurühren. Jeder Scan kostet Credits (siehe [Kontingente](quotas.md)) und jeder Scan erfasst einen neuen Autorisierungseintrag.

---

Verwandt:

- [Funde verstehen](understanding-findings.md) — Schweregrad-Rubrik und Exploit-Ergebnisse.
- [Beispielbericht](sample-report.md) — ein redigiertes Beispiel.
- [Kontingente und Abrechnung](quotas.md) — wie viel ein Re-Scan kostet.
