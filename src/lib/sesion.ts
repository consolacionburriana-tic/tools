// Cuándo se le cierra la sesión a alguien aunque la cookie siga viva.
//
// La cookie dura `CONFIGURACION.sesion.duracionDias` (un curso) y se renueva en cada visita, así que
// por sí sola nunca caduca para quien entra a diario. Para el profesorado de etapa (`profe`, `tutor`)
// se pone un tope duro DESDE EL ÚLTIMO LOGIN con Google: cada dos meses vuelven a entrar (David,
// 2-nov-2026). Función pura para poder probarla; la usa el callback `jwt` de `src/auth.ts`.

import { CONFIGURACION } from '@/lib/configuracion';

const ROLES_CON_TOPE = ['profe', 'tutor'] as const;
const DIA_MS = 24 * 60 * 60 * 1000;

/** ¿Este rol tiene una sesión más corta que la normal? */
export function tieneTopeDeSesion(role: string | null | undefined): boolean {
  return !!role && (ROLES_CON_TOPE as readonly string[]).includes(role);
}

/**
 * ¿Ha pasado el tope desde que inició sesión? Sin fecha de login (sesiones anteriores a este
 * cambio) NO caduca: el llamador la sella con «ahora» y empieza a contar desde ahí.
 */
export function sesionCaducada(
  role: string | null | undefined,
  loginAt: number | null | undefined,
  ahora: number = Date.now(),
): boolean {
  if (!tieneTopeDeSesion(role) || typeof loginAt !== 'number') return false;
  return ahora - loginAt > CONFIGURACION.sesion.duracionProfesoradoDias * DIA_MS;
}
