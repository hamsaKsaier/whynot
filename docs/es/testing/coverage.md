---
title: "Politica de cobertura de pruebas"
description: "Requisitos de cobertura del 100% y configuracion para todos los paquetes de WhyNot."
lang: es
draft: false
---

# Politica de cobertura de pruebas

## Requisito de cobertura del 100%

Los cuatro paquetes (`frontend/`, `admin-frontend/`, `gateway/`, `shared/`) exigen una **cobertura del 100%** para líneas, ramas, funciones y sentencias.

| Métrica | Umbral |
|---------|--------|
| Líneas | 100% |
| Ramas | 100% |
| Funciones | 100% |
| Sentencias | 100% |

## Puerta CI

El job `unit-integration` en `.github/workflows/test.yml` ejecuta `npx vitest run --coverage` por paquete. Si algún paquete cae por debajo del 100% en cualquier métrica, el job falla y el PR no se puede fusionar.

Los informes HTML de cobertura se suben como artefactos de build (conservados 14 días).

## Ejecutar cobertura localmente

```bash
docker compose -f docker-compose.test.yml run --rm gateway-test npx vitest run --coverage
docker compose -f docker-compose.test.yml run --rm frontend-test npx vitest run --coverage
docker compose -f docker-compose.test.yml run --rm admin-frontend-test npx vitest run --coverage
docker compose -f docker-compose.test.yml run --rm shared-test npx vitest run --coverage
```

## Rutas excluidas

| Ruta | Razón |
|------|-------|
| `services/qa-loop-executor/src/v2/**` | Motor de solo lectura |
| `services/qa-loop-executor/src/mcp-browser.ts` | Integración MCP no modificable |
| `**/*.test.ts`, `**/*.test.tsx`, `**/*.spec.ts` | Archivos de prueba |
| `**/__tests__/**` | Directorios de prueba |
| `**/dist/**`, `**/node_modules/**` | Salidas de compilación |
| `**/*.d.ts` | Declaraciones de tipos |
| `**/*.config.ts` | Archivos de configuración |
| `src/main.tsx` | Punto de entrada React |
| `src/server.ts` | Punto de entrada Express |
| `src/routeTree.gen.ts` | Árbol de rutas autogenerado |

## Politica de `/* istanbul ignore */`

**Prohibido** a menos que la linea sea demostrablemente inalcanzable Y este anotada con un comentario de una sola linea explicando el motivo.

## Configuracion

Los umbrales de cobertura se configuran en el archivo `vitest.config.ts` de cada paquete:

```ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'html', 'lcov'],
  thresholds: {
    lines: 100,
    branches: 100,
    functions: 100,
    statements: 100,
  },
  include: ['src/**'],
  exclude: [/* see excluded paths above */],
}
```
