// Contextos del incidente
export const CONTEXTS = [
  { value: 'aula', label: 'Aula' },
  { value: 'patio', label: 'Patio' },
  { value: 'comedor', label: 'Comedor' },
  { value: 'otros', label: 'Otros' },
] as const;

export type ContextValue = (typeof CONTEXTS)[number]['value'];

// Franjas horarias
export const TIME_SLOTS = [
  { value: 'primera_hora', label: 'Primera hora' },
  { value: 'antes_patio', label: 'Clases antes del patio' },
  { value: 'bajadas', label: 'Antes del patio (bajadas)' },
  { value: 'patio', label: 'Patio' },
  { value: 'almuerzo', label: 'Almuerzo' },
  { value: 'despues_patio', label: 'Clases después del patio' },
  { value: 'ultima_hora', label: 'Última hora' },
] as const;

export type TimeSlotValue = (typeof TIME_SLOTS)[number]['value'];

// Personas presentes
export const PRESENT_PEOPLE = [
  { value: 'tutor', label: 'Tutor/a' },
  { value: 'profesores_clase', label: 'Profesores de la clase' },
  { value: 'equipo_directivo', label: 'Equipo Directivo' },
  { value: 'pas', label: 'PAS' },
  { value: 'alumnos_clase', label: 'Alumnos de su clase' },
  { value: 'alumnos_otra', label: 'Alumnos de otra clase' },
  { value: 'padres', label: 'Padres' },
] as const;

export type PresentPeopleValue = (typeof PRESENT_PEOPLE)[number]['value'];

// Conductas
export const BEHAVIORS = [
  { value: 'agresion_fisica_iguales', label: 'Agresión física entre iguales' },
  { value: 'agresion_fisica_adultos', label: 'Agresión física a adultos' },
  { value: 'insultos_iguales', label: 'Insultos a iguales' },
  { value: 'insultos_adultos', label: 'Insultos a adultos' },
  { value: 'autolesiones', label: 'Autolesiones' },
  { value: 'chillidos', label: 'Chillidos' },
  { value: 'huir', label: 'Huir' },
  { value: 'lanzar_objetos', label: 'Lanzar objetos' },
  { value: 'empujar', label: 'Empujar' },
] as const;

export type BehaviorValue = (typeof BEHAVIORS)[number]['value'];

// Motivos / hipótesis
export const REASONS = [
  { value: 'integracion', label: 'Sentirse integrado con los compañeros' },
  { value: 'llamar_atencion', label: 'Llamar la atención' },
  { value: 'obtener_algo', label: 'Obtener alguna cosa' },
  { value: 'evitar', label: 'Evitar, escabullirse' },
  { value: 'sensorial', label: 'Regulación sensorial' },
  { value: 'malestar_fisico', label: 'Malestar físico' },
  { value: 'cambio_inesperado', label: 'Cambio inesperado' },
  { value: 'otro', label: 'Otro' },
] as const;

export type ReasonValue = (typeof REASONS)[number]['value'];

// Etapas del profesorado — valores sin tilde para la BD
export const STAGES = [
  { value: 'EI', label: 'EI' },
  { value: 'EP', label: 'EP' },
  { value: 'ESO', label: 'ESO' },
  { value: 'PAS', label: 'PAS' },
  { value: 'Direccion', label: 'Dirección' },
  { value: 'Orientacion', label: 'Orientación' },
] as const;

export type StageValue = (typeof STAGES)[number]['value'];

// Mapa para mostrar con tilde en la UI
export const STAGE_LABELS: Record<StageValue, string> = {
  EI: 'EI',
  EP: 'EP',
  ESO: 'ESO',
  PAS: 'PAS',
  Direccion: 'Dirección',
  Orientacion: 'Orientación',
};
