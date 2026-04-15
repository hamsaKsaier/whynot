# Fehlerbehebung bei Zahlungen

Haeufige Probleme und Loesungen fuer die Stripe-Zahlungsintegration von WhyNot QA.

## Webhook-Probleme

### Webhooks werden nicht ausgeloest

**Symptome**: Abonnementstatus wird nach dem Checkout nicht aktualisiert, Rechnungen werden nicht erfasst.

**Loesungen**:
1. Stellen Sie sicher, dass `stripe listen` laeuft (lokale Entwicklung):
   ```bash
   stripe listen --forward-to localhost:3010/api/webhooks/stripe
   ```
2. Ueberpruefen Sie im Stripe-Dashboard unter **Developers > Webhooks** fehlgeschlagene Zustellungen.
3. Stellen Sie sicher, dass `STRIPE_WEBHOOK_SECRET` mit dem Signing-Secret von `stripe listen` oder dem Dashboard uebereinstimmt.
4. Stellen Sie sicher, dass der Gateway-Container laeuft: `docker ps | grep gateway`.

### Signaturverifizierung fehlgeschlagen (400)

**Symptome**: Webhook gibt `400 Signature verification failed` zurueck.

**Ursachen**:
- `STRIPE_WEBHOOK_SECRET` ist falsch oder gehoert zu einem anderen Endpoint.
- Der rohe Request-Body wurde vor dem Webhook-Handler geparst (der Body muss als Roh-Buffer ankommen).
- Zeitabweichung zwischen Ihrem Server und Stripe (die Signatur hat eine Zeittoleranz von ca. 5 Minuten).

**Loesungen**:
1. Generieren Sie das Webhook-Signing-Secret im Stripe-Dashboard neu.
2. Starten Sie fuer die lokale Entwicklung `stripe listen` neu und kopieren Sie das neue Secret.
3. Stellen Sie sicher, dass Ihr Reverse-Proxy den Request-Body nicht veraendert.

### Doppelte Webhook-Zustellungen

**Symptome**: Stripe wiederholt Webhooks mehrfach.

**Erklaerung**: Stripe wiederholt die Zustellung, wenn innerhalb von 20 Sekunden keine `2xx`-Antwort empfangen wird. Die Idempotenz-Tabelle (`payment_webhooks_idempotency`) verhindert doppelte Verarbeitung. Wenn Sie Wiederholungen im Stripe-Dashboard sehen, pruefen Sie:
1. Gateway-Logs auf Fehler waehrend der Webhook-Verarbeitung.
2. Datenbankkonnektivitaet (der Idempotenz-INSERT muss erfolgreich sein).
3. Antwortzeit (der Handler muss innerhalb von 20 Sekunden antworten).

## Kartenablehnungen

### Generische Kartenablehnung

**Fehler**: `billing.cardDeclined`

Die Karte wurde von der ausstellenden Bank abgelehnt. Bitten Sie den Kunden:
- Eine andere Karte zu verwenden.
- Seine Bank zu kontaktieren, um die Belastung zu genehmigen.
- Auf etwaige Betrugspraeventionssperren zu pruefen.

### Unzureichendes Guthaben

**Fehler**: `billing.insufficientFunds`

Die Karte verfuegt nicht ueber ausreichendes Guthaben. Bitten Sie den Kunden, eine andere Karte zu verwenden oder Guthaben aufzuladen.

### Abgelaufene Karte

**Fehler**: `billing.expiredCard`

Das Ablaufdatum der Karte ist ueberschritten. Bitten Sie den Kunden, seine Zahlungsmethode zu aktualisieren.

### 3D-Secure-Authentifizierung erforderlich

**Fehler**: `billing.authenticationRequired`

Die Karte erfordert eine zusaetzliche Authentifizierung (3DS/SCA). Der Kunde muss den Authentifizierungsablauf in seinem Browser abschliessen. Dies ist bei europaeischen Karten unter den PSD2/SCA-Vorschriften ueblich.

## Abonnement-Probleme

### Abonnement nach Checkout nicht gefunden

**Ursache**: Der `checkout.session.completed`-Webhook wurde noch nicht verarbeitet.

**Loesungen**:
1. Pruefen Sie, ob der Webhook empfangen wurde (Stripe-Dashboard > Webhooks > Recent events).
2. Stellen Sie sicher, dass die Idempotenz-Tabelle die Event-ID enthaelt.
3. Pruefen Sie die Gateway-Logs auf Fehler waehrend `handleCheckoutCompleted`.

### Testphase startet nicht

**Ursache**: Die Methode `provisionNewWorkspace` wurde nicht aufgerufen oder der Wert `trial_days` in der Abrechnungskonfiguration ist auf 0 gesetzt.

**Loesungen**:
1. Pruefen Sie den Wert `trial_days` in der Tabelle `billing_config`.
2. Stellen Sie sicher, dass die Workspace-Erstellung die Abonnement-Bereitstellung ausloest.

### Abonnement haengt im Status `past_due`

**Ursache**: Eine Rechnungszahlung ist fehlgeschlagen und wurde nicht erfolgreich wiederholt.

**Loesungen**:
1. Der Kunde aktualisiert seine Zahlungsmethode ueber das Abrechnungsportal.
2. Der Administrator wiederholt die Rechnung manuell im Stripe-Dashboard.
3. Stripe wiederholt automatisch gemaess dem Wiederholungsplan (konfigurierbar im Stripe-Dashboard unter **Settings > Billing > Subscriptions > Retry schedule**).

## PAYG-Probleme

### PAYG-Belastung fehlgeschlagen

**Ursache**: Die gespeicherte Zahlungsmethode wurde bei der automatischen Belastung eines negativen PAYG-Guthabens abgelehnt.

**Loesungen**:
1. Der Kunde fuegt eine gueltige Zahlungsmethode hinzu.
2. Der Administrator laedt das Workspace-Guthaben manuell ueber die Guthaben-Seite auf.
3. Pruefen Sie die Tabelle `payg_credits_ledger` auf den fehlgeschlagenen Eintrag.

### Guthaben wird nicht abgezogen

**Ursache**: Die `credit-gate`-Middleware ist moeglicherweise nicht auf die Route angewendet, oder `deductCredits` wird nach dem Vorgang nicht aufgerufen.

**Loesungen**:
1. Stellen Sie sicher, dass die Route die Middleware `requireCredits()` verwendet.
2. Stellen Sie sicher, dass `deductCredits()` im Route-Handler nach erfolgreichem Abschluss aufgerufen wird.

## Rueckerstattungsprobleme

### Rueckerstattung fehlgeschlagen

**Fehler**: `billing.refundFailed`

**Ursachen**:
- Die Belastung ist zu alt (Stripe erlaubt Rueckerstattungen innerhalb von 180 Tagen).
- Die Belastung wurde bereits vollstaendig erstattet.
- Das Stripe-Kontoguthaben reicht fuer die Rueckerstattung nicht aus.

**Loesungen**:
1. Pruefen Sie die Belastung im Stripe-Dashboard.
2. Ueberpruefen Sie bei Teilerstattungen den verbleibenden erstattungsfaehigen Betrag.
3. Kontaktieren Sie den Stripe-Support, wenn die Rueckerstattung blockiert ist.

## Umgebungsprobleme

### Fehlende Stripe-Schluessel

**Symptome**: `Error: Stripe secret key not configured`

**Loesung**: Stellen Sie sicher, dass alle erforderlichen Umgebungsvariablen in `.env` gesetzt sind:
```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Falsche Umgebung (Test vs. Live)

**Symptome**: API-Aufrufe schlagen mit Authentifizierungsfehlern fehl, oder Belastungen erscheinen auf echten Karten.

**Loesung**: Stellen Sie sicher, dass Sie das richtige Schluesselpraefix verwenden:
- Testmodus: `sk_test_...`, `pk_test_...`
- Live-Modus: `sk_live_...`, `pk_live_...`

Mischen Sie niemals Test- und Live-Schluessel.

## Datenbankprobleme

### Idempotenz-Tabelle fehlt

**Symptome**: `500 Internal error` am Webhook-Endpoint.

**Loesung**: Fuehren Sie die Datenbank-Migrationen aus:
```bash
make shell-gateway npm run migrate
```

### Abonnement-Zeile nicht erstellt

**Ursache**: Das Einfuegen in die Tabelle `workspace_subscriptions` ist fehlgeschlagen.

**Loesungen**:
1. Pruefen Sie die Gateway-Logs auf SQL-Fehler.
2. Stellen Sie sicher, dass die Workspace-ID in der Tabelle `workspaces` existiert.
3. Pruefen Sie auf Unique-Constraint-Verletzungen (doppeltes Abonnement).

## Debugging-Tipps

1. **Stripe-Dashboard**: Pruefen Sie immer **Developers > Events** fuer das vollstaendige Ereignisprotokoll.
2. **Gateway-Logs**: `docker logs whynot-gateway-1 --tail 100 -f`
3. **Stripe-CLI-Events**: `stripe events list --limit 10`
4. **Webhooks manuell testen**: `stripe trigger checkout.session.completed`
5. **Idempotenz pruefen**: Fragen Sie die Tabelle `payment_webhooks_idempotency` nach dem Verarbeitungsstatus von Events ab.
6. **Audit-Log**: Fragen Sie die Tabelle `payment_audit_log` nach der Zahlungsvorgangshistorie ab.
