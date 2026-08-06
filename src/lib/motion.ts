// Transición estándar de pasos de asistente (formularios públicos). Una sola física
// para toda la plataforma: deslizamiento vertical corto con easeOut.
export const stepAnim = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.22, ease: 'easeOut' as const },
} as const;
