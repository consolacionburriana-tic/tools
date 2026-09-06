# Tools Consolación · visión de la plataforma

Este repo deja de ser "una herramienta" para convertirse en la **navaja suiza digital del
colegio**: un único sitio (`tools.consolacionburriana.com`) donde viven módulos pequeños e
independientes que, en general, siguen el mismo patrón:

> **formulario (a veces con archivo adjunto) → datos centralizados en Neon → aviso/notificación
> a quien tiene que enterarse (Resend)**.

Cada módulo resuelve una gestión concreta del día a día del colegio. No comparten lógica de
negocio entre sí, pero sí comparten infraestructura: base de datos, envío de correo, y (cuando
estén listos) el login por roles y la BBDD central de alumnado/tutores importada de Educamos.

---

## Cómo se organiza esta documentación

Convención de nombres: `docs/plataforma.md` es el mapa (este documento); el resto van numerados —
`0x-*` para piezas transversales y `1x-*` para módulos.

Léelo en este orden si te incorporas a una sesión de desarrollo (persona o agente):

1. **`docs/plataforma.md`** *(este documento)* — el mapa: qué módulos hay, en qué estado está
   cada uno, el roadmap de hitos y las decisiones de arquitectura compartidas.
2. **[`docs/04-convenciones-tecnicas.md`](./04-convenciones-tecnicas.md)** — CÓMO se escribe
   código aquí: patrones, gotchas del stack, reglas de datos personales y definition of done.
   Lectura obligada antes de implementar nada.
3. **[`docs/00-desarrollos-futuros.md`](./00-desarrollos-futuros.md)** — decisiones pendientes,
   inputs que solo David puede desbloquear, decisiones ya cerradas (el histórico del *por qué*) e
   ideas sin decidir. Documento vivo.
4. **`docs/<nn>-<modulo>.md`** — un documento por módulo/pieza con su plan funcional, plan
   técnico y checklist de fases (formato heredado de `11-licencias-v2.md`, que fue el primero).

**Regla de oro:** antes de tocar un módulo, lee su ficha. Antes de decidir alcance nuevo, mira
"Decisiones pendientes" en `00-desarrollos-futuros.md`. Cuando una decisión se cierra, se mueve
del doc de futuros a la sección "Decisiones cerradas" de la ficha del módulo correspondiente.

### Protocolo "sigue haciendo" (para agentes)

Cuando David diga "sigue haciendo" (o equivalente) sin más contexto, este es el algoritmo:

1. Lee la **tabla maestra de estado** (abajo) y el **roadmap de hitos** para ver qué toca.
2. Abre la ficha del hito activo y busca la primera casilla `[ ]` sin marcar de la fase en curso.
3. Si la casilla depende de una **decisión pendiente** o de un **input de David** (credenciales,
   accesos, ficheros), sáltala, dilo explícitamente al final de la sesión, y sigue con la
   siguiente casilla desbloqueada.
4. Implementa, verifica (build + prueba manual o por API), y **marca la casilla `[x]` en la
   ficha en el mismo commit** que el código. Una casilla sin marcar = no está hecho; una casilla
   marcada = está hecho y verificado.
   Excepción: una casilla puede marcarse `[~]` = "código terminado, pendiente solo de
   verificación o credenciales de David" — cuenta como bloqueada (ver punto 3), no como
   pendiente de implementar. No abuses de este estado: solo cuando el código ya existe y
   funciona, y lo único que falta es algo que solo David puede dar o probar.
5. Si durante el trabajo surge una decisión nueva, no la tomes en silencio: apúntala en
   `00-desarrollos-futuros.md` (si bloquea, en "Decisiones pendientes"; si no, en "Ideas") y
   menciónala al reportar.
6. Al terminar la sesión, actualiza la tabla maestra si algún estado cambió (⬜ → 🟡 → ✅).

---

## Tabla maestra de estado

Esta tabla es el check-list general: para cada módulo o pieza transversal, si está **planificado
a nivel funcional** (sabemos qué tiene que hacer), si tiene **plan técnico** (sabemos cómo se va
a construir) y si está **implementado** (ya funciona en el repo).

| Módulo / pieza | Plan funcional | Plan técnico | Implementado | Ficha |
|---|---|---|---|---|
| Registro ABC (conductas disruptivas) | ✅ | ✅ | ✅ (login del claustro; alumnado enlazado por NIA y en siglas; panel en `/gestion/abc`) | [`10-registro-abc.md`](./10-registro-abc.md) |
| Licencias digitales | ✅ | ✅ | ✅ (Fases 0-2b; 137 pedidos y 413 magic links de familias ya en Neon; quedan códigos de activación) | [`11-licencias-v2.md`](./11-licencias-v2.md) |
| BBDD central Educamos (alumnos + tutores + profes) | ✅ | ✅ | 🟡 (poblada y en uso: 640 alumnos y 54 profes activos —97 fichas contando bajas—; faltan pantallas de gestión. Tutor personal por alumno en uso: 56 alumnos repartidos) | [`02-integracion-educamos.md`](./02-integracion-educamos.md) |
| Auth (login Google) + roles/permisos | ✅ | ✅ | ✅ (sesión 10 meses; falta prueba OAuth real de David) | [`01-auth-roles.md`](./01-auth-roles.md) |
| Escritorio de administración (bienvenida) | ✅ | ✅ | ✅ (tarjetas por rol + stats) | [`03-escritorio-admin.md`](./03-escritorio-admin.md) |
| Salidas y pagos | ✅ | ✅ | ✅ (Blob activo, correos de recordatorio activos; falta export CSV) | [`15-salidasypagos.md`](./15-salidasypagos.md) |
| Banco de libros | ✅ | ✅ | ✅ (participantes, AMPA, lotes, valoración por libro, resumen agregado y conector Excel→catálogo; schema al día en Neon) | [`12-bancolibros.md`](./12-bancolibros.md) |
| Evaluaciones de actividades | ✅ | ✅ | ✅ (Fases 0-4 en producción: editor con presets, formulario público, envío por correo, dashboard y comparativas) | [`16-evaluaciones.md`](./16-evaluaciones.md) |
| Puntualidad (retrasos de entrada) | ✅ | ✅ | ✅ (Fases 0-3 en Neon y verificadas; tutorías de 2026-27 asignadas en las 28 clases, así que los avisos ya salen) | [`17-puntualidad.md`](./17-puntualidad.md) |
| Cuaderno de tutor | ✅ | ✅ | 🟡 (motor, cola, panel, asignaturas por curso y compartir listos y probados con datos reales; tablas ya en Neon. Falta la carpeta de la unidad compartida de David) | [`18-cuaderno-tutor.md`](./18-cuaderno-tutor.md) |
| PWA en iPad (transversal, priorizada) | ✅ | ✅ | 🟡 (Fases 1-2: iconos con el emblema real, atajos, service worker y página de sin conexión; falta la QA en iPad de David) | [`05-pwa.md`](./05-pwa.md) |
| Horarios (transversal: rejillas, horarios de clase y de profe) | ✅ | ✅ | 🟡 (infantil y primaria importados y navegables en `/gestion/horarios`: vistas por clase, profesor y aula, con importación desde el `.docx` de Educamos; falta secundaria) | [`07-horarios.md`](./07-horarios.md) |
| 🔴 **Fuente única de alumnado** (transversal) | ✅ | ✅ | ⬜ **PRIORIDAD MÁXIMA desde el 1-nov-2026.** Plan cerrado y listo para ejecutar; causó 4 incidentes en producción | [`06-fuente-unica-alumnado.md`](./06-fuente-unica-alumnado.md) |

Leyenda: ✅ hecho y verificado · 🟡 empezado y en uso, pero le falta algo (lo que falta va entre
paréntesis) · ⬜ sin empezar.

> **Última revisión de esta tabla contra Neon: 5-sep-2026.** Los estados se van quedando viejos
> solos; cuando toques un módulo, comprueba su fila y actualiza esta fecha.

> 🔴 **Lo primero a partir del 1 de noviembre de 2026** es la **fuente única de alumnado**
> ([`06-fuente-unica-alumnado.md`](./06-fuente-unica-alumnado.md)), por delante de cualquier
> casilla de cualquier otro hito. Va también como parada obligatoria al principio de `AGENTS.md`.

> Cuando arranquemos un módulo cualquier día, este documento dice de un vistazo qué falta:
> si falta el "plan funcional", tocan preguntas y decisiones (ver `00-desarrollos-futuros.md`).
> Si el funcional ya está pero falta el técnico, toca diseñar schema + rutas. Si ambos están en
> ✅ y falta implementado, toca picar código siguiendo las fases de la ficha.

---

## Roadmap de hitos (orden de implementación)

El orden importa porque los módulos nuevos dependen de las dos piezas transversales. No se
empieza un hito hasta que el anterior está funcional (no hace falta que esté perfecto).

| # | Hito | Ficha | Por qué en este orden |
|---|---|---|---|
| 1 | **BBDD central Educamos → Neon** (`edu_*`) | [`02`](./02-integracion-educamos.md) | Todo lo demás consume alumnado/tutores de aquí. Sin esto, cada módulo repetiría su import manual. |
| 2 | **Auth + roles** (`auth_*`) + **escritorio de administración** | [`01`](./01-auth-roles.md) · [`03`](./03-escritorio-admin.md) | Los módulos nuevos nacen ya detrás del login; el escritorio es "lo que ves tras el login", así que va junto. |
| 3 | **Migración de ABC y Licencias** al nuevo login y a `edu_students` | [`10`](./10-registro-abc.md) · [`11`](./11-licencias-v2.md) | Cierra la deuda: `/admin` sin auth y `licencias-auth.ts` con password fija. |
| 4 | **Salidas y pagos** (`sal_*`) | [`15`](./15-salidasypagos.md) | Primer módulo nuevo completo; introduce la subida de archivos (Vercel Blob). |
| 5 | **Banco de libros** (`bl_*`) | [`12`](./12-bancolibros.md) | Necesita el modelo anual lote↔alumno bien pensado; se apoya en `edu_students`. |
| 6 | **Evaluaciones** (`eval_*`) | [`16`](./16-evaluaciones.md) | Motorcito de formularios propio; el más independiente, puede ir en paralelo si conviene. |

Fuera de esos seis hitos, y por eso no llevan número: los **horarios**
([`07-horarios.md`](./07-horarios.md), Fase 0 hecha — los estrena Puntualidad y enseguida los
piden sustituciones y documentación de clase); el **cuaderno de tutor**
([`18-cuaderno-tutor.md`](./18-cuaderno-tutor.md), construido de una pieza en septiembre de 2026:
no dependía de nada nuevo, solo lee `edu_*`); y la **PWA** ([`05-pwa.md`](./05-pwa.md),
priorizada por David — Fases 1-2 hechas: iconos, atajos, service worker y página de sin
conexión). Auditoría de cambios y dashboard de dirección siguen como ideas en
`00-desarrollos-futuros.md`.

---

## Principios de arquitectura compartidos

- **Monolito modular en Next.js (App Router).** Cada módulo vive en su propia carpeta de rutas
  (`src/app/(public)/<modulo>` si es formulario público, `src/app/gestion/<modulo>` si es panel
  interno) y no depende de las demás.
- **Una base de datos (Neon + Drizzle), un schema por módulo con prefijo de tabla propio**:
  `abc_*` Registro ABC · `lic_*` Licencias · `edu_*` BBDD central Educamos · `auth_*` usuarios y
  roles · `sal_*` Salidas y pagos · `bl_*` Banco de libros · `eval_*` Evaluaciones ·
  `hor_*` Horarios · `pun_*` Puntualidad y `con_*` consecuencias (prefijo aparte a propósito: una consecuencia no
  siempre nace de un retraso, ver [`17-puntualidad.md`](./17-puntualidad.md)). Así
  cualquiera puede ver en `src/db/schema.ts` a qué módulo pertenece cada tabla sin leer código.
- **Alumnos y tutores como recurso compartido en `edu_*`.** La fuente de verdad administrativa
  es Educamos; se exporta desde Educamos y se **resincroniza a mano** contra Neon (patrón
  vista previa → upsert, igual que el sync de Licencias con Google Sheets). Los módulos leen de
  `edu_students`/`edu_guardians`, nunca mantienen su propio listado (salvo snapshots justificados
  como `lic_students`, que congela el alumnado por campaña). Ver `02-integracion-educamos.md`.
- **Profesores:** hoy `teachers` es una tabla común (usada por ABC); a futuro se alimenta también
  del export de Educamos o del propio alta de usuarios en `auth_users`.
- **Notificaciones por email con Resend.** Ya integrado (`src/lib/email.ts`,
  `src/lib/licencias-email.ts`). Los módulos nuevos reusan ese cliente, no crean uno propio.
- **Login único con Google, permisos por rol.** Un login central con Google (cuentas del dominio
  para gestión) y una matriz rol→módulos. Sustituye al `/admin` sin auth y al password fijo de
  Licencias. Ver `01-auth-roles.md`.
- **Identificación pública de familias SIN datos personales**: los formularios de familias
  nunca buscan por nombre/apellidos ni muestran datos sin enmascarar. Patrón común en
  `src/lib/familias{,-server}.ts`: DNI/NIE del tutor → sus hijos como "Fra. M. Luc." · NIA →
  alumno directo · **magic link** (`?t=tok_…`, un enlace por familia que combina a todos sus
  hijos; generación en `src/lib/fam-tokens-server.ts`, transversal a los módulos). Decisión de
  protección de datos (2026-07-11), obligatoria para cualquier módulo público nuevo.
- **Subida de archivos con Vercel Blob** (cuando un módulo la necesite; el primero será Salidas
  y pagos). Un único helper compartido en `src/lib/blob.ts` cuando exista.
- **Cada módulo se documenta con el mismo patrón**: sección "Estado", "Decisiones cerradas",
  "Plan técnico" y checklist de "Fases". Así el estado de desarrollo de cualquier funcionalidad
  es legible por cualquier agente sin tener que preguntar.

### Cómo añadir un módulo nuevo (para el próximo que se plantee)

1. Crear `docs/1x-<modulo>.md` con el mismo formato (Estado → Decisiones cerradas → Plan
   técnico → Fases con checklist). Implementar siguiendo `04-convenciones-tecnicas.md`.
2. Añadir su fila en la tabla maestra y, si procede, en el roadmap de este documento.
3. Elegir prefijo de tablas y declararlo en `src/db/schema.ts`.
4. Decidir en la ficha qué roles acceden (ver `01-auth-roles.md`) y registrarlo en la matriz de
   permisos (`src/lib/permissions.ts` cuando exista).
5. Carpeta de rutas: pública (`src/app/(public)/<modulo>`) si recibe formularios de
   familias/alumnado, o de gestión (`src/app/gestion/<modulo>`) si es panel interno.
6. Consumir alumnado/tutores desde `edu_*`; no crear imports manuales nuevos.

---

## Módulos existentes (resumen)

### Registro ABC — conductas disruptivas
Formulario rápido (<90s, pensado para iPad) donde el profesorado registra incidencias de
conducta de alumnado con NEE: contexto, comportamientos, antecedentes, consecuencias y qué
redirección se aplicó. Panel de administración con listado y gráficos. Detrás del login del
claustro (el panel, además, con el módulo `abc`); el alumnado se da de alta a mano por **NIA**
contra `edu_students` (son pocos, de mucha necesidad) y en pantalla solo se ven **dos
iniciales** ("R.H.") y la clase.
Detalle completo en [`10-registro-abc.md`](./10-registro-abc.md).

### Puntualidad
Registro exprés de los retrasos de entrada de secundaria (puertas cerradas a las 8:05):
buscador de alumno, asignatura, hora, y guardar — con el historial del alumno a la vista
mientras se registra. Cada 3 retrasos sin justificar avisa al tutor/a por correo con un
enlace de un clic para fijar el día que el alumno se queda sin patio, y hay resumen semanal
a tutores. Panel con dashboard, ficha por alumno y consecuencias; tutores ven solo sus
clases. Detalle completo en [`17-puntualidad.md`](./17-puntualidad.md).

### Licencias digitales
Formulario público donde las familias se identifican (DNI del tutor o NIA del alumno,
identificación común de `src/lib/familias-server.ts`), eligen sus
libros digitales con precios en vivo y confirman el pedido; panel de gestión (`/gestion`) con
dashboard "quién falta", exportaciones CSV, packs, correos masivos y sincronización con Google
Sheets. Funcionalmente completa (Fases 0-2); quedan códigos de activación (Fase 3) y el enganche
a la BBDD central (Fase 4). Detalle completo en [`11-licencias-v2.md`](./11-licencias-v2.md).
