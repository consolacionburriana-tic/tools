// Capa de servidor de la ficha de alumnado: todo lo que toca Neon.
// Ficha del módulo: docs/21-alumnado.md
//
// El módulo es **solo lectura y transversal**: no tiene tablas propias. Lee `edu_*` como
// fuente de verdad de la identidad y va a preguntar a cada módulo por «lo suyo» de ese
// alumno. Ese es todo su trabajo, y por eso no duplica ni un campo (ver la deuda que
// documenta `docs/06-fuente-unica-alumnado.md`: aquí no se repite ese error).
//
// Dos consultas y ya: `listaAlumnado()` trae el centro entero en plan ligero (639 filas, lo
// que cabe de sobra en el navegador y hace que buscar sea instantáneo y sin red), y
// `fichaAlumno()` trae TODO lo de una persona en un solo viaje.
import { and, desc, eq, ilike, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  abcBehaviorReports,
  abcStudents,
  blAsignaciones,
  blLibroRegistros,
  blLibrosCurso,
  blLotes,
  conConsequences,
  cuadNumeracion,
  eduGuardians,
  eduStudentGuardians,
  eduStudents,
  eduTeachers,
  eduTutorPersonal,
  eduTutorias,
  horApoyos,
  licBooks,
  licCampaigns,
  licOrderItems,
  licOrders,
  licStudents,
  punRecords,
  salSignups,
  salTrips,
} from '@/db/schema';
import { academicYearActual } from '@/lib/constants';
import { compararClases, etapaDeCurso, type Etapa } from '@/lib/cursos';
import { correoBonito, mayusculasBellas, nombresDe } from '@/lib/personas';
import {
  claseLarga,
  delExtra,
  domicilio,
  indiceDeBusqueda,
  normalizar,
  siNo,
  type ValorDomicilio,
} from '@/lib/alumnado';
import { canAccess, type Role } from '@/lib/permissions';
import { clasesDeTutor } from '@/lib/puntualidad-server';

export { academicYearActual };

// ─── Alcance (quién ve a quién) ───────────────────────────────────────────────

/** Roles que ven el centro entero, sin mirar de qué etapa son. */
const VE_TODO: readonly Role[] = ['direccion', 'jefe', 'orientacion', 'secretaria', 'tic', 'supertic'];

export interface AlcanceAlumnado {
  /** Clases que puede consultar, o `null` = todo el centro. */
  clases: { curso: string; letra: string | null }[] | null;
  /** Sus tutorías: es lo que la pantalla trae preseleccionado al entrar. */
  propias: { curso: string; letra: string | null }[];
  /** Etapas que alcanza. Vacío con `clases: null` (las alcanza todas). */
  etapas: Etapa[];
}

/**
 * Quién ve a quién. El criterio es **la etapa**, no la tutoría (decisión de David,
 * 10-sep-2026): un tutor de 1º de ESO puede consultar a cualquier alumno de Secundaria,
 * porque a diario le hacen falta datos de alumnado que no es el suyo —una guardia, una
 * salida, un correo a una familia de otra clase—, y tener que pedírselo a otro tutor no
 * protege nada. Lo que **no** cruza es la etapa: quien lleva Infantil no tiene por qué ver
 * las fichas de la ESO.
 *
 * Ojo: esto es MÁS ancho que el alcance de Puntualidad (que sigue siendo por tutoría), y es
 * a propósito. Allí se registran y se corrigen datos de un alumno; aquí solo se consultan.
 *
 * La etapa sale de `edu_teachers.etapa` y, si está en blanco, de las etapas de sus tutorías
 * de este curso (hoy hay 10 profes activos sin etapa asignada, y uno de ellos con tutoría).
 * Sin ninguna de las dos cosas no se ve nada: es la respuesta segura, y la pantalla lo dice.
 */
export async function alcanceAlumnado(
  user: { email: string; role: Role | null },
  opciones: { conPropias?: boolean } = {},
): Promise<AlcanceAlumnado> {
  const conPropias = opciones.conPropias !== false;
  const veTodo = Boolean(user.role && VE_TODO.includes(user.role));

  // Quien lo ve todo y no necesita saber sus tutorías (la ruta API, que solo comprueba
  // permiso) se ahorra las dos consultas enteras.
  if (veTodo && !conPropias) return { clases: null, propias: [], etapas: [] };

  // Las tutorías y la etapa de su ficha son independientes: van a la vez, no encadenadas.
  const [propias, profes] = await Promise.all([
    conPropias || !veTodo ? clasesDeTutor(user.email) : Promise.resolve([]),
    veTodo
      ? Promise.resolve([])
      : db.select({ etapa: eduTeachers.etapa }).from(eduTeachers).where(ilike(eduTeachers.email, user.email)).limit(1),
  ]);
  if (veTodo) return { clases: null, propias, etapas: [] };

  const etapas = [
    ...new Set(
      [profes[0]?.etapa, ...propias.map((c) => etapaDeCurso(c.curso))].filter((e): e is Etapa =>
        e === 'EI' || e === 'EP' || e === 'ESO',
      ),
    ),
  ];
  if (etapas.length === 0) return { clases: [], propias, etapas };

  const clases = await db
    .selectDistinct({ curso: eduStudents.curso, letra: eduStudents.letra })
    .from(eduStudents)
    .where(eq(eduStudents.active, true));

  return {
    clases: clases
      .filter((c): c is { curso: string; letra: string | null } => Boolean(c.curso))
      .filter((c) => {
        const etapa = etapaDeCurso(c.curso);
        return etapa !== null && etapas.includes(etapa);
      }),
    propias,
    etapas,
  };
}

const mismaClase = (a: { curso: string | null; letra: string | null }, b: { curso: string; letra: string | null }) =>
  a.curso === b.curso && (a.letra ?? null) === (b.letra ?? null);

/** ¿Puede ver la ficha de este alumno? */
export function puedeConAlumno(
  clases: { curso: string; letra: string | null }[] | null,
  alumno: { curso: string | null; letra: string | null },
): boolean {
  if (clases === null) return true;
  return clases.some((c) => mismaClase(alumno, c));
}

// ─── El listado ───────────────────────────────────────────────────────────────

export interface AlumnoLista {
  id: string;
  nombre: string;
  apellidos: string;
  /** «Aitana Pitarch Roldán», ya con las mayúsculas arregladas. */
  completo: string;
  curso: string;
  letra: string | null;
  clase: string;
  etapa: Etapa | null;
  numero: number | null;
  nia: string | null;
  /** Texto normalizado para el buscador del navegador (ver `casaBusqueda`). */
  busca: string;
  /** Lo que se pinta como distintivo en la fila, sin abrir la ficha. */
  bancoLibros: boolean;
  ampa: boolean;
  /** `true` = tiene el pedido de licencias hecho; `false` = le toca y no lo tiene; null = no le toca. */
  pedidoHecho: boolean | null;
}

export interface ClaseListado {
  curso: string;
  letra: string | null;
  clase: string;
  etapa: Etapa | null;
  alumnos: number;
  tutores: string[];
}

/**
 * El centro entero (o lo que alcance quien pregunta) en plan ligero: lo justo para pintar
 * la lista, buscar y decidir a quién se abre. Va en el HTML de la página, así que buscar no
 * cuesta ni una petición.
 */
export async function listaAlumnado(
  alcance: { curso: string; letra: string | null }[] | null,
  academicYear = academicYearActual(),
): Promise<{ alumnos: AlumnoLista[]; clases: ClaseListado[] }> {
  // UNA sola tanda: `estadoPedidos` ya no espera a saber cuál es la campaña activa, la
  // resuelve con una subconsulta. Con ~127 ms por viaje a Neon, quitar la espera previa vale
  // tanto como optimizar cualquiera de las consultas.
  const [filas, numeros, pedidos, tutorias, profes] = await Promise.all([
    db
      .select({
        id: eduStudents.id,
        nombre: eduStudents.nombre,
        apellido1: eduStudents.apellido1,
        apellido2: eduStudents.apellido2,
        curso: eduStudents.curso,
        letra: eduStudents.letra,
        nia: eduStudents.nia,
        dni: eduStudents.dni,
        codigo: eduStudents.codigo,
        bancoLibros: eduStudents.bancoLibros,
        ampa: eduStudents.ampa,
      })
      .from(eduStudents)
      .where(eq(eduStudents.active, true)),
    db
      .select({ eduStudentId: cuadNumeracion.eduStudentId, numero: cuadNumeracion.numero })
      .from(cuadNumeracion)
      .where(eq(cuadNumeracion.academicYear, academicYear)),
    estadoPedidos(),
    db.select().from(eduTutorias).where(eq(eduTutorias.academicYear, academicYear)),
    // Solo lo que hace falta para el nombre corto del tutor: `select()` entero traía las 26
    // columnas de cada profe (con su `extra`) para pintar «María R».
    db
      .select({
        id: eduTeachers.id,
        nombre: eduTeachers.nombre,
        nombreMostrado: eduTeachers.nombreMostrado,
        apellido1: eduTeachers.apellido1,
        apellido2: eduTeachers.apellido2,
      })
      .from(eduTeachers),
  ]);

  const numeroPorAlumno = new Map(numeros.map((n) => [n.eduStudentId, n.numero]));
  const profePorId = new Map(profes.map((p) => [p.id, p]));

  const alumnos: AlumnoLista[] = [];
  for (const f of filas) {
    if (!f.curso) continue;
    if (!puedeConAlumno(alcance, f)) continue;
    const suyo = nombresDe(f);
    const clase = claseLarga(f.curso, f.letra);
    alumnos.push({
      id: f.id,
      nombre: suyo.pila,
      apellidos: suyo.apellidos,
      completo: suyo.usual,
      curso: f.curso,
      letra: f.letra,
      clase,
      etapa: etapaDeCurso(f.curso),
      numero: numeroPorAlumno.get(f.id) ?? null,
      nia: f.nia,
      busca: indiceDeBusqueda({
        nombre: suyo.pila,
        apellido1: mayusculasBellas(f.apellido1),
        apellido2: mayusculasBellas(f.apellido2),
        clase,
        nia: f.nia,
        dni: f.dni,
        codigo: f.codigo,
      }),
      bancoLibros: f.bancoLibros,
      ampa: f.ampa,
      pedidoHecho: pedidos.has(f.id) ? pedidos.get(f.id)! : null,
    });
  }

  // Orden de la lista: por clase y, dentro, por nº de lista si lo hay (que es como el tutor
  // la tiene en la cabeza) y si no, alfabético por apellidos.
  alumnos.sort(
    (a, b) =>
      compararClases({ curso: a.curso, letra: a.letra }, { curso: b.curso, letra: b.letra }) ||
      (a.numero ?? 999) - (b.numero ?? 999) ||
      a.apellidos.localeCompare(b.apellidos, 'es', { sensitivity: 'base' }),
  );

  const clases = new Map<string, ClaseListado>();
  for (const a of alumnos) {
    const clave = `${a.curso}|${a.letra ?? ''}`;
    let clase = clases.get(clave);
    if (!clase) {
      clase = {
        curso: a.curso,
        letra: a.letra,
        clase: a.clase,
        etapa: a.etapa,
        alumnos: 0,
        tutores: tutorias
          .filter((t) => t.curso === a.curso && (t.letra ?? '') === (a.letra ?? ''))
          .map((t) => profePorId.get(t.eduTeacherId))
          .filter((p): p is NonNullable<typeof p> => Boolean(p))
          .map((p) => nombresDe(p).corto)
          .sort((x, y) => x.localeCompare(y, 'es')),
      };
      clases.set(clave, clase);
    }
    clase.alumnos++;
  }

  return {
    alumnos,
    clases: [...clases.values()].sort((a, b) => compararClases(a, b)),
  };
}

// ─── Licencias: ¿tiene el pedido hecho? ───────────────────────────────────────


/**
 * `edu_student_id` → ¿tiene pedido confirmado? Solo entran los alumnos que **participan en
 * la campaña** (`lic_students`): a quien no le toca pedir licencias no se le puede pintar un
 * «pendiente» que no significa nada. Un alumno marcado a mano como completado (PDC, p. ej.)
 * cuenta como hecho, igual que en el panel de Licencias.
 *
 * La campaña activa va como subconsulta para no gastar un viaje a Neon en averiguarla.
 */
async function estadoPedidos(): Promise<Map<string, boolean>> {
  const campanaId = db
    .select({ id: licCampaigns.id })
    .from(licCampaigns)
    .orderBy(desc(licCampaigns.createdAt))
    .limit(1);

  const filas = await db
    .select({
      eduStudentId: licStudents.eduStudentId,
      manualCompletedAt: licStudents.manualCompletedAt,
      orderId: licOrders.id,
    })
    .from(licStudents)
    .leftJoin(licOrders, and(eq(licOrders.studentId, licStudents.id), eq(licOrders.archived, false)))
    .where(and(inArray(licStudents.campaignId, campanaId), eq(licStudents.active, true)));

  const mapa = new Map<string, boolean>();
  for (const f of filas) {
    if (!f.eduStudentId) continue;
    const hecho = Boolean(f.orderId) || Boolean(f.manualCompletedAt);
    // Si por lo que sea hubiera dos filas, manda la que dice que sí.
    mapa.set(f.eduStudentId, (mapa.get(f.eduStudentId) ?? false) || hecho);
  }
  return mapa;
}

// ─── La ficha completa ────────────────────────────────────────────────────────

export interface FamiliarFicha {
  id: string;
  nombre: string;
  parentesco: string | null;
  orden: number | null;
  /** Teléfonos en bruto, en orden de preferencia (personal, trabajo, casa). */
  telefonos: { etiqueta: string; valor: string }[];
  correos: string[];
  dni: string | null;
  /** Cuidado: Educamos marca al tutor fallecido. No se ofrece como contacto. */
  fallecido: boolean;
  guardaCustodia: boolean | null;
  recibeInformacion: boolean | null;
  domicilio: ValorDomicilio | null;
}

export interface HermanoFicha {
  id: string;
  completo: string;
  clase: string;
  curso: string;
  letra: string | null;
}

export interface FichaAlumno {
  id: string;
  // Identidad
  nombre: string;
  apellidos: string;
  completo: string;
  /** Como lo escribe Educamos, por si hace falta el nombre legal entero. */
  legal: string;
  sexo: string | null;
  fechaNacimiento: string | null;
  curso: string;
  letra: string | null;
  clase: string;
  etapa: Etapa | null;
  numero: number | null;
  tutores: { nombre: string; email: string | null }[];
  tutorPersonal: string | null;
  // Identificadores (todos copiables)
  nia: string | null;
  dni: string | null;
  codigo: string | null;
  matricula: string | null;
  familiaId: string | null;
  tarjetaSanitaria: string | null;
  // Contacto propio
  email: string | null;
  emailGoogle: string | null;
  moviles: string[];
  telEmergencia: string | null;
  // Nacimiento y nacionalidad
  lugarNacimiento: string | null;
  provinciaNacimiento: string | null;
  paisNacimiento: string | null;
  nacionalidad: string | null;
  // Banderitas
  bancoLibros: boolean;
  ampa: boolean;
  familiaNumerosa: boolean | null;
  hijoDeEmpleado: boolean | null;
  // Familia
  familiares: FamiliarFicha[];
  hermanos: HermanoFicha[];
  domicilio: ValorDomicilio | null;
  // Módulos
  licencias: {
    campana: string;
    participa: boolean;
    pedidoHecho: boolean;
    manual: string | null;
    confirmadoAt: string | null;
    total: string | null;
    pagadoAt: string | null;
    libros: { cod: string; nombre: string | null; asignatura: string | null; banco: boolean }[];
  } | null;
  banco: {
    lote: string;
    entregado: boolean;
    docInicio: boolean;
    docFin: boolean;
    notas: string | null;
    libros: { nombre: string; estado: string | null; borrado: boolean; forrado: boolean; notas: string | null }[];
  } | null;
  puntualidad: {
    retrasos: number;
    minutosTotales: number;
    justificados: number;
    ultimo: string | null;
    consecuenciasPendientes: number;
  } | null;
  salidas: { nombre: string; fecha: string | null; estado: string; justificante: string | null }[];
  abc: { informes: number; ultimo: string | null };
  apoyos: { modalidad: string; notas: string | null }[];
  /** Lo que trae el export y esta ficha no coloca en ningún sitio, por si hace falta mirarlo. */
  extraSinColocar: { clave: string; valor: string }[];
}

/** Claves del `extra` que la ficha ya pinta en su sitio, o que no dicen nada útil. */
const EXTRA_YA_COLOCADO = [
  'tarjeta sanitaria',
  'tel emergencia alumno',
  'lugar de nacimiento',
  'localidad de nacimiento',
  'provincia nacimiento',
  'pais nacimiento',
  'nacionalidad alumno',
  'fam numerosa',
  'eshijodeempleado',
  // Ruido comprobado contra los 639 activos: `Nº HIJOS` es 0 en todos y `ACCESO PLATAFORMA`
  // es TRUE en 638 de 639. Enseñarlos solo gasta sitio.
  'n hijos',
  'acceso plataforma alumno',
  'cod ine lugar de nacimiento',
  'fecha alta',
  // Los «… SMS» son banderitas de si Educamos manda SMS a ese número, no teléfonos.
  'sms movil1',
  'sms movil2',
  'tel personal tutor1 sms',
  'tel personal tutor2 sms',
  'movil trabajo t1 sms',
  'movil trabajo t2 sms',
  'movil trabajo t1',
  'movil trabajo t2',
];

/**
 * TODO lo que sabemos de un alumno, en un solo viaje a Neon. Devuelve null si no existe.
 *
 * Cada bloque de módulo es independiente y tolerante: un módulo sin datos (hoy Puntualidad
 * está a cero porque el curso acaba de empezar) devuelve null o lista vacía, y la pantalla
 * lo dice en una línea en vez de pintar una tarjeta vacía.
 */
export async function fichaAlumno(id: string, academicYear = academicYearActual()): Promise<FichaAlumno | null> {
  // TODO en una sola tanda de viajes a Neon. Lo que dependía del alumno (sus hermanos, las
  // tutorías de su curso) se resuelve con una SUBCONSULTA en vez de esperar a tenerlo: cada
  // viaje cuesta ~127 ms, así que cada tanda encadenada se nota en el dedo.
  const suCurso = db.select({ curso: eduStudents.curso }).from(eduStudents).where(eq(eduStudents.id, id));
  const suFamilia = db.select({ familiaId: eduStudents.familiaId }).from(eduStudents).where(eq(eduStudents.id, id));

  const [
    alumnoFila,
    vinculos,
    numero,
    tutorias,
    profes,
    personal,
    hermanos,
    licencias,
    banco,
    retrasos,
    consecuencias,
    salidas,
    abc,
    apoyos,
  ] = await Promise.all([
    db.select().from(eduStudents).where(eq(eduStudents.id, id)).limit(1),
    db
      .select({ rel: eduStudentGuardians, familiar: eduGuardians })
      .from(eduStudentGuardians)
      .innerJoin(eduGuardians, eq(eduStudentGuardians.guardianId, eduGuardians.id))
      .where(eq(eduStudentGuardians.studentId, id)),
    db
      .select({ numero: cuadNumeracion.numero })
      .from(cuadNumeracion)
      .where(and(eq(cuadNumeracion.eduStudentId, id), eq(cuadNumeracion.academicYear, academicYear)))
      .limit(1),
    db
      .select()
      .from(eduTutorias)
      .where(and(eq(eduTutorias.academicYear, academicYear), inArray(eduTutorias.curso, suCurso))),
    // Solo las columnas del nombre y el correo. `select()` entero traía el `extra` de los 97
    // profes y costaba 357 ms él solo, contra 128 ms así: era la mitad del tiempo de la ficha.
    db
      .select({
        id: eduTeachers.id,
        nombre: eduTeachers.nombre,
        nombreMostrado: eduTeachers.nombreMostrado,
        apellido1: eduTeachers.apellido1,
        apellido2: eduTeachers.apellido2,
        email: eduTeachers.email,
        emailOtro: eduTeachers.emailOtro,
      })
      .from(eduTeachers),
    db
      .select({ eduTeacherId: eduTutorPersonal.eduTeacherId })
      .from(eduTutorPersonal)
      .where(and(eq(eduTutorPersonal.eduStudentId, id), eq(eduTutorPersonal.academicYear, academicYear)))
      .limit(1),
    db
      .select({
        id: eduStudents.id,
        nombre: eduStudents.nombre,
        apellido1: eduStudents.apellido1,
        apellido2: eduStudents.apellido2,
        curso: eduStudents.curso,
        letra: eduStudents.letra,
      })
      .from(eduStudents)
      .where(and(inArray(eduStudents.familiaId, suFamilia), eq(eduStudents.active, true))),
    licenciasDeAlumno(id),
    bancoDeAlumno(id, academicYear),
    db
      .select({
        fecha: punRecords.fecha,
        minutos: punRecords.minutosRetraso,
        justificado: punRecords.justificado,
      })
      .from(punRecords)
      .where(and(eq(punRecords.eduStudentId, id), eq(punRecords.academicYear, academicYear)))
      .orderBy(desc(punRecords.fecha)),
    db
      .select({ cumplida: conConsequences.cumplida })
      .from(conConsequences)
      .where(and(eq(conConsequences.eduStudentId, id), eq(conConsequences.academicYear, academicYear))),
    db
      .select({
        nombre: salTrips.nombre,
        fecha: salTrips.fecha,
        estado: salSignups.estado,
        justificante: salSignups.justificanteEstado,
      })
      .from(salSignups)
      .innerJoin(salTrips, eq(salSignups.tripId, salTrips.id))
      .where(eq(salSignups.studentId, id))
      .orderBy(desc(salTrips.fecha)),
    db
      .select({ n: sql<number>`count(*)::int`, ultimo: sql<string | null>`max(${abcBehaviorReports.reportDate})` })
      .from(abcBehaviorReports)
      .innerJoin(abcStudents, eq(abcBehaviorReports.studentId, abcStudents.id))
      .where(eq(abcStudents.eduStudentId, id)),
    db
      .select({ modalidad: horApoyos.modalidad, notas: horApoyos.notas })
      .from(horApoyos)
      .where(and(eq(horApoyos.eduStudentId, id), eq(horApoyos.active, true))),
  ]);

  const alumno = alumnoFila[0];
  if (!alumno) return null;

  const suyo = nombresDe(alumno);
  const profePorId = new Map(profes.map((p) => [p.id, p]));
  const extra = alumno.extra ?? null;

  // El domicilio de la familia sale del `extra` del primer tutor legal que lo traiga: es un
  // dato de la casa, no de la persona, y solo está en uno de los dos.
  const familiares: FamiliarFicha[] = vinculos
    .map(({ rel, familiar }) => {
      const nombre = nombresDe(familiar).usual;
      const suExtra = familiar.extra ?? null;
      return {
        id: familiar.id,
        nombre,
        parentesco: familiar.sexo && !rel.parentesco ? null : rel.parentesco,
        orden: rel.orden,
        telefonos: [
          { etiqueta: 'Móvil', valor: familiar.telPersonal ?? '' },
          { etiqueta: 'Trabajo', valor: familiar.movilTrabajo ?? '' },
          { etiqueta: 'Casa', valor: familiar.telCasa ?? '' },
        ].filter((t) => t.valor.trim() !== ''),
        correos: [familiar.email, familiar.emailGoogle]
          .map((c) => correoBonito(c))
          .filter((c, i, todos) => c !== '' && todos.indexOf(c) === i),
        dni: familiar.dni,
        fallecido: siNo(delExtra(suExtra, 'fallecido')) === true,
        guardaCustodia: rel.guardaCustodia,
        recibeInformacion: rel.recibeInformacion,
        domicilio: domicilio(suExtra, {
          cp: familiar.cp,
          localidad: familiar.localidad,
          provincia: familiar.provincia,
        }),
      };
    })
    .sort((a, b) => (a.orden ?? 9) - (b.orden ?? 9) || a.nombre.localeCompare(b.nombre, 'es'));

  const sinCumplir = consecuencias.filter((c) => !c.cumplida).length;

  return {
    id: alumno.id,
    nombre: suyo.pila,
    apellidos: suyo.apellidos,
    completo: suyo.usual,
    legal: [alumno.nombre, alumno.apellido1, alumno.apellido2].filter(Boolean).join(' '),
    sexo: alumno.sexo,
    fechaNacimiento: alumno.fechaNacimiento,
    curso: alumno.curso ?? '',
    letra: alumno.letra,
    clase: claseLarga(alumno.curso, alumno.letra),
    etapa: etapaDeCurso(alumno.curso),
    numero: numero[0]?.numero ?? null,
    tutores: tutorias
      .filter((t) => (t.letra ?? '') === (alumno.letra ?? ''))
      .map((t) => profePorId.get(t.eduTeacherId))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => ({ nombre: nombresDe(p).usual, email: correoBonito(p.email ?? p.emailOtro) || null }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    tutorPersonal: personal[0]
      ? (profePorId.get(personal[0].eduTeacherId) ? nombresDe(profePorId.get(personal[0].eduTeacherId)!).usual : null)
      : null,
    nia: alumno.nia,
    dni: alumno.dni,
    codigo: alumno.codigo,
    matricula: alumno.matricula,
    familiaId: alumno.familiaId,
    tarjetaSanitaria: delExtra(extra, 'tarjeta sanitaria'),
    email: correoBonito(alumno.email) || null,
    emailGoogle: correoBonito(alumno.emailGoogle) || null,
    moviles: [alumno.movil1, alumno.movil2].filter((m): m is string => Boolean(m && m.trim())),
    // `edu_students.tel_emergencia` está a null en las 639 filas activas: el dato real vive
    // en el `extra` (511 de 639 lo traen). Se lee de los dos sitios, por si el sync cambia.
    telEmergencia: alumno.telEmergencia ?? delExtra(extra, 'tel emergencia alumno'),
    lugarNacimiento: delExtra(extra, 'lugar de nacimiento') ?? delExtra(extra, 'localidad de nacimiento'),
    provinciaNacimiento: delExtra(extra, 'provincia nacimiento'),
    paisNacimiento: delExtra(extra, 'pais nacimiento'),
    nacionalidad: delExtra(extra, 'nacionalidad alumno'),
    bancoLibros: alumno.bancoLibros,
    ampa: alumno.ampa,
    familiaNumerosa: siNo(delExtra(extra, 'fam numerosa')),
    hijoDeEmpleado: siNo(delExtra(extra, 'eshijodeempleado')),
    familiares,
    hermanos: hermanos
      .filter((h) => h.id !== id)
      .map((h) => ({
        id: h.id,
        completo: nombresDe(h).usual,
        clase: claseLarga(h.curso, h.letra),
        curso: h.curso ?? '',
        letra: h.letra,
      }))
      .sort((a, b) => compararClases({ curso: a.curso, letra: a.letra }, { curso: b.curso, letra: b.letra })),
    domicilio: familiares.find((f) => f.domicilio)?.domicilio ?? null,
    licencias,
    banco,
    puntualidad:
      retrasos.length === 0 && consecuencias.length === 0
        ? null
        : {
            retrasos: retrasos.length,
            minutosTotales: retrasos.reduce((n, r) => n + r.minutos, 0),
            justificados: retrasos.filter((r) => r.justificado).length,
            ultimo: retrasos[0]?.fecha ?? null,
            consecuenciasPendientes: sinCumplir,
          },
    salidas: salidas.map((s) => ({
      nombre: s.nombre,
      fecha: s.fecha,
      estado: s.estado,
      justificante: s.justificante,
    })),
    abc: { informes: abc[0]?.n ?? 0, ultimo: abc[0]?.ultimo ?? null },
    apoyos: apoyos.map((a) => ({ modalidad: a.modalidad, notas: a.notas })),
    extraSinColocar: Object.entries(extra ?? {})
      .filter(([clave, valor]) => {
        if (!valor || String(valor).trim() === '') return false;
        const n = normalizar(clave);
        return !EXTRA_YA_COLOCADO.some((y) => n.startsWith(y));
      })
      .map(([clave, valor]) => ({ clave, valor: String(valor) }))
      .sort((a, b) => a.clave.localeCompare(b.clave, 'es')),
  };
}

// ─── Bloques de módulo ────────────────────────────────────────────────────────

/**
 * Licencias del alumno en la campaña activa, **en una sola consulta**.
 *
 * Antes eran tres encadenadas (campaña → fila del alumno → líneas del pedido) y cada viaje a
 * Neon cuesta ~127 ms, así que la cadena sola valía ~380 ms de los ~515 de la ficha entera.
 * Ahora la campaña es una subconsulta y las líneas entran por `left join`: una fila por libro
 * del pedido, o una fila con el pedido vacío si aún no ha pedido, o ninguna si no participa.
 */
async function licenciasDeAlumno(id: string): Promise<FichaAlumno['licencias']> {
  const campanaId = db
    .select({ id: licCampaigns.id })
    .from(licCampaigns)
    .orderBy(desc(licCampaigns.createdAt))
    .limit(1);

  const filas = await db
    .select({
      campanaNombre: licCampaigns.name,
      campanaYear: licCampaigns.academicYear,
      manualAt: licStudents.manualCompletedAt,
      manualMotivo: licStudents.manualCompletedReason,
      ordenId: licOrders.id,
      confirmadoAt: licOrders.confirmedAt,
      total: licOrders.totalPrice,
      pagadoAt: licOrders.paidAt,
      cod: licOrderItems.bookCod,
      asignatura: licOrderItems.asignatura,
      banco: licOrderItems.isBancoLibros,
      nombreLibro: licBooks.nombreLibro,
    })
    .from(licStudents)
    .innerJoin(licCampaigns, eq(licCampaigns.id, licStudents.campaignId))
    .leftJoin(licOrders, and(eq(licOrders.studentId, licStudents.id), eq(licOrders.archived, false)))
    .leftJoin(licOrderItems, eq(licOrderItems.orderId, licOrders.id))
    .leftJoin(licBooks, and(eq(licBooks.cod, licOrderItems.bookCod), eq(licBooks.campaignId, licStudents.campaignId)))
    .where(and(eq(licStudents.eduStudentId, id), inArray(licStudents.campaignId, campanaId)));

  if (filas.length === 0) {
    // Puede ser que no participe en la campaña, o que no haya campaña ninguna. Para la ficha
    // es lo mismo: no se pinta el distintivo de licencias.
    const [campana] = await db
      .select({ name: licCampaigns.name, academicYear: licCampaigns.academicYear })
      .from(licCampaigns)
      .orderBy(desc(licCampaigns.createdAt))
      .limit(1);
    if (!campana) return null;
    return {
      campana: campana.name ?? campana.academicYear ?? 'Campaña',
      participa: false,
      pedidoHecho: false,
      manual: null,
      confirmadoAt: null,
      total: null,
      pagadoAt: null,
      libros: [],
    };
  }

  const cabecera = filas[0];
  return {
    campana: cabecera.campanaNombre ?? cabecera.campanaYear ?? 'Campaña',
    participa: true,
    pedidoHecho: Boolean(cabecera.ordenId) || Boolean(cabecera.manualAt),
    manual: cabecera.manualAt ? (cabecera.manualMotivo ?? 'Marcado como completado a mano') : null,
    confirmadoAt: cabecera.confirmadoAt ? cabecera.confirmadoAt.toISOString() : null,
    total: cabecera.total,
    pagadoAt: cabecera.pagadoAt ? cabecera.pagadoAt.toISOString() : null,
    // Si no hay pedido, el `left join` deja una fila con `cod` a null: no es un libro.
    // Un mismo COD repetido SÍ se deja: el pedido es el pedido, y esconder una línea sería
    // mentir sobre lo que se pidió.
    libros: filas
      .filter((f) => f.cod !== null)
      .map((f) => ({ cod: f.cod!, nombre: f.nombreLibro, asignatura: f.asignatura, banco: f.banco ?? false })),
  };
}

/**
 * El lote del banco de libros y su valoración, también **en una sola consulta**.
 *
 * El `book_cod` de cada registro puede ser un COD del catálogo de Licencias o un
 * `manual:<uuid>` de los libros dados de alta a mano en el banco (ver `bl_libros_curso`), así
 * que el nombre sale de dos `left join` distintos y se coge el que haya.
 */
async function bancoDeAlumno(id: string, academicYear: string): Promise<FichaAlumno['banco']> {
  const filas = await db
    .select({
      asignacionId: blAsignaciones.id,
      entregado: blAsignaciones.entregado,
      docInicio: blAsignaciones.docInicio,
      docFin: blAsignaciones.docFin,
      notasLote: blAsignaciones.notas,
      numero: blLotes.numero,
      bookCod: blLibroRegistros.bookCod,
      estado: blLibroRegistros.estado,
      borrado: blLibroRegistros.borrado,
      forrado: blLibroRegistros.forrado,
      notasLibro: blLibroRegistros.notas,
      nombreLic: licBooks.nombreLibro,
      nombreManual: blLibrosCurso.nombre,
    })
    .from(blAsignaciones)
    .innerJoin(blLotes, eq(blAsignaciones.loteId, blLotes.id))
    .leftJoin(blLibroRegistros, eq(blLibroRegistros.asignacionId, blAsignaciones.id))
    .leftJoin(licBooks, eq(licBooks.cod, blLibroRegistros.bookCod))
    .leftJoin(
      blLibrosCurso,
      sql`'manual:' || ${blLibrosCurso.id}::text = ${blLibroRegistros.bookCod}`,
    )
    .where(and(eq(blAsignaciones.studentId, id), eq(blAsignaciones.academicYear, academicYear)));

  if (filas.length === 0) return null;
  const cabecera = filas[0];
  return {
    lote: `${cabecera.numero}`,
    entregado: cabecera.entregado,
    docInicio: cabecera.docInicio,
    docFin: cabecera.docFin,
    notas: cabecera.notasLote,
    libros: filas
      .filter((f) => f.bookCod !== null)
      .map((f) => ({
        nombre: f.nombreLic ?? f.nombreManual ?? f.bookCod!,
        estado: f.estado,
        borrado: f.borrado ?? true,
        forrado: f.forrado ?? true,
        notas: f.notasLibro,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
  };
}

/** ¿Tiene esta persona acceso al módulo? Envoltorio para el layout de la sección. */
export const puedeVerAlumnado = (user: Parameters<typeof canAccess>[0]) => canAccess(user, 'alumnado');
