// AUTOASM · construir el proyecto: de la BBDD central (y de la plantilla del centro) a
// las filas de los seis CSV de Apple School Manager. Puro y testeable, como `autoasm.ts`.
//
// La idea de fondo: **los identificadores mandan**. ASM actualiza una clase o una persona
// si el id coincide y crea una nueva si no, así que aquí nunca se inventa un id que ya
// exista en el proyecto: se reutiliza el que hay (emparejando por correo o por NIA) y
// solo se generan ids para las altas de verdad.

import {
  CAMPOS_INSTRUCTOR,
  ORDEN_ARCHIVOS,
  ESPEC,
  cabecerasDe,
  gradeLevelDe,
  rosterId,
  slugPersona,
  usuarioDeEmail,
  type Archivos,
  type ArchivoAsm,
  type FilaCsv,
  type OpcionesCsv,
  OPCIONES_CSV_ASM,
} from '@/lib/autoasm';
import { cursoBaseEso, ordenCurso } from '@/lib/cursos';
import {
  CENTRO_PLANTILLA,
  CLASES_PLANTILLA,
  CURSOS_PLANTILLA,
  type ClasePlantilla,
  type TipoClase,
} from '@/lib/autoasm-plantilla';

// ─── El proyecto ──────────────────────────────────────────────────────────────

export interface OpcionesProyecto {
  locationId: string;
  locationName: string;
  /**
   * Curso mínimo del alumnado que entra en ASM (`null` = todo el centro). El alcance se
   * ha movido cada año — 2025-26 de 5º EP para arriba, 2026-27 de 6º EP — y a partir de
   * 2027-28 se queda fijo en 1º ESO, así que es una opción, no una constante.
   * El PROFESORADO entra siempre entero: un profe da clase donde le toque.
   */
  desdeCurso: string | null;
  /** 4 = PIN de 4 dígitos · 6 = PIN de 6 · 8 = contraseña larga. */
  passwordPolicy: '4' | '6' | '8';
  /** Dominio con el que se completa el correo del alumnado que no lo tiene en la BBDD. */
  dominio: string;
  csv: OpcionesCsv;
}

export interface ProyectoAsm {
  version: 1;
  nombre: string;
  actualizado: string;
  opciones: OpcionesProyecto;
  archivos: Archivos;
  /** Regla de matrícula por clase: `grade_level` cuyo alumnado entra en ella. */
  reglas: Record<string, string[]>;
  /** Para qué sirve cada clase (decide qué profes entran solos). */
  tipos: Record<string, TipoClase>;
  /**
   * Qué clase de ASM corresponde a cada asignación del horario (`hor_asignaciones.id`).
   * Se recuerda para que el año que viene el emparejamiento no haya que adivinarlo otra
   * vez — y para no crear una clase nueva donde ya había una.
   */
  horario?: Record<string, string>;
  /**
   * Personas que ya no están en el centro. **No se borran del fichero**: si se quitan de
   * ASM, se pierde la cuenta (y su iCloud). Se quedan dentro, fuera de toda clase y
   * escondidas en las pantallas, hasta que alguien decida darlas de baja de verdad.
   */
  archivados: string[];
  /**
   * Cuentas que no son personas: los iPads compartidos. No vienen de Educamos, así que el
   * sync no las toca nunca ni las archiva; se importan del CSV anterior y se editan aquí.
   */
  compartidas: string[];
  /** Pequeño historial de lo que se ha hecho, para saber de dónde sale el proyecto. */
  historial: { fecha: string; texto: string }[];
}

/** Cursos del centro de menor a mayor, para el selector "alumnado desde". */
export const CURSOS_CENTRO: { curso: string; label: string }[] = [
  { curso: '3INF', label: 'Infantil 3 años' },
  { curso: '4INF', label: 'Infantil 4 años' },
  { curso: '5INF', label: 'Infantil 5 años' },
  { curso: '1PRI', label: '1º EP' },
  { curso: '2PRI', label: '2º EP' },
  { curso: '3PRI', label: '3º EP' },
  { curso: '4PRI', label: '4º EP' },
  { curso: '5PRI', label: '5º EP' },
  { curso: '6PRI', label: '6º EP' },
  { curso: '1ESO', label: '1º ESO' },
  { curso: '2ESO', label: '2º ESO' },
  { curso: '3ESO', label: '3º ESO' },
  { curso: '4ESO', label: '4º ESO' },
];

export function labelCurso(curso: string | null): string {
  if (!curso) return 'Todo el centro';
  return CURSOS_CENTRO.find((c) => c.curso === curso)?.label ?? curso;
}

/**
 * ¿Este alumno entra en ASM con el alcance elegido? Se compara por CURSO de la BBDD
 * central (`6PRI`, `1ESO`) y no por `grade_level`, que es texto libre; y el PDC cuenta
 * por su curso de verdad (`3ºPPDC` → 3º de ESO).
 */
export function entraEnAlcance(curso: string | null | undefined, desdeCurso: string | null): boolean {
  if (!desdeCurso) return true;
  if (!curso) return false;
  return ordenCurso(cursoBaseEso(curso)) >= ordenCurso(desdeCurso);
}

export const OPCIONES_POR_DEFECTO: OpcionesProyecto = {
  locationId: CENTRO_PLANTILLA.location_id,
  locationName: CENTRO_PLANTILLA.location_name,
  desdeCurso: '6PRI', // alcance del curso 2026-27

  passwordPolicy: '4',
  dominio: 'consolacionburriana.com',
  csv: OPCIONES_CSV_ASM,
};

export function archivosVacios(): Archivos {
  return { locations: [], students: [], staff: [], courses: [], classes: [], rosters: [] };
}

function fila(archivo: ArchivoAsm, valores: Partial<FilaCsv>): FilaCsv {
  const salida: FilaCsv = {};
  for (const campo of cabecerasDe(archivo)) salida[campo] = valores[campo] ?? '';
  return salida;
}

/** Proyecto en blanco, solo con el centro. */
export function proyectoVacio(opciones: OpcionesProyecto = OPCIONES_POR_DEFECTO): ProyectoAsm {
  const archivos = archivosVacios();
  archivos.locations = [fila('locations', { location_id: opciones.locationId, location_name: opciones.locationName })];
  return {
    version: 1,
    nombre: 'Apple School Manager',
    actualizado: new Date().toISOString(),
    opciones,
    archivos,
    reglas: {},
    tipos: {},
    archivados: [],
    compartidas: [],
    historial: [],
  };
}

/**
 * Proyecto sembrado con la estructura del centro (cursos y clases de `autoasm-plantilla`),
 * sin personas: alumnado y profesorado se traen luego de la BBDD central y los profes de
 * cada clase se asignan en pantalla o se arrastran del export del año anterior.
 */
export function proyectoDesdePlantilla(
  opciones: OpcionesProyecto = OPCIONES_POR_DEFECTO,
  clases: ClasePlantilla[] = CLASES_PLANTILLA,
): ProyectoAsm {
  const proyecto = proyectoVacio(opciones);
  proyecto.archivos.courses = CURSOS_PLANTILLA.map((c) =>
    fila('courses', { ...c, location_id: opciones.locationId }),
  );
  proyecto.archivos.classes = clases.map((c) =>
    fila('classes', { class_id: c.class_id, class_number: c.class_number, course_id: c.course_id, location_id: opciones.locationId }),
  );
  proyecto.reglas = Object.fromEntries(clases.filter((c) => c.grupos.length > 0).map((c) => [c.class_id, [...c.grupos]]));
  proyecto.tipos = Object.fromEntries(clases.map((c) => [c.class_id, c.tipo]));
  return proyecto;
}

// ─── Personas: de la BBDD central a filas ─────────────────────────────────────

export interface AlumnoCentro {
  nia: string | null;
  codigo: string | null;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  curso: string | null;
  letra: string | null;
  email: string | null;
  emailGoogle: string | null;
}

export interface ProfeCentro {
  alias: string | null;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  email: string | null;
}

export interface SnapshotCentro {
  alumnos: AlumnoCentro[];
  profes: ProfeCentro[];
  /** Tutorías del curso en vigor y equipos TIC/dirección: quién entra solo en qué clase. */
  equipos: EquiposCentro;
  generado: string;
}

function apellidos(a1: string | null | undefined, a2: string | null | undefined): string {
  return [a1, a2].map((x) => (x ?? '').trim()).filter(Boolean).join(' ');
}

/** Reserva un identificador libre: `base`, y si está pillado, `base2`, `base3`… */
function idLibre(base: string, usados: Set<string>): string {
  if (!base) base = 'persona';
  let candidato = base;
  let n = 2;
  while (usados.has(candidato)) candidato = `${base}${n++}`;
  usados.add(candidato);
  return candidato;
}

export function emailDeAlumno(alumno: AlumnoCentro, dominio: string): string {
  const directo = (alumno.emailGoogle ?? alumno.email ?? '').trim().toLowerCase();
  if (directo) return directo;
  const usuario = slugPersona(alumno.nombre, alumno.apellido1);
  return usuario ? `${usuario}@${dominio}` : '';
}

// ─── Sincronizar con la BBDD central ──────────────────────────────────────────

export interface ResumenSync {
  alumnos: { altas: number; actualizados: number; archivados: number; sinNia: number };
  /** Alumnado de la BBDD central que se ha quedado fuera por el alcance, por curso. */
  fueraDeAlcance: { curso: string; n: number }[];
  profes: { altas: number; actualizados: number; archivados: number };
  matriculas: { altas: number; bajas: number };
  /** Cuentas de iPad compartido reconocidas como tales en esta pasada. */
  compartidasDetectadas: number;
  profesAutomaticos: ResumenProfes | null;
}

export interface OpcionesSync {
  /** Rehacer las matrículas de las clases que tienen regla de grupos. */
  regenerarMatriculas: boolean;
  /** Meter solos a TIC en las tutorías y a tutores/TIC/dirección en las clases de curso. */
  repartirProfes: boolean;
}

export const OPCIONES_SYNC_POR_DEFECTO: OpcionesSync = {
  regenerarMatriculas: true,
  repartirProfes: true,
};

/**
 * Trae alumnado y profesorado de la BBDD central al proyecto, conservando lo que ya hay:
 * las personas que ya estaban mantienen su `person_id` (que es lo que ASM usa para no
 * duplicar cuentas) y solo se actualizan nombre, curso y correo.
 *
 * A quien ya no está en el centro **no se le borra: se archiva** (ver `ProyectoAsm`), y
 * las cuentas de los iPads compartidos no se tocan nunca.
 */
export function sincronizarConCentro(
  proyecto: ProyectoAsm,
  snapshot: SnapshotCentro,
  opciones: OpcionesSync = OPCIONES_SYNC_POR_DEFECTO,
): { proyecto: ProyectoAsm; resumen: ResumenSync } {
  const { locationId, passwordPolicy, dominio } = proyecto.opciones;
  const resumen: ResumenSync = {
    alumnos: { altas: 0, actualizados: 0, archivados: 0, sinNia: 0 },
    fueraDeAlcance: [],
    profes: { altas: 0, actualizados: 0, archivados: 0 },
    matriculas: { altas: 0, bajas: 0 },
    compartidasDetectadas: 0,
    profesAutomaticos: null,
  };

  const compartidas = new Set(proyecto.compartidas);
  const archivados = new Set(proyecto.archivados);
  const archivos: Archivos = { ...proyecto.archivos };
  archivos.locations = proyecto.archivos.locations.length > 0
    ? proyecto.archivos.locations
    : [fila('locations', { location_id: locationId, location_name: proyecto.opciones.locationName })];

  // ── Profesorado ────────────────────────────────────────────────────────────
  const staffPorEmail = new Map(archivos.staff.map((f) => [(f.email_address ?? '').toLowerCase(), f]));
  const staffPorId = new Map(archivos.staff.map((f) => [f.person_id, f]));
  const idsUsados = new Set([...archivos.staff.map((f) => f.person_id), ...archivos.students.map((f) => f.person_id)]);
  const staffFinal: FilaCsv[] = [];
  const vivosStaff = new Set<string>();

  for (const profe of snapshot.profes) {
    const email = (profe.email ?? '').trim().toLowerCase();
    const existente = (email && staffPorEmail.get(email)) || staffPorId.get(slugPersona(profe.nombre, profe.apellido1));
    const personId = existente?.person_id ?? idLibre(slugPersona(profe.nombre, profe.apellido1), idsUsados);
    const nueva = fila('staff', {
      person_id: personId,
      person_number: existente?.person_number ?? '',
      first_name: (profe.nombre ?? '').trim(),
      middle_name: existente?.middle_name ?? '',
      last_name: apellidos(profe.apellido1, profe.apellido2),
      email_address: email,
      sis_username: existente?.sis_username ?? '',
      location_id: locationId,
    });
    if (existente) resumen.profes.actualizados += cambia(existente, nueva) ? 1 : 0;
    else resumen.profes.altas += 1;
    vivosStaff.add(personId);
    // Quien vuelve a aparecer en la BBDD central deja de estar archivado.
    archivados.delete(personId);
    staffFinal.push(nueva);
  }

  // Los que no venían en la BBDD central (cuentas de servicio, pruebas, quien se fue):
  // se quedan en el fichero, pero archivados y fuera de sus clases.
  for (const profe of archivos.staff) {
    if (vivosStaff.has(profe.person_id)) continue;
    staffFinal.push(profe);
    if (!archivados.has(profe.person_id)) {
      archivados.add(profe.person_id);
      resumen.profes.archivados += 1;
    }
  }
  archivos.staff = ordenarPor(staffFinal, (f) => `${f.last_name} ${f.first_name}`);

  // Un profe archivado no puede seguir figurando como instructor de una clase.
  archivos.classes = archivos.classes.map((clase) => {
    const quedan = CAMPOS_INSTRUCTOR.map((c) => clase[c]).filter((v) => v && !archivados.has(v));
    if (quedan.length === CAMPOS_INSTRUCTOR.map((c) => clase[c]).filter(Boolean).length) return clase;
    const copia = { ...clase };
    CAMPOS_INSTRUCTOR.forEach((campo, i) => { copia[campo] = quedan[i] ?? ''; });
    return copia;
  });

  // ── Alumnado ───────────────────────────────────────────────────────────────
  const alumnosPorId = new Map(archivos.students.map((f) => [f.person_id, f]));
  const alumnosPorEmail = new Map(archivos.students.map((f) => [(f.email_address ?? '').toLowerCase(), f]));
  const usuariosUsados = new Set(archivos.students.map((f) => f.sis_username).filter(Boolean));
  const studentsFinal: FilaCsv[] = [];
  const vivosAlumnos = new Set<string>();

  const fueraDeAlcance = new Map<string, number>();
  for (const alumno of snapshot.alumnos) {
    if (!entraEnAlcance(alumno.curso, proyecto.opciones.desdeCurso)) {
      const clave = alumno.curso ?? 'sin curso';
      fueraDeAlcance.set(clave, (fueraDeAlcance.get(clave) ?? 0) + 1);
      continue;
    }
    const grade = gradeLevelDe(alumno.curso, alumno.letra);
    const email = emailDeAlumno(alumno, dominio);
    const nia = (alumno.nia ?? '').trim();
    if (!nia) resumen.alumnos.sinNia += 1;
    const existente = (nia && alumnosPorId.get(nia)) || (email && alumnosPorEmail.get(email)) || undefined;
    const personId = existente?.person_id ?? (nia || idLibre(usuarioDeEmail(email) || slugPersona(alumno.nombre, alumno.apellido1), idsUsados));
    const usuario = existente?.sis_username || usuarioDeEmail(email) || idLibre(slugPersona(alumno.nombre, alumno.apellido1), usuariosUsados);
    const nueva = fila('students', {
      person_id: personId,
      person_number: existente?.person_number ?? '',
      first_name: (alumno.nombre ?? '').trim(),
      middle_name: existente?.middle_name ?? '',
      last_name: apellidos(alumno.apellido1, alumno.apellido2),
      grade_level: grade,
      email_address: email,
      sis_username: usuario,
      password_policy: existente?.password_policy || passwordPolicy,
      location_id: locationId,
    });
    if (existente) resumen.alumnos.actualizados += cambia(existente, nueva) ? 1 : 0;
    else resumen.alumnos.altas += 1;
    vivosAlumnos.add(personId);
    archivados.delete(personId);
    studentsFinal.push(nueva);
  }
  resumen.fueraDeAlcance = [...fueraDeAlcance.entries()]
    .map(([curso, n]) => ({ curso, n }))
    .sort((a, b) => ordenCurso(a.curso) - ordenCurso(b.curso));

  for (const alumno of archivos.students) {
    if (vivosAlumnos.has(alumno.person_id)) continue;
    studentsFinal.push(alumno);
    // Los iPads compartidos no vienen de Educamos y no son bajas de nadie: se detectan
    // solos la primera vez y a partir de ahí el sync los ignora.
    if (compartidas.has(alumno.person_id)) continue;
    if (pareceCompartida(alumno)) {
      compartidas.add(alumno.person_id);
      resumen.compartidasDetectadas += 1;
      continue;
    }
    if (!archivados.has(alumno.person_id)) {
      archivados.add(alumno.person_id);
      resumen.alumnos.archivados += 1;
    }
  }
  archivos.students = ordenarPor(studentsFinal, (f) => `${f.grade_level} ${f.last_name} ${f.first_name}`);

  // ── Matrículas ─────────────────────────────────────────────────────────────
  if (opciones.regenerarMatriculas) {
    const { filas, altas, bajas } = regenerarMatriculas(archivos, proyecto.reglas, [...archivados]);
    archivos.rosters = filas;
    resumen.matriculas = { altas, bajas };
  }

  // ── Profes que entran solos ────────────────────────────────────────────────
  const tipos = { ...inferirTipos(archivos, proyecto.tipos) };
  let salida = archivos;
  if (opciones.repartirProfes) {
    const reparto = profesAutomaticos(salida, tipos, snapshot.equipos, [...archivados]);
    salida = reparto.archivos;
    resumen.profesAutomaticos = reparto.resumen;
  }

  const texto = `Traído de la BBDD central: ${resumen.alumnos.altas} altas y ${resumen.alumnos.actualizados} cambios de alumnado, ${resumen.profes.altas} altas de profesorado.`;
  return {
    proyecto: {
      ...proyecto,
      archivos: limpiarArchivos(salida, [...archivados]),
      tipos,
      archivados: [...archivados],
      compartidas: [...compartidas],
      actualizado: new Date().toISOString(),
      historial: [...proyecto.historial, { fecha: new Date().toISOString(), texto }].slice(-20),
    },
    resumen,
  };
}

function cambia(antes: FilaCsv, ahora: FilaCsv): boolean {
  return Object.keys(ahora).some((k) => (antes[k] ?? '') !== (ahora[k] ?? ''));
}

function ordenarPor<T>(filas: T[], clave: (f: T) => string): T[] {
  return [...filas].sort((a, b) => clave(a).localeCompare(clave(b), 'es'));
}

/**
 * Rehace `rosters.csv` a partir de las reglas de grupo de cada clase. Las clases sin
 * regla conservan sus matrículas (menos las de alumnos que ya no existen), para no
 * cargarse las que se hayan tocado a mano.
 */
export function regenerarMatriculas(
  archivos: Archivos,
  reglas: Record<string, string[]>,
  archivados: readonly string[] = [],
): { filas: FilaCsv[]; altas: number; bajas: number } {
  const fuera = new Set(archivados);
  const alumnosPorGrupo = new Map<string, string[]>();
  for (const alumno of archivos.students) {
    if (fuera.has(alumno.person_id)) continue; // conserva su cuenta, pero no va a clase
    const grupo = alumno.grade_level ?? '';
    if (!alumnosPorGrupo.has(grupo)) alumnosPorGrupo.set(grupo, []);
    alumnosPorGrupo.get(grupo)!.push(alumno.person_id);
  }
  const existen = new Set(archivos.students.filter((f) => !fuera.has(f.person_id)).map((f) => f.person_id));
  const previas = new Set(archivos.rosters.map((f) => `${f.class_id}|${f.student_id}`));

  const pares: [string, string][] = [];
  for (const clase of archivos.classes) {
    const grupos = reglas[clase.class_id];
    if (grupos && grupos.length > 0) {
      const alumnos = grupos.flatMap((g) => alumnosPorGrupo.get(g) ?? []);
      for (const alumno of alumnos) pares.push([clase.class_id, alumno]);
    } else {
      for (const linea of archivos.rosters) {
        if (linea.class_id === clase.class_id && existen.has(linea.student_id)) pares.push([clase.class_id, linea.student_id]);
      }
    }
  }

  const vistos = new Set<string>();
  const filas: FilaCsv[] = [];
  let altas = 0;
  for (const [claseId, alumnoId] of pares) {
    const par = `${claseId}|${alumnoId}`;
    if (vistos.has(par)) continue;
    vistos.add(par);
    if (!previas.has(par)) altas += 1;
    filas.push(fila('rosters', { roster_id: rosterId(filas.length + 1), class_id: claseId, student_id: alumnoId }));
  }
  const bajas = [...previas].filter((p) => !vistos.has(p)).length;
  return { filas, altas, bajas };
}

/**
 * Deduce la regla de grupos de cada clase mirando las matrículas que ya tiene: es lo que
 * permite subir el export del año pasado y que el módulo entienda que "Religión de 3A"
 * lleva también al alumnado de 3º PDC.
 */
export function inferirReglas(archivos: Archivos): Record<string, string[]> {
  const grupoDeAlumno = new Map(archivos.students.map((f) => [f.person_id, f.grade_level ?? '']));
  const tamanoGrupo = new Map<string, number>();
  for (const g of grupoDeAlumno.values()) tamanoGrupo.set(g, (tamanoGrupo.get(g) ?? 0) + 1);

  const porClase = new Map<string, Map<string, number>>();
  for (const linea of archivos.rosters) {
    const grupo = grupoDeAlumno.get(linea.student_id);
    if (grupo === undefined) continue;
    if (!porClase.has(linea.class_id)) porClase.set(linea.class_id, new Map());
    const cuenta = porClase.get(linea.class_id)!;
    cuenta.set(grupo, (cuenta.get(grupo) ?? 0) + 1);
  }

  const reglas: Record<string, string[]> = {};
  for (const [claseId, cuenta] of porClase) {
    // Solo se toma como regla el grupo que está entero (o casi) en la clase: si de 3ºA
    // hay un alumno suelto en una optativa, eso es una excepción, no una regla.
    const grupos = [...cuenta.entries()]
      .filter(([grupo, n]) => n >= Math.max(2, Math.ceil((tamanoGrupo.get(grupo) ?? 0) * 0.8)))
      .map(([grupo]) => grupo)
      .sort((a, b) => a.localeCompare(b, 'es'));
    if (grupos.length > 0) reglas[claseId] = grupos;
  }
  return reglas;
}

// ─── Limpieza de salida ───────────────────────────────────────────────────────

/**
 * Deja los ficheros como ASM los quiere, pase lo que pase antes: correos en minúsculas
 * (ASM los normaliza igual, pero así el fichero no miente), sin matrículas repetidas, sin
 * espacios sobrantes y con los `roster_id` correlativos. Se aplica después de cada acción,
 * no solo al descargar: lo que se ve en el explorador es lo que se va a subir.
 */
export function limpiarArchivos(archivos: Archivos, archivados: readonly string[] = []): Archivos {
  const fuera = new Set(archivados);
  const limpio = (f: FilaCsv): FilaCsv => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, (v ?? '').trim()]));
  const minusculas = (f: FilaCsv): FilaCsv => ({ ...limpio(f), email_address: (f.email_address ?? '').trim().toLowerCase() });

  const students = archivos.students.map(minusculas);
  const staff = archivos.staff.map(minusculas);
  const existe = new Set(students.map((f) => f.person_id));

  const vistos = new Set<string>();
  const rosters: FilaCsv[] = [];
  for (const linea of archivos.rosters) {
    const par = `${linea.class_id}|${linea.student_id}`;
    // Fuera los duplicados, los alumnos que ya no existen y los archivados: una persona
    // archivada conserva su cuenta, pero no pinta nada en una clase.
    if (vistos.has(par) || !existe.has(linea.student_id) || fuera.has(linea.student_id)) continue;
    vistos.add(par);
    rosters.push({ ...limpio(linea), roster_id: rosterId(rosters.length + 1) });
  }

  return {
    locations: archivos.locations.map(limpio),
    students,
    staff,
    courses: archivos.courses.map(limpio),
    classes: archivos.classes.map(limpio),
    rosters,
  };
}

// ─── Tipos de clase y cursos ──────────────────────────────────────────────────

/**
 * Curso y letra de la BBDD central a partir del código de un curso de ASM:
 * `ESO1A` → 1ESO A · `EP5` → 5PRI (el nivel entero) · `EI1A` → 3INF A (infantil 1 = 3
 * años) · `ESO3PDC` → 3ESO PDC.
 */
export function cursoDeCourseNumber(courseNumber: string): { curso: string; letra: string | null } | null {
  const c = courseNumber.trim().toUpperCase();
  const pdc = c.match(/^ESO(\d)PDC$/);
  if (pdc) return { curso: `${pdc[1]}ESO`, letra: 'PDC' };
  const eso = c.match(/^ESO(\d)([A-Z]?)$/);
  if (eso) return { curso: `${eso[1]}ESO`, letra: eso[2] || null };
  const ep = c.match(/^EP(\d)([A-Z]?)$/);
  if (ep) return { curso: `${ep[1]}PRI`, letra: ep[2] || null };
  const ei = c.match(/^EI(\d)([A-Z]?)$/);
  if (ei) return { curso: `${Number(ei[1]) + 2}INF`, letra: ei[2] || null };
  return null;
}

/** Tipos de clase de un proyecto importado, deducidos como en la plantilla del centro. */
export function inferirTipos(archivos: Archivos, previos: Record<string, TipoClase> = {}): Record<string, TipoClase> {
  const deLaPlantilla = new Map(CLASES_PLANTILLA.map((c) => [c.class_id, c.tipo]));
  const cursoDe = new Map(archivos.courses.map((c) => [c.course_id, c.course_number]));
  const tipos: Record<string, TipoClase> = {};
  for (const clase of archivos.classes) {
    const id = clase.class_id;
    const conocido = previos[id] ?? deLaPlantilla.get(id);
    if (conocido) { tipos[id] = conocido; continue; }
    const numero = cursoDe.get(clase.course_id) ?? '';
    const nivelEntero = cursoDeCourseNumber(numero)?.letra === null;
    const esTutoria = /^tutor[íi]a$/i.test(clase.class_number.trim());
    if (/compartid/i.test(clase.class_number) || /comp$/i.test(numero)) tipos[id] = 'compartidos';
    else if (esTutoria && nivelEntero) tipos[id] = 'curso';
    else if (esTutoria) tipos[id] = 'tutoria';
    else tipos[id] = 'asignatura';
  }
  return tipos;
}

/** ¿Esta cuenta de alumno es un iPad compartido y no una persona? */
export function pareceCompartida(alumno: FilaCsv): boolean {
  return /compartid/i.test(alumno.grade_level ?? '') || /^alu/i.test(alumno.person_id ?? '');
}

// ─── Profesorado automático (tutores, TIC y dirección) ────────────────────────

export interface EquiposCentro {
  /** Correos del profesorado que tutoriza cada clase, por curso y letra. */
  tutorias: { curso: string; letra: string | null; email: string }[];
  /** Correos de TIC (entran en todas las tutorías y en todas las clases de curso). */
  tic: string[];
  /** Correos de dirección y jefatura (entran en las clases de curso, si caben). */
  direccion: string[];
}

export interface ResumenProfes {
  clasesTocadas: number;
  anadidos: number;
  /** Personas que no han cabido por el límite de 12 instructores de ASM. */
  sinSitio: { clase: string; personas: string[] }[];
}

/**
 * Mete solos a quien tiene que estar en cada clase sin que nadie se acuerde en septiembre:
 *
 *  - en **todas las tutorías**, el equipo TIC;
 *  - en las clases de **curso entero** (todo 1º de ESO en un sitio), los tutores de ese
 *    nivel + TIC + dirección/jefatura.
 *
 * ASM admite **12 instructores por clase**. Si no caben, se recorta por el final y el
 * orden de sacrificio es el que pidió David: primero dirección y jefatura, **TIC nunca**.
 */
export function profesAutomaticos(
  archivos: Archivos,
  tipos: Record<string, TipoClase>,
  equipos: EquiposCentro,
  archivados: readonly string[] = [],
): { archivos: Archivos; resumen: ResumenProfes } {
  const fuera = new Set(archivados);
  const idPorEmail = new Map(
    archivos.staff.filter((f) => !fuera.has(f.person_id)).map((f) => [(f.email_address ?? '').toLowerCase(), f.person_id]),
  );
  const aId = (email: string) => idPorEmail.get(email.trim().toLowerCase());
  // Un snapshot viejo (o un proyecto guardado antes de que existieran los equipos) no
  // tiene por qué traerlos: sin ellos esto no hace nada, pero no se cae.
  const tic = (equipos?.tic ?? []).map(aId).filter((x): x is string => !!x);
  const direccion = (equipos?.direccion ?? []).map(aId).filter((x): x is string => !!x);
  const cursoDe = new Map(archivos.courses.map((c) => [c.course_id, c.course_number]));

  const resumen: ResumenProfes = { clasesTocadas: 0, anadidos: 0, sinSitio: [] };

  const classes = archivos.classes.map((clase) => {
    const tipo = tipos[clase.class_id];
    if (tipo !== 'tutoria' && tipo !== 'curso') return clase;

    const actuales = CAMPOS_INSTRUCTOR.map((c) => clase[c]).filter((v) => v && !fuera.has(v));
    // Por orden de prioridad: quien ya estaba, los tutores del nivel, TIC y, al final,
    // dirección — que es lo primero que se cae si no caben todos.
    const tutores = tipo === 'curso' ? tutoresDelNivel(equipos, cursoDe.get(clase.course_id) ?? '').map(aId).filter((x): x is string => !!x) : [];
    const deseados = [...actuales, ...tutores, ...tic, ...(tipo === 'curso' ? direccion : [])];
    const unicos = [...new Set(deseados)];
    const dentro = unicos.slice(0, CAMPOS_INSTRUCTOR.length);
    const sobran = unicos.slice(CAMPOS_INSTRUCTOR.length);
    if (sobran.length > 0) resumen.sinSitio.push({ clase: clase.class_id, personas: sobran });

    const nuevos = dentro.filter((p) => !actuales.includes(p)).length;
    if (nuevos === 0 && dentro.length === actuales.length) return clase;
    resumen.clasesTocadas += 1;
    resumen.anadidos += nuevos;

    const copia = { ...clase };
    CAMPOS_INSTRUCTOR.forEach((campo, i) => { copia[campo] = dentro[i] ?? ''; });
    return copia;
  });

  return { archivos: { ...archivos, classes }, resumen };
}

/** Correos del profesorado que tutoriza alguna letra del nivel de este curso de ASM. */
function tutoresDelNivel(equipos: EquiposCentro, courseNumber: string): string[] {
  const nivel = cursoDeCourseNumber(courseNumber);
  if (!nivel) return [];
  return (equipos?.tutorias ?? []).filter((t) => t.curso === nivel.curso).map((t) => t.email);
}

// ─── Bajas ────────────────────────────────────────────────────────────────────

/**
 * Dar de baja de verdad: quita a la persona de los ficheros. Es lo único del módulo que
 * destruye algo — al desaparecer de la importación, ASM se lleva por delante la cuenta y
 * su iCloud —, así que la interfaz lo pide dos veces y por defecto se archiva, no se borra.
 */
export function darDeBaja(proyecto: ProyectoAsm, personId: string): ProyectoAsm {
  const archivos: Archivos = {
    ...proyecto.archivos,
    students: proyecto.archivos.students.filter((f) => f.person_id !== personId),
    staff: proyecto.archivos.staff.filter((f) => f.person_id !== personId),
    rosters: proyecto.archivos.rosters.filter((f) => f.student_id !== personId),
    classes: proyecto.archivos.classes.map((clase) => {
      if (!CAMPOS_INSTRUCTOR.some((c) => clase[c] === personId)) return clase;
      const quedan = CAMPOS_INSTRUCTOR.map((c) => clase[c]).filter((v) => v && v !== personId);
      const copia = { ...clase };
      CAMPOS_INSTRUCTOR.forEach((campo, i) => { copia[campo] = quedan[i] ?? ''; });
      return copia;
    }),
  };
  return {
    ...proyecto,
    archivos: limpiarArchivos(archivos, proyecto.archivados),
    archivados: proyecto.archivados.filter((p) => p !== personId),
    compartidas: proyecto.compartidas.filter((p) => p !== personId),
    actualizado: new Date().toISOString(),
  };
}

/** Estadísticas rápidas para las tarjetas de la portada. */
export function resumenArchivos(archivos: Archivos): { archivo: ArchivoAsm; filas: number; titulo: string; fichero: string }[] {
  return ORDEN_ARCHIVOS.map((a) => ({ archivo: a, filas: archivos[a].length, titulo: ESPEC[a].titulo, fichero: ESPEC[a].fichero }));
}
