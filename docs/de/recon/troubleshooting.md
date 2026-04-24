---
title: "Recon — Fehlerbehebung"
description: "Häufige Fehler beim Ausführen von Recon-Scans und ihre Behebung."
lang: de
draft: false
---

# Fehlerbehebung

Diese Seite behandelt die häufigsten Fehlermodi beim Starten oder Ausführen eines Recon-Scans, mit Ursache und Lösung. Wenn Sie auf etwas stoßen, das hier nicht aufgeführt ist, wenden Sie sich an den Support und fügen Sie die Scan-ID aus der URL bei.

---

## Ich sehe Recon nicht in der Seitenleiste

**Ursache.** Das Feature-Flag `recon_enabled` ist für Ihren Workspace ausgeschaltet.

**Lösung.** Bitten Sie einen Workspace-Eigentümer, Recon unter **Einstellungen → Feature-Flags** zu aktivieren. Wenn Sie der Eigentümer sind und das Flag nicht sehen, enthält Ihr Plan kein Recon — siehe [Kontingente](quotas.md).

## „Autorisierung erforderlich" — 400-Fehler beim Start eines Scans

**Ursache.** Die Neuer-Scan-Anfrage erreichte das Gateway ohne gültigen Autorisierungsblock. Das bedeutet meist, dass eines der drei Bestätigungs-Häkchen nicht gesetzt war oder das Formular abgesendet wurde, bevor das Feld für die juristische Person ausgefüllt war.

**Lösung.**

1. Öffnen Sie den Neuer-Scan-Assistenten erneut.
2. Setzen Sie im Autorisierungs-Schritt alle drei Häkchen:
   - „Ich bin berechtigt, dieses Ziel zu scannen."
   - „Ich verstehe, dass dieser Scan aktive Sonden sendet."
   - Die juristische Person, die Sie vertreten.
3. Erneut absenden.

Wenn der Fehler weiterhin auftritt, prüfen Sie die Browser-Konsole auf einen Anfrage-Payload, dem das Feld `authorization` fehlt — das kann passieren, wenn eine Browser-Erweiterung Formularsendungen umschreibt.

## Warnung „Repository nicht verbunden" im Assistenten

**Ursache.** Sie haben ein Ziel gewählt, dessen Umgebung mit einem Git-Repository verknüpft ist, aber dieses Repository ist derzeit nicht mit dem Workspace verbunden.

**Lösung.** Das ist eine Warnung, kein Blocker. Sie können den Scan ohne verbundenes Repository starten — Recon überspringt dann die quellbasierte Analyse-Phase. So aktivieren Sie quellbasierte Analyse:

1. Öffnen Sie **Einstellungen → Integrationen**.
2. Verbinden Sie das Repository (GitHub, GitLab, Bitbucket).
3. Starten Sie den Scan erneut.

Die im Assistenten enthaltenen Credit-Kosten sind mit oder ohne verbundenes Repository gleich; das tiefere Signal macht Funde nur genauer.

## „Umgebungs-URL fehlt" beim Start

**Ursache.** Die ausgewählte Umgebung hat keine `base_url` gesetzt.

**Lösung.** Öffnen Sie die Umgebung unter **Einstellungen → Umgebungen**, setzen Sie eine Basis-URL (in den meisten Workspaces muss sie `https://` sein), speichern Sie und öffnen Sie den Assistenten erneut.

## Ein Scan steckt stundenlang in „läuft" fest

**Prüfen Sie zuerst das Credit-Limit pro Scan.** Ein Scan, der das Limit erreicht, wird sauber beendet und wechselt in den Status `terminated` — er erscheint nicht festgefahren. Wenn das Limit `0` ist, ist das nicht die Ursache.

**Prüfen Sie als Nächstes den Phasen-Indikator** auf der Scan-Detailseite. Wenn dieselbe Phase länger als eine Stunde ohne Fortschritt angezeigt wird, ist der Scan tatsächlich festgefahren.

**Lösung.**

1. Klicken Sie auf der Detailseite auf **Pause**.
2. Warten Sie 30 Sekunden.
3. Klicken Sie auf **Fortsetzen**. Beachten Sie, dass die Wiederaufnahme erfordert, dass die ursprüngliche Ziel-URL byteweise mit der wiederaufgenommenen Ziel-URL übereinstimmt — siehe [Verantwortungsvoller Einsatz](responsible-use.md#wiederaufnahme-erfordert-url-übereinstimmung).
4. Wenn der Scan nicht erfolgreich fortgesetzt wird, klicken Sie auf **Abbrechen** und starten Sie einen neuen Scan. Sie werden für unvollständige Phasen nicht berechnet.

Wenn mehrere Scans bei derselben Phase gegen dasselbe Ziel hängen bleiben, drosselt das Ziel möglicherweise Recon. Reduzieren Sie den Umfang von Tiefe auf Standard oder kontaktieren Sie den Support.

## Wiederaufnahme schlug mit „URL-Diskrepanz" fehl

**Ursache.** Die Ziel-URL hat sich zwischen Pause und Fortsetzung geändert. Das ist eine bewusste Sicherheitsprüfung — siehe [Verantwortungsvoller Einsatz](responsible-use.md#wiederaufnahme-erfordert-url-übereinstimmung).

**Lösung.** Starten Sie einen neuen Scan mit einem neuen Autorisierungsblock. Versuchen Sie nicht, die URL-Prüfung zu umgehen; sie existiert aus gutem Grund.

## Der Proof-of-Concept eines Funds reproduziert sich manuell nicht

**Mögliche Ursachen.**

- Der Zustand des Ziels hat sich zwischen Scan und Ihrem manuellen Replay geändert (eine Korrektur ist eingespielt, eine Sitzung abgelaufen, ein Feature-Flag umgeschaltet).
- Der Proof-of-Concept hängt von einem Sitzungs-Cookie oder Auth-Token ab, das seither rotiert wurde.
- Der Scan hat eine Race-Condition ausgenutzt, die sich nicht zuverlässig reproduzieren lässt.

**Lösung.**

1. Scannen Sie das Ziel erneut. Wenn der Fund wieder erscheint, ist er noch aktiv; wenn nicht, wurde er wahrscheinlich behoben.
2. Wenn der Fund wieder erscheint, Sie ihn aber immer noch nicht manuell reproduzieren können, prüfen Sie den Abschnitt **Abdeckungslücken** des Berichts — die ursprüngliche Sonde hat möglicherweise Zugangsdaten verwendet, die Sie nicht haben.
3. Wenn Sie einen echten Fehlalarm vermuten, klicken Sie auf der Fund-Karte auf **Fehlalarm melden**. Die Pipeline nutzt diese zur Verbesserung des Konfidenz-Scores. Siehe [Funde verstehen — Fehlalarm-Politik](understanding-findings.md#fehlalarm-politik).

## „Scan-Budget überschritten — Workspace-Limit erreicht"

**Ursache.** Ihr Workspace hat sein monatliches Recon-Scan- oder Credit-Kontingent erreicht, und PAYG-Abrechnung ist deaktiviert (Free-Plan oder Ihr Abrechnungskontakt hat Überschreitung explizit deaktiviert).

**Lösung.** Upgraden Sie auf einen kostenpflichtigen Plan, aktivieren Sie PAYG oder warten Sie auf den nächsten Abrechnungszyklus. Siehe [Kontingente](quotas.md).

## Ein erwarteter Fund fehlt im Bericht

**Mögliche Ursachen.**

- Der Fund hatte keinen reproduzierbaren Proof-of-Concept und wurde unter der Politik **kein Exploit, kein Bericht** unterdrückt. Siehe [Funde verstehen](understanding-findings.md#kein-exploit-kein-bericht).
- Der Fund wurde zuvor als `false_positive`, `accepted_risk`, `duplicate` oder `out_of_scope` verworfen und in nachfolgenden Scans unterdrückt.
- Der das Problem hostende Endpunkt liegt in einer Abdeckungslücke (Auth erforderlich, WAF blockiert, Crawl-Budget erschöpft). Prüfen Sie den Abschnitt **Abdeckungslücken**.

**Lösung.** Öffnen Sie **Recon → Funde → Alle (inklusive verworfen)**, um unterdrückte und verworfene Funde zu sehen. Wenn ein echtes Problem unterdrückt wird, heben Sie die Verwerfung auf der Fund-Karte auf.

## Die Warnung „Produktionsumgebung ausgewählt" blockiert meinen Workflow

**Diese Warnung blockiert nicht.** Sie ist ein Zwischenelement im Assistenten. Sie können den Scan trotzdem starten; die Warnung existiert, um sicherzustellen, dass Sie die Produktion wirklich scannen wollten.

Wenn Sie die Warnung lästig finden, weil Sie absichtlich und häufig die Produktion scannen, sind wir offen dafür, einen Workspace-Schalter „Ich scanne immer Produktion, diese Warnung unterdrücken" hinzuzufügen. Öffnen Sie ein Feature-Request.

## Ich muss einen Scan löschen

Workspace-Eigentümer können einen Scan über die Detailseite löschen (**Mehr → Scan löschen**). Das Löschen eines Scans entfernt:

- Die Scan-Zeile.
- Die Funde.
- Den Bericht.

Das Löschen eines Scans entfernt **nicht** die Audit-Log-Zeile der Autorisierung — diese sind für die Lebensdauer des Workspace unveränderlich.

## Immer noch festgefahren?

- Für Plattform-Probleme (UI-Fehler, Login-Probleme): allgemeine [Fehlerbehebungs-Doku](../../TROUBLESHOOTING.md).
- Für Recon-spezifische Probleme, die hier nicht abgedeckt sind: kontaktieren Sie den Support mit der Scan-ID aus der URL.

---

Verwandt:

- [Schnellstart](quickstart.md)
- [Verantwortungsvoller Einsatz](responsible-use.md)
- [Funde verstehen](understanding-findings.md)
- [Berichte lesen](reading-reports.md)
- [Kontingente und Abrechnung](quotas.md)
