# Tools Consolación

Hub de micro-herramientas internas para el Colegio Consolación de Burriana (Castellón).

## Documentación de la plataforma

Este repo será la "navaja suiza" digital del colegio: varios módulos independientes que reciben
información por formulario y la notifican a quien corresponde. Antes de desarrollar nada, lee:

- [`docs/plataforma.md`](./docs/plataforma.md) — visión general, mapa de módulos y **tabla de
  estado** (qué está planificado a nivel funcional, qué tiene plan técnico y qué está implementado).
- [`docs/00-desarrollos-futuros.md`](./docs/00-desarrollos-futuros.md) — decisiones pendientes e ideas
  para el próximo curso.
- `docs/<nn>-<modulo>.md` — ficha de cada módulo (plan funcional, técnico y checklist de fases).

El **roadmap de hitos** (en qué orden se construye todo) está en `docs/plataforma.md`.

## Stack

- **Next.js 16** (App Router, TypeScript estricto) — atención: Next 16 tiene cambios de
  ruptura respecto a versiones anteriores, ver `node_modules/next/dist/docs/`
- **Tailwind CSS v4** + **shadcn/ui** sobre **@base-ui/react** (no Radix)
- **Auth.js v5** (`next-auth`) — login con Google, solo cuentas del dominio del colegio
- **Motion** (`motion/react`) para animaciones
- **Drizzle ORM** sobre **Neon Postgres** (serverless)
- **Zod** + **react-hook-form**
- **Resend** para email, **Vercel Blob** para adjuntos privados
- **date-fns** locale `es`
- **PWA básica** (instalable en iPad)
- Deploy en **Vercel**

## Primeros pasos

### 1. Clonar e instalar dependencias

```bash
git clone <repo-url>
cd tools-consolacion
pnpm install
```

### 2. Configurar la base de datos (Neon)

1. Crea una cuenta gratuita en [neon.tech](https://neon.tech)
2. Crea un nuevo proyecto
3. Copia la connection string (pooled) del panel de Neon
4. Crea el archivo de variables de entorno:

```bash
cp .env.local.example .env.local
```

5. Edita `.env.local` con tus valores. La lista completa de variables en uso (con qué
   son y para qué sirve cada una) está en la tabla de
   [`docs/04-convenciones-tecnicas.md`](./docs/04-convenciones-tecnicas.md#variables-de-entorno) —
   para desarrollo local basta con `DATABASE_URL`, `AUTH_*` y `RESEND_API_KEY`; el resto
   (Google Sheets, Blob) solo hace falta si vas a tocar esos módulos.

### 3. Crear las tablas

```bash
pnpm db:push
```

### 4. Cargar datos de ejemplo (opcional)

```bash
pnpm db:seed
```

Esto crea:
- 1 alumno: R. Herreros (2 ESO A)
- 2 profesores de ejemplo

### 5. Arrancar en desarrollo

```bash
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000)

## Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Build de producción — **siempre antes de dar algo por hecho** |
| `pnpm lint` | ESLint |
| `pnpm db:push` | Sincronizar schema con la BD (siempre aditivo) |
| `pnpm db:generate` | Generar migraciones |
| `pnpm db:studio` | Abrir Drizzle Studio (BD visual) |
| `pnpm db:seed` | Cargar datos de ejemplo del módulo ABC |
| `pnpm db:seed:licencias` | Seed puntual de Licencias |
| `pnpm tokens:familias` | Genera los magic links de familias de la campaña activa |

## Herramientas disponibles

Seis módulos, cada uno con su formulario público (si recibe datos de familias) y su
panel de gestión bajo `/gestion/<modulo>` (detrás de login con Google, solo cuentas
`@consolacionburriana.com`). Estado y detalle completo de cada uno en
[`docs/plataforma.md`](./docs/plataforma.md) — aquí solo el mapa rápido:

| Módulo | Formulario público | Panel de gestión |
|---|---|---|
| Registro ABC (conductas disruptivas) | `/registro-abc` (claustro, con sesión) | `/gestion/abc` |
| Licencias digitales | `/licencias` | `/gestion/licencias` |
| Salidas y pagos | `/salidas` | `/gestion/salidas` |
| Banco de libros | — | `/gestion/bancolibros` |
| BBDD central Educamos (alumnado + tutores + profes) | — | `/gestion/educamos` |
| Usuarios y roles | — | `/gestion/usuarios` |

`/admin` es una ruta heredada de antes del login: hoy es solo un redirect a
`/gestion/abc` para no romper marcadores antiguos.

Todos comparten Neon (una tabla por módulo, prefijo propio en `src/db/schema.ts`) y
Resend para las notificaciones por correo. Convenciones de código, patrones y
"definition of done" en
[`docs/04-convenciones-tecnicas.md`](./docs/04-convenciones-tecnicas.md) — lectura
obligada antes de tocar código.

## Deploy en Vercel

### 1. Subir el código a GitHub

```bash
git init
git add .
git commit -m "feat: scaffolding inicial"
git remote add origin https://github.com/TU_USUARIO/tools-consolacion.git
git push -u origin main
```

### 2. Conectar con Vercel

1. Ve a [vercel.com/new](https://vercel.com/new)
2. Importa el repositorio de GitHub
3. En **Environment Variables**, añade todas las variables de la tabla de
   [`docs/04-convenciones-tecnicas.md`](./docs/04-convenciones-tecnicas.md#variables-de-entorno)
   — no solo `DATABASE_URL`: sin `RESEND_API_KEY` los correos se saltan en silencio, sin
   `GOOGLE_SHEETS_*` falla la sincronización de Licencias, y sin `BLOB_READ_WRITE_TOKEN`
   fallan las subidas de justificantes de Salidas
4. Despliega

### 3. Dominio custom (`tools.consolacionburriana.com`)

1. En el panel de Vercel → Settings → Domains
2. Añade `tools.consolacionburriana.com`
3. En tu proveedor DNS, añade un registro `CNAME`:
   - **Host**: `tools`
   - **Valor**: `cname.vercel-dns.com`
4. Vercel verificará automáticamente y emitirá el certificado SSL

---

## Instalar en iPad como app

Los profesores pueden instalar la web como aplicación sin barra de Safari:

1. Abre `tools.consolacionburriana.com` en **Safari** (en el iPad)
2. Pulsa el botón **Compartir** (cuadrado con flecha hacia arriba)
3. Selecciona **"Añadir a pantalla de inicio"**
4. Asígnale el nombre que quieras y pulsa **Añadir**

La app se abrirá en modo fullscreen y los haptics funcionarán al 100% (Taptic Engine de iOS).

---

## Roadmap

El roadmap real (hitos, qué está hecho y qué falta módulo a módulo) vive en
[`docs/plataforma.md`](./docs/plataforma.md) — es un documento vivo, así que no se
duplica aquí.
