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
export async function alcanceAlumnado(user: {
  email: string;
  role: Role | null;
}): Promise<AlcanceAlumnado> {
  const propias = await clasesDeTutor(user.email);
  if (user.role && VE_TODO.includes(user.role)) return { clases: null, propias, etapas: [] };

  const [profe] = await db
    .select({ etapa: eduTeachers.etapa })
    .from(eduTeachers)
    .where(ilike(eduTeachers.email, user.email))
    .limit(1);

  const etapas = [
    ...new Set(
      [profe?.etapa, ...propias.map((c) => etapaDeCurso(c.curso))].filter((e): e is Etapa =>
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
  // La campaña se pide primero porque `estadoPedidos` la necesita; el resto va en paralelo,
  // así que son DOS viajes a Neon en vez de una cadena de seis. Con 639 alumnos la
  // diferencia son ~2 s → ~0,6 s, que es lo que separa «va rápido» de «se nota».
  const campana = await campanaActiva();
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
    campana ? estadoPedidos(campana.id) : Promise.resolve(new Map<string, boolean>()),
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

async function campanaActiva() {
  const [fila] = await db
    .select({ id: licCampaigns.id, name: licCampaigns.name, academicYear: licCampaigns.academicYear, status: licCampaigns.status })
    .from(licCampaigns)
    .orderBy(desc(licCampaigns.createdAt))
    .limit(1);
  return fila ?? null;
}

/**
 * `edu_student_id` → ¿tiene pedido confirmado? Solo entran los alumnos que **participan en
 * la campaña** (`lic_students`): a quien no le toca pedir licencias no se le puede pintar un
 * «pendiente» que no significa nada. Un alumno marcado a mano como completado (PDC, p. ej.)
 * cuenta como hecho, igual que en el panel de Licencias.
 */
async function estadoPedidos(campaignId: string): Promise<Map<string, boolean>> {
  const filas = await db
    .select({
      eduStudentId: licStudents.eduStudentId,
      manualCompletedAt: licStudents.manualCompletedAt,
      orderId: licOrders.id,
    })
    .from(licStudents)
    .leftJoin(
      licOrders,
      and(eq(licOrders.studentId, licStudents.id), eq(licOrders.archived, false)),
    )
    .where(and(eq(licStudents.campaignId, campaignId), eq(licStudents.active, true)));

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
  const [alumno] = await db.select().from(eduStudents).where(eq(eduStudents.id, id)).limit(1);
  if (!alumno) return null;

  const [
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
    alumno.curso
      ? db
          .select()
          .from(eduTutorias)
          .where(and(eq(eduTutorias.academicYear, academicYear), eq(eduTutorias.curso, alumno.curso)))
      : Promise.resolve([]),
    db.select().from(eduTeachers),
    db
      .select({ eduTeacherId: eduTutorPersonal.eduTeacherId })
      .from(eduTutorPersonal)
      .where(and(eq(eduTutorPersonal.eduStudentId, id), eq(eduTutorPersonal.academicYear, academicYear)))
      .limit(1),
    alumno.familiaId
      ? db
          .select({
            id: eduStudents.id,
            nombre: eduStudents.nombre,
            apellido1: eduStudents.apellido1,
            apellido2: eduStudents.apellido2,
            curso: eduStudents.curso,
            letra: eduStudents.letra,
          })
          .from(eduStudents)
          .where(and(eq(eduStudents.familiaId, alumno.familiaId), eq(eduStudents.active, true)))
      : Promise.resolve([]),
    licenciasDeAlumno(id),
    bancoDeAlumno(id, academicYear, alumno.curso),
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

async function licenciasDeAlumno(id: string): Promise<FichaAlumno['licencias']> {
  const campana = await campanaActiva();
  if (!campana) return null;

  const [fila] = await db
    .select({ student: licStudents, order: licOrders })
    .from(licStudents)
    .leftJoin(licOrders, and(eq(licOrders.studentId, licStudents.id), eq(licOrders.archived, false)))
    .where(and(eq(licStudents.campaignId, campana.id), eq(licStudents.eduStudentId, id)))
    .limit(1);

  const nombreCampana = campana.name ?? campana.academicYear ?? 'Campaña';
  if (!fila) return { campana: nombreCampana, participa: false, pedidoHecho: false, manual: null, confirmadoAt: null, total: null, pagadoAt: null, libros: [] };

  const orden = fila.order;
  const libros = orden
    ? await db
        .select({
          cod: licOrderItems.bookCod,
          asignatura: licOrderItems.asignatura,
          banco: licOrderItems.isBancoLibros,
          nombre: licBooks.nombreLibro,
        })
        .from(licOrderItems)
        .leftJoin(
          licBooks,
          and(eq(licBooks.cod, licOrderItems.bookCod), eq(licBooks.campaignId, campana.id)),
        )
        .where(eq(licOrderItems.orderId, orden.id))
    : [];

  return {
    campana: nombreCampana,
    participa: true,
    pedidoHecho: Boolean(orden) || Boolean(fila.student.manualCompletedAt),
    manual: fila.student.manualCompletedAt ? (fila.student.manualCompletedReason ?? 'Marcado como completado a mano') : null,
    confirmadoAt: orden?.confirmedAt ? orden.confirmedAt.toISOString() : null,
    total: orden?.totalPrice ?? null,
    pagadoAt: orden?.paidAt ? orden.paidAt.toISOString() : null,
    // `libros` puede traer el mismo COD dos veces si el catálogo tiene duplicados: se deja
    // tal cual, porque el pedido es el pedido y esconder una línea sería mentir.
    libros: libros.map((l) => ({ cod: l.cod, nombre: l.nombre, asignatura: l.asignatura, banco: l.banco })),
  };
}

async function bancoDeAlumno(
  id: string,
  academicYear: string,
  curso: string | null,
): Promise<FichaAlumno['banco']> {
  const [fila] = await db
    .select({ asignacion: blAsignaciones, lote: blLotes })
    .from(blAsignaciones)
    .innerJoin(blLotes, eq(blAsignaciones.loteId, blLotes.id))
    .where(and(eq(blAsignaciones.studentId, id), eq(blAsignaciones.academicYear, academicYear)))
    .limit(1);
  if (!fila) return null;

  const [registros, catalogo] = await Promise.all([
    db.select().from(blLibroRegistros).where(eq(blLibroRegistros.asignacionId, fila.asignacion.id)),
    curso
      ? db.select().from(blLibrosCurso).where(and(eq(blLibrosCurso.curso, curso), eq(blLibrosCurso.activo, true)))
      : Promise.resolve([]),
  ]);
  // El `book_cod` puede ser un COD del catálogo de Licencias o un `manual:<id>` de los libros
  // que se dieron de alta a mano en el banco (ver `bl_libros_curso`).
  const codsLic = registros.map((r) => r.bookCod).filter((c) => !c.startsWith('manual:'));
  const libros = codsLic.length > 0 ? await db.select().from(licBooks).where(inArray(licBooks.cod, codsLic)) : [];
  const nombrePorCod = new Map<string, string>();
  for (const l of libros) if (l.nombreLibro) nombrePorCod.set(l.cod, l.nombreLibro);
  for (const l of catalogo) nombrePorCod.set(`manual:${l.id}`, l.nombre);

  return {
    lote: `${fila.lote.numero}`,
    entregado: fila.asignacion.entregado,
    docInicio: fila.asignacion.docInicio,
    docFin: fila.asignacion.docFin,
    notas: fila.asignacion.notas,
    libros: registros
      .map((r) => ({
        nombre: nombrePorCod.get(r.bookCod) ?? r.bookCod,
        estado: r.estado,
        borrado: r.borrado,
        forrado: r.forrado,
        notas: r.notas,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
  };
}

/** ¿Tiene esta persona acceso al módulo? Envoltorio para el layout de la sección. */
export const puedeVerAlumnado = (user: Parameters<typeof canAccess>[0]) => canAccess(user, 'alumnado');
