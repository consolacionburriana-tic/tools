# Parámetros del centro · qué se cambia y dónde

Lo que hace distinto a un colegio de otro está en **tres sitios**, y este documento los reúne:

| Sitio | Qué es | Quién lo cambia |
|---|---|---|
| [`src/lib/colegio.ts`](../src/lib/colegio.ts) | **Quién eres**: dominio de Workspace, nombre, host y buzones | Quien despliega, una vez |
| [`src/lib/configuracion.ts`](../src/lib/configuracion.ts) | **Cómo funciona tu centro**: cursos por etapa, promoción, banco de libros, hora límite, calendario, sesión, límite de archivos | Quien despliega, y de año en año si algo cambia |
| Variables de entorno (Vercel) | Credenciales y cuentas ([tabla](./04-convenciones-tecnicas.md#variables-de-entorno)) | Quien despliega |

Guía completa de despliegue: [`08-despliegue-y-fork.md`](./08-despliegue-y-fork.md).

## Ya en `configuracion.ts`

Cambiar un valor cambia **todos** los módulos que lo leen. Los tests fijan los valores de
Consolación; si cambias uno a propósito, el test correspondiente te avisa.

| Parámetro | Valor hoy | Lo leen |
|---|---|---|
| `niveles` (primer y último curso de cada etapa) | Infantil 3-5 · Primaria 1-6 · ESO 1-4 · Bachillerato 1-2 | Promoción de curso |
| `promocion` (`'rota'` · `'parejas'` · `'sube'`) | Infantil rota (3→4→5→3) · Primaria por parejas (1↔2, 3↔4, 5↔6) · ESO y Bachillerato suben y el último egresa | Botón «Promocionar +1 curso» de `/gestion/profes` |
| `bancoLibros` (desde qué nivel de cada etapa) | Primaria desde 3º · ESO entera · Bachillerato entero · Infantil y 1º-2º de Primaria, fuera | Banco de libros, Alumnado, sync de Educamos |
| `etapasConjuntas` (etapas que van juntas para «quién ve a quién») | ESO + Bachillerato | Alumnado, Banco de libros y Números: un profe con una de las dos ve las dos |
| `puntualidad.etapas` | ESO (con PDC) y Bachillerato | Buscador del formulario, lista de alumnado del módulo (TypeScript y SQL salen de la misma lista) |
| `puntualidad.horaLimite` / `retrasosPorConsecuencia` | `08:05` · `3` | Formulario, panel, avisos y resumen semanal (y los textos que dicen «08:05») |
| `calendario.zonaHoraria` | `Europe/Madrid` | Todas las fechas «de hoy» (Números, Oratorios, Mi horario, Tareas) |
| `calendario.mesInicioCurso` | `9` (septiembre) | Curso académico en vigor |
| `calendario.trimestres` | fin T1 22-dic · inicio T2 7-ene · T2 acaba 9 días antes de Pascua · T3 empieza 2 días después · fin T3 19-jun | Valores de partida de los trimestres de Oratorios (se retocan cada año en sus Ajustes) |
| `sesion` | 300 días · rol refrescado cada 15 min | Login (`src/auth.ts`) |
| `archivos.maxMB` | `10` | Subida de justificantes de Salidas, Excel de Licencias e importación de horarios (y los textos que lo dicen) |

Ejemplos de cambio:

- *Mi Primaria promociona de 1º a 2º de verdad* → `promocion.EP: 'sube'`.
- *Mi banco de libros empieza en 1º de Primaria* → `bancoLibros.EP: { desdeNivel: 1 }`.
- *Cerramos puertas a las 8:00 y avisamos al segundo retraso* → `puntualidad: { horaLimite: '08:00', retrasosPorConsecuencia: 2 }`.

## Todavía NO está en `configuracion.ts` (y dónde vive)

Se dejó fuera a propósito: o va atado a **datos** (base de datos, plantillas de terceros) o a una
**consulta SQL**, y moverlo sin más dejaría dos sitios que pueden discrepar. Es la lista de
candidatos para una siguiente vuelta.

| Qué | Dónde está hoy | Por qué no se ha movido |
|---|---|---|
| **Cursos que cubre Licencias** (6º EP – 4º ESO, con PDC) | `CURSOS_FORM` en `src/lib/licencias.ts` | Los libros y precios del catálogo están en la BBDD y cuelgan de esos códigos |
| **Cursos y clases de AUTOASM** | `CURSOS_CENTRO` (`autoasm-construir.ts`), plantilla en `autoasm-plantilla.ts`, sede en `CENTRO_PLANTILLA` | Son la foto de lo que ya existe en Apple School Manager del colegio |
| Alcance de AUTOASM (desde 6º EP) | Opción de la propia pantalla `/gestion/autoasm` | **Ya se cambia en la app**, no hace falta tocar código |
| Etapas de cada tipo de Oratorios y Godly Play | En la BBDD (`ora_tipos`), editables en sus Ajustes; las etapas elegibles son todas (`ETAPAS`) | Lo editable ya está en la app |
| Rejillas de horario, tramos, espacios | BBDD (`hor_*`), editables en `/gestion/horarios` | Ya es dato, no constante |
| Matriz rol → módulos | `ROLE_MODULES` en `src/lib/permissions.ts` (y ajustes por persona en `/gestion/usuarios`) | Es política de accesos: mejor con revisión de código |
| Remitentes y nombres de correo por módulo | `DEFECTOS` en `src/lib/email.ts` (leen `COLEGIO`) y variables `EMAIL_FROM_*` | Ya se cambian sin deploy con las variables de entorno |
| Cabeceras del export de Educamos | `CAMPOS_ALUMNO` / `CAMPOS_PROFESOR` en `src/lib/educamos.ts` | Dependen del programa; se ajustan con un fichero real delante |
| Formato del código interno del alumno (`AA` + 3 + 3 letras) | `CODIGO_INTERNO_RE` y `generarCodigo()` en `src/lib/educamos.ts` | Es una convención de Consolación que otros datos ya usan |
| Tipos de archivo permitidos en Salidas | `TIPOS_PERMITIDOS` en `src/lib/blob.ts` | Va con la validación de servidor |
| Cuota de correo por Gmail | `GMAIL_CONCURRENCIA` (variable de entorno) | Ya es una variable |
| Cuándo se ejecutan los crons | `vercel.json` | Lo lee Vercel, no el código |
| Marca: logo, iconos, títulos, `manifest.json` | Ver el §6 de la guía de despliegue | Son ficheros estáticos |

## Siguiente paso posible: ajustes editables desde la app

`configuracion.ts` se cambia **con código** (y un redeploy), que es lo natural para quien despliega
y no necesita migración de base de datos. Si algún día quien lleva el colegio tiene que cambiar
estos valores **sin tocar código** (por ejemplo la hora límite o la promoción cada septiembre),
el camino es una pantalla `/gestion/ajustes` respaldada por una tabla de ajustes en Neon, con
estos mismos valores como valor por defecto. Es un trabajo aparte (tabla + SQL aditivo + pantalla
+ permisos) y conviene hacerlo solo cuando haya un caso real. Apuntado en
[`00-desarrollos-futuros.md`](./00-desarrollos-futuros.md).
