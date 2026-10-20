# Fase 1 · La guía y las piezas comunes

> TEMPORAL: se borra con `plans/diseno-temporal/`.
> **Estado: BORRADOR.** Escrito con las propuestas por defecto del artefacto; se reescribe con las
> decisiones de David antes de ejecutarlo. Lo que depende de una decisión lleva **[Dnn]**.

## Para qué

Que exista **un sitio del que sacar cada pieza** (`src/components/ui/`), una **guía corta** que diga
cuál usar y cómo (`docs/diseno.md`), un **escaparate** para verlas (`/gestion/diseno`) y una
**guardia** que avise si alguien vuelve a pintarse sus botones. Esta fase no cambia ninguna
pantalla de los módulos (salvo los 3 sitios que ya usan `ui/button`): solo prepara las piezas.

## Antes de empezar

- Lee `AGENTS.md`, `docs/04-convenciones-tecnicas.md` (§UI) y `plans/diseno-temporal/auditoria.md`.
- Next 16: mira `node_modules/next/dist/docs/` antes de tocar rutas o layouts.
- shadcn está montado sobre **@base-ui/react**: los Trigger no tienen `asChild` (se usa `render`).
- Radios de esta app: `rounded-xl` = 14 px y `rounded-2xl` = 18 px (`--radius: .625rem`).

## Decisiones que la afectan (valor por defecto entre paréntesis)

D01 color (B: azul para actuar, color propio solo en el icono) · D02 seleccionado (C: segmentado
para vistas, negro para filtros) · D06 tamaño (A: 44 px botones y campos, 40 px chips) · D07 botón
principal (A: azul) · D08 tarjeta (A: borde fino) · D09 vistas (B: segmentado) · D10 estados (B:
pastilla rellena suave) · D11 emojis (B: solo con palabra) · D12 confirmar (B: según lo gordo) ·
D15 excepciones · y las 16 prácticas.

## Pasos

### 1. Tokens en `src/app/globals.css`

- `--primary` pasa a azul 600 (`oklch(0.546 0.245 262.881)`) y `--primary-foreground` a blanco;
  `--ring` a azul 500 al 50 %. Así las piezas de shadcn (`Button`, `Dialog`, `Calendar`…) salen con
  la marca sin tocar sus clases **[D07]**. En `.dark`, `--primary` azul 500.
- Paleta de datos común: añadir `--datos-1…3` y `--datos-ord-lo/hi` como alias de los `--eval-*`
  actuales (no renombrar los `--eval-*`: los usa Evaluaciones).
- Si **[D01] = C**: un `--acento` por módulo con `[data-modulo="abc"] { --acento: … }`, nunca
  verde, ámbar ni rojo. Con la B (defecto) no hace falta: el color de identidad va en el registro de
  módulos de la fase 2.
- Comprobar: `pnpm build`; el escritorio y un formulario se ven igual que antes (solo cambia lo que
  usa `bg-primary`: los 3 `Button` existentes, ver paso 2).

### 2. Primitivas de shadcn al estilo de la casa (`src/components/ui/`)

Se quedan con su nombre en inglés (son de shadcn). Se reescriben sus `cva`:

| Fichero | Cambio |
|---|---|
| `button.tsx` | Tamaños: `default` h-11 px-4 `rounded-xl` text-sm font-semibold **[D06]**; `sm` h-9 px-3; `lg`/`cta` h-12 w-full para barras fijas; `icon` size-11, `icon-sm` size-9. Variantes: `default` (azul), `outline` (blanco, borde zinc-300), `ghost`, `destructive` (contorno rojo), `destructive-solid` (rojo relleno, solo dentro de una confirmación), `link`. Fuera el `translate-y-px` al pulsar (ya hay `active:scale` global). Foco `focus-visible:ring-3 ring-ring/50` (ya está). |
| `input.tsx`, `textarea.tsx` | La receta de Nouvinguts/Dispositivos: h-11 `rounded-xl` borde zinc-300, `text-base sm:text-[15px]` (sin zoom en iPhone), foco `focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/20`. |
| `dialog.tsx` | Añadir variante `hoja` (bottom sheet en móvil, centrada desde `sm`, `pb-[max(1.25rem,env(safe-area-inset-bottom))]`), copiando la de Horarios (`navegador.tsx:452`). |
| `badge.tsx` | Se queda para usos genéricos; los estados usan `Estado` (paso 3). |
| `skeleton.tsx` | Añadir `SkeletonPaginaModulo` (cabecera + título + 3 tarjetas) para los `loading.tsx` de la fase 2. |

**Los 3 usos actuales de `Button`** (`components/registro-abc/registro-form.tsx`,
`app/gestion/abc/alumnos/page.tsx`, `components/horarios/editor-anotacion.tsx`) se revisan uno a uno
en claro y oscuro después del cambio.

### 3. Piezas de la casa (nuevas, en castellano, en `src/components/ui/`)

Cada una en su fichero, con un comentario de 2-4 líneas que diga cuándo se usa y cuándo no.
La columna «De dónde» es la implementación de la que partir.

| Pieza | Fichero | De dónde | Notas |
|---|---|---|---|
| `Segmentado` | `segmentado.tsx` | Números `Segmentos` + altura de Dispositivos | `role="group"` + `aria-pressed`; también como enlaces (`href`) para secciones que son rutas (ABC, Puntualidad) con `aria-current` **[D02][D09]** |
| `Filtro` | `filtro.tsx` | Nouvinguts `lista.tsx:172` | Pastilla h-10 `rounded-full`, activa negra **[D02]**, cuenta en mono |
| `Estado` | `estado.tsx` | Cuentas `ChipEstado` + tonos de Evaluaciones | `tono: 'ok' \| 'aviso' \| 'error' \| 'neutro' \| 'info'`, icono opcional, `text-xs` mínimo **[D10][D11]** |
| `Etiqueta` | `etiqueta.tsx` | Cuentas `ChipUo` | Código, ruta o clase en mono `rounded-md` |
| `Tarjeta` | `tarjeta.tsx` | `TARJETA` de Cuentas (= `SkeletonCard`) | `Tarjeta`, `TarjetaCabecera` (`border-b px-4 py-3`), `TarjetaCuerpo` **[D08]** |
| `Cifra` | `cifra.tsx` | Escritorio `Stat` + Números | Etiqueta, valor `tabular-nums`, nota, punto de color y barra opcionales |
| `Vacio` | `vacio.tsx` | Puntualidad `dashboard-panel.tsx:155` | Tarjeta discontinua: icono, título, frase y acción opcional |
| `Aviso` | `aviso.tsx` | Cuaderno `Aviso` + Licencias | `tono` info/aviso/error/ok; en oscuro `bg-*-500/10` |
| `Confirmar` | `confirmar.tsx` | Cuentas `ConfirmarPalabra` + Salidas `trip-delete-button` | Tres formas: `ConfirmarEnLinea` (dos toques), `ConfirmarDialogo` (masivo) y `palabra="BORRAR"` (sin vuelta atrás) **[D12]** |
| `BarraAcciones` | `barra-acciones.tsx` | Correos `lista.tsx:422` + Educamos | Fija abajo, área segura, `pr-14` por el botón de Tareas, recuentos dentro de los botones |
| `Progreso` | `progreso.tsx` | Tableros + Correos | Barra azul que pasa a esmeralda al 100 %; texto `x/y` opcional |
| `Interruptor` | `interruptor.tsx` | Puntualidad `Interruptor` | `role="switch"`, 44 px de zona táctil |
| `Copiable` | `copiable.tsx` | Mover `components/alumnado/copiable.tsx` | Dejar reexport en el sitio viejo hasta la fase 3 |
| `Rotulo` | `rotulo.tsx` | Evaluaciones `ui.tsx:63` | `text-xs font-semibold uppercase tracking-wider text-zinc-500` |
| `Avatar` | `avatar.tsx` | Tableros `comun.tsx:171` | Iniciales con color por hash; `Avatares` apilados |
| `TituloPagina` | `titulo-pagina.tsx` | Nouvinguts `lista.tsx:93` | h1 + frase + acciones a la derecha **[D04]** |
| `CabeceraModulo`, `PaginaModulo` | `cabecera-modulo.tsx` | Cabecera estándar + Evaluaciones | La cabecera común y el contenedor con `ancho: 'estrecho' \| 'normal' \| 'ancho' \| 'completo'` **[D03][D05]**. Se crean aquí; se aplican en la fase 2 |
| `PaginaFamilias` | `pagina-familias.tsx` | Licencias/Salidas públicas | Logo, título, columna `max-w-xl`, fondo decorativo opcional **[D13][D14]** |

Lo que **no** se sube a `ui/` (un solo módulo lo usa): la línea de pasos de Nouvinguts, la rejilla
de horario, el lienzo de Tableros. Regla: se sube cuando lo necesite un segundo módulo.

Comprobar: `pnpm typecheck && pnpm lint`.

### 4. Escaparate en `/gestion/diseno`

- Ruta `src/app/gestion/diseno/page.tsx` + `layout.tsx` con el guard de `ajustes` (TIC/dirección).
- Una sección por pieza: nombre, para qué, todas sus variantes y tamaños, la línea de `import`
  copiable y un ejemplo de uso. Arriba, un conmutador claro/oscuro local para revisarlas.
- Datos inventados, nunca de Neon (la página no consulta la BBDD).
- No va en el escritorio para todo el mundo: enlace desde Ajustes.
- Comprobar: se abre en dev, en claro y en oscuro, a 1180 px y a 390 px sin desplazamiento lateral.

### 5. La guía `docs/diseno.md` (permanente)

Corta (2-3 pantallas), en este orden:
1. **De dónde sale cada pieza**: tabla «necesito… → uso…» con el import.
2. **Las reglas**: las del artefacto (sección «Cómo quedarían las reglas») con las decisiones finales.
3. **Excepciones permitidas** **[D15]** y qué pueden tocar.
4. **Lo que no se hace** (lista negra: `confirm()`, `BOTON_*` locales, `text-[10px]`, hover-only…).
5. **Antes de dar una pantalla por hecha** (checklist: claro/oscuro, 390 px y 1180 px, teclado,
   `loading.tsx`, estado vacío, guardia en verde).

Enlazarla desde: `AGENTS.md` (lista de «Cómo trabajar»), `docs/04-convenciones-tecnicas.md` §UI
(sustituir los puntos de UI que queden viejos por un resumen y el enlace) y `docs/plataforma.md`
(«Cómo se organiza esta documentación»).

### 6. La guardia

- `scripts/guardia-diseno.ts` + `"diseno:guardia": "tsx scripts/guardia-diseno.ts"` en `package.json`.
- Recorre `src/**/*.tsx` y cuenta por fichero: `confirm(`, `prompt(`, `const (BOTON|ESTILO_BOTON|ESTILO_CAMPO|CAMPO|BTN_)`,
  `text-[9px]`/`text-[10px]`, `opacity-0 group-hover:opacity-100`.
- Las cuentas de hoy van a `scripts/guardia-diseno.excepciones.json`; el script falla si un
  fichero **sube** su cuenta o aparece uno nuevo. La fase 3 las va bajando a cero y borrando.
- Añadirla al «Definition of done» de `docs/04-convenciones-tecnicas.md` para tareas de UI.

## Hecho cuando

- [ ] Tokens cambiados y los 3 `Button` existentes revisados en claro y oscuro.
- [ ] Las piezas del paso 3 existen, con su comentario de uso, y compilan.
- [ ] `/gestion/diseno` las enseña todas, en claro y oscuro, sin datos reales.
- [ ] `docs/diseno.md` escrita y enlazada desde `AGENTS.md`, `04-convenciones` y `plataforma.md`.
- [ ] `pnpm diseno:guardia` en verde con la lista de excepciones de hoy.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` en verde.
- [ ] Fila de la fase 1 en `plans/diseno-temporal/README.md` → HECHO.

## Paradas

- Si cambiar `--primary` altera algo más que los 3 `Button` y el foco (`grep -rn "bg-primary\|text-primary\|ring-ring" src`), para y enumera qué cambia.
- Si @base-ui no deja componer `Segmentado` como enlaces sin anidar elementos interactivos, para y propone la alternativa.
- No tocar pantallas de módulos en esta fase (eso es la 3).
