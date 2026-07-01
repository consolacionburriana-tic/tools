# Autenticación y roles/permisos · plan y checklist

Pieza transversal de la que dependen todos los módulos. Sustituye a las soluciones "de andar
por casa" que hay hoy: Registro ABC sin login y Licencias con un email/password fijo
(`src/lib/licencias-auth.ts`).

---

## Estado: sin empezar ⬜

Todavía no hay ni plan técnico ni implementación. Hay decisiones funcionales por cerrar antes
de diseñar el schema (ver `docs/desarrollos-futuros.md` → sección Autenticación y roles).

## Objetivo funcional

- **Login único con Google.** Ninguna cuenta/contraseña propia de la app; se entra con una
  cuenta de Google.
- **Acceso por módulo.** Cada usuario tiene acceso a un subconjunto de módulos, configurable
  desde una pantalla sencilla de administración (marcar/desmarcar módulos por usuario).
- **Roles.** Se pueden agrupar permisos en roles (p. ej. "jefe de departamento") y asignar el rol
  a un usuario en vez de marcar módulo a módulo.
- **Pantalla de configuración sencilla**, pensada para que la use dirección/coordinación sin
  ayuda técnica: alta de usuario, asignación de rol y/o módulos sueltos.

## Decisiones pendientes

Ver la sección "Autenticación y roles" en [`desarrollos-futuros.md`](./desarrollos-futuros.md).
Un apunte técnico ya intuido, sujeto a las decisiones: probablemente hará falta una tabla de
`users` (identificados por email de Google), una de `roles` con sus permisos por módulo, y una
tabla puente `user_module_access` para las excepciones por usuario que no vengan del rol.

## Apartado técnico (orientativo, a concretar cuando se cierren decisiones)

- Proveedor de auth: Google OAuth (candidatos a evaluar: NextAuth/Auth.js con provider Google,
  o Clerk ya mencionado en el README histórico — a decidir cuando se aborde esta fase).
- Middleware de Next.js para proteger rutas de `gestion/*` y `admin/*` según módulo.
- Prefijo de tablas propuesto: `auth_*` (a confirmar al diseñar el schema).

## Fases

### Fase 0 · Decisiones y diseño de schema
- [ ] Cerrar decisiones funcionales (ver arriba)
- [ ] Elegir proveedor de auth (NextAuth/Clerk/otro)
- [ ] Diseñar tablas `users` / `roles` / `user_module_access`

### Fase 1 · Login
- [ ] Login con Google funcionando
- [ ] Sesión persistente (cookie) y logout

### Fase 2 · Permisos por módulo
- [ ] Middleware que restringe rutas según módulos permitidos del usuario
- [ ] Pantalla de administración de accesos (usuarios, roles, módulos)

### Fase 3 · Migración de los módulos existentes
- [ ] Registro ABC (`/admin`) detrás del nuevo login
- [ ] Licencias (`/gestion`) detrás del nuevo login (retirar `licencias-auth.ts`)