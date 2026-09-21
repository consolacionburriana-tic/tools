// Tipos y helpers puros del envío de licencias (Fase 5 de docs/11-licencias-v2.md).
// Sin IO: los usa la pantalla «tipo Excel» para filtrar y ordenar en el navegador, y el
// servidor para los recuentos. Ver `licencias-envios-server.ts` para las consultas.
import { ordenCurso } from '@/lib/cursos';
import { claveLibro } from '@/lib/licencias-exports';
import { normalize } from '@/lib/licencias';

export type TipoLicencia = 'pago' | 'banco';
/** A quién se le manda el correo. El envío de siempre iba al correo del alumno (su iPad). */
export type Destino = 'alumno' | 'familia';

export interface LicenciaFila {
  id: string;
  tipo: TipoLicencia;
  curso: string;
  cod: string;
  studentId: string | null;
  alumno: string;
  apellidos: string;
  nombre: string;
  letra: string | null;
  asignatura: string;
  libro: string;
  editorial: string;
  plataforma: string;
  isbn: string;
  codigo: string | null;
  estado: string;
  enviadoAt: string | null;
  enviadoA: string | null;
  descartadoAt: string | null;
  descartadoMotivo: string | null;
  error: string | null;
  /** Dirección a la que iría el correo hoy, según el destino elegido. */
  destinatario: string | null;
  correoAlumno: string | null;
  correoFamilia: string | null;
  nota: string | null;
}

export interface ResumenLicencias {
  total: number;
  conCodigo: number;
  sinCodigo: number;
  enviadas: number;
  listasParaEnviar: number;
  conError: number;
  sinCorreo: number;
  descartadas: number;
  sobrantes: number;
}

/**
 * Los recuentos de la cabecera. Los **sobrantes** (sin alumno) y las **descartadas** salen
 * aparte y no cuentan en el total: si contaran, «faltan 25» sería mentira todas las veces que
 * una optativa no la cursa media clase.
 */
export function resumir(filas: LicenciaFila[], tipo: TipoLicencia): ResumenLicencias {
  const delTipo = filas.filter((f) => f.tipo === tipo);
  const asignables = delTipo.filter((f) => f.studentId && !f.descartadoAt);
  return {
    total: asignables.length,
    conCodigo: asignables.filter((f) => f.codigo).length,
    sinCodigo: asignables.filter((f) => !f.codigo).length,
    enviadas: asignables.filter((f) => f.estado === 'enviado').length,
    listasParaEnviar: asignables.filter((f) => f.codigo && f.estado !== 'enviado' && f.destinatario).length,
    conError: asignables.filter((f) => f.estado === 'error').length,
    sinCorreo: asignables.filter((f) => f.codigo && f.estado !== 'enviado' && !f.destinatario).length,
    descartadas: delTipo.filter((f) => f.descartadoAt).length,
    sobrantes: delTipo.filter((f) => !f.studentId).length,
  };
}

export type EstadoFiltro =
  | 'todas'
  | 'sin-codigo'
  | 'listas'
  | 'enviadas'
  | 'error'
  | 'sin-correo'
  | 'descartadas';

export interface Filtros {
  tipo: TipoLicencia;
  curso: string; // 'todos' | curso
  clase: string; // 'todas' | letra
  libro: string; // 'todos' | `${curso}|${cod}`
  editorial: string; // 'todas' | nombre
  estado: EstadoFiltro;
  q: string;
}

export const FILTROS_INICIALES: Omit<Filtros, 'tipo'> = {
  curso: 'todos',
  clase: 'todas',
  libro: 'todos',
  editorial: 'todas',
  estado: 'todas',
  q: '',
};

function cumpleEstado(f: LicenciaFila, estado: EstadoFiltro): boolean {
  switch (estado) {
    case 'todas':
      return !f.descartadoAt;
    case 'sin-codigo':
      return !f.descartadoAt && !f.codigo;
    case 'listas':
      return !f.descartadoAt && Boolean(f.codigo) && f.estado !== 'enviado' && Boolean(f.destinatario);
    case 'enviadas':
      return f.estado === 'enviado';
    case 'error':
      return f.estado === 'error';
    case 'sin-correo':
      return !f.descartadoAt && !f.destinatario;
    case 'descartadas':
      return Boolean(f.descartadoAt);
  }
}

/** Los sobrantes (sin alumno) nunca salen en la tabla: tienen su propia sección. */
export function filtrarLicencias(filas: LicenciaFila[], f: Filtros): LicenciaFila[] {
  const q = normalize(f.q);
  return filas.filter((l) => {
    if (l.tipo !== f.tipo) return false;
    if (!l.studentId) return false;
    if (f.curso !== 'todos' && l.curso !== f.curso) return false;
    if (f.clase !== 'todas' && (l.letra ?? '') !== f.clase) return false;
    if (f.libro !== 'todos' && claveLibro(l.curso, l.cod) !== f.libro) return false;
    if (f.editorial !== 'todas' && l.editorial !== f.editorial) return false;
    if (!cumpleEstado(l, f.estado)) return false;
    if (q && !normalize(`${l.alumno} ${l.asignatura} ${l.codigo ?? ''}`).includes(q)) return false;
    return true;
  });
}

export type CampoOrden = 'alumno' | 'curso' | 'asignatura' | 'codigo' | 'estado' | 'enviado';

/** El orden de cursos es el escolar (5PRI antes que 1ESO), no el alfabético. */
export function compararLicencias(a: LicenciaFila, b: LicenciaFila, campo: CampoOrden): number {
  const porAlumno = () => a.alumno.localeCompare(b.alumno, 'es', { sensitivity: 'base' });
  switch (campo) {
    case 'alumno':
      return porAlumno();
    case 'curso':
      return ordenCurso(a.curso) - ordenCurso(b.curso) || (a.letra ?? '').localeCompare(b.letra ?? '', 'es') || porAlumno();
    case 'asignatura':
      return a.asignatura.localeCompare(b.asignatura, 'es') || porAlumno();
    case 'codigo':
      // Sin código primero: son las que hay que rellenar, y es lo que se viene a hacer.
      return Number(Boolean(a.codigo)) - Number(Boolean(b.codigo)) || porAlumno();
    case 'estado':
      return a.estado.localeCompare(b.estado) || porAlumno();
    case 'enviado':
      return (a.enviadoAt ? Date.parse(a.enviadoAt) : 0) - (b.enviadoAt ? Date.parse(b.enviadoAt) : 0) || porAlumno();
  }
}

/**
 * El orden POR DEFECTO de la pantalla, y el que se usa al emparejar códigos: curso, clase y
 * apellidos. Es el mismo criterio con el que vienen ordenados los Excel de las editoriales
 * (que salen del pedido, y el pedido sale de aquí), así que pegar en bloque suele cuadrar.
 */
export function ordenNatural(a: LicenciaFila, b: LicenciaFila): number {
  return compararLicencias(a, b, 'curso');
}

export interface OpcionLibro {
  clave: string;
  curso: string;
  cod: string;
  asignatura: string;
  editorial: string;
  pendientes: number;
  total: number;
}

/** Los libros que aparecen en las filas dadas, con cuántas licencias les faltan por asignar. */
export function librosDe(filas: LicenciaFila[]): OpcionLibro[] {
  const mapa = new Map<string, OpcionLibro>();
  for (const l of filas) {
    if (!l.studentId || l.descartadoAt) continue;
    const clave = claveLibro(l.curso, l.cod);
    const previo = mapa.get(clave) ?? {
      clave,
      curso: l.curso,
      cod: l.cod,
      asignatura: l.asignatura,
      editorial: l.editorial,
      pendientes: 0,
      total: 0,
    };
    previo.total += 1;
    if (!l.codigo) previo.pendientes += 1;
    mapa.set(clave, previo);
  }
  return [...mapa.values()].sort(
    (a, b) =>
      a.asignatura.localeCompare(b.asignatura, 'es') || ordenCurso(a.curso) - ordenCurso(b.curso),
  );
}

/**
 * Cuántos libros DISTINTOS hay en una selección. Pegar una columna de códigos contra dos
 * libros a la vez es el error caro de este flujo: los códigos de Inglés de 1ºESO acabarían
 * repartidos entre Inglés y Religión sin que nada chirríe. La pantalla avisa con esto.
 */
export function librosDistintos(filas: LicenciaFila[]): string[] {
  return [...new Set(filas.map((l) => claveLibro(l.curso, l.cod)))];
}

/**
 * Las variables que admite la plantilla del correo de licencias. Viven aquí y no en
 * `licencias-email.ts` porque la pantalla las pinta, y ese fichero arrastra Resend y
 * googleapis: importarlo desde un componente cliente se lleva medio SDK al navegador.
 */
export const VARIABLES_LICENCIA = [
  'nombre',
  'apellidos',
  'alumno',
  'curso',
  'clase',
  'asignatura',
  'libro',
  'editorial',
  'plataforma',
  'codigo',
  'n',
  'curso_escolar',
] as const;
