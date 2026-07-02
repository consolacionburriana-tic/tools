# PWA en iPad · plan y checklist

Pieza transversal pequeña pero **priorizada por David**: que la app instalada en el iPad (y en
móviles del profesorado) funcione bien para *todos* los módulos, no solo para el Registro ABC,
que fue para quien se montó.

---

## Estado: plan técnico listo ✅ · parcialmente implementado 🟡

Lo que ya hay (verificado en el repo): `public/manifest.json` global (name "Tools Consolación",
`display: standalone`, `orientation: portrait`, iconos 192/512 maskable) enlazado desde
`src/app/layout.tsx`. Los haptics ya funcionan en PWA de iOS ≥17.4.

Problemas conocidos:

- `start_url` es `/` — la portada **pública** de Licencias. El profesorado que instala la app
  para trabajar aterriza en la página de familias, no en la gestión.
- `theme_color` es teal (`#0d9488`) pero la marca del colegio usa **acento azul** (ver
  Licencias) — incoherencia visual al abrir la app instalada.
- No hay service worker: sin él, iOS muestra pantalla blanca de red si abres la app sin
  conexión (no aspiramos a offline real, pero sí a un fallback digno).

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
- [ ] `start_url: '/gestion'` + revisar `scope`
- [ ] Colores de marca en manifest y `apple-touch-icon`
- [ ] Iconos revisados (que el maskable no recorte el logo)

### Fase 2 · Service worker y fallback
- [ ] SW mínimo con precache del shell + página `/offline`
- [ ] Registro del SW y prueba de actualización (que un deploy no deje la app zombie)

### Fase 3 · QA de campo
- [ ] Checklist en iPad real (instalar, abrir sin red, formulario ABC completo, panel gestión)
- [ ] Extender borrador-en-localStorage a los formularios largos nuevos que vayan llegando
