# Pequeños arreglos pendientes 
> Documento vivo estilo checklist con pequeños arreglos que hay que ir haciendo. Cuando algo este hecho llevarlo al final de la lista y marcarlo como hecho (tachado). si hay que documentar algo sobre esto, agente de IA, hazlo en el documento correspondiente


### Pendiente de decisión tuya
- **Transversales dejados en "General"** (el campo `etapa` es único y no representa varias): BORT (orientación EP+ESO), COMPAÑ (EP+ESO+orient.), VIDAL (orient. EI+EP), PEÑA Salomé y SEBASTIA Emilia (dirección). En "General" aparecen en salidas de cualquier etapa. Si prefieres clavarles UNA etapa, dímelo.
- **Botón "promocionar tutores +1 curso"**: la pantalla de asignar tutores ya está (ver Hecho ✅ abajo), pero el botón de promoción automática que pediste no está claro en los bordes de ciclo (qué pasa con los tutores de 2º/4º/6º EP y de 5º INF). Detalle y pregunta concreta en `docs/00-desarrollos-futuros.md` → "Tutorías: botón promocionar".

---

## Hecho ✅

### Pantalla de tutorías (nuevo, 2026-07-16)
- ~~Una pantalla sencilla donde ver todos los profes por etapa... poder marcarles de qué tutoría son, de qué clase son; una clase puede tener varios tutores... incluso ilimitado, muchos-a-muchos~~ → **`/gestion/profes`**: rejilla de clases agrupadas por etapa (infantil → primaria → secundaria), cada clase muestra sus tutores actuales (chips quitables) y un buscador para añadir más. Sin límite: una clase puede tener N tutores, un profe puede tutorizar N clases (confirmado explícitamente por David, "hazlo muchos a muchos por ser flexibles").
  - Tabla nueva `edu_tutorias` (muchos-a-muchos, año académico), sembrada desde los 28 tutores que traía Educamos + las 4 tutorías nuevas que confirmaste (García→2ESO B, Soler→1ESO A, Tirado→1ESO A, Vives→4ESO B). A partir de ahora esta tabla es la fuente de verdad — el sync de Educamos ya no la toca.
  - Nuevo módulo de permisos `profes` (acceso: SuperTIC, TIC, Dirección, Jefatura).
  - **Sin hacer todavía**: el botón "promocionar +1 curso" — ver "Pendiente de decisión tuya" arriba.
  - Verificado contra datos reales: 28 clases, todas con tutor asignado, las 4 con 2-3 tutores salen bien; probado el ciclo completo asignar→quitar.
- ~~Profes que ya no están: Cristina Nuncia y Nuria Vicent~~ → dados de baja del claustro (`active=false`) — sin acceso y fuera de listados, datos históricos conservados. **Juan Luis Torralba se ha dejado intacto** a petición tuya ("menos a Juan Luis Torralba").

### General
- ~~Los profes tienen que tener la etapa de la que forman parte~~ → columna `edu_teachers.etapa` (EI/EP/ESO). Los **28 tutores** rellenados automáticamente desde su clase (y el sync de Educamos la re-deriva sola). Los **no-tutores** marcados con las etapas que indicó David (EI 7 · EP 19 · ESO 18 · General 10). Ver arriba "Pendiente de decisión tuya" para transversales.

### General
- ~~Los profes tienen que tener la etapa de la que forman parte~~ → columna `edu_teachers.etapa` (EI/EP/ESO). Los **28 tutores** rellenados automáticamente desde su clase (y el sync de Educamos la re-deriva sola). Los **no-tutores** marcados con las etapas que indicó David (EI 7 · EP 19 · ESO 18 · General 10). Ver arriba "Pendiente de decisión tuya" para transversales y bajas.
- ~~Cuando entras en una aplicacion, al menos desde el movil, te desliza un poco el scroll hacia abajo y no se ve el encabezado de arriba~~ → los encabezados de módulo (Salidas, ABC, Banco, Usuarios) ahora son **sticky** (`sticky top-0`), así que quedan siempre visibles al hacer scroll.
- ~~Reutiliza la forma de mostrar y ordenar a los profes por etapa primero, por orden de la clase despues y dentro de "otros profesores" por alfabetico de nombre y seccion "General" para los profes que no tienen etapa; los deshabilitados no se muestran~~ → helper puro reutilizable en `src/lib/profes.ts` (`agruparProfes`), apoyado en `src/lib/cursos.ts` (orden por etapa/curso). Ya lo usa el selector de responsables de Salidas.

### Banco de libros
- ~~Mejorar el selector de cursos: siempre en orden infantil → primaria → secundaria y ocultar los cursos por debajo de 3º EP (el banco empieza ahí)~~ → selector agrupado por etapa; filtro `cursoEnBanco()` oculta infantil, 1º y 2º de EP. Orden en `src/lib/cursos.ts`.
- ~~En la BBDD de alumnos de Google Sheets hay un check de quién es del banco de libros; actualizar eso en Neon~~ → leído "BBDD Alumnos" (col. B = código, col. K = Banco Libros) y sincronizado a `edu_students.banco_libros`: **149 alumnos marcados como NO banco**, 493 sí. Nota: 11 códigos del Sheet no existen en Neon (bajas/placeholders tipo `99NCOALF`) y no se tocaron. El flag no está en el export de Educamos, así que el sync no lo pisa.

### Salidas
- ~~Descripción: cambiar "la ven las familias" por "Pueden verla las familias al entregar justificante"~~ → hecho (ahora es texto de ayuda bajo la etiqueta "Descripción").
- ~~Cuando los profes tengan etapa asignada, sugerir como posibles profesores los de la etapa y marcar los tutores con un color~~ → el selector de responsables está agrupado por etapa, las etapas de las clases seleccionadas salen primero con la etiqueta "sugeridos", los tutores llevan un punto ámbar y el tutor de una clase seleccionada se resalta con estrella.

### Roles
- ~~Botón sencillo para DESACTIVAR el acceso a ciertos correos de profes; una vez desactivados poder eliminarlos definitivamente; sus datos registrados se mantienen~~ → en `/gestion/usuarios`: botón 🚫 por fila para quitar acceso (crea fila `auth_users` con `active=false` → `resolverRol()` devuelve null). Al quedar "Sin acceso" aparecen **Reactivar** y **Eliminar** (baja en `edu_teachers` + borra la fila de auth; los registros históricos se conservan por las FKs).
