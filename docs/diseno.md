# Diseño de Tools Consolación · la guía

> Decidida el 21-oct-2026 tras auditar los 24 módulos (David eligió en el artefacto «Diseño de
> Tools Consolación»; las decisiones, al final). Corta a propósito. Si una pantalla necesita
> algo que no está aquí, primero mira `src/components/ui/`; si de verdad falta, se crea **allí**
> (no en el módulo) y se apunta en esta guía.
>
> **Escaparate** con todas las piezas, sus variantes y la línea de `import`: `/gestion/diseno`
> (quien tenga «Ajustes del colegio»). **Guardia**: `pnpm diseno:guardia`.

## 1. De dónde sale cada pieza

Todo lo común vive en `src/components/ui/`. Un módulo **no** se define sus botones, campos ni
chips (`BOTON_PRIMARIO`, `ESTILO_CAMPO`…): usa estas.

| Necesito… | Uso… | De |
|---|---|---|
| El marco de un módulo (cabecera, secciones, ancho) | `PaginaModulo` en su `layout.tsx` | `ui/cabecera-modulo` |
| El nombre de lo que se ve (un alumno, un tablero) | `TituloPagina`, con `EnlaceVolver` encima | `ui/cabecera-modulo` |
| Una pantalla de familias (Licencias, Salidas) | `PaginaFamilias` | `ui/pagina-familias` |
| Un botón, o un enlace con forma de botón | `Button` (con `cargando` mientras guarda), `buttonVariants()` | `ui/button` |
| Un campo, un texto largo, un desplegable | `Input`, `Textarea`, `Selector`, y `Campo` para etiqueta y ayuda | `ui/input`, `ui/textarea`, `ui/selector`, `ui/campo` |
| Cambiar de vista en una pantalla, o elegir entre 2-4 valores cortos (Sí / No) | `Segmentado` | `ui/segmentado` |
| Las secciones del módulo (cada una, una ruta) | `secciones` de `PaginaModulo` | `ui/cabecera-modulo` |
| Filtrar una lista, o marcar varias de una lista corta (a quién avisar) | `Filtros` + `Filtro` | `ui/filtro` |
| El estado de algo (hecho, falta, error) | `Estado` | `ui/estado` |
| Una clase, un código, una ruta | `Etiqueta` | `ui/etiqueta` |
| Agrupar en una caja | `Tarjeta`, `TarjetaCabecera`, `TarjetaCuerpo` | `ui/tarjeta` |
| Ir a otra pantalla desde una lista de opciones | `TarjetaEnlace` | `ui/tarjeta` |
| Cifras con su nombre | `Cifras` + `Cifra` | `ui/cifra` |
| No hay nada que enseñar | `Vacio` | `ui/vacio` |
| Avisar de algo dentro de la página | `Aviso` (`info`, `aviso`, `error`, `ok`) | `ui/aviso` |
| Avisar de algo hecho | `toast` (con `action: { label: 'Deshacer', … }` si se puede) | `sonner` |
| Confirmar | `ConfirmarEnLinea`, `ConfirmarDialogo`, `useConfirmar` | `ui/confirmar` |
| Una ventana encima | `Dialog`… (`variante="hoja"` para fichas que se abren con el dedo) | `ui/dialog` |
| Botones fijos abajo | `BarraAcciones` | `ui/barra-acciones` |
| Cuánto lleva algo · una tarea larga del servidor | `Progreso` · `EnCurso` | `ui/progreso` |
| Un sí/no que se aplica al momento | `Interruptor` (`etiquetaOculta` dentro de una fila) | `ui/interruptor` |
| Copiar de un toque | `Copiable`, `Dato`, `CopiarLista`, `copiarTexto` | `ui/copiable` |
| Encabezar un grupo («AHORA», «RESUMEN») | `Rotulo` | `ui/rotulo` |
| Una persona | `Avatar` (`neutro` si el color estorba), `Avatares` | `ui/avatar` |
| El icono de un módulo | `IconoModulo` (identidad en `src/lib/modulos.ts`) | `ui/icono-modulo` |
| Mientras carga | `loading.tsx` con `SkeletonPage` y `SkeletonKpis`/`SkeletonRows`/`SkeletonTabla` | `ui/skeleton` |
| Saber qué enlace se ha pulsado | `NavPending` / `NavArrow` dentro del `Link` | `ui/nav-pending` |

**Modelo**: Nouvinguts (`components/nouvinguts/`) es el primer módulo rehecho con todo esto;
cuando dudes de cómo queda algo, mira cómo está allí.

Una pieza sube a `ui/` cuando la necesita un **segundo** módulo. Lo que solo usa uno (la línea de
pasos de Nouvinguts, la rejilla de horario, el lienzo de Tableros) se queda en su módulo.

**Un módulo nuevo**: su entrada en `src/lib/modulos.ts` (nombre, icono, grupo) y en
`src/lib/escritorio.ts`, y un `layout.tsx` así:

```tsx
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  if (!canAccess(user, 'nouvinguts')) redirect('/gestion/sin-acceso');
  return (
    <PaginaModulo
      modulo="nouvinguts"
      ancho="normal"
      accion={<Link href="/gestion/nouvinguts/nuevo" className={buttonVariants({ size: 'sm' })}><Plus /> Apuntar</Link>}
    >
      {children}
    </PaginaModulo>
  );
}
```

## 2. Las reglas

**Color.**
- Lo que se pulsa es **azul** (`blue-600`): el botón principal, los enlaces, el foco.
- Cada módulo tiene su **color de identidad**, el de su grupo del escritorio, y va **solo en su
  icono** (cabecera y escritorio): Tu día azul, Alumnado violeta, Familias y cobros rosa,
  Organización teal, Tecnología cielo, Configuración gris. Nunca en botones ni en fondos.
- **Verde, ámbar y rojo son de estado**: hecho · falta algo · error o borrar (y gris, no aplica).
  No decoran ni identifican a nadie.
- Neutros, solo **zinc**. Página `bg-zinc-50 dark:bg-zinc-950`; superficies `bg-white dark:bg-zinc-900`.
- Gráficos con la **paleta de datos** (`--datos-1…3` en orden fijo, `--datos-ord-lo/hi` para
  escalas), validada para daltonismo, y tooltips que respetan el modo oscuro.

**Seleccionar.** Para cambiar de **vista**, `Segmentado` (pista gris, la activa en blanco). Para
**filtrar**, `Filtro` (pastillas, la activa en negro). Cada cosa con el suyo, siempre.

**La página.**
- Cabecera **común** (`PaginaModulo`): icono, nombre, la acción principal y «Escritorio». Si la
  acción abre un diálogo, el botón de la cabecera es un enlace con `?apuntar=1` (o lo que toque)
  y la página abre el diálogo al verlo, así funciona también desde otras pantallas del módulo.
- **Secciones** (`secciones` de `PaginaModulo`, segmentado de enlaces bajo la cabecera) solo para
  las áreas hermanas que usa todo el mundo (Panel · Registros · Alumnos). Una pantalla de ajustes
  del módulo no es una sección: es un enlace en la página («Proceso», «Ajustes»), y desde ella se
  vuelve con `EnlaceVolver`. Nunca dos segmentados apilados: si una pantalla con secciones
  necesita vistas, esas vistas son filtros.
- **Sin título visible** que repita el módulo: la página empieza por lo suyo (filtros, datos), y
  lleva su `<h1 className="sr-only">` para el lector de pantalla. La página de **una cosa** (un
  alumno, un tablero, una salida) sí lleva su nombre a la vista, con `TituloPagina`.
- Un módulo que es un **índice** de muchas pantallas (Licencias): su portada es el índice, con
  `TarjetaEnlace`; cada subpantalla lleva `EnlaceVolver` al índice y su nombre con `TituloPagina`,
  porque sin barra de secciones hace falta saber dónde estás.
- **Un ancho por módulo** (no por pantalla, para que nada salte al navegar): `estrecho` 768 px
  (formularios y ajustes), `normal` 1024 (listas y fichas), `ancho` 1280 (tablas y rejillas),
  `completo` (tableros). Un formulario dentro de un módulo ancho se estrecha con `max-w-2xl`.

**Tamaño.** Botones y campos de **44 px** (`h-11`); chips, pestañas y botones de una fila densa,
**40 px** como mínimo (`h-10`). Nada que se toque por debajo.

**Texto.** Mínimo 12 px (`text-xs`) y gris `zinc-500` o más oscuro para todo lo que dice algo;
`zinc-400` solo para adornos (iconos decorativos, separadores). Nada de `text-[10px]` ni
`text-[11px]`. Cifras con `tabular-nums`. Castellano de tú; los botones dicen lo que pasa
(«Guardar retraso», «Borrar 4 calendarios»), no «Aceptar».

**Botón principal.** Azul relleno, **uno por pantalla**. En una lista, la acción que toca en cada fila va en `suave` (azul tenue), para que se vea sin que la lista grite. El resto, `outline` o
`ghost`. Borrar o quitar, `destructive` (contorno rojo); el rojo relleno, solo para el «sí» de una
confirmación.

**Formas.** Tarjetas `rounded-2xl` con borde fino y **sin sombra** (la sombra es para lo que
flota: diálogos, menús, la barra de abajo). Controles `rounded-xl`, pastillas `rounded-full`,
etiquetas `rounded-md`. Nada de `rounded-3xl` salvo la placa del logo. Iconos de 16 px en botones
y de 20 px en títulos y tarjetas.

**Estados.** Pastilla rellena suave (`Estado`), siempre con el texto del estado: el color solo lo
refuerza.

**Que se lea de un vistazo.** Lo que pide atención lleva su color de estado, sin que haga falta
leer: la cifra que falta en ámbar (`Cifra tono="aviso"`), cuánto va hecho con su barra o su anillo
(`barra`, `Progreso`, `Anillo`, que se ponen en verde al llegar al 100 %) y los filtros de un estado
con su punto (`Filtro tono`). Solo donde ayuda a decidir algo: una cifra neutra se queda en negro,
y si todo tiene color nada destaca.

**Iconos, no emojis.** Solo iconos de **lucide** en la interfaz. Los emojis, únicamente dentro de
lo que escribe la gente (el nombre de un tablero, un comentario); nunca para decir un estado.

**Confirmar** según lo gordo que sea, y nunca con `confirm()` ni `prompt()`:
- se puede rehacer → se hace y el toast ofrece **Deshacer**;
- una cosa que no se rehace → `ConfirmarEnLinea` (el botón pregunta en el sitio);
- muchas a la vez → `ConfirmarDialogo` o `useConfirmar`, diciendo cuántas y qué pasa;
- gordo y sin vuelta atrás (suspender cuentas, borrar un curso) → además, escribir una `palabra`.

**Familias y alumnado** (portada, Licencias, Salidas, encuestas, formularios): su propio estilo,
centrado, con el logo, una columna y el botón grande abajo. Manchas de color de fondo, solo en la
**portada** y en las **encuestas**.

**iPad y accesibilidad.**
- **Nada solo al pasar el ratón** ni solo en un `title`: en el iPad no existen. Editar y borrar se
  ven siempre, aunque sea más tenue.
- **Foco visible**: quien quite el `outline` pone `focus-visible:ring-3 focus-visible:ring-ring/50`.
- Segmentados, filtros e interruptores dicen cuál está activo (`aria-pressed`, `aria-current`,
  `role="switch"`); los botones de solo icono llevan `aria-label`. Las piezas ya lo hacen.
- Cada ruta con su `loading.tsx` (el esqueleto con la forma de la pantalla) y cada lista con su
  estado vacío (`Vacio`).
- Claro **y** oscuro; 390 px **y** 1180 px sin desplazamiento lateral (una tabla ancha se
  desplaza dentro de su tarjeta).

## 3. Excepciones permitidas

Solo estas pueden salirse de las reglas, y solo en lo que se dice:

| Dónde | Qué se permite |
|---|---|
| **Tableros** (y el tablero de Tareas) | El lienzo con el color del tablero y sus columnas; varias tintas en las etiquetas. Sin raya de color a la izquierda, sin acciones que salgan solo con el ratón y sin diálogos del navegador. |
| **Encuesta de Evaluaciones** (`/evaluaciones/…`) | Teñida del color de la encuesta y con las manchas de fondo. |
| **Horarios y Mi horario** | El color de cada materia en la rejilla (raya y tinte suave). |
| **Números del cole** | Las pestañas con punto de color, el mismo color en sus cifras, y la tabla de informe. |
| **Fichas para imprimir** (Banco de libros, Números) | Estilo «papel oficial»: blanco y negro, rayas y mayúsculas. |
| **Celebración al terminar** (Licencias, Salidas, Evaluaciones, al enviar) | La animación de «hecho». |

## 4. Lo que no se hace

- `confirm()`, `prompt()` o `alert()` del navegador.
- Constantes de estilo locales para botones o campos (`BOTON_*`, `ESTILO_BOTON`, `ESTILO_CAMPO`,
  `CAMPO`, `BTN_*`): son `Button` e `Input`.
- `<header>` propio en una página o un layout de `/gestion`: es `PaginaModulo`.
- `text-[10px]`, `text-[11px]` y demás tamaños a mano para texto.
- Acciones con `opacity-0 group-hover:opacity-100`.
- Un color de módulo en un botón; verde, ámbar o rojo como adorno.
- Emojis como iconos o para decir un estado.
- Una raya de color en el borde izquierdo de una tarjeta para decir qué es.

`pnpm diseno:guardia` cuenta las cinco primeras por fichero: falla si un fichero tiene más que
las que ya tenía (la lista de lo que queda por limpiar está en
`scripts/guardia-diseno.excepciones.json`, y solo puede bajar).

## 5. Antes de dar una pantalla por hecha

- [ ] Usa las piezas de `ui/`; nada de lo de la sección 4 (y `pnpm diseno:guardia` en verde).
- [ ] Cabecera común, ancho del módulo, `h1` (oculto o `TituloPagina`).
- [ ] Mirada en claro y en oscuro, a 390 px y a 1180 px.
- [ ] Todo lo que se toca mide 40-44 px y se ve sin ratón; se llega a todo con el teclado y se ve el foco.
- [ ] Tiene `loading.tsx` y estado vacío.

## Decisiones (21-oct-2026)

| | Decisión | Cómo se aplicó |
|---|---|---|
| 01 Color | B · azul para actuar; el color del módulo, solo en su icono | El color de identidad es el del grupo del escritorio. Familias pasó de ámbar a rosa y Organización de esmeralda a teal, para no confundirse con los estados. |
| 02 Seleccionar | C · vistas en segmentado, filtros en negro | `Segmentado` y `Filtro`. |
| 03 Cabecera | B · icono, nombre, acción principal y escritorio | `PaginaModulo`. La D (barra de plataforma con selector de módulos) queda como idea en `00-desarrollos-futuros.md`. |
| 04 Título | C · sin título visible | `h1` oculto en cada página; las páginas de una cosa llevan su nombre con `TituloPagina`. |
| 05 Anchos | A · tres anchos según el tipo | Uno por módulo, para que nada salte; más `completo` para los tableros. |
| 06 Tamaño | A · 44 px, chips y pestañas 40 | En `Button`, `Input` y todas las piezas. |
| 07 Botón principal | A · azul | `Button` por defecto, y `--primary` es azul para las piezas de shadcn. |
| 08 Tarjetas | A · borde fino, sin sombra | `Tarjeta`. |
| 09 Vistas | B · segmentado | Las pestañas con punto de color se quedan solo en Números. |
| 10 Estados | B · pastilla rellena suave | `Estado`. |
| 11 Emojis | A · fuera de la interfaz | Solo lucide; emojis únicamente en lo que escribe la gente. |
| 12 Confirmar | B · según lo gordo | `ui/confirmar` y «Deshacer» en el toast. |
| 13 Familias | A · su propio estilo | Centrado, logo, una columna, botón grande abajo. |
| 14 Fondo | A · manchas solo en portada y encuestas | |
| 15 Excepciones | Tableros, encuesta, materias, imprimir y celebrar | Números también, por decisión mía (a David le gustan sus pestañas). El formulario rápido de ABC y Puntualidad pasa a azul, y AUTOASM, a la cabecera común. |
| 16 Ritmo | B · módulo a módulo, de golpe | |
