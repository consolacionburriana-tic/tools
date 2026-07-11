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

/**
 * Clasifica lo que ha tecleado la familia: token de acceso (magic link), NIA del
 * alumno (solo dígitos; el servidor prueba también DNI-sin-letra como fallback) o
 * documento del tutor (DNI/NIE/pasaporte).
 */
export function detectarIdentificador(input: string): { tipo: TipoIdentificador; valor: string } | null {
  const bruto = input.trim();
  if (!bruto) return null;
  if (bruto.toLowerCase().startsWith('tok_')) return { tipo: 'token', valor: bruto };
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
