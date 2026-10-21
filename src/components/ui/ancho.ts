// Los anchos de página de la app (guía: docs/diseno.md). Uno por módulo, no por pantalla, para
// que nada salte al cambiar de sección; dentro, un formulario se estrecha con `max-w-2xl`.
//   · estrecho: formularios y ajustes · normal: listas y fichas · ancho: tablas y rejillas
//   · completo: los tableros, que necesitan toda la pantalla
export type AnchoPagina = 'estrecho' | 'normal' | 'ancho' | 'completo';

export const ANCHO_PAGINA: Record<AnchoPagina, string> = {
  estrecho: 'max-w-3xl',
  normal: 'max-w-5xl',
  ancho: 'max-w-7xl',
  completo: 'max-w-none',
};
