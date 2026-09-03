# Desarrollos futuros — próximo curso

Documento vivo de trabajo. No es una ficha de módulo (esas están en `docs/<nn>-<modulo>.md`):
aquí apuntamos todo lo que **aún no está decidido**, para hablarlo con calma en ratos libres sin
perder ideas por el camino.

> **Cómo usar este documento:**
> - La sección de arriba (**Decisiones pendientes**) son preguntas concretas que bloquean el
>   plan técnico de un módulo. Cuando una se responde, se borra de aquí y se traslada a la
>   sección "Decisiones cerradas" de la ficha del módulo correspondiente (`docs/<nn>-<modulo>.md`).
> - La sección de abajo (**Ideas y caminos de crecimiento**) son ocurrencias sin madurar: no
>   bloquean nada, solo se guardan para no olvidarlas. Se pueden promocionar a "Decisión
>   pendiente" cuando se quiera empezar a concretarlas.

> **Estado (julio 2026):** la gran tanda de decisiones de los módulos nuevos ya se cerró y vive
> en las fichas (`01`, `02`, `12`, `15`, `16`). Lo que queda aquí abajo es fino y NO bloquea
> empezar ningún hito del roadmap.

---

## 🔴 Decisiones pendientes

### ~~¿Dos tablas de alumnado (`edu_students` + `lic_students`)?~~ ✅ decidido (2026-09-03)
**No.** Una sola fuente de verdad (`edu_students`) y `lic_students` adelgazada a "quién participa
en esta campaña". La foto histórica del pedido ya vive en `lic_orders`, que guarda su propio
`curso` y `banco_libros`. Plan cerrado y listo para ejecutar en
[`06-fuente-unica-alumnado.md`](./06-fuente-unica-alumnado.md), **con prioridad máxima a partir
del 1 de noviembre de 2026**.


### ¿Qué más avisos van al tutor personal, aparte del tercer retraso?
Desde el 2026-09-03 cada alumno puede tener **tutor personal** (uno de los dos o tres tutores de
su clase; tabla `edu_tutor_personal`, reparto en `/gestion/profes`), y el **aviso del tercer
retraso de Puntualidad ya va solo a esa persona** cuando la tiene asignada
(`destinatariosDelAviso()` en `src/lib/puntualidad.ts`, con tests) — David lo pidió el mismo día.
Si el alumno no tiene tutor personal, o su tutor personal ya no tutoriza la clase o no tiene
correo, se cae a todos los tutores de la clase: un aviso nunca se queda sin destinatario.

Lo que sigue sin decidir, porque cada uno tiene su lógica:
- **Puntualidad, resumen semanal de los viernes**: hoy cada tutor recibe la clase entera. ¿Se
  parte para que cada uno vea solo a sus alumnos, o se deja así para que tenga la foto completa
  del grupo? (Argumento para dejarlo: el resumen es del grupo, no de un alumno.)
- **ABC**: el formulario sugiere destinatarios, no manda a ciegas. Como mínimo convendría poner
  primero al tutor personal del alumno en la lista de sugerencias.
- **Panel por tutoría** (`clasesDeTutor`): esto se queda por clase completa a propósito — un
  tutor ve su grupo entero aunque la mitad sean del compañero. No hace falta decidir nada.

### Cuaderno de tutor: lo que decidí yo al construirlo (2026-09-03) — revisar con David

El módulo está entero (ficha [`18-cuaderno-tutor.md`](./18-cuaderno-tutor.md)), pero cuatro cosas
las decidí sobre la marcha porque no estaban cerradas. Ninguna bloquea; todas se cambian en un rato:

- **Números de lista.** Se congelan por curso escolar. Quien llega tarde recibe el siguiente número
  libre de su clase (31, 32…) para no invalidar lo que ya está impreso, y en los listados
  regenerados aparece como `7* (31)`: dónde le toca por alfabético, con un asterisco, y entre
  paréntesis el número que se le dio. Es mi lectura de lo que dijo David ("hacemos correr la
  lista"); si lo que quiere es que en la regeneración corra de verdad la numeración entera, es
  cambiar `numeroListaTexto` y volver a numerar.
- **Alumnado sin tutor personal en una clase de dos tutores.** Se queda FUERA de la tirada y se
  avisa en la vista previa, en vez de asignarlo al primer tutor. Es un error que luego no
  encontraría nadie; el arreglo son diez segundos en `/gestion/profes`.
- **La carpeta de clase se comparte con TODOS sus tutores**, no cada juego con el suyo: es una
  carpeta, un permiso, y las regeneraciones heredan el reparto. Efecto secundario: cada tutor ve
  también los documentos de su compañero de tutoría. Si molesta, hay que bajar el compartir al
  nivel de archivo (y pasa de 25 permisos a 125).
- **Permiso por defecto: editor.** Para que el tutor pueda retocar el documento antes de
  imprimirlo. Se cambia a "solo lectura" desde el propio panel, sin tocar código.

### Cuaderno de tutor: ideas que quedaron fuera

- Un PDF con el cuaderno de **todo el centro** (hoy el "cuaderno completo" es por tutor).
- **Borrado del curso viejo**: hoy la carpeta de un curso escolar se borra a mano en Drive.
  Un botón "archivar el curso 2025-26" tendría sentido cuando haya dos o tres cursos acumulados.
- **Recordatorio anual**: un aviso en septiembre de "toca generar los cuadernos", cuando el
  módulo lleve un curso en producción y sepamos la fecha buena.
- **Primaria e Infantil**: el módulo ya soporta plantillas por etapa, pero solo hay plantillas de
  ESO. Cuando lleguen las de Primaria, es darlas de alta y marcar la etapa.

### Identificación de familias: ¿vale el DNI/NIE del propio alumno?
`identifyFamily()` (`src/lib/familias-server.ts`) acepta hoy el **documento del tutor**
(`edu_guardians.dni`, comparado normalizado) o el **NIA del alumno**. `edu_students.dni` se
importa desde Educamos pero **no se usa en ningún buscador**, ni público ni interno (ABC y
Puntualidad buscan por nombre/apellidos/NIA). Salió al revisar el 2026-09-03 por qué un NIE y un
NIA "no localizaban nada".

- A favor: en ESO hay alumnado con DNI propio, y es lo primero que uno teclea.
- En contra: amplía quién se puede identificar en una pantalla pública sin haber probado ser de
  esa familia (el formulario ya devuelve solo nombres enmascarados, pero aun así).

Decisión de David pendiente. Si es sí, es una rama más en `identifyFamily` con la misma
normalización SQL que el documento del tutor.


### ~~Banco de libros / AMPA: ¿algún rol más aparte de dirección/TIC marca participantes?~~ ✅ decidido (2026-09-01)
No: se queda **solo dirección y TIC** (`puedeGestionarParticipantesBanco()` en
`src/lib/permissions.ts`). Tutores y profes conservan el resto del módulo (lotes, checks, pasar
lista) y ven esos dos toggles en modo lectura. Cerrado en
[`12-bancolibros.md`](./12-bancolibros.md).

### ~~Correo: opción B (Google Workspace) además de Resend~~ ✅ hecho (2026-08-31)
Implementado como se había planteado: `src/lib/email.ts` es el único punto de entrada, con dos
transportes detrás de la misma interfaz (`src/lib/email-gmail.ts` con la API de Gmail sobre la
cuenta de servicio que ya existía, y Resend) y **perfiles de remitente por módulo**. Lo que se
decidió al ejecutarlo, por si hay que revisarlo:
- **El interruptor es por env, no en el panel**: `EMAIL_TRANSPORTE` global y
  `EMAIL_TRANSPORTE_<PERFIL>` por módulo. Cambiarlo no toca código; una UI en `/gestion` se
  puede añadir después si de verdad se cambia a menudo (hoy es una variable que se toca una vez).
- **Remitente por módulo**: Licencias sale y contesta a `licencias@consolacionburriana.com`
  (centralizado). El resto sale del buzón genérico y el `Reply-To` es el correo de quien manda
  (tutor de la salida, gestor de la evaluación), que es a quien hay que contestar.
- **Sigue pendiente en la consola de admin de Workspace** (no es código): añadir el scope
  `gmail.send` a la delegación de dominio de la cuenta de servicio y confirmar que
  `licencias@` es un buzón real (o poner `EMAIL_BUZON_LICENCIAS` si es un alias/grupo).
- Coste del cambio: Gmail manda de uno en uno (≈ 2,5 correos/s, ~2.000/día por buzón) frente
  a los 100 por llamada de Resend. Para los masivos grandes, ese perfil puede quedarse en
  Resend con una sola variable.

### ~~Tutorías: botón "promocionar todos +1 curso"~~ ✅ hecho (2026-09-02)
David cerró las reglas de ciclo: **Infantil rota** (3→4→5→3), **Primaria rota dentro del ciclo**
(1↔2, 3↔4, 5↔6, misma letra) y **ESO sube** (1→2→3→4) con **4º egresando**. Implementado en
`/gestion/profes` con vista previa + confirmación, junto con "limpiar tutorías" (todas o por
etapa). Lógica pura en `src/lib/tutorias.ts` y `cursoSiguiente()` en `src/lib/cursos.ts`, con
tests. Queda como referencia el planteamiento original:
La pantalla `/gestion/profes` (nueva, 2026-07-16) ya permite asignar/quitar tutores por clase
a mano (tabla `edu_tutorias`, muchos-a-muchos: sin límite de tutores por clase ni de clases por
profe, decisión explícita de David). Lo que falta es el botón de promoción automática que pidió
originalmente, y su regla de negocio no está clara en los bordes:
- **ESO**: sube todo el mundo +1 curso, salvo 4º ESO → se queda sin tutoría (hay que reasignar
  a mano el año que viene). Esto sí está claro.
- **Primaria**: "cambia dentro del ciclo" (1º→2º, 3º→4º, 5º→6º, misma letra) — pero no se
  especificó qué pasa con los tutores que YA están en 2º/4º/6º (fin de ciclo): ¿se quedan sin
  tutoría como el 4º ESO, o se dejan intactos hasta reasignar a mano? Hay que confirmarlo antes
  de tocar código, porque mover mal esto desordenaría tutorías reales de todo el centro.
- **Infantil**: "cíclico 3-4-5" — ¿significa que el tutor de 5INF vuelve a 3INF (rota) o se queda
  sin tutoría igual que el resto de finales de ciclo? También sin confirmar.

### ~~Magic links para familias (`fam_access_tokens`)~~ ✅ hecho (2026-07-30), estrenado en Salidas (2026-08-06)
Implementado para Licencias y **reutilizable tal cual** por cualquier módulo público: un token
por correo de familia que combina a todos sus hijos, `/licencias?t=tok_…`, correo masivo por
cursos y clases desde `/gestion/licencias/correos`. Decisiones cerradas (agrupación por correo,
multiuso, caducidad 120 días, revocación) en [`11-licencias-v2.md`](./11-licencias-v2.md).
Salidas ya lo usa: `/salidas?t=tok_…` auto-identifica a la familia, y el recordatorio de pago
(`/gestion/salidas/<id>`, panel de recordatorio) manda `{enlace}` personal en el correo.

### Legacy pendiente de retirar del todo (cuando deje de hacer falta)
- Tabla `teachers` (ABC pre-login): solo se usa para pintar nombres de los 6 registros
  históricos (`/api/teachers` devuelve unión central+legado). Cuando dé igual, migrar esos
  nombres a texto y borrar tabla + join.
- Aliases `students`/`behaviorReports` en `src/db/schema.ts` (apuntan a `abc_*`): renombrar
  imports y quitarlos en una pasada mecánica.
- Columna `lic_students.educamos_id` (texto) duplicada por el enlace `edu_student_id`.

### Salidas: flecos
- Export CSV del seguimiento de una salida (los recordatorios de pago y el enlace de
  entradas manuales ya están, 2026-07-11).


### Cabos sueltos de la sesión 2026-07-10 (revisar con David)
- **4 alumnos sin código interno** por venir sin fecha de nacimiento en el export de Educamos
  (Ncogo Roca, Perdomo Montenegro, Rodríguez Lamilla, Pastor Monsonis): o se les añade la fecha
  en Educamos y se re-sincroniza, o se les pone código a mano.
- **1 colisión de código resuelta con variante**: Marina Santos Miró (3ESO B) → `11SANARI`
  (11SANMAR ya estaba ocupado). Confirmar que no choca con el código que use el Sheet.
- **9 alumnos de Licencias sin enlace** a la BBDD central (sin pedido; parecen bajas que ya no
  vienen en el export): se pueden ignorar o desactivar.
- **1 alumno del ABC sin enlazar** a la BBDD central (su nombre está anonimizado "R. …"):
  enlazarlo a mano si se quiere historial unificado.
- **Import de profes: datos laborales excluidos** (contrato, jornada, nº seg. social,
  retribuciones, pagadores/IBAN) — decisión tomada por prudencia de datos; revisar si algún
  módulo futuro los necesitara.
- **Probar el flujo OAuth real** (Google) en local y en Vercel: las env vars están, pero el
  login de verdad solo lo puede probar una cuenta del dominio. Añadir también las 3 vars
  `AUTH_*` en Vercel antes del deploy.

### Auth y roles
- Validar (o ajustar) la **matriz rol→módulos por defecto** propuesta en
  [`01-auth-roles.md`](./01-auth-roles.md) — es un cambio de una línea en
  `src/lib/permissions.ts`, se puede ajustar sobre la marcha.

### ~~Evaluaciones: catálogo de preguntas predefinidas~~ ✅ hecho (2026-08-25)
Vive en código (`CATALOGO` y `presetActividad` en `src/lib/evaluaciones.ts`), sacado de los
formularios reales de Pastoral: preset distinto para alumnado y profesorado, con las frases a
adaptar marcadas en ámbar. Las preguntas propias que guarde el claustro van a
`eval_question_templates`. Detalle en [`16-evaluaciones.md`](./16-evaluaciones.md).

### ~~Evaluaciones: redacción del aviso de anonimato al alumnado~~ ✅ decidido (2026-08-25)
El pie del formulario de alumnado dice solo "🔒 Tus respuestas son anónimas."; la coletilla
explicativa se quitó por decisión de David. Queda anotado, porque es lo único del módulo con
aristas: en alumnado con enlace personalizado **sí** se guarda `edu_student_id` (decisión
cerrada, para poder investigar un caso puntual), así que si alguna vez una familia pregunta,
la respuesta honesta es "en pantalla nadie ve nombres, pero el envío es nominal". El profesorado
no tiene ese matiz: ahí no se guarda absolutamente nada.

### ~~Un usuario = un rol~~ ✅ resuelto (2026-08-27)
Ya no hace falta elegir entre "tutor" y "el que lleva las evaluaciones": el rol da el punto de
partida y `auth_users.modulos_extra` / `modulos_bloqueados` permiten afinar persona a persona
desde `/gestion/usuarios`. Ver [`01-auth-roles.md`](./01-auth-roles.md).

### Evaluaciones: familias
El modelo y el envío a correos de tutores están listos, pero el flujo bueno sería el magic link
de familias (`fam_access_tokens`, ya usado por Licencias y Salidas) con su propio propósito
`evaluaciones`. Se hará cuando se estrene de verdad con familias.

### ~~Banco de libros: dónde vive el `academic_year`~~ ✅ decidido e implementado
Constante en código (`academicYearActual()` en `src/lib/constants.ts`), sin tabla de
configuración en BBDD. Decisión cerrada en [`12-bancolibros.md`](./12-bancolibros.md).

---

## 📥 Inputs pendientes de David (no son decisiones, son accesos/materiales)

Recopilados de las fichas, para verlos de un vistazo:

- ~~**Educamos**: un export real de alumnado y de tutores~~ ✅ recibido (jul 2026) — mapeo de
  columnas fijado en `02-integracion-educamos.md`. El fichero NO se commitea (`.gitignore`).
- **Logo vectorial del colegio (SVG o AI)**: los iconos de la PWA ya llevan el emblema real,
  extraído del PNG del lockup, así que el de 192 sale nítido y el de 512 algo suave. Con el
  vectorial se regeneran perfectos cambiando una línea (`ORIGEN` en `scripts/iconos-pwa.py`).
  No urge.
- **Google Cloud**: crear el OAuth client para el login — pasitos en `01-auth-roles.md`.
- ~~**Vercel Blob**: activar el store para justificantes~~ ✅ hecho — store creado, token
  disponible, subida y visor verificados con archivos reales (`15-salidasypagos.md`).
- **Licencias** (ficha `11`): ~~cuenta de servicio de Google~~ ✅ hecha · remitente verificado
  en Resend — pendiente, faltan cosas del dominio.
- **Cuaderno de tutor** (ficha `18`): (a) la **URL de la subcarpeta de la unidad compartida** donde
  van los cuadernos, (b) dar de alta a la cuenta de servicio (`GOOGLE_SA_CLIENT_EMAIL`) como
  **Administrador de contenido** de esa unidad, (c) compartir con ese mismo correo cada plantilla
  de Google Docs, y (d) `pnpm db:push` para crear las tablas `cuad_*`. Con eso, el módulo se
  estrena; todo lo demás está hecho y probado.
- **Tutorías del curso 2026-27**: `edu_tutorias` solo tiene filas de **2025-26**, y el curso
  en vigor ya es 2026-27. Mientras no se asignen, Puntualidad no tiene a quién mandar el
  aviso del tercer retraso ni el resumen semanal, y los tutores ven su panel vacío. Afecta
  también a los destinatarios sugeridos del ABC. Es lo primero del arranque de curso.
  David decidió (2026-09-03) **clonarlas tal cual** —cada tutor se queda en su misma
  clase—, no promocionar con el botón de `/gestion/profes` (que sube al tutor con su grupo):
  el SQL está listo e idempotente en `src/db/sql/tutorias-2026-27.sql`. Pendiente de
  ejecutar (el conector de Neon se desconectó a media faena).
- **Puntualidad** (ficha `17`): ~~ejecutar el SQL de las tablas~~ ✅ hecho (2026-09-03).
  Queda opcional: poner `PUNTUALIDAD_AVISOS_COPIA` en Vercel si jefatura quiere copia del
  aviso del 3er retraso, y confirmar que el cron semanal (`vercel.json`) queda activo con su
  `CRON_SECRET`.
- **Banco de libros** (ficha `12`): ejecutar `pnpm db:push` en Neon para la columna
  `edu_students.ampa` y la tabla `bl_libros_curso` (cambios aditivos). El código está desplegable,
  pero hasta que no se aplique el schema la pestaña AMPA y los libros manuales darán error.

---

### Puntualidad: lo que quedó anotado al construirlo (2026-09-02)
- **Consecuencias como módulo propio**: nacen dentro de Puntualidad pero con prefijo `con_*`
  y `origen` ('puntualidad' | 'manual') justo para poder separarlas. Cuando haga falta
  registrar consecuencias de convivencia, se mudan esas tres tablas y sus pantallas.
- **Aviso a familias en cada retraso**: descartado por ahora (sería el correo con más ruido
  del colegio). Si algún día se quiere, el sitio natural es el mismo route de alta.
- **Franjas además de la entrada**: hoy solo se registra la entrada de las 8:00 con límite
  08:05. Si se quisiera apuntar retrasos tras el patio, habría que añadir franja + límite por
  franja. Se decidió esperar a tener los horarios.
- **Borrar un retraso** lo puede hacer cualquiera con el módulo (y un tutor solo en sus
  clases). No hay auditoría de borrados: si algún día importa, es el caso de uso del
  historial transversal que ya está apuntado como idea abajo.

## 💡 Ideas y caminos de crecimiento (sin decidir, para explorar)

- ~~**Mejorar la PWA** (instalación en iPad)~~ → promocionada a ficha propia con plan y
  checklist: [`05-pwa.md`](./05-pwa.md).
- **Plataforma de pago online** para Salidas (y quizá Licencias): sustituiría el justificante
  subido por pago real. Implica pasarela (Stripe u otra), comisiones y decisión de dirección.
- IA (Gemini u otro modelo) para sugerir redirecciones o detectar patrones en Registro ABC
  (ya apuntado como "Fase 3" en el README original).
- Notificaciones por WhatsApp o push, además de email, para avisos urgentes (p. ej. "falta tu
  justificante de pago").
- Dashboard agregado de dirección que cruce datos de varios módulos (p. ej. económico de
  Licencias + Salidas y pagos).
- Firma electrónica de documentos (autorizaciones de salidas, documentación de banco de libros)
  en vez de papel escaneado.
- Exportación/sincronización automática hacia Educamos (hoy todo lo que sale de la app hacia
  Educamos es manual).
- Auditoría/historial de cambios transversal (quién tocó qué registro y cuándo), útil sobre
  todo para Registro ABC y Banco de libros. (`edu_sync_runs` ya nace con esta filosofía.)
- ~~**Pasada de rediseño, PERFECTITO PERFECTITO**~~ ✅ hecho (2026-08-29) para **Evaluaciones**:
  jerarquía de cuatro niveles, guía de color por actividad, edición en sitio y acciones
  atenuadas. Ver "Jerarquía visual del módulo" en [`16-evaluaciones.md`](./16-evaluaciones.md).
  El vocabulario (`src/components/evaluaciones/ui.tsx`) está pensado para poder extenderse a
  otros módulos: **Salidas, Banco de libros y Licencias siguen con el lenguaje viejo** (borde
  gris de 1px, campos con borde permanente). Cuando alguno se quede igual de denso, el camino ya
  está trazado — pero no se ha tocado, que cada módulo tiene sus propios usuarios y sus manías.

---

## Backlog de módulos futuros (mencionados, sin desarrollar todavía)

- Nada más identificado por ahora aparte de los módulos ya fichados. Añadir aquí cualquier
  módulo nuevo que se os ocurra antes de tener claro su alcance.
