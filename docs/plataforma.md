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
2. **[`docs/00-desarrollos-futuros.md`](./00-desarrollos-futuros.md)** — decisiones pendientes de
   tomar (arriba) e ideas/caminos de crecimiento sin decidir todavía (abajo). Documento vivo.
3. **`docs/<nn>-<modulo>.md`** — un documento por módulo/pieza con su plan funcional, plan
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
   marcada = está hecho y verificado. No hay tercer estado.
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
| Registro ABC (conductas disruptivas) | ✅ | ✅ | ✅ | [`10-registro-abc.md`](./10-registro-abc.md) |
| Licencias digitales | ✅ | ✅ | ✅ (Fases 0-2; 3-4 pendientes) | [`11-licencias-v2.md`](./11-licencias-v2.md) |
| BBDD central Educamos (alumnos + tutores) | ✅ | ✅ | ⬜ (hoy: import manual en licencias) | [`02-integracion-educamos.md`](./02-integracion-educamos.md) |
| Auth (login Google) + roles/permisos | ✅ | ✅ | ⬜ | [`01-auth-roles.md`](./01-auth-roles.md) |
| Salidas y pagos | ✅ | ✅ | ⬜ | [`15-salidasypagos.md`](./15-salidasypagos.md) |
| Banco de libros | ✅ | ✅ | ⬜ | [`12-bancolibros.md`](./12-bancolibros.md) |
| Evaluaciones de actividades | ✅ | ✅ | ⬜ | [`16-evaluaciones.md`](./16-evaluaciones.md) |

Leyenda: ✅ hecho y verificado · 🟡 en definición (hay idea, faltan decisiones) · ⬜ sin empezar.

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
| 2 | **Auth + roles** (`auth_*`) | [`01`](./01-auth-roles.md) | Los módulos nuevos nacen ya detrás del login; evita construir auth "de andar por casa" otra vez. |
| 3 | **Migración de ABC y Licencias** al nuevo login y a `edu_students` | [`10`](./10-registro-abc.md) · [`11`](./11-licencias-v2.md) | Cierra la deuda: `/admin` sin auth y `licencias-auth.ts` con password fija. |
| 4 | **Salidas y pagos** (`sal_*`) | [`15`](./15-salidasypagos.md) | Primer módulo nuevo completo; introduce la subida de archivos (Vercel Blob). |
| 5 | **Banco de libros** (`bl_*`) | [`12`](./12-bancolibros.md) | Necesita el modelo anual lote↔alumno bien pensado; se apoya en `edu_students`. |
| 6 | **Evaluaciones** (`eval_*`) | [`16`](./16-evaluaciones.md) | Motorcito de formularios propio; el más independiente, puede ir en paralelo si conviene. |

Transversales sin hito propio (se hacen "de paso", ver `00-desarrollos-futuros.md`): mejorar la
PWA para todos los módulos (priorizado por David), auditoría de cambios, dashboard de dirección.

---

## Principios de arquitectura compartidos

- **Monolito modular en Next.js (App Router).** Cada módulo vive en su propia carpeta de rutas
  (`src/app/(public)/<modulo>` si es formulario público, `src/app/gestion/<modulo>` si es panel
  interno) y no depende de las demás.
- **Una base de datos (Neon + Drizzle), un schema por módulo con prefijo de tabla propio**:
  `abc_*` Registro ABC · `lic_*` Licencias · `edu_*` BBDD central Educamos · `auth_*` usuarios y
  roles · `sal_*` Salidas y pagos · `bl_*` Banco de libros · `eval_*` Evaluaciones. Así
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
- **Subida de archivos con Vercel Blob** (cuando un módulo la necesite; el primero será Salidas
  y pagos). Un único helper compartido en `src/lib/blob.ts` cuando exista.
- **Cada módulo se documenta con el mismo patrón**: sección "Estado", "Decisiones cerradas",
  "Plan técnico" y checklist de "Fases". Así el estado de desarrollo de cualquier funcionalidad
  es legible por cualquier agente sin tener que preguntar.

### Cómo añadir un módulo nuevo (para el próximo que se plantee)

1. Crear `docs/1x-<modulo>.md` con el mismo formato (Estado → Decisiones cerradas → Plan
   técnico → Fases con checklist).
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
redirección se aplicó. Panel de administración con listado y gráficos. **Sin login todavía**
(se resuelve en el hito 3). Detalle completo en [`10-registro-abc.md`](./10-registro-abc.md).

### Licencias digitales
Formulario público donde las familias se identifican (curso + año + apellidos), eligen sus
libros digitales con precios en vivo y confirman el pedido; panel de gestión (`/gestion`) con
dashboard "quién falta", exportaciones CSV, packs, correos masivos y sincronización con Google
Sheets. Funcionalmente completa (Fases 0-2); quedan códigos de activación (Fase 3) y el enganche
a la BBDD central (Fase 4). Detalle completo en [`11-licencias-v2.md`](./11-licencias-v2.md).
