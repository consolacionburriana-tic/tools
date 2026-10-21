# Auditoría de diseño · 20-oct-2026

> TEMPORAL: se borra con `plans/diseno-temporal/`. Es el contexto de las fases; la versión con
> capturas está en el artefacto (ver `README.md`).

Se revisaron los 24 módulos (≈54.000 líneas en `src/components` y ≈8.000 en `src/app`), con seis
auditorías en paralelo leyendo el código y capturas reales de 13 pantallas pintadas con los
componentes del repo y datos inventados (sin tocar Neon).

## 1. La foto en cifras

| Qué | Cuánto |
|---|---|
| `<button>` pintados a mano · `<Button>` de `ui/` | 760 · 4 |
| Imports de `ui/badge`, `ui/table`, `ui/select` | 0 · 0 · 0 |
| Cabeceras copiadas en `layout.tsx` · copias dentro de páginas de Licencias | 15 · 15 |
| Anchos de página distintos | 7 (`2xl`, `3xl`, `4xl`, `5xl`, `6xl`, `7xl`, `1800px`) |
| `confirm()` · `prompt()` del navegador | 48 · 6 |
| `text-zinc-400` (contraste ≈2,6:1 sobre blanco) | 859 |
| Tamaños de letra a mano `text-[Npx]` | 343 (200 de 11 px, 99 de 10 px) |
| `outline-none` | 98 (muchos sin foco de sustitución) |
| `loading.tsx` · páginas | 27 · 84 |
| Radios usados | `rounded-lg` 444 · `-xl` 544 · `-2xl` 347 · `-full` 335 · `-md` 85 · `-3xl` 11 |

**Por qué nadie usa `ui/button`:** sus tamaños son de escritorio (`h-8`, 32 px) y su variante por
defecto es `bg-primary`, que en los tokens de shadcn es casi negro. La marca es azul y el iPad pide
44 px, así que cada módulo se pintó el suyo.

**Ojo con los radios:** `globals.css` fija `--radius: .625rem`, así que en esta app `rounded-md` = 8 px,
`rounded-lg` = 10 px, `rounded-xl` = 14 px y `rounded-2xl` = 18 px (no los valores por defecto de
Tailwind).

## 2. Lo que ya es común sin estar escrito

- Fondo `bg-zinc-50 dark:bg-zinc-950`; neutros solo zinc.
- Tarjeta `rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900`
  (la misma cadena que `SkeletonCard`, `TARJETA` de Cuentas y `Tarjeta` del Cuaderno).
- Acción principal `bg-blue-600 hover:bg-blue-700` en la mayoría.
- Estados: esmeralda = sí/hecho, ámbar = falta algo, rojo = no/error.
- Cabecera de módulo: `sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur
  dark:border-zinc-800 dark:bg-zinc-900/95` + fila `h-14` + botón «Escritorio» con `ChevronLeft`.
- Modo oscuro completo, iconos lucide, Geist, sonner, `haptic.*`, `.anim-stagger`, márgenes seguros.

## 3. Mini sistemas propios (lo que hay que absorber)

| Módulo | Fichero | Qué define |
|---|---|---|
| Tableros | `components/tableros/comun.tsx:280-287` | `ESTILO_CAMPO`, `BOTON_PRIMARIO`, `BOTON_SECUNDARIO`, chips, avatar |
| Tareas | `components/tareas/comun.tsx:138` | `ESTILO_CAMPO` (copia exacta de Tableros), `EstadoSelect`, `BotonCopiar` |
| Nouvinguts | `components/nouvinguts/comun.tsx:26` | `ESTILO_CAMPO` h-11, `Boton` local, `LineaPasos`, `ChipResponsable` |
| Dispositivos | `components/dispositivos/comun.tsx:20-27` | `ESTILO_CAMPO`, `ESTILO_BOTON`, `ESTILO_BOTON_PRINCIPAL` (h-11) |
| Correos y grupos | `components/cuentas/comun.tsx:43-240` | `CAMPO`, `BOTON`, `BOTON_PRIMARIO`, `TARJETA`, `ChipEstado`, `ConfirmarPalabra`, `Progreso` |
| Evaluaciones | `components/evaluaciones/ui.tsx` | `PANEL`, `TARJETA`, `CAMPO*`, `BTN_*`, `Rotulo`, `Segmentado` (con su porqué escrito) |
| Oratorios | `components/oratorios/comun.tsx:340-372` | `Accion`, `Pastilla`, `ChipVista`, `Avisos`, `SelectChip` |
| Puntualidad | `components/puntualidad/ui.tsx` | `Seccion`, `Chip`, `ClaseChip`, `HistorialPill`, `Interruptor` |
| Cuaderno | `components/cuaderno/cuaderno-panel.tsx:121-146` | `Aviso`, `Tarjeta`, dos `BotonMini` distintos |

## 4. Piezas repetidas y de dónde copiar la mejor

| Pieza | Copias hoy | La mejor de partida |
|---|---|---|
| Botón | 4 sistemas + ~15 cadenas sueltas | Dispositivos `ESTILO_BOTON*` (h-11, rounded-xl) |
| Campo | 6+ recetas | Nouvinguts/Dispositivos `ESTILO_CAMPO` (h-11, foco azul) |
| Segmentado | 6+ | Números `Segmentos` (con `role=group` y `aria-pressed`) a la altura de Dispositivos |
| Interruptor | 5 | Puntualidad `Interruptor` (`role=switch`) |
| Pastilla de estado | 6+ (`ChipEstado`, `ChipVista`, `EstadoBadge`, `Badge` local…) | Cuentas `ChipEstado` + mapa de tonos de Evaluaciones |
| Tarjeta de cifra | 7 | Escritorio `Stat` + punto y barra de Números |
| Estado vacío | 6+ | Puntualidad `dashboard-panel.tsx:155-169` |
| Aviso (callout) | muchos | Cuaderno `Aviso` + callouts de Licencias (oscuro `500/10`) |
| Confirmación | `confirm()` ×48, inline ×4, diálogo ×3 | Salidas `trip-delete-button` (en línea) · Cuentas `ConfirmarPalabra` (diálogo) |
| Barra inferior de acciones | 5 | Correos `lista.tsx:422-450` (con `pr-14` para el botón de Tareas) |
| Progreso | 4+ | Tableros (azul → esmeralda al 100 %) · Cuaderno para colas de servidor |
| Hoja inferior (sheet) | 3 hechas a mano | Horarios `navegador.tsx:452` (área segura) → como variante de `ui/dialog` |
| Copiar | `components/alumnado/copiable.tsx` (ya lo importa Números) | mover a `ui/` |
| Esqueleto de carga | 7 `loading.tsx` con `animate-pulse` propio | `ui/skeleton` (respeta movimiento reducido y anuncia `role=status`) |
| Rejilla de horario | 3 (Navegador, Planificar, Mis huecos) | Navegador de Horarios |
| Paleta de gráficos | colores a mano en ABC y Puntualidad | `--eval-*` de `globals.css` (validada para daltonismo) |

## 5. Módulo a módulo

Nota de diseño (coherencia, cuidado y comodidad en iPad; no utilidad). Familia = la del artefacto.

| Módulo | Nota | Familia | Lo que vale la pena llevarse | Lo que hay que corregir |
|---|---|---|---|---|
| Números | 9 | D app táctil | h1 grande, `Segmentos`, tabla con cabecera y primera columna fijas, cifras con barra | 24 tamaños a mano, diálogos sin foco atrapado, esqueleto con 7 columnas en vez de 6 |
| Portada | 8,5 | A familias | Tarjeta de trámite teñida, logo, calma | Salidas ámbar (es el color de aviso) |
| Escritorio | 8,5 | B clásico | `ModuleCard`, `Stat`, `Rotulo`, `NavPending` | Su cabecera no se parece a ninguna; insignia de 10 px |
| Alumnado | 8,5 | D | `Copiable`, chips de 8 tonos, `Celda` de un toque, `BarraConfirmacion` | Sin h1; pestañas de 28 px sin ARIA; 87 `zinc-400` |
| Nouvinguts | 8,5 | D | Línea de pasos, controles h-10/h-11, pestañas subrayadas | Tres botones rellenos (azul, verde, negro); 3 `confirm()` |
| Puntualidad | 8,5 | C color | Buscador combobox, chips de 44 px, barra fija con resumen, mejor estado vacío | Navegación sin activo; 2 `confirm()`; esqueletos propios |
| Tableros | 8 | F lienzo | Lienzo por tablero, `Avatar`, chips con icono, detalle en diálogo | Acciones solo con hover; 7 `confirm()` + 2 `prompt()`; controles de 20-28 px |
| Evaluaciones | 8 | E editorial | Mini sistema escrito, paleta de datos validada, «Deshacer» | Cinco colores de principal; sin h1; 79 `zinc-400`; 8 colores del catálogo bajo 4,5:1 con texto blanco |
| Horarios | 8 | C | Paleta oklch por materia, «ahora» resaltado, hoja con área segura | Cuatro estilos de selección en una pantalla; sin `loading.tsx` |
| Dispositivos | 8 | D | Escala h-11, ámbar discontinuo = falta dato, confirmación en línea, 0 `confirm()` | Tres estilos de activo en una pantalla |
| Salidas | 8 | A/B | Tarjeta con barra de progreso, borrar en dos pasos | Sin h1 en la lista; acciones de fila de 28 px |
| Correos y grupos | 8 | D | `ConfirmarPalabra`, barra inferior con cuentas, mapa de estados | Casillas de 16 px, segmentado h-8 |
| AUTOASM | 8 | G producto | Todo a 44 px, pasos numerados, tabla de datos de verdad | Sin cabecera común; 5 `confirm()`; cabecera de tabla que no se queda fija |
| Ajustes | 8 | E | Mejor foco de campo (violeta) | Sin `loading.tsx` (sale el del escritorio) |
| BBDD Educamos | 7,5 | B | Barra fija «Aplicar» con recuentos | Tres cabeceras distintas en el mismo módulo |
| Registro ABC | 7,5 | C | Chips de 48 px, barra de guardar fija, bloque opcional | Enlace roto (ver arreglos), navegación sin activo, deslizador sin teclado |
| Licencias | 7 (familias 9, gestión 6) | A/B | El asistente de familias es la referencia | 15 cabeceras copiadas, 4 estilos de filtro, 20 `confirm/prompt`, tabla que se corta |
| Mi horario | 7 | C | Vista previa antes de escribir en Calendar | Borra N eventos de un toque sin confirmar; dos paletas de color |
| Profesorado | 7 | B | Reparto con barras de color | Objetivos de 16-24 px; quitar tutor sin confirmar ni deshacer |
| Banco de libros | 7 | B | Selector de clase, botones de estado del libro, ficha imprimible | Escrituras en bloque sin confirmar; lima e índigo que no usa nadie más |
| Cuaderno | 7 | B | Panel de cola con latido y bitácora | Controles de 24-28 px; pestañas que se salen en el móvil |
| Tareas | 6,5 | B | `EstadoSelect` (select nativo vestido de chip) | Sin h1; botón flotante al 60 %; objetivos de 24 px |
| Oratorios | 6,5 | C | `Accion`, `Pastilla`, deshacer en toasts, autoguardado | Significados solo en `title`, 8 `confirm()`, sin h1, el azul es también «confirmada» |
| Usuarios | 6,5 | B | Chips de rol | El más denso; `confirm()` nativo |
| Classrooms y calendarios | 6 | B | Selección roja cuando todo lo masivo es borrar; confirmar escribiendo | Sin título; dos segmentados iguales apilados; la barra tapa el botón de Tareas |

## 6. Accesibilidad e iPad (transversal)

- **Objetivos táctiles:** la mayoría de botones mide 28-36 px. Llegan a 44 px solo AUTOASM,
  Nouvinguts, Dispositivos y Cuentas.
- **Hover:** borrar y editar con `opacity-0 group-hover:opacity-100` en Tableros (3) y Tareas: invisibles en iPad.
- **Significado solo en `title`:** emojis de estado en Licencias (🧾 📤 💰) y Oratorios (⭐ 👍 🤏, 🔴, ×N).
- **ARIA:** casi ningún conmutador lleva `aria-pressed`/`aria-selected`; botones de solo icono sin nombre.
- **Foco:** 98 `outline-none`, muchos sin anillo de sustitución.
- **Contraste:** `zinc-400` para texto que dice algo; blanco sobre `amber-500` (2,2:1) en Cuaderno.
- **Dos botones flotantes** (Tareas, aviso de Tableros) que tapan barras inferiores donde no se deja hueco.

## 7. Lo que no se toca

La lógica de los módulos, las rutas y las APIs. La paleta de datos de Evaluaciones (se generaliza,
no se cambia). Las decisiones de producto de cada ficha de `docs/`.
