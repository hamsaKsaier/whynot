---
title: "Recon — Solución de problemas"
description: "Fallos habituales al ejecutar escaneos Recon y cómo arreglarlos."
lang: es
draft: false
---

# Solución de problemas

Esta página cubre los modos de fallo más habituales al lanzar o ejecutar un escaneo Recon, con la causa y la solución. Si te encuentras con algo no listado aquí, contacta con soporte e incluye el ID del escaneo de la URL.

---

## No veo Recon en la barra lateral

**Causa.** La bandera de característica `recon_enabled` está apagada para tu espacio de trabajo.

**Solución.** Pide a un propietario del espacio de trabajo que active Recon en **Configuración → Banderas de características**. Si eres el propietario y no ves la bandera, tu plan no incluye Recon — ver [Cuotas](quotas.md).

## «Se requiere autorización» — error 400 al lanzar un escaneo

**Causa.** La petición de nuevo escaneo llegó a la pasarela sin un bloque de autorización válido. Esto suele significar que una de las tres casillas de confirmación no estaba marcada, o que el formulario se envió antes de rellenar el campo de entidad legal.

**Solución.**

1. Abre el asistente de nuevo escaneo otra vez.
2. En el paso de autorización, marca las tres casillas:
   - «Estoy autorizado a escanear este objetivo.»
   - «Entiendo que este escaneo enviará sondas activas.»
   - La entidad legal que representas.
3. Reenvía.

Si sigue saliendo el error, comprueba la consola del navegador por una carga útil de petición que carezca del campo `authorization` — esto puede pasar si una extensión del navegador reescribe los envíos de formulario.

## Advertencia «Repositorio no conectado» en el asistente

**Causa.** Elegiste un objetivo cuyo entorno está asociado a un repositorio git, pero ese repositorio no está actualmente conectado al espacio de trabajo.

**Solución.** Esto es una advertencia, no un bloqueador. Puedes lanzar el escaneo sin un repositorio conectado — Recon saltará la fase de análisis basado en código fuente. Para activar el análisis basado en código fuente:

1. Abre **Configuración → Integraciones**.
2. Conecta el repositorio (GitHub, GitLab, Bitbucket).
3. Relanza el escaneo.

El coste en créditos incluido en el asistente es el mismo con o sin repositorio conectado; la señal más profunda solo hace los hallazgos más precisos.

## «Falta la URL del entorno» al lanzar

**Causa.** El entorno seleccionado no tiene una `base_url` establecida.

**Solución.** Abre el entorno en **Configuración → Entornos**, establece una URL base (debe ser `https://` en la mayoría de espacios de trabajo), guarda y reabre el asistente.

## Un escaneo lleva horas en «en ejecución»

**Primero, comprueba el límite de créditos por escaneo.** Un escaneo que alcanza el límite se termina limpiamente y pasa al estado `terminated` — no aparece atascado. Si el límite es `0`, esa no es la causa.

**Segundo, comprueba el indicador de fase** en la página de detalles del escaneo. Si la misma fase se muestra durante más de una hora sin progreso, el escaneo está realmente atascado.

**Solución.**

1. Haz clic en **Pausar** en la página de detalles.
2. Espera 30 segundos.
3. Haz clic en **Reanudar**. Ten en cuenta que la reanudación requiere que la URL objetivo original coincida byte por byte con la URL objetivo reanudada — ver [Uso responsable](responsible-use.md#la-reanudación-requiere-coincidencia-de-url).
4. Si el escaneo no se reanuda con éxito, haz clic en **Cancelar** y lanza un escaneo nuevo. No se te facturará por las fases incompletas.

Si varios escaneos se atascan en la misma fase contra el mismo objetivo, el objetivo puede estar limitando la tasa de Recon. Reduce el alcance de Profundo a Estándar, o contacta con soporte.

## La reanudación falló con «discrepancia de URL»

**Causa.** La URL objetivo cambió entre la pausa y la reanudación. Esta es una verificación de seguridad deliberada — ver [Uso responsable](responsible-use.md#la-reanudación-requiere-coincidencia-de-url).

**Solución.** Lanza un escaneo nuevo con un bloque de autorización nuevo. No intentes saltarte la verificación de URL; existe por una razón.

## La prueba de concepto de un hallazgo no se reproduce manualmente

**Causas posibles.**

- El estado del objetivo cambió entre el escaneo y tu repetición manual (aterrizó una corrección, expiró una sesión, se cambió una bandera de característica).
- La prueba de concepto depende de una cookie de sesión o token de auth que se ha rotado desde entonces.
- El escaneo explotó una condición de carrera que no se reproduce de forma fiable.

**Solución.**

1. Reescanea el objetivo. Si el hallazgo reaparece, sigue activo; si no, probablemente fue corregido.
2. Si el hallazgo reaparece pero aún no puedes reproducirlo manualmente, inspecciona la sección **Brechas de cobertura** del informe — la sonda original puede haber usado credenciales que tú no tienes.
3. Si sospechas un falso positivo real, haz clic en **Reportar falso positivo** en la tarjeta del hallazgo. La pipeline los usa para mejorar la puntuación de confianza. Ver [Entender los hallazgos — política de falsos positivos](understanding-findings.md#política-de-falsos-positivos).

## «Presupuesto de escaneo excedido — límite del espacio de trabajo alcanzado»

**Causa.** Tu espacio de trabajo ha alcanzado su cupo mensual de escaneos o créditos Recon, y la facturación PAYG está deshabilitada (plan Free, o tu contacto de facturación deshabilitó explícitamente el sobrepaso).

**Solución.** Actualiza a un plan de pago, activa PAYG o espera al siguiente ciclo de facturación. Ver [Cuotas](quotas.md).

## Un hallazgo que esperaba ver falta en el informe

**Causas posibles.**

- El hallazgo no tenía prueba de concepto reproducible y fue suprimido bajo la política **sin exploit, sin informe**. Ver [Entender los hallazgos](understanding-findings.md#sin-exploit-sin-informe).
- El hallazgo fue descartado previamente como `false_positive`, `accepted_risk`, `duplicate` u `out_of_scope` y se suprime de los escaneos siguientes.
- El endpoint que aloja el problema está en una brecha de cobertura (auth requerida, WAF bloqueando, presupuesto de rastreo agotado). Comprueba la sección **Brechas de cobertura**.

**Solución.** Abre **Recon → Hallazgos → Todos (incluyendo descartados)** para ver hallazgos suprimidos y descartados. Si un problema real se está suprimiendo, deshaz su descarte en la tarjeta del hallazgo.

## La advertencia «Entorno de producción seleccionado» bloquea mi flujo

**Esta advertencia no bloquea.** Es un intersticial en el asistente. Aún puedes lanzar el escaneo; la advertencia existe para asegurarse de que realmente querías escanear producción.

Si encuentras la advertencia molesta porque escaneas producción deliberada y frecuentemente, estamos abiertos a añadir un interruptor por espacio de trabajo «Siempre escaneo producción, suprimir esta advertencia». Abre una solicitud de característica.

## Necesito eliminar un escaneo

Los propietarios del espacio de trabajo pueden eliminar un escaneo desde la página de detalles (**Más → Eliminar escaneo**). Eliminar un escaneo quita:

- La fila del escaneo.
- Los hallazgos.
- El informe.

Eliminar un escaneo **no** quita la fila del registro de auditoría de autorización — esas son inmutables durante toda la vida del espacio de trabajo.

## ¿Sigues atascado?

- Para problemas a nivel de plataforma (errores de UI, problemas de inicio de sesión): [documentación de solución de problemas](../../TROUBLESHOOTING.md) general.
- Para problemas específicos de Recon no cubiertos aquí: contacta con soporte con el ID del escaneo de la URL.

---

Relacionado:

- [Inicio rápido](quickstart.md)
- [Uso responsable](responsible-use.md)
- [Entender los hallazgos](understanding-findings.md)
- [Leer los informes](reading-reports.md)
- [Cuotas y facturación](quotas.md)
