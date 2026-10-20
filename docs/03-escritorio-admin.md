# Escritorio de administración (bienvenida) · plan y checklist

La "portada interna" que ve cualquier persona del colegio al entrar en la zona de gestión:
desde ahí elige módulo. Es transversal: cada módulo nuevo añade su tarjeta aquí. La parte
**pública** de la web no cambia por ahora (sigue centrada en Licencias).

---

## Estado: implementado ✅ (2026-07-10) · reordenado por grupos el 2026-10-20

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

## Orden de la pantalla (rehecho el 20-oct-2026)

Con más de veinte herramientas, la lista de tarjetas de septiembre ya no se podía leer. David
pidió reordenarla, clasificarla y pensarla para **el iPad en horizontal**, que es como casi
siempre se usa. El escritorio pasa a seguir el patrón de los lanzadores de herramientas
internas: lo urgente arriba, lo diario en grande y el resto agrupado por tarea.

1. **Cabecera fija**: logo, nombre y rol, **Ver como familia** (abre `/?vista=familia`),
   tema y Salir. En móvil los botones se quedan en icono.
2. **Saludo y cifras**: fecha, «Buenos días, Nombre», y en una línea las cifras para quien
   tiene esos datos (alumnos, profes, «Educamos al 28 sept», pedidos, registros ABC). Al
   lado, un **buscador** de herramientas: `/` o ⌘K para enfocarlo, Intro abre la primera,
   Esc lo vacía. Ignora tildes y pone primero lo que coincide en el título.
3. **Ahora**: tarjetas de aviso solo cuando algo pide que alguien haga algo hoy (campaña de
   licencias en junio y septiembre, AUTOASM, tareas vencidas o para hoy, nouvinguts con
   pasos pendientes, alumnos sin informar de su iPad). Si no hay nada, la franja no sale.
4. **Tu día**: las herramientas del día a día en baldosas grandes (Mi horario, Tableros,
   Registrar conducta, Oratorios cuando está abierto al claustro). 2 columnas en móvil, 3 en
   iPad vertical, 4 en iPad horizontal y ordenador.
5. **El resto, en cinco grupos** con su color: Alumnado · Familias y cobros · Organización
   del centro · Tecnología · Configuración. Son paneles en columnas (1 en móvil, 2 en iPad
   vertical, 3 en iPad horizontal y ordenador) con una fila por herramienta: icono, nombre y
   una línea de para qué sirve o su estado.

**Dónde vive cada cosa:**

- `src/lib/escritorio.ts`: el **registro** de herramientas (`HERRAMIENTAS`: grupo, título,
  descripción, href, icono, y qué módulo da acceso), `herramientasDe(usuario, contexto)` que
  filtra con `canAccess`, `buscarHerramientas()` y `saludo()`. Puro y con tests
  (`src/lib/__tests__/escritorio.test.ts`). **Un módulo nuevo = una entrada en ese registro.**
- `src/components/home/escritorio.tsx`: la pantalla (cliente, por el buscador).
- `src/app/gestion/page.tsx`: sesión, cifras y avisos, todo en una tanda de consultas.

`escritorio-cards.tsx` (las tarjetas de septiembre: `ToolDoble`, `LicenciasDestacada`…) se
borró con este cambio. La regla de Licencias destacada en junio y septiembre sigue, ahora
como aviso de «Ahora» (`esTemporadaLicencias()`).

Todo respeta la matriz de permisos: si tu rol no tiene un módulo, su fila no existe, y un
grupo sin filas desaparece entero. Un módulo apagado en `CONFIGURACION.modulosDesactivados`
(hoy Puntualidad) no sale para nadie.

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

### Fase 3 · Reordenación por grupos (2026-10-20)
- [x] Registro `src/lib/escritorio.ts` con grupos, buscador y saludo, con tests
- [x] Pantalla nueva: cabecera fija, saludo + cifras + buscador, «Ahora», «Tu día» y cinco grupos
- [x] Probado en iPad horizontal y vertical, móvil, ordenador y modo oscuro
- [x] Botón «Ver como familia» (`/?vista=familia`)
- [x] Puntualidad fuera del escritorio (módulo apagado)
