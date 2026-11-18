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
- **Protección de datos · de dónde salen los noes** ([`21`](./21-alumnado.md)): se arrancó con todo en «sí». Importar la lista de secretaría, preguntarlo a las familias con magic link, o seguir marcando a mano.
- **Tutor personal · más avisos**: ¿el resumen semanal de Puntualidad se parte por tutor personal? ¿El ABC sugiere primero al tutor personal?
- **Identificación de familias · DNI del alumno**: ¿se acepta también el DNI/NIE del propio alumno en las pantallas públicas? (Hoy, documento del tutor o NIA.)
- **Huerto** como tipo nuevo de Oratorios, Godly Play y Talleres ([`26`](./26-oratorios.md)).
- **Horarios · cambiar el aula de una clase a mano** y modelar los desdobles hora a hora ([`07`](./07-horarios.md)).

## Ideas (sin decidir)

- **Oratorios por rondas**: dar la 1.ª sesión a todas las clases, luego la 2.ª… (diseño pensado en [`26`](./26-oratorios.md)).
- **Robótica · reservas o registro de uso** de los kits ([`33`](./33-inventario.md)).
- **Inventario · que un profe avise de una avería de su aula** y entre como arreglo.
- **Portada · reconocer el magic link** para saludar por familia y enseñar solo sus trámites; aviso de plazo a punto de cerrar.
- **Evaluaciones · a familias con magic link** (propósito `evaluaciones` en `fam_access_tokens`).
- **Salidas · CSV del seguimiento** de una salida.
- **Ajustes del centro editables desde la app** (hoy `configuracion.ts` + redeploy; ver [`09`](./09-parametros-del-centro.md)).
- **Barra de plataforma con selector de módulos** (opción D de [`diseno.md`](./diseno.md)).

## Limpieza técnica pendiente

- Tabla `teachers` del ABC antiguo, alias `students`/`behaviorReports` en `schema.ts`, `lic_students.educamos_id` y `cuad_plantillas.etapa`: quitar cuando David dé el ok (borrar columnas es con su permiso).
- **Oratorios · «Desde mi horario» sin horas de Oratorio** (2-nov-2026): se decidió proponer como 👍
  las horas libres de la persona cuando su horario no trae ninguna de Oratorio. Alternativa: que el
  horario importado de Primaria/Infantil marque las horas de Oratorio/taller y se use solo eso.
  Y guardar los huecos por etapa (hoy, por día + hora de inicio) si hace falta separar de verdad
  Infantil y Primaria cuando empiezan a la misma hora ([`26`](./26-oratorios.md)).
