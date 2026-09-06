// AUTOASM · de las asignaciones docentes del horario a las clases de Apple School Manager.
//
// Es la pieza que David pedía: **una asignación del horario ES una clase de ASM**. La
// materia da el nombre, `hor_asignacion_profes` da los instructores y
// `hor_asignacion_grupos` dice quién se matricula — así, cuando Música de 3º PDC va con la
// de 3º A, la clase sale conjunta sola, y el año que Inglés deje de serlo, se parte sola.
//
// Dos cautelas, que son la razón de que esto sea una PROPUESTA y no una aplicación directa:
//
//   1. **Nunca se toca el `class_id` ni el `course_id` de una clase que ya existe.** Si
//      cambian, ASM no renombra: crea otra clase y pierdes el histórico. De una clase ya
//      emparejada solo se actualizan los profes y quién se matricula.
//   2. El emparejamiento asignación ↔ clase se **recuerda** en el proyecto
//      (`ProyectoAsm.horario`), para que el año que viene no haya que volver a adivinarlo.

import { CAMPOS_INSTRUCTOR, cabecerasDe, gradeLevelDe, slugPersona, type Archivos, type FilaCsv } from '@/lib/autoasm';
import { cursoDeCourseNumber, type ProyectoAsm } from '@/lib/autoasm-construir';

export interface GrupoHorario {
  curso: string;
  letra: string | null;
  /** Desdoble: media clase. No se puede matricular sola desde aquí. */
  subgrupo: string | null;
}

export interface AsignacionHorario {
  id: string;
  materia: string;
  abreviatura: string | null;
  grupos: GrupoHorario[];
  /** Correos del profesorado, el titular primero. */
  profes: string[];
}

export type EstadoPropuesta = 'nueva' | 'actualiza' | 'igual';

export interface PropuestaClase {
  asignacionId: string;
  classId: string;
  className: string;
  courseId: string;
  estado: EstadoPropuesta;
  /** `grade_level` que se matriculan (vacío si es un desdoble y no se puede saber). */
  grupos: string[];
  instructores: string[];
  /** Qué cambia respecto a lo que hay hoy, en cristiano. */
  cambios: string[];
  /** Motivo por el que no se puede aplicar del todo (desdoble, profe sin cuenta…). */
  avisos: string[];
}

export interface ResultadoHorario {
  propuestas: PropuestaClase[];
  /** Clases del proyecto que el horario no menciona (no se tocan, solo se avisan). */
  clasesSinHorario: string[];
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Código de curso de ASM para un grupo del horario: 1ESO + A → `ESO1A`. */
function courseNumberDe(grupo: GrupoHorario): string {
  const curso = grupo.curso.toUpperCase().replace(/\s|º/g, '');
  const letra = (grupo.letra ?? '').toUpperCase();
  const pdc = curso.match(/^(\d)P?PDC$/);
  if (pdc) return `ESO${pdc[1]}PDC`;
  const eso = curso.match(/^(\d)ESO$/);
  if (eso) return letra === 'PDC' ? `ESO${eso[1]}PDC` : `ESO${eso[1]}${letra}`;
  const pri = curso.match(/^(\d)PRI$/);
  if (pri) return `EP${pri[1]}${letra}`;
  const inf = curso.match(/^(\d)INF$/);
  if (inf) return `EI${Number(inf[1]) - 2}${letra}`;
  return `${curso}${letra}`;
}

/**
 * Propone las clases que salen del horario y las compara con las del proyecto. No cambia
 * nada: devuelve qué se crearía y qué se actualizaría para que se pueda mirar antes.
 */
export function proponerDesdeHorario(proyecto: ProyectoAsm, asignaciones: AsignacionHorario[]): ResultadoHorario {
  const { archivos } = proyecto;
  const idPorEmail = new Map(archivos.staff.map((f) => [(f.email_address ?? '').toLowerCase(), f.person_id]));
  const claseporId = new Map(archivos.classes.map((c) => [c.class_id, c]));
  const courseIdPorNumber = new Map(archivos.courses.map((c) => [c.course_number.toUpperCase(), c.course_id]));
  const cursoDeClase = new Map(archivos.classes.map((c) => [c.class_id, c.course_id]));
  const numberDeCurso = new Map(archivos.courses.map((c) => [c.course_id, c.course_number.toUpperCase()]));
  const idsUsados = new Set(archivos.classes.map((c) => c.class_id));
  const emparejadas = new Set<string>();

  const propuestas = asignaciones
    .filter((a) => a.materia && a.grupos.length > 0)
    .map((asignacion) => proponer(asignacion));

  return {
    propuestas,
    clasesSinHorario: archivos.classes
      .map((c) => c.class_id)
      .filter((id) => !emparejadas.has(id)),
  };

  function proponer(asignacion: AsignacionHorario): PropuestaClase {
    const avisos: string[] = [];
    const cambios: string[] = [];

    const instructores = asignacion.profes
      .map((email) => {
        const id = idPorEmail.get(email.trim().toLowerCase());
        if (!id) avisos.push(`Sin cuenta en staff.csv: ${email}`);
        return id;
      })
      .filter((x): x is string => !!x)
      .slice(0, CAMPOS_INSTRUCTOR.length);

    const desdoble = asignacion.grupos.some((g) => g.subgrupo);
    if (desdoble) avisos.push('Es un desdoble: las matrículas hay que repasarlas a mano.');
    const grupos = desdoble ? [] : [...new Set(asignacion.grupos.map((g) => gradeLevelDe(g.curso, g.letra)))].sort((a, b) => a.localeCompare(b, 'es'));

    const existente = buscarClase(asignacion);
    if (existente) {
      emparejadas.add(existente.class_id);
      const profesAhora = CAMPOS_INSTRUCTOR.map((c) => existente[c]).filter(Boolean);
      // Si el horario no trae profes (un hueco del fichero, una asignación a medio meter),
      // NO se vacía la clase: se queda con los que tenía y se avisa. Un fallo de datos no
      // puede dejar sin profesor a una clase que funciona.
      if (instructores.length === 0 && profesAhora.length > 0) {
        avisos.push('El horario no trae profesorado para esta clase: se quedan los que ya tenía.');
        instructores.push(...profesAhora);
      }
      if (profesAhora.join('|') !== instructores.join('|')) {
        cambios.push(`Profes: ${profesAhora.length === 0 ? 'ninguno' : profesAhora.join(', ')} → ${instructores.join(', ') || 'ninguno'}`);
      }
      const reglaAhora = proyecto.reglas[existente.class_id] ?? [];
      if (!desdoble && reglaAhora.join('|') !== grupos.join('|')) {
        cambios.push(`Quién se matricula: ${reglaAhora.join(', ') || '—'} → ${grupos.join(', ')}`);
      }
      if (normalizar(existente.class_number) !== normalizar(asignacion.materia)) {
        avisos.push(`En ASM se llama "${existente.class_number}" y en el horario "${asignacion.materia}" (se respeta el de ASM).`);
      }
      return {
        asignacionId: asignacion.id,
        classId: existente.class_id,
        className: existente.class_number,
        courseId: existente.course_id,
        estado: cambios.length > 0 ? 'actualiza' : 'igual',
        grupos,
        instructores,
        cambios,
        avisos,
      };
    }

    const courseId = elegirCurso(asignacion);
    if (!courseId) avisos.push('No hay curso en ASM para ese grupo: se creará junto a la clase.');
    const classId = nuevoClassId(asignacion);
    cambios.push(`Clase nueva con ${instructores.length} profe(s)${grupos.length > 0 ? ` y ${grupos.join(', ')}` : ''}`);
    return {
      asignacionId: asignacion.id,
      classId,
      className: asignacion.materia,
      courseId: courseId ?? '',
      estado: 'nueva',
      grupos,
      instructores,
      cambios,
      avisos,
    };
  }

  function buscarClase(asignacion: AsignacionHorario): FilaCsv | undefined {
    // 1. El emparejamiento que ya se hizo otro año.
    const recordada = proyecto.horario?.[asignacion.id];
    if (recordada && claseporId.has(recordada)) return claseporId.get(recordada);

    // 2. Misma materia y mismo curso de ASM: `Cls-MatESO1A` para Matemáticas de 1ESO A.
    const materia = normalizar(asignacion.materia);
    const numeros = new Set(asignacion.grupos.map(courseNumberDe));
    const candidatas = archivos.classes.filter((clase) => {
      const numero = numberDeCurso.get(cursoDeClase.get(clase.class_id) ?? '') ?? '';
      return numeros.has(numero) && normalizar(clase.class_number) === materia;
    });
    if (candidatas.length === 1) return candidatas[0];

    // 3. Una clase que ya lleve exactamente esos grupos con ese nombre (optativas de nivel).
    const grupos = [...new Set(asignacion.grupos.map((g) => gradeLevelDe(g.curso, g.letra)))].sort().join('|');
    return archivos.classes.find(
      (clase) => normalizar(clase.class_number) === materia && (proyecto.reglas[clase.class_id] ?? []).slice().sort().join('|') === grupos,
    );
  }

  function elegirCurso(asignacion: AsignacionHorario): string | null {
    const numeros = asignacion.grupos.map(courseNumberDe);
    if (numeros.length > 1) {
      // Varios grupos del mismo nivel → el curso de nivel entero, si existe (`ESO1`).
      const nivel = cursoDeCourseNumber(numeros[0]);
      const todosDelMismo = numeros.every((n) => cursoDeCourseNumber(n)?.curso === nivel?.curso);
      const numeroNivel = nivel ? courseNumberDe({ curso: nivel.curso, letra: null, subgrupo: null }) : '';
      if (todosDelMismo && courseIdPorNumber.has(numeroNivel)) return courseIdPorNumber.get(numeroNivel)!;
    }
    return courseIdPorNumber.get(numeros[0]) ?? null;
  }

  function nuevoClassId(asignacion: AsignacionHorario): string {
    const abrev = (asignacion.abreviatura ?? asignacion.materia).slice(0, 6);
    const base = `Cls-${slugPersona(abrev).replace(/^./, (c) => c.toUpperCase())}${courseNumberDe(asignacion.grupos[0])}`;
    let id = base;
    let n = 2;
    while (idsUsados.has(id)) id = `${base}${n++}`;
    idsUsados.add(id);
    return id;
  }
}

/**
 * Aplica las propuestas elegidas: actualiza profes y reglas de las clases que ya existen,
 * crea las nuevas (con su curso si hiciera falta) y recuerda el emparejamiento.
 */
export function aplicarPropuestas(proyecto: ProyectoAsm, propuestas: PropuestaClase[]): ProyectoAsm {
  const { locationId } = proyecto.opciones;
  const archivos: Archivos = { ...proyecto.archivos, classes: [...proyecto.archivos.classes], courses: [...proyecto.archivos.courses] };
  const reglas = { ...proyecto.reglas };
  const tipos = { ...proyecto.tipos };
  const horario = { ...(proyecto.horario ?? {}) };
  const porId = new Map(archivos.classes.map((c, i) => [c.class_id, i]));

  for (const propuesta of propuestas) {
    horario[propuesta.asignacionId] = propuesta.classId;
    const indice = porId.get(propuesta.classId);

    if (indice === undefined) {
      const valores: FilaCsv = {
        class_id: propuesta.classId,
        class_number: propuesta.className,
        course_id: propuesta.courseId,
        location_id: locationId,
        ...Object.fromEntries(CAMPOS_INSTRUCTOR.map((campo, i) => [campo, propuesta.instructores[i] ?? ''])),
      };
      // La fila lleva SIEMPRE todas las columnas del fichero, en el orden de la especificación.
      archivos.classes.push(Object.fromEntries(cabecerasDe('classes').map((campo) => [campo, valores[campo] ?? ''])));
      porId.set(propuesta.classId, archivos.classes.length - 1);
      tipos[propuesta.classId] = 'asignatura';
    } else {
      const copia = { ...archivos.classes[indice] };
      CAMPOS_INSTRUCTOR.forEach((campo, i) => { copia[campo] = propuesta.instructores[i] ?? ''; });
      archivos.classes[indice] = copia;
    }
    if (propuesta.grupos.length > 0) reglas[propuesta.classId] = propuesta.grupos;
  }

  return { ...proyecto, archivos, reglas, tipos, horario, actualizado: new Date().toISOString() };
}
