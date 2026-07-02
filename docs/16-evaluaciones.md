# Evaluaciones de actividades · plan y checklist

Módulo para evaluar actividades del colegio (salidas, jornadas, actividades de tutoría…) con
formularios rápidos que responde el profesorado (u otros colectivos) y cuyos resultados se ven
en un **dashboard**. Es el **hito 6 del roadmap** — el más independiente del resto.

---

## Estado: plan técnico listo ✅ · implementación sin empezar ⬜

Depende de: auth/roles (`01-auth-roles.md`) para el panel de gestión. El formulario de
respuesta puede ser público-con-enlace o exigir login del colegio (por formulario).

## Decisiones cerradas

- **Motor de formularios propio y pequeño, SOLO para evaluaciones.** No es un "form builder"
  genérico para toda la plataforma: Registro ABC, Licencias, etc. siguen siendo formularios a
  medida. Aquí las evaluaciones son más simples y sí compensa configurarlas.
- **Un formulario puede evaluar una o varias actividades.** Crear una actividad es muy rápido:
  nombre, fecha, lugar, un textito para recordar qué se evalúa, y sus 4-5 preguntas.
- **Preguntas predefinidas**: habrá una plantilla de preguntas típicas para añadirlas a una
  actividad en un clic (el catálogo concreto de preguntas se decidirá al usarlo — no bloquea).
- **Anonimato configurable por formulario** con un iconito al crearlo: anónimo (no se guarda
  quién responde) o nominal (se guarda el email).
- **Los resultados se consultan en un dashboard** (no hay envío de resumen por correo).

## Plan técnico

### Schema (`eval_*`)

```ts
eval_forms (
  id uuid pk,
  titulo text, descripcion text,
  anonimo boolean default true,
  requiere_login boolean default false,  // true = solo cuentas del colegio pueden responder
  estado text default 'borrador',        // 'borrador' | 'abierto' | 'cerrado'
  token text unique,                     // para el enlace público de respuesta
  created_by -> auth_users, created_at, updated_at
)

eval_activities (                        // 1..N actividades por formulario
  id uuid pk,
  form_id -> eval_forms,
  nombre text, fecha date, lugar text,
  notas text,                            // "textito para recordar qué evaluamos"
  orden integer
)

eval_questions (
  id uuid pk,
  activity_id -> eval_activities,
  texto text,
  tipo text,                             // 'escala_1_5' | 'texto' | 'si_no'
  orden integer
)

eval_question_templates (                // catálogo de preguntas predefinidas
  id uuid pk, texto text, tipo text, activa boolean default true
)

eval_responses (
  id uuid pk,
  form_id -> eval_forms,
  email text,                            // null si el formulario es anónimo
  created_at
)

eval_answers (
  id uuid pk,
  response_id -> eval_responses,
  question_id -> eval_questions,
  valor_num integer,                     // escalas y sí/no (1/0)
  valor_texto text
)
```

> Si el formulario es anónimo, `eval_responses.email` **no se rellena nunca** (se decide al
> crear y no se puede cambiar una vez hay respuestas, para que la promesa de anonimato sea real).

### Rutas

- Gestión (`/gestion/evaluaciones`): listado de formularios, editor (datos + actividades +
  preguntas, con "añadir desde plantilla"), abrir/cerrar, copiar enlace, y **dashboard de
  resultados** por formulario: media por pregunta (escalas), distribución sí/no, lista de
  respuestas de texto, todo agrupado por actividad. Nº de respuestas siempre visible.
- Respuesta (`/evaluaciones/[token]`): una pantalla por actividad (o scroll único si son
  pocas preguntas — decidir en diseño), envío único con todas las actividades dentro.
- API: `api/evaluaciones/{form,respond}` (público por token) ·
  `api/evaluaciones/admin/*` (`requireModule('evaluaciones')`).

### Reutilización

- Gráficos del dashboard: mismo enfoque que los gráficos agregados del panel del Registro ABC.
- Duplicar formulario (para la misma evaluación del año siguiente) — barato y muy útil.

## Fases

### Fase 0 · Cimientos
- [ ] Schema `eval_*` + `pnpm db:push`
- [ ] Seed de `eval_question_templates` con 8-10 preguntas típicas (validar textos con David)

### Fase 1 · Editor de formularios (gestión)
- [ ] CRUD de formularios (título, descripción, anónimo, requiere login, estado)
- [ ] CRUD de actividades dentro del formulario (nombre, fecha, lugar, notas)
- [ ] CRUD de preguntas por actividad + "añadir desde plantilla"
- [ ] Duplicar formulario

### Fase 2 · Formulario de respuesta
- [ ] Página pública por token (respetando estado abierto/cerrado y `requiere_login`)
- [ ] Envío único con todas las actividades; validación de completitud
- [ ] Si es nominal: capturar email (de la sesión si hay login, o campo manual)

### Fase 3 · Dashboard de resultados
- [ ] Medias y distribución por pregunta, agrupado por actividad
- [ ] Respuestas de texto listadas
- [ ] Export CSV de respuestas
