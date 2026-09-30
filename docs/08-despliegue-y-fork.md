# Desplegar Tools en tu colegio (fork) · guía rápida

Esta guía dice **dónde se hace cada cosa** para tener tu propia copia funcionando con tus cuentas.
No explica los módulos (eso es [`plataforma.md`](./plataforma.md)) ni cómo se programa aquí
([`04-convenciones-tecnicas.md`](./04-convenciones-tecnicas.md)).

> **Estado de esta guía:** escrita leyendo el código y la configuración reales del repo. El
> despliegue desde cero en un colegio ajeno **todavía no se ha ensayado de punta a punta**: si
> un paso falla, corrígelo aquí mismo para el siguiente.

## 0 · Qué necesitas antes de empezar

| Necesitas | Para qué | ¿Obligatorio? | Cómo registrarte |
|---|---|---|---|
| Cuenta de **GitHub** | Tu fork | Sí | [github.com/signup](https://github.com/signup) |
| Cuenta de **Vercel** | Hosting, crons y almacenamiento de archivos (Blob) | Sí | [vercel.com/signup](https://vercel.com/signup) → *Continue with GitHub* (así ya queda enlazado a tu fork) |
| Cuenta de **Neon** | Base de datos Postgres | Sí | [neon.tech](https://neon.tech) → *Sign up* (con GitHub o Google) |
| **Google Workspace for Education** con dominio propio y acceso de **superadministrador** | Login del claustro (solo cuentas del dominio) y todo lo que use Gmail/Calendar/Classroom/Drive | Sí — el login está hecho solo para Google | La cuenta del colegio ya la tiene; para Google Cloud entra con ella en [console.cloud.google.com](https://console.cloud.google.com) y acepta las condiciones |
| Cuenta de **Resend** | Correo saliente si no quieres usar Gmail | No (alternativa) | [resend.com/signup](https://resend.com/signup) |
| Exportación de alumnado/profesorado de **Educamos** | Cargar la BBDD central | Para casi todos los módulos (ver §4) | La saca secretaría desde Educamos |
| Node 20+ y `pnpm` en tu ordenador | Aplicar la base de datos y probar en local | Sí | [nodejs.org](https://nodejs.org) y `npm i -g pnpm` |

> Los tres servicios de pago por uso (Vercel, Neon, Resend) tienen plan gratuito; los límites
> cambian, míralos en su web antes de decidir.

## 1 · Los pasos, en orden: qué se hace y dónde

| # | Paso | Dónde | Qué haces | Te llevas |
|---|---|---|---|---|
| 1 | **Fork** | github.com → botón *Fork* | Crea tu copia. Clónala: `git clone <tu-fork> && cd tools && pnpm install` | Repo tuyo |
| 2 | **Base de datos** | [neon.tech](https://neon.tech) → *New project* | Elige una **región de la UE** (son datos de menores). Luego botón *Connect* del proyecto → activa *Connection pooling* y copia la *connection string* | `DATABASE_URL` |
| 3 | **Proyecto en Vercel** | [vercel.com/new](https://vercel.com/new) | Importa tu fork (Next.js, sin tocar nada del build). El primer deploy compilará pero no funcionará hasta el paso 10 (faltan variables) | Proyecto + URL `*.vercel.app` |
| 4 | **Almacén de archivos** | Vercel → proyecto → *Storage* → *Blob* → *Create* y conectar al proyecto | Sirve para los justificantes de Salidas | `BLOB_READ_WRITE_TOKEN` (se añade sola) |
| 5 | **Login con Google** | [console.cloud.google.com](https://console.cloud.google.com) → proyecto nuevo → *APIs y servicios* → *Pantalla de consentimiento OAuth* (tipo **Interno**) → *Credenciales* → *ID de cliente OAuth* (tipo *Aplicación web*) | Redirecciones autorizadas: `https://TU-DOMINIO/api/auth/callback/google` **y** `http://localhost:3000/api/auth/callback/google` | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` |
| 6 | **Secreto de sesión** | Tu terminal | `openssl rand -base64 32` | `AUTH_SECRET` |
| 7 | **Cuenta de servicio de Google** *(§3: solo si usas correo por Gmail, Calendar, Classroom, Drive o Sheets)* | Mismo proyecto de Google Cloud → *IAM y administración* → *Cuentas de servicio* → crear → *Claves* → JSON. Y en *APIs y servicios → Biblioteca*, **habilita** las APIs que uses (Gmail, Calendar, Classroom, Admin SDK, Drive, Sheets) | Del JSON: `client_email` y `private_key` | `GOOGLE_SA_CLIENT_EMAIL`, `GOOGLE_SA_PRIVATE_KEY` |
| 8 | **Delegación de todo el dominio** *(continuación del 7)* | [admin.google.com](https://admin.google.com) → *Seguridad* → *Acceso y control de datos* → *Controles de API* → *Delegación en todo el dominio* → *Añadir* | Pega el **Client ID** numérico de la cuenta de servicio y los *scopes* de la tabla del §3 | Permiso para suplantar buzones |
| 9 | **Correo** | Elige una: **Gmail** (paso 7-8 con `gmail.send`, `EMAIL_TRANSPORTE=gmail`) o **Resend** ([resend.com](https://resend.com) → verificar tu dominio → *API key*) | Los remitentes tienen que existir como buzones reales del dominio (o alias) si usas Gmail | `EMAIL_TRANSPORTE`, `RESEND_API_KEY`… |
| 10 | **Variables de entorno** | Vercel → proyecto → *Settings* → *Environment Variables* (y `.env.local` en tu ordenador: `cp .env.local.example .env.local`) | Pon todo lo anterior + `APP_BASE_URL` (la URL pública, sin barra) + `CRON_SECRET` (cualquier cadena larga aleatoria). Lista completa y qué hace cada una: [tabla de variables](./04-convenciones-tecnicas.md#variables-de-entorno) | Entorno completo |
| 11 | **Crear las tablas** | Tu ordenador, con `DATABASE_URL` en `.env.local` | Ver **§2** (el orden importa) | BBDD lista |
| 12 | **Primer administrador** | Neon → *SQL Editor* | Ver **§5**. Sin esta fila nadie puede entrar a `/gestion/usuarios` | Tu usuario `supertic` |
| 13 | **Tu identidad** (dominio, nombres, logo) | El código de tu fork | Ver **§6** — es lo que más tiempo lleva | Fork con tu marca |
| 14 | **Redeploy** | Vercel → *Deployments* → *Redeploy* (o `git push`) | Con variables y código ya puestos | App viva |
| 15 | **Dominio propio** *(opcional)* | Vercel → *Settings* → *Domains* + tu DNS (`CNAME` a `cname.vercel-dns.com`) | Cuando funcione: cambia `APP_BASE_URL` en Vercel y **añade la redirección OAuth** del dominio nuevo (paso 5) | `tools.tu-colegio.es` |
| 16 | **Cargar alumnado y profesorado** | Ya dentro: `/gestion/educamos` | Ver **§4** | BBDD central poblada |

**Comprobación final:** entra a `https://TU-URL/gestion` con tu cuenta del dominio → debe llevarte
al escritorio con todas las tarjetas (eres `supertic`).

## 2 · Crear las tablas (paso 11) — el orden importa

`src/db/schema.ts` define casi todas las tablas, pero **cuatro (`lic_licencias`, `lic_envios`,
`lic_pedidos_editorial`, `lic_ajustes_pedido`) solo existen como SQL** en `src/db/sql/`. Por eso,
en una base **vacía**, son dos comandos y en este orden:

```bash
pnpm db:push                                                    # 1) tablas de schema.ts
pnpm db:sql $(ls src/db/sql/*.sql | xargs -n1 basename)         # 2) TODO el SQL aditivo (idempotente)
```

- El 2 también mete los datos semilla imprescindibles (tipos de actividad de horarios, asignaturas
  y consecuencias de Puntualidad, Oratorios…). Los ficheros son idempotentes: repetirlo no rompe nada.
- `tutorias-2026-27.sql` es específico del curso de Consolación: sobre una base vacía no hace nada.
- ⚠️ **Después de esto, no vuelvas a lanzar `pnpm db:push`** contra esa base: no conoce esas
  cuatro tablas y propondrá borrarlas. Los cambios de schema posteriores se aplican con SQL
  aditivo (`pnpm db:sql`, ver [`04-convenciones-tecnicas.md`](./04-convenciones-tecnicas.md#base-de-datos-drizzle--neon)).
- Para traer novedades del repo original: `git remote add upstream <url-del-repo-original>`,
  `git pull upstream main` y luego `pnpm db:sql --pendientes` (el fichero `src/db/sql/pendientes.txt` lista lo que falta).

## 3 · Qué necesita cada módulo (empieza por el mínimo)

**Mínimo para arrancar:** pasos 1-6, 10-12, 14 (Neon + Vercel + login). Con eso funcionan
Registro ABC, Puntualidad, Evaluaciones, Números, Alumnado, Horarios, Tareas… (sin
correos). El resto se activa añadiendo piezas cuando las necesites:

| Si quieres… | Necesitas además | Variables / permisos |
|---|---|---|
| **Enviar correos** (avisos, licencias, evaluaciones…) | Paso 9 | `EMAIL_TRANSPORTE`, `EMAIL_FROM_*`, `RESEND_API_KEY` |
| Correo **por Gmail** | Pasos 7-8 con `gmail.send` | `GOOGLE_SA_*`, `EMAIL_BUZON_*` si el remitente es alias/grupo |
| **Salidas y pagos** con justificantes | Paso 4 | `BLOB_READ_WRITE_TOKEN` |
| **Licencias**: Sheet histórico / pedidos a editoriales en Drive | Pasos 7-8; crea tu propia **plantilla de pedido** (Google Sheet) y una **carpeta de Drive** y comparte ambas con el `client_email` de la cuenta de servicio | `GOOGLE_SHEETS_SPREADSHEET_ID`, `LICENCIAS_PLANTILLA_PEDIDO`, `LICENCIAS_CARPETA_PEDIDOS`, `LICENCIAS_GESTORES` (⚠️ sin las dos últimas se usan los IDs del colegio original y fallará) |
| **Cuaderno de tutor** (documentos en Drive) | Pasos 7-8 | scopes `drive`, `spreadsheets` |
| **Mi horario** / **Oratorios** (Google Calendar) | Pasos 7-8 | scope `calendar` |
| **Calendarios y Classrooms** (limpieza del dominio) | Pasos 7-8 con un buzón administrador | scopes Directory + Classroom + Calendar, `GOOGLE_ADMIN_BUZON` |
| **Crons** (resumen semanal, worker del cuaderno, foto mensual, avisos de Oratorios) | Nada: ya están en `vercel.json` | `CRON_SECRET` (el plan *Hobby* de Vercel limita los crons a una ejecución al día; los cuatro actuales lo cumplen — comprueba los límites de tu plan) |
| **AUTOASM** (Apple School Manager) | Cuenta ASM del colegio | `AUTOASM_CRYPTO_KEY` (opcional) |

**Scopes de la delegación (paso 8)** — añade solo los de los módulos que uses, separados por comas:

```
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/drive
https://www.googleapis.com/auth/spreadsheets
https://www.googleapis.com/auth/admin.directory.user.readonly
https://www.googleapis.com/auth/classroom.courses
https://www.googleapis.com/auth/classroom.courses.readonly
https://www.googleapis.com/auth/classroom.rosters
```

## 4 · Alumnado y profesorado (paso 16)

Casi todos los módulos leen de la **BBDD central** (`edu_*`), que se carga desde un export de
**Educamos** en `/gestion/educamos` (vista previa → confirmar → upsert; se repite cuando cambia
el alumnado). Los ficheros con datos personales **nunca se commitean** (`.gitignore` ya bloquea
`*educamos*`). Si tu colegio **no usa Educamos**, tienes que adaptar el lector
[`src/lib/educamos.ts`](../src/lib/educamos.ts) para que produzca las mismas filas — el resto
de la app no cambia. Después: asigna tutorías y cursos en `/gestion/profes`.

## 5 · Primer administrador (paso 12)

La app no trae un usuario inicial: alguien tiene que insertarlo a mano una vez. En Neon →
*SQL Editor* (cambia el correo, tiene que ser del dominio que pusiste en §6):

```sql
INSERT INTO auth_users (id, email, nombre, role)
VALUES (gen_random_uuid(), 'tu.nombre@tu-colegio.es', 'Tu nombre', 'supertic');
```

A partir de ahí, el resto del claustro se da de alta desde `/gestion/usuarios`. Quien sea
profesor activo en la BBDD central (paso 16) entra solo como `profe`, sin alta manual.

## 6 · Lo que está atado a Consolación en el código (paso 13)

Hoy la identidad del colegio **no está centralizada**: son constantes repartidas. Busca y
sustituye estas (`grep -rIn "consolacionburriana" src` te las encuentra todas):

| Qué | Dónde | Por qué importa |
|---|---|---|
| **Dominio del login** `DOMINIO_LOGIN` | `src/lib/permissions.ts` | Sin cambiarlo, **nadie de tu colegio puede entrar** |
| Dominio de correo `DOMINIO` y **remitentes por defecto** (`DEFECTOS`) | `src/lib/email.ts` | De dónde salen los correos si no fijas `EMAIL_FROM_*` |
| `DOMINIO_COLE` | `src/lib/educamos.ts` | Reconoce el correo corporativo al importar profes |
| `dominio` de `OPCIONES_POR_DEFECTO` | `src/lib/autoasm-construir.ts` | Correos de los ficheros de Apple School Manager |
| Filtro `@consolacionburriana.com` de «añadir profe a clase» | `src/app/api/calendarios/admin/clases/profe/route.ts` | Rechaza cuentas de otro dominio |
| Dominio por defecto de `appBaseUrl()` | `src/lib/constants.ts` | Solo si no fijas `APP_BASE_URL` (fíjala y da igual) |
| Correo de gestores por defecto y pies de correo | `src/lib/licencias-email.ts`, `src/lib/*-email.ts`, `src/lib/email-template.ts` | Firmas y buzones que ven las familias |
| Correos de contacto que ven las familias en pantalla | `src/components/licencias/licencias-form.tsx`, `src/components/salidas/salidas-familia.tsx` | `licencias@…`, `tic@…` |
| IDs de Drive del colegio (plantilla y carpeta de pedidos) | `src/lib/licencias-pedidos.ts`, `src/lib/licencias-pedidos-server.ts` | Se pisan con las variables del §3; mejor cámbialos también aquí |
| Nombre, logo y textos («Colegio Consolación», «Tools Consolación») | `src/app/layout.tsx`, `src/components/home/home-landing.tsx`, `src/app/gestion/login/page.tsx`, `public/manifest.json`, `public/logobur.png` | Lo que ven usuarios y lo que se instala en el iPad |
| **Iconos de la PWA** | `scripts/iconos-pwa.py` y `scripts/icono-app.py` (necesitan Pillow) | Los actuales son el emblema de Consolación |
| Etapas, cursos y asignaturas | `src/lib/constants.ts`, `src/lib/educamos.ts` | Si tu centro tiene otra estructura (aquí: EI, EP, ESO) |
| Datos y pantallas propias del colegio | *Oratorios y Godly Play* (`ora_*`), *AMPA*, *ONG*, *banco de libros* | Si no aplican, no se dan permisos al módulo y desaparece del escritorio (§7) |

Tras cambiar: `pnpm lint && pnpm build && pnpm test` deben pasar (algunos tests usan el dominio
del colegio como dato de ejemplo).

## 7 · Quitar lo que no uses

No hace falta borrar código: en `/gestion/usuarios` cada persona tiene sus módulos, y un módulo
que nadie tiene no aparece en el escritorio. La portada pública (`/`) solo enseña trámites
abiertos (campaña de licencias, salidas cobrando), así que sin campañas queda vacía y dice que
no hay nada.

## 8 · Si algo no funciona

| Síntoma | Casi seguro |
|---|---|
| Google dice `redirect_uri_mismatch` | Falta la URL exacta `https://TU-DOMINIO/api/auth/callback/google` en el paso 5 |
| Entras con Google y sale «pide acceso al TIC» | No hiciste el paso 12, o el correo de §5 no coincide con el que usas |
| «Acceso denegado» al iniciar sesión | `DOMINIO_LOGIN` (§6) sigue siendo el de Consolación |
| Los correos no salen y no hay error | Falta `RESEND_API_KEY` **o** la cuenta de servicio con `gmail.send`: sin transporte se saltan en silencio |
| `insufficient permissions` / `unauthorized_client` en Google | Falta el scope en la delegación (paso 8), o la API no está habilitada (paso 7). Cambios de delegación: hasta unos minutos en aplicarse |
| Pedidos de Licencias dan 403/404 en Drive | Plantilla/carpeta sin compartir con el `client_email`, o siguen los IDs de Consolación (§3) |
| Los enlaces de los correos apuntan a otro sitio | `APP_BASE_URL` sin fijar o mal fijada en Vercel |

## 9 · Ver qué hay guardado y qué está pasando

Cuando algo no cuadra, se mira en tres sitios, de más cercano a más lejano:

| Quieres ver… | Dónde | Cómo |
|---|---|---|
| **Los datos** (filas de una tabla, quién es `supertic`, cuántos alumnos hay) | **Neon** → tu proyecto → **Tables** | Elige la tabla (`edu_students`, `auth_users`, `lic_orders`…) y navega/filtra las filas. Los prefijos dicen a qué módulo pertenece cada una (`abc_`, `lic_`, `edu_`…, ver `src/db/schema.ts`) |
| Lo mismo, pero **con consultas** | Neon → **SQL Editor** | Escribe `SELECT`. Es también donde se ejecuta el `INSERT` del §5 |
| Lo mismo, **desde tu ordenador** | Terminal | `pnpm db:studio` abre Drizzle Studio en el navegador (usa `DATABASE_URL` de `.env.local`) |
| Qué **ficheros SQL** faltan por aplicar | Terminal | `pnpm db:sql --lista` |
| **Cuánto usa** la base y qué consultas van lentas | Neon → **Monitoring** | Solo lectura; no hace falta para el día a día |
| Un **dato borrado por error** | Neon → **Backup & Restore** | Permite volver a un momento anterior (el tiempo disponible depende de tu plan). Ante una duda, crea antes una *branch* desde ahí en vez de restaurar encima |
| **Errores de la app** (una pantalla que falla, un correo que no sale) | **Vercel** → proyecto → **Logs** | Filtra por *Error*; cada fallo trae la ruta y el mensaje. Los despliegues fallidos: pestaña *Deployments* → el deploy → *Build Logs* |
| Si los **crons** se ejecutan | Vercel → *Settings* → **Cron Jobs** | Lista los cuatro de `vercel.json` y permite lanzarlos a mano |
| **Quién ha entrado y con qué rol** | La propia app: `/gestion/usuarios` | O en Neon: `SELECT email, role, active FROM auth_users;` |

**Consultas para comprobar que la instalación está bien** (pégalas en el SQL Editor):

```sql
-- ¿Se crearon las tablas? (debería salir un número alto, unas 90)
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';

-- ¿Están las cuatro tablas que solo existen como SQL?
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('lic_licencias','lic_envios','lic_pedidos_editorial','lic_ajustes_pedido');

-- ¿Eres administrador?
SELECT email, role, active FROM auth_users;

-- ¿Se cargó el alumnado? (tras el paso 16)
SELECT count(*) FILTER (WHERE active) AS activos, count(*) AS total FROM edu_students;
```

> ⚠️ Neon es la base **de producción**: un `UPDATE` o `DELETE` sin `WHERE` en el SQL Editor no
> se puede deshacer con un botón. Para probar cosas, crea una *branch* de Neon (copia
> instantánea) y apunta ahí un `.env.local`. Las tablas de alumnado tienen datos personales:
> no copies resultados a chats, documentos ni issues públicos.
