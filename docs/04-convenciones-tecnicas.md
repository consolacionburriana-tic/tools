# Convenciones técnicas del repo · guía para implementar

Documento transversal de **cómo se escribe código aquí**. Las fichas de módulo dicen *qué*
construir; este documento dice *cómo*, para que todos los módulos salgan coherentes aunque los
implementen agentes distintos en sesiones distintas. Si un patrón de aquí contradice a una
ficha, gana la ficha (y se anota la excepción en ella).

---

## Stack (verificado en `package.json`)

Next.js 16 App Router + TypeScript estricto · Tailwind v4 + shadcn/ui sobre **@base-ui/react**
· `motion/react` · Drizzle ORM + Neon (`@neondatabase/serverless`) · Zod + react-hook-form ·
Resend · date-fns (locale `es`) · recharts (gráficos) · sonner (toasts) · lucide-react (iconos)
· ios-haptics · pnpm.

> **Next 16 no es el Next de tu entrenamiento.** Antes de usar cualquier API de Next, mira la
> guía en `node_modules/next/dist/docs/`. Esto incluye dónde vive el middleware/proxy.

## Scripts

```bash
pnpm dev          # desarrollo
pnpm build        # SIEMPRE antes de dar algo por hecho
pnpm lint         # eslint
pnpm db:push      # aplicar schema a Neon (drizzle-kit push)
pnpm db:studio    # inspeccionar la BBDD
pnpm db:seed:licencias   # seeds puntuales (tsx + dotenv .env.local)
```

## Variables de entorno

En uso hoy (`.env.local` local · Settings→Environment Variables en Vercel):

| Var | Para qué |
|---|---|
| `DATABASE_URL` | Neon (pooled connection string) |
| `RESEND_API_KEY` · `RESEND_FROM` | Envío de email |
| `LICENCIAS_GESTORES` | Lista de correos de aviso de Licencias |
| `GOOGLE_SHEETS_CLIENT_EMAIL` · `GOOGLE_SHEETS_PRIVATE_KEY` · `GOOGLE_SHEETS_SPREADSHEET_ID` | Cuenta de servicio para escribir en el Sheet de Licencias |

Reservadas para los hitos siguientes: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
(hito 2) · `BLOB_READ_WRITE_TOKEN` (Salidas). Cualquier var nueva se añade a esta tabla y a
`.env.local.example` en el mismo commit que el código que la usa.

## Base de datos (Drizzle + Neon)

- **Todas las tablas en `src/db/schema.ts`**, agrupadas por módulo con su prefijo (`abc_`,
  `lic_`, `edu_`, `auth_`, `sal_`, `bl_`, `eval_`) y un comentario separador por bloque.
  Nombres de tabla y columna en `snake_case`; los exports TS en `camelCase`.
- **Cambios de schema siempre aditivos** vía `pnpm db:push`: añadir tablas/columnas sí; renombrar
  o borrar, solo con decisión explícita de David (hay datos reales de producción).
- **Nunca borrar filas con significado histórico**: el patrón es `active=false` (así funcionan
  alumnos de Licencias y funcionará `edu_students`). Los borrados de verdad, solo para datos
  claramente erróneos y desde paneles con confirmación.
- La conexión se inicializa **lazy** en `src/db/index.ts` para que el build no explote sin
  `DATABASE_URL`. No cambiar ese patrón.
- Páginas server component que leen la BBDD llevan `export const dynamic = 'force-dynamic'`.
- IDs: `uuid` con default aleatorio. Fechas: `timestamp` con `defaultNow()` para `created_at`;
  `updated_at` se actualiza en el código de escritura.

## Rutas y estructura de un módulo

```
src/app/(public)/<modulo>/        # formularios públicos (familias) — sin login
src/app/gestion/<modulo>/         # paneles internos — detrás del login
src/app/api/<modulo>/...          # endpoints públicos del módulo (validados con Zod)
src/app/api/<modulo>/admin/...    # endpoints de gestión — SIEMPRE con guard de auth
src/lib/<modulo>.ts               # helpers puros (testeables, sin IO)
src/lib/<modulo>-server.ts        # queries Drizzle del módulo
src/lib/<modulo>-email.ts         # plantillas/envíos si el módulo manda correo
src/components/<modulo>/          # componentes propios del módulo
```

- **Guard de auth**: hoy es la cookie de `src/lib/licencias-auth.ts` (patrón `isAdmin()` al
  principio de cada handler). Desde el hito 2 se sustituye por `requireModule('<modulo>')` de
  la capa central — los módulos nuevos deben dejar el guard en UN solo helper por módulo para
  que ese cambio sea de una línea.
- **Server Actions vs route handlers**: los formularios públicos y las descargas usan route
  handlers (`route.ts`, como todo lo existente). Para mutaciones de paneles internos nuevos se
  permiten Server Actions si simplifican; en ese caso el guard de auth va dentro de la action.
- **Validación**: todo payload que entra por la red pasa por un schema Zod compartido entre
  cliente (react-hook-form resolver) y servidor.

## UI

- **shadcn/ui sobre @base-ui/react, NO Radix**: los Triggers (`PopoverTrigger`, `DialogTrigger`…)
  **no tienen `asChild`** — se les pasa `className` directamente o el render prop.
- Mobile-first pensado para **iPad** (los usuarios reales): objetivos táctiles generosos,
  botón de guardar sticky con `safe-area-inset`, formularios completables en <90s.
- **Dark mode automático** (next-themes): todo componente nuevo se revisa en claro y oscuro.
- Animaciones con `motion/react` (transiciones de confirmación, checks "latentes" — ver
  Licencias como referencia). Haptics con `ios-haptics`: `haptic()` tap, `haptic.confirm()`
  éxito, `haptic.error()` error.
- Gráficos con **recharts** (referencia: panel del ABC). Toasts con **sonner**. Iconos
  **lucide-react**. Marca: logo `public/logobur.png` y acento azul (referencia: portada y
  formulario de Licencias).
- Textos de interfaz **en castellano**, tono cercano (como "¿algo más?").

## Email (Resend)

- Cliente único en `src/lib/email.ts`; plantillas por módulo en `src/lib/<modulo>-email.ts`.
  No instanciar Resend en ningún otro sitio.
- Envíos masivos: batch de 100 (patrón de `/gestion/correos`), con variables `{nombre}`,
  `{apellidos}`, `{curso}`, vista previa y envío de prueba antes del masivo.

## Exportaciones y ficheros

- CSV de descarga: route handler protegido + generación en `src/lib/<modulo>-exports.ts`
  (referencia: `licencias-exports.ts`).
- Subida de archivos (desde Salidas en adelante): **Vercel Blob privado** vía `src/lib/blob.ts`,
  servido por ruta API que comprueba permisos. Límite ~10 MB, tipos `jpg/png/pdf/heic`,
  validados en servidor.
- Parseo de excels: **SheetJS (`xlsx`)** para `.csv/.xls/.xlsx`, detección de columnas por
  cabecera normalizada (mayúsculas sin acentos), nunca por posición.

## Datos personales (esto no es negociable)

- **Ningún export con datos reales se commitea.** `.gitignore` ya bloquea `*educamos*`; ante
  cualquier fichero nuevo con datos personales, primero gitignore, luego trabajar con él, y
  borrarlo al terminar.
- Fixtures de test: **datos inventados** que imiten la estructura real. Nunca recortes de
  ficheros reales.
- **Datos bancarios: no se importan ni se guardan** (decisión en `02-integracion-educamos.md`).
- No loguear datos personales (`console.log` de errores: sí el mensaje, no la fila entera).
- Minimización en pantalla pública: patrón de nombre enmascarado a 3 letras ("Dav.") de
  Licencias para cualquier búsqueda expuesta a familias.

## Definition of done (cada casilla de checklist)

1. `pnpm lint` y `pnpm build` pasan.
2. Verificado de verdad: prueba manual en dev o llamada a la API con datos reales de dev
   (no "debería funcionar").
3. La casilla `[ ]` de la ficha se marca `[x]` **en el mismo commit** que el código.
4. Si cambió el estado global de un módulo, se actualiza la tabla maestra de `plataforma.md`.
5. Decisiones nuevas que hayan surgido: apuntadas en `00-desarrollos-futuros.md`, nunca
   resueltas en silencio.
