# Correos y grupos · las cuentas de Google cruzadas con Educamos

**Estado:** plan funcional ✅ · plan técnico ✅ · implementado 🟡 (en `/gestion/cuentas` desde el 20-oct-2026; lectura de Google probada en real; crear, mover, suspender y grupos escritos y sin estrenar: faltan tres scopes en la delegación, ver abajo)

Pedido por David el 20-oct-2026. Ruta: `/gestion/cuentas` · módulos `cuentas` (gestionar: SuperTIC y TIC) y
`cuentas-ver` (solo ver: secretaría). `cuentas` está en `MODULOS_SENSIBLES`: crea, suspende y cambia
contraseñas de cuentas de cualquiera del dominio.

Hasta ahora las cuentas de Google se llevaban desde la consola de administración, a mano, y las
unidades organizativas estaban creadas pero no se actualizaban («son un drama»). Este módulo pone al lado
las dos listas: **las personas de Educamos** (`edu_students`, `edu_teachers`) y **las cuentas de Google**.
De ese cruce sale todo lo que hay que hacer, y se hace desde aquí; lo que no, con un enlace a la ficha de
esa persona en la consola.

---

## Lo que se encontró el primer día (20-oct-2026, solo lectura)

1.237 cuentas en Google. 575 de 645 alumnos activos y 52 de 54 profes tienen correo. Faltan **70 alumnos**
(47 de 3 años, el resto de 4INF y 1º-3º EP) y **2 profes**; 12 de esos 70 tienen ya una cuenta que se les
parece. **21 bajas** conservan la cuenta abierta (7 alumnos que se fueron este verano y 14 profes con fecha
de baja) y **54 graduados de 4º de ESO** esperan su mes de suspender (marzo de 2027). **265 cuentas** de las
unidades del alumnado no casan con nadie de Educamos (casi todo antiguos alumnos de antes de la BBDD
central). Las unidades de clase no se han tocado desde hace cursos: prácticamente nadie está en la de su
clase (la de 3 años de 2025-26 sigue en «2526 3INFA», 141 cuentas en «5 Años A»…).

El correo del alumnado es **nombre + primer apellido**, sin acentos (491 de 576); con el segundo apellido
si estaba pillado (16) y la ñ como n. Es la regla que propone el módulo.

## Las operaciones típicas, y dónde están

Pestaña **Por hacer**: una tarjeta por operación, que lleva a la lista ya filtrada y con la selección hecha.

| Operación | Dónde |
|---|---|
| Crear los correos de los de 3 años | Por hacer → Crear correos → «Solo los de 3 años» |
| Crear los correos de los que llegan en septiembre o durante el curso | Por hacer → Crear correos (también desde la ficha de Nouvinguts, paso «Correo de Google») |
| Crear el correo de un profe nuevo | Por hacer → Crear correos (salen los profes activos de Educamos sin cuenta) |
| Pasar de curso y que cada alumno caiga en su unidad | Unidades (confirmar a qué unidad va cada clase, una vez) → Por hacer → Cada alumno en su clase |
| Suspender las bajas y los de 4º de ESO a los 8 meses, y archivarlos | Por hacer → Bajas con la cuenta abierta |
| Suspender cuentas de gente que no está en Educamos | Por hacer → Cuentas que no son de nadie / Otras cuentas |
| Ordenar las unidades organizativas | Unidades (mapa clase → unidad, crear las que falten, archivo) + Por hacer → Suspendidas sin archivar |
| Poner al día los grupos porque llega un profe nuevo | Grupos → Revisar → Aplicar |
| Lo que no se hace aquí (borrar, alias, licencias…) | «Abrir en la consola» en cada cuenta |

---

## Decisiones cerradas

1. **El cruce es por el correo apuntado en Educamos** (`edu_students.email_google` o `email` del alumno;
   `email` o `email_otro` del profe), contando los alias de Google. Primero quien sigue en el centro: si una
   baja y un alta apuntan a la misma cuenta, es del alta. Nunca se casa por el nombre: un nombre parecido
   solo sale como **«¿Es su cuenta?»**, y lo confirma TIC (por el incidente de las fichas cruzadas, ver
   `06-fuente-unica-alumnado.md`).
2. **La BBDD central sigue siendo la fuente de verdad del correo.** Al crear una cuenta o vincularla, se
   escribe en `edu_students.email_google` (o `edu_teachers.email`), y de ahí lo leen Licencias, Nouvinguts,
   ASM, el cuaderno… Un vacío del Excel de Educamos no lo pisa. Apuntarlo también en Educamos sigue siendo
   el paso a mano «Correo vinculado en Educamos» de Nouvinguts.
3. **Correo propuesto: nombre + primer apellido**; si está pillado (en Google, también suspendidas y
   alias, o apuntado a otra persona), con el segundo apellido entero, luego con su inicial, luego con un
   número. Se edita antes de crear. Si Educamos ya tiene uno apuntado que no existe en Google, se propone
   ese.
   **Al crear, todo se puede cambiar** (21-oct-2026, a petición de David): el correo (solo lo de antes
   de la arroba; el dominio no se toca), el nombre y los apellidos con los que sale en Google, y la
   unidad. Se avisa al momento si el correo ya existe en Google (también alias) o se repite en la
   tanda. Debajo de cada fila: otros correos libres que le valdrían (con el segundo apellido, solo con
   el primer nombre), «¿Con tildes?» y «Lo propuesto». Si se corrige el nombre, el correo se vuelve a
   proponer con la misma norma mientras no se haya escrito a mano.
   **El nombre en Google**: con mayúsculas de verdad; en el profesorado, el nombre por el que se le
   llama si está puesto en /gestion/profes («Pepe»). Las tildes no se inventan (Educamos solo trae las
   que escribió la familia: 221 de 645 alumnos): se **sugieren** con un toque desde una lista corta de
   nombres y apellidos que siempre la llevan, sin `Maria`, `Sofia`, `Ramon`, `Tomas`, `Oscar`… que en
   valenciano van sin ella o con la otra (`tildesProbables()` en `src/lib/personas.ts`).
   **Alta de profes desde Educamos**: el profe nuevo que entra con la importación sale en Por hacer →
   Crear correos. Al crearle la cuenta se le apunta el correo del colegio en `edu_teachers.email`, y la
   siguiente importación **ya no lo pisa** con el personal que suele traer Educamos: ese pasa a
   `email_otro` (`correosProfeTrasSync()`, con test). Antes se perdía el vínculo con su cuenta y el
   login.
4. **Las contraseñas no se guardan en ningún sitio.** Se enseñan una vez al crear (copiar o descargar en
   CSV) y no van al registro. Si se pierde, «Contraseña nueva». Dos modos: una distinta para cada uno
   (cuatro sílabas y dos cifras, «Bakimeru47», para dictarla) o la misma para todos. «Que la cambie al
   entrar» sale marcado para el profesorado y desmarcado para el alumnado.
5. **La familia que desestima el correo** (`pd_desestima_correo`) no sale en «crear»: sale como «Correo
   desestimado», y el servidor se niega a crearlo.
6. **Unidades: una por clase, fija** (el modelo que ya hay: «1º ESO A», «1ºA», «3 A», «4 Años A»). Cada
   clase de Educamos se mapea una vez a su unidad en Unidades; el módulo **propone** la que encaja por el
   nombre (misma etapa, nivel y letra, y nunca una de archivo ni de promoción como «2526 3INFA»), pero
   **hasta que TIC no la confirma no se mueve a nadie**. Pasar de curso es entonces: sincronizar Educamos
   con los cursos nuevos → «Cada alumno en su clase» → mover. Las de PDC no se proponen: se eligen.
7. **El profesorado no se mueve de unidad** (Equipo Directivo, PAS… son a propósito). Sí se elige dónde se
   crea un profe nuevo, por etapa.
8. **Bajas y espera.** Una baja es quien ya no está activo en Educamos y conserva la cuenta. Se cuenta
   desde la última sincronización en la que salía (`last_synced_at`) o, en profes, su fecha de baja:
   **8 meses** a quien termina 4º de ESO (David), **1 mes** a las demás bajas del alumnado y **1 mes** al
   profesorado (estos dos, puestos por defecto: ver `00-desarrollos-futuros.md`). Se cambian en Unidades.
   Antes de su fecha se ven «en espera» y se pueden suspender igual, a propósito.
9. **Suspender = suspender + llevar a su unidad de archivo** (la del alumnado o la del profesorado; con
   «una subunidad por curso», `…/Promoción 2025-26` o `…/Bajas 2026-27`, que se crean solas). Se escribe
   SUSPENDER para confirmar y se deshace con «Reactivar». **No se borra nada** desde aquí: lo hay en la
   consola. Una cuenta suspendida que ya está en cualquier unidad de archivo («4 ESO acabado 2023-2024»,
   «Pendientes de eliminar») cuenta como archivada.
10. **Lo que nunca se toca desde aquí**: administradores del dominio, la cuenta de quien está en la pantalla
    y la que suplanta la app. Las cuentas que no son de nadie pero se quedan (tic@, secretaría, PAS) se
    marcan **«Cuenta del colegio»** o **«Se queda»** y dejan de salir como pendientes.
11. **Grupos, idea de [asistente-grupos](https://github.com/pfelipm/asistente-grupos) (Pablo Felip),
    adaptada:** un grupo gestionado tiene **reglas** (todo el claustro o una etapa, tutores, alumnado de una
    etapa, curso o clase, cuentas de una unidad, más correos «siempre» y «nunca») y se rellena desde
    Educamos, no desde una hoja. Con lo aprendido de sus agujeros:
    - **Siempre se ve antes qué cambia** («Revisar»): quién entra, quién sale y por qué.
    - **Propietarios y gestores no se tocan nunca**, ni los miembros «todo el dominio» de Google.
    - Se compara por el **id de Google** además del correo: un alias no hace entrar y salir a nadie.
    - Si las reglas no dan a nadie, **no se vacía el grupo**; si las bajas son muchas (más de 5 y más del
      25 %), hay que escribir QUITAR.
    - Dos modos: **añadir y quitar** (queda igual que las reglas) o **solo añadir** (para grupos donde
      también se mete gente a mano).
    - El plan se recalcula en el servidor al aplicar (nunca el de la pantalla) y va por tandas de 120.
    - No se toca la configuración del grupo (quién puede escribir…): la del dominio. Ver futuros.
12. **Foto en Neon, refresco al entrar.** La pantalla sale de `cue_*` (rápido, y secretaría la ve sin tocar
    Google); si la foto tiene más de 10 minutos y quien entra puede leer Google, se refresca sola. «Leer de
    Google» la rehace entera (~5 s con 1.237 cuentas). Antes de cada acción, el cruce se vuelve a hacer en
    el servidor: el navegador manda ids, y a dónde va cada cuenta lo decide el cruce.
13. **Permisos:** gestiona TIC (y SuperTIC); **secretaría lo ve todo sin poder tocar nada** (David). Leer
    de Google exige suplantar a un administrador: TIC lo es; secretaría solo puede refrescar si se fija
    `GOOGLE_ADMIN_BUZON`. Dirección no lo tiene por defecto (se da a mano si hace falta).
14. **Registro**: cada cosa hecha queda en `cue_registro` con quién y cuándo (pestaña Registro), sin
    contraseñas.

## Paso de David en Workspace (una vez)

**Consola de admin → Seguridad → Control de API → Delegación de todo el dominio** → el Client ID de la
cuenta de servicio (el mismo de `gmail.send`) → Editar, y añadir a lo que ya tiene, sin quitar nada:

```
https://www.googleapis.com/auth/admin.directory.user
https://www.googleapis.com/auth/admin.directory.orgunit
https://www.googleapis.com/auth/admin.directory.group
```

`admin.directory.user.readonly` ya estaba (Calendarios) y es con lo que hoy se lee. La API (Admin SDK) ya
está habilitada. El botón **Permisos** de la pantalla dice qué falta. Sin el de unidades, las unidades se
deducen de dónde están las cuentas y **no salen las vacías** (por ejemplo «5ºA»).

## Plan técnico

- **Tablas** (`src/db/schema.ts`, `src/db/sql/cuentas.sql`, aplicado en Neon el 20-oct-2026):

  | Tabla | Para qué |
  |---|---|
  | `cue_usuarios` | Foto de las cuentas de Google (id, correo, alias, nombre, unidad, suspendida, admin, creada, último acceso) |
  | `cue_unidades` | Foto de las unidades organizativas; `origen` = `google` o `usuarios` (deducidas) |
  | `cue_grupos` | Foto de los grupos + lo que solo vive aquí: si se gestiona, sus reglas y la última vez que se aplicó |
  | `cue_marcas` | Cuentas que no son de nadie y se quedan («Cuenta del colegio» / «Se queda») |
  | `cue_registro` | Lo hecho desde aquí, firmado. No se borra |

  Ajustes (mapa clase → unidad, raíces, archivo, meses de espera) en `cfg_ajustes`, clave `cuentas`.
- **Código**:

  | Fichero | Qué hace |
  |---|---|
  | `src/lib/cuentas.ts` | Helpers puros: correo propuesto, firma y propuesta de unidad, ajustes efectivos, **el cruce**, contraseñas, reglas y plan de los grupos, schemas Zod. Tests en `__tests__/cuentas.test.ts` |
  | `src/lib/cuentas-google.ts` | Adaptador de Admin SDK Directory: usuarios, unidades, grupos y miembros; un scope por cosa; «Comprobar permisos» |
  | `src/lib/google-sa.ts` | **Nuevo, común**: credencial de la cuenta de servicio, JWT por buzón, reintentos, errores explicados, `enParalelo`, `buzonAdmin`. Calendarios ya lo usa |
  | `src/lib/cuentas-server.ts` | Foto de Neon, leer de Google, el cruce en el servidor y todas las acciones con su registro |
  | `src/app/api/cuentas/*` | `estado` (GET), `leer` (POST), `registro` (GET) y `admin/*`: `permisos`, `crear` (máx. 25), `mover`, `suspender` (exige `SUSPENDER`), `reactivar`, `contrasena`, `vincular`, `marcar`, `ajustes`, `unidades`, `grupos`, `grupos/reglas`, `grupos/previa`, `grupos/aplicar` (exige `QUITAR` si son muchas bajas) |
  | `src/components/cuentas/*` | `panel` (pestañas y lectura), `por-hacer`, `lista` (filtros, selección y ficha de cada cuenta), `dialogos` (crear, mover, contraseña, marcar), `unidades`, `grupos`, `registro` |

## Checklist

### Fase 1 · el módulo (20-oct-2026)
- [x] Ficha, fila en la tabla maestra y módulos `cuentas` / `cuentas-ver` en la matriz (secretaría solo ve)
- [x] Tablas `cue_*` y SQL aplicado en Neon (20-oct-2026)
- [x] Helpers puros con tests: cruce, correo propuesto, unidades, esperas, contraseñas, plan de grupos
- [x] `google-sa.ts` común y Calendarios pasado a usarlo
- [x] Leer de Google a la foto (cuentas en real: 1.237 en ~5 s; unidades deducidas mientras falte el scope)
- [x] Pantalla: Por hacer, Cuentas (filtros, selección, ficha, abrir en la consola), Unidades, Grupos y Registro; tarjeta en el escritorio. Vista con sesión de TIC sobre los datos reales
- [x] Nouvinguts: el paso «Correo de Google» enlaza a crear su correo aquí
- [~] Crear correos (con contraseñas una vez) — escrito; falta `admin.directory.user` y estrenarlo con una o dos cuentas
- [~] Mover a su clase, archivar, suspender, reactivar, contraseña nueva — escrito; falta `admin.directory.user`
- [~] Leer unidades y crear las que falten — escrito; falta `admin.directory.orgunit`
- [~] Grupos: leer, reglas, revisar, aplicar y crear — escrito; falta `admin.directory.group`
- [x] Vincular una cuenta parecida y marcar cuentas que se quedan (no tocan Google)
- [x] Crear correos: correo, nombre y apellidos editables, aviso de correo ya existente, alternativas, tildes sugeridas (21-oct-2026)
- [x] La importación de Educamos no pisa el correo del colegio de un profe (21-oct-2026)

### Fase 2 · puesta en marcha (David)
- [ ] Añadir los tres scopes a la delegación («Permisos» en verde)
- [ ] Confirmar en Unidades a qué unidad va cada clase (crear «5ºA» y decidir dónde va el PDC)
- [ ] Repasar las 12 «¿Es su cuenta?» antes de crear
- [ ] Crear los correos de 3 años y del resto
- [ ] Repasar «Otras cuentas» y marcar las del colegio; suspender las bajas que tocan
- [ ] Ponerle reglas a los grupos de siempre (claustro, profes por etapa, tutores) y aplicar

## Para más adelante

En `00-desarrollos-futuros.md`: revisar los grupos solos (cron) tras cada sincronización de Educamos,
ajustes de los grupos (Groups Settings API), borrar las cuentas archivadas de hace años, y pasar
`email-gmail.ts`, `mihorario-google.ts` y `google-sheets.ts` a `google-sa.ts`.
