# Cuaderno de tutor · generador de documentación de tutoría

**Estado:** plan funcional ✅ · plan técnico ✅ · implementado 🟡 (Fases 0-6 en código; falta la
verificación real con la unidad compartida de David)

Genera, de un clic, la documentación de tutoría de todo el centro a partir de plantillas de
Google Docs con etiquetas (`<<clase>>`, `<<nom>>`, `<<tlf1>>`…) y de los datos que ya están en
`edu_*`: un documento por tutor y por tipo de plantilla, con **todos sus alumnos dentro**,
dejado en una carpeta de Drive por clase y compartido con sus tutores.

Sustituye el proceso manual de cada septiembre: imprimir las plantillas en blanco y escribir a
mano los nombres, la clase y los datos de las familias, 30 veces por clase.

---

## Decisiones cerradas

1. **Las plantillas viven en Google Docs, no en el repo.** David pega la URL de cada plantilla
   en el panel; el módulo no conoce ni el contenido ni las etiquetas de antemano. Si mañana
   cambia la plantilla, no se toca código: se vuelve a analizar y listo.
2. **Salida: un documento por tutor y por plantilla, con sus 30 alumnos dentro** (no 30
   archivos). El Dossier de 2 páginas × 30 alumnos = un Google Doc de 60 páginas, revisable y
   editable antes de imprimir. Opcionalmente, además, el PDF de cada uno y un PDF con el
   cuaderno completo del tutor.
3. **El Google Doc generado es nativo y editable.** El motor trabaja en el `.docx` exportado de
   la plantilla y sube el resultado a Drive **con conversión** a Google Doc. Así no hace falta
   ni LibreOffice (que no existe en Vercel) ni la API de Docs documento a documento.
4. **Una clase con dos tutores son dos juegos de documentos**, uno por tutor, cada uno con sus
   alumnos. El reparto sale de `edu_tutor_personal` (módulo Tutorías), que ya existe: no se
   inventa aquí. Los alumnos sin tutor personal se avisan y **no** se reparten a dedo.
5. **Los números de lista se congelan por curso escolar** (`cuad_numeracion`). Una vez impreso
   el cuaderno, el nº 14 es el nº 14 todo el año. Quien llega tarde recibe el siguiente número
   libre de su clase (31, 32…) para no invalidar lo impreso; en las listas regeneradas aparece
   como `7* (31)` — donde le toca por alfabético, con el número que se le dio entre paréntesis.
6. **La carpeta base la da David** (subcarpeta de una **unidad compartida**, ya creada). Es
   obligatorio que sea unidad compartida: la cuenta de servicio no tiene cuota propia en "Mi
   unidad", y los archivos que creara allí quedarían en su propiedad y sin poder traspasarse.
7. **Se comparte la carpeta de la clase**, no los archivos: un permiso por tutor y todo lo que
   caiga después en la carpeta (regeneraciones incluidas) queda compartido sin tocar nada.
8. **Regenerar es normal, no una excepción.** Cada tirada guarda qué alumnos entraron en cada
   documento (`cuad_hojas`), así que el panel sabe quién no tiene su hoja hecha y se puede
   lanzar una tirada solo para los que faltan: cae en una subcarpeta
   `aammdd - Ejecución Cuaderno 2` dentro de la carpeta de la clase, ya compartida.
9. **El trabajo lo hace el servidor, no el navegador de David.** Una tirada es una cola de
   ítems en Neon que consume un worker; la pantalla solo enseña el progreso. Se puede cerrar el
   portátil.
10. **Plantillas por etapa.** Hoy solo ESO. Una plantilla puede ser de una etapa concreta o de
    todas; si una tirada abarca varias etapas, se crea una subcarpeta por etapa.

Pendiente de decidir: nada bloqueante. Ver `00-desarrollos-futuros.md` para las ideas que
quedaron fuera.

---

## Cómo se marcan los campos en la plantilla (esto es lo que hay que saber para escribir una)

Tres marcas, y solo tres:

| Marca | Qué hace |
|---|---|
| `<<campo>>` | Se sustituye por el dato. Da igual mayúsculas, acentos, espacios o guiones bajos: `<<Nom>>`, `<<nom>>` y `<<nº clase>>` se reconocen igual |
| `<<#alumnos>>` | Puesta **en cualquier celda de una fila de tabla**, repite esa fila una vez por alumno. La marca desaparece del resultado. Es lo que convierte una plantilla de lista (Registro de entrevistas) en la lista de los 30 |
| `<<?familiar2>>` | Al principio de un párrafo: si ese dato no existe (una familia con un solo tutor legal), **el párrafo entero desaparece**. Si existe, solo desaparece la marca |

Y una propiedad que se elige en el panel, no en el documento: **cuántas veces se repite la
plantilla entera**.

- `alumno` — una copia por alumno del tutor (Dossier, Entrevista alumno, Entrevista familias).
- `trimestre` — una copia por trimestre, con `<<trimestre>>` rellenado (Registro de entrevistas:
  la plantilla es **una hoja**, salen tres).
- `unica` — una sola copia (Registro de reunión de familias: una lista de toda la clase).

Las copias van separadas por salto de página.

> Aviso: los **campos de Word** tipo `DOCPROPERTY "curso"` no se sustituyen (son un objeto, no
> texto). En la plantilla de la Entrevista Individual hay uno con el curso escolar: cámbialo por
> `<<curso_escolar>>`.

### Catálogo de campos

Ámbitos y campos disponibles (`src/lib/cuaderno/campos.ts` es la fuente de verdad):

- **alumno** — `nombre`, `apellidos`, `apellido1`, `apellido2`, `nombre_completo`,
  `nombre_lista`, `numero`, `numero_lista`, `fecha_nacimiento`, `nia`, `curso`, `clase`, `email`
- **clase** — `clase`, `curso`, `etapa`, `tutor`, `tutor_corto`, `tutores`, `tutor_email`,
  `num_alumnos`
- **familiar1 / familiar2** — `familiar1_nombre`, `familiar1_telefono`, `familiar1_correo` (y
  los mismos con `familiar2_`)
- **centro** — `curso_escolar`, `centro`, `fecha_hoy`
- **trimestre** — `trimestre`, `trimestre_num`, `trimestre_nombre`

El panel **aprende los alias**: al analizar una plantilla, las etiquetas que ya conoce salen
mapeadas (`nº clase` → `clase.clase`, `tlf1` → `familiar1_telefono`…) y las nuevas se mapean con
un desplegable. Queda guardado en `cuad_alias` y no se vuelve a preguntar. Si al generar queda
una etiqueta sin mapear, **la tirada no arranca**: mejor pararla que sacar 125 documentos con
`<<professio1>>` impreso.

---

## Estructura en Drive

```
<carpeta base — subcarpeta de unidad compartida>/
└── Cuaderno de tutor 2026-27/
    ├── # Plantillas/                            ← copia de las plantillas usadas (trazabilidad)
    ├── 2ºA — María R + Paola G/                 ← la unidad que se comparte
    │   ├── 1.1 · Dossier Personal — María R — 2ºA
    │   ├── 1.2 · Entrevista alumno — María R — 2ºA
    │   ├── …
    │   ├── 2.1 · Dossier Personal — Paola G — 2ºA
    │   ├── …
    │   └── 260915 - Ejecución Cuaderno 2/                ← alumnado que llegó más tarde
    └── 2ºB — …/
```

Con más de una etapa en la misma tirada se intercala una carpeta `ESO/`, `EP/`… entre el curso
escolar y las clases.

---

## Plan técnico

### Tablas (`cuad_*`)

| Tabla | Para qué |
|---|---|
| `cuad_plantillas` | Una fila por plantilla: nombre, `googleDocId`, `repeticion`, etapa, orden, formatos, activa |
| `cuad_alias` | Etiqueta normalizada → campo del catálogo. El aprendizaje del panel |
| `cuad_ajustes` | Fila única: carpeta base de Drive, nombre del centro |
| `cuad_tiradas` | Una ejecución: curso escolar, opciones, estado, carpeta raíz, quién y cuándo |
| `cuad_items` | Unidad de trabajo = **tutor × plantilla**: alumnos que entran, estado, IDs de Drive, intentos |
| `cuad_numeracion` | Número de lista congelado por alumno y curso escolar |
| `cuad_hojas` | "Este alumno ya tiene su hoja de esta plantilla este curso" |

### Módulos de código

```
src/lib/cuaderno/ooxml.ts      # motor .docx: repetición, filas, condicionales, sustitución (puro, con tests)
src/lib/cuaderno/campos.ts     # catálogo, normalización de etiquetas, alias por defecto (puro, con tests)
src/lib/cuaderno/nombres.ts    # nombres de carpetas y archivos (puro, con tests)
src/lib/cuaderno/drive.ts      # Drive + Docs: exportar, subir con conversión, PDF, carpetas, permisos
src/lib/cuaderno/generar.ts    # ejecutar un ítem de la cola de punta a punta
src/lib/cuaderno-server.ts     # queries Drizzle: datos de clase, tiradas, cola, numeración, hojas
src/app/gestion/cuaderno/      # panel (plantillas · generar · historial)
src/app/api/cuaderno/…         # endpoints de gestión + worker
```

### Cómo se rellena un documento (el corazón del asunto)

1. **Exportar** la plantilla de Google Docs a `.docx` (Drive `files.export`). Una vez por tirada,
   se reutiliza para las 25 clases.
2. **Rellenar el `.docx` en memoria** (`ooxml.ts`, sin red): se separa el cuerpo de su `sectPr`,
   se repite N veces con salto de página, se clonan las filas marcadas con `<<#alumnos>>`, se
   resuelven los condicionales y se sustituyen las etiquetas. La sustitución **une los `w:t` de
   cada párrafo antes de buscar**, que es lo que hace que funcione con etiquetas partidas en
   varios runs por el corrector o por un cambio de formato — el clásico que rompe un
   buscar/reemplazar ingenuo. Se renumeran los ids de marcadores e imágenes de cada copia.
3. **Subir a Drive con conversión** a Google Doc (`files.create` con
   `mimeType: application/vnd.google-apps.document`). Sale un documento nativo y editable.
4. **Exportar a PDF** ese documento si la plantilla lo pide, y unir los PDF del tutor en el
   cuaderno completo (`pdf-lib`) si la tirada lo pide.

Coste real: **2-4 llamadas a Drive por documento**, no una por alumno. Una tirada de 25 clases ×
5 plantillas son ~125 documentos y del orden de 400 llamadas, muy por debajo de cualquier cuota.

### La cola

`POST /api/cuaderno/tiradas` crea la tirada y sus ítems en estado `pendiente` y despierta al
worker. `POST /api/cuaderno/worker` **reclama** un ítem con un `UPDATE … WHERE estado='pendiente'`
(así dos workers no pisan el mismo), lo ejecuta, y sigue hasta agotar su tiempo; entonces se
re-despierta a sí mismo. El panel hace polling del estado de la tirada: la barra de progreso no
depende de que nadie tenga una pestaña abierta.

**Límites del plan Hobby de Vercel** (es el plan del proyecto, y condiciona dos cosas):

- `maxDuration` del worker es **60 s**, así que cada vuelta hace del orden de 10-15 documentos y
  se re-despierta. Una tirada de ESO entera son unas diez vueltas: unos minutos, no una hora.
- Los crons de Hobby solo pueden ir **una vez al día** (y como máximo dos en todo el proyecto).
  El de rescate está a las 04:00, que es su único papel: recoger una tirada que se quedara a
  medias de madrugada. Lo que de verdad mueve la cola es el re-despertar del worker; y si algo
  se atasca mirando el panel, el propio `GET` del progreso le da un toque al worker cuando ve
  la tirada parada más de dos minutos, y está el botón «Retomar» del historial.
  Si algún día el proyecto pasa a Pro, subir el cron a `*/5 * * * *` y `maxDuration` a 300 es
  cambiar dos líneas (`vercel.json` y el `route.ts` del worker), no hay nada más atado a eso.

### Permisos

Módulo `cuaderno` en `src/lib/permissions.ts`: lo tienen `secretaria`, `direccion`, `tic` y
`supertic` por rol, y se le puede dar a cualquier persona (tutores incluidos) como módulo extra
desde Usuarios, sin tocar código.

---

## Alta en Google (una vez, y es de David)

1. La carpeta base tiene que estar en una **unidad compartida**.
2. Añadir la cuenta de servicio (`GOOGLE_SA_CLIENT_EMAIL`) como **Administrador de contenido** de
   esa unidad compartida (o de la carpeta).
3. Compartir **cada plantilla** de Google Docs con ese mismo correo (basta lector).
4. API de **Google Drive** habilitada en el proyecto de Google Cloud ✅ (la de Docs no llega a
   usarse: exportar, subir con conversión y compartir son todo llamadas de Drive).
5. No hace falta delegación de dominio para esto: con la unidad compartida, los archivos son del
   colegio y la cuenta de servicio actúa como miembro. El scope que se pide es
   `https://www.googleapis.com/auth/drive`.

---

## Datos personales

Los documentos generados llevan nombre y apellidos del alumnado y nombre, teléfono y correo de
las familias. Por eso:

- Nunca se comparte por enlace (`anyoneWithLink`): siempre permiso nominal al correo del tutor.
- La carpeta del curso escolar es el ámbito de borrado: cuando un curso ya no hace falta, se
  borra la carpeta y se acabó.
- El panel no lista datos de familias en pantalla; solo dice cuántos alumnos entran en cada
  documento y quién se queda sin hoja.

---

## Fases

### Fase 0 · Plan
- [x] Ficha con decisiones cerradas, catálogo de campos y estructura de Drive
- [x] Módulo `cuaderno` en la matriz de permisos y tarjeta en el escritorio

### Fase 1 · Motor de plantillas (sin red)
Probado contra las plantillas reales del colegio (Dossier, Entrevista a familias y el listado de
reunión de familias): las 16 etiquetas que usan se reconocen y se resuelven solas con los alias de
fábrica, sin mapear nada a mano.
- [x] `ooxml.ts`: sustitución con runs partidos, repetición de cuerpo, filas `<<#alumnos>>`, condicionales `<<?campo>>`
- [x] `campos.ts`: catálogo, normalización de etiquetas, alias por defecto de las plantillas actuales
- [x] `nombres.ts`: nombres de carpeta y archivo (`1.1 · Dossier Personal — María R — 2ºA`)
- [x] Tests de los tres (`pnpm test`)

### Fase 2 · Drive y Docs
- [x] `drive.ts`: exportar plantilla a `.docx`, subir con conversión, exportar PDF, crear carpetas idempotentes, compartir, unidades compartidas
- [x] Detección de etiquetas de una plantilla a partir de su `.docx` exportado
- [ ] Verificado contra la unidad compartida real de David *(bloqueado: falta la URL de la carpeta base y la cuenta de servicio dada de alta)*
- [x] Comprobación previa de la carpeta base: existe, es unidad compartida y se puede escribir

### Fase 3 · Datos
- [x] Tablas `cuad_*` en `src/db/schema.ts`
- [x] `cuaderno-server.ts`: clases con tutores y reparto, alumnos con familiares, numeración congelada, hojas hechas
- [ ] `pnpm db:push` aplicado en Neon *(lo tiene que lanzar David)*

### Fase 4 · Cola
- [x] Crear tirada + ítems, reclamar ítem, ejecutar, reintentos, cancelar
- [x] Worker con re-despertar propio y cron de rescate en `vercel.json`
- [x] Endpoint de estado para el progreso

### Fase 5 · Panel
- [x] Pestaña Plantillas: alta por URL, analizar, mapear etiquetas nuevas, orden y formatos
- [x] Pestaña Generar: selección clase a clase, opciones, aviso de bloqueos (etiquetas o reparto)
- [x] Progreso en vivo y historial de tiradas con enlaces a Drive
- [x] Aviso de alumnado sin hoja y tirada solo para ellos

### Fase 6 · Compartir
- [x] Permisos de la carpeta de clase a los tutores
- [x] Correo de aviso al tutor con el enlace de su carpeta

### Fase 7 · Estreno real
- [x] Prueba del motor con las plantillas .docx reales: 3 copias por alumno, saltos de página,
      `sectPr` una sola vez, filas repetidas sobre un listado real y familias con un solo tutor legal
- [ ] Una clase de prueba de punta a punta con la unidad compartida real *(bloqueado: David)*
- [ ] Tirada completa de ESO 2026-27
