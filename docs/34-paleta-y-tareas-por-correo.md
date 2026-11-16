# Paleta ⌘K y tareas por correo

**Estado:** plan funcional ✅ · plan técnico ✅ · implementado 🟡 (la paleta, en uso desde el 16-nov-2026;
las tareas por correo, escritas y probadas hasta Gmail: falta el scope `gmail.modify` en la delegación)

Ideas de David del 3-oct-2026 («acceso rápido y tareas por correo»), aprobadas el 16-nov-2026 («¡hágase!»).
Son transversales: no tienen módulo propio ni pantalla, viven encima de todo `/gestion`.

## La paleta (⌘K)

**⌘K** (Ctrl+K en Windows) en cualquier pantalla de `/gestion` y en Mi horario, o la **lupa** de la barra de
arriba (para el iPad sin teclado). Una sola caja que sirve para:

- **Ir a** cualquier herramienta que tengas (las mismas del escritorio, con su buscador y sus palabras clave:
  «excursiones» → Salidas).
- **Tableros**: los de tus equipos, por nombre.
- **Aulas y espacios** de Inventario (si tienes el módulo): «12», «aula 12», «laboratorio».
- **Alumnado** (si tienes Alumnado), desde 3 letras, sin tildes, y **solo los de tu alcance** (el mismo filtro
  por etapa que la pantalla de Alumnado: se filtra en el servidor).
- **Apuntar una tarea** en una línea, empezando por `t ` (o `+ `):

  ```
  t proyector 3ºB @amparo viernes !alta #mant
  ```

  `@amparo` = responsable (un miembro del equipo cuyo nombre o correo empiece así; si hay dudas, no se pone),
  `viernes` / `hoy` / `mañana` / `15/12` = para cuándo, `!alta` (`!urgente`, `!media`, `!baja`, `!!`, `!!!`) =
  prioridad, `#mant` = en qué tablero (por el principio de su nombre; sin `#`, el primero de tus tableros). La
  paleta enseña cómo va a quedar antes de pulsar Intro, y avisa de un `@` que no está en el equipo. La tarjeta
  entra en la primera lista abierta del tablero, con el mismo aviso por correo a los responsables que el botón
  «Añadir tarjeta».

## Tareas por correo

**Reenvía un correo a `tic+tarea@consolacionburriana.com`** y aparece como tarjeta en tu tablero:

- La crea **quien reenvía**, que tiene que estar en algún equipo de Tableros (si no, el correo se etiqueta
  «Tableros/Sin equipo» en el buzón de TIC y no pasa nada más).
- **El asunto admite lo mismo que la paleta**: `Fwd: Proyector 3ºB no va @amparo viernes !alta #mant`. Se quitan
  solos los «Fwd:», «RV:», «Re:».
- **El cuerpo** va a la descripción de la tarjeta, y la tarjeta enlaza al **correo original** (se abre en el
  Gmail de quien lo pulsa, por su Message-ID: quien lo reenvió lo tiene en Enviados).
- Un correo ya convertido queda etiquetado «Tableros/En tablero» y no se vuelve a leer.

**Cuándo se lee el buzón**: cada vez que alguien con Tableros usa `/gestion`, en segundo plano y como mucho
cada 2 minutos (el turno se coge en `cfg_ajustes` con un UPDATE atómico, así no se duplica nada), y además por
cron de lunes a viernes a las 7:10 UTC por si nadie entra.

**Lo que falta (David)**: en la consola de Google Workspace → Seguridad → Control de API → Delegación de todo el
dominio, añadir al Client ID de la cuenta de servicio el scope `https://www.googleapis.com/auth/gmail.modify`.
Comprobado el 16-nov-2026: `gmail.send` está, `gmail.modify` no. Mientras falte, la app lo dice una vez por
hora en el log y no molesta.

## Plan técnico

- `src/lib/paleta.ts` (puro, tests): interpretar la línea, fechas, elegir tablero y persona.
- `src/lib/tareas-correo.ts` (puro, tests): asunto, remitente, texto del correo, enlace al original.
- `src/lib/tareas-rapidas-server.ts`: a qué tableros puede ir alguien y crear la tarjeta (usa la acción
  `crearTarjeta` de Tableros: mismos permisos, orden y avisos).
- `src/lib/tareas-correo-server.ts`: leer y etiquetar el buzón (`TAREAS_BUZON`, por defecto `tic@`).
- `/api/paleta` (GET: lo que se puede abrir; GET `?q=`: alumnos; POST: crear tarea) y
  `/api/tableros/cron/correos`.
- `src/components/paleta/`: la paleta (`cmdk`) y la lupa; montada en `src/app/gestion/layout.tsx` y en Mi horario.

## Checklist

- [x] Paleta: ir a herramientas, tableros, aulas y alumnado (con su alcance), con ⌘K y con la lupa
- [x] Tarea en una línea con responsable, fecha, prioridad y tablero (probado contra Neon y limpiado)
- [~] Tareas por correo a `tic+tarea@`: escrito y probado hasta Gmail; falta `gmail.modify` en la delegación
- [ ] Seguimiento del buzón compartido (quién contesta a qué, idea del 3-oct-2026): sin hacer
