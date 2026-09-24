# Tareas de la plataforma · plan y checklist

El cuaderno de bitácora del propio desarrollo de la plataforma: que no se pierda ningún
fallito ni ninguna idea. Se apunta en dos segundos desde el **botón flotante de abajo a la
derecha** de cualquier pantalla de `/gestion`, y se lleva en **`/gestion/tareas`** (pantalla
completa). Pedido por David el 24-sep-2026. Evolucionará a un kanban de tareas.

---

## Estado: implementado ✅ (2026-09-24)

## Decisiones cerradas

- **Dos tipos de tarjeta**, en la misma tabla (`tar_tareas`):
  - **Fallito** (`fallo`): una línea + el módulo donde se vio. El módulo sale ya elegido según
    la pantalla en la que estás (`moduloDeRuta`), y se guarda la ruta, que va en el texto
    copiado para que el agente sepa dónde mirar.
  - **Módulo nuevo** (`modulo`): nombre, definición funcional y checklist de lo que tendrá.
    La checklist se escribe rápido (una línea por item) y luego se marca y edita en el tablero.
- **Estados** (las cuatro columnas del futuro kanban): pendiente · en curso · hecho · descartado.
  Por defecto se ven las abiertas (pendiente + en curso).
- **Botón de copiar** en cada tarjeta: genera el texto listo para pegar a un agente
  (`promptTarea` en `src/lib/tareas.ts`) con módulo, pantalla, ficha de `docs/` que tiene que
  leer y cómo trabajar. En fallitos hay además «copiar todos los pendientes», agrupados por módulo.
- **Permisos, dos módulos** (ajustables por persona en `/gestion/usuarios` como cualquier otro):
  - `tareas` → ve y lleva todo (tablero, estados, editar, borrar, ideas de módulo).
    **SuperTIC y TIC.** Secretaría, que tiene todos los módulos, este no (David: TIC lo ve todo).
  - `tareas-reportar` → solo apunta fallitos y ve **los suyos** con su estado, desde el botón
    flotante. **Dirección, secretaría y orientación.** El resto del claustro, de momento, no.
- **El botón es sutil a propósito**: 40 px, medio transparente, esquina inferior derecha (los
  botones de guardar de los formularios van abajo a todo el ancho y viven fuera de `/gestion`).
  No sale en `/gestion/tareas`, ni en login ni en sin-acceso. A quien lleva el tablero le enseña
  cuántos fallitos quedan.

## Plan técnico

- Tabla `tar_tareas` (`src/db/schema.ts`, SQL aditivo `src/db/sql/tareas.sql`).
- Helpers puros y validación Zod: `src/lib/tareas.ts` (tests en `__tests__/tareas.test.ts`).
  Queries: `src/lib/tareas-server.ts`.
- API: `GET/POST /api/tareas` (quien reporta solo ve lo suyo y solo crea fallitos) y
  `PATCH/DELETE /api/tareas/[id]` (solo `tareas`).
- UI: `src/components/tareas/` — `lanzador.tsx` (botón + panel), `tablero.tsx` (pantalla
  completa), `formularios.tsx` y `comun.tsx`. El botón lo monta `src/app/gestion/layout.tsx`,
  que envuelve todo `/gestion` sin cabecera propia.

## Checklist

- [x] Tabla `tar_tareas` y SQL aplicado en Neon (24-sep-2026)
- [x] Módulos `tareas` / `tareas-reportar` en la matriz de roles
- [x] Botón flotante con alta de fallito (módulo autoelegido por la pantalla) e idea de módulo
- [x] Panel: pendientes recientes con marcar hecho y copiar (TIC) / lo mío con su estado (quien reporta)
- [x] `/gestion/tareas`: filtros por estado, módulo y búsqueda; editar, borrar, estado
- [x] Módulos nuevos: descripción editable, checklist marcable, barra de progreso
- [x] Copiar fallito / definición funcional / todos los pendientes para pegar a un agente
- [x] Tarjeta en el escritorio (Configuración general)
- [ ] Kanban: columnas por estado con arrastrar (siguiente paso, ver `00-desarrollos-futuros.md`)
