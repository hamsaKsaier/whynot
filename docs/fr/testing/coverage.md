# Politique de couverture des tests

## Exigence de couverture à 100%

Les quatre packages (`frontend/`, `admin-frontend/`, `gateway/`, `shared/`) imposent une **couverture de 100%** pour les lignes, branches, fonctions et instructions.

| Métrique | Seuil |
|----------|-------|
| Lignes | 100% |
| Branches | 100% |
| Fonctions | 100% |
| Instructions | 100% |

## Porte CI

Le job `unit-integration` dans `.github/workflows/test.yml` exécute `npx vitest run --coverage` par package. Si un package descend en dessous de 100% sur une métrique, le job échoue et la PR ne peut pas être fusionnée.

Les rapports HTML de couverture sont téléchargés comme artefacts de build (conservés 14 jours).

## Exécuter la couverture localement

```bash
docker compose -f docker-compose.test.yml run --rm gateway-test npx vitest run --coverage
docker compose -f docker-compose.test.yml run --rm frontend-test npx vitest run --coverage
docker compose -f docker-compose.test.yml run --rm admin-frontend-test npx vitest run --coverage
docker compose -f docker-compose.test.yml run --rm shared-test npx vitest run --coverage
```

## Chemins exclus

| Chemin | Raison |
|--------|--------|
| `services/qa-loop-executor/src/v2/**` | Moteur en lecture seule |
| `services/qa-loop-executor/src/mcp-browser.ts` | Intégration MCP non modifiable |
| `**/*.test.ts`, `**/*.test.tsx`, `**/*.spec.ts` | Fichiers de test |
| `**/__tests__/**` | Répertoires de test |
| `**/dist/**`, `**/node_modules/**` | Sorties de build |
| `**/*.d.ts` | Déclarations de types |
| `**/*.config.ts` | Fichiers de configuration |
| `src/main.tsx` | Point d'entrée React |
| `src/server.ts` | Point d'entrée Express |
| `src/routeTree.gen.ts` | Arbre de routes auto-généré |

## Politique `/* istanbul ignore */`

**Interdit** sauf si la ligne est prouvablement inaccessible ET annotée avec un commentaire sur une seule ligne expliquant pourquoi.
