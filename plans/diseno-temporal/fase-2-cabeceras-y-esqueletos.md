# Fase 2 · Cabeceras, anchos y esqueletos

> TEMPORAL: se borra con `plans/diseno-temporal/`.
> **Estado: BORRADOR.** Depende de la fase 1 (las piezas `CabeceraModulo`, `PaginaModulo`,
> `TituloPagina`, `Segmentado`, `SkeletonPaginaModulo` y `PaginaFamilias` ya existen).

## Para qué

Que al pasar de un módulo a otro **la app sea la misma**: misma cabecera, mismos tres anchos, mismo
esqueleto mientras carga. Es el cambio que más se nota y el que menos riesgo tiene, porque solo
toca los `layout.tsx`, las cabeceras copiadas en páginas y los `loading.tsx`.

## Decisiones que la afectan

D01 (color de identidad en el icono) · D03 (qué lleva la cabecera) · D04 (título de página) ·
D05 (anchos) · D09 (secciones como segmentado) · D13/D14 (pantallas de familias y su fondo).

## Pasos

### 1. Registro de módulos: un solo sitio para nombre, icono, color y ruta

Hoy el nombre y el icono de cada módulo están escritos a mano en el escritorio
(`app/gestion/page.tsx`), en cada `layout.tsx` y en la portada. Crear `src/components/modulos.tsx`
(sin dependencias de servidor) con, por módulo: `clave` (la de `permissions.ts`), `nombre`,
`descripcion` (la del escritorio), `ruta`, `icono` (lucide) y `color` de identidad **[D01]**.

Propuesta de colores de identidad (se valida con David; nunca esmeralda, ámbar ni rojo, que son de
estado): Licencias azul · Salidas cielo (deja de ser ámbar) · Registro ABC teal · Puntualidad naranja ·
Horarios y Mi horario índigo · Evaluaciones violeta · Tableros fucsia · Nouvinguts y Dispositivos cian ·
Números y Alumnado azul · el resto (configuración) zinc.

El escritorio, la portada y `CabeceraModulo` leen de aquí. Comprobar: el escritorio se ve igual.

### 2. La cabecera común en todos los módulos

- Los **15 layouts con cabecera** (`abc`, `alumnado`, `bancolibros`, `calendarios`, `cuentas`,
  `dispositivos`, `evaluaciones`, `horarios`, `nouvinguts`, `numeros`, `oratorios`, `puntualidad`,
  `salidas`, `tableros`, `tareas`) cambian su `<header>` por `<CabeceraModulo modulo="…">`. Los
  guards (`getSessionUser`, `canAccess`, `redirect`) se quedan tal cual.
- Los **7 layouts sin cabecera** (`licencias`, `educamos`, `profes`, `usuarios`, `ajustes`,
  `cuaderno`, `autoasm`) la ganan, y se borran las copias de las páginas: Licencias tiene 15,
  Educamos 3, y una cada uno el resto. Mi horario (`app/(public)/mi-horario/page.tsx`) también.
- Acción principal en la cabecera **[D03]**, solo donde ya existe hoy o es evidente: Evaluaciones
  «Nueva», Salidas «Nueva salida», Horarios «Importar» (quien edita), Puntualidad y ABC «Registrar»,
  Nouvinguts «Apuntar», Tareas «Apuntar».
- Secciones del módulo **[D03][D09]**: van como `Segmentado` de enlaces bajo el título (con
  `aria-current`), no en la barra: ABC (Panel · Registros · Alumnado), Puntualidad (Panel · Retrasos ·
  Consecuencias · Asignaturas), Educamos (Resumen · Sincronizar · Historial), Evaluaciones
  (Evaluaciones · Actividades · Comparar), Nouvinguts (Lista · Proceso), Banco de libros
  (Panel · Sincronizar). Licencias mantiene su página índice.
- El escritorio usa la misma pieza en su modo «escritorio» (logo, nombre, tema, Salir).
- Los formularios rápidos del claustro (`/registro-abc`, `/puntualidad`) usan la cabecera común con
  ancho estrecho; su barra de guardar pasa a `BarraAcciones` (la del ABC deja de ocupar todo el
  ancho del iPad).

### 3. Tres anchos [D05]

| Ancho | Para | Páginas |
|---|---|---|
| estrecho (`max-w-3xl`) | formularios, ajustes, asistentes | ajustes, usuarios, educamos (todo), formularios ABC y Puntualidad, salidas nueva/editar, evaluaciones nueva, horarios importar |
| normal (`max-w-5xl`) | listas y fichas | escritorio, licencias (índice y la mayoría), salidas, evaluaciones, profes, banco de libros, tareas, cuaderno, tableros (inicio), puntualidad y abc (panel) |
| ancho (`max-w-7xl`) | tablas, rejillas y paneles de datos | alumnado, números, nouvinguts, dispositivos, cuentas, horarios, oratorios, calendarios, autoasm, licencias (pedidos, envíos, faltan) |
| completo | lienzos | un tablero abierto (`/gestion/tableros/[id]`) |

La cabecera usa el ancho mayor del módulo para que no salte al navegar dentro de él.

### 4. Título de página [D04]

Toda página de `/gestion` abre con `TituloPagina` (h1 + frase + acciones), incluidas las que hoy no
tienen: Alumnado, Oratorios, Evaluaciones, Tareas, Calendarios, Salidas (lista). Si **[D04] = C**,
el h1 va con `sr-only`.

### 5. Un `loading.tsx` por ruta

- Toda ruta de `/gestion` con `page.tsx` tiene `loading.tsx` con `SkeletonPaginaModulo` y el mismo
  ancho que su página. Hoy no tienen: `ajustes`, `autoasm`, `calendarios`, `horarios`, `sin-acceso`,
  `(public)/mi-horario` y `(public)/evaluaciones` (heredan el del escritorio o el de la portada).
- Los 12 `loading.tsx` hechos a mano con `animate-pulse` pasan a `ui/skeleton`: `(public)/puntualidad`,
  `alumnado`, `cuentas`, `dispositivos`, `nouvinguts` y `nouvinguts/[id]`, `numeros`, `oratorios`,
  `puntualidad`, `tableros` y `tableros/[id]`, `tareas`.
- Comprobar: `find src/app -name page.tsx | wc -l` frente a `find src/app -name loading.tsx | wc -l`
  (las rutas hijas pueden heredar el de su sección si la forma coincide).

### 6. Pantallas de familias [D13][D14]

Portada, `/licencias`, `/salidas`, `/evaluaciones/[token]`, login y sin-acceso pasan a
`PaginaFamilias`: mismo logo, mismo radio (`rounded-2xl`, fuera el `rounded-3xl` de Salidas), sin
emoji en el h1 **[D11]**, fondo decorativo solo donde diga **[D14]**.

## Hecho cuando

- [ ] Las 22 secciones de `/gestion` y Mi horario usan `CabeceraModulo`; no queda ningún `<header>` copiado (`grep -rn "<header" src/app src/components`).
- [ ] Ninguna página cambia de ancho al navegar dentro de su módulo.
- [ ] Toda página tiene h1.
- [ ] Toda ruta tiene `loading.tsx` con `ui/skeleton`.
- [ ] Capturas en claro y oscuro, a 390 px y 1180 px, de una página por módulo, revisadas.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm diseno:guardia` en verde.
- [ ] Fila de la fase 2 en el `README.md` de esta carpeta → HECHO.

## Paradas

- Si un layout mezcla la cabecera con lógica (avisos por rol, como el de tutores en Puntualidad),
  esa lógica se queda como hijo de `CabeceraModulo`, no se pierde. Si no cabe, para y pregunta.
- No se tocan rutas ni guards. Si hace falta mover una página de sitio, para.
