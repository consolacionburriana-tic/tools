// Helpers puros de Salidas (sin IO): nada de aquí toca la BBDD, así que también lo
// puede importar un componente cliente (el listado agrupa y filtra en el navegador).
import { academicYearActual } from '@/lib/constants';

export interface Clase {
  curso: string;
  letra: string | null;
}

export function claseLabel(c: Clase): string {
  return c.letra && c.letra !== 'PDC' ? `${c.curso} ${c.letra}` : c.curso;
}

/** Días de margen tras la fecha de la salida antes de darla por pasada (da tiempo a
 *  que las familias rezagadas suban el justificante). */
export const DIAS_GRACIA_ARCHIVO = 3;

/** Una salida se archiva sola: sin fecha nunca se archiva (no hay forma de saber si ya
 *  pasó), con fecha se archiva a partir del día siguiente al margen de gracia. */
export function tripArchivada(fecha: string | null, ahora: Date = new Date()): boolean {
  if (!fecha) return false;
  const limite = new Date(fecha + 'T00:00:00');
  limite.setDate(limite.getDate() + DIAS_GRACIA_ARCHIVO + 1);
  return ahora >= limite;
}

/** Curso escolar al que pertenece una salida: el de su fecha si la tiene, si no el de
 *  cuándo se creó (para las que se dejaron sin fecha). */
export function cursoDeSalida(fecha: string | null, createdAt: Date): string {
  return academicYearActual(fecha ? new Date(fecha + 'T00:00:00') : createdAt);
}
