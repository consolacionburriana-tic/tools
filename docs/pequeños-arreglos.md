# Pequeños arreglos pendientes 
> Documento vivo estilo checklist con pequeños arreglos que hay que ir haciendo. Cuando algo este hecho llevarlo al final de la lista y marcarlo como hecho (tachado). si hay que documentar algo sobre esto, agente de IA, hazlo en el documento correspondiente


### Pendiente de decisión tuya
- **¿El formulario público debe encontrar a la familia con el DNI/NIE del propio alumno?**
  Hoy `identifyFamily()` (`src/lib/familias-server.ts`) acepta el documento del **tutor** o el
  **NIA** del alumno, pero nunca `edu_students.dni`, que sí se importa. Si David teclea el DNI de
  un alumno no encuentra nada — y en ESO hay alumnos con DNI propio. Es un cambio de una línea,
  pero amplía quién puede identificarse en una pantalla pública, así que lo decides tú. Apuntado
  también en `docs/00-desarrollos-futuros.md`.
- **Cabeceras del Excel de Educamos por lista blanca exacta.** `CAMPOS_ALUMNO`
  (`src/lib/educamos.ts`) casa `nia: ['NIA']` y `dni: ['DNI ALUMNO','DNI']` de forma literal:
  cualquier variante real del fichero ("N.I.A.", "DNI/NIE", "NIF", "DOCUMENTO") cae en
  `extra-alumno` y deja `nia`/`dni` en NULL sin dar error. Efecto secundario feo: `matchStudent()`
  no puede casar por NIA/DNI en el import siguiente → duplicados. Hoy los datos están bien (0
  NIA duplicados, 3 alumnos sin NIA y 4 sin código de 640 activos), así que no urge; hace falta
  ver un fichero real tuyo para decidir si se pasa a alias por regex o basta con un aviso
  explícito en el resumen del asistente ("en este fichero no he encontrado columna NIA").

### Pendiente de que lo hagas tú en la app
- [ ] **NO sincronices el alumnado de Licencias todavía** (2026-09-03). Antes hay que hacer,
      en este orden: (1) la limpieza de datos de abajo, (2) `pnpm db:push` para crear la única
      `lic_students_campaign_edu_uq`. La vista previa que viste (50 bajas / 32 altas) era el bug:
      emparejaba por `student_code`, que cambia solo. Detalle en `docs/11-licencias-v2.md`.
- [ ] **Limpieza previa en Neon** (7 pares bloquean la única nueva; ninguna fila a borrar):
      - 6 filas duplicadas obsoletas de julio (ya inactivas y **sin pedidos**): `11BERSHE`,
        `15FELYAI`, `05MASJOR`, `11PASAIT`, `11RODVÍC`, `13RUICLA`. Se les pone
        `edu_student_id = NULL` y se quedan como histórico inerte.
      - **Marina Santos Miró**: su fila de Licencias (`11SANMAR`) apunta al alumno equivocado
        de la central (**Marta Sánchez Clofent**, que sí tiene pedido) porque los códigos
        generados de las dos colisionaban. Hay que reapuntarla a su `edu_student_id` real
        (`f6ef3923-…`, NIA 11263664). Marta se queda como está: su pedido no se toca.
- [ ] **`pnpm db:push`** después de la limpieza.
- [ ] **Y entonces sí, sincronizar el alumnado de Licencias** (`/gestion/licencias/sincronizar` → Alumnado,
      tiene vista previa antes de escribir). Arregla de una pasada los **6 alumnos descuadrados**
      de banco de libros (entre ellos Isabel y Elena Porcar) y da de alta los **13 alumnos
      activos de cursos con Licencias** que están en la BBDD central pero no en la campaña —
      entre ellos JUAN SEBASTIAN PEDRAZA (NIA 13620087), que era el que no localizabas. Detalle
      completo en `docs/12-bancolibros.md`, "Fase 5".

---

## Hecho ✅

### Licencias · lista de pedidos (2026-09-02)
- ~~Añadir la letra de la clase como columna, que se vea bien~~ → columna **Clase** con la letra
  en una insignia azul (`A`, `B`, `PDC`…), fácil de barrer con la vista. Sale de
  `lic_students.letra`, que ya existía y no se estaba propagando a la lista.
- ~~Que se puedan ordenar~~ → **Alumno, Curso, Clase, Fecha y Total** son clicables: un clic
  ordena, otro le da la vuelta, con la flecha marcando por dónde va. Los cursos se ordenan en
  orden escolar (infantil → ESO, con `ordenCurso`), no alfabético, así que 2ºESO no sale antes
  que 10º de nada. Por defecto sigue saliendo lo último pedido arriba.

### Correos: importes pegados a la etiqueta (2026-09-02)
- ~~En el correo de confirmación de licencias los precios salían pegados: "Total51 €"~~ → la
  culpa era `display:flex` + `justify-content:space-between`, que **los clientes de correo
  ignoran** (Gmail entre ellos), así que los dos `<span>` caían uno junto a otro. Ahora
  concepto/importe van en **tabla de dos celdas** con la derecha en `align="right"`, que es lo
  único que respetan todos. Arreglado en los tres sitios que lo tenían: recibo y bloques de
  icono de `licencias-email.ts`, el mismo recibo de `salidas-email.ts` ("Fecha…", "Importe…")
  y la inicial del círculo del alumno en `email-template.ts` (ABC), que no se centraba.
- Con test de regresión (`receiptTable` en `src/lib/__tests__/licencias-email.test.ts`): si
  alguien vuelve a meter flexbox en el recibo, salta.

### Tutorías: acciones en bloque (2026-09-02)
- ~~**Botón "promocionar tutores +1 curso"**~~ → hecho, con **vista previa antes de aplicar** (lista "Profe: 2ESO B → 3ESO B" / "sin tutoría (egresa)") y confirmación. Reglas que decidiste: **Infantil rota el ciclo** 3→4→5→3 · **Primaria rota dentro del ciclo** 1↔2, 3↔4, 5↔6 · **ESO sube** 1→2→3→4 y **4º egresa**. Si la clase destino no existe (p. ej. no hay `2PRI B`), esa tutoría se libera en vez de inventarse la clase. El plan se recalcula en servidor, no se fía del que ve el navegador.
- ~~Limpiar tutorías para ahorrar clics~~ → botones **Todas / Infantil / Primaria / Secundaria** con confirmación que dice cuántas se van a borrar y avisa de que el formulario del ABC se queda sin sugerencias de destinatarios. Solo borra el curso académico en vigor: el histórico de otros años no se toca.
- ~~**Transversales dejados en "General"**~~ → decidido: **se quedan en "General"** (BORT, COMPAÑ, VIDAL, PEÑA Salomé, SEBASTIA Emilia). Así siguen apareciendo en salidas de cualquier etapa, que es lo que interesa.

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
