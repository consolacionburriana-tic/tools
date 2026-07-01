# Desarrollos futuros — próximo curso

Documento vivo de trabajo. No es una ficha de módulo (esas están en `docs/<modulo>.md`): aquí
apuntamos todo lo que **aún no está decidido**, para hablarlo con calma en ratos libres sin
perder ideas por el camino.

> **Cómo usar este documento:**
> - La sección de arriba (**Decisiones pendientes**) son preguntas concretas que bloquean el
>   plan técnico de un módulo. Cuando una se responde, se borra de aquí y se traslada a la
>   sección "Decisiones cerradas" de la ficha del módulo correspondiente (`docs/<modulo>.md`).
> - La sección de abajo (**Ideas y caminos de crecimiento**) son ocurrencias sin madurar: no
>   bloquean nada, solo se guardan para no olvidarlas. Se pueden promocionar a "Decisión
>   pendiente" cuando se quiera empezar a concretarlas.

---

## 🔴 Decisiones pendientes

### Autenticación y roles
- ¿Login solo con cuentas Google del dominio del colegio, o hace falta contemplar también
  cuentas Google personales (familias, tutores externos) en algún módulo?
  DECISIÓN: Para administracion, solo cuentas internas del dominio. Para los modulos en general abiertos pero pueden estar limitados a login en colegio
- ¿Qué roles existen aparte de "jefe de departamento"? ¿Hace falta un rol "super-admin" que gestione la pantalla de permisos?
  DECISION: roles base
    - profe
    - tutor
    - jefe departamento / coord ciclo (el mismo)
    - direccion
    - tic
    - orientacion
    - secretaria
    - supertic

- La pantalla de configuración de acceso: ¿se asigna módulo por módulo a cada usuario, por rol,
  o ambas cosas combinadas (rol = permisos por defecto, con excepciones por usuario)?

  DECISION: Se accede por rol

### Integración con Educamos

UNA COSA IMPORTANTE: De educamos, a mano, resincronziaarás tu base de datos de neon, le diras oye sincronizame con educamos y te traerás todas las cosas de educamos para guardarlas en NEON

- Revisar la documentación oficial de la API de Educamos: qué endpoints hay para alumnado y
  para tutores legales/contactos, y qué campos expone cada uno.
- ¿Cómo se autentica la app contra la API (API key, OAuth, IP whitelisting)?
- ¿Sincronización en tiempo real o batch (p. ej. nocturno)? ¿Quién dispara la sincronización?
- ¿Sustituye del todo al import manual por Excel que usa hoy Licencias, o convive con él como
  fallback?

### Salidas y pagos
- ¿Quién puede crear una salida — cualquier profesor, o un rol concreto (tutor, jefe de
  departamento, dirección)?
  DECISIÓN: cualquiera. el profe/tutor SOLO ve sus salidas, el resto de roles ven las salidas de todos. 

- ¿Cómo se restringe una salida a un curso/grupo? ¿A mano al crearla, o tirando ya de Educamos
  para traer el listado real de ese grupo?
  DECISION: En la BBDD de alumnos tendrás el curso y letra, podrás marcar a que clase

- El justificante de pago: ¿se sube como archivo (foto/PDF) sin más validación, o alguien tiene
  que marcarlo como "revisado/válido"?
  DECISION: Bien, se puede marcar como revisado validado 
- ¿Hacen falta recordatorios automáticos (email) a las familias que faltan por apuntarse o pagar,
  o el módulo se limita a mostrar el listado de "quién falta" como en Licencias?

  DECISION: Nada, pero puede ser lo de enviar mails masivos de recordatorios de ey me falta tu justificante

  OJO OTRA COSA: Puede ser que un alumno NO vaya a una salida, en ese caso no se le reclama el justificante obvio

  OTRA COSA: Apunta por ahi valorar una platafomrma de pago oinline

### Evaluaciones / encuestas
- ¿Un único motor de "formulario configurable" que sirva para conducta, tutorías y propuestas,
  o formularios independientes por caso (como hoy, que Registro ABC y Licencias son cosas
  separadas)?

  DECISION: Todo separado. El motorcito para crear formularios UNICAMENTE para evaluaciones, que son mas faciles 

- Nivel de anonimato: ¿no se guarda quién responde en absoluto, o se guarda pero no se muestra
  en el resultado agregado (por si hiciera falta trazabilidad ante un problema)?

  DECISION: Pueden ser anonimas o no, habra un iconito para ponerlo

- ¿El resultado llega solo por correo (resumen), solo por un dashboard, o ambos?
  DECISION: Dashboard
- Cuando el formulario evalúa "cuatro o cinco actividades a la vez": ¿un envío por actividad o
  un único envío con las cinco evaluaciones dentro?

  DECISION: Puede ser que un formulario evalua diferentes actividades o solo 1. lo digo porque las actividades tendran preguntas predefinidas entonces crear una actividad será muy rapido y habra campos de nombre, fecha, lugar, textito para recordar lo que evaluamos y las 4-5 preguntas que quiera por actividad, ya las pensaremos

### Banco de libros
- ¿Cómo se reasocia lote → alumno cada curso? (a mano desde el panel / import desde Educamos /
  proceso semi-automático que solo pide confirmar)
  DECISION: A mano desde el panel, 1 ESO A lote 15 le toca al niño X (buscando desde la BBDD) de alumnos 
- ¿Qué valores exactos tiene "estado del libro" (¿bueno / regular / malo, algo más granular?) y
  qué se registra sobre la funda (sí/no, o también su estado)?
  DECISION: Nuevo / Muy bien / Bien / Regular / mal / mojado. Se guarda BORRADO (Si / No, por defecto en si), forrado si no, por defecto si

- El documento firmado de inicio/fin de curso: ¿se recoge digital (subida de PDF/foto, o firma
  electrónica) o sigue siendo papel y la app solo marca "recibido: sí/no"?

  DECISION: Se marca SI NO de forma facil y por clases con bulk buttons para cambiar las cosas 
- ¿Quién revisa el libro de cada alumno — el tutor, cualquier profesor de la asignatura, o un
  responsable único de banco de libros?

DECISION: De primeras todos accden a todo


DECISION IMPORTANTE: Los registros son DE CADA AÑO, cada año  tengo que guardar este lote asociado a este niño, este año estan los libros borradosn no se que

Mas movidas
---

## Backlog de módulos futuros (mencionados, sin desarrollar todavía)

- Nada más identificado por ahora aparte de los cuatro módulos ya descritos en `plataforma.md`
  (Salidas y pagos, Evaluaciones, Banco de libros) y las dos piezas transversales (Auth/roles,
  Educamos). Añadir aquí cualquier módulo nuevo que se os ocurra antes de tener claro su alcance.

---

## 💡 Ideas y caminos de crecimiento (sin decidir, para explorar)

- IA (Gemini u otro modelo) para sugerir redirecciones o detectar patrones en Registro ABC
  (ya apuntado como "Fase 3" en el README original).
- Notificaciones por WhatsApp o push, además de email, para avisos urgentes (p. ej. "falta tu
  justificante de pago").
- Dashboard agregado de dirección que cruce datos de varios módulos (p. ej. económico de
  Licencias + Salidas y pagos).
- Firma electrónica de documentos (autorizaciones de salidas, documentación de banco de libros)
  en vez de papel escaneado.
- Exportación/sincronización automática hacia Educamos (hoy todo lo que sale de la app hacia
  Educamos es manual).
- Mejorar la PWA (instalación en iPad) para que cubra todos los módulos, no solo Registro ABC. PRIORIZAR

- Auditoría/historial de cambios transversal (quién tocó qué registro y cuándo), útil sobre todo para Registro ABC y Banco de libros.