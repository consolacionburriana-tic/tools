# Autenticación y roles/permisos · plan y checklist

Pieza transversal de la que dependen todos los módulos. Sustituye a las soluciones "de andar
por casa" que hay hoy: Registro ABC sin login y Licencias con un email/password fijo
(`src/lib/licencias-auth.ts`). Es el **hito 2 del roadmap** (ver `plataforma.md`).

---

## Estado: implementado ✅ (2026-07-10) — pendiente solo la prueba real del flujo OAuth por David

## Decisiones cerradas

- **Login único con Google.** Ninguna cuenta/contraseña propia de la app.
- **Para administración/gestión, solo cuentas del dominio del colegio.** Los módulos públicos
  (formularios de familias) siguen abiertos sin login, aunque un módulo concreto puede decidir
  exigir login del colegio.
- **El acceso se controla por rol** (no módulo a módulo por usuario). Roles base:
  `profe` · `tutor` · `jefe` (jefe de departamento / coordinador de ciclo, es el mismo) ·
  `direccion` · `tic` · `orientacion` · `secretaria` · `supertic`.
- **`supertic`** es el super-admin: gestiona la pantalla de usuarios/roles y accede a todo.
- **Grupos de usuarios encima del rol** (David, 12-nov-2026): equipos como Pastoral o Comunicación,
  se puede estar en varios, y cada uno da sus módulos a sus miembros. **Lo que da un grupo se da
  entero (todo el centro)**; los «subaccesos» dentro de un módulo, más adelante. Ver «Grupos» abajo.
- **Profe activo = rol `profe` automático** (decisión 2026-07-10): cualquier cuenta del dominio
  que sea profe activo en `edu_teachers` entra como `profe` sin alta manual en `auth_users`;
  la fila explícita en `auth_users` solo hace falta para roles superiores (o para vetar).

## Plan técnico

### Proveedor: Auth.js (NextAuth v5) con provider Google

Elegido frente a Clerk por coste cero, control total y porque solo necesitamos un provider.
Estrategia **JWT** (sin tablas de sesión); la autorización se resuelve contra `auth_users`.
**Tope de sesión del profesorado** (David, 2-nov-2026): `profe` y `tutor` vuelven a entrar con Google
60 días después de su último login (`sesionCaducada`, `src/lib/sesion.ts`), aunque usen la app a diario;
el resto de roles solo caduca la cookie de un curso.

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

**Dos capas de permisos** (la segunda se añadió el 2026-08-27):

1. **La matriz rol→módulos vive en código**, en `src/lib/permissions.ts`. El rol es el punto de
   partida de un clic y cambiarlo afecta a todo el mundo con ese rol.
2. **El ajuste fino por persona vive en `auth_users`** (`modulos_extra` / `modulos_bloqueados`).
   Es la excepción: "este tutor ADEMÁS lleva las evaluaciones", sin dejar de ser tutor ni perder
   Salidas y Banco de libros.

Se guarda como **diferencia**, nunca como lista cerrada: si mañana se le añade un módulo al rol
tutor, les llega a todos los tutores menos a quien lo tuviera bloqueado a mano. Y **al cambiar de
rol se limpian los ajustes**, porque estaban pensados sobre el rol anterior.

```ts
export const MODULES = ['abc', 'licencias', 'salidas', 'bancolibros', 'evaluaciones', 'educamos', 'usuarios'] as const;
export const ROLE_MODULES: Record<Role, Module[]> = {
  supertic:   [...MODULES],
  tic:        [...MODULES],
  direccion:  ['abc', 'licencias', 'salidas', 'bancolibros', 'evaluaciones', 'educamos'],
  jefe:       ['salidas', 'bancolibros', 'evaluaciones'],
  orientacion:['abc', 'evaluaciones'],
  secretaria: [...MODULES],   // desde el 23-sep-2026: todo, como TIC (David: «son los DIOSES»)
  tutor:      ['salidas', 'bancolibros', 'evaluaciones'],
  profe:      ['salidas', 'bancolibros', 'evaluaciones'],
};
```

> La asignación de arriba es la **propuesta por defecto** — ajustarla es un cambio de una línea.
> Matices *dentro* de un módulo (p. ej. "profe solo ve sus salidas, dirección ve todas") se
> resuelven en el propio módulo consultando `session.role`, no aquí.

Helpers de `permissions.ts`: `modulosDe(acceso)` (lista efectiva), `canAccess(acceso, modulo)`,
`origenModulo(acceso, modulo)` (`rol` | `extra` | `bloqueado` | `no`, para pintar la interfaz) y
`diffModulos(rol, seleccionados)` (traduce lo que se marca en pantalla a la diferencia guardada).

> ⚠️ `canAccess` recibe el **usuario entero**, no su rol. Pasarle solo el rol se saltaría los
> ajustes por persona sin que nadie se entere; por eso la firma es `Acceso`, para que el
> compilador cante si alguien lo hace.

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

`/gestion/usuarios` (solo `supertic`/`tic`): listado, alta por email, chips de rol (un clic),
activar/desactivar y — por persona — un **desplegable de módulos** con el ajuste fino. Los
módulos se pintan según de dónde vengan: azul los del rol, verde los dados a mano, rojo tachado
los quitados a mano. `usuarios` y `educamos` salen marcados como delicados (`MODULOS_SENSIBLES`).
Autoprotección: nadie puede quitarse a sí mismo `usuarios`.

El rol y los ajustes se refrescan contra la BBDD **cada 15 minutos sin re-login** (van en el JWT,
ver `REFRESCO_ROL_MS` en `src/auth.ts`), así que un cambio de permisos tarda como mucho ese rato
en surtir efecto.

### Grupos de usuarios (12-nov-2026)

Tercera capa, entre el rol y el ajuste por persona: **rol ∪ grupos ∪ dados a mano − quitados a mano**.

- **Tablas** `auth_grupos` (nombre único sin mirar mayúsculas, descripción, `modulos` jsonb) y
  `auth_grupo_miembros` (grupo + email en minúsculas). SQL: `src/db/sql/auth-grupos.sql`, que siembra
  **Pastoral** con Números y Evaluaciones (sin miembros).
- **Viven en la BBDD, no en código**, a diferencia de los roles: se crean y se editan desde
  `/gestion/usuarios` → vista **Grupos** (módulos que da, meter/sacar personas, borrar). API
  `POST /api/usuarios/grupos` (`crear` · `editar` · `miembro` · `borrar`), con `requireModule('usuarios')`.
- **Solo suman**. Un grupo no puede dar lo reservado a SuperTIC (`MODULOS_DE_GRUPO`). Lo quitado a mano a
  una persona gana al grupo. Sin rol, un grupo no da nada. A un profe del claustro sin fila en
  `auth_users` también le valen sus grupos.
- **Lo que da un grupo se da entero**: `moduloPorGrupo(acceso, m)` en `permissions.ts`. Hoy lo miran
  `veTodoElCentro` (Alumnado y Números: todo el centro en vez de la etapa), `veProteccionDatosCompleta`
  y las pestañas Perfil y Becas de Números. Un módulo nuevo con alcance propio tiene que mirarlo también.
- **Sesión**: `resolverAcceso` lee los grupos en la misma tanda que la fila (`modulosDeGruposDe`) y van
  en el JWT como `modulosGrupos`, así que un cambio de grupo tarda como mucho los mismos 15 min. Si las
  tablas faltaran en Neon, se entra sin grupos en vez de romper el login.
- **En la vista Personas**: debajo del correo, sus grupos; en el desplegable de módulos, en índigo lo que
  le viene de un grupo (al pasar por encima dice de cuál). El ajuste a mano se guarda como diferencia
  respecto a rol **y** grupos (`diffModulos(rol, seleccionados, modulosGrupos)`).

### Emulación de usuarios (9-nov-2026)

Un **SuperTIC** puede «entrar como» otra persona para ver la plataforma tal como la ve ella (su rol, sus
módulos, sus ajustes) y comprobar permisos. **Estado: implementado 🟡 — falta probarlo con sesión real y Neon
(David).**

- **Entrar**: botón **Emular** (ámbar, `ui/boton-emular.tsx`) en cada fila de `/gestion/usuarios`, junto a los
  chips de rol, y en `/gestion/profes`, en la tarjeta plegable **«Entrar como…»** (`profes/emular-panel.tsx`, con
  buscador). Solo lo ve el SuperTIC; no sale en tu propia fila ni en quien no tiene acceso. Lleva al escritorio como esa persona.
- **Saber que estás emulando**: pestañita pequeña colgada del borde de arriba, con un punto que late, «Emulando a
  *Nombre*» y **Salir** (`ui/indicador-emulacion.tsx`, en el layout raíz: sale en todas las pantallas, también
  `/mi-horario`). Más una línea fina ámbar en el borde. Salir devuelve a `/gestion/usuarios`.
- **Cómo funciona**: cookie httpOnly `tools_emulando` = `real|objetivo`. `getSessionUser()` (`auth-guards.ts`) la
  lee y, **solo si la sesión real es SuperTIC y el `real` de la cookie es esa misma persona**, devuelve al usuario
  emulado (rol y módulos resueltos contra la BBDD por petición) con `emulando: { email, nombre }` = quién eres de
  verdad. Así **todos los guards y layouts existentes funcionan sin tocarlos**. Copiar o forjar la cookie no sirve
  de nada. `getSessionReal()` da la sesión sin emular (la usa `POST /api/emulacion`). Caduca a las 8 h.
- **API**: `POST /api/emulacion {email}` (empezar; 403 si no eres SuperTIC, si eres tú o si la otra persona no tiene
  acceso) · `DELETE` (salir; vale siempre) · `GET` (¿se está emulando?, para que el indicador no se fíe de una
  cookie vieja). Puro y con tests: `src/lib/emulacion.ts`.
- **Lo que se escribe emulando se escribe de verdad** (para poder probar funciones), pero con firma honesta: el
  libro de cambios de Alumnado y el banco de libros anotan `real (emulando a objetivo)` (`autorDe()`).
- **Lo que se bloquea emulando**, porque actuaría en la cuenta de Google de la persona emulada
  (`bloquearSiEmulando()`, 403 con explicación): guardar listas/informes de Alumnado en Drive, y exportar/deshacer/
  listar calendarios de «Mi horario». La nota de Nouvinguts «mandar también por correo» se guarda pero **no se envía**.
- Cerrar sesión desde el escritorio también borra la emulación.

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
- [x] OAuth client creado y env vars puestas (pasitos de arriba — David)
- [x] Instalar Auth.js v5, config con provider Google + restricción de dominio server-side (`src/auth.ts`)
- [x] Tabla `auth_users` + `src/lib/permissions.ts` con la matriz por defecto
- [x] Seed inicial: los 5 `supertic` (Bárbara, Amparo, José Miguel, tic@, David)

### Fase 1 · Login
- [x] Página de login con Google (diseño con logo, en `/gestion/login`)
- [x] Sesión JWT de **10 meses** (dura el curso; el rol se refresca contra BBDD cada 15 min) + logout en el escritorio
- [x] Pantalla "sin acceso, pide alta al TIC" (`/gestion/sin-acceso`)

### Fase 2 · Permisos por módulo
- [x] `src/proxy.ts` (Next 16; middleware está deprecado) protege `/gestion/*`, `/admin/*` y `/registro-abc`
- [x] `requireModule()`/`hasModule()` para rutas API + `canAccess()` en layouts por módulo (`src/lib/auth-guards.ts`)
- [x] `/gestion/usuarios`: asignación de rol en 1 click por fila + alta por email (solo tic/supertic)

### Emulación
- [x] Cookie + `getSessionUser` emulado + `POST/DELETE/GET /api/emulacion` + tests puros (`emulacion.test.ts`)
- [x] Botón «Emular» en `/gestion/usuarios` e indicador «Emulando a…» con «Salir» (claro/oscuro, 390 y 1180 px)
- [x] Verificado: 401 sin sesión, 403 sin ser SuperTIC o a uno mismo, cookie forjada/ajena ignorada
- [ ] **Probar con sesión real y Neon**: emular a un profe, a un tutor y a dirección, ver sus módulos, salir

### Grupos de usuarios
- [x] Tablas `auth_grupos` + `auth_grupo_miembros` aplicadas en Neon, con Pastoral sembrado (Números y Evaluaciones)
- [x] `permissions.ts`: capa de grupos en `modulosDe`/`canAccess`/`origenModulo`/`diffModulos` + `moduloPorGrupo`, con tests
- [x] Sesión: `modulosGrupos` en el JWT, en la emulación y en `getSessionUser`
- [x] Alcance entero por grupo en Alumnado y Números (todo el centro, Perfil y Becas)
- [x] `/gestion/usuarios` → vista Grupos (módulos, personas, crear, borrar) y grupos visibles en Personas
- [ ] **Meter a las personas de Pastoral** y comprobarlo emulando a una (David)

### Fase 3 · Migración de los módulos existentes (= hito 3 del roadmap)
- [x] Registro ABC detrás del nuevo login (panel movido a `/gestion/abc`; `/admin` redirige)
- [x] Licencias detrás del nuevo login en `/gestion/licencias` (retirado `licencias-auth.ts` y sus rutas de cookie)
- [x] La portada `/` sigue siendo de familias (campaña de licencias); el papel de "módulos según tu rol" lo cumple el escritorio `/gestion`
