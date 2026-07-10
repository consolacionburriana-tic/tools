# Escritorio de administración (bienvenida) · plan y checklist

La "portada interna" que ve cualquier persona del colegio al entrar en la zona de gestión:
desde ahí elige módulo. Es transversal: cada módulo nuevo añade su tarjeta aquí. La parte
**pública** de la web no cambia por ahora (sigue centrada en Licencias).

---

## Estado: implementado ✅ (2026-07-10)

Se construye dentro del **hito 2 del roadmap** (auth), porque el escritorio es justo "lo que
ves después del login" y depende de la matriz rol→módulos.

## Objetivo funcional

- Tras el login, `/gestion` deja de ser el dashboard de Licencias y pasa a ser el **escritorio**:
  saludo, y una **tarjeta por módulo al que tu rol tiene acceso** (los demás no aparecen).
- Cada tarjeta: icono + nombre + un dato rápido de estado (p. ej. Licencias: "82% pedidos ·
  campaña abierta"; Salidas: "2 salidas activas, 14 justificantes pendientes"; Educamos:
  "último sync hace 3 días · 534 alumnos activos") + acceso.
- Franja de **avisos** arriba si algo requiere acción (justificantes por validar, campaña por
  cerrar…). Cada módulo decide qué avisa; el escritorio solo los pinta.
- Acceso directo a "Usuarios" (solo tic/supertic) y a "BBDD central Educamos" (transversal).
- Diseño coherente con la portada pública actual (logo, acento azul de marca), usable en iPad.

## Decisiones cerradas

- La parte pública (`/`) se queda como está: Licencias + acceso a administración.
- El dashboard actual de Licencias **se mueve un nivel adentro** (`/gestion/licencias`), y
  `/gestion` pasa a ser el escritorio. Las rutas ya modulares (`/gestion/faltan`, `/gestion/packs`…)
  se recolocan bajo `/gestion/licencias/*` en la migración del hito 3.
- Las tarjetas se filtran con la misma matriz `canAccess(role, modulo)` de `01-auth-roles.md`;
  no hay configuración propia del escritorio.

## Plan técnico

- `src/app/gestion/page.tsx` = escritorio (server component). Lee la sesión, filtra módulos con
  `ROLE_MODULES`, y pide a cada módulo su "resumen de tarjeta".
- Contrato mínimo por módulo en `src/lib/modules.ts`: registro de módulos
  (`{ id, nombre, icono, href, getCardStats?(), getAlerts?() }`). Los `get*` son funciones
  server-side opcionales que cada módulo implementa cuando quiera; sin ellas la tarjeta sale
  sin stats. Así añadir un módulo al escritorio = una entrada en el registro.
- Sin tablas nuevas: todo se deriva de las tablas de cada módulo en el momento.
- Mientras auth no esté (si el escritorio se adelanta): se muestra todo tras el login simple
  actual de Licencias, y se enchufa `canAccess` cuando llegue el hito 2.

## Fases

### Fase 1 · Escritorio básico
- [x] Registro de módulos (matriz rol→módulos en `src/lib/permissions.ts`; tarjetas en `/gestion`)
- [x] `/gestion` = tarjetas por rol con diseño de marca + 'próximamente' (salidas, banco, evaluaciones)
- [x] Dashboard de Licencias movido a `/gestion/licencias` (las stats de licencias viven dentro del módulo)

### Fase 2 · Stats y avisos
- [x] Stats por rol en el escritorio: alumnado y profesorado activos + fecha del último sync (educamos), nº pedidos (licencias), nº registros (abc)
- [ ] Franja de avisos con `getAlerts()` (primer caso real: justificantes pendientes de Salidas)
- [ ] Stats del resto de módulos según se vayan implementando (cada ficha lo añade a su checklist)
