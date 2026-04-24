---
title: "Recon — Integración CI"
description: "Activa escaneos Recon desde tu pipeline de CI. Próximamente."
lang: es
draft: false
---

# Integración CI

> **Próximamente.** Los escaneos activados por CI están en la hoja de ruta. La forma de la integración se describe abajo; la API aún no es estable.

El objetivo de la integración CI es permitirte ejecutar automáticamente un escaneo Recon cuando un despliegue aterriza en un entorno no productivo, y luego mostrar los hallazgos en la pull request que activó el despliegue.

---

## Forma planeada

Un flujo típico:

1. Tu pipeline de CI despliega una build a un entorno de staging o preview.
2. El pipeline llama a un webhook de Recon con la URL del entorno, el SHA del commit y un token de autorización por ejecución.
3. Recon lanza un escaneo, con alcance limitado a la URL del entorno.
4. Cuando el escaneo termina, Recon publica un resumen en la pull request: recuento por gravedad, diff frente al escaneo anterior y enlace al informe completo.
5. Si se introduce un hallazgo Crítico o Alto (es decir, no estaba en el escaneo anterior), la verificación de CI falla. Los hallazgos existentes no bloquean.

La autorización es por ejecución, no por pipeline: el token de CI representa a un propietario de espacio de trabajo que ha pre-autorizado escaneos contra una lista blanca específica de URLs de entorno. Los escaneos contra cualquier otra URL requieren una autorización interactiva nueva a través del asistente.

## Por qué esto aún no se ha lanzado

La integración CI multiplica la superficie de la barrera de autorización por escaneo, y equivocarse aquí socavaría toda la historia del uso responsable. Estamos trabajando en:

- Cómo un token de CI puede acreditar la autorización sin ser un secreto de larga duración en tu proveedor de CI.
- Cómo manejar previews de despliegue donde la URL cambia por pull request.
- Cómo fallar de forma segura cuando el proveedor de CI no soporta bloquear según el estado de una verificación.

Preferimos lanzar esto una vez antes que dos veces.

## Sé un beta tester

Si quieres acceso temprano, regístrate abajo. Te contactaremos cuando la API sea lo bastante estable para comprometernos con ella.

> **Inscripción beta:** envía un correo a `recon-beta@` el dominio de tu espacio de trabajo, o abre el panel Recon → Configuración → CI y haz clic en **Unirse a la lista de espera CI beta**.

Priorizaremos equipos que:

- Ya despliegan a entornos de preview efímeros por pull request.
- Tienen un equipo de seguridad o plataforma interno que pueda revisar la integración.
- Estén dispuestos a dar feedback semanal durante la beta.

## Mientras tanto

- Usa el [Inicio rápido](quickstart.md) para lanzar escaneos manualmente tras grandes despliegues.
- Usa el [enlace compartible del informe](reading-reports.md#compartir-un-informe) para enviar resultados a ingenieros sin darles acceso al espacio de trabajo.
- Usa el [límite de créditos por escaneo](quotas.md#límite-de-créditos-por-escaneo) para controlar el coste en semanas ocupadas.

---

Relacionado:

- [Inicio rápido](quickstart.md)
- [Uso responsable](responsible-use.md)
- [Leer los informes](reading-reports.md)
