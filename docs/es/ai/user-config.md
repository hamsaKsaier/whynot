---
title: "Configuracion de IA del usuario"
description: "Como funcionan los ajustes de proveedor de IA desde la perspectiva del usuario en WhyNot QA."
lang: es
draft: false
---

# Configuración de IA del usuario

Esta guía explica cómo funcionan los ajustes de proveedor de IA desde la perspectiva del usuario, incluyendo niveles de suscripción, gestión de claves y respaldo a claves de la plataforma.

## Niveles de suscripción

WhyNot QA ofrece dos niveles de suscripción que determinan cómo se accede a los proveedores de IA:

### Trae tus propias claves (`byo_keys`)

Planes: **Gratuito**, **Pro (BYO)**

- Los usuarios **deben** proporcionar sus propias claves API para usar las funciones de IA
- Sin acceso a claves gestionadas por la plataforma
- Los usuarios configuran proveedores en **Configuración → IA**
- Las claves se cifran en reposo con AES-256-GCM

### Gestionado + Pago por uso (`managed_payg`)

Planes: **Pro (Gestionado + PAYG)**

- La plataforma proporciona claves de IA preconfiguradas — no se requiere configuración
- Los usuarios pagan por uso
- Los usuarios **pueden opcionalmente** agregar sus propias claves para acceso personalizado
- Cuando un usuario tiene su propia clave configurada, tiene prioridad sobre las claves de la plataforma

## Cómo funciona la selección de proveedor

1. El sistema primero verifica si el usuario tiene una clave API personal configurada
2. Si existe una clave personal y está establecida como predeterminada, se utiliza
3. Si no existe clave personal y el usuario está en un plan `managed_payg`, se usa el proveedor predeterminado de la plataforma
4. Si no existe clave personal y el usuario está en un plan `byo_keys`, las funciones de IA no están disponibles

## Proveedores configurados por el administrador

La lista de proveedores disponibles está controlada por el administrador en **Admin → Proveedores de IA**. Solo los proveedores activados por el administrador aparecen en el desplegable del usuario.

La opción `Personalizado (compatible con OpenAI)` siempre está disponible.

## Pestaña de configuración (`Configuración → IA`)

### Para usuarios `byo_keys`

- Un banner explica que se requieren claves API
- Si no hay claves configuradas, se muestra un aviso para agregar una

### Para usuarios `managed_payg`

- Un banner indica que el acceso gestionado a IA está incluido en el plan
- Si no hay claves personales configuradas, se muestra el proveedor predeterminado actual de la plataforma

### Agregar una clave de proveedor

1. Haz clic en **Agregar proveedor**
2. Selecciona un proveedor del desplegable
3. Selecciona un modelo
4. Para el proveedor "Personalizado", ingresa la URL base
5. Ingresa la clave API
6. Haz clic en **Guardar**

### Gestion de claves

- **Probar conexion**: Verifica que la clave API funcione realizando una solicitud de prueba
- **Establecer como predeterminado**: Hace que este proveedor sea el predeterminado para las operaciones de IA
- **Eliminar**: Elimina la configuracion del proveedor

## Respaldo a claves de la plataforma

Para usuarios `managed_payg`, la plataforma mantiene una cadena de respaldo de proveedores de IA configurada por el administrador. Si el proveedor principal falla, el sistema intenta automaticamente con el siguiente proveedor en el orden de respaldo.

El orden de respaldo y el proveedor predeterminado se configuran en **Admin → Proveedores de IA → Valores predeterminados de facturacion**.
