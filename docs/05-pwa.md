# PWA en iPad · plan y checklist

Pieza transversal pequeña pero **priorizada por David**: que la app instalada en el iPad (y en
móviles del profesorado) funcione bien para *todos* los módulos, no solo para el Registro ABC,
que fue para quien se montó.

---

## Estado: Fases 1 y 2 hechas ✅ · falta la QA en iPad real de David 🟡

Lo que hay hoy en el repo:

- **`public/manifest.json`**: name "Tools Consolación", `display: standalone` (+`display_override`),
  `orientation: portrait`, `start_url: '/gestion'`, `scope: '/'`, `theme_color: '#2563eb'`,
  iconos `any` y `maskable` de 192 y 512, y **atajos** (pulsación larga en el icono):
  "Registrar retraso", "Registrar conducta (ABC)" y "Escritorio".
- **Iconos con el emblema real del colegio** (ya no son placeholders): `public/icons/`
  (`icon-192`, `icon-512`, `icon-maskable-192`, `icon-maskable-512`, `apple-touch-icon-180`)
  más el favicon y el apple-icon de `src/app/`. Se generan con
  `python3 scripts/iconos-pwa.py` (ver "El icono" más abajo).
- **Barra de estado que se funde con la app**: el `themeColor` del `viewport` va por esquema
  de color (blanco en claro, `#09090b` en oscuro), así que en standalone no queda una franja
  azul sobre una cabecera blanca. El azul de marca sigue en el manifest, que es lo que se ve
  al instalar y en el conmutador de apps.
- **Service worker** propio (`public/sw.js`) con la página de cortesía `/offline.html`, y
  **cinta de "sin conexión"** en toda la app (`src/components/pwa/registro-sw.tsx`).
- Los haptics ya funcionan en PWA de iOS ≥17.4.

## El icono (decidido y hecho, 2026-09-02)

El emblema del colegio **no existía suelto**: `public/logobur.png` es el lockup horizontal
(emblema + "Consolación" + bajada). Y no se puede recortar sin más porque la palabra es
caligráfica: al etiquetar los componentes conexos de tinta, **"Consolación" entera es un
único trazo**, así que la C no se puede separar por color ni por componente.

Lo que se hace en `scripts/iconos-pwa.py` (herramienta de un solo uso, con Pillow):

1. Componentes conexos del PNG → los trazos del emblema (la marca con la cruz) son
   componentes propios; el lettering es uno gigante.
2. De ese lettering se toman solo los píxeles con `x <= 145`, que es donde el trazo de la
   **C** termina de forma natural (probado a 145/152/158/165; 145 no deja canto plano).
3. Emblema = marca + C, centrado sobre fondo claro con un velo azulado
   (`#ffffff → #E9F3FA`), **sin recolorear nada**: el azul `#084174` y el celeste `#40B2D6`
   son los oficiales.

Por qué fondo claro y no azul de marca: para pintar el emblema sobre azul habría que
recolorear dos tintas antialiaseadas sobre blanco, y eso deja halos. Con fondo claro el
emblema va tal cual salió de imprenta.

Resolución: el emblema mide 129x176 px en el origen, así que el icono de **192 sale casi
1:1 (nítido)** y el de 512 se amplía 1,7x (bordes algo suaves; ese tamaño solo se usa en la
instalación y el splash). **Si algún día aparece el logo vectorial (SVG/AI), es cambiar
`ORIGEN` en el script y volver a lanzarlo** — todo lo demás (tamaños, márgenes, maskable)
ya está resuelto.

Márgenes: `any` 11 % (con esquinas redondeadas propias), `maskable` 21 % (a sangre, para que
el recorte circular de Android no coma nada), apple-touch 11 % y opaco (iOS no admite
transparencia y ya redondea él).

## Decisiones cerradas

- **Una única PWA** para toda la plataforma (no una por módulo): el escritorio de
  administración (`03-escritorio-admin.md`) es justo la "home de app" natural.
- **Offline mínimo, no offline real**: página de fallback "sin conexión" cacheada. Los
  formularios ya protegen el trabajo a medias con borrador en `localStorage` (patrón del ABC);
  extender ese patrón donde duela perder datos, no montar sync offline.

## Plan técnico

- `start_url: '/gestion'` (el escritorio; si no hay sesión, el login redirige y vuelve).
  La parte pública de familias no necesita instalarse — llega por enlace.
- `theme_color`/`background_color` alineados con la marca (azul, y variante dark si aplica).
- Service worker mínimo **hecho a mano** (sin dependencia de librería PWA, que con App Router
  van justas): precache de la página `/offline.html` de fallback en navegación fallida.
  Registrado desde el layout raíz (`RegistroSW`).
- Meta iOS: `apple-touch-icon` explícito y `viewport-fit=cover` (los formularios ya usan
  `safe-area-inset`, esto lo completa).
- QA en iPad real: instalación, apertura fría, haptics, teclado sobre inputs con botón sticky.

## Fases

### Fase 1 · Manifest y marca — ✅
- [x] `start_url: '/gestion'` + `scope: '/'` (verificado: redirige a login sin sesión, sin bucle)
- [x] Colores de marca en manifest y viewport (`#2563eb` azul, antes teal `#0d9488`)
- [x] **Iconos con el emblema real** en los cinco tamaños + favicon, generados con
      `scripts/iconos-pwa.py`, con margen de seguridad maskable y variante opaca para iOS
- [x] `apple-touch-icon` explícito de 180 en el `<head>` (iOS ignora el manifest para esto)
- [x] Barra de estado por esquema de color (claro/oscuro) para que se funda con la cabecera
- [x] Atajos del manifest: Puntualidad, Registro ABC y Escritorio

### Fase 2 · Service worker y fallback — ✅
- [x] SW mínimo (`public/sw.js`): precache de `/offline.html`, logo, icono y manifest;
      estáticos con hash en caché-primero; **HTML de páginas y `/api` NUNCA se cachean**
      (los iPads son compartidos: cachear una pantalla con datos de alumnado sería servírsela
      a la siguiente persona)
- [x] Página `/offline.html` en HTML plano con estilos **en línea**, para que no dependa del
      CSS con hash de Next (si no estuviera en caché, saldría sin estilos justo el día que
      hace falta). Verificada en claro y en oscuro
- [x] Registro del SW tras `load` + limpieza de cachés de versiones anteriores en `activate`
      con `skipWaiting`/`clients.claim` (un deploy no deja la app zombie)
- [x] Cinta de aviso "sin conexión" en toda la app (eventos `online`/`offline`), porque en
      algunas aulas el wifi baila y si no, el profe le da a guardar y no entiende qué pasa

### Fase 3 · QA de campo — 🟡 (solo lo puede hacer David, con un iPad)
- [ ] Checklist en iPad real: instalar desde Safari, comprobar el icono en la pantalla de
      inicio, abrir sin red (debe salir `/offline.html`), formulario de Puntualidad y de ABC
      completos, panel de gestión, y que un deploy nuevo no deje la app con la versión vieja
- [ ] Extender borrador-en-localStorage a los formularios largos nuevos que vayan llegando
      (hoy lo tiene el ABC; Puntualidad no lo necesita: se rellena en 15 segundos)
