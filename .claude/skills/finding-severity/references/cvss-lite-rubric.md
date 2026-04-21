> **Single source of truth**: Before proposing any change, read [`../../../../ARCHITECTURE.md`](../../../../ARCHITECTURE.md) (adjust relative path to the file's depth). When this document conflicts with `ARCHITECTURE.md`, `ARCHITECTURE.md` wins.

# CVSS-lite Rubric

## Overview

The CVSS-lite rubric maps each axis value (1–4) to a user-facing description. These descriptions are stored as i18n keys and rendered in the dashboard and report. This reference lists every key and its default English text, along with the translation key prefix for each locale.

## i18n Key Convention

All keys follow the pattern:

```
recon.severity.axes.{axis}.{value}
```

Where:
- `{axis}` is one of `impact`, `exploitability`, `blast_radius`
- `{value}` is an integer `1` through `4`

## Impact Axis

| Value | i18n Key | English (`en`) | Description |
|-------|---------|----------------|-------------|
| 1 | `recon.severity.axes.impact.1` | Information disclosure — non-sensitive metadata exposed | Server version headers, stack traces, or error messages leaked to an unauthenticated user |
| 2 | `recon.severity.axes.impact.2` | User data access — PII or session tokens exposed | Attacker can read another user's email, API key, or session cookie |
| 3 | `recon.severity.axes.impact.3` | Admin access — privilege escalation to admin level | Attacker gains workspace-admin or system-admin capabilities |
| 4 | `recon.severity.axes.impact.4` | Remote code execution — arbitrary command execution | Attacker executes shell commands on the server or takes full control |

### Arabic (`ar`) Key Prefix

```
recon.severity.axes.impact.1  →  تسريب معلومات — بيانات وصفية غير حساسة مكشوفة
recon.severity.axes.impact.2  →  الوصول إلى بيانات المستخدم — معلومات شخصية أو رموز جلسة مكشوفة
recon.severity.axes.impact.3  →  وصول المسؤول — تصعيد الصلاحيات إلى مستوى المسؤول
recon.severity.axes.impact.4  →  تنفيذ التعليمات البرمجية عن بُعد — تنفيذ أوامر عشوائية
```

### French (`fr`) Key Prefix

```
recon.severity.axes.impact.1  →  Divulgation d'informations — métadonnées non sensibles exposées
recon.severity.axes.impact.2  →  Accès aux données utilisateur — PII ou jetons de session exposés
recon.severity.axes.impact.3  →  Accès administrateur — élévation de privilèges au niveau administrateur
recon.severity.axes.impact.4  →  Exécution de code à distance — exécution de commandes arbitraires
```

### German (`de`) Key Prefix

```
recon.severity.axes.impact.1  →  Informationsoffenlegung — nicht sensible Metadaten sichtbar
recon.severity.axes.impact.2  →  Benutzerdaten-Zugriff — PII oder Sitzungs-Token offengelegt
recon.severity.axes.impact.3  →  Administrator-Zugriff — Privilegieneskalation auf Administratorebene
recon.severity.axes.impact.4  →  Remote-Code-Ausführung — beliebige Befehlsausführung
```

### Spanish (`es`) Key Prefix

```
recon.severity.axes.impact.1  →  Divulgación de información — metadatos no sensibles expuestos
recon.severity.axes.impact.2  →  Acceso a datos de usuario — PII o tokens de sesión expuestos
recon.severity.axes.impact.3  →  Acceso de administrador — escalada de privilegios al nivel de administrador
recon.severity.axes.impact.4  →  Ejecución remota de código — ejecución de comandos arbitrarios
```

## Exploitability Axis

| Value | i18n Key | English (`en`) | Description |
|-------|---------|----------------|-------------|
| 1 | `recon.severity.axes.exploitability.1` | Requires manual effort and prior privileges | Attacker must be authenticated and use custom tooling or chained exploits |
| 2 | `recon.severity.axes.exploitability.2` | Reproducible manually without prior privileges | Unauthenticated attacker can reproduce using curl or a browser |
| 3 | `recon.severity.axes.exploitability.3` | Automated with a script, requires authentication | A script can exploit the vulnerability, but needs a valid session |
| 4 | `recon.severity.axes.exploitability.4` | Single unauthenticated HTTP request triggers the issue | One `curl` command from an anonymous user triggers the vulnerability |

### Arabic (`ar`) Key Prefix

```
recon.severity.axes.exploitability.1  →  يتطلب جهدًا يدويًا وامتيازات مسبقة
recon.severity.axes.exploitability.2  →  قابل لإعادة الإنتاج يدويًا بدون امتيازات مسبقة
recon.severity.axes.exploitability.3  →  مؤتمت بنص برمجي، يتطلب المصادقة
recon.severity.axes.exploitability.4  →  طلب HTTP واحد غير مصادق عليه يثير المشكلة
```

### French (`fr`) Key Prefix

```
recon.severity.axes.exploitability.1  →  Nécessite un effort manuel et des privilèges préalables
recon.severity.axes.exploitability.2  →  Reproductible manuellement sans privilèges préalables
recon.severity.axes.exploitability.3  →  Automatisé par script, nécessite une authentification
recon.severity.axes.exploitability.4  →  Une seule requête HTTP non authentifiée déclenche le problème
```

### German (`de`) Key Prefix

```
recon.severity.axes.exploitability.1  →  Erfordert manuellen Aufwand und vorherige Berechtigungen
recon.severity.axes.exploitability.2  →  Manuell reproduzierbar ohne vorherige Berechtigungen
recon.severity.axes.exploitability.3  →  Per Skript automatisiert, erfordert Authentifizierung
recon.severity.axes.exploitability.4  →  Ein einzelner nicht authentifizierter HTTP-Request löst das Problem aus
```

### Spanish (`es`) Key Prefix

```
recon.severity.axes.exploitability.1  →  Requiere esfuerzo manual y privilegios previos
recon.severity.axes.exploitability.2  →  Reproducible manualmente sin privilegios previos
recon.severity.axes.exploitability.3  →  Automatizado con un script, requiere autenticación
recon.severity.axes.exploitability.4  →  Una sola solicitud HTTP no autenticada activa el problema
```

## Blast Radius Axis

| Value | i18n Key | English (`en`) | Description |
|-------|---------|----------------|-------------|
| 1 | `recon.severity.axes.blast_radius.1` | Single account — only affects the attacker's own data | The vulnerability only exposes or modifies the attacker's own resources |
| 2 | `recon.severity.axes.blast_radius.2` | Small group — up to 100 users in the same workspace | A limited set of users within one workspace are affected |
| 3 | `recon.severity.axes.blast_radius.3` | Large group — hundreds to thousands of users | Users across multiple workspaces or a significant portion of the tenant |
| 4 | `recon.severity.axes.blast_radius.4` | Full tenant — all users and data affected | Every user and all data in the entire deployment is at risk |

### Arabic (`ar`) Key Prefix

```
recon.severity.axes.blast_radius.1  →  حساب واحد — يؤثر فقط على بيانات المهاجم
recon.severity.axes.blast_radius.2  →  مجموعة صغيرة — حتى 100 مستخدم في نفس مساحة العمل
recon.severity.axes.blast_radius.3  →  مجموعة كبيرة — مئات إلى آلاف المستخدمين
recon.severity.axes.blast_radius.4  →  المستأجر بالكامل — جميع المستخدمين والبيانات متأثرون
```

### French (`fr`) Key Prefix

```
recon.severity.axes.blast_radius.1  →  Compte unique — affecte uniquement les données de l'attaquant
recon.severity.axes.blast_radius.2  →  Petit groupe — jusqu'à 100 utilisateurs dans le même espace de travail
recon.severity.axes.blast_radius.3  →  Grand groupe — des centaines à des milliers d'utilisateurs
recon.severity.axes.blast_radius.4  →  Locataire complet — tous les utilisateurs et données affectés
```

### German (`de`) Key Prefix

```
recon.severity.axes.blast_radius.1  →  Einzelnes Konto — betrifft nur die Daten des Angreifers
recon.severity.axes.blast_radius.2  →  Kleine Gruppe — bis zu 100 Benutzer im selben Arbeitsbereich
recon.severity.axes.blast_radius.3  →  Große Gruppe — Hunderte bis Tausende von Benutzern
recon.severity.axes.blast_radius.4  →  Gesamter Mandant — alle Benutzer und Daten betroffen
```

### Spanish (`es`) Key Prefix

```
recon.severity.axes.blast_radius.1  →  Cuenta única — solo afecta los datos del atacante
recon.severity.axes.blast_radius.2  →  Grupo pequeño — hasta 100 usuarios en el mismo espacio de trabajo
recon.severity.axes.blast_radius.3  →  Grupo grande — de cientos a miles de usuarios
recon.severity.axes.blast_radius.4  →  Inquilino completo — todos los usuarios y datos afectados
```

## Severity Level Labels

| Severity | i18n Key | English | Arabic | French | German | Spanish |
|----------|---------|---------|--------|--------|--------|---------|
| `low` | `recon.severity.low` | Low | منخفض | Faible | Niedrig | Bajo |
| `medium` | `recon.severity.medium` | Medium | متوسط | Moyen | Mittel | Medio |
| `high` | `recon.severity.high` | High | عالٍ | Élevé | Hoch | Alto |
| `critical` | `recon.severity.critical` | Critical | حرج | Critique | Kritisch | Crítico |

## Worked Example

A SQL injection found on `/api/v1/users/{id}`:

| Axis | Value | i18n Key |
|------|-------|----------|
| Impact | 2 (user data access) | `recon.severity.axes.impact.2` |
| Exploitability | 4 (single HTTP request) | `recon.severity.axes.exploitability.4` |
| Blast radius | 3 (large group) | `recon.severity.axes.blast_radius.3` |

Sum = 2 + 4 + 3 = 9 → **`high`** (`recon.severity.high`)
