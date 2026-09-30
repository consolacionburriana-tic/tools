# Oratorios y Godly Play · plan y checklist

Un profe se lleva a media clase un rato (oratorio), o a la clase entera (Godly Play), en una hora
que **es de otro profe**. Cada tipo tiene un objetivo («un oratorio al mes por clase», «un Godly
Play al trimestre por clase») y el problema de verdad no es apuntarlo: es **elegir el hueco sin
molestar siempre al mismo profe**, avisarle con tiempo y saber cuánto falta.

Lo pidió David el 30-sep-2026. El nombre del módulo es de hoy; por dentro es genérico: un
**tipo de momento** (oratorio, Godly Play… y mañana un taller de robótica) con su objetivo, su
calendario de Google y su texto de correo.

> **La regla de oro:** el profe al que se le quita la hora no se entera por sorpresa. Nunca
> dos veces seguidas la misma hora de la misma clase con el mismo profe (aviso gordo 🔴), y a
> la vista cuántas veces se le ha «molestado» este trimestre (×2, ×3…) antes de elegir.

---

## Estado: plan funcional ✅ · plan técnico ✅ · implementado 🟡 (30-sep-2026)

Código entero escrito y **probado contra Neon y contra Google Calendar de verdad**, con sesión de
TIC en el navegador (iPad en horizontal y móvil): disponibilidad, asistente, autocompletar (24
borradores repartidos en oct-dic, las 8 clases de ESO cubiertas cada mes, numeración S1-S4
correcta), mover, reprogramar, anular, lista, números, ajustes y la vista del claustro con y sin
acceso común. Todo lo de prueba se borró de Neon al terminar: arranca vacío, solo con los dos
tipos sembrados.

**Google Calendar funciona.** A primera hora del 30-sep la API respondía *«Google Calendar API
has not been used in project 358867008935 before or it is disabled»*; a mediodía ya aceptaba
escrituras (alguien la habilitó, o terminó de propagarse). Se comprobó al confirmar una sesión de
prueba: evento `[4 ESO A] Oratorio - Paola Gómez` en el calendario de Oratorio, a las 9:50 hora
de Madrid, creado por David y con la profe invitada. ⚠️ **Esa invitación le llegó de verdad a
Paola Gómez**, y al anularla desde la app, la cancelación (evento `cancelled`). Si pregunta, era
una prueba.

**Lo que falta:** el primer envío real de un correo de aviso (plantilla revisada en render, sin
mandar a nadie) y que David confirme las decisiones marcadas 🤖 más abajo.

---

## Cómo funciona (lo que ve quien lo lleva)

`/gestion/oratorios`, cinco pestañas con iconos y poco texto:

| Pestaña | Para qué |
|---|---|
| 🗓️ **Planificar** | El asistente: semana a semana, tus huecos y quién cabe en cada uno |
| 📋 **Sesiones** | La lista: estados, avisos por correo, reprogramar, anular |
| 📊 **Números** | Hechas / programadas / por hacer por clase, y a qué profes se ha molestado más |
| ⏰ **Disponibilidad** | Tu rejilla: ⭐ óptima · 👍 alternativa · 🤏 último recurso |
| ⚙️ **Ajustes** | Tipos (objetivo, calendario, texto del correo), trimestres, acceso común |

### 1. Disponibilidad (una vez, y se retoca cuando cambie)

La rejilla de tu semana (las franjas del horario del centro) con **tu horario pintado debajo**:
se ve de un vistazo qué horas tienes libres y cuáles son de Oratorio o de Atención a familias.
Cada toque en una franja cicla ⭐ → 👍 → 🤏 → nada. El botón **⚡ Desde mi horario** marca de
golpe como ⭐ las horas que tu horario ya tiene como «Oratorio».

Se guarda por **persona responsable** (no por tipo) y por **día + hora de inicio y fin**, no
por id de tramo: reimportar horarios regenera los tramos y la disponibilidad no se pierde.

### 2. Planificar (el asistente)

Arriba: **tipo** (🙏 Oratorio · 🧸 Godly Play), **responsable** (tú por defecto; se puede
planificar en nombre de otra persona) y **rango** (Este mes · T1 · T2 · T3 · de-a).

- **🎯 La barra del objetivo**: una pastilla por clase con sus puntitos (●● hechas o
  programadas, ○ por hacer) del rango elegido. Se ve qué clase va retrasada sin leer nada.
- **La semana**: días × franjas. Tus huecos se ven con su color (⭐ verde, 👍 ámbar, 🤏 gris);
  los festivos (`hor_festivos`) y los días fuera de trimestre salen tachados; tus clases, en
  gris (estás ocupado, salvo que lo hayas marcado disponible). Flechas ◀ ▶ para la semana.
- **Tocar un hueco** abre la lista de clases que tienen clase a esa hora, **cada una con la
  materia y el profe** que la da (sale del horario) y sus avisos en símbolos:

  | | Aviso | Nivel |
  |---|---|---|
  | 🔴 | Misma clase, mismo profe y **misma hora de la semana** que la sesión anterior o siguiente de esa clase | Gordo (no prohíbe) |
  | 🟠 ×2 | Este profe ya lleva 2 este trimestre (en cualquier clase y tipo) | Medio |
  | 🟡 | Mismo profe que la sesión anterior de esta clase, aunque a otra hora | Leve |
  | 📅 | Esta clase ya tiene otra sesión ese día | Medio |
  | ⏱️ 6d | Hace solo 6 días de la anterior de esta clase | Leve |
  | 🚌 | Esa clase tiene una salida ese día (`sal_trips`) | Medio |
  | ✓ | Esta clase ya tiene cubierto el objetivo de ese mes/trimestre | Se va al final |

  Ordenadas de mejor a peor: primero las que aún necesitan sesión, luego menos avisos, luego el
  profe menos molestado. **Un toque** en la clase crea la sesión en **📝 borrador** con su número
  («Sesión 2») — dos toques por sesión.
- **✨ Autocompletar** reparte el rango de una vez: recorre los días en orden, tus huecos ⭐ y
  luego 👍 (🤏 nunca por sí solo), y en cada uno pone la mejor clase que aún necesite sesión y
  no dé 🔴. Todo queda en borrador para revisarlo; **🗑️** descarta los borradores del rango.
- **✅ Confirmar (n)**: confirma todos los borradores del rango. Por cada uno se crea el evento
  en Google Calendar y se programa el aviso por correo.
- Una sesión se toca para verla: confirmar, **🔁 mover** (el siguiente hueco que toques es su
  sitio nuevo), cambiar de profe si a esa hora hay dos, anular, borrar (solo borradores).
- **➕ A mano**: para una clase sin horario importado (infantil, primaria hoy) o una hora rara:
  clase, fecha, hora y profe a mano.

### 3. Estados

| Estado | Qué significa |
|---|---|
| 📝 **Borrador** | Apuntado en el asistente; nadie se ha enterado. Se borra sin rastro |
| ✅ **Confirmado** | En Neon y en Google Calendar, con el profe invitado |
| 🔁 **Reprogramar** | Hay que buscarle otro hueco. Se quita del calendario (Google avisa al profe) y espera en la bandeja «🔁 por recolocar» del asistente; al recolocarla vuelve a borrador |
| ✖️ **Anulado** | No se hará. Se quita del calendario; la fila se queda (con su historial) y no cuenta para el objetivo |

**«Pendiente de avisar al profe» no es un estado de la sesión sino del aviso**, que va aparte
porque una sesión confirmada puede estar avisada o no:

| Aviso | |
|---|---|
| ✉️ **Pendiente** | Hay que mandarlo (o ya tocaba y no ha salido) |
| ⏰ **Programado** | Sale solo el día X a primera hora (cron diario) |
| 📨 **Enviado** | Con la fecha; también si se marca «se lo he dicho en persona» |
| — **No** | No hace falta (borradores, o anulada sin haber avisado nunca) |

Una sesión **hecha** es una confirmada cuya fecha ya pasó: no hace falta marcarla.

**Mover** una confirmada actualiza el evento de Google (un solo aviso de cambio al profe, no
cancelar + invitar). Si el correo ya había salido, el aviso vuelve a ✉️ pendiente con la
plantilla de **cambio**. **Anular** una avisada deja pendiente el correo de **anulación**. Cada
cambio de fecha queda en el historial de la sesión (de → a, quién, cuándo).

### 4. El evento de Google Calendar

- **Calendario**: el del tipo. Oratorio →
  `c_207a8e2010964dbd3809ca0d21ccf6642a549786af1f0c0ba27808d8ad8969ec@group.calendar.google.com`;
  Godly Play →
  `c_91636c40a49fa1fbcda6f3913828739f6c4d0fa2ffdb0c8447e6e8f65b113baa@group.calendar.google.com`.
  Editables en Ajustes.
- **Título**: `[4 ESO B] Oratorio - Ana García`.
- **Invitados**: el profe de esa hora y la persona responsable (así le sale en su calendario
  aunque el evento viva en el calendario compartido). `sendUpdates: 'all'`: Google manda la
  invitación.
- Se escribe **suplantando a la persona responsable** (misma cuenta de servicio con
  delegación de dominio que Mi horario y el correo por Gmail), así que tiene que poder editar
  ese calendario compartido. Si no puede, la sesión queda confirmada con el error a la vista.
- Marca `extendedProperties.private.origen = 'tools-oratorios'` + id de la sesión.

### 5. El correo al profe

Sale **del buzón de la persona responsable** (Gmail con delegación; con Resend, con su nombre y
su `Reply-To`). Sin firma corporativa ni logos: un correo de compañero a compañero.

> Hola Ana,
>
> Tengo previsto un momento de oratorio:
>
> **📅 martes, 14 de octubre · 🕘 9:50 – 10:45**
> **👥 4 ESO B · 📘 Matemáticas**
>
> Será primero la mitad de la clase y luego la otra mitad. Los dividimos como prefieras, por
> grupos de trabajo o por orden de lista.
>
> Gracias por tu colaboración.
> David

La frase de las mitades es el **texto extra del tipo** (Oratorio la trae; Godly Play no).
Si a un mismo profe le tocan varias sesiones en el mismo envío, **le llega un solo correo** con
todas en lista. Cómo se manda, de más a menos cómodo:

- **Por defecto, nada que hacer**: al confirmar, el aviso queda ⏰ programado **7 días antes**
  (el número es del tipo). Si la sesión es antes de eso, queda ✉️ pendiente.
- **📨 Enviar pendientes (n)** en la pestaña Sesiones: todos de golpe, agrupados por profe.
- Por sesión: 📨 ya · ⏰ 7d · ⏰ 10d · ✋ «ya se lo he dicho».

### 6. Números

- **Por tipo y clase**: una fila por clase y una columna por mes o trimestre (según el objetivo
  del tipo): ✔️ hecha · 📅 programada · 📝 borrador · ○ por hacer. Totales arriba: hechas,
  programadas, por hacer.
- **A quién se ha molestado más**: profe × T1/T2/T3/total, ordenado de más a menos, con barra.
- **Por mes**: cuántas fechas hay de cada tipo.

### 7. Quién entra

| Módulo | Qué deja hacer | Quién, por rol |
|---|---|---|
| `oratorios` | Todo (planificar, confirmar, avisar, ajustes) | TIC, superTIC y secretaría (tienen todos los módulos). A quien lo lleve se le da a mano en `/gestion/usuarios` |
| `oratorios-ver` | Solo lectura, y **solo las sesiones que le afectan** (donde es el profe de la hora o el responsable) | Todo el claustro… pero **solo si un editor enciende el «acceso común»** en Ajustes. Apagado por defecto |

---

## Decisiones cerradas (30-sep-2026)

Lo que pidió David, tal cual, y lo que decidí yo al construirlo (marcado con 🤖, para revisar):

1. **Un módulo, varios tipos de momento.** `ora_tipos` con los dos sembrados; añadir otro
   (taller de robótica) es una fila más, desde Ajustes.
2. **Objetivo por tipo**: cantidad × frecuencia (mes / trimestre / curso) **por clase**.
   Oratorio 1 al mes, Godly Play 1 al trimestre.
3. **El creador del evento es el responsable**, por defecto quien planifica, cambiable.
4. **Niveles de disponibilidad**: óptima, alternativa y 🤖 un tercero, «último recurso», que el
   autocompletar no usa nunca por sí solo.
5. **El criterio gordo**: misma clase + mismo profe + misma hora de la semana que la sesión
   anterior/siguiente de esa clase = 🔴. Avisa, no prohíbe. 🤖 Se miran las sesiones de
   **todos los tipos**: al profe le da igual que la hora se la quite un oratorio o un Godly Play.
6. **Correo desde el buzón del responsable**, con la plantilla de David, sin firmas.
7. 🤖 **Clases de cada tipo**: por defecto, todas las de las etapas del tipo sacadas del
   alumnado activo, **sin PDC** (el PDC hace oratorio con su grupo de referencia). Se puede
   fijar la lista a mano en Ajustes. Oratorio arranca con **ESO**; Godly Play con **infantil y
   primaria** — David: confírmalo.
8. 🤖 **Trimestres por defecto** (editables en Ajustes): T1 del inicio del periodo ordinario al
   22 de diciembre; T2 del 7 de enero al viernes anterior al Domingo de Ramos; T3 del martes
   después de Pascua al 19 de junio. Sirven para el objetivo por trimestre, el recuento de
   molestias y los botones de rango.
9. 🤖 **El número de sesión** es el primer hueco libre de esa clase y tipo en el curso (anular
   la 2 deja libre el 2). Mover una sesión no le cambia el número.
10. 🤖 **Reprogramar sin fecha nueva quita el evento del calendario**: dejarlo en su fecha vieja
    confundiría al profe. Mover directamente a otro hueco, en cambio, actualiza el evento.
11. 🤖 **Si quien lo lleva da clase a ese grupo a esa hora**, no cuenta como profe «molestado»
    ni se le invita dos veces: se le quita de la lista (en una optativa, los demás profes sí).
12. 🤖 **El autocompletar empieza mañana**, nunca hoy: no le da tiempo a nadie a enterarse.
13. 🤖 **La hora que queda en la sesión es la del tramo de la clase**, no la del hueco de
    disponibilidad: si 1º ESO sale a las 14:00 y 3º a las 15:05, cada una lleva la suya.

## Plan técnico

### Datos (prefijo `ora_`, SQL aditivo en `src/db/sql/oratorios.sql`)

| Tabla | Para qué |
|---|---|
| `ora_tipos` | Tipo de momento: nombre, emoji, nombre en el correo, calendario, frecuencia + cantidad, etapas / clases, texto extra del correo, días de aviso |
| `ora_ajustes` | Una fila por curso: trimestres y acceso común |
| `ora_disponibilidad` | Responsable (correo) × día × hora inicio/fin × nivel |
| `ora_sesiones` | La sesión: tipo, clase, número, fecha y horas, responsable, profe (+ materia de foto), estado, aviso, evento de Google, historial |

### Código

```
src/lib/oratorios.ts          # puro: estados, trimestres, objetivo, avisos, candidatos,
                              #   autocompletar, título del evento (con tests)
src/lib/oratorios-email.ts    # plantillas aviso / cambio / anulación (con tests)
src/lib/oratorios-google.ts   # crear / mover / borrar el evento en el calendario del tipo
src/lib/oratorios-server.ts   # consultas y acciones
src/app/gestion/oratorios/    # la pantalla
src/app/api/oratorios/...     # API (guard `oratorios`) + cron de avisos
src/components/oratorios/     # asistente, lista, números, disponibilidad, ajustes
```

## Fases

### Fase 0 · Cimientos — ✅
- [x] Módulos `oratorios` y `oratorios-ver` en la matriz de permisos, con tests
- [x] Tablas `ora_*` aditivas + semilla de Oratorio y Godly Play, aplicadas en Neon
- [x] Helpers puros con tests: trimestres, unidades del objetivo, número de sesión, avisos,
      candidatos, autocompletar, título del evento, correo

### Fase 1 · Disponibilidad y asistente — ✅
- [x] Rejilla de disponibilidad con mi horario debajo y «⚡ desde mi horario»
- [x] Semana con huecos, festivos, sesiones y candidatos con avisos
- [x] Crear en borrador en dos toques, autocompletar, descartar borradores
- [x] Mover (reprogramar a otro hueco), bandeja de «por recolocar», alta a mano

### Fase 2 · Confirmar y Google Calendar — ✅
- [x] Confirmar en bloque y por sesión; mover actualiza, anular/reprogramar borran
- [x] Error del calendario guardado en la sesión, con reintentar
- [x] API de Google Calendar habilitada en el proyecto de la cuenta de servicio (comprobado el
      30-sep-2026 a mediodía; por la mañana aún no lo estaba)
- [x] Primera prueba real contra el calendario de Oratorio: crear con invitado y anular (ver
      «Estado»)
- [ ] **David**: que cada persona que vaya a llevar oratorios pueda **editar** los dos
      calendarios compartidos (con David ya funciona)

### Fase 3 · Avisos por correo — 🟡
- [x] Plantillas aviso / cambio / anulación, agrupadas por profe
- [x] Enviar ya, programar 7/10 días, marcar avisado a mano; programado por defecto al confirmar
- [x] Cron diario de avisos programados (`/api/oratorios/cron/avisos`, 06:30 UTC)
- [ ] Primer envío real (propuesta: una sesión ➕ a mano con David como profe de la hora y otra persona de responsable)

### Fase 4 · Números y lectura — ✅
- [x] Progreso por tipo y clase, molestias por profe, fechas por mes
- [x] Vista de solo lectura con acceso común, solo lo que afecta a cada uno
- [x] Tarjeta en el escritorio

### Quizá, más adelante
- Avisar si el horario de la clase ha cambiado desde que se planificó (otro profe a esa hora).
- Mirar el ocupado/libre del Google Calendar del responsable al proponer huecos.
- Copiar la semana planificada para WhatsApp.
