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
pnpm typecheck    # tsc --noEmit (más rápido que build para solo tipos)
pnpm test         # vitest — helpers puros de src/lib/*.ts (sin IO)
pnpm db:push      # aplicar schema a Neon (drizzle-kit push)
pnpm db:studio    # inspeccionar la BBDD
pnpm db:seed:licencias   # seeds puntuales (tsx + dotenv .env.local)
pnpm tokens:familias     # genera los magic links de las familias de la campaña de licencias
```

## Variables de entorno

En uso hoy (`.env.local` local · Settings→Environment Variables en Vercel):

| Var | Para qué |
|---|---|
| `DATABASE_URL` | Neon (pooled connection string) |
| `RESEND_API_KEY` · `RESEND_FROM` | Envío de email |
| `LICENCIAS_GESTORES` | Lista de correos de aviso de Licencias |
| `GOOGLE_SHEETS_CLIENT_EMAIL` · `GOOGLE_SHEETS_PRIVATE_KEY` · `GOOGLE_SHEETS_SPREADSHEET_ID` | Cuenta de servicio para escribir en el Sheet de Licencias |
| `APP_BASE_URL` | URL pública para los enlaces que van por correo (magic links). Opcional: por defecto `https://tools.consolacionburriana.com`. En local, `http://localhost:3000` |

| `AUTH_SECRET` · `AUTH_GOOGLE_ID` · `AUTH_GOOGLE_SECRET` | Login Google (Auth.js v5) |

| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (justificantes de Salidas) |

Cualquier var nueva se añade a esta tabla y a `.env.local.example` en el mismo commit que el
código que la usa.
Ya retiradas: las de `licencias-auth` (el login por cookie murió con el hito 2).

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

- **Guard de auth**: `src/lib/auth-guards.ts` — `requireModule('<modulo>')` /
  `hasModule('<modulo>')` en route handlers de gestión, `requireSession()` para endpoints que
  solo exigen claustro (formulario ABC), y `canAccess()` en el layout de cada sección de
  `/gestion/<modulo>`. `src/proxy.ts` (Next 16, sustituye a middleware) solo exige sesión.
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
  Licencias como referencia). Haptics con `ios-haptics` vía `src/lib/haptics.ts`:
  `haptic.tap()` toque, `haptic.success()` éxito, `haptic.warning()` error/aviso.
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
- Subida de archivos: **Vercel Blob privado** vía `src/lib/blob.ts` (ya existe; lo estrenó
  Salidas). Límite 10 MB, tipos `jpg/png/pdf/heic` validados en servidor; se sirve SIEMPRE por
  ruta API que comprueba permisos, nunca URL pública.
- **Identificación pública de familias**: nunca por nombre/apellidos. Usa
  `identifyFamily`/`verifyFamilyStudent` de `src/lib/familias-server.ts` (DNI tutor / NIA /
  token) y muestra solo `maskAlumno` ("Fra. M. Luc."). En cada petición posterior del flujo se
  revalida el identificador contra el alumno (los flujos públicos no tienen sesión).
- **Magic links de familias** (`fam_access_tokens`, `src/lib/fam-tokens-server.ts`): un token por
  **correo de tutor** que cubre a todos sus hijos; el formulario público lo lee de `?t=tok_…` y
  lo usa como identificador en el resto del flujo. Para estrenarlo en un módulo nuevo:
  `getFamiliasDeAlumnos` → `ensureTokens({ proposito })` → `urlAccesoFamilia(appBaseUrl(), …)`.
  Son **credenciales**: nunca se loguean, ni se listan en pantalla, ni se commitea el CSV.
  En los correos a familias sí se puede poner el nombre de pila de sus propios hijos (va a la
  dirección de sus tutores); el enmascarado es obligatorio en **pantalla**.
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

0. `pnpm test` pasa (si tocaste algún helper puro de `src/lib/*.ts`).
1. `pnpm lint` y `pnpm build` pasan.
2. Verificado de verdad: prueba manual en dev o llamada a la API con datos reales de dev
   (no "debería funcionar").
3. La casilla `[ ]` de la ficha se marca `[x]` **en el mismo commit** que el código.
4. Si cambió el estado global de un módulo, se actualiza la tabla maestra de `plataforma.md`.
5. Decisiones nuevas que hayan surgido: apuntadas en `00-desarrollos-futuros.md`, nunca
   resueltas en silencio.
