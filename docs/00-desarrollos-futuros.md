# Desarrollos futuros

Lo que **aún no está decidido o no está hecho**, en una página. Lo decidido vive en la ficha de cada
módulo (`docs/<nn>-<modulo>.md`), no aquí: cuando algo se decide o se hace, se quita de esta lista.

Reglas para quien lo toque (personas o agentes):
- Una línea por cosa, con enlace a su ficha si la tiene. Nada de diarios de sesión ni de tachados.
- Si al construir algo tomas una decisión que David no ha visto y **cambia lo que se ve o lo que se
  guarda**, apúntala aquí en una línea en «Para decidir»; si no, va en la ficha del módulo.

---

## Para decidir (David)

- **Dispositivos 1:1 · cómo se cobra** ([`29`](./29-dispositivos.md)): pendiente de secretaría y Jose Miguel. ¿Listado cada mes o una vez al curso (¿10 €/mes de septiembre a junio?), se prorratea un cambio a mitad de curso, y el «pagado / no pagado» se lleva aquí o en Educamos?
- **Dispositivos 1:1 · categorías de iPads del cole** ([`29`](./29-dispositivos.md), decisión 12): ¿hace falta poder **mover** un iPad de una categoría a otra? Hoy no se puede: su código lleva el prefijo.
- **Protección de datos · de dónde salen los noes** ([`21`](./21-alumnado.md)): se arrancó con todo en «sí». Importar la lista de secretaría, preguntarlo a las familias con magic link, o seguir marcando a mano.
- **Tutor personal · más avisos**: ¿el resumen semanal de Puntualidad se parte por tutor personal? ¿El ABC sugiere primero al tutor personal?
- **Identificación de familias · DNI del alumno**: ¿se acepta también el DNI/NIE del propio alumno en las pantallas públicas? (Hoy, documento del tutor o NIA.)
- **Huerto** como tipo nuevo de Oratorios, Godly Play y Talleres ([`26`](./26-oratorios.md)).
- **Horarios · cambiar el aula de una clase a mano** y modelar los desdobles hora a hora ([`07`](./07-horarios.md)).
- **Sustituciones · Bajas: decisiones tomadas al construirlo (23-nov-2026)** ([`32`](./32-sustituciones.md), decisión 22). Revisar: (1) el **alta prevista no cierra la baja**: sigue de baja hasta anotar el alta real, con aviso cuando pasa la prevista (lo contrario dejaría a alguien de baja recibiendo sustituciones si se olvida); (2) el **alta** es el primer día de vuelta; (3) una baja sin sustituto sigue con el tope de 15 días lectivos por ausencia (se apunta por tramos); (4) el fin de semana sin correos no incluye los **festivos** (¿también?); (5) una misma pareja sustituto–titular es una sola cobertura: si se repite en otra baja, pasa a la nueva.
- **Sustituciones · Rediseño: decisiones tomadas al construirlo (23-nov-2026)** ([`32`](./32-sustituciones.md), decisiones 25-30). Revisar: (1) en el calendario solo salen las horas que piden sustituto (las que solo cuentan, en la ficha); (2) una hora pasada apuntada sin avisar es «Cubierta», no «Borrador»; (3) a un acompañante de salida no se le cuentan como ausencia las horas con su propio grupo de salida (está con ellos), sí el resto de esa franja; (4) quién puede llevar una jefatura: el equipo directivo, TIC y SuperTIC con cuenta activa; (5) el aviso de «confirmada» va a quien lo activa y además es la jefatura de esa etapa o apuntó la ausencia; (6) los correos de la ESO siguen saliendo de `jeinfyprim@` (¿pasar a `jesecundaria@` por etapa? habría que delegar ese buzón); (7) ⌘K usa el modelo de Ajustes del colegio › IA con esfuerzo bajo, y solo llama a Claude si falta algo tras entenderlo sin IA.
- **Sustituciones · Disponibilidad por etapa: decisiones al construirlo (23-nov-2026)** ([`32`](./32-sustituciones.md), decisión 24). Revisar: (1) «equipo directivo» = roles `direccion` y `jefe` (¿también orientación?); (2) la etapa de cada profe es la de su ficha **más** la de su horario (si alguien tiene una sola hora suelta en otra etapa, sale en las dos: se ve en «Por profe»); (3) un directivo de otra etapa sale marcado pero no cuenta para «va a faltar gente».

## Ideas (sin decidir)

- **Oratorios por rondas**: dar la 1.ª sesión a todas las clases, luego la 2.ª… (diseño pensado en [`26`](./26-oratorios.md)).
- **Robótica · reservas o registro de uso** de los kits ([`33`](./33-inventario.md)).
- **Inventario · que un profe avise de una avería de su aula** y entre como arreglo.
- **Portada · reconocer el magic link** para saludar por familia y enseñar solo sus trámites; aviso de plazo a punto de cerrar.
- **Evaluaciones · a familias con magic link** (propósito `evaluaciones` en `fam_access_tokens`).
- **Salidas · CSV del seguimiento** de una salida.
- **Ajustes del centro editables desde la app** (hoy `configuracion.ts` + redeploy; ver [`09`](./09-parametros-del-centro.md)).
- **Barra de plataforma con selector de módulos** (opción D de [`diseno.md`](./diseno.md)).
- **Revisión de diseño · ¿componentes nativos o propios?** (David, 23-nov-2026): el selector de fecha (`<input type="date">`) y los desplegables (`<select>`, `Selector`) son los del navegador. Revisar si conviene usar piezas propias para que todo sea coherente con el resto de la app y lo más cómodo posible en iPad (empezando por Sustituciones). Para más adelante.

## Limpieza técnica pendiente

- Tabla `teachers` del ABC antiguo, alias `students`/`behaviorReports` en `schema.ts`, `lic_students.educamos_id` y `cuad_plantillas.etapa`: quitar cuando David dé el ok (borrar columnas es con su permiso).
- **Oratorios · huecos por etapa** (2-nov-2026): hoy un hueco se guarda por día + hora de inicio, así
  que una fila de Infantil y otra de Primaria que empiecen igual comparten marca. Guardarlos por
  etapa si hace falta separarlos de verdad ([`26`](./26-oratorios.md)).
- **Oratorios · el cron diario de avisos no ha enviado nunca** (18-nov-2026): en `ora_sesiones.historial`
  todos los «aviso enviado» son de una persona; ninguno del cron. Hay sesiones ya pasadas con el aviso
  aún «programado» (3º B del 5-nov, programado para el 29-oct; 4º B del 12-nov, para el 5-nov). Hay que
  mirar en Vercel si `/api/oratorios/cron/avisos` se ejecuta y si `CRON_SECRET` está puesto (desde la
  cuenta de Claude no se ve el proyecto). Mientras, los avisos salen con «Enviar pendientes».
