// Anotaciones propias en «Mi horario»: lo que un profe se pone a mano en un hueco (tutoría
// individual, atención a familias, guardia, reunión…). Helpers puros, compartidos entre el
// diálogo del cliente y el endpoint. Ficha: docs/20-mi-horario.md
//
// Una anotación es una asignación `origen='manual'` SIN grupo (decisión 5 de
// docs/07-horarios.md: las horas sin grupo son de primera clase) con una sola sesión, colgada
// del tramo donde se pulsó. Como todo horario, se repite cada semana.

import { z } from 'zod';

/**
 * Qué se puede poner en un hueco. Cada opción es una actividad del catálogo
 * (`hor_actividades`) con un texto propuesto: «Tutoría individual» no tiene actividad propia,
 * es «Atención a alumnado» con ese nombre, y así no hay que tocar el catálogo ni el SQL.
 */
export const OPCIONES_ANOTACION = [
  { id: 'tutoria_individual', nombre: 'Tutoría individual', actividad: 'atencion_alumnos', etiqueta: 'Tutoría individual', pista: 'Con quién o de qué (opcional)' },
  { id: 'atencion_familias', nombre: 'Atención a familias', actividad: 'atencion_padres', etiqueta: null, pista: 'Notas (opcional)' },
  { id: 'guardia', nombre: 'Guardia', actividad: 'guardia', etiqueta: null, pista: 'Dónde (opcional)' },
  { id: 'reunion', nombre: 'Reunión', actividad: 'reunion', etiqueta: null, pista: 'Cuál (opcional)' },
  { id: 'coordinacion', nombre: 'Coordinación', actividad: 'coordinacion', etiqueta: null, pista: 'Cuál (opcional)' },
  { id: 'departamento', nombre: 'Departamento', actividad: 'departamento', etiqueta: null, pista: 'Cuál (opcional)' },
  { id: 'libre', nombre: 'Preparación / libre', actividad: 'libre_disposicion', etiqueta: null, pista: 'Qué (opcional)' },
] as const;

export type CodigoActividadAnotacion = (typeof OPCIONES_ANOTACION)[number]['actividad'];

const CODIGOS = OPCIONES_ANOTACION.map((o) => o.actividad) as [CodigoActividadAnotacion, ...CodigoActividadAnotacion[]];

/** La opción que corresponde a una actividad, para reabrir una anotación al editarla. */
export function opcionDeActividad(actividad: string) {
  return OPCIONES_ANOTACION.find((o) => o.actividad === actividad) ?? null;
}

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const cuerpo = {
  actividad: z.enum(CODIGOS),
  etiqueta: textoOpcional(120),
  aula: textoOpcional(60),
  notas: textoOpcional(500),
};

/** Poner algo en un hueco: el tramo es el hueco y el periodo, el horario que se está mirando. */
export const crearAnotacionSchema = z.object({
  periodoId: z.string().uuid(),
  tramoId: z.string().uuid(),
  ...cuerpo,
});

/** Cambiar lo ya anotado. La hora no se cambia: para moverlo, se quita y se pone en otro hueco. */
export const editarAnotacionSchema = z.object({
  sesionId: z.string().uuid(),
  ...cuerpo,
});

export const borrarAnotacionSchema = z.object({ sesionId: z.string().uuid() });

export type CrearAnotacion = z.infer<typeof crearAnotacionSchema>;
export type EditarAnotacion = z.infer<typeof editarAnotacionSchema>;
