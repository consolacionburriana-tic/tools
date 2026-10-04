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

## Estado: plan funcional ✅ · plan técnico ✅ · implementado 🟡 (30-sep-2026; las **Sesiones del abanico**, 4-oct-2026)

Código entero escrito y **probado contra Neon y contra Google Calendar de verdad**, con sesión de
TIC en el navegador (iPad en horizontal y móvil): disponibilidad, asistente, autocompletar (24
borradores repartidos en oct-dic, las 8 clases de ESO con horario cubiertas cada mes, numeración S1-S4
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

**4-oct-2026 · Sesiones del abanico.** David se dio cuenta de que faltaba un concepto: la **Sesión**,
*lo que se hace* en el oratorio (tiene un abanico de 10-15) y que **no se puede repetir en la vida
escolar del alumno**. Ver [«Las Sesiones (el abanico)»](#las-sesiones-el-abanico). Está hecha, con el
SQL aplicado en Neon (`oratorios-catalogo.sql`) y probada contra la BBDD real.

**Lo que falta:** el primer envío real de un correo de aviso (plantilla revisada en render, sin
mandar a nadie), que David confirme las decisiones marcadas 🤖 más abajo, **meter las sesiones de su
abanico** y reimportar el horario del PDC (y el de infantil y primaria) para que el asistente
proponga huecos también ahí.

**Iconos**: como el resto de la app, `lucide-react` en pestañas, botones y etiquetas. Emojis solo
donde son un dato: el de cada tipo (lo elige quien lo crea), los tres niveles de disponibilidad,
los avisos de cada hueco (🔴 ×2 🟡 📅 ⏱️ 🚌) y los estados — igual que 🧾 📤 💰 en Licencias.

---

## Cómo funciona (lo que ve quien lo lleva)

`/gestion/oratorios`, seis pestañas con iconos y poco texto:

| Pestaña | Para qué |
|---|---|
| 🗓️ **Planificar** | El asistente: semana a semana, tus huecos y quién cabe en cada uno |
| 📋 **Agenda** | La lista de momentos planificados: estados, avisos por correo, reprogramar, anular (antes «Sesiones») |
| 📖 **Sesiones** | El abanico: lo que se hace en cada momento, con su enlace, su curso y qué niveles aún no la han visto |
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

### Las Sesiones (el abanico)

> **Dos cosas se llaman «sesión» en este módulo.** Lo que David llama **Sesión** es *lo que se
> hace* en el oratorio (el contenido: «El silencio», «La primera vez»…). Lo que el código y la
> primera versión de esta ficha llamaban «sesión» es **el momento planificado** (una clase, un día,
> una hora: `ora_sesiones`, el «S2» de las pastillas). En pantalla, **«Sesiones» es el abanico** y
> **«Agenda» es la lista de momentos**; el «S2» sigue siendo el número del momento de esa clase.
> En el código: `ora_catalogo` / `SesionCatalogo` = el abanico; `ora_sesiones` / `SesionOra` = los momentos.

Cada tipo (Oratorio, Godly Play, el que venga) tiene su abanico. Una **Sesión** lleva:

- **Nombre** y **enlace** (al documento donde la tiene escrita; solo `http(s)`).
- **Curso en que se creó** (`2025-26`…): se pueden elegir los **4 cursos anteriores**, el actual y
  el siguiente (más atrás si el camino del tipo es largo: Godly Play, de infantil a 6º, llega a 8).
  Es lo que permite dar por vistas las sesiones de antes de que existiera la app.
- **Para qué niveles**: *todos* o solo algunos (`cursos`). «La primera vez» es solo de 1º.
- **Activa / archivada**: una archivada no se propone, pero lo que se hizo con ella sigue contando.

Se gestionan en **📖 Sesiones**: cada fila se **despliega** para editarla (y verá más cosas el día
que David quiera escribir y seguir la sesión desde ahí: es una tabla propia, `ora_catalogo`, a la
que se le pueden añadir columnas sin tocar nada más) y enseña de un vistazo, **por nivel**, si los
alumnos de ahora ya la han visto (✓ libre · ⚠ ya vista, con el curso al pasar el dedo).

**Al planificar**, cada momento lleva su sesión **ya elegida**: lo normal es que se repita la misma
en todas las clases, así que el asistente propone, para cada clase, por este orden:

1. Solo las que van a su nivel y **no ha visto nadie de esa clase** (la regla de abajo).
2. Las hechas a medida para ese nivel («la primera vez» en 1º).
3. **La que ya se ha elegido para otras clases ese mes** (o trimestre, según el objetivo del tipo).
4. La que lleva más tiempo sin hacerse.

Está en el selector **Sesión: automática · …** de Planificar (enseña la que propone para la semana
que miras; elegir otra la fuerza para todo lo que crees hasta que vuelvas a «automática»), en cada
clase del hueco, en **A mano**, en el **Autocompletar** y en el detalle del momento (para cambiarla
después). Si a una clase no le queda ninguna libre, el hueco dice «Sin sesión libre para esta clase».

**La regla: no se repite en la vida escolar del alumno** — activada por defecto en cada tipo
(casilla en Ajustes → el tipo) y **avisa, no prohíbe**: lo vetado no se propone solo, pero se puede
elegir a mano. Se mide por **generaciones**: el grupo que hoy está en 3º estuvo en 2º el curso pasado
y en 1º el anterior, así que *«año de inicio − posición en el camino»* es constante mientras
avanzan juntos. Una sesión choca con una clase si **esa generación ya la hizo, en el curso que
fuera**:

- Hecha en 2025-26 por todos los cursos → este curso la han visto 2º, 3º y 4º; **1º no** (alumnos
  nuevos). «Dentro de 4 años» vuelve a estar libre para todos.
- «La primera vez», solo en 1º: se puede repetir **cada curso** en 1º, y nunca en 2º.
- En el mismo curso, 1º A y 1º B son alumnos distintos: lo que hace una no veta a la otra (pero sí
  a sí misma). De un curso a otro los grupos se mezclan, así que ahí se mira por nivel.
- El PDC cuenta como el curso de ESO que le corresponde (`3ºPPDC` = 3º).
- Cuentan los borradores y confirmados de la app, los momentos confirmados de **cursos anteriores**
  que se hicieron con la app y las sesiones **«creadas» en un curso anterior** (se dan por hechas
  ese curso por sus niveles). El curso en marcha cuenta por lo que se planifica, no por el curso de
  creación. Los repetidores, que lo ven dos veces, no se modelan.

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
7. **Clases de cada tipo**: todas las de las etapas del tipo, sacadas del alumnado activo,
   **con el PDC dentro** (David, 30-sep-2026: «el PDC dentrísimo»): en la ESO son **10 clases**,
   y así cuentan en el objetivo y en los números. Se puede fijar la lista a mano en Ajustes.
   Oratorio arranca con **ESO**; Godly Play con **infantil y primaria**.
   ⚠️ El horario del PDC no está en Neon (el de la ESO se importó sin sus bloques), así que el
   asistente no propone huecos para 3º y 4º PDC hasta que se reimporte. Mientras, en cada hueco
   salen como **«Sin horario importado: se apuntan a mano»** (un toque abre «A mano» con la clase,
   el día y la hora puestos) y en la barra del objetivo llevan un calendario tachado.
8. **Trimestres por defecto** (editables en Ajustes; David, 30-sep-2026: «muy bien»): T1 del inicio del periodo ordinario al
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

### Las Sesiones del abanico (4-oct-2026)

Lo que pidió David: una Sesión por tipo (el abanico de 10-15), con nombre, enlace y el curso en
que se creó (los 4 anteriores a mano), **preseleccionada** al planificar porque lo normal es repetir
la misma en todas las clases, con la revisión de «no se repite en la vida escolar del alumno»
activada por defecto, y **ampliable** (escribir y seguir la sesión desde ahí, más adelante). Y lo
que decidí yo al construirlo (🤖, para revisar):

14. 🤖 **«Los 4 anteriores» = los 4 cursos académicos anteriores** en el selector «curso en que se
    creó» (2022-23…2025-26), más el actual y el siguiente. No hay tabla de cursos: es una lista.
15. 🤖 **La revisión es por tipo** (casilla en Ajustes, `ora_tipos.sin_repetir`, activada) y
    **avisa, no prohíbe**, como el 🔴. Godly Play también arranca activada; si ahí repetir es
    parte del método, se apaga en Ajustes.
16. 🤖 **Cohortes por nivel, no por alumno**: se mide por la generación del grupo (ver arriba), no
    ficha a ficha. Es exacta mientras los grupos avanzan juntos; no ve a los repetidores ni a los
    que llegan en mitad de la etapa.
17. 🤖 **«Curso en que se creó» cuenta como «curso en que se hizo»** si es anterior al actual
    (esa sesión se da por vista por esos niveles). Para el curso en marcha cuenta lo planificado.
    Si una sesión se creó pero no se llegó a hacer, se deja **sin curso**.
18. 🤖 **Una sesión por momento, y opcional**: sin elegir, el momento sale como siempre. No se
    manda en el correo ni en el evento de Calendar (decisión pendiente, ver futuros).
19. 🤖 **Se llama «Sesiones» en pantalla y la lista de momentos pasa a «Agenda»**, para que no haya
    dos pestañas con el mismo nombre. El «S2» de cada momento se queda como está.
20. 🤖 **Una sesión que está elegida en algún momento no se borra, se archiva.**

## Plan técnico

### Datos (prefijo `ora_`, SQL aditivo en `src/db/sql/oratorios.sql` y `oratorios-catalogo.sql`)

| Tabla | Para qué |
|---|---|
| `ora_tipos` | Tipo de momento: nombre, emoji, nombre en el correo, calendario, frecuencia + cantidad, etapas / clases, texto extra del correo, días de aviso, `sin_repetir` |
| `ora_catalogo` | **El abanico**: las Sesiones de cada tipo (nombre, enlace, curso en que se creó, niveles, activa) |
| `ora_ajustes` | Una fila por curso: trimestres y acceso común |
| `ora_disponibilidad` | Responsable (correo) × día × hora inicio/fin × nivel |
| `ora_sesiones` | El **momento** planificado: tipo, clase, número, fecha y horas, responsable, profe (+ materia de foto), estado, aviso, evento de Google, historial, `catalogo_id` (la Sesión del abanico) |

### Código

```
src/lib/oratorios.ts          # puro: estados, trimestres, objetivo, avisos, candidatos,
                              #   autocompletar, título del evento, el abanico y la regla de
                              #   no repetir por generaciones (con tests)
src/lib/oratorios-email.ts    # plantillas aviso / cambio / anulación (con tests)
src/lib/oratorios-google.ts   # crear / mover / borrar el evento en el calendario del tipo
src/lib/oratorios-server.ts   # consultas y acciones
src/app/gestion/oratorios/    # la pantalla
src/app/api/oratorios/...     # API (guard `oratorios`) + cron de avisos; `catalogo` = el abanico
src/components/oratorios/     # asistente, agenda, abanico, números, disponibilidad, ajustes
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
- [x] **David**: que cada persona que vaya a llevar oratorios pueda **editar** los dos
      calendarios compartidos (hecho, 30-sep-2026)

### Fase 3 · Avisos por correo — 🟡
- [x] Plantillas aviso / cambio / anulación, agrupadas por profe
- [x] Enviar ya, programar 7/10 días, marcar avisado a mano; programado por defecto al confirmar
- [x] Cron diario de avisos programados (`/api/oratorios/cron/avisos`, 06:30 UTC)
- [ ] Primer envío real (propuesta: una sesión ➕ a mano con David como profe de la hora y otra persona de responsable)

### Fase 4 · Números y lectura — ✅
- [x] Progreso por tipo y clase, molestias por profe, fechas por mes
- [x] Vista de solo lectura con acceso común, solo lo que afecta a cada uno
- [x] Tarjeta en el escritorio

### Fase 5 · Sesiones del abanico — ✅
- [x] `ora_catalogo` + `ora_sesiones.catalogo_id` + `ora_tipos.sin_repetir`, aplicados en Neon
      (`oratorios-catalogo.sql`, 4-oct-2026)
- [x] Helpers puros con tests: generaciones, qué choca, de dónde salen los usos, cuál se propone,
      autocompletar con sesión, enlaces seguros
- [x] Pestaña **Sesiones** (alta, edición desplegable, archivar, borrar si no se usa, estado por nivel)
- [x] Sesión elegida al planificar: selector automático/forzado, en cada clase del hueco, A mano,
      Autocompletar y detalle del momento
- [x] Casilla «no se repite en la vida escolar» por tipo (Ajustes)
- [x] Probado contra Neon (crear, cambiar, rechazar la de otro tipo, no borrar una en uso, limpiar)
- [ ] **David**: meter las sesiones de su abanico (nombre, enlace y curso en que se crearon)

### El PDC en los huecos (4-oct-2026)
- [x] El PDC **sí cuenta** en el objetivo, los números y «A mano» (10 clases en la ESO), pero **no
      salía en los huecos**: su horario no está en Neon (ver «Estado»), y el asistente solo
      propone clases con horario. Ahora las clases **sin horario importado** salen en cada hueco
      («Sin horario importado: se apuntan a mano») y en la barra del objetivo se marcan con
      un icono de calendario tachado; un toque abre «A mano» con la clase, el día y la hora ya puestos.
- [ ] **David**: reimportar el horario de la ESO con el PDC (y el de infantil y primaria) para que el
      asistente y el autocompletar también lo propongan. Sin el `.docx`, no se puede desde aquí.

### Quizá, más adelante
- Escribir y seguir la sesión desde la propia app (hoy: nombre + enlace).
- Poner la sesión (y su enlace) en el evento de Calendar y/o en el correo al profe.
- «Esta sesión se puede repetir» por sesión, además de por tipo.
- Avisar si el horario de la clase ha cambiado desde que se planificó (otro profe a esa hora).
- Mirar el ocupado/libre del Google Calendar del responsable al proponer huecos.
- Copiar la semana planificada para WhatsApp.
