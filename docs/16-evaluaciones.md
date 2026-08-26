# Evaluaciones de actividades · plan y checklist

Módulo para evaluar actividades del colegio (convivencias, tutorías, celebraciones, formaciones
del claustro…) con formularios rápidos que responde el **alumnado**, el **profesorado** o las
**familias**, y cuyos resultados se ven en un **dashboard** con comparativas entre cursos y entre
colectivos. Es el **hito 6 del roadmap** — el más independiente del resto.

---

## Estado: plan técnico ✅ · implementación ✅ · en producción ✅ (Fases 0-4, 2026-08-26)

Depende de: auth/roles (`01-auth-roles.md`) para el panel de gestión y de `edu_*` para el
alumnado/profesorado. El formulario de respuesta es público por enlace (y opcionalmente puede
exigir cuenta del colegio).

Rutas: gestión en `/gestion/evaluaciones`, formulario público en `/evaluaciones/<token>`.

## Decisiones cerradas

### Modelo
- **Motor de formularios propio y pequeño, SOLO para evaluaciones.** No es un form builder
  genérico: Registro ABC, Licencias, etc. siguen siendo formularios a medida.
- **La actividad vive fuera del formulario.** `eval_activities` es "lo que se evalúa" y está
  atada a un curso académico (modificable: en agosto se prepara ya el curso siguiente). Un
  formulario es un envío concreto a UN colectivo; el puente son los **bloques**.
- **Un formulario puede evaluar varias actividades** (bloques), pero lo recomendable sigue
  siendo una actividad por formulario: se dice en la interfaz, no se impide.
- **"¿Quién responde?"** es como se llama el concepto en pantalla (alumnado / profesorado /
  familias). En código y en la BBDD la columna se sigue llamando `audiencia`: renombrarla sería
  un cambio destructivo de schema y no aporta nada a quien usa la herramienta.
- **La misma actividad puede tener formulario de alumnado y de profesorado**, con preguntas
  distintas, enganchados a la misma actividad → "visión alumnos vs visión profes".
- **`serie_id`**: al copiar una actividad de un curso a otro se conserva la serie. Es lo que
  permite comparar la Convivencia de Inicio de 2025-26 con la de 2026-27 sin adivinar nada por
  el nombre.
- **`clave` estable en cada pregunta y en cada fila de matriz** (slug del texto). Si se retoca
  la redacción, la comparativa sigue cuadrando.
- **Normalización 0-100** para comparar entre escalas distintas (`aPorcentaje` en
  `src/lib/evaluaciones.ts`, con tests). "Mucho" de la escala Nada-Mucho y un 5 de la escala
  1-5 valen lo mismo: 100.
- **Puerta abierta**: `eval_activities.tipo` admite `actividad | asignatura | general`, así que
  evaluar una asignatura y a su profe, o pasar una encuesta general a familias, es añadir
  interfaz — no rehacer el modelo. Los bloques admiten `activity_id = null` (bloque libre).

### Preguntas
- **Preset distinto según quién responde**, aplicado al crear (`presetActividad`):
  - *Profesorado*: Objetivos y contenidos · Organización (Duración · Dinámica propuesta ·
    Materiales trabajados · Ambiente) · Observaciones y sugerencias.
  - *Alumnado*: "✅ Actividad · <nombre>" (¿te ha servido…? ¿te han gustado…? ¿el tiempo? ¿el
    lugar?) · "🤔 Observaciones y sugerencias" con el textito de siempre.
  - *Familias*: valoración general + observaciones.
- **Las frases que hay que adaptar salen marcadas en ámbar** (`eval_questions.revisar`) y el
  aviso desaparece al editarlas. Es la traducción literal de "que me marque aquí tienes que
  cambiar unas frases".
- **Al profesorado se le muestra el objetivo de la actividad** encima de las preguntas
  (`eval_activities.objetivo`); **al alumnado, el resumen** (`eval_activities.resumen`), que
  explica de qué va sin soltar el objetivo tal cual. El editor los rellena solos al añadir la
  actividad y se pueden retocar por formulario (`eval_blocks.intro`).
- **Tipos de pregunta**: `escala` (matriz de frases con Nada/Poco/Bastante/Mucho, 1-5 o Sí/No),
  `texto`, `opcion`, `varias` y `quiz`. Ninguno más: no es un form builder libre.
- **Quiz**: 2-3 por formulario como mucho. Las respuestas correctas **no viajan al navegador**;
  se corrigen en el servidor al enviar y vuelven con su reacción, que se anima al terminar.
- **Reordenar y duplicar**: flechas arriba/abajo (lo que funciona de verdad en iPad) y
  arrastrar y soltar en escritorio. Duplicar una pregunta la deja justo debajo del original.
- **Catálogo de preguntas sueltas** en código (`CATALOGO` en `src/lib/evaluaciones.ts`), sacado
  de los formularios reales. `eval_question_templates` queda para las que guarde el claustro.

### Anonimato (lo delicado)
- **Profesorado: 100 % anónimo, sin matices.** No se guarda identidad ni se marca quién ha
  respondido. Por eso su enlace es **común para todo el claustro** (no personalizado) y los
  recordatorios van a todos con un "si ya la has rellenado, ignora este correo" — igual que en
  Licencias. Renunciamos a saber quién falta, a propósito.
- **Alumnado: anónimo en pantalla, trazable internamente.** Si el enlace llegó personalizado
  (`/evaluaciones/<token>?a=<invitación>`), la respuesta guarda `edu_student_id` para poder
  investigar un caso puntual si alguien se lía. El alumnado no ve ningún identificador, y su
  clase se rellena sola (un toque menos).
- **El aviso del pie es una frase seca**: "🔒 Tus respuestas son anónimas." Sin explicaciones
  añadidas (decisión de David, 2026-08-25: la coletilla "nadie ve quién ha contestado qué, solo
  miramos los resultados del grupo" se quitó por larga). En profesorado sí se dice entero
  —"no se guarda quién responde ni se puede saber después"— porque ahí es literal. Es editable
  por formulario.
- **El export CSV no lleva identidad de nadie**, ni siquiera en formularios con enlace
  personalizado: quien lo abre está analizando resultados, no investigando a nadie. La
  trazabilidad se queda en la BBDD.
- El anonimato se decide al crear y **no se cambia una vez hay respuestas**.

### Correo
- Reutiliza el motor de envío masivo común (`src/lib/correos.ts`): variables `{nombre}`,
  `{curso}`, `{titulo}`, `{enlace}`, `{curso_escolar}`, escapado, enlaces clicables y batch
  de 100 vía Resend.
- **Plantillas de fábrica editables + guardables** (`eval_email_templates`), visibles para todo
  el claustro con acceso al módulo — mismo patrón que las de Licencias.
- En alumnado se puede enviar **solo a quien todavía no ha respondido**; en profesorado no
  (ver anonimato).

## Plan técnico

### Schema (`eval_*`, en `src/db/schema.ts`)

| Tabla | Para qué |
|---|---|
| `eval_activities` | Lo que se evalúa: nombre, fecha, lugar, `categoria` (pastoral/innovación/general/otra), `tipo`, `objetivo` (profes), `resumen` (alumnos), `academic_year`, `serie_id`, `archivada` |
| `eval_forms` | Un envío a un colectivo: `audiencia` (quién responde), `estado` (borrador/abierto/cerrado), `token`, `anonimo`, `identifica_alumno`, `pedir_clase`, `pedir_etapa`, `requiere_login`, `aviso_anonimato`, `mensaje_final`, `clases` |
| `eval_blocks` | Una actividad dentro de un formulario: `activity_id` (nullable), `titulo`, `intro`, `orden` |
| `eval_questions` | `clave`, `texto`, `ayuda`, `tipo`, `escala`, `filas[]`, `opciones[]`, `permite_otra`, `obligatoria`, `revisar`, feedback del quiz, `orden` |
| `eval_question_templates` | Preguntas que guarda el claustro para reutilizar |
| `eval_invites` | Enlace personalizado por destinatario (`?a=…`), `sent_at`, `responded_at` |
| `eval_responses` | `edu_student_id` (solo alumnado con enlace personalizado), `curso`, `letra`, `etapa`, `email` (solo nominales) |
| `eval_answers` | `fila_clave`, `valor_num`, `opcion_clave`, `valor_texto` |
| `eval_email_templates` | Plantillas de correo guardadas |

### Código

```
src/lib/evaluaciones.ts            # puro: escalas, normalización 0-100, presets, catálogo,
                                   # validación de respuestas, tokens, claves estables
src/lib/evaluaciones-server.ts     # queries Drizzle: actividades, formularios, estructura,
                                   # respuestas, resultados, comparativas
src/lib/evaluaciones-email.ts      # plantillas de fábrica + envío (sobre correos.ts)
src/lib/evaluaciones-exports.ts    # CSV (puro)
src/app/gestion/evaluaciones/…     # listado · nueva · editor · resultados · enviar ·
                                   # actividades · comparar
src/app/(public)/evaluaciones/[token]/page.tsx
src/app/api/evaluaciones/responder                    # público (token)
src/app/api/evaluaciones/admin/{forms,actividades,enviar,plantillas-correo,export}
src/components/evaluaciones/…
```

Nota de diseño: toda la edición de la estructura pasa por **un solo endpoint**
(`admin/forms/[id]/estructura`, unión discriminada de Zod) que devuelve el formulario entero ya
actualizado. El editor es de trazo rápido (añadir, duplicar, subir/bajar, borrar) y así nunca se
queda a medias entre dos peticiones.

## Fases

### Fase 0 · Cimientos
- [x] Schema `eval_*` (9 tablas)
- [x] Tablas creadas en Neon (2026-08-26). Contra la BBDD de producción NO se lanzó
      `drizzle-kit push` a ciegas: se generó el DDL, se filtraron los 24 statements de
      `eval_*` (9 CREATE TABLE + 10 FK + 5 índices) y se aplicaron en una transacción.
      Verificado con una prueba de humo completa (alta con preset → respuesta → agregados
      → filtro por clase) que se limpió después. Para cambios futuros de este módulo,
      `pnpm db:push` normal.
- [x] Catálogo de preguntas típicas — vive en código (`CATALOGO` + `presetActividad`), sacado de
      los formularios reales de Pastoral. `eval_question_templates` queda para las propias.

### Fase 1 · Editor de formularios (gestión)
- [x] Alta rápida en una pantalla: quién responde (1 toque) → actividades (escribir + Enter) →
      clases → crear, con el título autogenerado
- [x] CRUD de actividades (`/gestion/evaluaciones/actividades`) con objetivo/resumen, categoría,
      fecha, lugar y archivado
- [x] CRUD de bloques y preguntas + "poner las preguntas de siempre" (preset) y catálogo
- [x] Reordenar (flechas + drag&drop) y duplicar preguntas
- [x] Duplicar formulario: tal cual, a otro curso (copia las actividades manteniendo serie) o a
      otro colectivo (cambia el preset)
- [x] Importar actividad del curso anterior conservando la serie

### Fase 2 · Formulario de respuesta
- [x] Página pública por token, respetando estado (borrador = vista previa, cerrado = aviso)
- [x] Matrices táctiles, texto, opciones con "Otra", quiz
- [x] Envío único con validación de completitud (cliente y servidor), barra de progreso y salto
      a la primera pregunta que falta
- [x] Enlace personalizado `?a=…`: rellena la clase y guarda de qué alumno viene
- [x] Mini-indicador de anonimato en el pie, editable por formulario
- [x] Corrección del quiz en servidor + reacción animada al terminar

### Fase 3 · Envío por correo
- [x] Recuento de destinatarios en vivo, con los que no tienen correo listados aparte
- [x] Plantillas de fábrica + guardadas, vista previa con datos de ejemplo y envío de prueba
- [x] Alumnado: enlace personalizado y filtro "solo a quien falta"
- [x] Profesorado: enlace común y filtro por etapa
- [~] Familias: el modelo y el envío a los correos de tutores están listos; falta pulir el
      flujo con magic link propio (`fam_access_tokens`) cuando se estrene de verdad

### Fase 4 · Dashboard de resultados
- [x] KPIs, medias por pregunta y por fila, distribución, respuestas de texto agrupadas
- [x] Navegación por clase (y por etapa en profesorado)
- [x] Avisos automáticos: participación baja, clases sin responder, qué se valora peor
- [x] Export CSV (sin identidad de quien responde)
- [x] Comparativas: la misma actividad curso a curso y entre colectivos (`serie_id`), y
      ranking de actividades del curso

### Pendiente para más adelante
- Evaluación de **asignaturas y su profesorado** (el modelo ya lo admite: `tipo='asignatura'`).
- Encuestas **generales a familias** no ligadas a una actividad (`tipo='general'`).
- Insights más finos (evolución de una fila concreta entre cursos, alertas automáticas).
