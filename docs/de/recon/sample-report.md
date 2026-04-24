---
title: "Recon — Beispielbericht"
description: "Ein redigiertes Beispiel eines Recon-Scan-Berichts."
lang: de
draft: false
---

# Beispielbericht

Dies ist ein redigiertes Beispiel eines echten Recon-Scan-Berichts. URLs, Parameter und Antworten wurden geändert, um das ursprüngliche Ziel zu schützen. Die Struktur, die Schweregrad-Rubrik und das Proof-of-Concept-Format entsprechen genau dem, was Sie für Ihre eigenen Scans sehen werden.

Eine Erklärung zu jedem Abschnitt finden Sie unter [Berichte lesen](reading-reports.md).

---

## Scan: example-staging.acme.dev

| Feld | Wert |
|------|------|
| **Ziel** | `https://example-staging.acme.dev` |
| **Umgebung** | `staging` |
| **Umfang** | Standard |
| **Gestartet** | 2026-04-22 14:02 UTC |
| **Beendet** | 2026-04-22 14:31 UTC |
| **Gestartet von** | engineer@acme.dev |
| **Autorisierungsreferenz** | INT-4421 (internes Pentest-Ticket) |

---

## 1. Zusammenfassung

Ein Standard-Scan von `example-staging.acme.dev` wurde in 29 Minuten abgeschlossen und produzierte **einen kritischen**, **zwei hohe** und **vier mittlere** bestätigte Funde sowie elf niedrige/Info-Einträge.

Der kritische Fund ist eine SQL-Injection im Endpunkt `/api/v1/orders`, die es einem nicht authentifizierten Angreifer erlaubt, beliebige Zeilen aus den Tabellen `orders` und `customers` zu lesen. **Behandeln Sie das als Vorfall.**

Die zwei hohen Funde sind ein Problem mit gebrochener Zugriffskontrolle auf `/admin/users` und ein gespeichertes XSS im Bestellnotizen-Feld; beide erfordern ein Konto mit niedrigen Privilegien zur Ausnutzung.

Im Vergleich zum vorherigen Scan (2026-03-15) ist das kritische SQLi **neu**. Drei zuvor hohe Funde sind jetzt als **behoben** markiert.

---

## 2. Risiko-Überblick

| Schweregrad | Dieser Scan | Vorheriger Scan | Veränderung |
|-------------|-------------|------------------|-------------|
| Kritisch | 1 | 0 | +1 |
| Hoch | 2 | 5 | -3 |
| Mittel | 4 | 4 | 0 |
| Niedrig | 7 | 9 | -2 |
| Info | 4 | 3 | +1 |

---

## 3. Funde (Auszug)

### Fund 1 — SQL-Injection in `/api/v1/orders`

| Feld | Wert |
|------|------|
| **Schweregrad** | Kritisch |
| **Klasse** | SQL-Injection (CWE-89) |
| **Ziel** | `GET /api/v1/orders?status=<param>` |
| **Konfidenz** | Hoch |
| **Exploit-Ergebnis** | Lesen-bestätigt |

**Was passiert ist.** Der Query-Parameter `status` auf `/api/v1/orders` wird ohne Parametrisierung in eine SQL-`WHERE`-Klausel konkateniert. Ein Angreifer kann aus dem String-Kontext ausbrechen und beliebiges SQL injizieren. Es ist keine Authentifizierung erforderlich.

**Proof-of-Concept.**

```http
GET /api/v1/orders?status=open'%20UNION%20SELECT%20[REDACTED]%20--%20 HTTP/1.1
Host: example-staging.acme.dev

HTTP/1.1 200 OK
Content-Type: application/json

{"orders":[{"id":1,"status":"[REDACTED-RESPONSE]"}]}
```

Die injizierte `UNION`-Klausel gab Daten aus einer anderen Tabelle zurück und bestätigte damit die Injection. Die tatsächliche Payload und Antwort wurden in diesem Beispiel redigiert.

**Warum es wichtig ist.** Ein nicht authentifizierter Angreifer kann jede Zeile in jeder Tabelle lesen, auf die der Datenbank-Benutzer Zugriff hat, einschließlich der Tabellen `customers` und `orders`. Das ist die Schwachstellenklasse mit höchster Auswirkung gegen eine typische Web-Anwendungsdatenbank.

**Empfohlene Behebung.** Ersetzen Sie String-Konkatenation durch parametrisierte Queries im gesamten `/api/v1/orders`-Handler. Derselbe Code-Pfad existiert wahrscheinlich in benachbarten Endpunkten — auditieren Sie die Datei. Siehe OWASP A03:2021 — Injection für allgemeine Hinweise.

**Referenzen.**

- CWE-89: Unsachgemäße Neutralisierung spezieller Elemente in einem SQL-Befehl.
- OWASP Top 10 2021: A03 — Injection.

---

### Fund 2 — Gebrochene Zugriffskontrolle auf `/admin/users`

| Feld | Wert |
|------|------|
| **Schweregrad** | Hoch |
| **Klasse** | Gebrochene Zugriffskontrolle (CWE-285) |
| **Ziel** | `GET /admin/users/{id}` |
| **Konfidenz** | Hoch |
| **Exploit-Ergebnis** | Lesen-bestätigt |

**Was passiert ist.** Der Endpunkt `/admin/users/{id}` prüft, dass der Anfragende eingeloggt ist, prüft aber nicht, dass er die Rolle `admin` hat. Jeder authentifizierte Benutzer kann das Profil jedes anderen Benutzers lesen, einschließlich E-Mail und Rolle.

**Proof-of-Concept.** Eine standardmäßige authentifizierte Anfrage von einem Nicht-Admin-Konto gab das vollständige Profil eines anderen Benutzers zurück. Anfrage und Antwort redigiert.

**Empfohlene Behebung.** Fügen Sie eine Rollenprüfung im Route-Handler hinzu. Auditieren Sie alle `/admin/*`-Endpunkte auf dieselbe Lücke.

---

### Fund 3 — Gespeichertes XSS in Bestellnotizen

| Feld | Wert |
|------|------|
| **Schweregrad** | Hoch |
| **Klasse** | Gespeichertes XSS (CWE-79) |
| **Ziel** | `POST /api/v1/orders/{id}/notes` |
| **Konfidenz** | Hoch |
| **Exploit-Ergebnis** | Lesen-bestätigt |

**Was passiert ist.** Das Feld `notes` einer Bestellung wird ohne Bereinigung gespeichert und auf der Bestelldetailseite als HTML gerendert. Ein Benutzer mit niedrigen Privilegien kann ein Skript injizieren, das ausgeführt wird, wenn ein Admin die Bestellung ansieht.

**Proof-of-Concept.** Eine `<script>`-Payload (redigiert) wurde gespeichert und in einer separaten Sitzung ausgeführt beobachtet.

**Empfohlene Behebung.** Rendern Sie `notes` als Text, nicht als HTML. Wenn Rich Text erforderlich ist, verwenden Sie einen geprüften Sanitizer mit strikter Whitelist.

---

*(Sechs zusätzliche Funde in diesem Beispiel ausgelassen.)*

---

## 4. Umfang und Methodik

- **Im Umfang.** `https://example-staging.acme.dev/*` — 47 Endpunkte entdeckt, 312 Parameter getestet.
- **Außerhalb des Umfangs.** Alle anderen Hosts; der Pfad-Baum `/internal-debug/*` (gemäß Umgebungskonfiguration).
- **Autorisierung.** Internes Pentest-Ticket INT-4421, signiert vom Eigentümer der Staging-Umgebung.
- **Umfangsstufe.** Standard — Oberflächen-Scan plus aktive Sonden für OWASP-Top-10-Schwachstellenklassen.

---

## 5. Abdeckungslücken

- **Authentifizierte Admin-Pfade.** Recon erhielt ein Test-Konto mit niedrigen Privilegien, aber kein Admin-Konto. Funde auf `/admin/*` sind auf Probleme beschränkt, die ein authentifizierter Nicht-Admin erreichen kann.
- **WAF-Ratenlimitierung.** Drei Endpunkte unter `/api/v1/billing/*` gaben nach jeweils 12 Sonden `429 Too Many Requests` zurück. Der Crawl übersprang die übrigen Parameter dieser Endpunkte.
- **Hintergrundjobs.** Recon übt keine asynchronen Job-Queues oder geplanten Aufgaben aus. Probleme, die sich nur in der Hintergrundverarbeitung manifestieren, sind außerhalb des Umfangs.

---

## 6. Audit-Spur

| Phase | Gestartet | Beendet | Hinweise |
|-------|-----------|---------|----------|
| Reconnaissance | 14:02 | 14:08 | 47 Endpunkte entdeckt. |
| Oberflächenanalyse | 14:08 | 14:14 | TLS, Header, freigelegte Pfade. |
| Aktive Sondierung | 14:14 | 14:28 | 312 Parameter getestet. |
| Bestätigung | 14:28 | 14:30 | 7 Kandidaten-Funde; 7 bestätigt. |
| Berichterstellung | 14:30 | 14:31 | Bericht geschrieben. |

**Autorisierungseintrag.** Benutzer `engineer@acme.dev`, IP `198.51.100.42`, erfasst 2026-04-22 14:01:53 UTC, Ziel `https://example-staging.acme.dev`, Umfang `standard`, Referenz `INT-4421`.

---

Verwandt:

- [Berichte lesen](reading-reports.md) — was jeder Abschnitt bedeutet.
- [Funde verstehen](understanding-findings.md) — Schweregrad-Rubrik.
- [Schnellstart](quickstart.md) — starten Sie Ihren eigenen Scan.
