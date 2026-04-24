---
title: "Recon — Autorización y uso responsable"
description: "Autorización por escaneo, registro de auditoría y obligaciones legales al ejecutar Recon."
lang: es
draft: false
---

# Autorización y uso responsable

Recon ejecuta sondas activas contra objetivos web. El sondeo no autorizado es ilegal en casi todas las jurisdicciones, y Recon está diseñado en torno a una **barrera de autorización por escaneo** para que tú — la persona que lanza el escaneo — asumas explícitamente la responsabilidad cada vez.

Esta página explica qué es esa barrera, qué captura el registro de auditoría y cómo es la ley subyacente.

---

## La barrera de autorización por escaneo

Cada escaneo requiere un bloque de autorización firmado antes de ser encolado. La pasarela rechaza cualquier solicitud de escaneo que no incluya uno.

Lanzar un escaneo registra:

- El usuario que lo lanzó.
- El espacio de trabajo bajo el que se ejecutó el escaneo.
- La URL objetivo exacta (idéntica byte a byte a la enviada).
- El nivel de alcance.
- Tres confirmaciones explícitas del lanzador:
  1. «Estoy autorizado a escanear este objetivo.»
  2. «Entiendo que este escaneo enviará sondas activas.»
  3. La entidad legal que el lanzador representa.
- Una referencia opcional a una autorización por escrito (ID de ticket, hilo de correo, contrato).
- La dirección IP del lanzador y la marca de tiempo.

Esta fila es **inmutable**. No puede editarse ni eliminarse y se conserva durante toda la vida del espacio de trabajo.

Puedes revisar todas las autorizaciones registradas en **Configuración → Recon → Registro de auditoría**.

## Por qué por escaneo, no por espacio de trabajo

La autorización «por espacio de trabajo» — marcar una casilla una vez en la configuración — es común y peligrosamente débil. Significa que un nuevo miembro del equipo, o un operador meses después, podría lanzar un escaneo contra el objetivo equivocado sin nueva acreditación.

La autorización por escaneo fuerza una acción deliberada cada vez. La fricción es la característica.

## La reanudación requiere coincidencia de URL

Si un escaneo se pausa y se reanuda — manualmente o automáticamente tras un fallo transitorio — Recon compara la URL objetivo de la reanudación con la URL originalmente autorizada **byte por byte**. Cualquier diferencia (host distinto, ruta distinta, esquema distinto, incluso una barra final) provoca el rechazo de la reanudación.

Esto previene dos patrones de ataque reales:

- **Deriva por redirección.** El DNS o redirección HTTP del objetivo cambia entre pausa y reanudación, dirigiendo silenciosamente las sondas a un host distinto.
- **Deriva por error tipográfico.** Un operador edita la URL durante la solución de problemas y amplía accidentalmente el alcance.

Si una reanudación es rechazada por discrepancia de URL, lanza un escaneo nuevo con un bloque de autorización nuevo.

## Los exploits de clase escritura nunca se reintentan automáticamente

Recon clasifica cada exploit candidato como `read` (no destructivo — lee datos, prueba existencia) o `write` (destructivo — modifica estado, crea, elimina o modifica). Un exploit **read** fallido puede reintentarse bajo límites de tasa y reintento. Un exploit **write** fallido se registra una vez y nunca se reintenta dentro del escaneo, ni siquiera si el ejecutor falla y se reanuda.

Es una propiedad de seguridad deliberada: una carga útil destructiva que tuvo éxito a medias podría dejar el objetivo en un estado parcial o corrupto. Reintentar podría agravar el daño. Si el hallazgo necesita reverificación, lanza un escaneo nuevo.

## Lo que Recon no hace

- Recon **no** realiza pruebas de denegación de servicio. Las pruebas de carga, ataques volumétricos y sondas de agotamiento de recursos están fuera del alcance y no pueden activarse.
- Recon **no** escanea objetivos que no autorices explícitamente. No hay un botón de «escanear toda mi organización».
- Recon **no** almacena cargas útiles de exploit en bruto en los registros a nivel INFO o superior. Las cadenas con forma de carga útil se redactan antes del registro. Consulta la documentación interna de la plataforma para la lista completa.

## Tus obligaciones legales — resumen en lenguaje claro

> **Esto es un resumen en lenguaje claro, no asesoramiento legal.** Si tienes dudas, consulta a un abogado especializado en tu jurisdicción.

### Estados Unidos — Computer Fraud and Abuse Act (CFAA)

La CFAA (18 U.S.C. § 1030) tipifica como delito federal acceder a un ordenador «sin autorización» o «exceder el acceso autorizado». En el contexto de Recon, esto significa que debes tener permiso explícito — de alguien legalmente facultado para darlo — para escanear el objetivo. El alcance de un programa de bug bounty, una carta de encargo de pentest o un contrato firmado suelen cumplir. Escanear un objetivo porque te «pareció interesante» no.

### Unión Europea — NIS2 y equivalentes nacionales

La mayoría de los Estados miembros de la UE tienen normas penales que reflejan la CFAA (p. ej., § 202c StGB en Alemania, ley Godfrain en Francia, art. 197 Código Penal en España). La directiva NIS2 (UE 2022/2555) añade obligaciones adicionales a entidades esenciales e importantes. La versión corta es la misma que la CFAA: sin autorización, no hay escaneo.

### Reino Unido — Computer Misuse Act 1990

Las secciones 1–3 tipifican el acceso no autorizado, el acceso no autorizado con intención y la modificación no autorizada. Las penas incluyen prisión. La ley se aplica a escaneos lanzados desde el Reino Unido y a escaneos dirigidos a sistemas británicos.

### Otras jurisdicciones

La mayoría de las jurisdicciones tienen leyes equivalentes. Si escaneas un objetivo que abarca varias jurisdicciones (p. ej., el centro de datos europeo de una empresa estadounidense), asume que la ley aplicable más estricta rige tu conducta.

## Programas de bug bounty

Si ejecutas Recon contra un objetivo de bug bounty:

- Confirma que tu actividad está dentro del alcance publicado del programa.
- Confirma que el sondeo activo está permitido (algunos programas restringen al testing pasivo).
- Pega la URL de autorización del programa en el campo de referencia de autorización por escrito al lanzar el escaneo.
- Guarda la entrada del registro de auditoría de autorización — podrías necesitar mostrarla si un hallazgo es disputado.

## Banderas rojas — no escanees

**No** lances un escaneo si se aplica alguno de estos puntos:

- No estás seguro de quién es el dueño del objetivo.
- Tu autorización es oral y no está documentada.
- Estás escaneando «para ver qué pasa».
- El objetivo es producción en vivo y el dueño no ha consentido explícitamente al sondeo activo.
- No entiendes las opciones de alcance y su impacto.

---

Relacionado:

- [Inicio rápido](quickstart.md) — cómo lanzar un escaneo.
- [Entender los hallazgos](understanding-findings.md) — cómo leer gravedad y resultados de explotación.
- [Solución de problemas](troubleshooting.md) — errores de autorización y qué significan.
