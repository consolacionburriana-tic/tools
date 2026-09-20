# Portada pública (`/`) · plan y checklist

La primera pantalla de `tools.consolacionburriana.com` y la que abre el icono de la PWA. La
ven **las familias** (llegan desde un correo del colegio, o tecleando el dominio) y, de
rebote, todo el claustro.

Hermana pública del [escritorio de administración](./03-escritorio-admin.md): aquel enseña
módulos según tu **rol**, esta enseña trámites según el **momento del curso**.

---

## Estado: implementado ✅ (2026-09-14)

Sustituye a la portada fija que enseñaba siempre "Licencias digitales" aunque la campaña
llevara meses cerrada.

## La idea: la portada es dinámica

**No es un menú de módulos, es un botón por trámite abierto.** Una familia no sabe —ni
tiene por qué— qué "módulos" tiene la plataforma: sabe que le han dicho que pida las
licencias, o que pague la excursión. La portada la manda ahí y se aparta:

| Situación | Qué se ve |
|---|---|
| Campaña de licencias abierta y en plazo | **Solicitar licencias digitales** → `/licencias`, en azul, más una segunda línea "¿He hecho ya mi pedido?" |
| Alguna salida abierta con pago por transferencia | **Subir el justificante de una salida** → `/salidas`, en ámbar |
| Las dos cosas | Los dos botones, Licencias primero |
| Nada abierto | Una sola frase: por aquí no hay nada abierto, el colegio avisa por correo |

**La portada no cuenta detalles**: ni el plazo, ni qué salida, ni cuántas. Eso lo cuenta la
pantalla de destino, que además sabe quién está mirando; aquí solo se decide a dónde mandar
a la gente. Todo intento de resumir el estado en la portada acabó en un subtítulo largo que
nadie necesita para pulsar un botón.

Cada trámite lleva **su icono y su color** (azul + móvil para Licencias, ámbar + autobús
para Salidas), en fondo suave y con el color fuerte solo en el icono y el texto. Que se
distingan de un vistazo es el objetivo de la pantalla: con dos botones iguales, la familia
que viene a pagar la excursión entra en el formulario de licencias. Que no griten, también:
son dos botones en una pantalla vacía, no necesitan ayuda para verse.

El **acceso del profesorado** va siempre abajo y siempre discreto, incluso cuando es lo
único que hay: el claustro entra directo a `/gestion` desde la PWA y no necesita que se lo
ofrezcan en grande.

## Decisiones cerradas

- **Qué módulos pueden salir en la portada** (2026-09-13): solo los que tienen una pantalla
  **pública y auto-explicativa**. Licencias y Salidas la tienen. Evaluaciones no entra: se
  entra por un enlace con token de un solo uso y sin token no hay nada que enseñar. ABC,
  Puntualidad y Mi horario tampoco: están detrás del login del claustro y su sitio es el
  escritorio de `/gestion`.
- **Nada de contar salidas ni de anunciar plazos en la portada** (2026-09-14): se probó con
  subtítulos vivos ("Curso 2026/2027 · hasta el martes 15 de septiembre", "Varias salidas ·
  la próxima, el viernes 18") y sobraba texto para lo que es la pantalla: un desvío. De paso
  se evita un mal dato: una convivencia se crea como una salida por clase (el 18-sep-2026
  había **diez** para un único día), así que "10 salidas" asusta sin informar.
- **La regla de "salida visible" es la misma que ve la familia** (`salidaParaFamilias()` en
  `src/lib/salidas.ts`): abierta y con pago por transferencia, **sin** filtrar las que ya
  pasaron. Mientras la salida siga abierta admite justificantes de rezagados, y la portada
  tiene que llevar a la misma lista que la pantalla de Salidas, no a una más corta.
- **Orden fijo: Licencias antes que Salidas** (2026-09-13). Licencias es lo único con fecha
  límite y va dirigido a todo el colegio a la vez; una salida afecta a una clase y suele
  llegar por un correo con enlace directo.
- **El titular ya no es el nombre de un módulo**, es el del colegio. Antes ponía "Licencias
  digitales" en grande todo el año; ahora eso vive en la tarjeta de Licencias, que aparece
  solo cuando toca.

## Plan técnico

```
src/app/page.tsx                     # force-dynamic: pide los accesos y pinta
src/lib/portada.ts                   # PURO: qué accesos hay y cómo se titulan (con tests)
src/lib/portada-server.ts            # las consultas, en paralelo (una por módulo)
src/components/home/home-landing.tsx # la pantalla + el tema visual de cada módulo
```

- `portada.ts` no toca la BBDD: cada `accesoX()` recibe el dato ya leído y devuelve `null`
  cuando su módulo no está activo. Por eso se puede testear entero
  (`src/lib/__tests__/portada.test.ts`) sin levantar nada.
- `portada-server.ts` lanza las consultas con `Promise.all` y pide **solo las columnas que
  necesita** (`getSalidasParaFamilias()` no se trae los `jsonb` de `sal_trips`). Esta es la
  página que más se abre del sitio: no puede pagar el arranque de un panel.
- La página es `force-dynamic` a propósito: lo que enseña cambia con el estado de la BBDD, y
  una portada cacheada enseñaría una campaña cerrada como abierta.

### Añadir un módulo a la portada

1. Su nombre en `MODULOS_PORTADA` (`src/lib/portada.ts`).
2. Un `accesoX()` puro al lado, que devuelva `null` cuando el módulo no esté activo, con su
   test en `src/lib/__tests__/portada.test.ts`.
3. La consulta que lo alimenta, en `portada-server.ts` (dentro del `Promise.all`).
4. Su tema visual en `TEMAS` (`home-landing.tsx`): **un color que no tenga ya otro módulo**.
5. Su fila en la tabla de arriba y su línea en "Decisiones cerradas" si el criterio de
   "cuándo está activo" no es obvio.

## Fases

### Fase 1 · Portada dinámica
- [x] `src/lib/portada.ts` con `accesoLicencias`, `accesoSalidas` y `accesosPortada` (puros)
- [x] `src/lib/portada-server.ts` con las consultas en paralelo
- [x] `getSalidasParaFamilias()` y `salidaParaFamilias()` en Salidas, reusado por
      `getActiveTripsForStudent()` para que la regla sea una sola
- [x] Portada rediseñada: un botón por trámite, con icono y color propios y sin subtítulos;
      estado vacío de una frase; acceso del profesorado siempre presente y siempre discreto
- [x] Tests de los helpers puros (`portada.test.ts`)
- [x] Verificado con datos reales de producción (campaña 2026/2027 abierta y las diez
      convivencias del 18-sep), estado vacío comprobado a mano, claro y oscuro en 430px

### Fase 2 · Ideas (sin decidir, ver `00-desarrollos-futuros.md`)
- [ ] Que la portada reconozca el magic link (`?t=tok_…`) y salude por familia
- [ ] Banco de libros: si algún día las familias se apuntan desde fuera, es el tercer candidato
- [ ] Aviso de "plazo a punto de cerrar" (quedan 2 días) con otro color en el botón
