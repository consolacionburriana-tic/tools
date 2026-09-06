# Mi horario · plan y diseño

Módulo pequeño y personal: **cada profe ve solo lo suyo y se lo lleva a su Google Calendar**.
Se apoya entero en los horarios ya importados ([`07-horarios.md`](./07-horarios.md)); no
tiene datos propios más allá de las preferencias de cada uno y el calendario de festivos.

> **La regla de oro:** lo que sale al Google Calendar de una persona lo decide esa persona.
> El nombre de los eventos se ve y se puede cambiar **antes** de que se copie nada, y
> deshacerlo tiene que ser un clic, no una tarde.

---

## Estado: 🟡 Fase 0-3 escritas, sin probar en vivo

Las tres decisiones pendientes están cerradas (2026-09-06, con David) y el código está
escrito: schema en Neon, permisos, helpers puros con tests, cliente de Google Calendar y
la pantalla en `/mi-horario`. **Lo único que falta es el paso de David en la consola de
Workspace** (añadir el scope de Calendar) y la primera prueba real contra un calendario de
verdad — esta sesión no tiene credenciales para ejecutarlo en vivo.

---

## Por qué un módulo aparte

Hoy hay dos módulos de horarios y hacen falta tres, porque son tres permisos distintos:

| Módulo | Qué deja ver | Quién |
|---|---|---|
| `horarios` | El horario de cualquier **clase** | Todo el claustro |
| `horarios-profes` | El horario de **cualquier profesor** | Dirección, jefatura, orientación, TIC |
| **`mi-horario`** *(nuevo)* | **Solo el mío**, y exportarlo | Todo el claustro |

Sin el tercero, para que un profe pudiera exportar su horario habría que darle
`horarios-profes` — y con eso vería el de todos, que es justo lo que David quiso evitar.

**Cómo se sabe quién eres:** `edu_teachers.email` casa con el correo del login de Google (así
está montado desde el sync de Educamos). Si no casa, la pantalla lo dice y no adivina.

Ruta: `src/app/(public)/mi-horario` (detrás del login, como `/puntualidad`).

---

## Lo que se lleva al calendario

### Eventos recurrentes, no sueltos

David preguntó cuál es más fácil. **Recurrentes, con excepciones**, y no por poco:

- Un horario de un profe son ~20 sesiones semanales × ~35 semanas = **~700 eventos sueltos**.
  Como recurrentes son **20**.
- Borrarlo todo con eventos sueltos es seleccionar 700 cosas a mano. Con recurrentes es
  "eliminar todas las repeticiones", 20 veces. O menos, si se etiquetan (ver abajo).
- Los festivos no se borran después: **no llegan a crearse**. En iCalendar eso es `EXDATE`,
  una lista de fechas excluidas dentro del propio evento recurrente. Es exactamente para lo
  que existe.

Cada sesión sale como:

```
DTSTART   martes de la primera semana del periodo, a la hora del tramo
DURATION  la del tramo
RRULE     FREQ=WEEKLY;BYDAY=TU;UNTIL=<fecha fin del periodo>
EXDATE    todos los martes festivos o de vacaciones del periodo
LOCATION  el espacio (Polideportivo, Música…)
```

**Dos periodos = dos tandas de eventos**, cada una con sus fechas: el ordinario acaba el 31
de mayo y el de junio empieza el 1. No se solapan porque los periodos no se solapan.

### Cómo deshacerlo

Todo evento creado lleva una marca (`extendedProperties.private.origen = 'tools-horarios'`
más el id del periodo). Con eso, "quitar mi horario del calendario" es una consulta y un
borrado, sin tocar nada que la persona haya puesto a mano. **Reimportar es borrar lo
anterior de ese periodo y volver a crear**, igual que hace el importador de horarios: la
misma idea de "esto es una foto, no un diario".

---

## El nombre de los eventos (propuesta, editable)

David quiere emoji + abreviatura + clase, y poder cambiarlo. La propuesta es una **plantilla
con huecos**, que se ve y se edita antes de exportar:

**Plantilla por defecto del título:**

```
{emoji} {abrev} · {clase}
```

| Ejemplo real | Sale |
|---|---|
| Matemáticas de 3PRI A | `🔢 MAT · 3PRI A` |
| Educació Física de 6PRI B en el polideportivo | `⚽ EFI · 6PRI B` |
| Tutoría de 3PRI A | `🧭 TUT · 3PRI A` |
| Guardia (sin grupo) | `🛟 Guardia` |
| Reunión de departamento | `👥 Departamento` |

**Huecos disponibles:** `{emoji}` `{abrev}` `{materia}` `{clase}` `{clases}` `{aula}`
`{profes}` `{actividad}`. Los que queden vacíos se recortan solos, con sus separadores — una
guardia no deja `· ` colgando.

**Descripción** (por defecto): quién más entra a esa hora, la actividad y si es lectiva.
**Ubicación**: el espacio, que en Google Calendar es su propio campo y sale en el móvil.

**Los emojis los pone cada uno**, por materia, y se guardan en sus preferencias. Propuesta de
partida para las 17 materias que hay ahora — todas cambiables:

| | | | |
|---|---|---|---|
| 🔢 Matemáticas | 📖 Lengua Castellana | 📗 Valencià | 🌍 Coneixement |
| ⚽ Educació Física | 🇬🇧 English | 🎵 Music | 🎨 Arts |
| ✝️ Religión | 🧭 Tutoría | 📚 Lectura | 🧮 eMat |
| 🔤 Ludiletras | 🤸 Psicomotricidad | 🌱 Crecimiento en Armonía | 🛠️ Projecte |
| ⚖️ Valores | 🛟 Guardia | 👥 Departamento | 👨‍👩‍👧 Atención a familias |

Cuando llegue secundaria: `💻 PRG` para Programación, que es el ejemplo que puso David.

---

## Festivos: el calendario del centro

Tabla **compartida**, no de cada uno: los festivos son los mismos para todo el claustro. El
primero que los mete los deja puestos para los demás — que es literalmente lo que pidió David.

```
hor_festivos   academic_year, nombre, fecha_inicio, fecha_fin, tipo, notas
               tipo: 'festivo' | 'vacaciones' | 'no_lectivo'
```

Un **rango** en vez de una fecha suelta, porque Navidad, Fallas y Semana Santa son rangos y
meterlos día a día es pedir que alguien se deje uno.

De lo que dijo David, esto se puede **precalcular** cada año y él solo confirma:

| Fijos de fecha | |
|---|---|
| 9 de octubre | Día de la Comunitat Valenciana |
| 12 de octubre | Fiesta Nacional |
| 6 y 8 de diciembre | Constitución e Inmaculada |
| 1 de mayo | Fiesta del Trabajo |

| Hay que ponerlos a mano cada año | Por qué |
|---|---|
| Inicio y fin de curso | Cambian todos los años |
| El 7 de diciembre | Unos años es puente y otros no |
| Navidad, Fallas, Semana Santa | Son rangos y se mueven |
| Días propios del centro | Fiesta local, día del colegio… |

La pantalla propone los fijos del curso ya calculados y David añade los rangos. Y como el
inicio de curso ya está en `hor_periodos` (fecha de inicio y de fin), lo único que falta de
verdad son los rangos de vacaciones.

---

## Cómo se escribe en el Google Calendar

Aquí hay un hallazgo que cambia el plan, y para bien.

El colegio **ya tiene una cuenta de servicio con delegación de dominio**, montada para que
los correos salgan por la API de Gmail (`GOOGLE_SA_CLIENT_EMAIL`, scope `gmail.send`, ver
`04-convenciones-tecnicas.md`). Esa misma cuenta puede suplantar a cualquier buzón del
dominio. Si en la consola de Workspace se le añade el scope de Calendar al **mismo Client
ID**, la app puede escribir en el calendario de cada profe **sin pedirle OAuth a nadie**.

Eso significa que las dos cosas que quería David son el mismo mecanismo:

- **"Yo me importo mi horario"** → la app suplanta tu buzón y escribe en tu calendario.
- **"Jefatura se lo pasa a todo el claustro"** (la segunda derivada) → lo mismo, en bucle.
  No hace falta que nadie autorice nada por separado.

**El paso que solo puede dar David** (consola de admin de Workspace → Seguridad → Control de
API → Delegación de todo el dominio, sobre el Client ID que ya está de alta):
añadir `https://www.googleapis.com/auth/calendar`.

Hasta que eso esté, y para no quedarse parado, la **descarga `.ics`** hace el 90% del
trabajo: se genera el fichero, Google Calendar lo importa y **su propio diálogo de importación
ya pregunta a qué calendario**, que era otra de las peticiones. Sin tocar la consola, sin
credenciales nuevas y funcionando con cualquier calendario, no solo Google.

**Plan: primero `.ics`, después el botón directo.** El `.ics` no es un parche que se tire
luego: el generador de eventos es el mismo para los dos caminos, solo cambia por dónde salen.

🟡 **Decisión pendiente:** ¿en qué calendario? Con la API se puede listar los calendarios de
la persona y que elija. Por defecto, el principal. Con `.ics` lo elige el diálogo de Google.

---

## Datos

| Tabla | Para qué |
|---|---|
| `hor_festivos` | Calendario del centro: festivos y vacaciones, por rangos. **Compartido** |
| `mih_preferencias` | Por persona: plantilla de título y descripción, y sus emojis por materia |
| `mih_exportaciones` | Bitácora: quién exportó qué periodo, cuándo, a qué calendario y cuántos eventos. Es lo que permite deshacer |

Prefijo `hor_` para los festivos porque son del centro y los va a querer todo el mundo (el
navegador también debería pintarlos); `mih_` para lo que es de cada uno.

## Código

```
src/lib/mihorario.ts          # helpers puros: plantilla de título, expandir sesión a
                              #   evento recurrente, calcular EXDATE contra los festivos
src/lib/mihorario-ics.ts      # generar el .ics (RFC 5545)
src/lib/mihorario-google.ts   # empujar por la API de Calendar (cuando esté el scope)
src/lib/mihorario-server.ts   # mis sesiones, preferencias, bitácora
src/app/(public)/mi-horario/  # la pantalla
```

---

## Fases

### Fase 0 · Cimientos — ✅
- [x] Módulo `mi-horario` en la matriz de permisos (todo el claustro), con tests
- [x] Tablas `hor_festivos` + `mih_preferencias` + `mih_exportaciones` (aditivas), aplicadas
      en Neon (2026-09-06) — verificado: 3 tablas, sus claves ajenas
- [x] Casar el usuario del login con `edu_teachers.email` (`getProfePorEmail`); si no casa,
      la pantalla lo dice con el correo exacto que no encontró, no adivina

### Fase 1 · Mi horario en pantalla — ✅
- [x] `/mi-horario`: mi cuadrícula, reusando el `Navegador` que ya existe (vista `profe`)
- [x] Selector de periodo (reusa `SelectorPeriodo`, ahora con `basePath` para poder vivir
      fuera de `/gestion/horarios`)

### Fase 2 · Festivos — 🟡
- [x] Tabla compartida `hor_festivos`, por rangos
- [x] Los 5 fijos del curso 2026-27 ya sembrados (9-oct, 12-oct, 6-dic, 8-dic, 1-mayo)
- [x] API de alta/baja (`/api/mi-horario/admin/festivos`), solo para quien edita horarios
- [ ] Pantalla para gestionarlos visualmente (hoy es API sin UI; alta a mano por SQL o API)
- [ ] Rangos de Navidad, Fallas y Semana Santa (**David**: fechas de este curso)
- [ ] Pintarlos también en el navegador de horarios

### Fase 3 · La plantilla y el emoji — ✅
- [x] Motor de plantilla con huecos y recorte de separadores huérfanos, con tests
- [x] Generador de abreviatura de respaldo (regla "GeH"), con tests
- [x] Emojis por defecto (materia y actividad) + los que pida cada persona, con tests
- [x] Pantalla de preferencias (plantilla, descripción, emoji por categoría — solo las que
      la persona REALMENTE tiene en su horario)

### Fase 4 · A Google Calendar directamente — 🟡 (sin probar en vivo)
- [x] `construirEventoGoogle`: RRULE semanal + EXDATE por festivo, con tests exhaustivos
- [x] Cliente de Calendar (`mihorario-google.ts`), mismo patrón que `email-gmail.ts`
      (delegación de dominio, JWT con `subject`); reintentos con backoff
- [x] Vista previa → confirmar (igual que el importador de horarios), con selector de
      calendario de destino
- [x] Reexportar = borrar lo de ese periodo y volver a crear; botón de deshacer
- [ ] **David**: añadir el scope `calendar` al Client ID en la consola de Workspace
- [ ] **Primera prueba real** contra un calendario de verdad — esta sesión no tiene
      credenciales para ejecutarlo en vivo, así que el camino feliz está escrito y
      tipado pero no verificado con Google de por medio

### Fase 5 · Desde jefatura, a todo el claustro — ⬜
- [ ] Mismo mecanismo, en bucle, para quien tenga `horarios-profes` y pueda editar
- [ ] Vista previa de a quién se le va a escribir antes de lanzarlo

---

## Decisiones cerradas (2026-09-06, con David)

1. **Directo a Google Calendar, sin pasar por `.ics` primero.** David lo prefiere así.
   Asumimos que el scope ya está añadido en Workspace (ver más abajo cómo).
2. **Plantilla general del centro, pero modificable por cada uno.** Con abreviatura por
   materia: la mayoría YA tiene una buena (heredada del código de Educamos, `EFI1`→`EFI`);
   para lo que no la tenga (una asignación manual), un generador de respaldo seguía la
   convención que puso David: "Geografía e Historia" → **GeH** (iniciales en mayúscula,
   con el conector de en medio en minúscula).
3. **Se exportan TODAS las horas del profesor**, lectivas y no lectivas (guardias,
   reuniones, atención a familias…). Solo quedan fuera el recreo y el comedor, que no son
   horas de nadie — son huecos de la rejilla, no sesiones, así que ya salían fuera sin
   filtrar nada.

Emojis por defecto que dio David, ya en el código (`EMOJIS_ACTIVIDAD_POR_DEFECTO` en
`src/lib/mihorario.ts`): 🗣️ atención a familias, 👥 reunión/departamento/coordinación,
🛟 guardia, y 👤 como genérico de cualquier hora no lectiva sin emoji propio.

📥 **Nota devuelta a David**: en la tabla de ejemplo que pasó (abreviatura · emoji · clase)
`TRDR` aparece dos veces con emojis distintos (🖥️ y 🤕). No lo he resuelto por mi cuenta —
esas son sus emojis personales para asignaturas de secundaria que aún no existen en la
BBDD (secundaria no está importada), así que no hay nada que sembrar todavía; cuando
importe secundaria y entre en su pantalla de preferencias, que revise cuál de los dos
quería para `TRDR`.

### Cómo añadir el scope de Calendar (esquemático, para cuando haga falta)

1. **Consola de administración de Google Workspace**, con una cuenta de administrador:
   **Seguridad → Control de acceso y datos → Controles de API → Delegación de todo el
   dominio**.
2. Busca el **Client ID** que ya está de alta (el que usa `GOOGLE_SA_CLIENT_EMAIL` para el
   scope `gmail.send`).
3. Edítalo y **añade**, sin quitar los que ya tiene:
   ```
   https://www.googleapis.com/auth/calendar
   ```
   (el scope completo, no solo `calendar.events`: hace falta para poder listar los
   calendarios de cada persona y que elija destino).
4. Guardar. Propagación casi inmediata (unos minutos como mucho). No hace falta que nadie
   reautorice nada: es la misma credencial, un scope más.

