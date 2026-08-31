// Helpers puros del Registro ABC (sin IO, testeables).
// El módulo trabaja SIEMPRE con siglas en pantalla: el nombre completo vive en la BBDD
// central (edu_students) y solo se usa para buscar al alumno o en el correo de aviso a
// las personas configuradas. Si alguien mira el iPad de reojo, solo ve letras.

/** Inicial en mayúscula de una palabra, o '' si no hay nada aprovechable. */
function inicial(texto: string | null | undefined): string {
  const limpio = (texto ?? '').trim();
  return limpio ? `${limpio[0].toUpperCase()}.` : '';
}

/** "ROBERTO HERRERO MENDOZA" → "R.H.M." */
export function siglasDeAlumno(
  nombre: string | null | undefined,
  apellido1: string | null | undefined,
  apellido2: string | null | undefined,
): string {
  const siglas = [nombre, apellido1, apellido2].map(inicial).join('');
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
