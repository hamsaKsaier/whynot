# Pay-as-you-go Credits

## Ueberblick

Das Pay-as-you-go-Modell ermoeglicht es Ihnen, zusaetzliche Credits ueber Ihr Tarif-Kontingent hinaus zu erwerben. Credits sind die Waehrung fuer alle Operationen auf der WhyNot-Plattform. Jede Operation verbraucht eine bestimmte Anzahl an Credits, abhaengig von der Komplexitaet und den benoetigten Ressourcen.

---

## Credit-Kosten pro Operation

Jede Operation auf der Plattform hat einen festen Credit-Preis:

| Operation | Credits pro Ausfuehrung | Beschreibung |
|-----------|------------------------|--------------|
| **Testgenerierung** | 50 | Automatische Erstellung eines Testfalls basierend auf Ihrem Code |
| **Testausfuehrung** | 10 | Ausfuehrung eines einzelnen Testfalls |
| **QA-Schleife** | 30 | Vollstaendiger QA-Durchlauf mit Analyse und Bericht |
| **Auto-Fix** | 100 | Automatische Fehlerbehebung mit Code-Aenderungsvorschlag |
| **Visuelle Regression** | 15 | Visueller Vergleich zweier Seitenzustaende (Screenshot-Diff) |
| **QA-Monitor** | 200 | Kontinuierliche QA-Ueberwachung eines Endpunkts (pro Pruefzyklus) |
| **CI-Scan** | 200 | Vollstaendiger Scan im Rahmen Ihrer CI/CD-Pipeline (pro Durchlauf) |

### Rechenbeispiele

- **10 Tests generieren und ausfuehren:** 10 x 50 (Generierung) + 10 x 10 (Ausfuehrung) = 600 Credits
- **5 QA-Schleifen mit Auto-Fix:** 5 x 30 (QA-Schleife) + 5 x 100 (Auto-Fix) = 650 Credits
- **Taeglicher CI-Scan (30 Tage):** 30 x 200 = 6.000 Credits

---

## Credit-Pakete

Credits koennen in drei Paketgroessen erworben werden. Groessere Pakete bieten einen besseren Preis pro Credit:

| Paket | Credits | Preis | Preis pro Credit | Ersparnis |
|-------|---------|-------|-------------------|-----------|
| **Starter** | 1.000 | $10 | $0,0100 | -- |
| **Growth** | 10.000 | $80 | $0,0080 | 20 % |
| **Scale** | 100.000 | $600 | $0,0060 | 40 % |

### Welches Paket ist das richtige fuer Sie?

**Starter (1.000 Credits / $10):**
Geeignet fuer gelegentliche Nutzung oder zum Testen der Pay-as-you-go-Funktion. Ideal, wenn Sie den Free-Tarif nutzen und gelegentlich zusaetzliche Kapazitaet benoetigen.

**Growth (10.000 Credits / $80):**
Die beste Wahl fuer kleine bis mittelgrosse Teams mit regelmaessigem Verbrauch. Sie sparen 20 % gegenueber dem Starter-Paket und erhalten genuegend Credits fuer etwa 200 Testgenerierungen oder 1.000 Testausfuehrungen.

**Scale (100.000 Credits / $600):**
Optimal fuer groessere Teams oder Unternehmen mit hohem Testaufkommen. Sie sparen 40 % gegenueber dem Starter-Paket. Dieses Paket eignet sich besonders, wenn Sie regelmaessig CI-Scans und QA-Monitore einsetzen.

---

## So funktionieren Credits

### Credit-Verbrauch

1. **Tarif-Credits werden zuerst verbraucht.** Wenn Ihr Tarif monatliche Credits beinhaltet, werden diese vorrangig genutzt.
2. **Pay-as-you-go-Credits greifen automatisch.** Sobald Ihre Tarif-Credits aufgebraucht sind, werden gekaufte Credits verwendet.
3. **Mehrere Pakete werden der Reihe nach verbraucht.** Wenn Sie mehrere Pakete erworben haben, wird das aelteste Paket zuerst aufgebraucht (FIFO-Prinzip).

### Credit-Guthaben einsehen

Ihr aktuelles Credit-Guthaben koennen Sie jederzeit unter **Einstellungen > Abrechnung > Credits** einsehen. Dort finden Sie:

- Verbleibende Tarif-Credits fuer den aktuellen Monat
- Verbleibendes Pay-as-you-go-Guthaben
- Verbrauchshistorie der letzten 30 Tage
- Aufschluesselung nach Operationstyp

### Credits erwerben

1. Navigieren Sie zu **Einstellungen > Abrechnung > Credits**.
2. Waehlen Sie das gewuenschte Credit-Paket.
3. Bestaetigen Sie den Kauf mit Ihrer hinterlegten Zahlungsmethode.
4. Die Credits werden Ihrem Konto sofort gutgeschrieben.

---

## Haeufig gestellte Fragen

### Verfallen gekaufte Credits?

Ja. Gekaufte Credit-Pakete sind **12 Monate** ab Kaufdatum gueltig. Nach Ablauf dieser Frist verfallen nicht genutzte Credits. Tarif-Credits (die monatlich im Tarif enthalten sind) verfallen am Ende jedes Abrechnungszeitraums.

### Was passiert bei einer Ueberschreitung (Overage)?

Wenn sowohl Ihre Tarif-Credits als auch Ihre Pay-as-you-go-Credits aufgebraucht sind, werden die betroffenen Operationen **nicht automatisch ausgefuehrt**. Sie erhalten eine Benachrichtigung und koennen dann:

- Ein zusaetzliches Credit-Paket erwerben
- Auf den naechsten Abrechnungszeitraum warten (fuer neue Tarif-Credits)
- Ihren Tarif upgraden

Es entstehen **keine unerwarteten Kosten**. Operationen werden nur ausgefuehrt, wenn ausreichend Credits vorhanden sind.

### Kann ich Credits zwischen Konten uebertragen?

Nein. Credits sind an Ihr Konto gebunden und koennen nicht uebertragen werden.

### Werden Credits bei einem Tarifwechsel uebertragen?

Ja. Ihre gekauften Pay-as-you-go-Credits bleiben bei einem Tarifwechsel erhalten. Nicht verbrauchte Tarif-Credits des alten Tarifs verfallen jedoch beim Wechsel.

### Gibt es eine Erstattung fuer nicht genutzte Credits?

Nein. Erworbene Credit-Pakete sind nicht erstattungsfaehig. Wir empfehlen, zunaechst ein kleineres Paket zu erwerben, um Ihren Verbrauch einzuschaetzen.

### Kann ich einen automatischen Credit-Nachkauf einrichten?

Ja. Unter **Einstellungen > Abrechnung > Credits > Automatischer Nachkauf** koennen Sie einen Schwellenwert festlegen. Wenn Ihr Credit-Guthaben unter diesen Wert faellt, wird automatisch das von Ihnen gewaehlte Paket nachgekauft.

### Gibt es Mengenrabatte ueber das Scale-Paket hinaus?

Fuer Unternehmen mit einem Bedarf von mehr als 100.000 Credits pro Monat bieten wir individuelle Vereinbarungen an. Bitte kontaktieren Sie unser Vertriebsteam unter sales@whynot.com.

---

## Zusammenfassung der Credit-Kosten

| Operation | Credits | Im Starter-Paket ($10) | Im Growth-Paket ($80) | Im Scale-Paket ($600) |
|-----------|---------|------------------------|-----------------------|-----------------------|
| Testgenerierung | 50 | $0,50 | $0,40 | $0,30 |
| Testausfuehrung | 10 | $0,10 | $0,08 | $0,06 |
| QA-Schleife | 30 | $0,30 | $0,24 | $0,18 |
| Auto-Fix | 100 | $1,00 | $0,80 | $0,60 |
| Visuelle Regression | 15 | $0,15 | $0,12 | $0,09 |
| QA-Monitor | 200 | $2,00 | $1,60 | $1,20 |
| CI-Scan | 200 | $2,00 | $1,60 | $1,20 |
