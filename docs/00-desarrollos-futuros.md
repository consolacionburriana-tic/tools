# Desarrollos futuros — próximo curso

Documento vivo de trabajo. No es una ficha de módulo (esas están en `docs/<nn>-<modulo>.md`):
aquí apuntamos todo lo que **aún no está decidido**, para hablarlo con calma en ratos libres sin
perder ideas por el camino.

> **Cómo usar este documento:**
> - La sección de arriba (**Decisiones pendientes**) son preguntas concretas que bloquean el
>   plan técnico de un módulo. Cuando una se responde, se borra de aquí y se traslada a la
>   sección "Decisiones cerradas" de la ficha del módulo correspondiente (`docs/<nn>-<modulo>.md`).
> - La sección de abajo (**Ideas y caminos de crecimiento**) son ocurrencias sin madurar: no
>   bloquean nada, solo se guardan para no olvidarlas. Se pueden promocionar a "Decisión
>   pendiente" cuando se quiera empezar a concretarlas.

> **Estado (julio 2026):** la gran tanda de decisiones de los módulos nuevos ya se cerró y vive
> en las fichas (`01`, `02`, `12`, `15`, `16`). Lo que queda aquí abajo es fino y NO bloquea
> empezar ningún hito del roadmap.

---

## 🔴 Decisiones pendientes

### Auth y roles
- Validar (o ajustar) la **matriz rol→módulos por defecto** propuesta en
  [`01-auth-roles.md`](./01-auth-roles.md) — es un cambio de una línea en
  `src/lib/permissions.ts`, se puede ajustar sobre la marcha.

### Evaluaciones
- Definir el **catálogo de preguntas predefinidas** (los 8-10 textos de la plantilla). Se puede
  arrancar con textos provisionales y afinarlos al usarlo.

### Banco de libros
- ¿El `academic_year` en vigor vive como constante en código o en una tabla mínima de
  configuración? (decidir al implementar la Fase 0; apuntado también en la ficha).

---

## 📥 Inputs pendientes de David (no son decisiones, son accesos/materiales)

Recopilados de las fichas, para verlos de un vistazo:

- **Educamos**: un export real de alumnado y de tutores (para fijar el mapeo de columnas).
- **Google Cloud**: crear el OAuth client para el login (acceso a la consola del dominio).
- **Vercel Blob**: activar el store y el token para la subida de justificantes (Salidas).
- **Licencias** (heredado de la ficha `11`): cuenta de servicio de Google para escribir en el
  Sheet · confirmar remitente verificado en Resend.

---

## 💡 Ideas y caminos de crecimiento (sin decidir, para explorar)

- **Mejorar la PWA** (instalación en iPad) para que cubra todos los módulos, no solo Registro
  ABC. **PRIORIZAR** — buen candidato a colarse entre hito y hito.
- **Plataforma de pago online** para Salidas (y quizá Licencias): sustituiría el justificante
  subido por pago real. Implica pasarela (Stripe u otra), comisiones y decisión de dirección.
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
- Auditoría/historial de cambios transversal (quién tocó qué registro y cuándo), útil sobre
  todo para Registro ABC y Banco de libros. (`edu_sync_runs` ya nace con esta filosofía.)

---

## Backlog de módulos futuros (mencionados, sin desarrollar todavía)

- Nada más identificado por ahora aparte de los módulos ya fichados. Añadir aquí cualquier
  módulo nuevo que se os ocurra antes de tener claro su alcance.
