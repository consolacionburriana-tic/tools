# Tools Consolación · visión de la plataforma

Este repo deja de ser "una herramienta" para convertirse en la **navaja suiza digital del
colegio**: un único sitio (`tools.consolacionburriana.com`) donde viven módulos pequeños e
independientes que, en general, siguen el mismo patrón:

> **formulario (a veces con archivo adjunto) → datos centralizados en Neon → aviso/notificación
> a quien tiene que enterarse (Resend)**.

Cada módulo resuelve una gestión concreta del día a día del colegio. No comparten lógica de
negocio entre sí, pero sí comparten infraestructura: base de datos, envío de correo, y (cuando
esté listo) login y alumnos/tutores desde Educamos.

---

## Cómo se organiza esta documentación

Léelo en este orden si te incorporas a una sesión de desarrollo (persona o agente):

1. **`docs/plataforma.md`** *(este documento)* — el mapa: qué módulos hay, en qué estado está
   cada uno, y las decisiones de arquitectura compartidas.
2. **`docs/desarrollos-futuros.md`** — decisiones pendientes de tomar (arriba) e ideas/caminos
   de crecimiento sin decidir todavía (abajo). Es el documento vivo para "ratos libres".
3. **`docs/<modulo>.md`** — un documento por módulo con su propio plan funcional, plan técnico
   y checklist de fases (formato heredado de `docs/licencias-v2.md`, que fue el primero).

**Regla de oro:** antes de tocar un módulo, lee su ficha. Antes de decidir alcance nuevo, mira
"Decisiones pendientes" en `desarrollos-futuros.md`. Cuando una decisión se cierra, se mueve del
futuro doc a la sección "Decisiones cerradas" de la ficha del módulo correspondiente.

---

## Tabla maestra de estado

Esta tabla es el check-list general: para cada módulo o pieza transversal, si está **planificado
a nivel funcional** (sabemos qué tiene que hacer), si tiene **plan técnico** (sabemos cómo se va
a construir) y si está **implementado** (ya funciona en el repo).

| Módulo / pieza | Plan funcional | Plan técnico | Implementado | Ficha |
|---|---|---|---|---|
| Registro ABC (conductas disruptivas) | ✅ | ✅ | ✅ | [`registro-abc.md`](./registro-abc.md) |
| Licencias digitales | ✅ | ✅ | ✅ (Fases 0-2; 3-4 pendientes) | [`licencias-v2.md`](./licencias-v2.md) |
| Auth (login Google) + roles/permisos | 🟡 boceto | ⬜ | ⬜ | [`auth-roles.md`](./auth-roles.md) |
| Integración Educamos (alumnos + tutores) | 🟡 boceto | ⬜ | ⬜ (hoy: import manual en licencias) | [`educamos.md`](./educamos.md) |
| Salidas y pagos | 🟡 boceto | ⬜ | ⬜ | [`salidas-pagos.md`](./salidas-pagos.md) |
| Evaluaciones / encuestas (tutorías, propuestas) | 🟡 boceto | ⬜ | ⬜ | [`evaluaciones.md`](./evaluaciones.md) |
| Banco de libros | 🟡 boceto | ⬜ | ⬜ | [`banco-libros.md`](./banco-libros.md) |

Leyenda: ✅ hecho y verificado · 🟡 en definición (hay idea, faltan decisiones) · ⬜ sin empezar.

> Cuando arranquemos un módulo nuevo cualquier día, este documento dice de un vistazo qué falta:
> si falta el ⬜ de "plan funcional", tocan preguntas y decisiones (ver `desarrollos-futuros.md`).
> Si el funcional ya está en 🟡/✅ pero falta el técnico, toca diseñar schema + rutas. Si ambos
> están en ✅ y falta implementado, toca picar código siguiendo las fases de la ficha.

---

## Principios de arquitectura compartidos

- **Monolito modular en Next.js (App Router).** Cada módulo vive en su propia carpeta de rutas
  (`src/app/<modulo>` o dentro de `gestion/<modulo>` si es un panel de gestión interno) y no
  depende de las demás.
- **Una base de datos (Neon + Drizzle), un schema por módulo con prefijo de tabla propio**
  (`abc_*` Registro ABC, `lic_*` Licencias, y a definir: `sal_*` Salidas y pagos, `eval_*`
  Evaluaciones, `bl_*` Banco de libros). Así cualquiera puede ver en `src/db/schema.ts` a qué
  módulo pertenece cada tabla sin leer código.
- **Alumnos y profesores/tutores como recurso compartido.** Hoy `teachers` es una tabla común y
  cada módulo importa sus propios alumnos por separado (`abc_students`, `lic_students`). El
  objetivo es que ambos acaben viniendo de **Educamos** (ver `educamos.md`) para no mantener
  listados duplicados a mano.
- **Notificaciones por email con Resend.** Ya integrado en Licencias (`src/lib/licencias-email.ts`,
  `src/lib/email.ts`). Los módulos nuevos deben reusar ese cliente, no crear uno propio.
- **Login único con Google, permisos por módulo/rol.** Hoy cada módulo tiene su propia autenticación
  de andar por casa (Registro ABC sin auth, Licencias con email+password fijo). Se sustituye por
  un login central (ver `auth-roles.md`) del que cuelgan todos los módulos.
- **Cada módulo nuevo se documenta con el mismo patrón** que `licencias-v2.md`: una sección
  "Estado", una de "Decisiones cerradas" y una checklist de "Fases". Así el estado de desarrollo
  de cualquier funcionalidad es legible por cualquier agente sin tener que preguntar.

### Cómo añadir un módulo nuevo (para el próximo que se plantee)

1. Crear `docs/<modulo>.md` con el mismo formato (Estado → Decisiones cerradas → Fases con checklist).
2. Añadir su fila en la tabla maestra de este documento.
3. Elegir prefijo de tablas en `src/db/schema.ts`.
4. Decidir en la ficha quién tiene acceso (qué rol/módulo, ver `auth-roles.md`).
5. Carpeta de rutas: pública (`src/app/(public)/<modulo>`) si recibe formularios de familias/alumnos,
   o de gestión (`src/app/gestion/<modulo>`) si es panel interno para el profesorado.

---

## Módulos existentes (resumen)

### Registro ABC — conductas disruptivas
Formulario rápido (<90s, pensado para iPad) donde el profesorado registra incidencias de
conducta de alumnado con NEE: contexto, comportamientos, antecedentes, consecuencias y qué
redirección se aplicó. Panel de administración con listado y gráficos. **Sin login todavía**
(pendiente, ver `auth-roles.md`). Detalle completo en [`registro-abc.md`](./registro-abc.md).

### Licencias digitales
Formulario público donde las familias se identifican (curso + año + apellidos), eligen sus