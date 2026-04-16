# KI-Konfiguration für Benutzer

Dieser Leitfaden erklärt, wie die KI-Anbietereinstellungen aus Benutzersicht funktionieren, einschließlich Abonnementstufen, Schlüsselverwaltung und Plattform-Schlüssel-Fallback.

## Abonnementstufen

WhyNot QA bietet zwei Abonnementstufen, die den Zugriff auf KI-Anbieter bestimmen:

### Eigene Schlüssel mitbringen (`byo_keys`)

Pläne: **Kostenlos**, **Pro (BYO)**

- Benutzer **müssen** eigene API-Schlüssel bereitstellen, um KI-Funktionen zu nutzen
- Kein Zugriff auf plattformverwaltete Schlüssel
- Benutzer konfigurieren Anbieter unter **Einstellungen → KI**
- Schlüssel werden mit AES-256-GCM verschlüsselt gespeichert

### Verwaltet + Nutzungsbasiert (`managed_payg`)

Pläne: **Pro (Verwaltet + PAYG)**

- Die Plattform stellt vorkonfigurierte KI-Schlüssel bereit — keine Einrichtung erforderlich
- Benutzer werden nutzungsbasiert abgerechnet
- Benutzer **können optional** eigene Schlüssel für benutzerdefinierten Zugang hinzufügen
- Wenn ein Benutzer einen eigenen Schlüssel konfiguriert hat, hat dieser Vorrang vor Plattformschlüsseln

## Wie die Anbieterauswahl funktioniert

1. Das System prüft zunächst, ob der Benutzer einen persönlichen API-Schlüssel konfiguriert hat
2. Wenn ein persönlicher Schlüssel existiert und als Standard gesetzt ist, wird er verwendet
3. Wenn kein persönlicher Schlüssel existiert und der Benutzer einen `managed_payg`-Plan hat, wird der Standard-Anbieter der Plattform verwendet
4. Wenn kein persönlicher Schlüssel existiert und der Benutzer einen `byo_keys`-Plan hat, sind KI-Funktionen nicht verfügbar

## Vom Administrator konfigurierte Anbieter

Die Liste der verfügbaren Anbieter wird vom Plattformadministrator unter **Admin → KI-Anbieter** gesteuert. Nur vom Administrator aktivierte Anbieter erscheinen im Dropdown des Benutzers.

Die Option `Benutzerdefiniert (OpenAI-kompatibel)` ist immer verfügbar.

## Einstellungen-Tab (`Einstellungen → KI`)

### Für `byo_keys`-Benutzer

- Ein Banner erklärt, dass API-Schlüssel erforderlich sind
- Wenn keine Schlüssel konfiguriert sind, wird zur Hinzufügung aufgefordert

### Für `managed_payg`-Benutzer

- Ein Banner zeigt an, dass verwalteter KI-Zugang im Plan enthalten ist
- Wenn keine persönlichen Schlüssel konfiguriert sind, wird der aktuelle Plattform-Standard angezeigt

### Einen Anbieterschlüssel hinzufügen

1. Klicken Sie auf **Anbieter hinzufügen**
2. Wählen Sie einen Anbieter aus der Liste
3. Wählen Sie ein Modell
4. Für „Benutzerdefiniert" geben Sie die Basis-URL ein
5. Geben Sie den API-Schlüssel ein
6. Klicken Sie auf **Speichern**
