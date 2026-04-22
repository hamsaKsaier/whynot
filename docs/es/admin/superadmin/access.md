---
title: "Acceso Superadmin"
description: "Como funciona el acceso al area de superadmin en WhyNot QA."
lang: es
draft: false
---

# Acceso Superadmin

## Descripcion general

El area de superadmin es accesible en `https://superadmin.whynot.skrum.io`. Sirve la misma aplicacion admin-frontend pero con un alcance de navegacion restringido y comportamiento basado en el nombre de host.

## Quien tiene acceso

Solo los usuarios con el rol `super_admin` pueden acceder al nombre de host del superadmin. Esto se aplica en dos niveles:

1. **Autenticacion**: El flujo de inicio de sesion requiere el rol `super_admin`. Los usuarios que no son superadmin reciben un error de "acceso denegado".
2. **Verificacion del nombre de host**: Si un usuario de alguna manera llega a `superadmin.whynot.skrum.io` sin el rol `super_admin`, ve una pagina clara de "Acceso denegado" con redireccion a `admin.whynot.skrum.io`.

## Diferencias con admin.whynot.skrum.io

| Comportamiento | admin.whynot.skrum.io | superadmin.whynot.skrum.io |
|----------------|----------------------|---------------------------|
| Secciones del menu lateral | Todas las secciones | Solo Plataforma, Facturacion, Flags e IA, Configuracion |
| Redireccion post-login | `/` (Panel) | `/users` |
| Titulo del menu lateral | "Admin" | "Super Admin" |
| Flujo de acceso denegado | Pagina prohibida generica | Pagina dedicada con redireccion a admin |

## Como funciona

El admin-frontend detecta el nombre de host via `window.location.hostname` usando el helper en `src/lib/hostname.ts`. Segun el modo detectado (`"admin"` o `"superadmin"`):

- **AdminShell** filtra las secciones de navegacion del menu lateral.
- **LoginPage** redirige a `/users` en lugar de `/` despues de un inicio de sesion exitoso.
- **ProtectedRoute** muestra `AccessDeniedPage` en lugar de `ForbiddenPage` para usuarios no-superadmin en el nombre de host del superadmin.

## Nombres de host soportados

| Nombre de host | Modo |
|----------------|------|
| `superadmin.whynot.skrum.io` | `superadmin` |
| `superadmin.localhost` | `superadmin` (desarrollo) |
| Cualquier otro | `admin` |

## Agregar el nombre de host superadmin

No se necesita un despliegue SPA separado. El nombre de host del superadmin es un alias de Nginx que apunta al mismo upstream `admin-frontend` (puerto 5184). Consulte [Configuracion de Nginx](../../deployment/nginx-setup.md) para detalles de configuracion.

### DNS

Cree un registro A/AAAA para `superadmin.whynot.skrum.io` apuntando a la misma IP que `whynot.skrum.io`.

### CORS

El gateway debe incluir `https://superadmin.whynot.skrum.io` en su lista de CORS permitidos. Configure `SUPERADMIN_FRONTEND_URL=https://superadmin.whynot.skrum.io` en el archivo `.env`.
