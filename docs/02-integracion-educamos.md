# Integración con Educamos · plan y checklist

Educamos es la fuente de verdad de alumnado y de tutores legales (a quién contactar por cada
alumno). Hoy cada módulo importa su propio listado de alumnos a mano (Excel); el objetivo es
tener una única capa que lea de la API de Educamos y la reutilicen todos los módulos.

---

## Estado: sin empezar ⬜ (hoy: import manual por módulo)

- Licencias importa alumnado desde un `.xlsx` (`src/db/seed-licencias.ts`), con el `ID Educamos`
  ya viajando en los datos (columna preparada para el enganche futuro).
- Registro ABC da de alta el alumnado a mano desde el panel.
- No hay ninguna llamada a la API de Educamos todavía; no se ha revisado su documentación en
  detalle dentro de este repo.

## Objetivo funcional

- Extraer de Educamos, en principio: **alumnado** (curso, grupo/letra) y **tutores legales**
  (personas de contacto de cada alumno, para poder avisarles cuando un módulo lo necesite).
- Servir de "proveedor de alumnos" común para todos los módulos, sustituyendo los imports
  manuales actuales.

## Decisiones pendientes

Ver la sección "Integración con Educamos" en [`desarrollos-futuros.md`](./desarrollos-futuros.md):
qué expone la API exactamente, cómo se autentica, y si la sincronización es en tiempo real o
por lotes.

## Apartado técnico (orientativo)

- **Primer paso obligatorio: leer la documentación oficial de la API de Educamos** antes de
  diseñar nada — no se ha hecho todavía.
- Capa de acceso común, p. ej. `src/lib/educamos.ts`, con funciones tipo `getStudents()` /
  `getGuardians(studentId)`, para que los módulos no llamen a la API directamente.
- Mientras no esté disponible, los módulos siguen important a mano (como Licencias), pero
  guardando siempre el `ID Educamos` del alumno para poder cruzar datos el día que se conecte
  la API de verdad (igual que ya hace `lic_students.educamos_id`).
- Prefijo de tablas si hace falta caché local: `edu_*` (a confirmar).

## Fases

### Fase 0 · Descubrimiento
- [ ] Conseguir acceso/documentación oficial de la API de Educamos
- [ ] Confirmar qué datos de alumnado y de tutores legales expone
- [ ] Confirmar mecanismo de autenticación y límites de uso

### Fase 1 · Capa de acceso
- [ ] `src/lib/educamos.ts` con cliente y funciones de lectura
- [ ] Definir estrategia de sincronización (tiempo real vs. batch)

### Fase 2 · Adopción por módulo
- [ ] Licencias: sustituir import Excel por Educamos (dejar Excel como fallback si hace falta)
- [ ] Registro ABC: alumnado desde Educamos en vez de alta manual
- [ ] Salidas y pagos / Banco de libros: usar esta capa desde el diseño inicial (no repetir el
      patrón de import manual si para entonces ya está disponible)