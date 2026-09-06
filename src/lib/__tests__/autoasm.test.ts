import { describe, expect, it } from 'vitest';
import {
  archivoDeNombre,
  archivoPorCabeceras,
  cabecerasDe,
  contarIncidencias,
  detectarDelimitador,
  emailValido,
  gradeLevelDe,
  leerArchivo,
  parseCsv,
  rosterId,
  serializarArchivo,
  slugPersona,
  validarProyecto,
  type Archivos,
  type FilaCsv,
} from '@/lib/autoasm';
import {
  entraEnAlcance,
  inferirReglas,
  labelCurso,
  OPCIONES_POR_DEFECTO,
  proyectoDesdePlantilla,
  proyectoVacio,
  regenerarMatriculas,
  sincronizarConCentro,
  OPCIONES_SYNC_POR_DEFECTO,
  type SnapshotCentro,
} from '@/lib/autoasm-construir';

// Todos los datos de estos tests son inventados (personajes de ejemplo), como manda
// docs/04-convenciones-tecnicas.md: nunca un recorte de un fichero real.

function fila(archivo: Parameters<typeof cabecerasDe>[0], valores: Partial<FilaCsv>): FilaCsv {
  const salida: FilaCsv = {};
  for (const campo of cabecerasDe(archivo)) salida[campo] = valores[campo] ?? '';
  return salida;
}

function proyectoDePrueba(): Archivos {
  return {
    locations: [fila('locations', { location_id: 'Centro', location_name: 'Centro de prueba' })],
    students: [
      fila('students', { person_id: '111', first_name: 'Ada', last_name: 'Lovelace Byron', grade_level: 'ESO 1A', email_address: 'ada@ej.com', sis_username: 'ada', password_policy: '4', location_id: 'Centro' }),
      fila('students', { person_id: '222', first_name: 'Alan', last_name: 'Turing Stoney', grade_level: 'ESO 1A', email_address: 'alan@ej.com', sis_username: 'alan', password_policy: '4', location_id: 'Centro' }),
    ],
    staff: [fila('staff', { person_id: 'gracehopper', first_name: 'Grace', last_name: 'Hopper Murray', email_address: 'grace@ej.com', location_id: 'Centro' })],
    courses: [fila('courses', { course_id: 'Curso-1A', course_number: '1A', course_name: 'ESO 1A', location_id: 'Centro' })],
    classes: [fila('classes', { class_id: 'Cls-Mat1A', class_number: 'Matemáticas', course_id: 'Curso-1A', instructor_id: 'gracehopper', location_id: 'Centro' })],
    rosters: [
      fila('rosters', { roster_id: 'rst00001', class_id: 'Cls-Mat1A', student_id: '111' }),
      fila('rosters', { roster_id: 'rst00002', class_id: 'Cls-Mat1A', student_id: '222' }),
    ],
  };
}

describe('parseCsv', () => {
  it('respeta comillas, comas dentro del campo y CRLF', () => {
    const { cabeceras, filas } = parseCsv('a,b\r\n"uno, dos",tres\r\n');
    expect(cabeceras).toEqual(['a', 'b']);
    expect(filas).toEqual([['uno, dos', 'tres']]);
  });
  it('entiende las comillas dobles escapadas', () => {
    expect(parseCsv('a\n"di ""hola"""\n').filas).toEqual([['di "hola"']]);
  });
  it('se come el BOM del fichero de Excel', () => {
    expect(parseCsv('﻿person_id,first_name\n1,Ada\n').cabeceras).toEqual(['person_id', 'first_name']);
  });
  it('detecta el punto y coma de los CSV españoles', () => {
    expect(detectarDelimitador('a;b;c\n1;2;3')).toBe(';');
    expect(detectarDelimitador('a,b,c\n1,2,3')).toBe(',');
  });
});

describe('leerArchivo', () => {
  it('descarta la primera columna sin nombre que mete Excel y avisa', () => {
    const texto = ';person_id;first_name;last_name;grade_level;location_id\n;111;Ada;Lovelace;ESO 1A;Centro\n';
    const { filas, avisos } = leerArchivo('students', texto);
    expect(filas[0].person_id).toBe('111');
    expect(filas[0].first_name).toBe('Ada');
    expect(avisos.some((a) => a.includes('sin nombre'))).toBe(true);
  });
  it('rellena las columnas que falten y lo dice', () => {
    const { filas, avisos } = leerArchivo('students', 'person_id,first_name\n111,Ada\n');
    expect(filas[0].password_policy).toBe('');
    expect(avisos.some((a) => a.includes('Faltaban columnas'))).toBe(true);
  });
});

describe('identificar ficheros', () => {
  it('por nombre, ignorando la basura de macOS', () => {
    expect(archivoDeNombre('asm/students.csv')).toBe('students');
    expect(archivoDeNombre('__MACOSX/._students.csv')).toBe(null);
  });
  it('por cabeceras cuando el nombre no dice nada', () => {
    expect(archivoPorCabeceras(cabecerasDe('rosters'))).toBe('rosters');
    expect(archivoPorCabeceras(['cosa', 'otra'])).toBe(null);
  });
});

describe('serializarArchivo', () => {
  it('escribe la cabecera exacta de ASM y escapa lo que toca', () => {
    const texto = serializarArchivo('courses', [fila('courses', { course_id: 'C1', course_number: '1', course_name: 'Ámbito, práctico', location_id: 'Centro' })]);
    expect(texto.split('\n')[0]).toBe('course_id,course_number,course_name,location_id');
    expect(texto.split('\n')[1]).toBe('C1,1,"Ámbito, práctico",Centro');
  });
  it('ida y vuelta sin perder nada', () => {
    const archivos = proyectoDePrueba();
    const texto = serializarArchivo('students', archivos.students);
    expect(leerArchivo('students', texto).filas).toEqual(archivos.students);
  });
});

describe('normalizadores', () => {
  it('slugPersona quita acentos pero deja la ñ', () => {
    expect(slugPersona('María', 'Núñez Miralles')).toBe('marianuñezmiralles');
    expect(slugPersona('José Miguel', 'Batalla')).toBe('josemiguelbatalla');
  });
  it('gradeLevelDe usa la forma que ya está en ASM', () => {
    expect(gradeLevelDe('1ESO', 'A')).toBe('ESO 1A');
    expect(gradeLevelDe('5PRI', 'B')).toBe('PRIMARIA 5B');
    expect(gradeLevelDe('3ºPPDC', 'PDC')).toBe('ESO 3 PDC');
    expect(gradeLevelDe('3ESO', 'PDC')).toBe('ESO 3 PDC');
  });
  it('rosterId va con cinco cifras', () => {
    expect(rosterId(1)).toBe('rst00001');
    expect(rosterId(4353)).toBe('rst04353');
  });
  it('emailValido descarta lo que no lleva arroba y dominio', () => {
    expect(emailValido('ada@ej.com')).toBe(true);
    expect(emailValido('ada@ej')).toBe(false);
  });
});

describe('validarProyecto', () => {
  it('no se queja de un proyecto coherente', () => {
    expect(contarIncidencias(validarProyecto(proyectoDePrueba())).errores).toBe(0);
  });

  it('caza el person_id repetido entre alumnado y profesorado', () => {
    const archivos = proyectoDePrueba();
    archivos.staff[0].person_id = '111';
    archivos.classes[0].instructor_id = '111';
    const errores = validarProyecto(archivos).filter((i) => i.nivel === 'error');
    expect(errores.some((e) => e.mensaje.includes('único en toda la organización'))).toBe(true);
  });

  it('cada incidencia dice de qué tipo es, para poder agruparlas', () => {
    const archivos = proyectoDePrueba();
    archivos.rosters[0].student_id = 'fantasma';
    const inc = validarProyecto(archivos).find((i) => i.archivo === 'rosters' && i.nivel === 'error');
    expect(inc?.tipo).toBe('alumno-inexistente');
  });

  it('caza el correo compartido por dos personas', () => {
    const archivos = proyectoDePrueba();
    archivos.students[1].email_address = 'ada@ej.com';
    expect(validarProyecto(archivos).some((i) => i.nivel === 'error' && i.campo === 'email_address')).toBe(true);
  });

  it('caza referencias rotas: matrícula a una clase que no existe', () => {
    const archivos = proyectoDePrueba();
    archivos.rosters[0].class_id = 'Cls-Fantasma';
    const error = validarProyecto(archivos).find((i) => i.nivel === 'error' && i.archivo === 'rosters');
    expect(error?.mensaje).toContain('Cls-Fantasma');
  });

  it('caza al instructor que no está en staff.csv', () => {
    const archivos = proyectoDePrueba();
    archivos.classes[0].instructor_id_2 = 'quiensea';
    expect(validarProyecto(archivos).some((i) => i.nivel === 'error' && i.campo === 'instructor_id_2')).toBe(true);
  });

  it('caza la política de contraseña inventada', () => {
    const archivos = proyectoDePrueba();
    archivos.students[0].password_policy = '5';
    expect(validarProyecto(archivos).some((i) => i.campo === 'password_policy' && i.nivel === 'error')).toBe(true);
  });

  it('caza la matrícula duplicada', () => {
    const archivos = proyectoDePrueba();
    archivos.rosters.push(fila('rosters', { roster_id: 'rst00003', class_id: 'Cls-Mat1A', student_id: '111' }));
    expect(validarProyecto(archivos).some((i) => i.mensaje.includes('Matrícula duplicada'))).toBe(true);
  });

  it('avisa (sin error) de la clase sin profe y del alumno sin clase', () => {
    const archivos = proyectoDePrueba();
    archivos.classes[0].instructor_id = '';
    archivos.rosters = [];
    const incidencias = validarProyecto(archivos);
    expect(incidencias.some((i) => i.nivel === 'aviso' && i.mensaje.includes('sin ningún profe'))).toBe(true);
    expect(incidencias.some((i) => i.nivel === 'aviso' && i.mensaje.includes('sin ninguna clase'))).toBe(true);
  });
});

describe('plantilla del centro', () => {
  it('trae cursos y clases, y ninguna persona', () => {
    const p = proyectoDesdePlantilla();
    expect(p.archivos.courses.length).toBeGreaterThan(30);
    expect(p.archivos.classes.length).toBeGreaterThan(100);
    expect(p.archivos.students).toHaveLength(0);
    expect(p.archivos.staff).toHaveLength(0);
    expect(p.archivos.locations[0].location_id).toBe('Consolacion_Burriana');
  });
  it('cada clase apunta a un curso que existe', () => {
    const p = proyectoDesdePlantilla();
    const cursos = new Set(p.archivos.courses.map((c) => c.course_id));
    expect(p.archivos.classes.every((c) => cursos.has(c.course_id))).toBe(true);
  });
});

describe('sincronizarConCentro', () => {
  const snapshot: SnapshotCentro = {
    generado: '2026-09-01T00:00:00.000Z',
    alumnos: [
      { nia: '900001', codigo: null, nombre: 'Ada', apellido1: 'Lovelace', apellido2: 'Byron', curso: '1ESO', letra: 'A', email: null, emailGoogle: 'ada@ej.com' },
      { nia: '900002', codigo: null, nombre: 'Alan', apellido1: 'Turing', apellido2: 'Stoney', curso: '1ESO', letra: 'A', email: 'alan@ej.com', emailGoogle: null },
    ],
    profes: [
      { alias: 'GH', nombre: 'Grace', apellido1: 'Hopper', apellido2: 'Murray', email: 'grace@ej.com' },
    ],
  };

  it('monta alumnado y profesorado con el NIA y el correo como identidad', () => {
    const base = proyectoVacio();
    const { proyecto, resumen } = sincronizarConCentro(base, snapshot);
    expect(resumen.alumnos.altas).toBe(2);
    expect(resumen.profes.altas).toBe(1);
    const ada = proyecto.archivos.students.find((s) => s.person_id === '900001');
    expect(ada?.last_name).toBe('Lovelace Byron');
    expect(ada?.grade_level).toBe('ESO 1A');
    expect(ada?.sis_username).toBe('ada');
    expect(ada?.password_policy).toBe('4');
    expect(proyecto.archivos.staff[0].person_id).toBe('gracehopper');
  });

  it('respeta el person_id que ya tenía alguien aunque cambie de nombre', () => {
    const base = proyectoVacio();
    const primera = sincronizarConCentro(base, snapshot).proyecto;
    const casada = {
      ...snapshot,
      profes: [{ alias: 'GH', nombre: 'Grace', apellido1: 'Hopper-Murray', apellido2: null, email: 'grace@ej.com' }],
    };
    const segunda = sincronizarConCentro(primera, casada, OPCIONES_SYNC_POR_DEFECTO).proyecto;
    expect(segunda.archivos.staff).toHaveLength(1);
    expect(segunda.archivos.staff[0].person_id).toBe('gracehopper');
    expect(segunda.archivos.staff[0].last_name).toBe('Hopper-Murray');
  });

  it('el alcance decide qué alumnado entra, y el profesorado entra siempre entero', () => {
    const conPrimaria: SnapshotCentro = {
      ...snapshot,
      alumnos: [
        ...snapshot.alumnos,
        { nia: '900003', codigo: null, nombre: 'Katherine', apellido1: 'Johnson', apellido2: 'Coleman', curso: '5PRI', letra: 'A', email: null, emailGoogle: 'kj@ej.com' },
        { nia: '900004', codigo: null, nombre: 'Hedy', apellido1: 'Lamarr', apellido2: 'Kiesler', curso: '4INF', letra: 'B', email: null, emailGoogle: 'hl@ej.com' },
      ],
    };
    const base = proyectoVacio({ ...OPCIONES_POR_DEFECTO, desdeCurso: '6PRI' });
    const { proyecto, resumen } = sincronizarConCentro(base, conPrimaria);
    expect(proyecto.archivos.students.map((s) => s.person_id)).toEqual(['900001', '900002']);
    expect(resumen.fueraDeAlcance).toEqual([{ curso: '4INF', n: 1 }, { curso: '5PRI', n: 1 }]);
    expect(proyecto.archivos.staff).toHaveLength(1);
  });

  it('con el alcance en todo el centro no se queda nadie fuera', () => {
    const base = proyectoVacio({ ...OPCIONES_POR_DEFECTO, desdeCurso: null });
    const { resumen } = sincronizarConCentro(base, snapshot);
    expect(resumen.fueraDeAlcance).toEqual([]);
    expect(resumen.alumnos.altas).toBe(2);
  });

  it('el PDC entra por su curso de verdad, no por el nombre del programa', () => {
    expect(entraEnAlcance('3ºPPDC', '1ESO')).toBe(true);
    expect(entraEnAlcance('6PRI', '1ESO')).toBe(false);
    expect(entraEnAlcance('6PRI', '6PRI')).toBe(true);
    expect(entraEnAlcance(null, null)).toBe(true);
    expect(labelCurso('6PRI')).toBe('6º EP');
    expect(labelCurso(null)).toBe('Todo el centro');
  });

  it('no borra a nadie salvo que se pida', () => {
    const primera = sincronizarConCentro(proyectoVacio(), snapshot).proyecto;
    const vacio: SnapshotCentro = { ...snapshot, alumnos: [], profes: [] };
    expect(sincronizarConCentro(primera, vacio).proyecto.archivos.students).toHaveLength(2);
    const limpiado = sincronizarConCentro(primera, vacio, { ...OPCIONES_SYNC_POR_DEFECTO, quitarBajas: true }).proyecto;
    expect(limpiado.archivos.students).toHaveLength(0);
  });

  it('al quitar a un profe lo saca también de sus clases', () => {
    const base = proyectoVacio();
    const conGente = sincronizarConCentro(base, snapshot).proyecto;
    conGente.archivos.courses = [fila('courses', { course_id: 'Curso-1A', course_number: '1A', course_name: 'ESO 1A', location_id: base.opciones.locationId })];
    conGente.archivos.classes = [fila('classes', { class_id: 'Cls-Mat1A', class_number: 'Mates', course_id: 'Curso-1A', instructor_id: 'gracehopper', location_id: base.opciones.locationId })];
    const sinProfe = sincronizarConCentro(conGente, { ...snapshot, profes: [] }, { ...OPCIONES_SYNC_POR_DEFECTO, quitarBajas: true });
    expect(sinProfe.proyecto.archivos.classes[0].instructor_id).toBe('');
    expect(sinProfe.resumen.instructoresRetirados).toEqual(['gracehopper']);
  });
});

describe('matrículas', () => {
  it('se rehacen con la regla de grupos de cada clase', () => {
    const archivos = proyectoDePrueba();
    archivos.rosters = [];
    const { filas, altas } = regenerarMatriculas(archivos, { 'Cls-Mat1A': ['ESO 1A'] });
    expect(filas).toHaveLength(2);
    expect(altas).toBe(2);
    expect(filas[0].roster_id).toBe('rst00001');
  });

  it('las clases sin regla conservan lo que tenían, menos los alumnos que ya no están', () => {
    const archivos = proyectoDePrueba();
    archivos.students = archivos.students.slice(0, 1);
    const { filas, bajas } = regenerarMatriculas(archivos, {});
    expect(filas.map((f) => f.student_id)).toEqual(['111']);
    expect(bajas).toBe(1);
  });

  it('inferirReglas deduce que una clase lleva al grupo entero', () => {
    const archivos = proyectoDePrueba();
    expect(inferirReglas(archivos)).toEqual({ 'Cls-Mat1A': ['ESO 1A'] });
  });

  it('inferirReglas no confunde a un alumno suelto con una regla', () => {
    const archivos = proyectoDePrueba();
    archivos.students.push(fila('students', { person_id: '333', first_name: 'Edsger', last_name: 'Dijkstra', grade_level: 'ESO 2B', email_address: 'ed@ej.com', sis_username: 'ed', password_policy: '4', location_id: 'Centro' }));
    archivos.students.push(fila('students', { person_id: '334', first_name: 'Barbara', last_name: 'Liskov', grade_level: 'ESO 2B', email_address: 'bl@ej.com', sis_username: 'bl', password_policy: '4', location_id: 'Centro' }));
    archivos.rosters.push(fila('rosters', { roster_id: 'rst00003', class_id: 'Cls-Mat1A', student_id: '333' }));
    expect(inferirReglas(archivos)['Cls-Mat1A']).toEqual(['ESO 1A']);
  });
});
