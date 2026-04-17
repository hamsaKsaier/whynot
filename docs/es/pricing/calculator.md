---
title: "Calculadora de Creditos"
description: "Estime su consumo mensual de creditos y elija el plan adecuado con escenarios de ejemplo y consejos de optimizacion."
lang: es
draft: false
---

# Calculadora de Creditos

La calculadora de creditos de WhyNot le permite estimar el consumo mensual de su equipo y seleccionar el paquete de creditos mas adecuado. Esta guia explica como utilizarla y presenta escenarios de ejemplo para equipos de diferentes tamanos.

---

## Como Utilizar la Calculadora

### Paso 1: Ingrese los Parametros de su Equipo

Acceda a la calculadora desde **Panel de control > Facturacion > Calculadora de creditos** o desde la pagina de precios en el sitio web. Complete los siguientes campos:

| Campo | Descripcion | Ejemplo |
|---|---|---|
| **Numero de ingenieros** | Cantidad de miembros del equipo que usaran la plataforma | 10 |
| **Pruebas generadas por ingeniero/mes** | Promedio de pruebas nuevas que cada ingeniero genera mensualmente | 20 |
| **Ejecuciones por prueba/mes** | Cuantas veces se ejecuta cada prueba al mes (incluyendo re-ejecuciones) | 5 |
| **QA Loops por ingeniero/mes** | Ciclos automatizados de QA por ingeniero | 4 |
| **Auto-fixes por ingeniero/mes** | Correcciones automaticas solicitadas por ingeniero | 2 |
| **Paginas con regresion visual** | Numero de paginas monitoreadas por regresion visual | 15 |
| **Frecuencia de regresion visual** | Veces al mes que se ejecuta la regresion visual | 4 |
| **Sesiones de QA Monitor/mes** | Sesiones de monitoreo continuo al mes | 10 |
| **CI Scans por mes** | Analisis de CI/CD ejecutados al mes | 20 |

### Paso 2: Revise el Resultado y Ajuste

La calculadora mostrara:

- **Consumo total estimado** en creditos por mes
- **Desglose por operacion** para identificar que funciones consumen mas creditos
- **Paquete recomendado** basado en su consumo estimado
- **Costo mensual estimado** en dolares

Despues, modifique los parametros para explorar diferentes escenarios:

- Reduzca la frecuencia de operaciones costosas (QA Monitor, CI Scan)
- Aumente las ejecuciones de prueba (bajo costo) para mayor cobertura
- Ajuste la regresion visual a las paginas mas criticas

---

## Escenarios de Ejemplo

### Escenario 1: Equipo Pequeno (5 Ingenieros)

Un equipo de inicio o startup con 5 ingenieros que trabajan en una aplicacion web de tamano moderado.

**Parametros:**

| Parametro | Valor |
|---|---|
| Ingenieros | 5 |
| Pruebas generadas / ingeniero / mes | 15 |
| Ejecuciones por prueba / mes | 4 |
| QA Loops / ingeniero / mes | 3 |
| Auto-fixes / ingeniero / mes | 1 |
| Paginas con regresion visual | 10 |
| Frecuencia de regresion visual / mes | 2 |
| Sesiones de QA Monitor / mes | 5 |
| CI Scans / mes | 10 |

**Calculo:**

| Operacion | Formula | Creditos |
|---|---|---|
| Generacion de pruebas | 5 x 15 x 50 | 3.750 |
| Ejecucion de pruebas | 5 x 15 x 4 x 10 | 3.000 |
| QA Loop | 5 x 3 x 30 | 450 |
| Auto-fix | 5 x 1 x 100 | 500 |
| Regresion visual | 10 x 2 x 15 | 300 |
| QA Monitor | 5 x 200 | 1.000 |
| CI Scan | 10 x 200 | 2.000 |
| **Total mensual** | | **11.000** |

**Recomendacion:** Paquete **Growth** (10.000 creditos / $80) + Paquete **Starter** (1.000 creditos / $10) = **$90/mes**. Alternativamente, un solo paquete Growth con recarga automatica de Starter al alcanzar el umbral.

---

### Escenario 2: Equipo Mediano (20 Ingenieros)

Un equipo de desarrollo de tamano mediano con multiples proyectos activos y necesidades de regresion visual y monitoreo regulares.

**Parametros:**

| Parametro | Valor |
|---|---|
| Ingenieros | 20 |
| Pruebas generadas / ingeniero / mes | 20 |
| Ejecuciones por prueba / mes | 6 |
| QA Loops / ingeniero / mes | 5 |
| Auto-fixes / ingeniero / mes | 3 |
| Paginas con regresion visual | 40 |
| Frecuencia de regresion visual / mes | 4 |
| Sesiones de QA Monitor / mes | 20 |
| CI Scans / mes | 40 |

**Calculo:**

| Operacion | Formula | Creditos |
|---|---|---|
| Generacion de pruebas | 20 x 20 x 50 | 20.000 |
| Ejecucion de pruebas | 20 x 20 x 6 x 10 | 24.000 |
| QA Loop | 20 x 5 x 30 | 3.000 |
| Auto-fix | 20 x 3 x 100 | 6.000 |
| Regresion visual | 40 x 4 x 15 | 2.400 |
| QA Monitor | 20 x 200 | 4.000 |
| CI Scan | 40 x 200 | 8.000 |
| **Total mensual** | | **67.400** |

**Recomendacion:** Paquete **Scale** (100.000 creditos / $600). Este paquete cubre el consumo mensual con un margen de aproximadamente 32.600 creditos para meses de mayor actividad. **Costo: $600/mes**.

---

### Escenario 3: Equipo Grande (50+ Ingenieros)

Una organizacion empresarial con mas de 50 ingenieros, multiples productos, pipelines de CI/CD complejos y monitoreo continuo a gran escala.

**Parametros:**

| Parametro | Valor |
|---|---|
| Ingenieros | 50 |
| Pruebas generadas / ingeniero / mes | 25 |
| Ejecuciones por prueba / mes | 8 |
| QA Loops / ingeniero / mes | 6 |
| Auto-fixes / ingeniero / mes | 4 |
| Paginas con regresion visual | 100 |
| Frecuencia de regresion visual / mes | 8 |
| Sesiones de QA Monitor / mes | 50 |
| CI Scans / mes | 100 |

**Calculo:**

| Operacion | Formula | Creditos |
|---|---|---|
| Generacion de pruebas | 50 x 25 x 50 | 62.500 |
| Ejecucion de pruebas | 50 x 25 x 8 x 10 | 100.000 |
| QA Loop | 50 x 6 x 30 | 9.000 |
| Auto-fix | 50 x 4 x 100 | 20.000 |
| Regresion visual | 100 x 8 x 15 | 12.000 |
| QA Monitor | 50 x 200 | 10.000 |
| CI Scan | 100 x 200 | 20.000 |
| **Total mensual** | | **233.500** |

**Recomendacion:** 3 paquetes **Scale** (300.000 creditos / $1.800). Para volumenes de esta magnitud, se recomienda contactar al equipo de ventas en **sales@whynot.com** para obtener precios empresariales personalizados que pueden ofrecer descuentos adicionales superiores al 40%.

---

## Consejos para Optimizar el Consumo de Creditos

### 1. Priorice las Ejecuciones sobre las Generaciones

La ejecucion de pruebas cuesta solo **10 creditos**, mientras que la generacion cuesta **50 creditos**. Genere pruebas de alta calidad una vez y ejecutelas multiples veces en lugar de regenerar pruebas constantemente.

### 2. Utilice QA Loop en Lugar de Auto-fix Individual

Un QA Loop cuesta **30 creditos** y puede detectar multiples problemas en un ciclo. Un Auto-fix cuesta **100 creditos** por cada correccion individual. Use QA Loop primero para identificar patrones y reserve Auto-fix para correcciones complejas.

### 3. Enfoque la Regresion Visual en Paginas Criticas

No necesita ejecutar regresion visual en todas las paginas. Identifique las 10 a 20 paginas mas criticas para su negocio (pagina de inicio, flujo de pago, panel principal) y centre la regresion visual en ellas.

### 4. Escalone las Sesiones de QA Monitor

En lugar de ejecutar QA Monitor diariamente, considere una frecuencia de 2 a 3 veces por semana para la mayoria de los servicios. Reserve el monitoreo diario para los servicios mas criticos.

### 5. Agrupe los CI Scans

Si su equipo realiza multiples despliegues al dia, considere agrupar los CI Scans en etapas clave del pipeline en lugar de ejecutarlos en cada commit. Un escaneo en la rama principal antes del despliegue suele ser suficiente.

### 6. Active la Recarga Automatica con el Paquete Adecuado

Configure la recarga automatica con el paquete que ofrezca el mejor precio por credito para su volumen. Esto evita interrupciones y asegura que siempre tenga el mejor precio disponible.

### 7. Revise el Historial de Uso Mensualmente

Acceda a **Configuracion > Facturacion > Historial de uso** al menos una vez al mes para:

- Identificar operaciones con consumo inesperadamente alto
- Detectar usuarios o proyectos que consuman creditos de manera desproporcionada
- Ajustar la frecuencia de operaciones costosas segun los resultados obtenidos

---

## Resumen

**Comparativa de escenarios:**

| Metrica | Equipo Pequeno (5) | Equipo Mediano (20) | Equipo Grande (50+) |
|---|---|---|---|
| Creditos / mes | 11.000 | 67.400 | 233.500 |
| Paquete recomendado | Growth + Starter | Scale | Scale x3 (o empresarial) |
| Costo estimado / mes | $90 | $600 | $1.800 (o personalizado) |
| Costo por ingeniero / mes | $18 | $30 | $36 (o menor con plan empresarial) |
| Operacion de mayor consumo | Generacion de pruebas (34%) | Ejecucion de pruebas (36%) | Ejecucion de pruebas (43%) |

**Referencia rapida de costos por operacion:**

| Operacion | Creditos | Costo con Starter ($0,0100) | Costo con Growth ($0,0080) | Costo con Scale ($0,0060) |
|---|---|---|---|---|
| Generacion de pruebas | 50 | $0,50 | $0,40 | $0,30 |
| Ejecucion de pruebas | 10 | $0,10 | $0,08 | $0,06 |
| QA Loop | 30 | $0,30 | $0,24 | $0,18 |
| Auto-fix | 100 | $1,00 | $0,80 | $0,60 |
| Regresion visual | 15 | $0,15 | $0,12 | $0,09 |
| QA Monitor | 200 | $2,00 | $1,60 | $1,20 |
| CI Scan | 200 | $2,00 | $1,60 | $1,20 |

Para obtener mas informacion sobre los creditos y paquetes disponibles, consulte la documentacion de [creditos pay-as-you-go](payg.md). Para conocer los planes y sus caracteristicas, visite la documentacion de [planes y precios](plans.md).
