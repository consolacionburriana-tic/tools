# Calendarios del dominio · plan y diseño

Herramienta de limpieza para el administrador de Workspace: **ver todos los calendarios
secundarios del dominio, saber de dónde salen y si tienen eventos, y borrarlos en bloque**.
El origen del drama: cada clase de Classroom crea su propio calendario de Google, que se
queda en la lista de todo su profesorado y alumnado, y que no desaparece aunque se archive
la clase, ni siquiera cuando se borra. Curso tras curso, se acumulan decenas por persona.

Ruta: `/gestion/calendarios` · módulo `calendarios` · solo **TIC** (y SuperTIC). Secretaría
no lo tiene, aunque tenga «todo»: borra calendarios de Google de cualquiera del dominio, y
eso le toca al administrador de Workspace. Marcado como módulo sensible en `permissions.ts`.

---

## Estado: 🟡 construido y en Neon; falta el paso de David en Workspace y la primera prueba real

Código, pantalla, tablas (`calendarios.sql`, aplicado el 30-sep-2026) y tests hechos. La
sesión que lo construyó **no podía llamar a Google en vivo**, así que falta:

1. Que David añada los scopes a la delegación de dominio y habilite las APIs (abajo).
2. Pulsar «Comprobar permisos» en la pantalla: dice qué falta, con los scopes para copiar.
3. El primer escaneo real, y el primer borrado mirándolo con calma (con uno o dos
   calendarios de un curso viejo, antes de lanzar uno gordo).

---

## Por qué no hay un botón de Google para esto

Workspace **no tiene** "lista todos los calendarios del dominio". Un calendario secundario
solo se ve desde las cuentas que lo tienen; la consola de admin no los enseña, y la API de
Calendar siempre trabaja "como alguien". Lo que sí tenemos es la cuenta de servicio con
**delegación de todo el dominio** (la del correo), que puede actuar como cualquier cuenta.
Con eso, el inventario se arma en dos pasadas:

| Pasada | API | Suplantando a | Qué da |
|---|---|---|---|
| 1. Classroom | `courses.list` (Classroom v1) | un **admin** | Todas las clases del dominio —activas, archivadas, sin aceptar—, cada una con su `calendarId`, fecha de creación, estado y profe propietario. De golpe, pocas llamadas. |
| 2. Barrido por usuarios *(opcional, recomendado)* | `users.list` (Admin SDK) + `calendarList.list` (Calendar v3) | **cada usuario**, de 30 en 30 | Los calendarios que tiene cada cuenta en su lista y con qué rol. Es **lo único que encuentra los calendarios de clases ya borradas** (Classroom ya no los devuelve) y los que alguien creó a mano. También dice a cuánta gente le sale cada uno y quién es su `owner`. |
| 3. Eventos | `events.list` | el dueño (o el profe de la clase, o un suscriptor) | Cuántos eventos tiene cada uno, cuántos por venir, el primero y el último. |

Los calendarios de Classroom se reconocen por el id (`c_classroom…@group.calendar.google.com`).

**El escaneo va por pasos que encadena la pantalla** (con su barra de progreso), no en un
único request: un dominio con cientos de cuentas no cabe en el tiempo de una función. Cada
paso es idempotente; si se corta, se vuelve a escanear y ya.

### Borrar

`calendars.delete` **solo lo puede hacer el propietario** del calendario. La app suplanta a
los `owner` vistos en el barrido y, detrás, al profe dueño de la clase, hasta que uno pueda.
Se borra para todo el mundo, con sus eventos. **Las tareas de Classroom no se tocan**: si la
clase sigue activa, simplemente deja de verse su calendario.

Cuidado con el 404: Calendar lo devuelve tanto si el calendario ya no existe como si esa
cuenta no llega a verlo. Solo se da por "ya no existía" si lo dice un `owner` que lo tenía
en su lista; si no, queda como error con el motivo.

La fila en Neon **nunca se borra**: se queda con `borrado_at`, quién lo borró y como quién.
Es el registro de lo que se ha limpiado.

---

## Cómo se decide «este curso» y «cursos anteriores»

Pestañas de la pantalla: **Cursos anteriores · Clase ya borrada · Este curso · Otros ·
Borrados**, cada una con filtro de eventos (todos / sin eventos / con eventos / con eventos
por venir) y buscador.

- **Si el nombre de la clase dice el curso**, manda el nombre. En el colegio es lo normal:
  las clases se llaman como «1ESOA (2024/2025)», y el calendario igual que la clase. También
  vale «Música 2024-25» o «Tutoría 24/25». Así, una clase vieja reutilizada y renombrada sale
  en su curso.
- Si no, **la fecha de creación de la clase, con corte el 1 de julio** (no el 1 de
  septiembre como `academicYearActual`): las clases del curso que viene se crean en julio y
  agosto, y con el corte en septiembre saldrían como «del curso pasado» justo cuando más se
  miran.
- **Clase ya borrada**: el calendario parece de Classroom pero su clase no sale en
  Classroom (o salía y en el último escaneo ya no). Para estos, el curso se estima por el
  primer evento.
- **Otros**: calendarios secundarios que no son de Classroom (hechos a mano, de
  departamentos…). Se ven, pero con cuidado: aquí puede haber calendarios que se usan.

---

## Clases de Classroom (pestaña aparte)

El mismo escaneo guarda **todas las clases** del dominio (tengan calendario o no) en
`cal_clases`. La pestaña «Clases de Classroom» las enseña con su curso (del nombre,
«1ESOA (2024/2025)», o de la fecha de creación), su estado, su profe, la fecha del último
cambio y un enlace para abrirla en Classroom. Filtro por defecto: **3 años o más** (en
2026-27, del 2023-24 hacia atrás), y se puede cambiar el número.

🟡 **Borrarlas desde aquí está pendiente.** La idea (pedida por David el 30-sep-2026):
seleccionar las viejas y borrarlas en bloque, archivándolas antes si no lo están (Classroom
solo deja eliminar clases archivadas) y, de paso, su calendario. Necesita cambiar en la
delegación `classroom.courses.readonly` por `classroom.courses` (el completo). La sesión que
hizo la pestaña no pudo escribir esa parte: el entorno bloqueó el código que borra clases, y
queda para una sesión en la que David lo autorice. Mientras, el enlace de cada clase lleva a
Classroom para borrarla a mano.

Ojo cuando se haga: borrar una clase **no** borra su carpeta de Drive (se queda en el Drive
del profe) ni su calendario, y no se deshace.

## Paso de David en Workspace (una vez)

1. **Consola de admin → Seguridad → Control de API → Delegación de todo el dominio** → el
   Client ID de la cuenta de servicio (el mismo que ya tiene `gmail.send`) → Editar, y añadir:

   ```
   https://www.googleapis.com/auth/admin.directory.user.readonly
   https://www.googleapis.com/auth/classroom.courses.readonly
   https://www.googleapis.com/auth/calendar
   ```

   (El de `calendar` es el mismo que pide Mi horario: con añadirlo una vez vale para los dos.)
   Se añaden a la lista existente separados por comas, **sin quitar los que ya hay**.

2. **Google Cloud → proyecto de la cuenta de servicio → APIs y servicios → Habilitar**:
   *Admin SDK API*, *Google Classroom API* y *Google Calendar API*.

3. **A quién se suplanta para Directory y Classroom**: tiene que ser un administrador del
   dominio. Por defecto, **quien está usando la pantalla** (David). Si algún día lo usa
   alguien de TIC que no sea admin, se fija `GOOGLE_ADMIN_BUZON` en Vercel con un buzón
   admin.

---

## Datos

| Tabla | Para qué |
|---|---|
| `cal_calendarios` | Un calendario por fila (id de Google como clave): nombre, si es de Classroom y los datos de su clase, recuento de eventos y, si se borró, cuándo, quién y como quién. Nunca se borran filas |
| `cal_suscripciones` | Quién tiene cada calendario en su lista y con qué rol (`owner`/`writer`/`reader`). Se rehace por usuario en cada barrido. Da el «le sale a N personas» y a quién suplantar para borrar |

## Código

| Fichero | Qué hace |
|---|---|
| `src/lib/calendarios.ts` | Helpers puros: curso de una clase (corte de julio), curso en el nombre, grupo de cada calendario, resumen de eventos, candidatos para borrar. Tests en `__tests__/calendarios.test.ts` |
| `src/lib/calendarios-google.ts` | Adaptador de Google: Directory, Classroom y Calendar con JWT + `subject`; «comprobar permisos»; reintentos en 429/5xx; traducción de errores de delegación a algo accionable |
| `src/lib/calendarios-server.ts` | Los tres pasos del escaneo, el inventario para la pantalla y el borrado |
| `src/app/api/calendarios/admin/*` | `permisos` (GET), `escanear` (POST, un paso), `lista` (GET), `borrar` (POST, máx. 20, exige `confirmacion: 'BORRAR'`) |
| `src/components/calendarios/panel.tsx` | La pantalla |

---

## Decisiones cerradas

- **Solo TIC** (David es administrador del dominio). Secretaría excluida a propósito.
- **Borrar = borrar de verdad** (`calendars.delete`), no «quitar de la lista de todos»: con
  cientos de suscriptores por calendario, quitarlo persona a persona es miles de llamadas y
  deja el calendario vivo. Si algún día hace falta la versión suave, ver
  `00-desarrollos-futuros.md`.
- **Confirmación escribiendo BORRAR**, con aviso de cuántos tienen eventos por venir y
  cuántos son de clases todavía activas. El servidor también exige la palabra.
- **Corte de curso el 1 de julio** para Classroom (explicado arriba).

## Checklist

### Fase 0 · Diseño
- [x] Cómo encontrar todos los calendarios sin API de "todos": Classroom + barrido por usuarios
- [x] Cómo borrar (propietario suplantado) y qué hacer con el 404 ambiguo
- [x] Clasificación por curso (nombre > fecha de creación con corte de julio > primer evento)

### Fase 1 · Construido
- [x] Tablas `cal_calendarios` y `cal_suscripciones` (`calendarios.sql`, aplicado en Neon el 30-sep-2026)
- [x] Helpers puros con tests
- [x] Adaptador de Google con «comprobar permisos»
- [x] Escaneo por pasos (Classroom, usuarios, eventos) y borrado en tandas
- [x] Pantalla `/gestion/calendarios` con pestañas, filtros, selección y confirmación; tarjeta en el escritorio
- [x] Consulta del inventario verificada contra Neon con filas de prueba (y limpiadas)
- [x] Inventario de clases de Classroom (`cal_clases`, `calendarios-clases.sql` aplicado en Neon el 30-sep-2026) con filtro «X años o más», 3 por defecto
- [ ] Borrar clases de Classroom en bloque (archivar + eliminar + su calendario) — pendiente, ver «Clases de Classroom»

### Fase 2 · Puesta en marcha (David)
- [~] Scopes en la delegación de dominio y APIs habilitadas en Cloud (código listo; paso de David)
- [ ] «Comprobar permisos» en verde
- [ ] Primer escaneo real: revisar que las clases salen con su curso bien puesto
- [ ] Primer borrado con uno o dos calendarios de un curso viejo, comprobando en Google Calendar que desaparece
- [ ] Limpieza gorda de los cursos anteriores

## Para más adelante

- **Módulo de crear eventos en calendarios** (lo siguiente que quiere David): puede reutilizar
  `calendarios-google.ts` (clientes por buzón suplantado, reintentos, `enParalelo`) y
  `mihorario-google.ts` (`crearEventos` con marca `extendedProperties` para poder deshacer).
  Cuando nazca, conviene sacar la credencial y los reintentos a un `google-sa.ts` común: hoy
  están repetidos en `email-gmail.ts`, `mihorario-google.ts` y aquí.
- Más ideas en `00-desarrollos-futuros.md`.
