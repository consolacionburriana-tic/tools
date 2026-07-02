# Autenticación y roles/permisos · plan y checklist

Pieza transversal de la que dependen todos los módulos. Sustituye a las soluciones "de andar
por casa" que hay hoy: Registro ABC sin login y Licencias con un email/password fijo
(`src/lib/licencias-auth.ts`). Es el **hito 2 del roadmap** (ver `plataforma.md`).

---

## Estado: plan técnico listo ✅ · implementación sin empezar ⬜

## Decisiones cerradas

- **Login único con Google.** Ninguna cuenta/contraseña propia de la app.
- **Para administración/gestión, solo cuentas del dominio del colegio.** Los módulos públicos
  (formularios de familias) siguen abiertos sin login, aunque un módulo concreto puede decidir
  exigir login del colegio.
- **El acceso se controla por rol** (no módulo a módulo por usuario). Roles base:
  `profe` · `tutor` · `jefe` (jefe de departamento / coordinador de ciclo, es el mismo) ·
  `direccion` · `tic` · `orientacion` · `secretaria` · `supertic`.
- **`supertic`** es el super-admin: gestiona la pantalla de usuarios/roles y accede a todo.

## Plan técnico

### Proveedor: Auth.js (NextAuth v5) con provider Google

Elegido frente a Clerk por coste cero, control total y porque solo necesitamos un provider.
Estrategia **JWT** (sin tablas de sesión); la autorización se resuelve contra `auth_users`.

- Restricción de dominio: parámetro `hd` en el provider **y** verificación server-side del
  dominio del email en el callback `signIn` (el `hd` solo es cosmético).
- Env vars: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` (crear OAuth client en Google
  Cloud Console con redirect `https://tools.consolacionburriana.com/api/auth/callback/google`).

### Schema (`auth_*`)

```ts
auth_users (
  id uuid pk,
  email text unique not null,        // email Google del dominio
  nombre text,
  role text not null,                // 'profe'|'tutor'|'jefe'|'direccion'|'tic'|'orientacion'|'secretaria'|'supertic'
  active boolean default true,
  created_at, updated_at
)
```

Sin tabla de permisos: **la matriz rol→módulos vive en código**, en `src/lib/permissions.ts`:

```ts
export const MODULES = ['abc', 'licencias', 'salidas', 'bancolibros', 'evaluaciones', 'educamos', 'usuarios'] as const;
export const ROLE_MODULES: Record<Role, Module[]> = {
  supertic:   [...MODULES],
  tic:        [...MODULES],
  direccion:  ['abc', 'licencias', 'salidas', 'bancolibros', 'evaluaciones', 'educamos'],
  jefe:       ['salidas', 'bancolibros', 'evaluaciones'],
  orientacion:['abc', 'evaluaciones'],
  secretaria: ['licencias', 'salidas', 'bancolibros'],
  tutor:      ['salidas', 'bancolibros', 'evaluaciones'],
  profe:      ['salidas', 'bancolibros', 'evaluaciones'],
};
```

> La asignación de arriba es la **propuesta por defecto** — ajustarla con David al implementar
> es un cambio de una línea, por eso no bloquea. Matices *dentro* de un módulo (p. ej. "profe
> solo ve sus salidas, dirección ve todas") se resuelven en el propio módulo consultando
> `session.role`, no aquí.

### Protección de rutas

- `middleware.ts` (o `proxy.ts` según la versión de Next 16 — comprobar
  `node_modules/next/dist/docs/` antes de tocar) protege `/gestion/*` y `/admin/*`:
  sin sesión → redirect a login; con sesión, el **layout de cada sección** comprueba
  `canAccess(role, modulo)` y muestra 403 amable si no toca.
- Helper `requireModule(modulo)` para las rutas API de gestión (sustituye al patrón
  `isAdmin()` con cookie de `licencias-auth.ts`).
- Usuario no dado de alta en `auth_users` = puede autenticarse con Google pero ve pantalla
  "pídele acceso al equipo TIC" (alta previa por supertic/tic; sin auto-registro).

### Pantalla de usuarios

`/gestion/usuarios` (solo `supertic`/`tic`): listado, alta por email, selector de rol,
activar/desactivar. Sin más — la matriz es por rol y vive en código.

### Migración de lo existente (hito 3 del roadmap)

1. Registro ABC: mover `/admin` detrás del login (roles con módulo `abc`).
2. Licencias: sustituir cookie propia por sesión + `requireModule('licencias')` en las ~15
   rutas `api/licencias/admin/*`; retirar `src/lib/licencias-auth.ts` y sus env vars.
3. La portada `/` muestra solo los módulos a los que el usuario tiene acceso (si hay sesión).

## Fases

### Pasitos para David · crear el OAuth client (una vez, ~10 min)

1. Entra en [console.cloud.google.com](https://console.cloud.google.com) con tu cuenta del
   dominio. Crea (o elige) un proyecto, p. ej. `tools-consolacion`.
2. **APIs y servicios → Pantalla de consentimiento OAuth**: tipo **Interno** (solo cuentas del
   dominio — así Google ni pide verificación). Nombre "Tools Consolación", tu email de soporte.
3. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**:
   - Tipo: **Aplicación web**, nombre "Tools Consolación".
   - URIs de redireccionamiento autorizados (los dos):
     - `https://tools.consolacionburriana.com/api/auth/callback/google`
     - `http://localhost:3000/api/auth/callback/google`
4. Copia el **Client ID** y el **Client secret** y mételos en Vercel (proyecto → Settings →
   Environment Variables) y en tu `.env.local`:
   - `AUTH_GOOGLE_ID` = client ID · `AUTH_GOOGLE_SECRET` = client secret
   - `AUTH_SECRET` = el resultado de `openssl rand -base64 32` en tu terminal

### Fase 0 · Cimientos
- [ ] OAuth client creado y env vars puestas (pasitos de arriba — David)
- [ ] Instalar Auth.js v5, config con provider Google + restricción de dominio server-side
- [ ] Tabla `auth_users` + `src/lib/permissions.ts` con la matriz por defecto
- [ ] Seed inicial: David como `supertic`

### Fase 1 · Login
- [ ] Página de login con Google (diseño con logo, como el login actual de Licencias)
- [ ] Sesión JWT + logout
- [ ] Pantalla "sin acceso, pide alta al TIC" para autenticados sin fila en `auth_users`

### Fase 2 · Permisos por módulo
- [ ] Middleware protegiendo `/gestion/*` y `/admin/*`
- [ ] `requireModule()` para rutas API + `canAccess()` para layouts
- [ ] `/gestion/usuarios`: CRUD de usuarios y roles (solo tic/supertic)

### Fase 3 · Migración de los módulos existentes (= hito 3 del roadmap)
- [ ] Registro ABC (`/admin`) detrás del nuevo login
- [ ] Licencias (`/gestion`) detrás del nuevo login (retirar `licencias-auth.ts`)
- [ ] Portada `/` sensible a la sesión (muestra los módulos permitidos)
