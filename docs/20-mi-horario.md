# Mi horario · plan y diseño

Módulo pequeño y personal: **cada profe ve solo lo suyo y se lo lleva a su Google Calendar**.
Se apoya entero en los horarios ya importados ([`07-horarios.md`](./07-horarios.md)); no
tiene datos propios más allá de las preferencias de cada uno y el calendario de festivos.

> **La regla de oro:** lo que sale al Google Calendar de una persona lo decide esa persona.
> El nombre de los eventos se ve y se puede cambiar **antes** de que se copie nada, y
> deshacerlo tiene que ser un clic, no una tarde.

---

## Estado: ⬜ diseño, sin implementar

Este documento es la propuesta. **Nada escrito todavía.** Hay tres decisiones de David
pendientes (marcadas 🟡) y un paso en la consola de Workspace que solo puede dar él.

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

### Fase 0 · Cimientos — ⬜
- [ ] Módulo `mi-horario` en la matriz de permisos (todo el claustro), con tests
- [ ] Tabla `hor_festivos` + `mih_preferencias` + `mih_exportaciones` (aditivas)
- [ ] Casar el usuario del login con `edu_teachers.email`, y decirlo claro si no casa

### Fase 1 · Mi horario en pantalla — ⬜
- [ ] `/mi-horario`: mi cuadrícula, reusando el navegador que ya existe
- [ ] Selector de periodo (ordinario / junio-septiembre)

### Fase 2 · Festivos — ⬜
- [ ] Pantalla del calendario del centro, con los fijos del curso **ya propuestos**
- [ ] Rangos de Navidad, Fallas y Semana Santa a mano
- [ ] Pintarlos también en el navegador de horarios

### Fase 3 · Exportar — ⬜
- [ ] Plantilla de título editable, con vista previa **de eventos reales míos** antes de nada
- [ ] Emojis por materia, con los de partida ya puestos
- [ ] Generar `.ics` con eventos recurrentes y `EXDATE` de los festivos (helper puro con tests)
- [ ] Descarga y bitácora

### Fase 4 · Botón directo a Google Calendar — ⬜ (necesita el scope)
- [ ] **David**: añadir el scope `calendar` al Client ID en la consola de Workspace
- [ ] Elegir calendario de destino
- [ ] Crear los eventos marcados con `extendedProperties`, y el botón de deshacer
- [ ] Reexportar = borrar lo de ese periodo y volver a crear

### Fase 5 · Desde jefatura, a todo el claustro — ⬜
- [ ] Mismo mecanismo, en bucle, para quien tenga `horarios-profes` y pueda editar
- [ ] Vista previa de a quién se le va a escribir antes de lanzarlo

---

## Decisiones pendientes 🟡

1. **¿Empezamos por `.ics` o esperamos al scope de Calendar?** Mi recomendación: `.ics` ya,
   porque no depende de nadie y el generador de eventos se reaprovecha entero.
2. **¿La plantilla y los emojis son de cada uno o hay unos del centro por defecto?**
   Propuesta: unos por defecto del centro, que cada uno puede pisar.
3. **¿El horario que se exporta incluye las horas no lectivas** (guardias, departamento,
   atención a familias)? Hoy esas horas **no están importadas** (ver el hueco en
   [`07-horarios.md`](./07-horarios.md)), así que de momento la pregunta es teórica, pero
   conviene decidirlo antes de montar la plantilla.
