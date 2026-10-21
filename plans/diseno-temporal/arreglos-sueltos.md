# Arreglos sueltos que salieron en la auditoría

> TEMPORAL: se borra con `plans/diseno-temporal/`. Si no se hacen antes de la fase 5, pasar a
> `docs/pequeños-arreglos.md`.
> **Estado: HECHO (21-oct-2026).** Los cinco aplicados en un commit aparte.
> Todos verificados en el código el 20-oct-2026.

## 1. Registro ABC: enlace roto a cada registro

- **Dónde:** `src/components/registro-abc/registros-charts.tsx:438`.
- **Qué pasa:** el enlace apunta a `/admin/registros/${report.id}`, pero `/admin` solo es
  `src/app/admin/page.tsx` (redirige a `/gestion/abc`), así que da 404.
- **Arreglo:** `href={`/gestion/abc/registros/${report.id}`}` (existe `app/gestion/abc/registros/[id]/page.tsx`).
- **Comprobar:** `grep -rn "/admin/registros" src` → 0; en dev, el enlace abre el registro.

## 2. Evaluaciones: `ring-dashed` no existe

- **Dónde:** `src/components/evaluaciones/form-editor.tsx:865`, botón «Añadir otra actividad».
- **Qué pasa:** Tailwind no tiene `ring-dashed`; el anillo sale continuo.
- **Arreglo:** cambiar el anillo por borde: `border border-dashed border-zinc-300 hover:border-blue-400 dark:border-zinc-700`
  (y quitar `ring-1 ring-dashed ring-zinc-300 hover:ring-blue-400 dark:ring-zinc-700`).
- **Comprobar:** en el editor, el botón se ve discontinuo en claro y oscuro.

## 3. Banco de libros: la ficha imprime la cabecera de la app

- **Dónde:** `src/app/gestion/bancolibros/layout.tsx` (la cabecera no tiene `print:hidden`), al
  imprimir `src/app/gestion/bancolibros/ficha/page.tsx`.
- **Arreglo:** `print:hidden` en el `<header>` del layout y `print:bg-white` en el contenedor
  (como hace `app/gestion/numeros/layout.tsx`).
- **Comprobar:** en dev, vista de impresión de la ficha sin la barra de arriba.

## 4. Classrooms y calendarios: el botón de Tareas tapa «Borrar N»

- **Dónde:** barra fija de abajo en `src/components/calendarios/panel.tsx:426` (y la de `clases.tsx`).
- **Qué pasa:** el botón flotante de Tareas (`fixed right-3 bottom-3`, 40 px) cae encima del botón
  de la derecha. Correos y grupos ya lo resuelve con `pr-14` (`components/cuentas/lista.tsx:424`).
- **Arreglo:** `pr-14` en el contenedor interior de esas barras.
- **Comprobar:** con un usuario TIC, al seleccionar calendarios el botón «Borrar» queda libre.

## 5. Licencias: la tabla de pedidos se corta en el iPad en vertical

- **Dónde:** `src/components/licencias/pedidos-list.tsx:187`, envoltorio con `overflow-hidden` y una
  tabla de 10 columnas.
- **Arreglo:** `overflow-x-auto` en el envoltorio (manteniendo el borde redondeado) para que se
  desplace en vez de cortarse, como ya hacen «Quién falta» y «Envíos».
- **Comprobar:** a 820 px de ancho se ven todas las columnas desplazando la tabla.
