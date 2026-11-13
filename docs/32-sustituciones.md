# Sustituciones · cubrir las ausencias del día (Infantil y Primaria)

**Estado:** plan funcional 🟡 (cerrado salvo las preguntas de §3, que tienen todas un valor por
defecto y **no bloquean** empezar) · plan técnico ✅ · implementado ⬜

Idea y primer plan de Jose Miguel Batalla (12-nov-2026, con David). Revisado contra el código y
contra los horarios reales de Neon el 13-nov-2026 (ver §1: lo que cambió y por qué).

Ruta: `/gestion/sustituciones` (secciones **Hoy · Disponibilidad · Historial · Números**, y un
enlace a **Ajustes** de los correos). Grupo del escritorio: **Organización del centro** (teal).
Para todo el claustro, sin el módulo: **`/gestion/mis-sustituciones`** y un aviso en «Ahora» del
escritorio cuando te toca cubrir algo.

Cuando un profe de infantil o primaria falta unas horas, Jefatura tiene que decidir quién entra
en cada una de sus clases, avisar a cada sustituto y al ausente, y llevar la cuenta de cuántas
horas falta cada uno y por qué. Hoy se hace de memoria y con el horario en papel. Este módulo lo
convierte en: **elijo profe, día y motivo → la app me dice qué clases quedan descubiertas y me
propone a quién mandar, por la prioridad del centro → reviso, confirmo y salen los correos.**

> **No confundir con `edu_sustituciones`** (ficha [`02`](./02-integracion-educamos.md), pantalla
> `/gestion/profes`): eso es la **sustitución larga** de Educamos («Ángela sustituye a Alejandro
> mientras dure la baja»), que hace heredar tutorías y horario. Este módulo es la **cobertura de
> unas horas sueltas**. Los dos conviven y este lee de aquel (decisión 5). Para no pisarse en el
> código, este módulo usa el prefijo **`coberturas`** en ficheros y funciones (§4.1).

### Glosario (para quien lo implemente)

| Palabra | Qué es |
|---|---|
| **Ausencia** | Un profe, un día, un motivo y las sesiones de ese día en las que no está. Una fila de `sust_ausencias`. |
| **Sesión ausente** | Cada hora de esa ausencia, con su foto (hora, grupo, materia, aula). Una fila de `sust_sesiones`. Es lo que se **cuenta**. |
| **Hay que cubrirla** | Sesión ausente en la que el ausente es quien da la clase a un grupo. Si no (era codocencia, una reunión…), cuenta pero no necesita sustituto. |
| **Cobertura** | Sesión ausente con sustituto asignado. |
| **Ocupación** | Lo que un posible sustituto está haciendo a esa hora según su horario (una clase, una codocencia, una reunión de Pastoral, nada…). |
| **Nivel** | El escalón de la lista de prioridad en que cae una ocupación (`Codocencia` es el 1). Lo da el horario, igual para todos. |
| **Disponibilidad** | Lo dispuesto que está **cada profe en cada franja** de su semana: **Sí** · **Si hace falta** · **Solo urgencia** · **No**. Sale sola del horario y Jefatura la retoca a mano (decisión 15). Es lo primero que ordena. |

---

## 1. Revisión del 13-nov-2026: lo que cambió y por qué

El plan de partida era bueno en lo funcional; estos fallos habrían salido en producción:

1. **«Mismo tramo» no sirve: infantil y primaria tienen rejillas distintas.** En Neon, un martes,
   la 2ª de EP es 09:45-10:30 y en EI no hay 2ª (la 1ª va de 09:00 a 10:10). Comparar por tramo
   u orden deja fuera a media plantilla y empareja horas que no coinciden. **Se compara por
   solape de horas** (`horaInicio`/`horaFin`), como ya hace Oratorios (`solapa()` en
   `oratorios.ts`). Lo mismo para candidatos que dan clase en la ESO.
2. **El periodo «vigente» de horarios no vale tal cual.** En septiembre (y en junio) manda el
   periodo `Septiembre`, que **solo tiene rejilla de EP**: con `getPeriodoVigente()`, infantil se
   quedaría sin horario. Hay que resolver el periodo **por rejilla** (decisión 4).
3. **La lista de prioridad no existe como tal en el horario.** No hay una actividad
   «Codocencia» ni «TIC»: son un **rol** (segundo profe en una clase) o **etiquetas** de reuniones
   y coordinaciones. Se mapeó contra Neon (decisión 7); **«Gabinete» no aparece en ningún
   horario** (pregunta P3).
4. **Faltaban exclusiones**: otro profe que también falta ese día, alguien que **ya cubre** otra
   hora a la misma hora (dos ausencias el mismo día), el responsable de un **Oratorio** fechado
   ese día a esa hora (`ora_sesiones`) y el titular de baja larga. Sin eso, la app propone a la
   misma persona en dos aulas.
5. **«Se omite a quien tenga otra asignación concurrente» se contradecía** con la propia lista:
   todo candidato tiene algo a esa hora (la codocencia, la reunión…). La regla buena: se omite a
   quien tenga a esa hora **alguna ocupación sin nivel** (una clase suya, atención a familias…).
6. **El correo no decía el grupo**, que es lo primero que necesita el sustituto («¿a qué clase
   voy?»). Ahora: hora, **grupo**, materia, aula e indicaciones.
7. **Datos de salud.** «Médico», «Enfermedad leve» o «Baja» son datos de salud (categoría
   especial del RGPD). **El motivo no sale nunca en los correos a sustitutos** y en informes y
   cifras se agrupa en «Actividad escolar / Personal» (decisión 11).
8. **No había vida después de confirmar**: cambiar un sustituto, añadir una hora, anular la
   ausencia (el profe al final viene), un correo que falla. Ahora sí (decisiones 9 y 10).
9. **No había reparto**: con «se muestran todas las del mismo nivel» siempre saldría la misma
   persona (la primera por orden). Desempate por **quien menos ha cubierto** (decisión 8).
10. **Choque de nombres en el código**: `src/lib/sustituciones.ts`,
    `sustituciones-server.ts` y `components/profes/sustituciones-panel.tsx` **ya existen** (son
    las sustituciones largas). Un agente que siguiera la convención `src/lib/<modulo>.ts` los
    habría pisado. Prefijo `coberturas` (§4.1).
11. **`hor_actividades.cubre_sustitucion` no se usa.** Su comentario mezcla dos preguntas
    contrarias («¿hay que cubrir esta hora?» y «la guardia es desde la que se cubre») y en
    infantil y primaria no hay guardias. Las reglas de este módulo viven en su configuración.
12. **Interruptor «Avisar por correo»** para registrar a posteriori (la ausencia de ayer) sin
    mandar correos a destiempo, y la fecha tiene que ser **lectiva** (ni fin de semana ni
    `hor_festivos`).

---

## 2. Decisiones cerradas

1. **Alcance: infantil y primaria.** Las ausencias se registran para profes con horario en EI o
   EP (`CONFIGURACION.sustituciones.etapas = ['EI', 'EP']`, nunca a mano en el código). Un
   candidato puede ser **cualquiera** del claustro con una ocupación liberable a esa hora,
   aunque también dé en la ESO (Dirección y Jefatura son de todo el centro).
2. **Acceso.** Módulo `sustituciones`, que ven Jefatura (`jefe`), Dirección (`direccion`; titular
   y pedagógica comparten rol, David 12-nov-2026), Secretaría y TIC (estos dos y `supertic` lo
   reciben solos al entrar en `MODULES`, ver `permissions.ts`). No va a orientación ni al
   claustro: el resto del profesorado solo ve **sus** sustituciones (decisión 16). Quien tiene el módulo lo ve y lo edita todo (no hay rol de solo lectura).
3. **Una ausencia es un profe, un día y un motivo.** Se eligen las sesiones concretas de ese día
   (David, 12-nov-2026). Puede haber dos ausencias del mismo profe el mismo día (a 1ª por
   médico y a 5ª por una salida); no pueden **solaparse** en horas.
   Motivos (`MOTIVOS` en `configuracion.ts`, en este orden): **Actividad escolar · Médico ·
   Médico familiar · Enfermedad leve · Baja · Otros**. «Otros» pide una nota corta.
4. **Qué horario tiene alguien en una fecha** (la función clave, `horarioDelDia(fecha)`):
   - Día de la semana de la fecha (1-5). Si es sábado, domingo o cae en `hor_festivos`, la
     pantalla lo dice (`Aviso`) y no deja seguir.
   - Para **cada rejilla**: de los periodos que contienen la fecha y **tienen esa rejilla con
     ámbito** de la etapa, gana el de más `prioridad`. Si una etapa no tiene rejilla en el periodo
     de más prioridad (infantil en septiembre y junio, hoy), se usa la del ordinario y la pantalla
     lo avisa una vez (pregunta P7).
   - Sesiones de esas rejillas en ese día, con su tramo (horas), asignación, actividad, grupos,
     profes (rol, `principal`), materia y aula (`hor_sesiones.aula`/`espacio_id` pisa a la de la
     asignación). Solo `tipo = 'sesion'` (los recreos, comedor… no se cubren desde aquí).
   - **Sustituciones largas vigentes** en esa fecha (`edu_sustituciones`, reutilizar
     `aplicarSustituciones`/`esVigente` de `src/lib/sustituciones.ts`): el horario del titular
     **pasa** al sustituto. El titular de baja larga no se propone como candidato ni se le puede
     registrar una ausencia (sale con una nota «Lo sustituye Ángela»).
   - Todo en **una tanda** de consultas en `Promise.all` (04-convenciones: cuesta el viaje).
5. **Qué sesiones del ausente hay que cubrir** (todas salen en la lista; estas van marcadas de
   salida y con «Hay que cubrirla»):
   - la sesión **tiene grupo** (`hor_asignacion_grupos` no vacío) **y** el ausente es
     `principal` en ella, **o** es el único profe;
   - si en esa misma sesión hay **otro profe que no falta** (codocencia en su clase), se marca
     igualmente pero se le propone a él primero con el nivel «Ya está en el aula» (pregunta P2).
   Las demás (codocencia en clase ajena, PT/AL, reuniones, atención a familias, Dirección…)
   salen desmarcadas: Jefatura puede marcarlas para que **cuenten** como ausencia, pero nunca
   piden sustituto (`hay_que_cubrir = false`).
6. **Quién puede cubrir una sesión** (`proponerCoberturas`, puro y con tests). Para cada sesión a
   cubrir, cada profe activo del claustro es candidato si, en la fecha y en las horas que
   **solapan** con la sesión:
   - no es el ausente, no tiene **otra ausencia** confirmada que solape ese día, y no es titular
     de una baja larga vigente;
   - no **cubre ya** otra sesión que solape ese día (confirmada en BBDD **o** elegida en esta
     misma propuesta, para que la propuesta no reparta a la misma persona dos veces);
   - no es responsable de un **Oratorio** ese día a esa hora (`ora_sesiones` con estado distinto
     de `anulado`; el oratorio lo lleva fuera de su horario);
   - su **disponibilidad** en esa franja (decisión 15) no es **No**. Si varias ocupaciones
     solapan, manda la **peor** disponibilidad y el **peor** nivel.
   - Una **hora libre** (nada en el horario) solo cuenta si ese día tiene algo antes **y** después
     (está en el colegio); por defecto es «Solo urgencia» (P1).
7. **La lista de prioridad de David, traducida al horario real** (comprobado en Neon el
   13-nov-2026). Vive en `CONFIGURACION.sustituciones.niveles`, en este orden; gana el **primer**
   nivel que case. Las etiquetas se comparan normalizadas (mayúsculas, sin acentos):

   | # | Nivel | Casa con… (actividad · condición) | En Neon hoy (EI+EP, ordinario) |
   |---|---|---|---|
   | 0 | Ya está en el aula | el otro profe de **la misma sesión** que se cubre | — (P2) |
   | 1 | Codocencia | `clase`/`tutoria` con grupo y el candidato **no** es `principal` (rol `apoyo`) | 62 asignaciones, 15 profes |
   | 2 | Tut. indiv. | etiqueta contiene `TUTORIA INDIVIDUAL` | 4 sesiones (`tutoria`) + 1 alternada con Orientación |
   | 3 | J.E. | `coordinacion`, etiqueta contiene `JEFATURA` | 6 sesiones, 1 profe |
   | 4 | A.L. | `apoyo_al` | 11 sesiones con profe |
   | 5 | P.T. | `apoyo_pt` | 13 sesiones con profe |
   | 6 | Godly | `oratorio`, etiqueta contiene `GODLY` | 4 sesiones |
   | 7 | TIC | `reunion`, etiqueta **igual a** `TIC` | 5 sesiones, 1 profe |
   | 8 | Pastoral | etiqueta contiene `PASTORAL` | 2 sesiones, 5 profes |
   | 9 | Gabinete | etiqueta contiene `ORIENTACION` (**supuesto**, P3) | 2 sesiones |
   | 10 | Dirección | `coordinacion`, etiqueta empieza por `DIRECCION` | 27 sesiones, 1 profe |

   **Sin nivel**: clase o tutoría propia como `principal` (nunca liberable: dejaría otra clase
   sola), atención a familias y a alumnado, departamento, Coordinación/Reunión de ciclo, COCOPE,
   Innovación, Comunicación, ETE, Equipo directivo, Almuerzo, Taller de Pensamiento
   Computacional, Huerto, Eucaristía y cualquier «Otros». Las que no son clase propia pueden
   ponerse a mano en «Solo urgencia» o más desde la rejilla de disponibilidad (decisión 15); por
   defecto, atención a familias y a alumnado ya salen en «Solo urgencia» (P4).
   Sondeo con estos niveles (primaria, mañanas): entre 2 y 12 candidatos por hora; **el martes a
   6ª salen 0** (todo el claustro está en la reunión de Coordinación). Por eso «Sin cubrir» es un
   estado normal, no un error.
8. **Orden de los candidatos (y el reparto).** 1) **disponibilidad**: Sí, luego Si hace falta;
   2) **nivel** de la lista de David (sin nivel, al final); 3) quien **continúa** (ya va a cubrir la sesión anterior o
   siguiente de esta misma ausencia: el mismo adulto toda la mañana en infantil); 4) **menos
   coberturas en los últimos 30 días**; 5) nombre. La propuesta elige el primero de cada sesión, en
   orden de hora, y lo descuenta antes de la siguiente (decisión 6). **«Solo urgencia» nunca se
   elige sola**: sale en el desplegable, en su grupo, para que Jefatura lo decida. Junto a cada
   nombre, sus coberturas del mes («· 3 este mes»).
9. **Ciclo de vida.** La propuesta **no se guarda** (vive en la pantalla hasta confirmar).
   Confirmar crea la ausencia y sus sesiones **en una sola escritura** (`db.batch`) y **vuelve a
   comprobar en el servidor** que ningún sustituto se ha ocupado mientras tanto (dos personas de
   Jefatura a la vez): si alguno choca, `409` con el nombre y la hora, y no se guarda nada.
   Después, desde la ficha de la ausencia: **cambiar el sustituto** de una hora (incluido «Sin
   cubrir»), **añadir o quitar** una hora, editar indicaciones, **anular** la ausencia (el profe al
   final viene: `estado = 'anulada'`, no se borra, deja de contar) y **reenviar** avisos. Las
   ausencias no se borran nunca (04-convenciones: histórico).
10. **Correos** (perfil nuevo `sustituciones` en `email.ts`; plantillas en `coberturas-email.ts`,
    con el mismo estilo que `oratorios-email.ts`: de compañero a compañero, sin firmas ni logos, y
    un **bloque por hora** con raya azul que es lo que se busca al abrirlo). Salen **como quien
    confirma** (`mensaje.como`, y las respuestas le llegan a él). Los textos se editan en Ajustes
    (decisión 17); **cuándo y dónde** no se pueden quitar:
    - **El asunto dice la hora y el sitio**: `Sustitución · mar 17 nov · 10:30 · 2º B (aula 2B)`;
      con varias horas, `Sustituciones · mar 17 nov · 10:30 y 12:30 · 2º B`.
    - **A cada sustituto, uno** con todas sus horas de esa ausencia. Cada bloque, en grande la
      **hora** («10:30 – 11:15 · martes 17 de noviembre») y el **lugar** («Aula 2B · 2º B ·
      Matemáticas»), las **indicaciones** si las hay y el botón **«Añadir a mi Google Calendar»**
      (decisión 18). **Sin motivo.**
    - **Al ausente, uno**: qué horas se cubren y quién entra en cada una (y cuáles se quedan sin
      cubrir). Tampoco repite el motivo: lo sabe.
    - **Cambios**: al sustituto nuevo, el aviso normal; al que deja de serlo, «ya no hace falta que
      cubras…»; al ausente, la lista actualizada. **Anulación**: a todos los sustitutos y al ausente.
    - Cada sesión guarda `aviso_estado` (`no` · `enviado` · `error`): un correo que falla **no
      deshace** la ausencia; la ficha enseña el error y el botón «Reenviar».
    - Interruptor **«Avisar por correo»**, encendido por defecto si la fecha es hoy o futura y
      apagado si es pasada (registrar después no manda nada).
11. **Cuentas y datos de salud.** Cada sesión ausente de una ausencia confirmada cuenta **para el
    ausente**; cada cobertura, **para el sustituto**. En cifras e informes el motivo se agrupa en
    **Actividad escolar** (motivo «Actividad escolar») y **Personal** (el resto) (David,
    12-nov-2026). El motivo concreto solo se ve en la ficha de la ausencia y en el historial,
    dentro del módulo. No se loguea.
12. **Informe mensual** del mes anterior, el **día 1**, por cron (`/api/sustituciones/cron/informe`,
    protegido con `CRON_SECRET`, en `vercel.json`). Va a todas las cuentas activas con rol `jefe`
    y a los buzones de `SUSTITUCIONES_INFORME_COPIA` (lista separada por comas; ahí va el de
    Dirección titular, David 12-nov-2026). **Idempotente**: `sust_informes` guarda el mes; si ya
    se mandó, no repite. Contenido: sesiones ausentes por profe (escolar / personal), coberturas
    por sustituto, horas que se quedaron sin cubrir y acumulado del curso. En la sección Números,
    «Ver el informe de octubre» (vista previa) y «Enviarlo ahora» (`ConfirmarEnLinea`).
13. **Curso académico** con `academicYearActual(fecha)` de `src/lib/constants.ts`, guardado en la
    ausencia (los totales del curso no dependen de recalcular fechas).
14. **Foto, no referencia.** Cada sesión ausente guarda hora, tramo, grupos, materia, aula y
    nombres: una reimportación de horarios **borra y rehace** `hor_sesiones`, así que
    `hor_sesion_id` se guarda **sin FK**, solo como pista.

15. **Rejilla de disponibilidad** (la de Lucía en la ESO, con el patrón de la de Oratorios). Por
    profe y franja de su semana, uno de cuatro estados, con icono de lucide y su texto (nada de
    emojis en pantalla, `diseno.md`):

    | Estado | Icono | Quiere decir | Sale solo del horario cuando a esa hora tiene… |
    |---|---|---|---|
    | **Sí** | `Smile` (verde) | Intentamos que sí | Ya está en el aula, Codocencia, Tut. indiv. |
    | **Si hace falta** | `Meh` (neutro) | Disponible, sin más | J.E., A.L., P.T., Godly, TIC, Pastoral, Gabinete, Dirección |
    | **Solo urgencia** | `Frown` (ámbar) | Disponible si no hay otra, pero intentamos que no | Atención a familias o a alumnado, hora libre en el colegio |
    | **No** | `Ban` (gris) | No se le propone | Clase propia, y todo lo demás |

    El cálculo automático es la columna derecha (P10); **solo se guarda lo que Jefatura cambia a
    mano** (`sust_disponibilidad`), por **día + hora de inicio y fin** y curso, no por id de tramo
    (como `ora_disponibilidad`: reimportar horarios no lo borra). Una clase propia como principal
    **no** se puede subir de «No». Un botón «Volver a lo del horario» borra los retoques de un
    profe. La retocan quienes tienen el módulo (P11).
16. **«Mis sustituciones», para todo el claustro.** Quien tiene coberturas **no necesita el
    módulo**: basta con la sesión (`requireSession`) y solo ve **lo suyo**, casado por su correo
    (`getProfePorEmail`).
    - En el **escritorio**, franja «Ahora»: aviso «Tus sustituciones» cuando tiene alguna hoy o en
      los próximos 7 días («Hoy a 3ª en 2º B, aula 2B» / «3 en los próximos días»). Sin ninguna, no
      sale nada.
    - **`/gestion/mis-sustituciones`**: próximas y de los últimos 30 días, cada una con fecha, hora,
      grupo, materia, aula, a quién cubre (sin motivo), indicaciones y «Añadir a mi Google
      Calendar». Si es él quien falta, «Te cubren»: quién entra en cada hora.
    - Nada más: ni cifras de otros, ni rejilla, ni historial ajeno.
17. **Plantillas de correo editables**, en `/gestion/sustituciones/ajustes` (un enlace en la página,
    no una sección). Cuatro: **aviso al sustituto**, **al ausente**, **cambio** y **anulación**
    (el informe mensual no: es una tabla). De cada una se edita el **asunto** y el **texto de antes
    y de después** de los bloques, con variables `{nombre}` `{ausente}` `{fecha}` `{horas}`
    `{grupo}` `{aula}` `{quien}` (botones que las insertan). Los bloques de hora y lugar los pone
    siempre el código. **Vista previa en vivo** con datos de ejemplo, «Enviarme una prueba» y
    «Volver al texto de fábrica». Se guardan en `cfg_ajustes` (clave `sustituciones.correos`); sin
    nada guardado, el de fábrica. El texto se escapa (como en Evaluaciones).
18. **«Añadir a mi Google Calendar» es un enlace, no una integración.** Un enlace a
    `https://calendar.google.com/calendar/render?action=TEMPLATE` con título («Sustitución · 2º B ·
    Matemáticas»), fechas en hora de Madrid (`ctz=Europe/Madrid`), lugar (el aula) y detalles
    (indicaciones). Cada uno se lo crea si quiere, en su calendario, al tocarlo: **la app no crea
    eventos ni pide permisos de Calendar** (David, 13-nov-2026). Uno por hora, en el correo y en
    «Mis sustituciones». Función pura `enlaceGoogleCalendar()` en `coberturas.ts`, con test.
19. **Quién ha cubierto más** (como «A quién se ha molestado más» de Oratorios). En Números, profe ×
    mes / trimestre / curso, ordenado de más a menos con barra, y cuántas fueron de «Solo
    urgencia». Es información para repartir mejor, no un marcador: aquí, si te toca, te toca.

---

## 3. Preguntas para David (cada una con su valor por defecto: no bloquean)

Se implementa con el valor por defecto; cambiar de idea es tocar `CONFIGURACION.sustituciones`.
Al responder, la respuesta sube a §2 y se borra de aquí y de `00-desarrollos-futuros.md`.

| # | Pregunta | Por defecto |
|---|---|---|
| P1 | Un profe **sin nada** a esa hora (hora libre): ¿se le propone? En primaria hay ~60 horas así por semana, repartidas entre 24 profes. | «Solo urgencia»: sale en el desplegable, nunca elegido solo. |
| P2 | Si en la clase del ausente **ya hay un segundo profe** (codocencia en esa misma clase), ¿se queda él con el grupo antes que nadie? | Sí: nivel 0, «Ya está en el aula». |
| P3 | **«Gabinete»** no sale en ningún horario. ¿Es Orientación (`DPTO. ORIENTACIÓN`, «Reunión Orientación»)? ¿Quién es? | Lo que tenga «Orientación» en la etiqueta. |
| P4 | Atención a familias y a alumnado salen como «Solo urgencia» (el ejemplo de Lucía). ¿Alguna más? Reunión de ciclo, Innovación, COCOPE, Comunicación, Taller… | Ninguna más; se suben a mano en la rejilla si hace falta. |
| P5 | Una **baja** de varios días: ¿se registra día a día, o quieres un «de tal a tal fecha» que repita la propuesta cada día? | Día a día, con un botón «Repetir el día siguiente lectivo» en la ficha (fase 2). |
| P6 | ¿Secretaría y TIC deben ver el **motivo** concreto (salud)? | Sí: tienen el módulo entero, como el resto. |
| P7 | **Infantil en septiembre y junio**: en Neon solo hay horario de septiembre/junio de primaria. ¿Infantil mantiene el ordinario? | Sí, el ordinario, con un aviso en pantalla. |
| P8 | El `.docx` de primaria trae un cuadro **«HORARIO SUSTITUCIONES»** que el importador salta. ¿Es el cuadro oficial de quién cubre cada hora? Si lo es, podría ser la fuente de la prioridad. | Se ignora; manda la lista de niveles. |
| P9 | El buzón de **Dirección titular** para el informe (`SUSTITUCIONES_INFORME_COPIA`). | Sin él, el informe va solo a Jefatura y la pantalla lo dice. |
| P10 | ¿Te vale cómo sale sola la disponibilidad (tabla de la decisión 15)? Sobre todo: ¿Codocencia y Tut. indiv. en «Sí» y el resto de tu lista en «Si hace falta»? | La tabla tal cual. |
| P11 | ¿Quién marca la rejilla: solo Jefatura, o cada profe la suya (como Lucía en la ESO, que la llevaba ella)? | Jefatura (quien tiene el módulo). Que cada uno proponga la suya, idea para más adelante. |

---

## 4. Plan técnico

### 4.1 Nombres (que nadie pise las sustituciones largas)

| Cosa | Nombre |
|---|---|
| Módulo (`permissions.ts`, `modulos.ts`, `escritorio.ts`) | `sustituciones` · «Sustituciones» · grupo `centro` |
| Rutas de pantalla | `src/app/gestion/sustituciones/…` |
| API | `src/app/api/sustituciones/admin/…` (guard `requireModule('sustituciones')`) y `src/app/api/sustituciones/cron/informe` |
| Tablas | `sust_ausencias`, `sust_sesiones`, `sust_informes` |
| Lógica pura (con tests) | `src/lib/coberturas.ts` · `src/lib/__tests__/coberturas.test.ts` |
| Consultas | `src/lib/coberturas-server.ts` |
| Correos | `src/lib/coberturas-email.ts` · perfil `sustituciones` |
| Componentes | `src/components/coberturas/` |
| SQL | `src/db/sql/sustituciones.sql` (+ línea en `pendientes.txt`) |
| **No tocar** | `src/lib/sustituciones*.ts`, `components/profes/sustituciones-panel.tsx`, `/api/profes/admin/sustituciones` (son las largas; solo se **importan** `esVigente`/`aplicarSustituciones`) |

### 4.2 Schema (`src/db/schema.ts`, bloque `// ─── Sustituciones (prefijo sust_) ───`)

```ts
// Una ausencia: un profe, un día, un motivo. Las horas, en sust_sesiones.
sust_ausencias
  id               uuid pk
  academic_year    text not null                 // '2026-27'
  fecha            date not null
  profe_id         uuid not null → edu_teachers
  profe_nombre     text not null                 // foto
  motivo           text not null                 // 'actividad_escolar'|'medico'|'medico_familiar'|'enfermedad_leve'|'baja'|'otros'
  nota             text                          // detalle de «Otros» u observación interna; NUNCA va en correos
  indicaciones     text                          // qué hace la clase; SÍ va al sustituto
  estado           text not null default 'confirmada'   // 'confirmada'|'anulada'
  creada_por_email text not null
  anulada_por_email text, anulada_at timestamp
  created_at, updated_at
  index (fecha) · index (profe_id, fecha) · index (academic_year)

// Cada hora de la ausencia, con su foto. Lo que se cuenta.
sust_sesiones
  id               uuid pk
  ausencia_id      uuid not null → sust_ausencias
  fecha            date not null                 // desnormalizada: «¿cubre ya algo ese día?» sin join
  hor_sesion_id    uuid                          // SIN FK: los imports rehacen hor_sesiones
  tramo            text                          // '3ª'
  hora_inicio      text not null, hora_fin text not null   // 'HH:mm', como hor_tramos
  grupos           text                          // '2º B' o '3 años A, 3 años B', ya formateado
  materia          text, aula text, actividad text
  hay_que_cubrir   boolean not null
  sustituto_id     uuid → edu_teachers           // null = sin cubrir (o no hace falta)
  sustituto_nombre text, sustituto_email text
  nivel            text                          // clave del nivel: 'en_aula'|'codocencia'|…|'libre'|'manual'
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
```

Sin unicidad (profe, fecha) a propósito (decisión 3); el no-solape se comprueba en el servidor.
SQL aditivo e idempotente en `src/db/sql/sustituciones.sql`, apuntado en `pendientes.txt` y
aplicado con `pnpm db:sql --pendientes` (**nunca `db:push`**, ver 04-convenciones).

### 4.3 Configuración (`src/lib/configuracion.ts`, sin imports)

```ts
sustituciones: {
  etapas: ['EI', 'EP'],
  motivos: [
    { clave: 'actividad_escolar', nombre: 'Actividad escolar', escolar: true },
    { clave: 'medico', nombre: 'Médico' },
    { clave: 'medico_familiar', nombre: 'Médico familiar' },
    { clave: 'enfermedad_leve', nombre: 'Enfermedad leve' },
    { clave: 'baja', nombre: 'Baja' },
    { clave: 'otros', nombre: 'Otros', pideNota: true },
  ],
  enAulaPrimero: true,      // P2
  diasReparto: 30,          // ventana del desempate «quien menos ha cubierto»
  avisoProximosDias: 7,     // «Tus sustituciones» en el escritorio
  // Disponibilidad automática (decisión 15, P10): qué estado sale de cada nivel. Lo que no está
  // aquí es 'no'. 'libre' = hora libre en el colegio.
  disponibilidadPorDefecto: {
    en_aula: 'si', codocencia: 'si', tut_indiv: 'si',
    je: 'si_hace_falta', al: 'si_hace_falta', pt: 'si_hace_falta', godly: 'si_hace_falta',
    tic: 'si_hace_falta', pastoral: 'si_hace_falta', gabinete: 'si_hace_falta', direccion: 'si_hace_falta',
    atencion_padres: 'urgencia', atencion_alumnos: 'urgencia', libre: 'urgencia',   // P1, P4
  },
  niveles: [                // decisión 7; texto normalizado (MAYÚSCULAS, sin acentos)
    { clave: 'codocencia', nombre: 'Codocencia', actividades: ['clase', 'tutoria'], noPrincipal: true, conGrupo: true },
    { clave: 'tut_indiv',  nombre: 'Tut. indiv.', etiquetaContiene: ['TUTORIA INDIVIDUAL'] },
    { clave: 'je',         nombre: 'J.E.',        actividades: ['coordinacion'], etiquetaContiene: ['JEFATURA'] },
    { clave: 'al',         nombre: 'A.L.',        actividades: ['apoyo_al'] },
    { clave: 'pt',         nombre: 'P.T.',        actividades: ['apoyo_pt'] },
    { clave: 'godly',      nombre: 'Godly',       actividades: ['oratorio'], etiquetaContiene: ['GODLY'] },
    { clave: 'tic',        nombre: 'TIC',         actividades: ['reunion'], etiquetaIgual: ['TIC'] },
    { clave: 'pastoral',   nombre: 'Pastoral',    etiquetaContiene: ['PASTORAL'] },
    { clave: 'gabinete',   nombre: 'Gabinete',    etiquetaContiene: ['ORIENTACION'] },   // P3
    { clave: 'direccion',  nombre: 'Dirección',   actividades: ['coordinacion'], etiquetaEmpieza: ['DIRECCION'] },
  ],
},
```

Más su test en `configuracion.test.ts` (fija los valores de Consolación, como el resto).

### 4.4 Lógica pura (`src/lib/coberturas.ts`, todo con tests)

- Tipos: `SesionDia` (la fila que devuelve `horarioDelDia`: `sesionId, horaInicio, horaFin,
  tramo, actividad, etiqueta, grupos[], materia, aula, profes[{id, principal, rol}]`),
  `Ocupacion`, `Candidato`, `Propuesta`.
- `solapa(a, b)` (sacar la de `oratorios.ts` a un sitio común o copiarla con su test: es una línea).
- `nivelDe(ocupacion, profeId, niveles)` → clave del primer nivel que case o `null`.
- `disponibilidadDe(ocupaciones, retoques, config)` → `'si' | 'si_hace_falta' | 'urgencia' | 'no'`
  (lo automático de la decisión 15, pisado por el retoque si lo hay; nunca sube una clase propia).
- `rejillaDisponibilidad(dia, profeId, retoques, config)` → la semana de un profe para pintarla;
  `mapaSemana(...)` → por franja, cuántos hay en cada estado (la vista «La semana»).
- `enlaceGoogleCalendar({ titulo, fecha, horaInicio, horaFin, lugar, detalles })` (decisión 18).
- `pintarPlantilla(plantilla, variables)` con escapado, y `PLANTILLAS_DE_FABRICA`.
- `sesionesDelAusente(dia, profeId)` → sus sesiones, cada una con `hayQueCubrir` y, si hay otro
  profe en ella, `enAula` (decisión 5).
- `proponerCoberturas({ dia, ausenteId, sesionesElegidas, ausentesDelDia, ocupadosDelDia,
  oratoriosDelDia, cargas, config })` → por sesión: `candidatos` agrupados por nivel (ordenados,
  decisión 8), `libres`, `elegido`. Puro, determinista, y se llama otra vez en el cliente cuando
  Jefatura cambia un desplegable (para descontar al elegido de las demás horas).
- `agruparMotivo(motivo)` → `'escolar' | 'personal'`; `resumenMes(filas)` para cifras e informe.
- Schemas **Zod** de las peticiones (compartidos cliente/servidor).
- **Tests mínimos** (fixtures inventadas, nunca de Neon): rejillas EI y EP con horas distintas
  que solapan a medias; candidato con dos ocupaciones (una sin nivel → fuera); el mismo
  candidato no sale dos veces a la misma hora; otro ausente del día excluido; oratorio fechado
  excluido; baja larga vigente (el sustituto hereda el horario, el titular no es candidato);
  continuidad gana al reparto; «Si hace falta» de nivel 3 va antes que «Solo urgencia» de nivel 1;
  «Solo urgencia» nunca elegido solo; un retoque a «No» saca a alguien; un retoque no sube una
  clase propia; 0 candidatos → `elegido = null`; codocente en el aula → nivel 0;
  `enlaceGoogleCalendar` con hora de Madrid y caracteres raros en el título;
  `Reunión Orientación | Tutoría individual` cae en Tut. indiv. (primer nivel que casa).

### 4.5 Servidor (`src/lib/coberturas-server.ts`)

- `horarioDelDia(fecha)`: decisión 4, **una tanda** (`Promise.all`): periodos + rejillas +
  ámbitos; sesiones del día de la semana con tramo, asignación, actividad, grupos, profes,
  materia, aula; `edu_sustituciones`; `edu_teachers` activos (solo id, nombre mostrado, correo);
  `sust_sesiones` y `sust_ausencias` confirmadas de esa fecha; `ora_sesiones` de esa fecha no
  anuladas; `sust_disponibilidad` del curso; cargas (coberturas por sustituto en
  `diasReparto`). Pide solo columnas (nada de `select *` en `edu_teachers`).
- `semanaTipo(academicYear)`: lo mismo sin fecha (el horario ordinario de la semana) para pintar
  la rejilla de disponibilidad; `guardarRetoque`, `borrarRetoques(profeId)`.
- `misSustituciones(email)` (lo de la decisión 16, solo lo suyo) y `avisoEscritorio(email)` (una
  consulta ligera para «Ahora»: hoy + próximos días).
- `getPlantillas()` / `guardarPlantillas()` sobre `cfg_ajustes` (`ajustes-server.ts`).
- `confirmarAusencia(entrada, quien)`: valida (fecha lectiva, no solape con otra ausencia del
  mismo profe, sustitutos libres **releyendo** la BBDD), inserta con `db.batch`, y luego manda los
  correos y actualiza `aviso_estado`. Devuelve la ausencia y los fallos de correo, si los hay.
- `cambiarSesion`, `anadirSesion`, `quitarSesion`, `anularAusencia`, `reenviarAvisos`.
- `listarDia(fecha)`, `listarHistorial(filtros)`, `cifras(academicYear, mes?)`,
  `informeMes(mes)` y `enviarInforme(mes, { forzar })`.

### 4.6 API (route handlers, Zod en la entrada, `requireModule('sustituciones')` en cada uno)

| Método y ruta | Qué hace |
|---|---|
| `POST /api/sustituciones/admin/propuesta` | `{ profeId, fecha }` → sus sesiones del día y la propuesta. No escribe. |
| `POST /api/sustituciones/admin/ausencias` | Confirmar: `{ profeId, fecha, motivo, nota?, indicaciones?, avisar, sesiones: [{ horSesionId, sustitutoId \| null, nivel }] }` |
| `PATCH /api/sustituciones/admin/ausencias/[id]` | `{ accion: 'cambiar' \| 'anadir' \| 'quitar' \| 'indicaciones' \| 'anular', … }` |
| `POST /api/sustituciones/admin/ausencias/[id]/reenviar` | Reenvía los avisos en `error` (o todos con `todos: true`). |
| `GET /api/sustituciones/admin/informe?mes=2026-10` · `POST` | Vista previa · enviar ahora. |
| `GET /api/sustituciones/admin/disponibilidad?profeId=` · `PUT` · `DELETE` | Rejilla de un profe · guardar un retoque · «Volver a lo del horario». |
| `GET /api/sustituciones/admin/plantillas` · `PUT` · `POST …/plantillas/prueba` | Leer · guardar · enviarme una prueba. |
| `GET /api/sustituciones/mias` | Lo mío (`requireSession`, filtrado por el correo de la sesión, **sin** `requireModule`). |
| `GET /api/sustituciones/cron/informe` | Cron del día 1 (`CRON_SECRET`), mes anterior, idempotente. |

### 4.7 Pantallas (todo con piezas de `src/components/ui/`, ver [`diseno.md`](./diseno.md))

`layout.tsx`: `PaginaModulo modulo="sustituciones" ancho="normal"`, `secciones` **Hoy ·
Disponibilidad · Historial · Números**, acción principal **«Nueva ausencia»** (`buttonVariants({ size: 'sm' })`
con `Plus`, enlace a `/gestion/sustituciones/nueva`). Modelo de cómo queda: Nouvinguts.

- **Hoy** (`page.tsx`, `h1` oculto). Arriba, la fecha (`Input type="date"`, hoy por defecto, con
  «‹ ›» para día anterior y siguiente; `history.pushState`, no `router.replace`). `Cifras`: horas
  a cubrir · cubiertas · **sin cubrir** (`tono="aviso"` si > 0). Debajo, **por hora** (no por
  profe: es como lo piensa Jefatura a las 8:45), una fila por sesión: `3ª · 10:30-11:15` ·
  `Etiqueta` del grupo · materia · aula · «Falta Marta → entra **Lucía**» · `Estado` (`Cubierta`
  verde, `Sin cubrir` ámbar, `Correo con error` rojo). Toca la fila → ficha de la ausencia. Vacío:
  `Vacio` «Hoy no falta nadie».
- **Nueva ausencia** (`nueva/page.tsx`, `EnlaceVolver` + `TituloPagina` «Nueva ausencia»,
  formulario en `max-w-2xl`, todo en una pantalla, en tres bloques que se van abriendo):
  1. **Quién y cuándo**: profe (`Selector` con los profes de EI/EP, por nombre mostrado), fecha
     (hoy), motivo (`Selector`; con «Otros», `Campo` + `Input` para la nota). Si el día no es
     lectivo o el profe tiene baja larga, `Aviso` y no se sigue.
  2. **Sus horas de ese día**: una fila por sesión (hora, grupo, materia, aula, y «Codocencia» /
     «Reunión»… en gris si no hay que cubrirla) con un `Interruptor` (`etiquetaOculta`); las que
     hay que cubrir, encendidas. Atajo «Todo el día» / «Solo las clases» (dos `Button` `outline`).
     Si no tiene horario ese día: `Vacio` «Ese día no tiene horas en infantil ni primaria».
  3. **Quién cubre**: por hora encendida, `Selector` nativo con `<optgroup>` por nivel («Ya está
     en el aula», «Codocencia», …, «Con hora libre», «Todo el claustro (tiene clase)») y la
     opción «Sin cubrir»; cada opción con «· N este mes». Al lado, `Estado` con el nivel elegido
     o «Sin cubrir» (ámbar). `Textarea` **Indicaciones para la clase** (opcional).
  `BarraAcciones`: `Interruptor` «Avisar por correo» y el único botón azul: **«Confirmar y avisar
  a 3 personas»** (o «Guardar sin avisar»), con `cargando`. Al terminar: `toast` y a la ficha.
- **Ficha de la ausencia** (`[id]/page.tsx`): `EnlaceVolver` a Hoy, `TituloPagina` «Marta Rubio ·
  martes 17 de noviembre», motivo (`Etiqueta`), indicaciones editables, y la lista de horas con
  su sustituto (`Selector` para cambiarlo, en el sitio, con `toast` «Avisado Lucía» + Deshacer
  mientras no haya salido el correo), estado del aviso y «Reenviar». Añadir hora (las que le
  quedan ese día). Abajo, `ConfirmarEnLinea` «Anular ausencia» (`destructive`): «Se avisará a 3
  personas de que ya no hace falta».
- **Disponibilidad** (`disponibilidad/page.tsx`). Dos vistas con `Filtros` (no un segundo
  segmentado: ya hay secciones): **Por profe** y **La semana**.
  - *Por profe*: `Selector` del profe y su semana (días × franjas de su rejilla); en cada casilla,
    **lo que tiene en el horario** («Codocencia 3º A», «At. familias») en pequeño y **el estado**
    (icono + texto) en grande. Tocar cicla Sí → Si hace falta → Solo urgencia → No → Automático, y
    se guarda solo (`toast`); la casilla retocada lleva una marca «a mano». Las de clase propia,
    en gris y sin toque. «Volver a lo del horario» con `ConfirmarEnLinea`. Misma apariencia que la
    rejilla de Oratorios: reutilizar `franjasDeEtapas`/`huecoEn` de `lib/oratorios.ts` y, si el
    componente se puede compartir **sin cambiar cómo funciona Oratorios**, subirlo a `ui/` y
    apuntarlo en `diseno.md` (es el segundo módulo que lo usa); si no, uno propio igual de aspecto.
  - *La semana*: días × franjas de EP (y EI debajo) con, en cada casilla, cuántos hay de cada
    estado («3 · 2 · 1»), en **ámbar** si no hay ningún Sí ni Si hace falta: dónde va a faltar
    gente antes de que pase. Tocar abre la lista de esa franja por estado.
- **Ajustes** (`ajustes/page.tsx`, `EnlaceVolver` + `TituloPagina` «Correos»): las cuatro
  plantillas (`Filtros` para elegir cuál), `Input` del asunto, dos `Textarea` (antes y después de
  los bloques), botones de variables, la **vista previa** al lado (debajo en el móvil) tal como
  llega, y en `BarraAcciones`: «Volver al de fábrica» (`ghost`), «Enviarme una prueba» (`outline`)
  y **«Guardar»**.
- **Historial** (`historial/page.tsx`): `Filtros` de mes, profe y motivo (escolar / personal);
  lista de ausencias (fecha, profe, horas, cubiertas / sin cubrir, `Estado` «Anulada» en gris).
- **Números** (`numeros/page.tsx`): `Filtros` «Este mes / Trimestre / Curso»; `Cifras` totales; dos
  tablas (dentro de `Tarjeta`, desplazables): **por profe ausente** (escolar · personal · total) y
  **quién ha cubierto más** (decisión 19: ordenado, con barra, y cuántas de urgencia). «Ver el informe de octubre» y «Enviarlo ahora». Exportar con
  `GuardarEnDrive` queda para fase 2.
- **Cada ruta con su `loading.tsx`** (`SkeletonPage` + `SkeletonRows`/`SkeletonTabla`), claro y
  oscuro, 390 y 1180 px, 44 px, nada solo al pasar el ratón, `pnpm diseno:guardia` en verde.
- **Escritorio**: tarjeta en «Organización del centro» con el recuento del día («2 horas sin
  cubrir hoy», en ámbar si > 0) para quien tiene el módulo; y, para **cualquiera** con coberturas
  próximas, el aviso «Tus sustituciones» en «Ahora» (decisión 16, en `gestion/page.tsx` junto a
  los demás avisos), que lleva a «Mis sustituciones».
- **Mis sustituciones** (`src/app/gestion/mis-sustituciones/`, fuera del layout del módulo para
  no exigirlo; su `layout.tsx` exige solo sesión y pinta `PaginaModulo modulo="sustituciones"`
  sin secciones ni acción, que solo dibuja la cabecera y no mira permisos): «Próximas» y «Últimos 30 días»,
  una `Tarjeta` por hora con hora y lugar en grande, a quién cubre, indicaciones y «Añadir a mi
  Google Calendar» (`buttonVariants({ variant: 'outline' })`, enlace externo). Vacío: «No tienes
  sustituciones a la vista».

### 4.8 Lo que se reutiliza (no se vuelve a escribir)

| Necesito… | Ya existe en… |
|---|---|
| El horario de todos, con rejillas, periodos y festivos | `hor_*` (07-horarios); `diaSemana`, `solapa`, `periodoDeFecha` de `lib/oratorios.ts` como modelo |
| Quién sustituye a quién de forma larga | `esVigente`, `aplicarSustituciones` de `lib/sustituciones.ts` |
| Quién lleva un Oratorio ese día | `ora_sesiones` |
| El estilo de correo de compañero a compañero | `lib/oratorios-email.ts` (bloque con raya azul, `mensaje.como`) |
| Plantillas con variables y escapado | Evaluaciones (`plantillas-correo`) |
| Una rejilla de disponibilidad por franjas | `components/oratorios/disponibilidad.tsx`, `ora_disponibilidad` |
| «A quién se ha molestado más» | `components/oratorios/numeros.tsx` |
| Ajustes guardados sin tabla propia | `cfg_ajustes` + `ajustes-server.ts` |
| El profe de quien ha iniciado sesión | `getProfePorEmail` de `mihorario-server.ts` |
| Avisos de «Ahora» en el escritorio | `src/app/gestion/page.tsx` (`avisos.push`) |
| Envío, perfiles, transporte | `lib/email.ts` |

### 4.9 Lo que el agente **no** debe hacer

- Usar `getPeriodoVigente()` para la fecha, o comparar por `tramo_id`/`orden` (§1, puntos 1-2).
- Usar `hor_actividades.cubre_sustitucion`.
- Crear `src/lib/sustituciones*.ts` o tocar los existentes.
- Poner el motivo en un correo a terceros, en «Mis sustituciones» o en un `console.log`.
- Crear eventos de Google Calendar desde el servidor o pedir scopes de Calendar (decisión 18).
- Dejar que «Mis sustituciones» enseñe algo de otra persona.
- `pnpm db:push`.
- Inventar la respuesta de una pregunta de §3: se usa el valor por defecto y se dice.

---

## 5. Fases (checklist)

### Fase 0 · reglas

- [x] Sesiones concretas de un día; Dirección titular y pedagógica comparten `direccion` (12-nov-2026).
- [x] Informe a cuentas de `jefe` más un buzón de Dirección titular (12-nov-2026).
- [x] Prioridad de David traducida al horario real y comprobada en Neon (13-nov-2026, decisión 7).
- [x] Revisión del plan: solape por horas, periodo por rejilla, exclusiones, ciclo de vida, salud (13-nov-2026).
- [x] Ideas de David del 13-nov-2026 encajadas: plantillas, botón de Calendar, «Mis sustituciones», rejilla de disponibilidad, quién ha cubierto más.
- [ ] Respuestas de David a P1-P11 (no bloquean: hay valor por defecto).

### Fase 1 · proponer, confirmar y avisar (lo mínimo que se usa de verdad)

- [ ] Módulo `sustituciones` en `permissions.ts` (`MODULES`, `MODULE_LABELS`, `jefe` y `direccion`), `modulos.ts` (grupo `centro`, icono), `escritorio.ts`; tests de permisos.
- [ ] `CONFIGURACION.sustituciones` (§4.3) y su test.
- [ ] Schema `sust_*` en `schema.ts` + `src/db/sql/sustituciones.sql` idempotente + línea en `pendientes.txt`; aplicado con `pnpm db:sql --pendientes` (si no hay `DATABASE_URL`, `[~]` y decirlo).
- [ ] `coberturas.ts` puro con los tests de §4.4 en verde.
- [ ] `horarioDelDia` en una tanda; probado contra Neon con un profe de EI y otro de EP, un lunes de octubre y un día de septiembre (aviso de infantil).
- [ ] API `propuesta` y `ausencias` (confirmar) con Zod, guard y la doble comprobación del `409`.
- [ ] Perfil `sustituciones` en `email.ts` y `coberturas-email.ts` (sustituto, ausente) con plantillas de fábrica, asunto con hora y lugar y botón «Añadir a mi Google Calendar»; probado con un envío real a una cuenta propia (que el enlace abra el evento bien en el iPad); sin motivo.
- [ ] Disponibilidad automática (sin rejilla todavía) usada en la propuesta, con «Solo urgencia» fuera de la elección automática.
- [ ] Pantallas **Nueva ausencia** y **Ficha** (solo ver + reenviar) con `loading.tsx`; claro/oscuro, 390/1180 px; `diseno:guardia` en verde.
- [ ] Pantalla **Hoy** con cifras y estado vacío.
- [ ] Tabla maestra de `plataforma.md` y esta ficha al día.

### Fase 2 · después de confirmar

- [ ] Cambiar sustituto, añadir y quitar hora, editar indicaciones (con sus correos de cambio).
- [ ] Anular ausencia con `ConfirmarEnLinea` y correo a todos.
- [ ] «Repetir el día siguiente lectivo» (P5).
- [ ] Tarjeta del escritorio con las horas sin cubrir de hoy.
- [ ] **Mis sustituciones** y aviso «Tus sustituciones» en «Ahora», para cualquiera del claustro; comprobado con un profe sin el módulo (ve lo suyo y nada más).
- [ ] **Rejilla de disponibilidad** (Por profe y La semana) con `sust_disponibilidad` (SQL en `pendientes.txt`).
- [ ] **Ajustes de correos**: plantillas editables en `cfg_ajustes`, vista previa, prueba y volver al de fábrica.

### Fase 3 · cuentas e informe

- [ ] Historial con filtros.
- [ ] Números (mes / trimestre / curso; por ausente y quién ha cubierto más, con urgencias).
- [ ] Informe mensual: vista previa, «Enviarlo ahora», cron del día 1 en `vercel.json`, idempotente con `sust_informes`; `SUSTITUCIONES_INFORME_COPIA` en `.env.local.example`, en la tabla de variables de `04-convenciones-tecnicas.md` y en `08-despliegue-y-fork.md`.
- [ ] Configurar `SUSTITUCIONES_INFORME_COPIA` en Vercel con el buzón de Dirección titular (P9, David).

### Más adelante (ideas, no se hacen sin que David las pida)

- **Calendario de sustituciones** (David, 13-nov-2026): ver todas las que hay en marcha en una
  **semana** entera, días × franjas, con cada cobertura en su hueco (quién falta, quién entra,
  grupo), y pasar de semana con ◀ ▶. Mismo dato que «Hoy», otra vista (sería una sección más o
  un `Filtro` Día / Semana en Hoy).
- **Que cada profe marque su propia rejilla** de disponibilidad (como Lucía en la ESO) y Jefatura
  la valide (P11).

- **«Hoy cubres…» en el escritorio del sustituto** («Tu día»: «A 3ª entras en 2º B, Matemáticas,
  aula 2B») y en Mi horario, con las indicaciones. Es lo que de verdad se mira a las 8:55; el
  correo puede leerse tarde.
- **Evento en Google Calendar del sustituto** (el patrón de Oratorios, sin correo de Google).
- **Avisar al tutor del grupo** cuando el ausente es un especialista (sabe quién entra en su clase).
- **Que el propio profe avise de que falta** desde Mi horario («Mañana no estoy a 1ª y 2ª, voy al
  médico») y le llegue a Jefatura ya rellenada como propuesta.
- **ESO**: mismas piezas con las guardias (`guardia` sí existe en la ESO) como primer nivel.
- **Imprimir el parte del día** (A4 para la sala de profes), con el estilo «papel oficial».
