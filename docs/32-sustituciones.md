# Sustituciones del profesorado

Módulo interno de **Organización del centro** para cubrir las ausencias puntuales de Infantil y
Primaria a partir de los horarios de `hor_*`. No es la relación de sustituciones de Educamos
(`edu_sustituciones`), que modela reemplazos laborales vigentes.

## Alcance funcional

- Acceso exclusivo a Jefatura (`jefe`), TIC, Secretaría y Dirección. El modelo actual de roles
  tiene un único `direccion`; dirección titular y pedagógica compartirán ese rol (confirmado
  por David el 12-nov-2026).
- Jefatura inicia una propuesta indicando al profesor ausente y el motivo: Actividad escolar,
  Médico, Médico Familiar, Enfermedad Leve, Baja u Otros. Elige las sesiones concretas del día
  que necesita cubrir.
- Se consulta el horario vigente de Infantil y Primaria para obtener las sesiones afectadas y
  buscar coberturas según la prioridad que indicó David:
  **Codocencia → Tut. indiv. → J.E. → A.L. → P.T. → Godly → TIC → Pastoral → Gabinete → Dirección**.
- La propuesta muestra hora, materia y aula de cada sesión, y un sustituto editable. Jefatura
  revisa y confirma. Al confirmar, se guarda el registro y se avisa por correo a cada sustituto
  y al profesor ausente; los mensajes incluyen fecha, hora, aula y materia, y el mensaje a los
  sustitutos agradece la cobertura.
- Cada sesión ausente cuenta para el profesor titular y se clasifica como actividad escolar
  únicamente cuando el motivo es «Actividad escolar»; el resto se agrupa como motivo personal.
- Panel de totales mensuales y del curso completo. Informe mensual del mes anterior por correo
  a Jefatura y Dirección titular el día 1.

## Datos y arquitectura previstos

- Reutilizar `edu_teachers` como censo y `hor_periodos`, `hor_tramos`, `hor_actividades`,
  `hor_asignaciones`, `hor_asignacion_grupos`, `hor_asignacion_profes`, `hor_sesiones`,
  `hor_materias` y `hor_espacios` como fuente de horarios. No duplicar el horario.
- Crear tablas propias con prefijo `sust_`: cabecera de ausencia/propuesta y detalle por sesión,
  conservando fecha, franja, materia/aula, sustituto asignado y motivo para que el histórico no
  dependa de futuras importaciones de horarios.
- Rutas y APIs bajo `/gestion/sustituciones` y `/api/sustituciones`; todas las operaciones de
  servidor deben comprobar `requireModule('sustituciones')`.
- Correo a través de `src/lib/email.ts`; el informe mensual se ejecutará con un endpoint protegido
  por `CRON_SECRET` y un cron mensual en `vercel.json`.

## Decisiones por cerrar

- Fecha: se seleccionan sesiones concretas de un día (confirmado por David el 12-nov-2026).
- Candidatos: se consideran candidatas las sesiones de la lista prioritaria que tiene cada
  profesor en el mismo tramo. Se omite a quien ya tenga otra asignación concurrente. Las
  alternativas del mismo nivel se muestran todas; la propuesta selecciona primero la de mayor
  prioridad y permite cambiarla en el campo editable.
- Informe mensual: enviar a todas las cuentas con rol `jefe` y a un buzón concreto de Dirección
  titular (confirmado por David el 12-nov-2026). La dirección se configurará como
  `SUSTITUCIONES_EMAIL_DIRECCION_TITULAR`; falta proporcionar su valor para el despliegue.
- El catálogo de actividades importado puede tener variantes de nombre/código; mapearlo a la
  prioridad indicada y validar la cobertura resultante con los horarios vigentes.

## Fases

### Fase 0 · cerrar reglas

- [x] Sesiones concretas de un día; ambas direcciones comparten `direccion` (12-nov-2026).
- [x] Enviar a cuentas de `jefe` y un buzón configurado para Dirección titular (12-nov-2026).
- [ ] Configurar el valor de `SUSTITUCIONES_EMAIL_DIRECCION_TITULAR` al desplegar.
- [x] Criterio de candidatos: actividad prioritaria en el mismo tramo, sin conflicto; se muestran
      todas las alternativas del mejor nivel, ordenadas por prioridad.
- [ ] Revisar el catálogo real de actividades de Infantil y Primaria contra la prioridad.

### Fase 1 · propuesta y registro

- [ ] Añadir módulo y permisos de servidor/escritorio solo para los roles autorizados.
- [ ] Crear schema `sust_*` y SQL aditivo idempotente; incorporarlo a pendientes hasta aplicarlo.
- [ ] Consultar sesiones del ausente y proponer cobertura priorizada sin choques.
- [ ] Construir propuesta editable y confirmación transaccional con snapshot de sesiones.
- [ ] Enviar correos de confirmación al profesorado implicado con todos los datos requeridos.
- [ ] Añadir historial y cifras por motivo, mes y curso académico.
- [ ] Añadir informe mensual idempotente, endpoint protegido y cron del día 1.
- [ ] Añadir `loading.tsx`, vacíos y guardia de diseño; comprobar pantalla en móvil y escritorio.
- [ ] Verificar con datos de desarrollo y marcar solo lo realmente comprobado.
