---
title: "Creditos Pay-As-You-Go"
description: "Adquiera creditos adicionales ademas del cupo de su plan. Conozca como funcionan los creditos, el costo de cada operacion y que paquete elegir."
lang: es
draft: false
---

# Creditos Pay-As-You-Go

## Descripcion General

Los creditos son la unidad de consumo de WhyNot. Cada operacion que realice en la plataforma consume una cantidad especifica de creditos. Este modelo le permite pagar unicamente por lo que utiliza, sin compromisos fijos por operacion.

---

## Costo de Creditos por Operacion

Cada tipo de operacion tiene un costo fijo en creditos:

| Operacion | Creditos por operacion | Descripcion |
|---|---|---|
| **Generacion de pruebas** | 50 | Genera un caso de prueba a partir de su codigo fuente o especificacion |
| **Ejecucion de pruebas** | 10 | Ejecuta un caso de prueba individual contra su aplicacion |
| **QA Loop** | 30 | Ciclo automatizado de prueba, validacion y retroalimentacion |
| **Auto-fix** | 100 | Analiza un fallo y genera una correccion de codigo sugerida |
| **Regresion visual** | 15 | Compara capturas de pantalla entre dos versiones de la aplicacion |
| **QA Monitor** | 200 | Sesion de monitoreo continuo de calidad en produccion |
| **CI Scan** | 200 | Analisis completo de calidad integrado en su pipeline de CI/CD |

### Ejemplos de Consumo

- Generar 10 pruebas y ejecutarlas: (10 x 50) + (10 x 10) = **600 creditos**
- Ejecutar un QA Loop completo con auto-fix: 30 + 100 = **130 creditos**
- Monitoreo diario con QA Monitor (30 dias): 30 x 200 = **6.000 creditos**
- Regresion visual en 20 paginas: 20 x 15 = **300 creditos**

---

## Paquetes de Creditos

Adquiera paquetes de creditos segun el volumen que necesite. Los paquetes mas grandes ofrecen un mejor precio por credito:

| Paquete | Creditos | Precio | Precio por credito | Ahorro |
|---|---|---|---|---|
| **Starter** | 1.000 | $10 | $0,0100 | -- |
| **Growth** | 10.000 | $80 | $0,0080 | 20% |
| **Scale** | 100.000 | $600 | $0,0060 | 40% |

### Comparativa de Valor

Con el paquete **Starter** ($10 / 1.000 creditos) puede realizar aproximadamente:

- 20 generaciones de pruebas, o
- 100 ejecuciones de pruebas, o
- 10 auto-fixes, o
- 5 sesiones de QA Monitor

Con el paquete **Scale** ($600 / 100.000 creditos) puede realizar aproximadamente:

- 2.000 generaciones de pruebas, o
- 10.000 ejecuciones de pruebas, o
- 1.000 auto-fixes, o
- 500 sesiones de QA Monitor

---

## Como Funcionan los Creditos

### Adquisicion

1. Acceda a **Configuracion > Facturacion > Creditos** en su panel de control.
2. Seleccione el paquete de creditos que desee adquirir.
3. Complete el pago con su metodo de pago registrado.
4. Los creditos se acreditan de forma inmediata en su cuenta.

### Consumo y Notificaciones

- Los creditos se descuentan automaticamente al ejecutar cada operacion.
- Puede consultar el saldo disponible en todo momento desde el panel de facturacion.
- El historial detallado de consumo esta disponible en **Configuracion > Facturacion > Historial de uso**.
- Recibira una notificacion por correo electronico cuando su saldo alcance el 20% del total adquirido, y una segunda notificacion al llegar al 5%.
- Puede configurar umbrales de notificacion personalizados en la seccion de configuracion.

### Recarga Automatica (Opcional)

Active la recarga automatica para evitar interrupciones en sus flujos de trabajo:

1. Acceda a **Configuracion > Facturacion > Recarga automatica**.
2. Defina el umbral minimo de creditos (por ejemplo, 500 creditos).
3. Seleccione el paquete que se adquirira automaticamente al alcanzar el umbral.
4. Confirme su metodo de pago.

---

## Preguntas Frecuentes

### Los creditos tienen fecha de vencimiento?

Si. Los creditos vencen **12 meses** despues de la fecha de compra. Los creditos mas antiguos se consumen primero (modelo FIFO: primero en entrar, primero en salir). Recibira notificaciones 30 dias antes del vencimiento de cualquier lote de creditos.

### Que sucede si me quedo sin creditos?

Cuando su saldo llega a cero, las operaciones que consumen creditos se pausan. Usted puede:

- Adquirir un nuevo paquete de creditos para reanudar inmediatamente.
- Activar la recarga automatica para evitar interrupciones futuras.
- Las operaciones en cola se ejecutaran automaticamente una vez que se acrediten nuevos creditos.

**Nota:** Las operaciones basicas de la plataforma (navegacion, configuracion, visualizacion de resultados historicos) permanecen disponibles sin creditos.

### Puedo transferir creditos entre cuentas?

No. Los creditos estan vinculados a la cuenta en la que fueron adquiridos y no pueden transferirse a otra cuenta u organizacion.

### Que sucede con los creditos si cancelo mi plan?

- Si cancela su plan de pago, los creditos restantes permanecen disponibles hasta su fecha de vencimiento.
- Si su cuenta se elimina, los creditos pendientes se pierden y no son reembolsables.

### Como se cobran las operaciones que fallan?

- Si una operacion falla por un error del sistema, los creditos **no se descuentan**.
- Si una operacion falla por un error en la configuracion del usuario (por ejemplo, una URL invalida), los creditos **si se descuentan**.
- Puede revisar el detalle de cada operacion y su estado en el historial de uso.

### Puedo obtener un reembolso de creditos?

Los creditos adquiridos no son reembolsables. Si considera que se le han cobrado creditos de manera incorrecta, contacte a nuestro equipo de soporte en **support@whynot.com** con el detalle de la operacion en cuestion.

### Existe un limite de compra de creditos?

No existe un limite maximo de compra. Puede adquirir multiples paquetes segun lo requiera. Para volumenes superiores a 500.000 creditos, contacte a nuestro equipo de ventas para obtener precios personalizados.

---

## Resumen Rapido

| Concepto | Detalle |
|---|---|
| Unidad de consumo | Credito |
| Operacion mas economica | Ejecucion de pruebas (10 creditos) |
| Operacion mas costosa | QA Monitor / CI Scan (200 creditos) |
| Paquete minimo | Starter: 1.000 creditos por $10 |
| Paquete maximo | Scale: 100.000 creditos por $600 |
| Vencimiento | 12 meses desde la compra |
| Modelo de consumo | FIFO (primero en entrar, primero en salir) |
