---
title: "Documentacion de WhyNot QA"
description: "Bienvenido a la documentacion de WhyNot QA — una plataforma de automatizacion de pruebas impulsada por IA."
lang: es
draft: false
---

# Documentacion de WhyNot QA

Bienvenido a la documentacion de WhyNot QA — una plataforma de automatizacion de pruebas impulsada por IA.

## Secciones

### Pruebas
- [Pruebas con IA](testing/) — Como funciona la generacion y ejecucion de pruebas con IA

### Pagos
- [Facturacion y suscripciones](payments/) — Gestion de planes, creditos y facturas

### Feature Flags
- [Gestion de Feature Flags](feature-flags/) — Control de la disponibilidad de funcionalidades

### IA
- [Configuracion de proveedores de IA](ai/) — Configuracion de claves API para proveedores de IA

### Internacionalizacion (i18n)
- [Como agregar una clave de traduccion](i18n/how-to-add-a-translation-key.md) — Guia para agregar cadenas traducibles

## Idiomas soportados

WhyNot QA soporta los siguientes idiomas:

| Idioma | Codigo | Direccion |
|----------|------|-----------|
| Ingles | `en` | Izquierda a derecha |
| Arabe | `ar` | Derecha a izquierda |
| Frances | `fr` | Izquierda a derecha |
| Aleman | `de` | Izquierda a derecha |
| Espanol | `es` | Izquierda a derecha |

## Soporte RTL

La interfaz soporta completamente la direccion de texto de derecha a izquierda para el arabe. Cuando se selecciona el arabe:

- `dir="rtl"` se establece en el elemento HTML
- Los diseños flexbox se invierten automaticamente
- Se usan propiedades logicas de CSS (`ms-*`, `me-*`, `ps-*`, `pe-*`)
- Los iconos direccionales se reflejan usando `rtl:scale-x-[-1]`
