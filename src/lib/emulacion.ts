// Emulación de usuarios: un SuperTIC puede «entrar como» otra persona para ver lo que ella ve y
// comprobar sus permisos. Función pura (sin IO) para poder probarla; el resto vive en
// `emulacion-server.ts` (resolver a quién se emula) y `app/api/emulacion/route.ts` (empezar/salir).
// Ficha: docs/01-auth-roles.md §Emulación.

import type { Role } from '@/lib/permissions';

/** Cookie httpOnly con `real|objetivo`. Solo vale si quien la presenta ES ese SuperTIC. */
export const COOKIE_EMULACION = 'tools_emulando';
/** Cookie legible (solo el nombre) para que el indicador se pinte sin tocar el servidor. Es cosmética. */
export const COOKIE_EMULACION_AVISO = 'tools_emulando_aviso';
/** Cuánto dura una emulación si no se sale antes: una jornada, para que no se quede puesta de un día a otro. */
export const DURACION_EMULACION_S = 8 * 60 * 60;

export interface ParEmulacion {
  real: string;
  objetivo: string;
}

export function codificarEmulacion(real: string, objetivo: string): string {
  return `${real.trim().toLowerCase()}|${objetivo.trim().toLowerCase()}`;
}

export function decodificarEmulacion(valor: string | null | undefined): ParEmulacion | null {
  if (!valor) return null;
  const [real, objetivo, ...resto] = valor.split('|');
  if (resto.length > 0 || !real || !objetivo || !real.includes('@') || !objetivo.includes('@')) return null;
  return { real: real.trim().toLowerCase(), objetivo: objetivo.trim().toLowerCase() };
}

/** Quién puede emular: solo el SuperTIC (decisión de David, 9-nov-2026). */
export function puedeEmularUsuarios(role: Role | null | undefined): boolean {
  return role === 'supertic';
}

export type VeredictoEmular = { ok: true } | { ok: false; motivo: string };

/** ¿Se puede empezar a emular a esa persona? Es SuperTIC quien pide, no es él mismo y la otra tiene acceso. */
export function veredictoEmular(args: {
  realRole: Role | null | undefined;
  realEmail: string;
  objetivoEmail: string;
  objetivoRole: Role | null;
}): VeredictoEmular {
  if (!puedeEmularUsuarios(args.realRole)) return { ok: false, motivo: 'Solo el SuperTIC puede emular usuarios' };
  if (args.realEmail.trim().toLowerCase() === args.objetivoEmail.trim().toLowerCase()) {
    return { ok: false, motivo: 'Ya eres tú' };
  }
  if (!args.objetivoRole) return { ok: false, motivo: 'Esa persona no tiene acceso: no hay nada que emular' };
  return { ok: true };
}

/** La cookie de emulación, ¿es de ESTA persona real? Si otra sesión de SuperTIC hereda una cookie vieja, no vale. */
export function emulacionVigente(par: ParEmulacion | null, emailReal: string, roleReal: Role | null | undefined): par is ParEmulacion {
  return !!par && puedeEmularUsuarios(roleReal) && par.real === emailReal.trim().toLowerCase() && par.objetivo !== par.real;
}

/** Texto para quien intenta algo que actuaría en la cuenta de Google de la persona emulada. */
export function motivoBloqueoEmulando(queHace: string): string {
  return `Emulando no se puede ${queHace}: actuaría en la cuenta de Google de esa persona. Sal del modo emulado para hacerlo con la tuya.`;
}
