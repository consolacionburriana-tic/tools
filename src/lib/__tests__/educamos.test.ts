import { describe, expect, it } from 'vitest';
import {
  claveGuardian,
  computeSyncPlan,
  dedupeGuardians,
  generarCodigo,
  matchStudent,
  normalizar,
  parseBooleano,
  parseClase,
  parseFechaES,
  variantesCodigo,
  type MatchTarget,
  type ParsedGuardian,
  type ParsedStudentRow,
  type StudentLike,
} from '@/lib/educamos';

function mkRow(overrides: Partial<ParsedStudentRow>): ParsedStudentRow {
  return {
    fila: 2,
    codigo: null,
    educamosPersonaId: null,
    nia: null,
    dni: null,
    matricula: null,
    nombre: null,
    apellido1: null,
    apellido2: null,
    sexo: null,
    fechaNacimiento: null,
    curso: null,
    letra: null,
    claseCodigo: null,
    tutorPersonal: null,
    modeloLinguistico: null,
    deficit: null,
    email: null,
    emailGoogle: null,
    movil1: null,
    movil2: null,
    telEmergencia: null,
    familiaId: null,
    extra: {},
    tutores: [],
    ...overrides,
  };
}

function mkStudent(overrides: Partial<StudentLike>): StudentLike {
  return {
    id: 's',
    codigo: null,
    educamosPersonaId: null,
    nia: null,
    dni: null,
    matricula: null,
    nombre: null,
    apellido1: null,
    apellido2: null,
    sexo: null,
    fechaNacimiento: null,
    curso: null,
    letra: null,
    claseCodigo: null,
    tutorPersonal: null,
    modeloLinguistico: null,
    deficit: null,
    email: null,
    emailGoogle: null,
    movil1: null,
    movil2: null,
    telEmergencia: null,
    familiaId: null,
    active: true,
    extra: {},
    ...overrides,
  };
}

function mkGuardian(overrides: Partial<ParsedGuardian>): ParsedGuardian {
  return {
    orden: 1,
    educamosPersonaId: null,
    nombre: null,
    apellido1: null,
    apellido2: null,
    dni: null,
    sexo: null,
    email: null,
    emailGoogle: null,
    telCasa: null,
    telPersonal: null,
    movilTrabajo: null,
    direccion: null,
    cp: null,
    localidad: null,
    provincia: null,
    parentesco: null,
    recibeInformacion: null,
    guardaCustodia: null,
    extra: {},
    ...overrides,
  };
}

describe('normalizar', () => {
  it('mayúsculas, sin acentos, espacios colapsados', () => {
    expect(normalizar('José Ñíguez')).toBe('JOSE NIGUEZ');
  });
});

describe('parseFechaES', () => {
  it('dd/mm/yyyy con separador /', () => {
    expect(parseFechaES('05/03/2015')).toBe('2015-03-05');
  });

  it('día y mes sin cero delante', () => {
    expect(parseFechaES('5/3/2015')).toBe('2015-03-05');
  });

  it('año de 2 cifras: >30 es 19xx, <=30 es 20xx', () => {
    expect(parseFechaES('05/03/99')).toBe('1999-03-05');
    expect(parseFechaES('05/03/15')).toBe('2015-03-05');
  });

  it('mes o día fuera de rango devuelve null', () => {
    expect(parseFechaES('05/13/2015')).toBeNull();
    expect(parseFechaES('32/01/2015')).toBeNull();
  });

  it('formato ISO (no es lo que produce Educamos) no se reconoce', () => {
    expect(parseFechaES('2015-03-05')).toBeNull();
  });

  it('vacío, null o basura devuelven null', () => {
    expect(parseFechaES('')).toBeNull();
    expect(parseFechaES(null)).toBeNull();
    expect(parseFechaES('no es una fecha')).toBeNull();
  });
});

describe('parseClase', () => {
  it('curso + letra estándar', () => {
    expect(parseClase('2ESOB')).toEqual({ curso: '2ESO', letra: 'B' });
  });

  it('PDC: la letra es "PDC" y el curso incluye el sufijo completo', () => {
    expect(parseClase('3ESOPDC')).toEqual({ curso: '3ESOPDC', letra: 'PDC' });
  });

  it('primaria con letra', () => {
    expect(parseClase('1PRIA')).toEqual({ curso: '1PRI', letra: 'A' });
  });

  it('null o vacío devuelven curso y letra null', () => {
    expect(parseClase(null)).toEqual({ curso: null, letra: null });
    expect(parseClase('')).toEqual({ curso: null, letra: null });
  });

  it('gotcha conocido: un valor sin letra de clase separada se parte igualmente (ej. "6PRI" -> curso "6PR", letra "I")', () => {
    // Documenta un comportamiento real, no necesariamente deseado: el regex de
    // curso+letra no distingue "clase sin letra" de "los 2 últimos caracteres
    // parecen curso+letra". No se corrige aquí (fuera de alcance de este plan);
    // este test solo evita que cambie en silencio.
    expect(parseClase('6PRI')).toEqual({ curso: '6PR', letra: 'I' });
  });

  it('gotcha conocido: el símbolo "º" no es una letra ni un dígito y rompe el split de letra', () => {
    expect(parseClase('2º ESO B')).toEqual({ curso: '2ºESOB', letra: null });
  });
});

describe('parseBooleano', () => {
  it('reconoce varias formas de "sí" incluida la marca "X"', () => {
    expect(parseBooleano('SI')).toBe(true);
    expect(parseBooleano('X')).toBe(true);
  });

  it('reconoce varias formas de "no"', () => {
    expect(parseBooleano('NO')).toBe(false);
  });

  it('un valor irreconocible devuelve null (no false)', () => {
    expect(parseBooleano('tal vez')).toBeNull();
  });

  it('null devuelve null', () => {
    expect(parseBooleano(null)).toBeNull();
  });
});

describe('generarCodigo', () => {
  it('genera AAXXXYYY con año+3 letras de apellido+3 de nombre', () => {
    expect(generarCodigo('2015-03-05', 'Naranjo', 'Zacarias')).toBe('15NARZAC');
  });

  it('quita acentos y Ñ correctamente', () => {
    expect(generarCodigo('2015-03-05', 'Ñandú', 'José')).toBe('15NANJOS');
  });

  it('si el apellido tiene menos de 3 letras útiles, no genera código', () => {
    expect(generarCodigo('2015-03-05', 'Al', 'Zacarias')).toBeNull();
  });

  it('si falta cualquier dato, no genera código', () => {
    expect(generarCodigo(null, 'Naranjo', 'Zacarias')).toBeNull();
  });
});

describe('variantesCodigo', () => {
  it('desliza primero el nombre y luego el apellido, siempre 8 caracteres', () => {
    const variantes = variantesCodigo('2015-03-05', 'Naranjo', 'Zacarias');
    expect(variantes.length).toBeGreaterThan(0);
    for (const v of variantes) expect(v).toHaveLength(8);
    expect(variantes[0]).toBe('15NARACA');
  });

  it('sin datos suficientes, no hay variantes', () => {
    expect(variantesCodigo('2015-03-05', 'Al', 'Za')).toEqual([]);
  });
});

describe('matchStudent (cascada codigo -> guid -> nia -> dni -> apellidos+fecha)', () => {
  const targets: MatchTarget[] = [
    { id: 't1', codigo: '15NARZAC', educamosPersonaId: null, nia: null, dni: null, apellido1: null, apellido2: null, fechaNacimiento: null },
    { id: 't2', codigo: null, educamosPersonaId: 'GUID-2', nia: null, dni: null, apellido1: null, apellido2: null, fechaNacimiento: null },
    { id: 't3', codigo: null, educamosPersonaId: null, nia: '12345678', dni: null, apellido1: null, apellido2: null, fechaNacimiento: null },
    { id: 't4', codigo: null, educamosPersonaId: null, nia: null, dni: '11223344Z', apellido1: null, apellido2: null, fechaNacimiento: null },
    { id: 't5', codigo: null, educamosPersonaId: null, nia: null, dni: null, apellido1: 'Garcia', apellido2: 'Lopez', fechaNacimiento: '2016-01-01' },
  ];

  it('casa por código interno', () => {
    expect(matchStudent(mkRow({ codigo: '15NARZAC' }), targets)).toEqual({ target: targets[0], via: 'codigo' });
  });

  it('casa por GUID de Educamos (case-insensitive)', () => {
    expect(matchStudent(mkRow({ educamosPersonaId: 'guid-2' }), targets)).toEqual({ target: targets[1], via: 'educamos_persona_id' });
  });

  it('casa por NIA', () => {
    expect(matchStudent(mkRow({ nia: '12345678' }), targets)).toEqual({ target: targets[2], via: 'nia' });
  });

  it('casa por DNI normalizado', () => {
    expect(matchStudent(mkRow({ dni: '11223344z' }), targets)).toEqual({ target: targets[3], via: 'dni' });
  });

  it('casa por apellido1+apellido2+fecha cuando no hay más pistas', () => {
    expect(
      matchStudent(mkRow({ apellido1: 'garcia', apellido2: 'lopez', fechaNacimiento: '2016-01-01' }), targets),
    ).toEqual({ target: targets[4], via: 'apellidos+fecha' });
  });

  it('sin ninguna coincidencia, no hay match', () => {
    expect(matchStudent(mkRow({ nombre: 'Nadie' }), targets)).toEqual({ target: null, via: null });
  });

  it('apellidos+fecha ambiguo (2+ candidatos) no matchea por seguridad', () => {
    const conDuplicado = [
      ...targets,
      { id: 't6', codigo: null, educamosPersonaId: null, nia: null, dni: null, apellido1: 'Garcia', apellido2: 'Lopez', fechaNacimiento: '2016-01-01' },
    ];
    expect(
      matchStudent(mkRow({ apellido1: 'garcia', apellido2: 'lopez', fechaNacimiento: '2016-01-01' }), conDuplicado),
    ).toEqual({ target: null, via: null });
  });
});

describe('computeSyncPlan', () => {
  const s1 = mkStudent({
    id: 's1', codigo: '15NARZAC', nia: '11111111', nombre: 'Zacarias',
    apellido1: 'Naranjo', apellido2: 'Serrano', fechaNacimiento: '2015-03-05', curso: '3ESO', letra: 'A',
  });

  it('fila que coincide en todo va a sinCambios', () => {
    const row = mkRow({ codigo: '15NARZAC', nia: '11111111', nombre: 'Zacarias', apellido1: 'Naranjo', apellido2: 'Serrano', fechaNacimiento: '2015-03-05', curso: '3ESO', letra: 'A' });
    const plan = computeSyncPlan([row], [s1], { respetarCursoDe: 'bbdd' });
    expect(plan.sinCambios).toEqual([{ studentId: 's1', codigo: '15NARZAC', nombreActual: 'Zacarias Naranjo Serrano' }]);
    expect(plan.altas).toEqual([]);
    expect(plan.cambios).toEqual([]);
  });

  it('fila sin match genera un alta con código generado', () => {
    const row = mkRow({ nombre: 'Nuevo', apellido1: 'Alumno', apellido2: 'Test', fechaNacimiento: '2017-01-01', curso: '1ESO' });
    const plan = computeSyncPlan([row], [], { respetarCursoDe: 'bbdd' });
    expect(plan.altas).toHaveLength(1);
    expect(plan.altas[0]).toMatchObject({ fila: 2, codigo: '17ALUNUE', colision: false });
  });

  it('cambio en un campo normal (email) no se marca "gordo"', () => {
    const row = mkRow({ codigo: '15NARZAC', nombre: 'Zacarias', apellido1: 'Naranjo', apellido2: 'Serrano', fechaNacimiento: '2015-03-05', curso: '3ESO', letra: 'A', email: 'nuevo@correo.com' });
    const plan = computeSyncPlan([row], [s1], { respetarCursoDe: 'bbdd' });
    expect(plan.cambios).toHaveLength(1);
    expect(plan.cambios[0].tieneGordos).toBe(false);
    expect(plan.cambios[0].diffs).toEqual([{ campo: 'email', actual: null, nuevo: 'nuevo@correo.com', gordo: false }]);
  });

  it('cambio en un campo gordo (apellido1) SÍ se marca "gordo" — el guardarraíl clave contra mismatches', () => {
    const row = mkRow({ codigo: '15NARZAC', nombre: 'Zacarias', apellido1: 'OTROAPELLIDO', apellido2: 'Serrano', fechaNacimiento: '2015-03-05', curso: '3ESO', letra: 'A' });
    const plan = computeSyncPlan([row], [s1], { respetarCursoDe: 'bbdd' });
    expect(plan.cambios).toHaveLength(1);
    expect(plan.cambios[0].tieneGordos).toBe(true);
    expect(plan.cambios[0].diffs).toContainEqual({ campo: 'apellido1', actual: 'Naranjo', nuevo: 'OTROAPELLIDO', gordo: true });
  });

  it('un alumno activo, no matcheado, cuyo curso SÍ está en el fichero, aparece como desaparecido', () => {
    const s3 = mkStudent({ id: 's3', codigo: '14GOMLUC', nombre: 'Lucas', apellido1: 'Gomez', apellido2: 'Diaz', curso: '3ESO', letra: 'A' });
    const row = mkRow({ codigo: '15NARZAC', nombre: 'Zacarias', apellido1: 'Naranjo', apellido2: 'Serrano', fechaNacimiento: '2015-03-05', curso: '3ESO', letra: 'A' });
    const plan = computeSyncPlan([row], [s1, s3], { respetarCursoDe: 'bbdd' });
    expect(plan.desaparecidos).toEqual([{ studentId: 's3', codigo: '14GOMLUC', nombreActual: 'Lucas Gomez Diaz', curso: '3ESO', letra: 'A' }]);
    expect(plan.pareceParcial).toBe(false);
  });

  it('fichero parcial (no cubre todos los cursos de la BBDD): no marca como desaparecido a quien está en un curso ausente del fichero', () => {
    const s2 = mkStudent({ id: 's2', codigo: '16PERLUC', nombre: 'Lucia', apellido1: 'Perez', apellido2: 'Ruiz', curso: '2ESO', letra: 'B' });
    const row = mkRow({ codigo: '15NARZAC', nombre: 'Zacarias', apellido1: 'Naranjo', apellido2: 'Serrano', fechaNacimiento: '2015-03-05', curso: '3ESO', letra: 'A' });
    const plan = computeSyncPlan([row], [s1, s2], { respetarCursoDe: 'bbdd' });
    expect(plan.pareceParcial).toBe(true);
    expect(plan.desaparecidos).toEqual([]);
  });

  it('dos altas nuevas que generarían el mismo código: la segunda queda en colisión sin código asignado', () => {
    const rowA = mkRow({ fila: 2, nombre: 'Zacarias', apellido1: 'Naranjo', apellido2: 'X', fechaNacimiento: '2015-03-05', curso: '1ESO' });
    const rowB = mkRow({ fila: 3, nombre: 'Zacarias', apellido1: 'Naranjo', apellido2: 'Y', fechaNacimiento: '2015-03-05', curso: '1ESO' });
    const plan = computeSyncPlan([rowA, rowB], [], { respetarCursoDe: 'bbdd' });
    expect(plan.altas[0]).toMatchObject({ codigo: '15NARZAC', colision: false });
    expect(plan.altas[1]).toMatchObject({ codigo: null, colision: true });
  });

  it('respetarCursoDe "excel" incluye el cambio de curso en los diffs; "bbdd" lo ignora', () => {
    const row = mkRow({ codigo: '15NARZAC', nombre: 'Zacarias', apellido1: 'Naranjo', apellido2: 'Serrano', fechaNacimiento: '2015-03-05', curso: '4ESO', letra: 'A' });
    const conExcel = computeSyncPlan([row], [s1], { respetarCursoDe: 'excel' });
    expect(conExcel.cambios[0].diffs).toContainEqual({ campo: 'curso', actual: '3ESO', nuevo: '4ESO', gordo: false });

    const conBbdd = computeSyncPlan([row], [s1], { respetarCursoDe: 'bbdd' });
    expect(conBbdd.cambios).toEqual([]);
    expect(conBbdd.sinCambios).toHaveLength(1);
  });
});

describe('claveGuardian', () => {
  it('prioriza GUID sobre DNI y email', () => {
    expect(claveGuardian(mkGuardian({ educamosPersonaId: 'GUID-1' }))).toBe('guid:guid-1');
  });

  it('usa DNI normalizado si no hay GUID', () => {
    expect(claveGuardian(mkGuardian({ dni: '12345678z' }))).toBe('dni:12345678Z');
  });

  it('usa email en minúsculas como último recurso', () => {
    expect(claveGuardian(mkGuardian({ email: 'Padre@Correo.com' }))).toBe('email:padre@correo.com');
  });

  it('sin ningún identificador, no hay clave', () => {
    expect(claveGuardian(mkGuardian({}))).toBeNull();
  });
});

describe('dedupeGuardians', () => {
  it('dos hermanos con el mismo tutor (mismo email, distinta capitalización) comparten una sola entrada', () => {
    const rows = [
      mkRow({ fila: 2, tutores: [mkGuardian({ email: 'tutor@correo.com', nombre: 'Juan', telCasa: null })] }),
      mkRow({ fila: 3, tutores: [mkGuardian({ email: 'TUTOR@correo.com', nombre: 'Juan', telCasa: '964123456' })] }),
    ];
    const { agrupados, sinClave } = dedupeGuardians(rows);
    expect(agrupados).toHaveLength(1);
    expect(agrupados[0].vinculos).toHaveLength(2);
    // Relleno de huecos: el segundo registro trae telCasa y el primero no lo tenía
    expect(agrupados[0].datos.telCasa).toBe('964123456');
    expect(sinClave).toBe(0);
  });

  it('un tutor sin GUID/DNI/email no se puede deduplicar y se cuenta aparte', () => {
    const rows = [mkRow({ fila: 2, tutores: [mkGuardian({ nombre: 'SinContacto' })] })];
    const { agrupados, sinClave } = dedupeGuardians(rows);
    expect(agrupados).toEqual([]);
    expect(sinClave).toBe(1);
  });
});
