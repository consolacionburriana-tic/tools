# Salidas y pagos · plan y checklist

Módulo de excursiones/salidas escolares. La gestión de la salida en sí (autorización, permisos)
ya se hace en Educamos; lo que aporta este módulo es el circuito de **inscripción restringida
por grupo** y, sobre todo, el **justificante de pago**.

---

## Estado: boceto funcional 🟡 (sin plan técnico, sin implementar)

## Objetivo funcional

Un usuario autorizado (p. ej. rol "profesor") crea una **salida** asociada a un curso/grupo
concreto (p. ej. "2º ESO"). Solo el alumnado de ese grupo puede apuntarse. Las familias reciben
un enlace donde:

1. Confirman la inscripción de su hijo/a a la salida.
2. Suben su justificante de pago.

El profesorado autorizado ve en todo momento **qué alumnos del grupo faltan por apuntarse y/o
pagar** — el mismo patrón de "listado de quién falta" que ya existe en Licencias
(`/gestion/faltan`).

### Flujo principal

1. Profesor crea la salida: nombre, fecha, curso/grupo al que va dirigida, importe.
2. La app genera un enlace único para las familias de ese grupo (o por alumno, a decidir).
3. Familia entra, confirma inscripción y sube el justificante de pago (archivo).
4. Profesor consulta el panel: apuntados / pendientes de apuntarse / pendientes de pago.
5. (Posible) recordatorio a quien falta — pendiente de decidir alcance.

## Decisiones pendientes

Ver la sección "Salidas y pagos" en [`desarrollos-futuros.md`](./desarrollos-futuros.md): quién
puede crear salidas, cómo se restringe por grupo (a mano o vía Educamos), si el justificante
necesita validación manual, y si hacen falta recordatorios automáticos.

## Apartado técnico (orientativo, a concretar tras cerrar decisiones)

- Prefijo de tablas propuesto: `sal_*` (`sal_trips`, `sal_students` o reuso de alumnado común si
  ya está disponible vía Educamos, `sal_signups`).
- Subida de archivo (justificante): almacenamiento a decidir (¿Vercel Blob? revisar qué ya usa
  el repo — hoy no hay subida de archivos en ningún módulo, sería la primera vez).
- Reutilizar `src/lib/email.ts` (Resend) para el enlace a la familia y para el resumen al
  profesorado.
- Reutilizar el patrón de "panel + listado de quién falta" ya construido en Licencias
  (`src/app/gestion/faltan`) como referencia de diseño.

## Fases

### Fase 0 · Decisiones y diseño
- [ ] Cerrar decisiones funcionales (ver arriba)
- [ ] Diseñar schema (`sal_*`)
- [ ] Decidir mecanismo de subida de archivos

### Fase 1 · Alta de salidas (gestión)
- [ ] Crear/editar salida (nombre, fecha, grupo, importe)
- [ ] Restringir por curso/grupo

### Fase 2 · Formulario público (familias)
- [ ] Confirmar inscripción
- [ ] Subir justificante de pago
- [ ] Email de confirmación a la familia

### Fase 3 · Panel de seguimiento
- [ ] Listado apuntados / pendientes de apuntarse / pendientes de pago
- [ ] Exportación (CSV, como en Licencias)
- [ ] (Si se decide) recordatorios automáticos a quien falta