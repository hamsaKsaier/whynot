# Testabdeckungsrichtlinie

## 100% Abdeckungsanforderung

Alle vier Pakete (`frontend/`, `admin-frontend/`, `gateway/`, `shared/`) erzwingen eine **100% Abdeckung** für Zeilen, Branches, Funktionen und Anweisungen.

| Metrik | Schwellenwert |
|--------|---------------|
| Zeilen | 100% |
| Branches | 100% |
| Funktionen | 100% |
| Anweisungen | 100% |

## CI-Gate

Der `unit-integration`-Job in `.github/workflows/test.yml` führt `npx vitest run --coverage` pro Paket aus. Fällt ein Paket unter 100% bei einer Metrik, schlägt der Job fehl und der PR kann nicht gemergt werden.

HTML-Abdeckungsberichte werden als Build-Artefakte hochgeladen (14 Tage aufbewahrt).

## Abdeckung lokal ausführen

```bash
docker compose -f docker-compose.test.yml run --rm gateway-test npx vitest run --coverage
docker compose -f docker-compose.test.yml run --rm frontend-test npx vitest run --coverage
docker compose -f docker-compose.test.yml run --rm admin-frontend-test npx vitest run --coverage
docker compose -f docker-compose.test.yml run --rm shared-test npx vitest run --coverage
```

## Ausgeschlossene Pfade

| Pfad | Grund |
|------|-------|
| `services/qa-loop-executor/src/v2/**` | Schreibgeschützte Engine |
| `services/qa-loop-executor/src/mcp-browser.ts` | Nicht modifizierbare MCP-Integration |
| `**/*.test.ts`, `**/*.test.tsx`, `**/*.spec.ts` | Testdateien |
| `**/__tests__/**` | Testverzeichnisse |
| `**/dist/**`, `**/node_modules/**` | Build-Ausgaben |
| `**/*.d.ts` | Typdeklarationen |
| `**/*.config.ts` | Konfigurationsdateien |
| `src/main.tsx` | React-Einstiegspunkt |
| `src/server.ts` | Express-Einstiegspunkt |
| `src/routeTree.gen.ts` | Automatisch generierter Routenbaum |

## `/* istanbul ignore */`-Richtlinie

**Verboten**, es sei denn, die Zeile ist nachweislich unerreichbar UND mit einem einzeiligen Kommentar versehen, der erklärt warum.
