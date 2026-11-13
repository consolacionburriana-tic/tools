# Sustituciones · cubrir las ausencias del profesorado (Infantil, Primaria y ESO)

**Estado:** plan funcional ✅ (todo respondido por David el 13-nov-2026) · plan técnico ✅ · implementado ⬜ (hecho el paso previo: las sustituciones largas de
Educamos ya se llaman **Coberturas por baja**, ver más abajo)

Idea y primer plan de Jose Miguel Batalla (12-nov-2026, con David). Revisado contra el código y
contra los horarios reales de Neon y cerrado con David el 13-nov-2026 (§1: lo que cambió y por qué).

Ruta: `/gestion/sustituciones` (secciones **Hoy · Disponibilidad · Historial · Números**, y un
enlace a **Ajustes** de los correos). Grupo del escritorio: **Organización del centro**, pero con
**icono en índigo**, no en el teal del grupo, para no confundirlo con Oratorios (decisión 20).
«Mis sustituciones» en `/gestion/mis-sustituciones`, de momento solo para quien tiene el módulo
(decisión 16).

Cuando un profe falta unas horas o unos días, Jefatura tiene que decidir quién entra en cada una
de sus clases, avisar a cada sustituto y al ausente, y llevar la cuenta de cuántas horas falta
cada uno y por qué. Hoy se hace de memoria y con el horario en papel. Este módulo lo convierte
en: **elijo profe, fechas y motivo → la app me dice qué clases quedan descubiertas y me propone a
quién mandar, por la disponibilidad y la prioridad del centro → reviso, confirmo y salen los
correos.**

> **Coberturas por baja ≠ Sustituciones.** Lo que Educamos marca como sustituto («Ángela cubre la
> baja de Alejandro mientras dure», ficha [`02`](./02-integracion-educamos.md), tarjeta en
> `/gestion/profes`) se llamaba «Sustituciones» y desde el 13-nov-2026 se llama **Coberturas por
> baja**, en pantalla y en código (`src/lib/coberturas-baja.ts`, `coberturas-baja-server.ts`,
> `components/profes/coberturas-baja-panel.tsx`, `/api/profes/admin/coberturas-baja`,
> `/api/cuentas/admin/coberturas-baja`; la tabla sigue siendo `edu_sustituciones`). Así el nombre
> «sustituciones» queda **libre y entero** para este módulo. Los dos conviven y este lee de aquel
> (decisión 4).

### Glosario (para quien lo implemente)

| Palabra | Qué es |
|---|---|
| **Ausencia** | Un profe, de tal a tal fecha, un motivo, y las sesiones de esos días en las que no está. Una fila de `sust_ausencias`. |
| **Sesión ausente** | Cada hora de cada día de esa ausencia, con su foto (fecha, hora, grupo, materia, aula). Una fila de `sust_sesiones`. Es lo que se **cuenta**. |
| **Hay que cubrirla** | Sesión ausente en la que el ausente es quien da la clase a un grupo. Si no (era codocencia, una reunión…), cuenta pero no necesita sustituto. |
| **Sesión cubierta** | Sesión ausente con sustituto asignado. |
| **Ocupación** | Lo que un posible sustituto está haciendo a esa hora según su horario (una clase, una codocencia, una reunión de Pastoral, nada…). |
| **Nivel** | El escalón de la lista de prioridad en que cae una ocupación (`Codocencia` es el 1). Lo da el horario, igual para todos. |
| **Disponibilidad** | Lo dispuesto que está **cada profe en cada franja** de su semana: **Sí** · **Si hace falta** · **Solo urgencia** · **No**. Sale sola del horario y Jefatura la retoca a mano (decisión 15). Es lo primero que ordena. |
| **Cuadro del centro** | El cuadro «HORARIO SUSTITUCIONES» del `.docx` de horarios: el resumen de quién está para sustituir en cada hora. Segundo criterio de orden (decisión 8). |

---

## 1. Revisión del 13-nov-2026: lo que cambió y por qué

El plan de partida era bueno en lo funcional; estos fallos habrían salido en producción:

1. **«Mismo tramo» no sirve: cada etapa tiene su rejilla.** En Neon, un martes, la 2ª de EP es
   09:45-10:30 y en EI no hay 2ª (la 1ª va de 09:00 a 10:10); la ESO tiene otras dos. Comparar
   por tramo u orden deja fuera a media plantilla y empareja horas que no coinciden. **Se compara
   por solape de horas** (`horaInicio`/`horaFin`), como ya hace Oratorios (`solapa()`).
2. **El periodo «vigente» de horarios no vale tal cual.** En septiembre y junio manda un periodo
   que **solo tiene rejilla de EP**. Hay que resolver el periodo **por rejilla** (decisión 4).
3. **La lista de prioridad no existe como tal en el horario.** No hay una actividad
   «Codocencia» ni «TIC»: son un **rol** (segundo profe en una clase) o **etiquetas** de reuniones
   y coordinaciones. Se mapeó contra Neon (decisión 7).
4. **Faltaban exclusiones**: otro profe que también falta ese día, alguien que **ya cubre** otra
   hora a la misma hora, el responsable de un **Oratorio** fechado ese día a esa hora
   (`ora_sesiones`) y el titular de una baja cubierta. Sin eso, la app propone a la misma persona
   en dos aulas.
5. **«Se omite a quien tenga otra asignación concurrente» se contradecía** con la propia lista:
   todo candidato tiene algo a esa hora (la codocencia, la reunión…). La regla buena sale de la
   disponibilidad (decisión 6).
6. **El correo no decía el grupo**, que es lo primero que necesita el sustituto. Ahora: hora,
   **grupo**, materia, aula e indicaciones, y la hora y el sitio también en el asunto.
7. **Datos de salud.** «Médico», «Enfermedad leve» o «Baja» son datos de salud (categoría
   especial del RGPD). **El motivo no sale nunca en los correos** ni en «Mis sustituciones», y en
   informes y cifras se agrupa en «Actividad escolar / Personal» (decisión 11).
8. **No había vida después de confirmar**: cambiar un sustituto, añadir una hora, anular la
   ausencia, un correo que falla. Ahora sí (decisiones 9 y 10).
9. **No había reparto**: siempre saldría la misma persona. Desempate por **quien menos ha
   cubierto** (decisión 8).
10. **Choque de nombres**: el código de las sustituciones largas ocupaba `src/lib/sustituciones.ts`.
    **Resuelto**: ahora son las Coberturas por baja (hecho el 13-nov-2026, ver arriba).
11. **`hor_actividades.cubre_sustitucion` no se usa.** Su comentario mezclaba dos preguntas
    contrarias. Las reglas de este módulo viven en su configuración.
12. **Interruptor «Avisar por correo»** para registrar a posteriori sin mandar correos a
    destiempo, y los días tienen que ser **lectivos** (ni fin de semana ni `hor_festivos`).

---

## 2. Decisiones cerradas

1. **Alcance: infantil, primaria y ESO** (David, 13-nov-2026: «a la ESO hay que llevarlo
   también»). `CONFIGURACION.sustituciones.etapas = ['EI', 'EP', 'ESO']`, nunca a mano en el
   código. Un candidato puede ser **cualquiera** del claustro, dé en la etapa que dé: se mira su
   horario en todas sus rejillas.
   En la ESO, hoy (Neon, 13-nov-2026), **no hay ninguna hora de guardia importada**: casi todo lo
   liberable es departamento (20 sesiones), atención a familias (19) y a alumnado (16),
   coordinaciones y reuniones, que caen en «Otras horas sin alumnado» (nivel 12). Si algún día se
   importan guardias, van las primeras (nivel «Guardia»).
2. **Acceso.** Módulo `sustituciones`, que ven Jefatura (`jefe`), Dirección (`direccion`; titular
   y pedagógica comparten rol, David 12-nov-2026), Secretaría y TIC (estos dos y `supertic` lo
   reciben solos al entrar en `MODULES`, ver `permissions.ts`). No va a orientación ni al resto
   del claustro. Quien tiene el módulo lo ve y lo edita todo, **motivo incluido** (David,
   13-nov-2026: también Secretaría y TIC). La **rejilla de disponibilidad la marca Jefatura**
   (David, 13-nov-2026), es decir, quien tiene el módulo.
3. **Una ausencia es un profe, de tal a tal fecha, y un motivo** (David, 13-nov-2026). Un solo día
   es `desde = hasta`, que es lo de por defecto. Para cada día se eligen sus sesiones (de salida,
   las que hay que cubrir). Como mucho `maxDiasAusencia` días lectivos (15 por defecto): una baja
   más larga es una **cobertura por baja** y la pantalla lo dice con un enlace a Profesorado. Dos
   ausencias del mismo profe pueden caer el mismo día (a 1ª por médico, a 5ª por una salida), pero
   **no pueden solaparse** en horas.
   Motivos (en `configuracion.ts`, en este orden): **Actividad escolar · Médico · Médico familiar
   · Enfermedad leve · Baja · Otros**. «Otros» pide una nota corta.
4. **Qué horario tiene alguien en una fecha** (la función clave, `horarioDelDia(fecha)`):
   - Día de la semana de la fecha (1-5). Sábado, domingo o `hor_festivos`: ese día se salta y la
     pantalla lo dice.
   - Para **cada etapa**: de los periodos que contienen la fecha y **tienen rejilla con ámbito**
     de esa etapa, gana el de más `prioridad`. **Si no hay nada subido, se mantiene el horario
     ordinario** (David, 13-nov-2026): en septiembre y junio hoy solo primaria tiene horario
     propio, así que infantil y la ESO siguen con el ordinario hasta que se suba el suyo, y en
     cuanto se suba manda solo, sin tocar nada. Vale para cualquier etapa y cualquier periodo
     especial. En pantalla, una línea discreta lo dice («Infantil: horario ordinario, no hay de
     septiembre»), para que nadie se extrañe.
   - Sesiones de esas rejillas en ese día, con su tramo (horas), asignación, actividad, grupos,
     profes (rol, `principal`), materia y aula (`hor_sesiones.aula`/`espacio_id` pisa a la de la
     asignación). Solo `tipo = 'sesion'` (recreos, comedor… no se cubren desde aquí).
   - **Coberturas por baja vigentes** en esa fecha (`esVigente`, `aplicarCoberturasBaja` de
     `src/lib/coberturas-baja.ts`): el horario del titular **pasa** al sustituto. El titular de
     una baja cubierta no se propone como candidato ni se le puede apuntar una ausencia (sale con
     una nota «Su baja la cubre Ángela»).
   - Todo en **una tanda** de consultas en `Promise.all` (04-convenciones: cuesta el viaje). Para
     una ausencia de varios días, una tanda para todo el rango, no una por día.
5. **Qué sesiones del ausente hay que cubrir** (todas salen en la lista; estas van marcadas de
   salida y con «Hay que cubrirla»):
   - la sesión **tiene grupo** (`hor_asignacion_grupos` no vacío) **y** el ausente es
     `principal` en ella, **o** es el único profe;
   - si en esa misma sesión hay **otro profe que no falta** (codocencia en su clase), se le
     propone a él primero, nivel «Ya está en el aula» (David, 13-nov-2026), **y se le avisa** con
     su propio correo: «A 3ª tienes codocencia en 2º B; como falta Marta, te quedas tú con el
     grupo» (plantilla `en_aula`, decisión 17).
   Las demás (codocencia en clase ajena, PT/AL, reuniones, atención a familias, Dirección…)
   salen desmarcadas: Jefatura puede marcarlas para que **cuenten** como ausencia, pero nunca
   piden sustituto (`hay_que_cubrir = false`).
6. **Quién puede cubrir una sesión** (`proponerSustitutos`, puro y con tests). Para cada sesión a
   cubrir, cada profe activo del claustro es candidato si, en esa fecha y en las horas que
   **solapan** con la sesión:
   - no es el ausente, no tiene **otra ausencia** confirmada que solape, y no es titular de una
     baja cubierta vigente;
   - no **cubre ya** otra sesión que solape ese día (confirmada en BBDD **o** elegida en esta
     misma propuesta, para que la propuesta no reparta a la misma persona dos veces);
   - no es responsable de un **Oratorio** ese día a esa hora (`ora_sesiones` con estado distinto
     de `anulado`);
   - su **disponibilidad** en esa franja (decisión 15) no es **No**. Si varias ocupaciones
     solapan, manda la **peor** disponibilidad y el **peor** nivel.
   - Una **hora libre** (nada en el horario) solo cuenta si ese día tiene algo antes **y** después
     (está en el colegio), y es «Solo urgencia» (David, 13-nov-2026: «libres no trabaja en
     realidad»).
7. **La lista de prioridad de David, traducida al horario real** (comprobado en Neon el
   13-nov-2026). Vive en `CONFIGURACION.sustituciones.niveles`, en este orden; gana el **primer**
   nivel que case. Las etiquetas se comparan normalizadas (mayúsculas, sin acentos):

   | # | Nivel | Casa con… (actividad · condición) | En Neon hoy (ordinario) |
   |---|---|---|---|
   | 0 | Ya está en el aula | el otro profe de **la misma sesión** que se cubre | — |
   | 1 | Guardia | `guardia` | 0 (no hay importadas) |
   | 2 | Codocencia | `clase`/`tutoria` con grupo y el candidato **no** es `principal` (rol `apoyo`) | 62 asignaciones EI+EP, 15 profes |
   | 3 | Tut. indiv. | etiqueta contiene `TUTORIA INDIVIDUAL` | 4 sesiones + 1 alternada con Orientación |
   | 4 | J.E. | `coordinacion`, etiqueta contiene `JEFATURA` | 6 sesiones, 1 profe |
   | 5 | A.L. | `apoyo_al` | 11 sesiones con profe |
   | 6 | P.T. | `apoyo_pt` | 13 sesiones con profe |
   | 7 | Godly | `oratorio`, etiqueta contiene `GODLY` | 4 sesiones |
   | 8 | TIC | `reunion`, etiqueta **igual a** `TIC` | 5 sesiones, 1 profe |
   | 9 | Pastoral | etiqueta contiene `PASTORAL` | 2 sesiones, 5 profes |
   | 10 | Gabinete | etiqueta contiene `ORIENTACION` (David, 13-nov-2026: Gabinete es Orientación) | 2 sesiones |
   | 11 | Dirección | `coordinacion`, etiqueta empieza por `DIRECCION` | 27 sesiones, 1 profe |
   | 12 | Otras horas sin alumnado | **sin grupo** y actividad `atencion_padres`, `atencion_alumnos`, `departamento`, `reunion`, `coordinacion`, `libre_disposicion` u `otros` (David, 13-nov-2026: «al final del orden de prioridad») | la mayoría de la ESO |

   **Nunca liberables**: una clase o tutoría propia como `principal` (dejaría otra clase sola),
   cualquier hora **con grupo** que no sea codocencia (el Almuerzo de infantil, por ejemplo), un
   `oratorio` que no sea Godly y las etiquetas de `nuncaLiberables` (`TALLER DE PENSAMIENTO`,
   `HUERTO`: son horas con alumnos aunque el horario no ponga el grupo).
   Sondeo con estos niveles (primaria, mañanas, sin el 12): entre 2 y 12 candidatos por hora;
   **el martes a 6ª salen 0** (todo el claustro está en la reunión de Coordinación, que con el
   nivel 12 pasa a ser liberable en último lugar). «Sin cubrir» es un estado normal, no un error.
8. **Orden de los candidatos (y el reparto).** 1) **disponibilidad**: Sí, luego Si hace falta;
   2) **nivel** de la lista; 3) **está en el cuadro del centro** para esa hora (David, 13-nov-2026:
   «se puede consultar también, en segundo orden de prioridad»), ver decisión 21; 4) quien
   **continúa** (ya va a cubrir la sesión anterior o siguiente de esta misma ausencia ese día: el
   mismo adulto toda la mañana en infantil); 5) **menos sesiones cubiertas en los últimos 30
   días**; 6) nombre. La propuesta elige el primero de cada sesión, en orden de fecha y hora, y lo
   descuenta antes de la siguiente (decisión 6). **«Solo urgencia» nunca se elige sola**: sale en
   el desplegable, en su grupo, para que Jefatura lo decida. Junto a cada nombre, las que lleva
   este mes («· 3 este mes») y, si está, «en el cuadro».
9. **Ciclo de vida.** La propuesta **no se guarda** (vive en la pantalla hasta confirmar).
   Confirmar crea la ausencia y sus sesiones **en una sola escritura** (`db.batch`) y **vuelve a
   comprobar en el servidor** que ningún sustituto se ha ocupado mientras tanto (dos personas de
   Jefatura a la vez): si alguno choca, `409` con el nombre, el día y la hora, y no se guarda nada.
   Después, desde la ficha de la ausencia: **cambiar el sustituto** de una hora (incluido «Sin
   cubrir»), **añadir o quitar** una hora, **alargar o acortar** las fechas, editar indicaciones,
   **anular** la ausencia (el profe al final viene: `estado = 'anulada'`, no se borra, deja de
   contar) y **reenviar** avisos. Las ausencias no se borran nunca (04-convenciones: histórico).
10. **Correos** (perfil nuevo `sustituciones` en `email.ts`; plantillas en
    `sustituciones-email.ts`, con el mismo estilo que `oratorios-email.ts`: de compañero a
    compañero, sin firmas ni logos, y un **bloque por hora** con raya azul, que es lo que se busca
    al abrirlo). Salen **como quien confirma** (`mensaje.como`, y las respuestas le llegan a él).
    Los textos se editan en Ajustes (decisión 17); **cuándo y dónde** no se pueden quitar:
    - **El asunto dice la hora y el sitio**: `Sustitución · mar 17 nov · 10:30 · 2º B (aula 2B)`;
      con varias horas, `Sustituciones · mar 17 nov · 10:30 y 12:30 · 2º B`; con varios días,
      `Sustituciones · del 17 al 19 nov · 4 horas`.
    - **A cada sustituto, uno** con todas sus horas de esa ausencia. Cada bloque, en grande la
      **hora** («10:30 – 11:15 · martes 17 de noviembre») y el **lugar** («Aula 2B · 2º B ·
      Matemáticas»), las **indicaciones** si las hay y el botón **«Añadir a mi Google Calendar»**
      (decisión 18). **Sin motivo.**
    - **Al codocente que se queda con su grupo**, el suyo (`en_aula`, decisión 5).
    - **Al ausente, uno**: qué horas se cubren y quién entra en cada una (y cuáles se quedan sin
      cubrir). Tampoco repite el motivo.
    - **Cambios**: al sustituto nuevo, el aviso normal; al que deja de serlo, «ya no hace falta que
      cubras…»; al ausente, la lista actualizada. **Anulación**: a todos los sustitutos y al ausente.
    - Cada sesión guarda `aviso_estado` (`no` · `enviado` · `error`): un correo que falla **no
      deshace** la ausencia; la ficha enseña el error y el botón «Reenviar».
    - Interruptor **«Avisar por correo»**, encendido por defecto si la fecha es hoy o futura y
      apagado si es pasada (registrar después no manda nada).
11. **Cuentas y datos de salud.** Cada sesión ausente de una ausencia confirmada cuenta **para el
    ausente**; cada sesión cubierta, **para el sustituto**. En cifras e informes el motivo se
    agrupa en **Actividad escolar** (motivo «Actividad escolar») y **Personal** (el resto) (David,
    12-nov-2026). El motivo concreto solo se ve en la ficha de la ausencia y en el historial,
    dentro del módulo. No se loguea.
12. **Informe mensual** del mes anterior, el **día 1**, por cron (`/api/sustituciones/cron/informe`,
    protegido con `CRON_SECRET`, en `vercel.json`). Va a todas las cuentas activas con rol `jefe`
    y a los buzones de `SUSTITUCIONES_INFORME_COPIA` (lista separada por comas). **El de Dirección
    titular es `titular@consolacionburriana.com`** (David, 13-nov-2026): es el valor de esa
    variable en Vercel (no se escribe en el código: un fork pone el suyo). **Idempotente**:
    `sust_informes` guarda el mes; si ya se mandó, no repite. Contenido: sesiones ausentes por profe
    (escolar / personal), sesiones cubiertas por sustituto, horas que se quedaron sin cubrir y
    acumulado del curso. En la sección Números, «Ver el informe de octubre» (vista previa) y
    «Enviarlo ahora» (`ConfirmarEnLinea`).
13. **Curso académico** con `academicYearActual(fecha)` de `src/lib/constants.ts`, guardado en la
    ausencia (los totales del curso no dependen de recalcular fechas).
14. **Foto, no referencia.** Cada sesión ausente guarda fecha, hora, tramo, grupos, materia, aula y
    nombres: una reimportación de horarios **borra y rehace** `hor_sesiones`, así que
    `hor_sesion_id` se guarda **sin FK**, solo como pista.
15. **Rejilla de disponibilidad** (la de Lucía en la ESO, con el patrón de la de Oratorios). Por
    profe y franja de su semana, uno de cuatro estados, con icono de lucide y su texto (nada de
    emojis en pantalla, `diseno.md`). Lo que sale solo del horario está en
    `CONFIGURACION.sustituciones.disponibilidadPorDefecto`, **configurable** (David, 13-nov-2026):

    | Estado | Icono | Quiere decir | Sale solo del horario cuando a esa hora tiene… |
    |---|---|---|---|
    | **Sí** | `Smile` (verde) | Intentamos que sí | Ya está en el aula, Guardia |
    | **Si hace falta** | `Meh` (neutro) | Disponible | Codocencia, Tut. indiv., J.E., A.L., P.T., Godly, TIC, Pastoral, Gabinete, Dirección, Atención a familias y el resto de «Otras horas sin alumnado» |
    | **Solo urgencia** | `Frown` (ámbar) | Si no hay otra, pero intentamos que no | Hora libre en el colegio |
    | **No** | `Ban` (gris) | No se le propone | Clase propia, y todo lo nunca liberable |

    (David, 13-nov-2026: codocencia, tutoría individual y atención a familias, «si hace falta».)
    Dentro de un mismo estado ordena el nivel, así que atención a familias queda detrás de toda la
    lista. **Solo se guarda lo que Jefatura cambia a mano** (`sust_disponibilidad`), por **día +
    hora de inicio y fin** y curso, no por id de tramo (como `ora_disponibilidad`: reimportar
    horarios no lo borra). Una clase propia como principal **no** se puede subir de «No». Un botón
    «Volver a lo del horario» borra los retoques de un profe.
16. **«Mis sustituciones»: hecho para todo el claustro, abierto de momento solo a quien tiene el
    módulo** (David, 13-nov-2026: «prueba de concepto»). Se construye entero, pero
    `CONFIGURACION.sustituciones.misSustitucionesParaTodos = false` hace que la página, su API y
    el aviso del escritorio pidan el módulo `sustituciones` (Jefatura, Dirección, Secretaría, TIC).
    Dentro de la página, un `Aviso` (`info`) lo dice: «Prueba de concepto: de momento esta
    pantalla solo la ven Jefatura, Dirección, Secretaría y TIC. Para abrirla a todo el
    profesorado hay que cambiar `misSustitucionesParaTodos` en `src/lib/configuracion.ts`
    (docs/32, decisión 16)». Abrirla es poner `true`: entonces basta la sesión (`requireSession`).
    En los dos casos cada uno ve **solo lo suyo**, casado por su correo (`getProfePorEmail`).
    - En el **escritorio**, franja «Ahora»: aviso «Tus sustituciones» cuando tiene alguna hoy o en
      los próximos 7 días («Hoy a 3ª en 2º B, aula 2B» / «3 en los próximos días»). Sin ninguna, no
      sale nada.
    - **En «Mi horario»** (David, 13-nov-2026: «ok, bonito»): una franja encima de la rejilla, «Esta
      semana cubres: martes 10:30 · 2º B · aula 2B», con el mismo interruptor de arriba.
    - **`/gestion/mis-sustituciones`**: próximas y de los últimos 30 días, cada una con fecha, hora,
      grupo, materia, aula, a quién cubre (sin motivo), indicaciones y «Añadir a mi Google
      Calendar». Si es él quien falta, «Te cubren»: quién entra en cada hora.
    - Nada más: ni cifras de otros, ni rejilla, ni historial ajeno.
17. **Plantillas de correo editables**, en `/gestion/sustituciones/ajustes` (un enlace en la página,
    no una sección). Cinco: **aviso al sustituto**, **al codocente que se queda el grupo**
    (`en_aula`), **al ausente**, **cambio** y **anulación** (el informe mensual no: es una tabla).
    De cada una se edita el **asunto** y el **texto de antes y de después** de los bloques, con
    variables `{nombre}` `{ausente}` `{fecha}` `{horas}` `{grupo}` `{aula}` `{quien}` (botones que
    las insertan). Los bloques de hora y lugar los pone siempre el código. **Vista previa en vivo**
    con datos de ejemplo, «Enviarme una prueba» y «Volver al texto de fábrica». Se guardan en
    `cfg_ajustes` (clave `sustituciones.correos`); sin nada guardado, el de fábrica. El texto se
    escapa (como en Evaluaciones).
18. **«Añadir a mi Google Calendar» es un enlace, no una integración.** Un enlace a
    `https://calendar.google.com/calendar/render?action=TEMPLATE` con título («Sustitución · 2º B ·
    Matemáticas»), fechas en hora de Madrid (`ctz=Europe/Madrid`), lugar (el aula) y detalles
    (indicaciones). Cada uno se lo crea si quiere, en su calendario, al tocarlo: **la app no crea
    eventos ni pide permisos de Calendar** (David, 13-nov-2026). Uno por hora, en el correo y en
    «Mis sustituciones». Función pura `enlaceGoogleCalendar()` en `sustituciones.ts`, con test.
19. **Quién ha cubierto más** (como «A quién se ha molestado más» de Oratorios). En Números, profe ×
    mes / trimestre / curso, ordenado de más a menos con barra, y cuántas fueron de «Solo
    urgencia». Es información para repartir mejor, no un marcador: aquí, si te toca, te toca.
20. **Icono en índigo** (David, 13-nov-2026: «otro color que Oratorios», que es teal como todo
    «Organización del centro»). Es una **excepción** a «el color del módulo es el de su grupo»
    (`diseno.md`): `modulos.ts` gana un `acento` opcional por módulo que `IconoModulo` usa antes
    que el del grupo, solo Sustituciones lo lleva, y la excepción se apunta en la tabla §3 de
    `diseno.md` en el mismo commit. Índigo porque no es de estado (verde, ámbar, rojo) ni de
    ningún grupo. Sigue siendo **solo el icono**: botones en azul como siempre.
21. **El cuadro «HORARIO SUSTITUCIONES» del `.docx`** (David, 13-nov-2026: «es un resumen; se puede
    consultar también, en segundo orden de prioridad»). Hoy el lector de horarios **lo salta**
    (`RE_CUADRO_AJENO` en `horarios-lectores.ts`). Se pasa a leer al importar y se guarda en
    `hor_cuadro_sustituciones` (es parte del horario: se rehace con cada importación de su
    periodo, como las sesiones): por periodo, día, hora de inicio y fin, y profe (con el texto tal
    cual si no casa con nadie, y aviso en la vista previa del import). Se usa en dos sitios: como
    tercer criterio de orden (decisión 8) y **para consultarlo**: en «Nueva ausencia», junto a cada
    hora, «En el cuadro: Lucía, Pere»; y en Disponibilidad › La semana, en cada casilla. **Antes de
    leerlo hay que ver su formato** en un `.docx` real (no está en el repo: los ficheros con datos
    no se commitean).

---

## 3. Preguntas para David

Ninguna: todas respondidas el 13-nov-2026 (están en §2). La última, qué horario manda en
septiembre y junio cuando una etapa no tiene el suyo subido: **el ordinario** (decisión 4).

---

## 4. Plan técnico

### 4.1 Nombres

| Cosa | Nombre |
|---|---|
| Módulo (`permissions.ts`, `modulos.ts`, `escritorio.ts`) | `sustituciones` · «Sustituciones» · grupo `centro` · `acento` índigo |
| Rutas de pantalla | `src/app/gestion/sustituciones/…` y `src/app/gestion/mis-sustituciones/` |
| API | `src/app/api/sustituciones/admin/…` (guard `requireModule('sustituciones')`), `src/app/api/sustituciones/mias` y `src/app/api/sustituciones/cron/informe` |
| Tablas | `sust_ausencias`, `sust_sesiones`, `sust_disponibilidad`, `sust_informes`; y `hor_cuadro_sustituciones` (de Horarios) |
| Lógica pura (con tests) | `src/lib/sustituciones.ts` · `src/lib/__tests__/sustituciones.test.ts` |
| Consultas | `src/lib/sustituciones-server.ts` |
| Correos | `src/lib/sustituciones-email.ts` · perfil `sustituciones` |
| Componentes | `src/components/sustituciones/` |
| SQL | `src/db/sql/sustituciones.sql` (+ línea en `pendientes.txt`) |
| Coberturas por baja (se **importan**, no se tocan) | `esVigente`, `aplicarCoberturasBaja` de `src/lib/coberturas-baja.ts` |

### 4.2 Schema (`src/db/schema.ts`, bloque `// ─── Sustituciones (prefijo sust_) ───`)

```ts
// Una ausencia: un profe, de tal a tal fecha, un motivo. Las horas, en sust_sesiones.
sust_ausencias
  id               uuid pk
  academic_year    text not null                 // '2026-27'
  desde            date not null
  hasta            date not null                 // = desde si es un día
  profe_id         uuid not null → edu_teachers
  profe_nombre     text not null                 // foto
  motivo           text not null                 // 'actividad_escolar'|'medico'|'medico_familiar'|'enfermedad_leve'|'baja'|'otros'
  nota             text                          // detalle de «Otros» u observación interna; NUNCA va en correos
  indicaciones     text                          // qué hace la clase; SÍ va al sustituto
  estado           text not null default 'confirmada'   // 'confirmada'|'anulada'
  creada_por_email text not null
  anulada_por_email text, anulada_at timestamp
  created_at, updated_at
  index (desde, hasta) · index (profe_id, desde) · index (academic_year)

// Cada hora de cada día de la ausencia, con su foto. Lo que se cuenta.
sust_sesiones
  id               uuid pk
  ausencia_id      uuid not null → sust_ausencias
  fecha            date not null
  hor_sesion_id    uuid                          // SIN FK: los imports rehacen hor_sesiones
  tramo            text                          // '3ª'
  hora_inicio      text not null, hora_fin text not null   // 'HH:mm', como hor_tramos
  grupos           text                          // '2º B' o '3 años A, 3 años B', ya formateado
  materia          text, aula text, actividad text
  hay_que_cubrir   boolean not null
  sustituto_id     uuid → edu_teachers           // null = sin cubrir (o no hace falta)
  sustituto_nombre text, sustituto_email text
  nivel            text                          // clave del nivel: 'en_aula'|'guardia'|'codocencia'|…|'otras'|'libre'|'manual'
  disponibilidad   text                          // con la que se eligió: 'si'|'si_hace_falta'|'urgencia'
  aviso_estado     text not null default 'no'    // 'no'|'enviado'|'error'
  aviso_enviado_at timestamp, aviso_error text
  created_at, updated_at
  index (ausencia_id) · index (sustituto_id, fecha) · index (fecha)

// Los retoques a mano de la disponibilidad (decisión 15). Lo que no está aquí sale del horario.
sust_disponibilidad
  id uuid pk
  profe_id uuid not null → edu_teachers
  academic_year text not null
  dia_semana integer not null              // 1-5
  hora_inicio text not null, hora_fin text not null   // por horas, no por tramo
  estado text not null                     // 'si'|'si_hace_falta'|'urgencia'|'no'
  nota text                                // «los martes acompaña a 5º a piscina»
  updated_by_email text, updated_at timestamp
  unique (profe_id, academic_year, dia_semana, hora_inicio)

// Un informe mensual mandado (idempotencia del cron).
sust_informes
  id uuid pk · mes text not null unique ('2026-10') · destinatarios jsonb · resumen jsonb · enviado_at timestamp · created_at

// En el bloque de Horarios: el cuadro «HORARIO SUSTITUCIONES» del .docx (decisión 21).
hor_cuadro_sustituciones
  id uuid pk
  periodo_id uuid not null → hor_periodos
  dia_semana integer not null
  hora_inicio text not null, hora_fin text not null
  edu_teacher_id uuid → edu_teachers       // null si el texto no casa con nadie
  texto text not null                      // lo que ponía la celda, para no perder nada
  import_run_id uuid
  index (periodo_id, dia_semana)
```

Sin unicidad (profe, fecha) a propósito (decisión 3); el no-solape se comprueba en el servidor.
SQL aditivo e idempotente en `src/db/sql/sustituciones.sql` (y `hor_cuadro_sustituciones` en el
mismo fichero o en uno de horarios), apuntado en `pendientes.txt` y aplicado con
`pnpm db:sql --pendientes` (**nunca `db:push`**, ver 04-convenciones).

### 4.3 Configuración (`src/lib/configuracion.ts`, sin imports)

```ts
sustituciones: {
  etapas: ['EI', 'EP', 'ESO'],
  motivos: [
    { clave: 'actividad_escolar', nombre: 'Actividad escolar', escolar: true },
    { clave: 'medico', nombre: 'Médico' },
    { clave: 'medico_familiar', nombre: 'Médico familiar' },
    { clave: 'enfermedad_leve', nombre: 'Enfermedad leve' },
    { clave: 'baja', nombre: 'Baja' },
    { clave: 'otros', nombre: 'Otros', pideNota: true },
  ],
  maxDiasAusencia: 15,               // más largo = cobertura por baja (Profesorado)
  enAulaPrimero: true,
  diasReparto: 30,                   // ventana del desempate «quien menos ha cubierto»
  avisoProximosDias: 7,              // «Tus sustituciones» en el escritorio
  misSustitucionesParaTodos: false,  // decisión 16: prueba de concepto, solo con el módulo
  // Disponibilidad automática (decisión 15). Lo que no está aquí es 'no'.
  disponibilidadPorDefecto: {
    en_aula: 'si', guardia: 'si',
    codocencia: 'si_hace_falta', tut_indiv: 'si_hace_falta', je: 'si_hace_falta',
    al: 'si_hace_falta', pt: 'si_hace_falta', godly: 'si_hace_falta', tic: 'si_hace_falta',
    pastoral: 'si_hace_falta', gabinete: 'si_hace_falta', direccion: 'si_hace_falta',
    otras: 'si_hace_falta',          // atención a familias incluida
    libre: 'urgencia',
  },
  nuncaLiberables: ['TALLER DE PENSAMIENTO', 'HUERTO'],   // etiquetas, normalizadas
  niveles: [                         // decisión 7; texto normalizado (MAYÚSCULAS, sin acentos)
    { clave: 'guardia',    nombre: 'Guardia',     actividades: ['guardia'] },
    { clave: 'codocencia', nombre: 'Codocencia',  actividades: ['clase', 'tutoria'], noPrincipal: true, conGrupo: true },
    { clave: 'tut_indiv',  nombre: 'Tut. indiv.', etiquetaContiene: ['TUTORIA INDIVIDUAL'] },
    { clave: 'je',         nombre: 'J.E.',        actividades: ['coordinacion'], etiquetaContiene: ['JEFATURA'] },
    { clave: 'al',         nombre: 'A.L.',        actividades: ['apoyo_al'] },
    { clave: 'pt',         nombre: 'P.T.',        actividades: ['apoyo_pt'] },
    { clave: 'godly',      nombre: 'Godly',       actividades: ['oratorio'], etiquetaContiene: ['GODLY'] },
    { clave: 'tic',        nombre: 'TIC',         actividades: ['reunion'], etiquetaIgual: ['TIC'] },
    { clave: 'pastoral',   nombre: 'Pastoral',    etiquetaContiene: ['PASTORAL'] },
    { clave: 'gabinete',   nombre: 'Gabinete',    etiquetaContiene: ['ORIENTACION'] },
    { clave: 'direccion',  nombre: 'Dirección',   actividades: ['coordinacion'], etiquetaEmpieza: ['DIRECCION'] },
    { clave: 'otras',      nombre: 'Otras horas sin alumnado', sinGrupo: true,
      actividades: ['atencion_padres', 'atencion_alumnos', 'departamento', 'reunion', 'coordinacion', 'libre_disposicion', 'otros'] },
  ],
},
```

Más su test en `configuracion.test.ts` (fija los valores de Consolación, como el resto).

### 4.4 Lógica pura (`src/lib/sustituciones.ts`, todo con tests)

- Tipos: `SesionDia` (`sesionId, fecha, horaInicio, horaFin, tramo, actividad, etiqueta,
  grupos[], materia, aula, profes[{id, principal, rol}]`), `Ocupacion`, `Candidato`, `Propuesta`.
- `solapa(a, b)` (sacar la de `oratorios.ts` a un sitio común o copiarla con su test).
- `diasLectivos(desde, hasta, festivos)` y el tope de `maxDiasAusencia`.
- `nivelDe(ocupacion, profeId, config)` → clave del primer nivel que case, o `null` si es nunca
  liberable.
- `disponibilidadDe(ocupaciones, retoques, config)` → `'si' | 'si_hace_falta' | 'urgencia' | 'no'`
  (lo automático de la decisión 15, pisado por el retoque si lo hay; nunca sube una clase propia).
- `rejillaDisponibilidad(semana, profeId, retoques, cuadro, config)` → la semana de un profe;
  `mapaSemana(...)` → por franja, cuántos hay en cada estado y quién sale en el cuadro.
- `sesionesDelAusente(dia, profeId)` → sus sesiones, cada una con `hayQueCubrir` y, si hay otro
  profe en ella, `enAula` (decisión 5).
- `proponerSustitutos({ dias, ausenteId, sesionesElegidas, ausentesDelDia, ocupadosDelDia,
  oratoriosDelDia, cuadro, cargas, config })` → por sesión: candidatos agrupados por
  disponibilidad y nivel (ordenados, decisión 8) y `elegido`. Puro, determinista, y se llama otra
  vez en el cliente cuando Jefatura cambia un desplegable (para descontar al elegido).
- `enlaceGoogleCalendar({ titulo, fecha, horaInicio, horaFin, lugar, detalles })` (decisión 18).
- `pintarPlantilla(plantilla, variables)` con escapado, y `PLANTILLAS_DE_FABRICA`.
- `agruparMotivo(motivo)` → `'escolar' | 'personal'`; `resumenMes(filas)` para cifras e informe.
- `puedeVerMisSustituciones(acceso, config)` (decisión 16), para página, API y escritorio.
- Schemas **Zod** de las peticiones (compartidos cliente/servidor).
- **Tests mínimos** (fixtures inventadas, nunca de Neon): rejillas EI, EP y ESO con horas
  distintas que solapan a medias; candidato con dos ocupaciones (una nunca liberable → fuera); el
  mismo candidato no sale dos veces a la misma hora del mismo día; otro ausente excluido; oratorio
  fechado excluido; baja cubierta vigente (el sustituto hereda el horario, el titular no es
  candidato); «Si hace falta» de nivel 11 va antes que «Solo urgencia»; dentro del mismo estado
  manda el nivel; a igual nivel, el del cuadro va primero; continuidad antes que reparto; «Solo
  urgencia» nunca elegido solo; un retoque a «No» saca a alguien; un retoque no sube una clase
  propia; el Almuerzo y el Taller de Pensamiento no son liberables; atención a familias cae en
  «Otras»; `Reunión Orientación | Tutoría individual` cae en Tut. indiv.; 0 candidatos →
  `elegido = null`; codocente en el aula → nivel 0; rango con un festivo en medio (se salta);
  rango de 16 días lectivos → error; periodo especial sin rejilla de la etapa → horario
  ordinario (y con rejilla propia, la suya); `enlaceGoogleCalendar` con hora de Madrid y caracteres raros.

### 4.5 Servidor (`src/lib/sustituciones-server.ts`)

- `horarioDeDias(desde, hasta)`: decisión 4, **una tanda** (`Promise.all`) para todo el rango:
  periodos + rejillas + ámbitos; sesiones de los días de la semana que caen con tramo,
  asignación, actividad, grupos, profes, materia, aula; `edu_sustituciones` (coberturas por
  baja); `hor_festivos`; `edu_teachers` activos (solo id, nombre mostrado, correo); `sust_*`
  confirmadas del rango; `ora_sesiones` del rango no anuladas; `sust_disponibilidad` del curso;
  `hor_cuadro_sustituciones` de los periodos; cargas (sesiones cubiertas por sustituto en
  `diasReparto`). Pide solo columnas (nada de `select *` en `edu_teachers`).
- `semanaTipo(academicYear)`: lo mismo sin fecha (la semana ordinaria) para la rejilla de
  disponibilidad; `guardarRetoque`, `borrarRetoques(profeId)`.
- `misSustituciones(email)` (solo lo suyo) y `avisoEscritorio(email)` (consulta ligera para
  «Ahora» y para la franja de Mi horario).
- `getPlantillas()` / `guardarPlantillas()` sobre `cfg_ajustes` (`ajustes-server.ts`).
- `confirmarAusencia(entrada, quien)`: valida (días lectivos, tope de días, no solape con otra
  ausencia del mismo profe, sustitutos libres **releyendo** la BBDD), inserta con `db.batch`, y
  luego manda los correos y actualiza `aviso_estado`. Devuelve la ausencia y los fallos de
  correo, si los hay.
- `cambiarSesion`, `anadirSesion`, `quitarSesion`, `cambiarFechas`, `anularAusencia`,
  `reenviarAvisos`.
- `listarDia(fecha)`, `listarHistorial(filtros)`, `cifras(academicYear, mes?)`,
  `informeMes(mes)` y `enviarInforme(mes, { forzar })`.
- Horarios (aparte, en `horarios-lectores.ts` / `horarios-import.ts` / `horarios-server.ts`):
  leer el cuadro en vez de saltarlo, enseñarlo en la vista previa y guardarlo al importar
  (decisión 21), con sus tests.

### 4.6 API (route handlers, Zod en la entrada)

| Método y ruta | Guard | Qué hace |
|---|---|---|
| `POST /api/sustituciones/admin/propuesta` | módulo | `{ profeId, desde, hasta }` → sus sesiones por día y la propuesta. No escribe. |
| `POST /api/sustituciones/admin/ausencias` | módulo | Confirmar: `{ profeId, desde, hasta, motivo, nota?, indicaciones?, avisar, sesiones: [{ fecha, horSesionId, sustitutoId \| null, nivel }] }` |
| `PATCH /api/sustituciones/admin/ausencias/[id]` | módulo | `{ accion: 'cambiar' \| 'anadir' \| 'quitar' \| 'fechas' \| 'indicaciones' \| 'anular', … }` |
| `POST /api/sustituciones/admin/ausencias/[id]/reenviar` | módulo | Reenvía los avisos en `error` (o todos con `todos: true`). |
| `GET /api/sustituciones/admin/informe?mes=2026-10` · `POST` | módulo | Vista previa · enviar ahora. |
| `GET /api/sustituciones/admin/disponibilidad?profeId=` · `PUT` · `DELETE` | módulo | Rejilla de un profe · guardar un retoque · «Volver a lo del horario». |
| `GET /api/sustituciones/admin/plantillas` · `PUT` · `POST …/plantillas/prueba` | módulo | Leer · guardar · enviarme una prueba. |
| `GET /api/sustituciones/mias` | `puedeVerMisSustituciones` | Lo mío, filtrado por el correo de la sesión. |
| `GET /api/sustituciones/cron/informe` | `CRON_SECRET` | Cron del día 1, mes anterior, idempotente. |

### 4.7 Pantallas (todo con piezas de `src/components/ui/`, ver [`diseno.md`](./diseno.md))

`layout.tsx`: `PaginaModulo modulo="sustituciones" ancho="normal"`, `secciones` **Hoy ·
Disponibilidad · Historial · Números**, acción principal **«Nueva ausencia»**
(`buttonVariants({ size: 'sm' })` con `Plus`, enlace a `/gestion/sustituciones/nueva`). Modelo de
cómo queda: Nouvinguts.

- **Hoy** (`page.tsx`, `h1` oculto). Arriba, la fecha (`Input type="date"`, hoy por defecto, con
  «‹ ›» para día anterior y siguiente; `history.pushState`, no `router.replace`). `Cifras`: horas
  a cubrir · cubiertas · **sin cubrir** (`tono="aviso"` si > 0). Debajo, **por hora** (no por
  profe: es como lo piensa Jefatura a las 8:45), una fila por sesión: `3ª · 10:30-11:15` ·
  `Etiqueta` del grupo · materia · aula · «Falta Marta → entra **Lucía**» · `Estado` (`Cubierta`
  verde, `Sin cubrir` ámbar, `Correo con error` rojo). Toca la fila → ficha de la ausencia. Vacío:
  `Vacio` «Hoy no falta nadie».
- **Nueva ausencia** (`nueva/page.tsx`, `EnlaceVolver` + `TituloPagina` «Nueva ausencia»,
  formulario en `max-w-2xl`, todo en una pantalla, en tres bloques que se van abriendo):
  1. **Quién y cuándo**: profe (`Selector` con todo el profesorado con horario, por nombre
     mostrado), **desde** (hoy) y **hasta** (igual que desde; dos `Input type="date"` en una
     fila), motivo (`Selector`; con «Otros», `Campo` + `Input` para la nota). Si algún día no es
     lectivo, se dice y se salta; si el rango pasa de 15 días lectivos o el profe tiene una baja
     cubierta, `Aviso` con enlace a Profesorado y no se sigue. Si una etapa usa el ordinario
     porque no tiene horario de septiembre o junio, una línea lo dice (decisión 4).
  2. **Sus horas**: un bloque por día (con varios días, el primero abierto y el resto plegados,
     «martes 17 · 4 horas a cubrir»), una fila por sesión (hora, grupo, materia, aula, y
     «Codocencia» / «Reunión»… en gris si no hay que cubrirla) con un `Interruptor`
     (`etiquetaOculta`); las que hay que cubrir, encendidas. Atajos «Todo el día» / «Solo las
     clases» (dos `Button` `outline`). Sin horario ese día: `Vacio` «Ese día no tiene horas».
  3. **Quién cubre**: por hora encendida, `Selector` nativo con `<optgroup>` por disponibilidad y
     nivel («Ya está en el aula», «Sí · Guardia», «Si hace falta · Codocencia», …, «Solo
     urgencia», «Todo el claustro (tiene clase)») y la opción «Sin cubrir»; cada opción con «· N
     este mes» y «en el cuadro» si lo está. Debajo, en pequeño, «En el cuadro: Lucía, Pere»
     (decisión 21). Al lado, `Estado` con el nivel elegido o «Sin cubrir» (ámbar). `Textarea`
     **Indicaciones para la clase** (opcional, una para toda la ausencia).
  `BarraAcciones`: `Interruptor` «Avisar por correo» y el único botón azul: **«Confirmar y avisar
  a 3 personas»** (o «Guardar sin avisar»), con `cargando`. Al terminar: `toast` y a la ficha.
- **Ficha de la ausencia** (`[id]/page.tsx`): `EnlaceVolver` a Hoy, `TituloPagina` «Marta Rubio ·
  del martes 17 al jueves 19 de noviembre», motivo (`Etiqueta`), indicaciones editables, y las
  horas por día con su sustituto (`Selector` para cambiarlo, en el sitio, con `toast` «Avisado
  Lucía»), estado del aviso y «Reenviar». Añadir hora, cambiar fechas. Abajo, `ConfirmarEnLinea`
  «Anular ausencia» (`destructive`): «Se avisará a 3 personas de que ya no hace falta».
- **Disponibilidad** (`disponibilidad/page.tsx`). Dos vistas con `Filtros` (no un segundo
  segmentado: ya hay secciones): **Por profe** y **La semana**.
  - *Por profe*: `Selector` del profe y su semana (días × franjas de sus rejillas); en cada
    casilla, **lo que tiene en el horario** («Codocencia 3º A», «At. familias») en pequeño y **el
    estado** (icono + texto) en grande. Tocar cicla Sí → Si hace falta → Solo urgencia → No →
    Automático, y se guarda solo (`toast`); la casilla retocada lleva una marca «a mano». Las de
    clase propia, en gris y sin toque. «Volver a lo del horario» con `ConfirmarEnLinea`. Misma
    apariencia que la rejilla de Oratorios: reutilizar `franjasDeEtapas`/`huecoEn` de
    `lib/oratorios.ts` y, si el componente se puede compartir **sin cambiar cómo funciona
    Oratorios**, subirlo a `ui/` y apuntarlo en `diseno.md`; si no, uno propio igual de aspecto.
  - *La semana*: un `Filtro` por etapa (Infantil · Primaria · ESO) y sus días × franjas con, en
    cada casilla, cuántos hay de cada estado («3 · 2 · 1») y quién sale en el cuadro, en
    **ámbar** si no hay ningún Sí ni Si hace falta: dónde va a faltar gente antes de que pase.
    Tocar abre la lista de esa franja.
- **Ajustes** (`ajustes/page.tsx`, `EnlaceVolver` + `TituloPagina` «Correos»): las cinco
  plantillas (`Filtros` para elegir cuál), `Input` del asunto, dos `Textarea` (antes y después de
  los bloques), botones de variables, la **vista previa** al lado (debajo en el móvil) tal como
  llega, y en `BarraAcciones`: «Volver al de fábrica» (`ghost`), «Enviarme una prueba» (`outline`)
  y **«Guardar»**.
- **Historial** (`historial/page.tsx`): `Filtros` de mes, profe y motivo (escolar / personal);
  lista de ausencias (fechas, profe, horas, cubiertas / sin cubrir, `Estado` «Anulada» en gris).
- **Números** (`numeros/page.tsx`): `Filtros` «Este mes / Trimestre / Curso»; `Cifras` totales; dos
  tablas (dentro de `Tarjeta`, desplazables): **por profe ausente** (escolar · personal · total) y
  **quién ha cubierto más** (decisión 19: ordenado, con barra, y cuántas de urgencia). «Ver el
  informe de octubre» y «Enviarlo ahora».
- **Mis sustituciones** (`src/app/gestion/mis-sustituciones/`, fuera del layout del módulo; su
  `layout.tsx` comprueba `puedeVerMisSustituciones` y pinta `PaginaModulo modulo="sustituciones"`
  sin secciones ni acción, que solo dibuja la cabecera): **arriba, el `Aviso` de prueba de
  concepto** (decisión 16) mientras `misSustitucionesParaTodos` sea `false`; luego «Próximas» y
  «Últimos 30 días», una `Tarjeta` por hora con hora y lugar en grande, a quién cubre,
  indicaciones y «Añadir a mi Google Calendar» (`buttonVariants({ variant: 'outline' })`, enlace
  externo); y «Te cubren» si es él quien falta. Vacío: «No tienes sustituciones a la vista».
- **Escritorio**: tarjeta en «Organización del centro» con el recuento del día («2 horas sin
  cubrir hoy», en ámbar si > 0) para quien tiene el módulo; y el aviso «Tus sustituciones» en
  «Ahora» (decisión 16, en `gestion/page.tsx` junto a los demás avisos) para quien
  `puedeVerMisSustituciones` y tiene alguna próxima.
- **Mi horario**: la franja «Esta semana cubres…» (decisión 16), con la misma condición.
- **Cada ruta con su `loading.tsx`** (`SkeletonPage` + `SkeletonRows`/`SkeletonTabla`), claro y
  oscuro, 390 y 1180 px, 44 px, nada solo al pasar el ratón, `pnpm diseno:guardia` en verde.

### 4.8 Lo que se reutiliza (no se vuelve a escribir)

| Necesito… | Ya existe en… |
|---|---|
| El horario de todos, con rejillas, periodos y festivos | `hor_*` (07-horarios); `diaSemana`, `solapa`, `periodoDeFecha` de `lib/oratorios.ts` como modelo |
| Quién cubre la baja de quién | `esVigente`, `aplicarCoberturasBaja` de `lib/coberturas-baja.ts` |
| Quién lleva un Oratorio ese día | `ora_sesiones` |
| El estilo de correo de compañero a compañero | `lib/oratorios-email.ts` (bloque con raya azul, `mensaje.como`) |
| Plantillas con variables y escapado | Evaluaciones (`plantillas-correo`), `lib/correos.ts` |
| Una rejilla de disponibilidad por franjas | `components/oratorios/disponibilidad.tsx`, `ora_disponibilidad` |
| «A quién se ha molestado más» | `components/oratorios/numeros.tsx` |
| Ajustes guardados sin tabla propia | `cfg_ajustes` + `ajustes-server.ts` |
| El profe de quien ha iniciado sesión | `getProfePorEmail` de `mihorario-server.ts` |
| Avisos de «Ahora» en el escritorio | `src/app/gestion/page.tsx` (`avisos.push`) |
| Envío, perfiles, transporte | `lib/email.ts` |
| El color del icono | `ACENTO_GRUPO` de `ui/icono-modulo.tsx` (se le añade el `acento` por módulo) |

### 4.9 Lo que el agente **no** debe hacer

- Usar `getPeriodoVigente()` para la fecha (elige un periodo para todo el centro) o comparar por
  `tramo_id`/`orden` (§1 y decisión 4). El periodo se elige **por etapa**, con el ordinario de
  respaldo.
- Usar `hor_actividades.cubre_sustitucion`.
- Tocar las Coberturas por baja más allá de importar sus funciones.
- Poner el motivo en un correo, en «Mis sustituciones» o en un `console.log`.
- Crear eventos de Google Calendar desde el servidor o pedir scopes de Calendar (decisión 18).
- Dejar que «Mis sustituciones» enseñe algo de otra persona, o abrirla a todos sin que David cambie
  `misSustitucionesParaTodos`.
- Poner el color índigo en algo que no sea el icono del módulo.
- `pnpm db:push`.

---

## 5. Fases (checklist)

### Fase 0 · reglas

- [x] Sesiones concretas de un día; Dirección titular y pedagógica comparten `direccion` (12-nov-2026).
- [x] Informe a cuentas de `jefe` más un buzón de Dirección titular (12-nov-2026; el buzón, 13-nov-2026).
- [x] Prioridad de David traducida al horario real y comprobada en Neon (13-nov-2026, decisión 7).
- [x] Revisión del plan: solape por horas, periodo por rejilla, exclusiones, ciclo de vida, salud (13-nov-2026).
- [x] Ideas de David del 13-nov-2026: plantillas, botón de Calendar, «Mis sustituciones», rejilla de disponibilidad, quién ha cubierto más.
- [x] Respuestas de David a P1-P11 (13-nov-2026): ESO, rangos de fechas, cuadro del centro, color propio.
- [x] **Las sustituciones largas de Educamos pasan a llamarse Coberturas por baja** en pantalla y código, para dejar libre «sustituciones» (13-nov-2026; typecheck, 1.436 tests, lint, guardia y build en verde; la tabla `edu_sustituciones` no cambia).
- [x] Septiembre y junio sin horario propio de una etapa: se mantiene el ordinario (David, 13-nov-2026).

### Fase 1 · proponer, confirmar y avisar (lo mínimo que se usa de verdad)

- [ ] Módulo `sustituciones` en `permissions.ts` (`MODULES`, `MODULE_LABELS`, `jefe` y `direccion`), `modulos.ts` (grupo `centro`, icono, `acento` índigo + excepción en `diseno.md`), `escritorio.ts`; tests de permisos.
- [ ] `CONFIGURACION.sustituciones` (§4.3) y su test.
- [ ] Schema `sust_*` en `schema.ts` + `src/db/sql/sustituciones.sql` idempotente + línea en `pendientes.txt`; aplicado con `pnpm db:sql --pendientes` (si no hay `DATABASE_URL`, `[~]` y decirlo).
- [ ] `sustituciones.ts` puro con los tests de §4.4 en verde.
- [ ] `horarioDeDias` en una tanda; probado contra Neon con un profe de EI, uno de EP y uno de la ESO, un lunes de octubre, un rango de tres días con un festivo y un día de septiembre (primaria con su horario de septiembre; infantil y ESO con el ordinario).
- [ ] API `propuesta` y `ausencias` (confirmar) con Zod, guard y la doble comprobación del `409`.
- [ ] Perfil `sustituciones` en `email.ts` y `sustituciones-email.ts` (sustituto, codocente en el aula, ausente) con plantillas de fábrica, asunto con hora y lugar y botón «Añadir a mi Google Calendar»; probado con un envío real a una cuenta propia (que el enlace abra el evento bien en el iPad); sin motivo.
- [ ] Disponibilidad automática (sin rejilla todavía) usada en la propuesta, con «Solo urgencia» fuera de la elección automática.
- [ ] Pantallas **Nueva ausencia** (con rango de fechas) y **Ficha** (solo ver + reenviar) con `loading.tsx`; claro/oscuro, 390/1180 px; `diseno:guardia` en verde.
- [ ] Pantalla **Hoy** con cifras y estado vacío.
- [ ] Tabla maestra de `plataforma.md` y esta ficha al día.

### Fase 2 · después de confirmar

- [ ] Cambiar sustituto, añadir y quitar hora, cambiar fechas, editar indicaciones (con sus correos de cambio).
- [ ] Anular ausencia con `ConfirmarEnLinea` y correo a todos.
- [ ] Tarjeta del escritorio con las horas sin cubrir de hoy.
- [ ] **Mis sustituciones** (con el `Aviso` de prueba de concepto), aviso «Tus sustituciones» en «Ahora» y franja en Mi horario, todo detrás de `puedeVerMisSustituciones`; comprobado que un profe sin el módulo no entra (y, poniendo `true` en local, que ve lo suyo y nada más).
- [ ] **Rejilla de disponibilidad** (Por profe y La semana) con `sust_disponibilidad`.
- [ ] **Ajustes de correos**: plantillas editables en `cfg_ajustes`, vista previa, prueba y volver al de fábrica.
- [ ] **Cuadro del centro** (decisión 21): ver el formato en un `.docx` real (pedírselo a Jose Miguel), leerlo en el importador de horarios con tests, `hor_cuadro_sustituciones`, y usarlo en la propuesta y en las dos pantallas.

### Fase 3 · cuentas e informe

- [ ] Historial con filtros.
- [ ] Números (mes / trimestre / curso; por ausente y quién ha cubierto más, con urgencias).
- [ ] Informe mensual: vista previa, «Enviarlo ahora», cron del día 1 en `vercel.json`, idempotente con `sust_informes`; `SUSTITUCIONES_INFORME_COPIA` en `.env.local.example`, en la tabla de variables de `04-convenciones-tecnicas.md` y en `08-despliegue-y-fork.md`.
- [ ] Poner `SUSTITUCIONES_INFORME_COPIA=titular@consolacionburriana.com` en Vercel (David o quien tenga acceso).

### Más adelante (ideas, no se hacen sin que David las pida)

- **Calendario de sustituciones** (David, 13-nov-2026): ver todas las que hay en marcha en una
  **semana** entera, días × franjas, con cada sesión cubierta en su hueco (quién falta, quién
  entra, grupo), y pasar de semana con ◀ ▶. Mismo dato que «Hoy», otra vista (un `Filtro` Día /
  Semana en Hoy, o una sección más).
- **Abrir «Mis sustituciones» a todo el profesorado**: `misSustitucionesParaTodos = true` (decisión 16).
- **Que el propio profe avise de que falta** desde Mi horario («Mañana no estoy a 1ª y 2ª, voy al
  médico») y le llegue a Jefatura ya rellenada como propuesta (David, 13-nov-2026: para el futuro).
- **Que cada profe marque su propia rejilla** de disponibilidad y Jefatura la valide.
- **Avisar al tutor del grupo** cuando el ausente es un especialista (sabe quién entra en su clase).
