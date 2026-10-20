# Fase 3 · Módulo a módulo

> TEMPORAL: se borra con `plans/diseno-temporal/`.
> **Estado: BORRADOR.** Depende de las fases 1 y 2. Una sesión por grupo; cada grupo deja la app
> funcionando y se puede intercalar con otro trabajo.

## Para qué

Que cada módulo deje de usar sus piezas propias y use las de `src/components/ui/`, sin cambiar lo
que hace. Al terminar un grupo, sus entradas desaparecen de
`scripts/guardia-diseno.excepciones.json`.

## Cómo se hace un módulo (receta)

1. Botones → `Button` (`default`, `outline`, `ghost`, `destructive`, tamaño `default` = 44 px **[D06][D07]**).
   Borrar los `BOTON_*`, `ESTILO_BOTON*`, `BTN_*` locales.
2. Campos → `Input`, `Textarea` y `<select>` nativo con la clase de campo común. Borrar `ESTILO_CAMPO`/`CAMPO`/`inputCls`/`campo`.
3. Estados → `Estado` **[D10]**; códigos y rutas → `Etiqueta`; emojis solo con palabra **[D11]**.
4. Vistas → `Segmentado` **[D09]**; filtros → `Filtro` **[D02]**; interruptores → `Interruptor`.
5. Confirmaciones → `ConfirmarEnLinea` / `ConfirmarDialogo` / `palabra` **[D12]**. Cero `confirm()` y `prompt()`.
6. Cifras → `Cifra`; avisos → `Aviso`; vacíos → `Vacio`; barras inferiores → `BarraAcciones`; progreso → `Progreso`.
7. Textos: nada de `text-[9px]`/`text-[10px]`; texto que dice algo, `zinc-500` o más oscuro.
8. Nada que solo salga con hover: lo que hoy es `opacity-0 group-hover:opacity-100` se ve siempre (más tenue) o va a un menú.
9. Comprobar en claro y oscuro, a 390 px y 1180 px, con teclado (Tab llega a todo y se ve el foco).
10. Quitar el módulo de las excepciones de la guardia; `pnpm diseno:guardia` en verde.

## Grupos, en orden de uso [D16]

Cifras de hoy: `confirm()` · `prompt()` · hover · `text-[9-10px]` · constantes locales.

### G1 · Escritorio y pantallas de familias
Escritorio (`app/gestion/page.tsx`, `components/home/*`), Portada, `/licencias`, `/salidas`, encuesta de Evaluaciones, login y sin-acceso.
- [ ] Insignias del escritorio a `Estado` (hoy `text-[10px]`).
- [ ] Callouts del asistente de Licencias a `Aviso`; chips a `Estado`/`Filtro`.
- [ ] Salidas pública: tarjetas `rounded-3xl` → `rounded-2xl` como Licencias.
- [ ] Encuesta: el catálogo de colores de actividad no pone texto blanco pequeño sobre colores por debajo de 4,5:1 (8 de 20, ver `auditoria.md`).

### G2 · Puntualidad y Registro ABC (formularios de todos los días)
Puntualidad 2 · 0 · 0 · 9 · 0 — ABC 0 · 0 · 0 · 14 · 0
- [ ] Chips de los formularios → `Filtro`/`Segmentado` manteniendo los 44-48 px.
- [ ] `HistorialPill`, etiquetas de los paneles → `Estado`.
- [ ] Navegación del panel con estado activo (ya en fase 2) y sin enlaces solo-icono sin nombre.
- [ ] ABC: deslizador de efectividad con teclado (o `ui/slider`), desplegable a mano → `ui/popover`, interruptor → `Interruptor`.
- [ ] Gráficos de los dos paneles con la paleta de datos común y tooltip que respeta el modo oscuro (el de Puntualidad sirve de modelo).
- [ ] Puntualidad: los 2 `confirm()` → `ConfirmarEnLinea`.
- [ ] Excepción **[D15]** «su color en el formulario rápido»: solo si David la marcó.

### G3 · Alumnado y Números
Alumnado 0 · 0 · 0 · 5 · 0 — Números 0 · 0 · 0 · 0 · 0
- [ ] Alumnado: conmutador de vistas → `Segmentado` con ARIA; carril de clases a 40 px.
- [ ] `Chip` de la ficha → `Estado` (los 8 tonos se mapean a los 5 tonos comunes + `Etiqueta`).
- [ ] `BarraConfirmacion` → `ConfirmarEnLinea` en barra.
- [ ] Números: `Segmentos` ya es el modelo (pasa a ser `Segmentado`); `QuienesSon` → `Dialog` variante `hoja`; colores en hexadecimal → tokens.
- [ ] Banco en verde de Tailwind → esmeralda, como el resto de la app.

### G4 · Licencias (gestión)
0 hover · 17 `confirm()` · 3 `prompt()` · 3 `text-[10px]`
- [ ] Los 20 `confirm()`/`prompt()` → `Confirmar*`.
- [ ] Cuatro estilos de filtro → `Filtro` + `Segmentado`.
- [ ] `Badge` local de `pedidos-list.tsx` → `Estado` con palabra (🧾 📤 💰 **[D11]**).
- [ ] Las 11 tarjetas del índice: una pieza (hoy repiten ~330 caracteres) y un solo color de icono.
- [ ] Tres `Kpi` → `Cifra`.

### G5 · Evaluaciones (gestión)
1 · 1 · 0 · 13 · 7 constantes
- [ ] `ui.tsx` del módulo: `PANEL`/`TARJETA` → `Tarjeta` **[D08]**, `BTN_*` → `Button`, `CAMPO*` → campos comunes (los campos «en el sitio» del editor se pueden quedar como variante `bare` del `Input` común), `Segmentado` local → común, `Rotulo` → común.
- [ ] Principal único **[D07]**: fuera el negro del editor y el violeta (la IA se distingue por su icono, no por el botón).
- [ ] El `confirm()` de `enviar-panel.tsx:572` y el `prompt()` → `Confirmar*`.
- [ ] Iconos de acción de las preguntas visibles sin hover.

### G6 · Tableros y Tareas
Tableros 7 · 2 · 4 · 5 · 3 — Tareas 1 · 0 · 1 · 1 · 1
- [ ] Acciones visibles sin hover (Tableros 4 sitios, Tareas 1).
- [ ] 8 `confirm()` + 2 `prompt()` → `Confirmar*` (el de «escribe el nombre para borrar» → `palabra`).
- [ ] Chips de prioridad y vencimiento → `Estado`/`Etiqueta`; `Avatar` → el común.
- [ ] Filtros nativos con `outline-none` → con foco visible.
- [ ] Checklist duplicada entre Tableros y Tareas → una sola pieza del módulo Tableros que use Tareas.
- [ ] Excepción **[D15]** «lienzo de color»: se queda; columnas y tarjetas con las piezas comunes.
- [ ] Botón flotante de Tareas al 100 % de opacidad y 44 px.

### G7 · Nouvinguts, Dispositivos y Correos y grupos (la generación nueva)
Nouvinguts 3 · 0 · 0 · 0 · 1 — Dispositivos 0 · 0 · 0 · 0 · 3 — Cuentas 0 · 0 · 0 · 0 · 3
- [ ] Sus constantes ya son casi las comunes: se borran y se importan las de `ui/`.
- [ ] Un solo botón relleno principal **[D07]**: el verde «Cerrar ciclo» pasa a principal o a `outline` con icono.
- [ ] Nouvinguts: 3 `confirm()` → `Confirmar*`.
- [ ] Dispositivos: un solo estilo de activo **[D02]** (hoy relleno negro, contorno y color en la misma pantalla).
- [ ] Correos: casillas de fila dentro de una etiqueta de 40 px; segmentado h-8 → común.

### G8 · Horarios, Mi horario y Oratorios
Horarios 0 · 0 · 0 · 8 · 1 — Mi horario 0 · 0 · 0 · 0 · 1 — Oratorios 8 · 0 · 0 · 4 · 0
- [ ] Horarios: cuatro estilos de selección → `Segmentado` + `Filtro` **[D02]**; hojas a mano → `Dialog` variante `hoja`.
- [ ] Mi horario: «Quitar del calendario (N eventos)» con `ConfirmarDialogo`; el `<details>` de colores → `ui/popover`.
- [ ] Oratorios: `Accion`/`Pastilla`/`ChipVista` → comunes; 8 `confirm()` → `Confirmar*`; los emojis de estado con palabra **[D11]** y leyenda visible (hoy solo en `title`); el azul deja de significar «confirmada».
- [ ] Las tres rejillas (Navegador, Planificar, Mis huecos): mismo ancho de columna de hora y mismo formato de hora; la de Horarios es el modelo.

### G9 · AUTOASM, Classrooms y calendarios, Cuaderno
AUTOASM 5 · 0 · 0 · 3 · 0 — Calendarios 1 · 0 · 0 · 0 · 0 — Cuaderno 2 · 0 · 0 · 1 · 0
- [ ] AUTOASM: con la cabecera común (fase 2); su cabecera oscura, como portada del módulo solo si **[D15]**; los 5 `confirm()` → `Confirmar*`; cabecera de la tabla que se quede fija de verdad.
- [ ] Calendarios: título de página; los dos segmentados apilados se distinguen (vista vs. grupo).
- [ ] Cuaderno: `BotonMini` ×2 → `Button size="sm"`; pestañas que no se salgan en el móvil; texto blanco sobre ámbar → otro contraste.

### G10 · El resto
Salidas (gestión), Banco de libros, Profesorado, Usuarios, Ajustes, BBDD Educamos.
- [ ] Usuarios: el `confirm()` → `Confirmar*`; chips de 23 px → 40 px.
- [ ] Profesorado: quitar tutor con `ConfirmarEnLinea` o deshacer; la «×» a 40 px.
- [ ] Banco de libros: «Todos MB» y «Lote entregado» (escrituras en bloque) con confirmación; colores lima/índigo/púrpura → paleta común.
- [ ] Educamos: los cubos del asistente de sincronización iguales en `sync/plan-view` y `Cubo`.

## Hecho cuando

- [ ] Los 10 grupos marcados.
- [ ] `scripts/guardia-diseno.excepciones.json` vacío (o solo con excepciones aprobadas y comentadas).
- [ ] `grep -rn "confirm(\|prompt(" src --include=*.tsx` → 0.
- [ ] Fila de la fase 3 → HECHO.

## Paradas

- Si cambiar una pieza cambia el comportamiento (por ejemplo, un select nativo que el iPad abre como rueda y el común no), se queda el nativo con la clase común. Nunca se pierde una función por la estética.
- Si un módulo tiene trabajo funcional abierto en otra rama, se deja para el final.
