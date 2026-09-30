# Tools Consolación

La «navaja suiza» digital del **Colegio Consolación de Burriana** (Castellón): un único sitio web
con módulos pequeños e independientes para la gestión diaria del colegio. Casi todos siguen el
mismo patrón:

> **formulario o pantalla de gestión → datos centralizados en Postgres → aviso por correo a quien tiene que enterarse**

Hecho para funcionar bien en un **iPad compartido** (se instala como app) y pensado para que lo
puedan **desplegar otros colegios** con sus propias cuentas. La gracia: **importas el alumnado y
el profesorado desde Educamos y todos los módulos ya los tienen**. Por eso está pensado para
colegios con **Educamos** y **Google Workspace for Education**, con Infantil, Primaria y ESO
(Bachillerato todavía no; ver el §7 de la guía).

## ¿Quieres tu propia copia para tu colegio?

👉 **[`docs/08-despliegue-y-fork.md`](./docs/08-despliegue-y-fork.md)** — guía esquemática de
*dónde se hace cada cosa* (GitHub, Neon, Vercel, Google, correo) y qué cambiar en el código.

Cambiar la identidad (dominio, nombre, buzones) es editar un solo fichero:
[`src/lib/colegio.ts`](./src/lib/colegio.ts). Lo imprescindible para arrancar es poco: **Neon** (base de datos) + **Vercel** (hosting) + un
**Google Workspace** para el login del claustro. Lo demás (correo, Drive, Calendar, Classroom,
archivos adjuntos) se va activando módulo a módulo.

## Qué incluye

Cada módulo tiene su ficha en [`docs/`](./docs/) y la tabla de estado real está en
[`docs/plataforma.md`](./docs/plataforma.md).

| Módulo | Para qué | Dónde |
|---|---|---|
| **Escritorio** | Tarjetas por rol con lo que cada persona puede hacer | `/gestion` |
| **Login y roles** | Google (solo cuentas del dominio) + permisos por módulo y persona | `/gestion/usuarios` |
| **BBDD central** (Educamos) | Alumnado, tutores y profesorado importados del export de Educamos | `/gestion/educamos`, `/gestion/profes` |
| **Alumnado** | Ficha por alumno, protección de datos, informes a medida | `/gestion/alumnado` |
| **Registro ABC** | Conductas disruptivas en menos de 90 s | `/registro-abc` · `/gestion/abc` |
| **Puntualidad** | Retrasos de entrada, aviso al tutor cada 3 y resumen semanal | `/puntualidad` · `/gestion/puntualidad` |
| **Licencias digitales** | Campaña de licencias: pedido de familias, pedido a editoriales, envío de códigos | `/licencias` · `/gestion/licencias` |
| **Banco de libros** | Participantes, lotes y valoración | `/gestion/bancolibros` |
| **Salidas y pagos** | Autorizaciones, cobros y justificantes | `/salidas` · `/gestion/salidas` |
| **Evaluaciones** | Encuestas de actividades a alumnado, profesorado y familias | `/gestion/evaluaciones` |
| **Horarios** y **Mi horario** | Rejillas, horarios de clase/profe/aula y exportar a Google Calendar | `/gestion/horarios` · `/mi-horario` |
| **Cuaderno de tutor** | Documentos de tutoría generados desde plantillas | `/gestion/cuaderno` |
| **Números del cole** | Recuentos por clase, curso y etapa con foto mensual | `/gestion/numeros` |
| **Oratorios y Godly Play** | Planificar momentos en la hora de otro profe, con Calendar y correo | `/gestion/oratorios` |
| **Calendarios y Classrooms** | Limpieza en bloque de calendarios y clases del dominio | `/gestion/calendarios` |
| **AUTOASM** | Ficheros CSV de Apple School Manager | `/gestion/autoasm` |
| **Tareas** | Fallos e ideas de la propia plataforma | `/gestion/tareas` |

## Stack

**Next.js 16** (App Router, TypeScript estricto) · **Tailwind v4** + shadcn/ui sobre **@base-ui/react** ·
**Auth.js v5** (Google) · **Drizzle ORM** + **Neon Postgres** · **Zod** + react-hook-form ·
correo por **API de Gmail** o **Resend** · **Vercel Blob** · **PWA** instalable · deploy en **Vercel**.

> ⚠️ Next 16 tiene cambios de ruptura respecto a versiones anteriores. Ante la duda, consulta
> `node_modules/next/dist/docs/`.

## Desarrollo en local

```bash
pnpm install
cp .env.local.example .env.local   # rellena al menos DATABASE_URL y AUTH_*
pnpm db:push                       # ⚠️ solo en una base vacía; ver la guía de despliegue §2
pnpm dev                           # http://localhost:3000
```

Variables de entorno (todas, y para qué sirve cada una):
[`docs/04-convenciones-tecnicas.md`](./docs/04-convenciones-tecnicas.md#variables-de-entorno).

| Comando | Qué hace |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Desarrollo · build de producción (**siempre antes de dar algo por hecho**) · servir el build |
| `pnpm lint` · `pnpm typecheck` · `pnpm test` | ESLint · tipos · tests (Vitest) |
| `pnpm db:sql --pendientes` | Aplica en Neon el SQL aditivo que falte (`--dry` para ver qué haría) |
| `pnpm db:push` | Sincroniza `schema.ts` con la BBDD. **Cuidado: no es aditivo**, ver convenciones |
| `pnpm db:studio` | Explorar la BBDD |
| `pnpm db:seed` · `pnpm db:seed:licencias` | Datos de ejemplo (ABC y Licencias) |
| `pnpm tokens:familias` | Genera los enlaces personales (magic links) de las familias |
| `pnpm horarios:importar <fichero>` | Importa horarios desde Educamos (`--dry` para probar) |

## Documentación

Todo vive en [`docs/`](./docs/). Orden de lectura para incorporarte al proyecto (persona o agente):

1. [`docs/plataforma.md`](./docs/plataforma.md) — mapa, estado de cada módulo, roadmap y principios de arquitectura.
2. [`docs/04-convenciones-tecnicas.md`](./docs/04-convenciones-tecnicas.md) — cómo se escribe código aquí, gotchas del stack y reglas de datos personales.
3. [`docs/08-despliegue-y-fork.md`](./docs/08-despliegue-y-fork.md) — desplegarlo en otro colegio.
4. `docs/<nn>-<modulo>.md` — la ficha de cada módulo (decisiones, plan técnico, checklist).
5. [`docs/00-desarrollos-futuros.md`](./docs/00-desarrollos-futuros.md) — decisiones pendientes e ideas.

## Protección de datos

El alumnado es menor de edad. Reglas que no se negocian (detalle en las convenciones):
**ningún export con datos reales se sube al repo** (`.gitignore` bloquea `*educamos*`), los
formularios públicos **no buscan por nombre** (DNI del tutor, NIA o enlace personal) y muestran
los nombres enmascarados, y no se guardan datos bancarios.

## Licencia

[**GNU AGPL-3.0**](./LICENSE). Puedes usar, adaptar y desplegar este código en tu colegio. Si lo
modificas y lo ofreces como servicio a otras personas, tienes que compartir tus cambios bajo la
misma licencia. El nombre, el logo y el emblema del Colegio Consolación
(`public/logobur.png`, `public/icons/`) **no** se ceden con la licencia: sustitúyelos por los tuyos.

## Instalar en el iPad como app

Abre la web en **Safari** → **Compartir** → **Añadir a pantalla de inicio**. Se abre a pantalla
completa, sin barra del navegador.
