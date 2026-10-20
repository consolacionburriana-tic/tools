# Nouvinguts · el ciclo de vida del alumno nuevo

**Estado:** plan funcional ✅ · plan técnico ✅ · implementado 🟡 (en `/gestion/nouvinguts` desde el 19-oct-2026; falta estrenarlo con altas reales, ver checklist)

Idea de Jose Miguel Batalla (13-oct-2026), cerrada con David el 19-oct-2026 sobre un wireframe.
Rutas: `/gestion/nouvinguts` (lista), `/gestion/nouvinguts/<id>` (ficha con sus pasos) y
`/gestion/nouvinguts/proceso` (ordenar los pasos).

Cuando llega un alumno nuevo hay una docena de cosas que hacer entre secretaría y TIC (matrícula,
claves de Educamos, protección de datos, correo de Google, iPad, Apple School Manager,
licencias…) y nadie tenía la foto de qué falta. Este módulo es esa foto: cada alumno nuevo es una
fila con sus pasos, en verde lo hecho y con una rayita lo que todavía no se sabe. Cuando no le
queda nada, alguien **cierra su ciclo** y sale de la lista.

---

## Decisiones cerradas

1. **Nouvingut es cualquier alumno nuevo**, llegue en octubre o en mayo: todos tienen que pasar
   por los mismos pasos. **La única excepción son los de 3 años con matrícula de junio a
   septiembre**, que vienen de otro proceso (el arranque de curso) e irán a una pantalla aparte,
   por lotes, que se hará más adelante (`esInicioDeCurso` en `src/lib/nouvinguts.ts`). Un 3 años
   que llega en noviembre sí es nouvingut.
2. **Dos maneras de entrar:**
   - **Apuntado a mano** («tengo uno nuevo»): administración lo anota en dos segundos con
     nombre, apellidos (los dos en MAYÚSCULAS), curso (desplegable, obligatorio) y fecha de
     matrícula (por defecto hoy). Sale en la lista como «esperando a Educamos».
   - **Alta de la sincronización de Educamos**: cada alta nueva del Excel entra sola en
     nouvinguts, con la fecha del día como fecha de matrícula (editable).
3. **La vinculación con Educamos la hace el sistema solo**, al sincronizar: si un alta del Excel
   coincide con alguien apuntado a mano, se enlaza y listo. Coincidir es **mismo nombre y
   apellidos** (mayúsculas, sin acentos, sin dobles espacios); el curso solo desempata. **Solo
   se vincula sola si la coincidencia es única** en los dos sentidos. Si hay dos altas que se le
   parecen (hermanos) o dos apuntados con el mismo nombre, no adivina: el apuntado se queda con
   un aviso naranja «varias altas se le parecen» y alguien elige a mano desde su ficha (por el
   incidente de las fichas cruzadas de 2026, ver `06-fuente-unica-alumnado.md`).
4. **No duplica datos del alumno.** Lo apuntado a mano solo guarda nombre, apellidos, curso y
   fecha; en cuanto se vincula, todo lo demás se lee de `edu_students` y de cada módulo.
   `nou_*` guarda únicamente lo que no vive en ningún otro sitio: los pasos marcados a mano, el
   «ya está decidido» de banco y AMPA, las notas y el cierre.
5. **Los pasos** (orden por defecto; SuperTIC y TIC lo cambian arrastrando):

   | Paso | Quién | De dónde sale |
   |---|---|---|
   | Alta en Educamos | Secretaría | Automático: vinculado a su ficha de Educamos |
   | Nº de matrícula | Secretaría | Automático. Si Educamos no lo trae, aviso **«NO ESTÁ EN EDUCAMOS el número de matrícula»**; se escribe aquí y queda resuelto (se guarda en su ficha central; la sincronización no lo borra porque un vacío del Excel nunca pisa) |
   | Claves de Educamos a la familia | Secretaría | A mano |
   | Protección de datos | Secretaría | Automático: decidida cuando alguien la ha guardado (`pd_actualizado_at`). Se puede guardar desde aquí (sí/no de las cuatro) |
   | Banco de libros | Secretaría | Sí/No desde aquí, que escribe en el banco (`setBanco`). Solo desde 3º EP (`cursoEnBanco`, ajuste del centro) |
   | AMPA | Secretaría | Sí/No desde aquí, que escribe en la ficha (`setAmpa`) |
   | Materiales comprados | Secretaría | Automático: los materiales de su clase en Venta de materiales; hecho cuando todos tienen estado. Se marcan desde aquí |
   | Foto en Educamos | Secretaría | A mano |
   | Correo de Google | TIC | Automático: `email_google` de su ficha; se puede escribir aquí, o crearlo en Correos y grupos con un clic (`docs/29-cuentas.md`) |
   | Correo vinculado en Educamos | TIC | A mano |
   | iPad | TIC | A mano hasta que exista el módulo de iPads (otra tarea), que se enganchará aquí |
   | Apple School Manager | TIC | Automático: hecho si ha habido una subida a ASM (FTP o a mano) desde su alta y entra en su alcance; si no, invita a ir a AUTOASM |
   | Licencias | TIC | Automático: pedido en la campaña vigente, o «no pedirá licencias» (marca `manual_completed_at` de Licencias si el alumno está en su campaña) |

   «Correo de Google» y «Correo vinculado» **no le tocan** si la familia desestima el correo.
6. **«Desde» por curso, editable sin código**: iPad, ASM y licencias van desde 6º EP en 2026-27;
   el curso que viene 6º deja de tener iPad y licencias y se cambia a «1º ESO» en Proceso.
7. **Estados de un paso**: hecho (verde; un «no» decidido también es hecho) · pendiente (rayita,
   todavía no se sabe) · aviso (naranja, hay que hacer algo) · no le toca (por curso o por
   correo desestimado).
8. **El ciclo lo cierra una persona** con «Cerrar ciclo» cuando no le queda nada; no se cierra
   solo. Los cerrados se pueden ver y reabrir. **Aviso de atasco**: el día sale en naranja si
   lleva más de N días (10 por defecto, ajustable en Proceso).
9. **Notas en cada paso**, firmadas y con fecha. La nota de «Apuntar rápido» va a General.
10. **Permisos**: módulo `nouvinguts` (ver y trabajar) para SuperTIC, TIC, secretaría y
    dirección; `nouvinguts-proceso` (ordenar pasos, «desde», días de atasco) solo SuperTIC y TIC.
    Escribir en los datos de otros módulos exige además el permiso de ese dato (protección de
    datos, participantes del banco, materiales: secretaría, dirección y TIC).
11. **Bajas**: prediseñadas con el mismo motor (devolver lote, recoger iPad, sacar de ASM,
    licencias, suspender correo, baja en Educamos), sin construir todavía.
12. **Correos** (David, 19-oct-2026):
    - **Automáticos, configurables en Proceso** (SuperTIC/TIC): cada evento va a los grupos que
      se marquen —Dirección, Secretaría, TIC (TIC incluye SuperTIC)—, que son las personas
      activas con ese rol en Usuarios, nunca a quien lo provoca. Por defecto:

      | Evento | Por defecto a |
      |---|---|
      | Llega uno nuevo (apuntado a mano, o un correo con la lista por sincronización) | TIC |
      | Secretaría ha terminado su parte (y a TIC aún le queda) | TIC |
      | TIC ha terminado su parte (y a secretaría aún le queda) | nadie |
      | Listo para cerrar | Secretaría |

      Solo avisan las transiciones hechas desde Nouvinguts (al tocar un paso aquí). Lo que se
      resuelve solo en otro módulo (un pedido de licencias, una subida a ASM) no dispara correo.
      «Traer altas que ya había» tampoco avisa, para no mandar un correo por cada alta antigua.
    - **Nota con correo**: cualquier nota (de un paso o general) se puede mandar también por
      correo a Dirección, Secretaría, TIC y/o correos sueltos del colegio. Sale **desde el buzón
      de quien la escribe** (como Oratorios), así que las respuestas le llegan a él, y en la
      nota queda «enviada a …».

## Plan técnico

- Tablas (`src/db/schema.ts`, SQL aditivo `src/db/sql/nouvinguts.sql`):
  - `nou_alumnos`: el nouvingut. `edu_student_id` (único, nulo mientras espera a Educamos),
    nombre/apellidos/curso del apuntado a mano, `fecha_matricula`, `origen` (`manual`|`sync`),
    `estado` (`abierto`|`cerrado`), `aviso_vinculo`, cierre firmado.
  - `nou_marcas`: un paso resuelto a mano (PK nouvingut + paso).
  - `nou_notas`: notas por paso.
  - `nou_pasos`: la configuración del proceso (orden, activo, responsable, desde). Sin fila =
    lo de por defecto de `PASOS` en `src/lib/nouvinguts.ts`.
  - Ajustes (días de atasco) en `cfg_ajustes`, clave `nouvinguts`.
- Helpers puros: `src/lib/nouvinguts.ts` — catálogo de pasos, proceso efectivo, estado de cada
  paso a partir de los datos, resumen, emparejado de altas con apuntados, `esInicioDeCurso`,
  schemas Zod. Tests en `__tests__/nouvinguts.test.ts`.
- Queries: `src/lib/nouvinguts-server.ts` — lista y ficha en una tanda (`Promise.all` con
  subconsultas), escrituras de cada paso llamando al código del módulo dueño del dato
  (`guardarProteccion`, `setBanco`, `setAmpa`, `guardarEstadosMaterial`,
  `setStudentManualCompleted`), y `registrarAltasDeSync`, que llama `aplicarSync`
  (`educamos-server.ts`) después de su batch.
- API: `POST /api/nouvinguts` (apuntar), `PATCH/DELETE /api/nouvinguts/[id]` (datos, cerrar,
  reabrir, quitar un apuntado por error), `POST /api/nouvinguts/[id]/paso`, `POST
  /api/nouvinguts/[id]/notas`, `POST /api/nouvinguts/[id]/vincular`, `PUT
  /api/nouvinguts/proceso` y `POST /api/nouvinguts/importar` (traer altas ya hechas desde una
  fecha, para estrenarlo).
- UI: `src/components/nouvinguts/` — lista con la línea de pasos, ficha con pasos desplegables,
  alta rápida en diálogo y proceso arrastrable (@dnd-kit, como Tableros).

## Checklist

### Fase 1 · el módulo (19-oct-2026)
- [x] Ficha y fila en la tabla maestra
- [x] Tablas `nou_*` y SQL aplicado en Neon (19-oct-2026)
- [x] Helpers puros con tests (estado de pasos, emparejado, inicio de curso)
- [x] Lista: línea de pasos por alumno, filtros (con aviso, atascados, esperando a Educamos, listos, pendiente de secretaría/TIC), franja de listos para cerrar, cerrados
- [x] Apuntar rápido (nombre, apellidos, curso en desplegable, fecha, nota)
- [x] Ficha: pasos desplegables con su acción, notas por paso, cerrar ciclo / reabrir
- [~] Acciones en línea: nº de matrícula, protección de datos, banco, AMPA, materiales, correo, no pedirá licencias, pasos a mano (probados de verdad los pasos a mano; los que escriben en datos de otro módulo usan el código de ese módulo y no se estrenaron con un alumno real para no tocar producción)
- [~] Altas de la sincronización de Educamos entran solas y se vinculan con lo apuntado (coincidencia única) (`registrarAltas` probado contra Neon con una alta real; falta verlo en la primera sincronización)
- [~] Vincular a mano cuando la coincidencia no es única (falta estrenarlo con un caso real)
- [x] Proceso: arrastrar para ordenar, responsable, «desde», activo y días de atasco (SuperTIC/TIC)
- [~] Traer las altas ya hechas desde una fecha (para estrenarlo) (falta que David elija la fecha y las traiga)
- [x] Módulos `nouvinguts` / `nouvinguts-proceso` en la matriz de roles y tarjeta en el escritorio

### Fase 2 · correos (19-oct-2026)
- [x] Perfil de correo `nouvinguts` y plantillas (`src/lib/nouvinguts-email.ts`, con tests)
- [x] Avisos automáticos configurables en Proceso: llega uno nuevo, secretaría/TIC ha terminado su parte, listo para cerrar (destinatarios y transiciones probados contra Neon sin mandar nada)
- [x] Nota con «mandar también por correo» a grupos y correos del colegio, desde el buzón de quien la escribe; `nou_notas.enviada_a` aplicado en Neon (`nouvinguts-correos.sql`)
- [~] Primer correo real de cada tipo (no se mandó ninguno en las pruebas: el entorno tiene credenciales reales)

### Más adelante
- [x] Crear el correo de Google desde el paso: enlaza a Correos y grupos con el alumno ya elegido (`/gestion/cuentas?persona=a:<id>`, 20-oct-2026; solo a quien tiene el módulo `cuentas`)
- [ ] Enganchar el paso del iPad al módulo de iPads
- [ ] Bajas con el mismo motor
- [ ] Inicio de curso de 3 años, por lotes
