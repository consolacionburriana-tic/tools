// Identificación de familias sin exponer datos: helpers puros compartidos por los
// módulos públicos (Licencias, Salidas…). La parte con BBDD vive en familias-server.ts.

/** Mayúsculas, sin espacios ni guiones. Para comparar DNI/NIE. */
export function normalizarDni(v: string): string {
  return v.toUpperCase().replace(/[\s\-.]/g, '');
}

// El documento del tutor puede ser DNI, NIE o pasaporte (en la BBDD real hay de todo,
// incluso con ceros a la izquierda): cualquier alfanumérico razonable con letras vale.
const DOCUMENTO_RE = /^[A-Z0-9]{5,20}$/;
const NIA_RE = /^[0-9]{5,12}$/; // NIA (número de identificación del alumnado) — solo dígitos

export type TipoIdentificador = 'dni' | 'nia' | 'token';

// ── Tokens de acceso (magic links) ────────────────────────────────────────────

export const TOKEN_PREFIX = 'tok_';

// Alfabeto sin caracteres confundibles (l/I/1, o/O/0) para que un token se pueda
// dictar por teléfono o teclear a mano si el enlace se rompe en el correo.
const TOKEN_ALFABETO = 'abcdefghjkmnpqrstuvwxyz23456789';

/** Token nuevo, formato `tok_<24 chars>` (~118 bits de entropía). */
export function nuevoTokenFamilia(largo = 24): string {
  const bytes = new Uint8Array(largo);
  crypto.getRandomValues(bytes);
  return TOKEN_PREFIX + Array.from(bytes, (b) => TOKEN_ALFABETO[b % TOKEN_ALFABETO.length]).join('');
}

/** Propósitos de token = módulos públicos que tienen formulario de familias. */
export const PROPOSITOS = { licencias: '/licencias', salidas: '/salidas' } as const;
export type PropositoToken = keyof typeof PROPOSITOS;

/**
 * URL del magic link: el formulario público del módulo con el token en `?t=`.
 * `base` sin barra final (ver `appBaseUrl()` en `lib/constants.ts`).
 */
export function urlAccesoFamilia(base: string, proposito: PropositoToken, token: string): string {
  return `${base}${PROPOSITOS[proposito]}?t=${encodeURIComponent(token)}`;
}

/**
 * Clasifica lo que ha tecleado la familia: token de acceso (magic link), NIA del
 * alumno (solo dígitos; el servidor prueba también DNI-sin-letra como fallback) o
 * documento del tutor (DNI/NIE/pasaporte).
 */
export function detectarIdentificador(input: string): { tipo: TipoIdentificador; valor: string } | null {
  const bruto = input.trim();
  if (!bruto) return null;
  // Los tokens se generan en minúsculas; normalizamos porque algunos clientes de correo
  // capitalizan el primer carácter del enlace al "autocorregir" el texto.
  if (bruto.toLowerCase().startsWith(TOKEN_PREFIX)) return { tipo: 'token', valor: bruto.toLowerCase() };
  const norm = normalizarDni(bruto);
  if (NIA_RE.test(norm)) return { tipo: 'nia', valor: norm };
  if (DOCUMENTO_RE.test(norm)) return { tipo: 'dni', valor: norm };
  return null;
}

function fragmento(texto: string | null, letras: number): string | null {
  const limpio = (texto ?? '').trim();
  if (!limpio) return null;
  const corte = limpio.slice(0, letras);
  return corte.charAt(0).toUpperCase() + corte.slice(1).toLowerCase() + '.';
}

/**
 * Máscara de protección de datos para elegir hijo: "Francisco Martínez Lucencio" →
 * "Fra. M. Luc." (3 letras del nombre, inicial del primer apellido, 3 del segundo).
 */
export function maskAlumno(nombre: string | null, apellido1: string | null, apellido2: string | null): string {
  return [fragmento(nombre, 3), fragmento(apellido1, 1), fragmento(apellido2, 3)].filter(Boolean).join(' ') || '(alumno)';
}
