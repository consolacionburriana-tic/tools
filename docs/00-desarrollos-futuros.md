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

### Tutorías: botón "promocionar todos +1 curso" — sin implementar, falta confirmar reglas de ciclo
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

### Un usuario = un rol: se queda corto con el rol nuevo de Evaluaciones
`auth_users.role` es un único texto y `ROLE_MODULES` mapea rol → módulos. Con el rol
`evaluaciones` (2026-08-27) aparece el primer caso incómodo: quien lleve las evaluaciones es
probablemente **también tutor/a**, y al ponerle `evaluaciones` pierde Salidas y Banco de libros.
Salidas hoy: darle `direccion` (ve casi todo) o tragar con la pérdida. Arreglo de verdad: o una
tabla `auth_user_modules` de permisos extra por persona, o roles múltiples. No corre prisa hasta
que haya alguien concreto en ese caso — pero cuando lo haya, es esto.

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
- **Google Cloud**: crear el OAuth client para el login — pasitos en `01-auth-roles.md`.
- ~~**Vercel Blob**: activar el store para justificantes~~ ✅ hecho — store creado, token
  disponible, subida y visor verificados con archivos reales (`15-salidasypagos.md`).
- **Licencias** (ficha `11`): ~~cuenta de servicio de Google~~ ✅ hecha · remitente verificado
  en Resend — pendiente, faltan cosas del dominio.

---

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

---

## Backlog de módulos futuros (mencionados, sin desarrollar todavía)

- Nada más identificado por ahora aparte de los módulos ya fichados. Añadir aquí cualquier
  módulo nuevo que se os ocurra antes de tener claro su alcance.
