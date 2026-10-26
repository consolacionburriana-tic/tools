// Helpers puros del Registro ABC (sin IO, testeables).
// El módulo trabaja SIEMPRE con siglas en pantalla: el nombre completo vive en la BBDD
// central (edu_students) y solo se usa para buscar al alumno o en el correo de aviso a
// las personas configuradas. Si alguien mira el iPad de reojo, solo ve letras.
import { endOfDay, startOfDay, subDays } from 'date-fns';
import { CONFIGURACION } from '@/lib/configuracion';

/** Inicial en mayúscula de una palabra, o '' si no hay nada aprovechable. */
function inicial(texto: string | null | undefined): string {
  const limpio = (texto ?? '').trim();
  return limpio ? `${limpio[0].toUpperCase()}.` : '';
}

/**
 * "ROBERTO HERRERO MENDOZA" → "R.H." — DOS iniciales, nombre y primer apellido.
 * Decisión de David (2026-08-31): el módulo es para un puñado de alumnos con muchas
 * necesidades, así que dos letras bastan para distinguirlos y enseñan lo mínimo.
 */
export function siglasDeAlumno(
  nombre: string | null | undefined,
  apellido1: string | null | undefined,
): string {
  const siglas = [nombre, apellido1].map(inicial).join('');
  return siglas || '—';
}

/** "3ºPPDC" + "PDC" → "3ºPPDC"; "2ESO" + "B" → "2ESO B". */
export function claseDeAlumno(curso: string | null | undefined, letra: string | null | undefined): string {
  if (!curso) return '';
  return letra && letra !== 'PDC' ? `${curso} ${letra}` : curso;
}

/** NIA normalizado (solo dígitos) o null si no parece un NIA. */
export function normalizaNia(valor: string | null | undefined): string | null {
  const soloDigitos = (valor ?? '').replace(/\D/g, '');
  return soloDigitos.length >= 6 ? soloDigitos : null;
}

// ── Periodos del panel y de los registros ──────────────────────────────────────────────

export const PERIODOS = [
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
  { value: 'curso', label: 'Este curso' },
  { value: 'all', label: 'Todo' },
] as const;

export type Periodo = (typeof PERIODOS)[number]['value'];

/** El periodo que se abre por defecto: el curso en vigor. */
export const PERIODO_POR_DEFECTO: Periodo = 'curso';

/** Lo que llega de la URL o del navegador, o el curso si no es un periodo conocido. */
export function periodoValido(valor: string | null | undefined): Periodo {
  return PERIODOS.find((p) => p.value === valor)?.value ?? PERIODO_POR_DEFECTO;
}

/** Primer día del curso en vigor (1 de septiembre, o el mes que diga la configuración del centro). */
export function inicioDeCurso(ahora = new Date()): Date {
  const mes = CONFIGURACION.calendario.mesInicioCurso - 1;
  const anio = ahora.getMonth() < mes ? ahora.getFullYear() - 1 : ahora.getFullYear();
  return new Date(anio, mes, 1);
}

/** Desde cuándo hasta hoy; `null` para «todo». */
export function rangoDePeriodo(periodo: string, ahora = new Date()): { from: Date; to: Date } | null {
  if (periodo === 'all') return null;
  if (periodo === 'curso') return { from: inicioDeCurso(ahora), to: endOfDay(ahora) };
  const dias = parseInt(periodo, 10);
  return { from: startOfDay(subDays(ahora, (Number.isFinite(dias) ? dias : 30) - 1)), to: endOfDay(ahora) };
}

/** Dónde recuerda el navegador el filtro de la lista de registros (y el panel lo deja al día). */
export const FILTROS_ABC_KEY = 'abc-registros-filtros';
