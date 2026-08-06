# PWA en iPad · plan y checklist

Pieza transversal pequeña pero **priorizada por David**: que la app instalada en el iPad (y en
móviles del profesorado) funcione bien para *todos* los módulos, no solo para el Registro ABC,
que fue para quien se montó.

---

## Estado: plan técnico listo ✅ · Fase 1 hecha, Fase 2-3 pendientes 🟡

Lo que ya hay (verificado en el repo): `public/manifest.json` global (name "Tools Consolación",
`display: standalone`, `orientation: portrait`, `start_url: '/gestion'`, `scope: '/'`,
`theme_color: '#2563eb'` azul de marca, iconos 192/512 maskable) enlazado desde
`src/app/layout.tsx` (mismo `themeColor` en el `viewport`). Los haptics ya funcionan en PWA de
iOS ≥17.4.

Problemas conocidos:

- **Iconos placeholder, no el logo real**: `public/icons/icon-192.png` (un badge con las
  iniciales "TC") e `icon-512.png` (una forma abstracta) no son el logo del colegio, y además
  llegan al borde sin margen de seguridad para el recorte maskable. Regenerarlos hace falta un
  asset cuadrado del emblema — `public/logobur.png` es un lockup horizontal con texto, no sirve
  tal cual sin quedar deformado o mal recortado. **Pendiente: que David pase un icono cuadrado
  del emblema (o encargue uno)**; mientras tanto el manifest sigue apuntando a los placeholders.
- No hay service worker: sin él, iOS muestra pantalla blanca de red si abres la app sin
  conexión (no aspiramos a offline real, pero sí a un fallback digno). Fase 2, sin empezar.

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
  van justas): precache del shell + página `/offline` de fallback en navegación fallida.
  Registrado desde el layout raíz.
- Meta iOS: `apple-touch-icon` explícito y `viewport-fit=cover` (los formularios ya usan
  `safe-area-inset`, esto lo completa).
- QA en iPad real: instalación, apertura fría, haptics, teclado sobre inputs con botón sticky.

## Fases

### Fase 1 · Manifest y marca
- [x] `start_url: '/gestion'` + `scope: '/'` (verificado: redirige a login sin sesión, sin bucle)
- [x] Colores de marca en manifest y viewport (`#2563eb` azul, antes teal `#0d9488`)
- [~] Iconos revisados — son placeholders sin margen maskable, no el logo real; código listo
      para apuntar a los ficheros correctos en cuanto exista un asset cuadrado del emblema

### Fase 2 · Service worker y fallback
- [ ] SW mínimo con precache del shell + página `/offline`
- [ ] Registro del SW y prueba de actualización (que un deploy no deje la app zombie)

### Fase 3 · QA de campo
- [ ] Checklist en iPad real (instalar, abrir sin red, formulario ABC completo, panel gestión)
- [ ] Extender borrador-en-localStorage a los formularios largos nuevos que vayan llegando
