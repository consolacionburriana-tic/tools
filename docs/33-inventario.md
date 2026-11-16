# Inventario y aulas · audiovisual, mesas y sillas, antenas y robótica

**Estado:** plan funcional ✅ · plan técnico ✅ · implementado 🟡 (Fase 1 en `/gestion/inventario` desde el
16-nov-2026, con los cuatro Excel de David volcados en Neon; falta que David lo estrene y marque lo que ha
llegado de robótica)

Pedido de David el 16-nov-2026 («Inventario y aulas: equipamiento AV de aulas, antenas, mesas y sillas y
robótica»), con cuatro Excel: *Clases - Proyectores - TV*, *Mesas y Sillas Clases Infantil y Primaria*,
*Nombre Antenas Cole* e *Inventario material pensamiento computacional*. Va en el grupo **Tecnología** del
escritorio, justo detrás de Dispositivos 1:1, pero es un módulo aparte.

Ruta: `/gestion/inventario`. Acceso: **TIC, SuperTIC, Secretaría y Dirección** (módulo `inventario`, como
Dispositivos). Prefijo de tablas: `inv_`.

## La idea que lo ordena todo: el aula es la puerta, no la clase

Cada aula tiene un **número de puerta** que no cambia (1, 2… 17-18… 31). La clase que la ocupa **cambia cada
curso**: se cambia el cartelito de la puerta y la 21 pasa a ser otra letra. Por eso:

- `inv_aulas` es el sitio físico (número, piso, nombre si es una sala fija como Música o Informática).
- `inv_ocupacion` dice qué clase hay detrás de cada puerta **en cada curso académico** (una fila por aula y
  curso, con los códigos de `edu_students`: `3PRI` + `B`).
- Todo lo de dentro (audiovisual, mesas y sillas, antena, kits de robótica, arreglos) cuelga **del aula**,
  nunca de la clase. Al cambiar de curso no se mueve nada: solo se apunta la nueva ocupación.

El Excel bueno es *Clases - Proyectores - TV* (David): su columna «Clase 25/26» se cargó como la ocupación de
**2026-27**, el curso en vigor. La columna «Aula curso 22/23» del Excel de antenas está obsoleta y no se usó.

## Decisiones cerradas

1. **Seis secciones arriba** (segmentado de rutas, como pidió David: «chips de arriba según si quiero
   configurar AV, mesas y sillas, robótica…»): **Aulas · Audiovisual · Mesas y sillas · Antenas · Robótica ·
   Arreglos**. «Clases de cada aula» y los informes de imprimir son pantallas enlazadas, no secciones.
2. **Aulas (portada)**: tarjetas por piso con el número grande, la clase de este curso, su tutor/a y cuántos
   alumnos tiene (de `edu_tutorias` y `edu_students`), el audiovisual con su valoración, mesas y sillas
   (con «Faltan 2 sillas» si hay menos sillas que alumnos), la antena y los arreglos pendientes. El buscador
   mira en todo (número, clase, tutor, marca, notas, antena, kits). Filtros: algo urgente, con arreglos,
   faltan sillas. La **ficha de un aula** lo edita todo en el sitio.
3. **Audiovisual**: la tabla del Excel, **ordenada por prioridad** por defecto. La prioridad se calcula
   (`atencionAv`): un arreglo urgente sin hacer → Urgente; «Cambiar»/«Reparar» o valoración 0-1 → Alta;
   problema de audio, retirar lo antiguo, valoración 2-3 o un arreglo normal pendiente → Media. Lo de
   «cuando se pueda» no sube la prioridad. Columnas ordenables (aula, marca, valoración, prioridad).
4. **Valoración 0-5** (la columna «Estado» del Excel). **0 con «Correcto» se cargó como «sin valorar»**
   (4º EP B, 1º ESO A, 4º ESO PDC tenían 0 y «Correcto», que no cuadra); 0 con «Cambiar» se quedó en 0.
5. **«Qué hay que hacer»** del audiovisual = la columna «Acciones»: Correcto, Problema de audio, Retirar lo
   antiguo, Reparar, Cambiar.
6. **Arreglos**: una lista de cosas por hacer, de un aula o de un kit, con prioridad (Urgente / Normal /
   Cuando se pueda) y de qué son (audiovisual, mobiliario, wifi y red, robótica, otro). Se marcan hechos de un
   toque (con Deshacer) y **no se borran**: queda quién y cuándo. **Se sembraron 46 a partir de las notas del
   Excel** (los «COMPRAR FILTRO URGENTE ⚠️» como urgentes, «se puede quitar el proyector» como «cuando se
   pueda»); las notas originales se conservan en cada aula. El botón de la cabecera, «Apuntar arreglo», sirve
   desde cualquier sección.
7. **Mesas y sillas contra el alumnado**: el cuadre es sillas − alumnos de la clase de este curso (y mesas −
   alumnos, menos en Infantil, donde las mesas son de grupo). La ESO no venía contada: sale «Sin contar».
8. **Antenas**: nombre actual → nombre nuevo, por aula (`P2_15`: piso y número de puerta) o por pasillo. «Ya
   renombrada» copia el nuevo al actual. La antena `P2_APOYO` decía «2º ESO C» (ubicación antigua): se dejó
   como «Aula de apoyo de la P2» con esa nota.
9. **Robótica**: el catálogo del pedido (64 artículos; cantidad vacía en el Excel = **sin pedir**, sale solo en
   «Todo el catálogo»). Cada unidad que llega es un **kit numerado** (L1, L2…): «Ha llegado» pide cuántas,
   la letra (sugerida por las iniciales; Lego Spike Prime ya lleva **L**) y dónde se dejan (Informática por
   defecto), y las numera a continuación. Cada kit: estado (Bien, Le falta algo, Averiado, De baja), dónde
   está, notas y sus arreglos («le falta una pieza»). «Mover todos a…» cambia de sala un lote. Cada material
   tiene sus **recursos didácticos** (pegar un enlace y, si se quiere, un título).
10. **Lo que ha llegado no se inventó**: David dijo que los Lego Spike ya estaban numerados (L1, L2, L3, L4…)
    pero no cuántos; no se ha creado ningún kit. Se marca desde «Ha llegado».
11. **Salas**: Informática y Taller de tecnología se crearon sin número de puerta ni piso (son donde suele ir
    la robótica). Música (15) y Aula Creativa (22) son salas con número. Todas enlazan con su código de
    Horarios (`MUS`, `CREA`, `INFO`, `TEC`).
12. **Ajuste de clases por curso** («Clases de cada aula», `/gestion/inventario/clases`): sale ya rellena con
    una propuesta que solo hay que repasar:
    - si ya están las **tutorías del curso que viene**, la clase que tendrá el tutor/a del aula («si mantiene
      el tutor, que es lo habitual»);
    - si no, la regla de promoción de la etapa (`CONFIGURACION.promocion`, la misma de «Promocionar +1 curso»):
      Infantil rota 3-4-5, **Primaria por parejas** (3º B → 4º B en la misma aula; 4º B → 3º B), ESO sube y
      se marca «Revisar»; 4º de ESO no tiene a dónde ir y queda para elegir.
    - Una clase en dos aulas no se puede guardar; las clases que se quedan sin aula salen avisadas.
13. **El aviso de inicio de curso** sale **del 10 de julio al 30 de septiembre** (`CONFIGURACION.inventario`),
    en la franja de la cabecera del módulo, en «Ahora» del escritorio y como insignia de la tarjeta, **hasta que
    se guarda** el reparto del curso que viene. Si el 30 de septiembre no se ha hecho, desaparece solo.
14. **Para imprimir y escribir encima** (estilo «papel oficial»): Aulas, Audiovisual (con el orden de la
    pantalla y una columna «Hecho / notas» en blanco), Mesas y sillas (con columnas «Sillas hoy» y «Mesas hoy»
    para contar), Antenas, **la ronda de arreglos** (con su casilla ☐, por prioridad o por piso), el
    inventario de robótica y la ficha de un aula. Y **un Excel con todo**, una pestaña por sección.

## Plan técnico

- **Tablas** (`src/db/schema.ts`, SQL `src/db/sql/inventario.sql`, aplicado y verificado el 16-nov-2026, con
  los datos): `inv_aulas`, `inv_ocupacion`, `inv_av`, `inv_mobiliario`, `inv_antenas`, `inv_arreglos`,
  `inv_rob_modelos`, `inv_rob_kits`, `inv_rob_recursos`. El SQL es idempotente: volver a lanzarlo no duplica ni
  pisa lo editado.
- **Helpers puros** (`src/lib/inventario.ts`, tests en `__tests__/inventario.test.ts`): vocabulario, prioridad
  del audiovisual, cuadre de mesas y sillas, aviso de inicio de curso, propuesta de ocupación, códigos de kits,
  schemas Zod. `src/lib/inventario-indice.ts`: todo lo de cada aula junto (lo usan pantallas, informes y Excel).
- **Servidor** (`src/lib/inventario-server.ts`): `cargarInventario()` trae el módulo entero en **una tanda**
  (es pequeño: ~35 aulas, 25 antenas, 64 materiales) y cada pantalla filtra en el cliente; `resumenInventario()`
  para el escritorio y la cabecera.
- **Escrituras**: Server Actions en `src/app/gestion/inventario/acciones.ts` (guard `inventario` dentro de cada
  una, `refresh()` al terminar, devuelven `{ ok }` o `{ error }`).
- **Excel**: `GET /api/inventario/excel` (`src/lib/inventario-exports.ts`).
- **UI** (`src/components/inventario/`): `aulas`, `ficha-aula`, `audiovisual`, `mobiliario`, `antenas`,
  `robotica`, `lista-arreglos` + `arreglos`, `ajuste-clases`, `formularios`, `comun`. Informes en
  `src/app/gestion/inventario/imprimir`.

## Checklist

### Fase 1 · el módulo (16-nov-2026)
- [x] Ficha y fila en la tabla maestra
- [x] Tablas `inv_*` y SQL aplicado en Neon, con los cuatro Excel volcados (32 aulas y salas, 28 ocupaciones de 2026-27, 30 audiovisuales, 18 mesas y sillas, 25 antenas, 64 materiales de robótica, 46 arreglos)
- [x] Helpers puros con tests (prioridad, cuadre, aviso, propuesta de clases, códigos)
- [x] Aulas: portada por pisos con buscador y filtros, y ficha de cada aula editable
- [x] Audiovisual: tabla ordenable por prioridad, filtros y hoja de edición con sus arreglos
- [x] Mesas y sillas: cuadre contra el alumnado y hoja para contar
- [x] Antenas: por renombrar, «Ya renombrada», alta y edición
- [x] Arreglos: lista por prioridad o piso, marcar hecho con Deshacer, apuntar desde la cabecera
- [x] Robótica: pedido, «Ha llegado» con numeración, kits (estado, ubicación, notas, arreglos), mover en bloque, recursos didácticos (probado contra Neon y limpiado)
- [x] Clases de cada aula con propuesta (tutor o ciclo) y aviso del 10-jul al 30-sep (cabecera, escritorio e insignia)
- [x] Informes para imprimir y Excel con todo
- [x] Módulo `inventario` en la matriz de roles y tarjeta en el escritorio
- [ ] Estreno de David: marcar lo que ha llegado de robótica (los Lego Spike, L1…) y repasar los arreglos sembrados

### Fase 2 · ideas (sin decidir, en `00-desarrollos-futuros.md`)
- [ ] Reservas o registro de uso del material de robótica (David: «ya iremos viendo»)
- [ ] Que el claustro avise de una avería de su aula (hoy va por el botón de Tareas)
- [ ] Historial de cambios del audiovisual y de los kits
