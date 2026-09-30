// Calendarios del dominio · helpers puros (sin IO). Ficha: docs/25-calendarios.md
//
// Todo lo que decide "qué es este calendario" vive aquí para poder probarlo sin Google:
// si es de Classroom, de qué curso académico es, si está huérfano, y el resumen de sus
// eventos.

/**
 * Curso académico al que pertenece una fecha, visto desde Classroom. El corte NO es el 1 de
 * septiembre como en `academicYearActual`: las clases del curso que viene se crean en julio
 * y agosto (el profe las prepara antes de empezar), y con el corte en septiembre saldrían
 * todas como "del curso pasado" justo el mes en que más se miran. Corte: 1 de julio.
 */
export function cursoAcademicoDeClase(fecha: Date): string {
  const y = fecha.getUTCFullYear();
  const inicio = fecha.getUTCMonth() + 1 >= 7 ? y : y - 1;
  return `${inicio}-${String((inicio + 1) % 100).padStart(2, '0')}`;
}

/** El curso académico en vigor con el mismo corte de julio. */
export function cursoAcademicoActualClassroom(hoy = new Date()): string {
  return cursoAcademicoDeClase(hoy);
}

/**
 * Si el nombre de la clase ya dice el curso ("Matemáticas 3ESO 2024-25", "Tutoría 24/25",
 * "Música 2023-2024"), manda el nombre: hay profes que reutilizan una clase vieja un año más
 * y la renombran, y la fecha de creación mentiría. Devuelve '2024-25' o null.
 */
export function cursoEnNombre(nombre: string | null | undefined): string | null {
  if (!nombre) return null;
  // 2024-25 · 2024/25 · 2024-2025 · 24-25 · 24/25 (sin pegarse a otros dígitos)
  const m = nombre.match(/(?<!\d)(20)?(\d{2})\s*[-/–]\s*(20)?(\d{2})(?!\d)/);
  if (!m) return null;
  const a = Number(m[2]);
  const b = Number(m[4]);
  if ((a + 1) % 100 !== b) return null; // "3-4" o "10-12" no son cursos
  if (a < 10 || a > 60) return null; // 2010-2060: fuera de eso es otra cosa
  return `20${m[2]}-${m[4]}`;
}

/** Ids que son calendarios SECUNDARIOS de verdad (no el principal de nadie, ni festivos, ni salas). */
export function esCalendarioSecundario(id: string): boolean {
  return id.endsWith('@group.calendar.google.com');
}

/** Los calendarios que crea Classroom tienen siempre este prefijo. */
export function pareceDeClassroom(id: string): boolean {
  return id.startsWith('c_classroom');
}

export type GrupoCalendario = 'este' | 'anteriores' | 'huerfano' | 'otro';

export const GRUPO_LABELS: Record<GrupoCalendario, string> = {
  este: 'Classroom · este curso',
  anteriores: 'Classroom · cursos anteriores',
  huerfano: 'Classroom · clase ya borrada',
  otro: 'Otros calendarios',
};

export interface DatosClasificar {
  esClassroom: boolean;
  courseId: string | null;
  courseNombre: string | null;
  nombre: string | null;
  courseCreadoAt: Date | null;
  /** Si la clase salió en el último escaneo de Classroom. */
  clasePresente: boolean;
  primerEventoAt: Date | null;
}

/** De qué curso es un calendario: el nombre si lo dice; si no, cuándo se creó la clase. */
export function cursoDeCalendario(c: DatosClasificar): string | null {
  const porNombre = cursoEnNombre(c.courseNombre) ?? cursoEnNombre(c.nombre);
  if (porNombre) return porNombre;
  if (c.courseCreadoAt) return cursoAcademicoDeClase(c.courseCreadoAt);
  // Huérfanos: no hay clase que mirar; el primer evento es la mejor pista que queda.
  if (c.primerEventoAt) return cursoAcademicoDeClase(c.primerEventoAt);
  return null;
}

export function grupoDeCalendario(c: DatosClasificar, hoy = new Date()): GrupoCalendario {
  if (!c.esClassroom) return 'otro';
  if (!c.courseId || !c.clasePresente) return 'huerfano';
  const curso = cursoDeCalendario(c);
  return curso === cursoAcademicoActualClassroom(hoy) ? 'este' : 'anteriores';
}

export const ESTADO_CLASE_LABELS: Record<string, string> = {
  ACTIVE: 'Activa',
  ARCHIVED: 'Archivada',
  PROVISIONED: 'Sin aceptar',
  DECLINED: 'Rechazada',
  SUSPENDED: 'Suspendida',
};

// ── Eventos ──────────────────────────────────────────────────────────────────

export interface EventoMinimo {
  status?: string | null;
  start?: { date?: string | null; dateTime?: string | null } | null;
}

export interface ResumenEventos {
  total: number;
  futuros: number;
  primero: Date | null;
  ultimo: Date | null;
}

function inicioDe(e: EventoMinimo): Date | null {
  const s = e.start?.dateTime ?? e.start?.date;
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Acumula una página de eventos en el resumen (los cancelados no cuentan). */
export function acumularEventos(r: ResumenEventos, eventos: readonly EventoMinimo[], ahora = new Date()): ResumenEventos {
  let { total, futuros, primero, ultimo } = r;
  for (const e of eventos) {
    if (e.status === 'cancelled') continue;
    total++;
    const d = inicioDe(e);
    if (!d) continue;
    if (d >= ahora) futuros++;
    if (!primero || d < primero) primero = d;
    if (!ultimo || d > ultimo) ultimo = d;
  }
  return { total, futuros, primero, ultimo };
}

export const RESUMEN_VACIO: ResumenEventos = { total: 0, futuros: 0, primero: null, ultimo: null };

// ── Lo que viaja a la pantalla ───────────────────────────────────────────────

export interface CalendarioFila {
  id: string;
  nombre: string | null;
  descripcion: string | null;
  esClassroom: boolean;
  courseId: string | null;
  courseNombre: string | null;
  courseSeccion: string | null;
  courseEstado: string | null;
  courseCreadoAt: string | null;
  courseOwnerEmail: string | null;
  clasePresente: boolean;
  curso: string | null;
  grupo: GrupoCalendario;
  eventos: number | null;
  eventosFuturos: number | null;
  primerEventoAt: string | null;
  ultimoEventoAt: string | null;
  eventosError: string | null;
  suscriptores: number;
  propietarios: string[];
  vistoAt: string;
  borradoAt: string | null;
  borradoPor: string | null;
  borradoError: string | null;
}

/**
 * Por qué NO se puede borrar desde aquí, o null si se puede. Sin nadie a quien suplantar no
 * hay forma: la API solo deja borrar un calendario secundario a su propietario.
 */
export function motivoNoBorrable(c: Pick<CalendarioFila, 'borradoAt' | 'propietarios' | 'courseOwnerEmail'>): string | null {
  if (c.borradoAt) return 'Ya está borrado';
  if (c.propietarios.length === 0 && !c.courseOwnerEmail) return 'No se sabe quién es su propietario: haz el barrido por usuarios';
  return null;
}

/** A quién suplantar para borrar, en orden: los `owner` vistos y, detrás, el dueño de la clase. */
export function candidatosParaBorrar(propietarios: readonly string[], courseOwnerEmail: string | null): string[] {
  const lista = [...propietarios];
  if (courseOwnerEmail && !lista.includes(courseOwnerEmail)) lista.push(courseOwnerEmail);
  return lista;
}

// ── Clases de Classroom ──────────────────────────────────────────────────────

/** Años de un curso académico «2023-24» → 2023. */
function anioInicio(curso: string): number {
  return Number(curso.slice(0, 4));
}

/**
 * Cuántos cursos atrás queda `curso` respecto al actual: en 2026-27, el 2023-24 tiene
 * antigüedad 3. El filtro «3 años o más» se queda con 2023-24 y anteriores.
 */
export function antiguedadCurso(curso: string | null, hoy = new Date()): number | null {
  if (!curso) return null;
  return anioInicio(cursoAcademicoActualClassroom(hoy)) - anioInicio(curso);
}

/** El curso más reciente que entra con «`anios` años o más»: 3 en 2026-27 → '2023-24'. */
export function cursoLimite(anios: number, hoy = new Date()): string {
  const inicio = anioInicio(cursoAcademicoActualClassroom(hoy)) - anios;
  return `${inicio}-${String((inicio + 1) % 100).padStart(2, '0')}`;
}

/** De qué curso es una clase: el nombre si lo dice («1ESOA (2024/2025)»); si no, cuándo se creó. */
export function cursoDeClase(nombre: string | null, creadaAt: Date | null): string | null {
  return cursoEnNombre(nombre) ?? (creadaAt ? cursoAcademicoDeClase(creadaAt) : null);
}

export const ANIOS_POR_DEFECTO = 3;

export interface ClaseFila {
  id: string;
  nombre: string | null;
  seccion: string | null;
  estado: string | null;
  creadaAt: string | null;
  actualizadaAt: string | null;
  ownerEmail: string | null;
  calendarId: string | null;
  enlace: string | null;
  /** Si su calendario sigue vivo en el inventario (para ofrecer borrarlo también). */
  calendarioVivo: boolean;
  curso: string | null;
  antiguedad: number | null;
  vistoAt: string;
  borradoAt: string | null;
  borradoPor: string | null;
  borradoError: string | null;
}
