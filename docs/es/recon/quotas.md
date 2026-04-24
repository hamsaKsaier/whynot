---
title: "Recon — Cuotas y facturación"
description: "Inclusiones por plan, tarifas PAYG, facturación de escaneos parciales y límites de créditos por escaneo para Recon."
lang: es
draft: false
---

# Cuotas y facturación

Los escaneos de Recon consumen **créditos** del cupo mensual de tu espacio de trabajo. Cuando excedes el cupo, los créditos adicionales se facturan a la tarifa de pago por uso (PAYG). Esta página explica qué está incluido, qué cuesta extra y cómo funciona la facturación de escaneos parciales.

Para los precios de los planes subyacentes (Free, Pro BYO, Pro Managed), consulta la [página de precios](/pricing) en vivo.

---

## Qué incluye cada plan

| Plan | Escaneos Recon incluidos | Escaneo de superficie | Escaneo estándar | Escaneo profundo |
|------|---------------------------|------------------------|------------------|------------------|
| **Free** | 1/mes, solo superficie | ✓ | — | — |
| **Pro BYO** | 5/mes, cualquier alcance | ✓ | ✓ | ✓ |
| **Pro Managed** | Ilimitado (uso justo), cualquier alcance | ✓ | ✓ | ✓ |

Los escaneos incluidos se descuentan de los créditos incluidos en tu cupo mensual. Una vez agotados, los escaneos adicionales se facturan a tarifas PAYG.

## Coste de créditos por escaneo

El coste exacto en créditos depende de la complejidad del objetivo (número de endpoints, parámetros, tamaño de respuesta), pero los rangos típicos son:

| Alcance | Créditos típicos | Notas |
|---------|------------------|-------|
| Superficie | 50–200 | Reconocimiento pasivo, sin sondeo activo. |
| Estándar | 500–2 000 | Superficie + sondas activas para clases de vulnerabilidades comunes. |
| Profundo | 2 000–10 000 | Estándar + sondeo autenticado + rastreo extendido. |

El asistente muestra el **coste estimado** para el alcance elegido antes del lanzamiento. El coste final se calcula tras finalizar el escaneo y se muestra en la página de detalles.

## Tarifas de pago por uso

Cuando excedes tus créditos incluidos, los créditos adicionales se facturan a la tarifa PAYG estándar. Consulta la [documentación PAYG](../pricing/payg.md) para el precio vigente por crédito y cualquier descuento por volumen.

## Facturación de escaneos parciales

A veces un escaneo termina antes de completar todas sus fases — lo cancelas, se alcanza el límite de créditos por escaneo, o un fallo transitorio lo detiene. En estos casos:

- Se factura **solo por las fases completadas**.
- Una fase iniciada pero no terminada **no** se factura.
- La página de detalles muestra el desglose exacto de coste por fase.

Si un escaneo falla por completo sin producir datos útiles, el coste se reembolsa automáticamente a tu espacio de trabajo dentro de 24 horas. No necesitas abrir un ticket de soporte para fallos rutinarios.

## Límite de créditos por escaneo

Para evitar facturas sorpresa en un objetivo mal configurado, establece un **límite de créditos por escaneo** en **Configuración → Recon**.

| Valor del límite | Efecto |
|------------------|--------|
| `0` | Sin límite a nivel de espacio de trabajo. Se aplica el predeterminado de la plataforma. |
| `1` a `100000` | Límite estricto para un solo escaneo. Recon termina el escaneo antes de iniciar la siguiente fase pagada que excedería el límite. |

El límite se aplica antes de iniciar cada fase, por lo que puedes pagar ligeramente menos que el límite (lo que costara la última fase completada) pero nunca más.

Valores iniciales recomendados:

- **Free / evaluación** — déjalo en `0` (sin límite; confía en el cupo incluido).
- **Pro BYO** — establece a `5000` si escaneas objetivos de producción regularmente.
- **Pro Managed** — establece a `15000` si ejecutas escaneos profundos frecuentes.

Ajusta basándote en tu historial real de escaneos; la página de detalles muestra el coste de cada escaneo previo.

## Visibilidad de la cuota

El uso de Recon se muestra en dos lugares:

- **Configuración → Facturación → Uso**, junto con otros usos del producto (ejecuciones de tests, generaciones de IA, etc.).
- **Recon → Configuración → Recon → Uso**, con un desglose específico de Recon que incluye cargos PAYG.

Ambas vistas son en tiempo real. No hay sorpresas a fin de mes.

## Garantías estrictas

- **Sin cargos sorpresa.** Un escaneo que excedería tu límite por escaneo se termina, no se factura más allá del límite.
- **Sin cambios de precio retroactivos.** Si cambiamos tarifas PAYG, la nueva tarifa se aplica a los escaneos lanzados tras el cambio. Los escaneos en curso se facturan a la tarifa del momento del lanzamiento.
- **Sin sobrepaso sin advertencia.** Cuando cruzas el 80 % de tu cupo mensual, el contacto de facturación recibe un correo.

## Preguntas frecuentes

**¿Cuesta créditos un escaneo fallido?**
Se factura solo por fases completadas. Una fase no terminada no se factura. Un escaneo que falla antes de completar cualquier fase se reembolsa por completo dentro de 24 horas.

**¿Cuesta menos un reescaneo del mismo objetivo?**
No. Cada escaneo es independiente. Actualmente no ofrecemos almacenamiento en caché entre escaneos.

**¿Puedo compartir los escaneos incluidos entre espacios de trabajo?**
No. Los escaneos incluidos pertenecen al espacio de trabajo al que se emiten.

**¿Qué cuenta como «escaneo» para el límite mensual del plan Free?**
Cualquier escaneo lanzado con éxito, incluso si lo cancelas antes de que termine. Un escaneo rechazado por la pasarela (p. ej., autorización ausente, bandera deshabilitada) no cuenta.

---

Relacionado:

- [Precios — planes](../pricing/plans.md) — inclusiones globales por plan.
- [Precios — pago por uso](../pricing/payg.md) — tarifas PAYG y descuentos por volumen.
- [Inicio rápido](quickstart.md) — cómo lanzar tu primer escaneo.
