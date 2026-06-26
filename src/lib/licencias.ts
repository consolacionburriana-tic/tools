// Constantes y helpers client-safe del módulo Licencias (sin imports de DB)

// Las 8 opciones de curso del formulario (curso del año de la campaña).
// `value` = curso de catálogo (libros) · `base` = curso del alumno en BBDD (para identificar).
export const CURSOS_FORM = [
  { value: '6PRI', label: '6º EP', base: '6PRI' },
  { value: '1ESO', label: '1º ESO', base: '1ESO' },
  { value: '2ESO', label: '2º ESO', base: '2ESO' },
  { value: '3ESO', label: '3º ESO', base: '3ESO' },
  { value: '3PDC', label: '3º ESO PDC', base: '3ESO' },
  { value: '4ESO', label: '4º ESO', base: '4ESO' },
  { value: '4PDC', label: '4º ESO PDC', base: '4ESO' },
] as const;

export type CursoForm = (typeof CURSOS_FORM)[number]['value'];

export function cursoBase(curso: string): string {
  return CURSOS_FORM.find((c) => c.value === curso)?.base ?? curso;
}

export function cursoLabel(curso: string): string {
  return CURSOS_FORM.find((c) => c.value === curso)?.label ?? curso;
}

// Nombre enmascarado: "María" -> "Mar." (no revela el nombre completo)
export function maskName(nombre: string): string {
  const first = (nombre ?? '').trim().split(/\s+/)[0] ?? '';
  return first ? `${first.slice(0, 3)}.` : '';
}

// Apellidos enmascarados: revela solo las palabras que la familia ha tecleado,
// el resto a inicial. "Felguera Martínez" + "fel" -> "Felguera M."
export function maskApellidos(full: string, query: string): string {
  const words = (full ?? '').trim().split(/\s+/).filter(Boolean);
  const qTokens = normalize(query).split(' ').filter(Boolean);
  return words
    .map((w) => {
      const nw = normalize(w);
      const matched = qTokens.some((t) => nw.startsWith(t) || t.startsWith(nw));
      return matched ? w : `${(w[0] ?? '').toUpperCase()}.`;
    })
    .join(' ');
}

// Normaliza para comparar apellidos (sin acentos, minúsculas, espacios colapsados)
export function normalize(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// Colapsa pares bilingües -CAS/-VAL según la lengua base del alumno
const SUFFIX = /-(CAS|VAL)$/;
export function resolveBilingual<T extends { cod: string }>(books: T[], lengua: string | null): T[] {
  const wantVal = normalize(lengua ?? '').startsWith('valen');
  const groups = new Map<string, T[]>();
  for (const b of books) {
    const base = b.cod.replace(SUFFIX, '');
    const arr = groups.get(base) ?? [];
    arr.push(b);
    groups.set(base, arr);
  }
  const out: T[] = [];
  for (const arr of groups.values()) {
    if (arr.length === 1) {
      out.push(arr[0]);
      continue;
    }
    const cas = arr.find((b) => /-CAS$/.test(b.cod));
    const val = arr.find((b) => /-VAL$/.test(b.cod));
    if (cas && val) out.push(wantVal ? val : cas);
    else out.push(...arr);
  }
  return out;
}

export function euros(n: number): string {
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}

// Tipos compartidos cliente/servidor
export interface Candidate {
  id: string;
  maskedName: string;
  apellidos: string;
  cursoLabel: string;
}

export interface CatalogBook {
  cod: string;
  asignatura: string;
  nombreLibro: string;
  editorial: string;
  precio: string;
  bancoLibros: boolean;
  lengua: string | null;
}
