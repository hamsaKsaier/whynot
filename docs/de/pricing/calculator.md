---
title: "Credit-Rechner"
description: "Schaetzen Sie Ihren monatlichen Credit-Verbrauch und finden Sie den passenden Tarif mit Beispielszenarien und Optimierungstipps."
lang: de
draft: false
---

# Credit-Rechner

## So nutzen Sie den Credit-Rechner

Der Credit-Rechner hilft Ihnen dabei, Ihren voraussichtlichen Credit-Verbrauch zu schaetzen und das passende Paket zu finden. Geben Sie einfach die Anzahl der geplanten Operationen pro Monat ein -- der Rechner ermittelt automatisch die benoetigten Credits und die damit verbundenen Kosten.

### Schritt-fuer-Schritt-Anleitung

1. **Navigieren Sie zum Credit-Rechner** unter **Preise > Credit-Rechner** auf der WhyNot-Website.
2. **Geben Sie Ihre geschaetzte monatliche Nutzung ein** fuer jede Operationsart:
   - Testgenerierungen pro Monat
   - Testausfuehrungen pro Monat
   - QA-Schleifen pro Monat
   - Auto-Fix-Ausfuehrungen pro Monat
   - Visuelle Regressionstests pro Monat
   - QA-Monitor-Zyklen pro Monat
   - CI-Scans pro Monat
3. **Pruefen Sie die Ergebnisse.** Der Rechner zeigt Ihnen:
   - Gesamtbedarf an Credits pro Monat
   - Empfohlener Tarif
   - Empfohlenes Credit-Paket (falls zusaetzliche Credits benoetigt werden)
   - Geschaetzte monatliche Gesamtkosten
4. **Passen Sie die Werte an**, um verschiedene Nutzungsszenarien durchzuspielen.

### Referenz: Credit-Kosten pro Operation

| Operation | Credits |
|-----------|---------|
| Testgenerierung | 50 |
| Testausfuehrung | 10 |
| QA-Schleife | 30 |
| Auto-Fix | 100 |
| Visuelle Regression | 15 |
| QA-Monitor (pro Zyklus) | 200 |
| CI-Scan (pro Durchlauf) | 200 |

---

## Beispielszenarien

Die folgenden drei Szenarien veranschaulichen typische Nutzungsmuster fuer Teams unterschiedlicher Groesse. Alle Berechnungen basieren auf Durchschnittswerten und dienen als Orientierungshilfe.

---

### Szenario 1: Kleines Team (5 Entwickler)

**Profil:** Ein Startup oder kleines Entwicklerteam, das WhyNot fuer grundlegende Testautomatisierung einsetzt.

**Geschaetzte monatliche Nutzung:**

| Operation | Anzahl/Monat | Credits/Operation | Credits gesamt |
|-----------|-------------|-------------------|----------------|
| Testgenerierung | 40 | 50 | 2.000 |
| Testausfuehrung | 200 | 10 | 2.000 |
| QA-Schleife | 20 | 30 | 600 |
| Auto-Fix | 10 | 100 | 1.000 |
| Visuelle Regression | 30 | 15 | 450 |
| QA-Monitor | 0 | 200 | 0 |
| CI-Scan | 20 | 200 | 4.000 |
| **Gesamt** | | | **10.050** |

**Empfehlung:**

- **Tarif:** Pro BYO ($29/Monat) -- beinhaltet 2.000 Credits
- **Zusaetzliche Credits benoetigt:** 8.050 Credits
- **Credit-Paket:** 1x Growth (10.000 Credits / $80)
- **Geschaetzte monatliche Kosten:** $29 + $80 = **$109/Monat**
- **Pro Entwickler:** ca. $21,80/Monat

**Hinweis:** Bei jaehrlicher Abrechnung des Tarifs reduzieren sich die Tarifkosten auf $23,20/Monat, was zu Gesamtkosten von ca. $103,20/Monat fuehrt.

---

### Szenario 2: Mittelgrosses Team (20 Entwickler)

**Profil:** Ein etabliertes Entwicklerteam mit regelmaessigen Release-Zyklen und umfassender Testabdeckung.

**Geschaetzte monatliche Nutzung:**

| Operation | Anzahl/Monat | Credits/Operation | Credits gesamt |
|-----------|-------------|-------------------|----------------|
| Testgenerierung | 150 | 50 | 7.500 |
| Testausfuehrung | 1.000 | 10 | 10.000 |
| QA-Schleife | 80 | 30 | 2.400 |
| Auto-Fix | 40 | 100 | 4.000 |
| Visuelle Regression | 100 | 15 | 1.500 |
| QA-Monitor | 10 | 200 | 2.000 |
| CI-Scan | 60 | 200 | 12.000 |
| **Gesamt** | | | **39.400** |

**Empfehlung:**

- **Tarif:** Pro Managed ($49/Monat) -- beinhaltet 5.000 Credits, unbegrenzte QA-Monitore und CI-Scans
- **Zusaetzliche Credits benoetigt:** 34.400 Credits
- **Credit-Paket:** 4x Growth (40.000 Credits / $320) -- ausreichend fuer die meisten Monate; bei hoeherem Verbrauch ein zusaetzliches Growth-Paket
- **Geschaetzte monatliche Kosten:** $49 + $320 = **$369/Monat**
- **Pro Entwickler:** ca. $18,45/Monat

**Alternative:** Wenn Sie regelmaessig mehr als 39.000 Credits pro Monat benoetigen, lohnt sich das Scale-Paket (100.000 Credits / $600). Die monatlichen Kosten laegen dann bei $49 + $600 = $649, bieten aber ausreichend Reserve fuer Spitzenmonate. Pro Entwickler waeren das ca. $32,45/Monat -- dafuer mit deutlich mehr Puffer.

---

### Szenario 3: Grosses Team (50+ Entwickler)

**Profil:** Ein Enterprise-Team mit umfangreicher CI/CD-Integration, kontinuierlicher QA-Ueberwachung und hohem Testaufkommen.

**Geschaetzte monatliche Nutzung:**

| Operation | Anzahl/Monat | Credits/Operation | Credits gesamt |
|-----------|-------------|-------------------|----------------|
| Testgenerierung | 500 | 50 | 25.000 |
| Testausfuehrung | 5.000 | 10 | 50.000 |
| QA-Schleife | 200 | 30 | 6.000 |
| Auto-Fix | 150 | 100 | 15.000 |
| Visuelle Regression | 300 | 15 | 4.500 |
| QA-Monitor | 50 | 200 | 10.000 |
| CI-Scan | 150 | 200 | 30.000 |
| **Gesamt** | | | **140.500** |

**Empfehlung:**

- **Tarif:** Pro Managed ($49/Monat) -- beinhaltet 5.000 Credits
- **Zusaetzliche Credits benoetigt:** 135.500 Credits
- **Credit-Paket:** 2x Scale (200.000 Credits / $1.200) -- deckt den Bedarf mit Reserve ab
- **Geschaetzte monatliche Kosten:** $49 + $1.200 = **$1.249/Monat**
- **Pro Entwickler:** ca. $24,98/Monat

**Hinweis:** Bei einem Verbrauch von mehr als 100.000 Credits pro Monat empfehlen wir, unser Vertriebsteam zu kontaktieren. Wir bieten individuelle Enterprise-Vereinbarungen mit Mengenrabatten an, die ueber das Scale-Paket hinausgehen.

---

## Tipps zur Optimierung Ihres Credit-Verbrauchs

### 1. Testgenerierung gezielt einsetzen

Testgenerierungen (50 Credits) sind deutlich teurer als Testausfuehrungen (10 Credits). Generieren Sie Tests einmal und fuehren Sie diese dann wiederholt aus, anstatt Tests bei jedem Durchlauf neu zu generieren. Bei 5 Entwicklern, die jeweils 10 Tests generieren und 10-mal ausfuehren, sparen Sie so 2.000 Credits pro Monat gegenueber einer Neugenerierung bei jedem Durchlauf.

### 2. Auto-Fix bewusst verwenden

Auto-Fix ist mit 100 Credits pro Ausfuehrung die zweitteuerste Operation. Pruefen Sie einfache Fehler manuell und reservieren Sie Auto-Fix fuer komplexe Probleme, bei denen die automatische Korrektur tatsaechlich Entwicklerzeit spart.

### 3. QA-Monitor-Intervalle anpassen

Jeder QA-Monitor-Zyklus verbraucht 200 Credits. Ueberpruefen Sie, ob die Ueberwachungsfrequenz Ihrem tatsaechlichen Bedarf entspricht. Nicht jeder Endpunkt muss alle 5 Minuten ueberprueft werden -- fuer viele Anwendungsfaelle reicht ein 30-Minuten- oder Stunden-Intervall.

### 4. CI-Scans optimieren

CI-Scans (200 Credits pro Durchlauf) koennen bei haeufigen Commits schnell ins Gewicht fallen. Erwaegen Sie:

- CI-Scans nur auf Pull-Requests auszufuehren (nicht auf jeden Commit)
- Feature-Branches von vollstaendigen Scans auszunehmen
- Scans auf kritische Pfade zu beschraenken

### 5. Das richtige Credit-Paket waehlen

Analysieren Sie Ihren Verbrauch der letzten 2--3 Monate, bevor Sie ein Paket waehlen. Ein zu kleines Paket bedeutet hoehere Kosten pro Credit, ein zu grosses Paket birgt das Risiko, dass Credits verfallen. Als Faustregel: Waehlen Sie ein Paket, das Ihren durchschnittlichen Monatsbedarf um 10--20 % uebersteigt.

### 6. Jaehrliche Abrechnung nutzen

Wenn Sie sicher sind, dass Sie WhyNot langfristig einsetzen, sparen Sie mit jaehrlicher Abrechnung 20 % auf Ihre Tarifkosten. Bei einem Pro-Managed-Tarif sind das $117,60 Ersparnis pro Jahr.

### 7. Verbrauchsberichte regelmaessig pruefen

Unter **Einstellungen > Abrechnung > Credits > Verbrauchshistorie** koennen Sie Ihren Verbrauch nach Operationstyp und Zeitraum analysieren. Nutzen Sie diese Daten, um:

- Ungewoehnlich hohen Verbrauch fruehzeitig zu erkennen
- Optimierungspotenziale zu identifizieren
- Die Paketgroesse fuer den naechsten Monat anzupassen

---

## Zusammenfassung

| Team-Groesse | Credits/Monat | Empfohlener Tarif | Credit-Paket | Kosten/Monat | Kosten/Entwickler |
|--------------|--------------|-------------------|--------------|--------------|-------------------|
| 5 Entwickler | ca. 10.000 | Pro BYO | 1x Growth | ca. $109 | ca. $21,80 |
| 20 Entwickler | ca. 39.400 | Pro Managed | 4x Growth | ca. $369 | ca. $18,45 |
| 50+ Entwickler | ca. 140.500 | Pro Managed | 2x Scale | ca. $1.249 | ca. $24,98 |

Der Credit-Rechner steht Ihnen jederzeit zur Verfuegung, um Ihre individuellen Szenarien durchzurechnen. Fuer Enterprise-Anfragen wenden Sie sich bitte an sales@whynot.com.
