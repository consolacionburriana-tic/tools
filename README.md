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

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS v4** + **shadcn/ui**
- **Motion** (`motion/react`) para animaciones
- **Drizzle ORM** sobre **Neon Postgres** (serverless)
- **Zod** + **react-hook-form**
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

5. Edita `.env.local` y pega tu connection string:

```
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
```

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
| `pnpm build` | Build de producción |
| `pnpm db:push` | Sincronizar schema con la BD |
| `pnpm db:generate` | Generar migraciones |
| `pnpm db:studio` | Abrir Drizzle Studio (BD visual) |
| `pnpm db:seed` | Cargar datos de ejemplo |

## Herramientas disponibles

### Registro ABC (`/registro-abc`)

Formulario para registrar conductas disruptivas de alumnos con NEE. Diseñado para rellenarse desde iPad en menos de 90 segundos.

**Características:**
- Auto-guardado del borrador en localStorage (debounced 500ms)
- Botón guardar sticky con safe-area-inset
- Animaciones sutiles con motion/react
- Haptics en iOS Safari ≥17.4 (PWA) y Android Chrome
- Dark mode automático

### Admin (`/admin`)

Gestión de alumnos, profesores y visualización de registros con gráficos.

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
3. En **Environment Variables**, añade:
   - `DATABASE_URL` = tu connection string de Neon
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

## Próximas fases

- **Fase 2**: Autenticación con Clerk
- **Fase 3**: IA con Gemini para sugerencias de conducta
- **Fase 4**: Notificaciones y emails con Resend
