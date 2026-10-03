# Tableros (tareas por equipos, estilo Trello) · plan y checklist

Un sitio donde apuntar las tareas pendientes de un equipo en **tableros kanban**: tarjetas que
pasan de *Por hacer* a *En curso* a *Hecho*, con prioridad, fecha límite, responsables, checklist,
enlaces y un seguimiento de comentarios. Se pueden crear tantos equipos y tableros como se quiera;
**solo entra quien está en el equipo**, y los roles que mandan (dirección, TIC, secretaría) no
tienen ningún atajo para ver los ajenos. Lo pidió David el 3-oct-2026.

Ejemplo de partida (sembrado en Neon): el equipo **💻 TIC** con dos tableros, **🧑‍💻 Desarrollo
interno** y **🛠️ Mantenimiento de aulas**, y dentro las cuatro personas de TIC.

> **La regla de oro:** se entra por ser **miembro del equipo**, nunca por el rol. El módulo
> `tableros` lo tiene todo el claustro, pero tenerlo solo deja crear equipos propios y entrar en
> los equipos en los que alguien te haya metido. Un tablero ajeno responde lo mismo que uno que
> no existe (404).

No confundir con [Tareas de la plataforma](./23-tareas.md) (`tar_*`): aquello es el buzón de
fallitos e ideas de la propia plataforma, con su botón flotante de abajo a la derecha.

---

## Estado: plan funcional ✅ · plan técnico ✅ · implementado ✅ (3-oct-2026)

Construido de una pieza y **probado contra Neon con sesión real en el navegador** (build de
producción, iPad horizontal, móvil y modo oscuro): crear equipo y tablero, alta rápida de
tarjetas, arrastrar entre listas (persiste al recargar), ficha completa (responsables, fecha,
prioridad, etiquetas, descripción, checklist, enlaces, comentarios y actividad), archivar,
listas nuevas y borrarlas sin perder tarjetas, filtros, aviso flotante, tarjeta del escritorio y
diálogo de miembros. Control de acceso comprobado con una cuenta de dirección: ni ve el equipo
TIC, ni abre sus tableros, ni puede crear tarjetas ni meterse en el equipo por la API. El cron de
vencimientos se probó con un transporte falso (ningún correo salió): elige bien, no manda en fin
de semana y no repite. Todo lo de prueba se borró al terminar: en Neon queda solo el equipo TIC
sembrado, vacío.

**Lo que falta:** el primer correo real (asignación y aviso diario; las plantillas se revisaron
renderizadas, sin mandarlas) y que David repase las decisiones marcadas 🤖.

---

## Cómo funciona

### `/gestion/tableros` — inicio

- **Lo tuyo**: todo lo que tienes asignado y sin terminar, en todos tus equipos, agrupado en
  *Vencidas · Hoy y mañana · Próximos días · Más adelante · Sin fecha*, con su prioridad y su
  fecha. Un toque abre la tarjeta en su tablero.
- **Tus equipos**, cada uno con sus tableros en **baldosas** blancas con una raya fina de su
  color y el emoji en un cuadrado suave (cuántas quedan por hacer y cuántas vencidas) y una baldosa «+ Nuevo tablero». Los archivados, plegados debajo.
- **Nuevo equipo** (nombre, emoji, color, descripción y gente del claustro) y, en cada equipo,
  el engranaje: **miembros** (añadir, quitar, hacer admin), editar, salir y borrar.
- **Avisos por correo**: dos interruptores por persona (asignaciones y vencimientos).

### `/gestion/tableros/[id]` — un tablero

- **Listas en columnas** con scroll horizontal (en el móvil, una columna por pantalla). Las listas
  se renombran (doble toque o menú ⋯), se mueven a izquierda/derecha, se borran (sus tarjetas
  pasan a otra lista) y se marca cuál es la de **terminado** (✓): lo que está ahí no avisa, no
  sale en «Lo tuyo» y cuenta como completado. Nacen tres: *Por hacer · En curso · Hecho*.
- **Tarjetas** con borde de color según la prioridad, etiquetas arriba, y abajo la fecha
  (🔴 vencida · 🟠 hoy · 🟡 pronto), el checklist (3/5), comentarios, enlaces y las caras de los
  responsables.
- **Arrastrar**: con ratón, en cuanto se mueve; en iPad, **con una pulsación larga** (si no, el
  dedo no podría hacer scroll). También se mueve desde la ficha (desplegable de lista o botón
  «Terminada»).
- **Alta rápida** al pie de cada lista: se escribe, Enter, y se queda abierta para la siguiente.
- **Filtros**: búsqueda, «Lo mío», prioridad y etiqueta. Con «Lo mío» puesto, lo que se crea se
  asigna a quien lo crea (si no, desaparecería al crearlo).
- **Archivadas** (botón 📦): lo terminado que ya no hace falta ver; se recupera o se borra.
- **Ajustes del tablero**: nombre, emoji, color, descripción y **etiquetas** propias
  («iPad», «Hay que comprar», «Esperando a alguien»…). Archivar y borrar el tablero, solo admin.

### La ficha de una tarjeta

Se abre en un diálogo y **va en la URL** (`?t=<id>`): «Copiar enlace» da un enlace que solo abre
quien esté en el equipo. Todo se guarda solo al tocarlo.

- **Responsables** (gente del equipo, varios), **fecha límite** (con atajos Hoy · Mañana ·
  Viernes · +1 semana), **prioridad** (baja, media, alta, urgente) y **etiquetas**.
- **Descripción** (las URL salen como enlaces), **checklist** con barra de progreso (pegar una
  lista de varias líneas = varios pasos de golpe) y **enlaces** con icono según sean Drive, un
  Doc, una Hoja, Classroom, Calendar o una pantalla de la propia plataforma (estas se guardan
  como ruta, así siguen valiendo si cambia el dominio).
- **Seguimiento**: comentarios (cada uno borra los suyos) mezclados con la **actividad**
  automática («David la movió a «En curso»», «asignó a Ana», «puso fecha límite: 9 oct»).

### Avisos

| Dónde | Qué | Cuándo |
|---|---|---|
| **Pastilla de abajo a la izquierda** en todo `/gestion` | «2 vencidas · 1 para hoy» (blanca, como el botón de fallitos; el texto en rojo si hay vencidas, en naranja si no); al tocarla, la lista con enlace a cada tarjeta | Solo si hay algo tuyo vencido, para hoy o para mañana. Se oculta «hasta mañana» (vuelve si aparece algo nuevo). No sale dentro de los tableros, que ya lo enseñan. En el móvil, solo el número |
| **Escritorio** | La tarjeta «Tableros» con «Tienes N tareas pendientes» y el chip rojo de vencidas | Siempre que tengas el módulo |
| **Correo de asignación** | «Tarea para ti: …» con el tablero, la prioridad, la fecha, la descripción y un botón | Al asignar a alguien (no a uno mismo). El `Reply-To` es quien asigna |
| **Correo de equipo** | «Te han añadido al equipo TIC» con sus tableros | Al meter a alguien en un equipo |
| **Correo diario de vencimientos** | Un solo correo por persona con lo que vence ya y lo que se ha pasado de fecha | Cron de lunes a viernes a las 06:45 UTC (8:45 en invierno). Cada tarjeta avisa **una vez por fecha**: «vence ya» (hoy/mañana; el viernes, también lo del lunes) y «se ha pasado». Si la fecha cambia, vuelve a avisar |

---

## Decisiones cerradas

Las marcadas 🤖 las tomé yo al construirlo (David: «tú decides prácticamente todo»); están
también en [`00-desarrollos-futuros.md`](./00-desarrollos-futuros.md) para revisarlas.

- **Acceso solo por pertenencia** (David). Ningún rol ve un tablero ajeno: ni dirección ni TIC.
  Por eso el módulo va en todos los roles y todo lo demás lo decide `tab_miembros`.
- **Personas de dentro** (David): solo se puede meter en un equipo a profes activos y cuentas de
  Usuarios y roles, siempre del dominio del colegio. El servidor descarta cualquier otro correo,
  y los responsables de una tarjeta tienen que ser del equipo.
- 🤖 **Equipos → tableros**, no tableros sueltos: la gente se mete en el equipo y ve todos sus
  tableros (lo que pedía David con TIC: «dos tableros o dos secciones»). Para algo personal, un
  equipo de una persona.
- 🤖 **Dos papeles en el equipo**: *admin* (cambia el equipo y sus miembros, archiva y borra
  tableros, borra el equipo) y *miembro* (todo lo demás: crear tableros, listas y tarjetas,
  editarlas, moverlas, archivarlas y borrarlas). Siempre queda al menos un admin. Quien crea el
  equipo es admin; en el equipo TIC sembrado, las cuatro personas son admin.
- 🤖 **Listas libres** con una marca de «terminado», en vez de tres estados fijos: como Trello,
  y sin perder el «hecho» que necesitan los avisos.
- 🤖 **Prioridades: baja, media, alta, urgente**, opcionales. En la tarjeta solo se ven alta y
  urgente (las otras dos quedan en el borde de color), para que no todo grite.
- 🤖 **Fecha límite por día**, sin hora: «el viernes», en hora de Madrid.
- 🤖 **Al sacar a alguien de un equipo, se le quita de sus tarjetas de allí**: si no, seguirían
  saliendo a su nombre tareas que ya no puede abrir.
- 🤖 **Aviso general abajo a la izquierda**, simétrico al botón de fallitos de la derecha, y solo
  con lo urgente (vencido, hoy, mañana): un aviso que sale siempre deja de leerse.
- 🤖 **Correo diario solo de lunes a viernes** y una vez por tarjeta y fecha: mejor un aviso
  perdido que uno repetido cada mañana. El viernes avisa también de lo que vence el lunes.
- 🤖 **Diseño sobrio fuera del tablero** (David, 3-oct-2026: «que esté guapo porque es limpio»):
  sin degradados en baldosas, iconos ni avisos; el color va en una raya fina, en el cuadrado
  suave del emoji y en chips claros. El degradado muy suave se queda solo de fondo dentro del
  tablero abierto.
- 🤖 **Borrar es de verdad** (tarjetas, tableros y equipos), con confirmación — escribiendo el
  nombre para tableros y equipos. Para lo terminado está **archivar**, que es lo que se ofrece
  primero. No son datos con valor histórico como los de alumnado.

## Plan técnico

- Tablas `tab_equipos`, `tab_miembros`, `tab_tableros` (con sus `etiquetas` en jsonb),
  `tab_columnas`, `tab_tarjetas` (`responsables`, `etiquetas`, `checklist` y `enlaces` en jsonb;
  `orden` con decimales para colocar entre dos sin renumerar; `aviso_proximo_para` y
  `aviso_vencido_para` con la fecha que se avisó), `tab_seguimiento` y `tab_preferencias`
  (`src/db/schema.ts`; SQL aditivo con la semilla del equipo TIC en `src/db/sql/tableros.sql`).
- Helpers puros y validación Zod: `src/lib/tableros.ts` (fechas, orden, agrupar «lo tuyo», qué
  aviso toca, enlaces). Plantillas de correo: `src/lib/tableros-email.ts` (perfil `tableros` de
  `email.ts`). Tests: `src/lib/__tests__/tableros.test.ts`.
- Queries y control de acceso: `src/lib/tableros-server.ts`. Cada lectura y escritura cruza con
  `tab_miembros`; el acceso va en la misma tanda que los datos (`datosTablero`: una sola tanda).
- API (todas con `requireModule('tableros')` y, dentro, la pertenencia al equipo):
  `GET/POST /api/tableros` (inicio y crear equipo) · `PATCH/DELETE /api/tableros/equipos/[id]`
  (acciones: editar, añadir/quitar miembros, rol, salir, crear y ordenar tableros) ·
  `GET/PATCH/DELETE /api/tableros/tablero/[id]` (el tablero, sus archivadas, editar, etiquetas,
  listas y crear tarjeta) · `GET/PATCH/DELETE /api/tableros/tarjeta/[id]` (seguimiento, editar,
  mover, archivar, comentar) · `GET /api/tableros/mios` · `GET /api/tableros/personas` ·
  `GET/PUT /api/tableros/preferencias` · cron `GET /api/tableros/cron/avisos` (`CRON_SECRET`).
  Los correos de asignación salen con `after()`: quien asigna no espera al correo.
- UI: `src/components/tableros/` — `inicio.tsx`, `tablero.tsx` (arrastrar con `@dnd-kit`, ratón
  + táctil con pulsación larga + teclado), `tarjeta-detalle.tsx`, `selector-personas.tsx`,
  `aviso-global.tsx` (lo monta `src/app/gestion/layout.tsx`) y `comun.tsx`.

## Checklist

- [x] Tablas `tab_*` y SQL aplicado en Neon, con el equipo TIC y sus dos tableros (3-oct-2026)
- [x] Módulo `tableros` en todos los roles; acceso real solo por pertenencia (verificado con dirección)
- [x] Inicio: lo tuyo, equipos con baldosas, nuevo equipo, miembros, nuevo tablero, archivados
- [x] Tablero: listas, alta rápida, arrastrar (ratón y táctil), filtros, archivadas, ajustes y etiquetas
- [x] Ficha: responsables, fecha, prioridad, etiquetas, descripción, checklist, enlaces, seguimiento
- [x] Enlace directo a una tarjeta (`?t=`) y copiar enlace
- [x] Aviso flotante en `/gestion` y tarjeta en el escritorio
- [x] Correos de asignación, de equipo y diario de vencimientos (cron en `vercel.json`), con preferencias
- [~] Primer correo real de asignación y del aviso diario (plantillas revisadas renderizadas)
- [ ] Que David repase las decisiones 🤖 y la QA en iPad
