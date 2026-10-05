import { describe, expect, it } from 'vitest';

import {
  agruparSesiones,
  casarProfePorNombre,
  parsearCeldaClase,
  parsearClaseHojaProfe,
  parsearLeyendas,
  prepararImportacion,
  reconocerHoraProfe,
  sugerirCodigo,
  type BloqueEntrada,
} from '@/lib/horarios-import';
import { type CeldaHorario, type Franja } from '@/lib/horarios';
import { unirSesionesSeguidas } from '@/lib/mihorario';

// Fixtures INVENTADOS que imitan el fichero de la ESO de Educamos: nombres y códigos de
// profesorado ficticios (ver docs/04-convenciones-tecnicas.md). La forma de cada celda sí es
// la del fichero real de 2026-27.

const DIAS = ['Horas', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

function clase(titulo: string, filas: string[][], leyenda: string[]): BloqueEntrada {
  return { tipo: 'clase', titulo, filas: [[titulo], DIAS, ...filas, ...leyenda.map((l) => [l])] };
}
function profe(nombre: string, filas: string[][]): BloqueEntrada {
  return { tipo: 'profe', titulo: nombre, filas: [[nombre], DIAS, ...filas] };
}

const LEYENDA_COMUN = [
  'Materias:', 'MAT1: Matemáticas', 'ING: Primera Lengua Extranjera', 'TUT: Tutoría', 'AP: Ámbito Práctico',
  'DIG: Digitalización', 'TYD3: Tecnología y Digitalización',
  'Profesores:', 'AAAA0: ANA ALVAREZ ALONSO', 'BBBB0: BEATRIZ BLANCO BAEZA', 'CCCC0: CARMEN CASTRO CANO',
  'DDDD0: DIEGO DIAZ DURAN', 'EEEE0: ELENA ESTEVE (MATE)',
];

const FICHERO: BloqueEntrada[] = [
  clase('1ESOA: 1º ESO-A', [
    ['De 08:00 a 08:55', 'MAT1 - AAAA0', '', '', '', ''],
    ['De 08:55 a 09:50', '', 'MAT1 - AAAA0', '', '', ''],
    ['De 09:50 a 10:45', 'TYD3 - EEEE0\nDDDD0', '', '', '', ''],
  ], LEYENDA_COMUN),
  clase('4ESOB: 4º ESO-B', [
    ['De 08:00 a 08:55', 'ING - BBBB0\nCCCC0', 'ING - BBBB0\nCCCC0', 'TUT - BBBB0', '', ''],
  ], LEYENDA_COMUN),
  clase('4º PPDC: 4º ESO-PDC', [
    ['De 08:00 a 08:55', 'ING - BBBB0\nCCCC0', 'NG - BBBB0\nCCCC0', 'AP - EEEE0\nDIG', '', ''],
  ], LEYENDA_COMUN),
  profe('ANA ALVAREZ ALONSO', [
    ['De 08:00 a 08:55', 'MAT1: 1ESOA', 'AT. PADRES', 'AT.PADRES', 'Ate. padres', 'ATENCIÓN FAMILIAS'],
    ['De 08:55 a 09:50', 'TIC', 'MAT1: 1ESOA', 'AT. ALUMNOS', 'DPTO', 'JE'],
    ['De 09:50 a 10:45', 'Recreo', 'Recreo', 'Recreo', 'Recreo', 'Recreo'],
  ]),
  profe('BEATRIZ BLANCO BAEZA', [
    ['De 08:00 a 08:55', 'ING: 4ESOB\nING: 4º PPDC', 'NG: 4º PPDC\nING: 4ESOB', 'TUT: 4ESOB', 'COCOPE*\nDPTO', 'CosaRara'],
    ['De 08:55 a 09:50', 'TIC', '', 'INNOVACIÓN', 'PASTORAL', 'ERASMUS'],
  ]),
  profe('DIEGO DIAZ DURAN', [
    ['De 08:55 a 09:50', 'TIC', '', '', 'PASTORAL', ''],
    ['De 09:50 a 10:45', 'TYD3: 1ESOA*\nORATORIO', '', '', '', ''],
  ]),
  // No sale en ninguna leyenda: solo se la puede casar contra el claustro de la BBDD.
  profe('FABIOLA FERRER', [
    ['De 08:00 a 08:55', 'MATE 1ºA', '', '', '', 'TUT 4ºB'],
    ['De 08:55 a 09:50', '', 'MATE 1ºA', '', '', ''],
  ]),
];

const CLAUSTRO = [
  { alias: 'FFER0', nombre: 'FABIOLA FERRER FUSTER' },
  { alias: 'GGAR0', nombre: 'GLORIA GARCIA GIL' },
];

describe('sugerencias para códigos que no están en la leyenda', () => {
  it("'NG' → 'ING' (le falta una letra) y solo si hay un único candidato", () => {
    expect(sugerirCodigo('NG', ['ING', 'MAT1', 'TUT'])).toBe('ING');
    expect(sugerirCodigo('MTA1', ['MAT1', 'ING'])).toBe('MAT1'); // dos letras traspuestas
    expect(sugerirCodigo('ING2', ['ING1', 'ING3'])).toBeNull(); // dos a la misma distancia: no se adivina
    expect(sugerirCodigo('X', ['XA'])).toBeNull(); // una sola letra no se sugiere nunca
    expect(sugerirCodigo('ZZZZ', ['MAT1'])).toBeNull();
  });

  it('la incidencia lleva la sugerencia', () => {
    const l = parsearLeyendas(['Materias:', 'ING: Inglés', 'Profesores:', 'AAAA0: ANA']);
    const { incidencias } = parsearCeldaClase('NG - AAAA0', l);
    expect(incidencias[0].sugerencia).toBe('ING');
    expect(incidencias[0].detalle).toContain("¿Quizá 'ING'");
  });
});

describe('detalle de una hora que es una materia de la leyenda', () => {
  // 4º PDC: 'AP - X' + 'DIG'. DIG es una materia de verdad en 4º A y B (y por eso está en la
  // leyenda común), pero aquí es a qué se dedica esa hora del Ámbito Práctico.
  it("'AP - EEEE0' + 'DIG' es UNA sesión del ámbito, no una clase sin profe", () => {
    const l = parsearLeyendas(LEYENDA_COMUN);
    const { sesiones } = parsearCeldaClase('AP - EEEE0\nDIG', l);
    expect(sesiones).toHaveLength(1);
    expect(sesiones[0].detalle).toBe('Digitalización');
  });
});

describe('lo escrito a mano en la hoja de un profe', () => {
  it.each([
    'AT. PADRES', 'AT.PADRES', 'ATE. PADRES', 'At padres', 'at.padres', 'ATPADRES', 'ATENCIÓN FAMILIAS',
    'Atención a familias', 'AT. FAMILIAS', 'A. PADRES',
  ])('%s → atención a familias', (t) => {
    expect(reconocerHoraProfe(t)).toEqual({ actividadCodigo: 'atencion_padres', etiqueta: null });
  });

  it.each(['AT. ALUMNOS', 'AT.ALUMNOS', 'Ate. alumnos', 'ATENCIÓN ALUMNADO'])('%s → atención a alumnado', (t) => {
    expect(reconocerHoraProfe(t)?.actividadCodigo).toBe('atencion_alumnos');
  });

  it('reuniones con nombre', () => {
    expect(reconocerHoraProfe('TIC')).toEqual({ actividadCodigo: 'reunion', etiqueta: 'TIC' });
    expect(reconocerHoraProfe('INNOVACIÓN')).toEqual({ actividadCodigo: 'reunion', etiqueta: 'Innovación' });
    expect(reconocerHoraProfe('Innovacion')).toEqual({ actividadCodigo: 'reunion', etiqueta: 'Innovación' });
    expect(reconocerHoraProfe('PASTORAL')).toEqual({ actividadCodigo: 'reunion', etiqueta: 'Pastoral' });
    expect(reconocerHoraProfe('COCOPE*')).toEqual({ actividadCodigo: 'reunion', etiqueta: 'COCOPE' });
    expect(reconocerHoraProfe('COCOPE ESO')).toEqual({ actividadCodigo: 'reunion', etiqueta: 'COCOPE ESO' });
    expect(reconocerHoraProfe('ERASMUS')).toEqual({ actividadCodigo: 'reunion', etiqueta: 'Erasmus' });
  });

  it('cargos y coordinaciones', () => {
    expect(reconocerHoraProfe('JE')).toEqual({ actividadCodigo: 'coordinacion', etiqueta: 'Jefatura de estudios' });
    expect(reconocerHoraProfe('C.PASTORAL')).toEqual({ actividadCodigo: 'coordinacion', etiqueta: 'Coordinación de pastoral' });
    expect(reconocerHoraProfe('C. PASTORAL')).toEqual({ actividadCodigo: 'coordinacion', etiqueta: 'Coordinación de pastoral' });
    expect(reconocerHoraProfe('WEB')).toEqual({ actividadCodigo: 'coordinacion', etiqueta: 'Web' });
    expect(reconocerHoraProfe('COORD. TIC')).toEqual({ actividadCodigo: 'coordinacion', etiqueta: 'Coordinación TIC' });
  });

  it('departamento, oratorio, guardia, no lectiva, refuerzo', () => {
    expect(reconocerHoraProfe('DPTO')).toEqual({ actividadCodigo: 'departamento', etiqueta: null });
    expect(reconocerHoraProfe('Dpto.')).toEqual({ actividadCodigo: 'departamento', etiqueta: null });
    expect(reconocerHoraProfe('DPTO/C.')).toEqual({ actividadCodigo: 'departamento', etiqueta: 'DPTO/C.' });
    expect(reconocerHoraProfe('ORATORIO')?.actividadCodigo).toBe('oratorio');
    expect(reconocerHoraProfe('Guardia')).toEqual({ actividadCodigo: 'guardia', etiqueta: null });
    expect(reconocerHoraProfe('GUARDIA PATIO')).toEqual({ actividadCodigo: 'guardia', etiqueta: 'GUARDIA PATIO' });
    expect(reconocerHoraProfe('No lectiva')).toEqual({ actividadCodigo: 'libre_disposicion', etiqueta: 'No lectiva' });
    expect(reconocerHoraProfe('Refuerzo')).toEqual({ actividadCodigo: 'otros', etiqueta: 'Refuerzo' });
  });

  it('lo que no se sabe qué es devuelve null (y no se inventa)', () => {
    expect(reconocerHoraProfe('CosaRara')).toBeNull();
    expect(reconocerHoraProfe('MATE')).toBeNull();
  });
});

describe('clases en la hoja de un profe', () => {
  it('formato de Educamos', () => {
    expect(parsearClaseHojaProfe('FIS: 2ESOA')).toEqual({ materiaTexto: 'FIS', curso: '2ESO', letra: 'A', aMano: false });
    expect(parsearClaseHojaProfe('MAT B: 4ESOA')).toEqual({ materiaTexto: 'MAT B', curso: '4ESO', letra: 'A', aMano: false });
    expect(parsearClaseHojaProfe('NG: 4º PPDC')).toEqual({ materiaTexto: 'NG', curso: '4ESO', letra: 'PDC', aMano: false });
  });

  it('a mano, con º, con la etapa o con la letra', () => {
    expect(parsearClaseHojaProfe('MATE 1ºB')).toEqual({ materiaTexto: 'MATE', curso: '1ESO', letra: 'B', aMano: true });
    expect(parsearClaseHojaProfe('TECNO 3ºB*')).toEqual({ materiaTexto: 'TECNO', curso: '3ESO', letra: 'B', aMano: true });
    expect(parsearClaseHojaProfe('TUT: 4 ESO')).toEqual({ materiaTexto: 'TUT', curso: '4ESO', letra: null, aMano: true });
    expect(parsearClaseHojaProfe('FIS 2º A')).toEqual({ materiaTexto: 'FIS', curso: '2ESO', letra: 'A', aMano: true });
    expect(parsearClaseHojaProfe('MATE 3º PDC')).toEqual({ materiaTexto: 'MATE', curso: '3ESO', letra: 'PDC', aMano: true });
  });

  it('sin nada que delate un grupo no es una clase', () => {
    expect(parsearClaseHojaProfe('REUNIÓN 1')).toBeNull();
    expect(parsearClaseHojaProfe('TIC')).toBeNull();
    expect(parsearClaseHojaProfe('AT. PADRES')).toBeNull();
  });
});

describe('casar la hoja de un profe con su código', () => {
  const leyenda = parsearLeyendas(LEYENDA_COMUN).profes;
  it('por la leyenda, con tildes, mayúsculas y lo que va entre paréntesis', () => {
    expect(casarProfePorNombre('Ana Álvarez Alonso', leyenda)).toBe('AAAA0');
    expect(casarProfePorNombre('ELENA ESTEVE', leyenda)).toBe('EEEE0');
  });
  it('por el claustro de la BBDD si no está en la leyenda, y solo con un candidato', () => {
    expect(casarProfePorNombre('FABIOLA FERRER', leyenda, CLAUSTRO)).toBe('FFER0');
    expect(casarProfePorNombre('NADIE CONOCIDO', leyenda, CLAUSTRO)).toBeNull();
    expect(
      casarProfePorNombre('MARIA PERIS', new Map(), [
        { alias: 'MPER0', nombre: 'MARIA PERIS ROS' },
        { alias: 'MPER1', nombre: 'MARIA PERIS SOLER' },
      ]),
    ).toBeNull();
  });
});

describe('prepararImportacion: el fichero entero', () => {
  const prep = prepararImportacion(FICHERO, CLAUSTRO);
  const bloque = (codigo: string) => prep.clases.find((c) => c.clase?.codigo === codigo)!;
  const sesion = (codigo: string, dia: number) => bloque(codigo).sesiones.find((s) => s.dia === dia && s.orden === 1)!;
  const horasDe = (alias: string) => prep.horasProfe.filter((h) => h.profeCodigos.includes(alias));

  it('el inglés del PDC: la segunda profe al PDC, la primera al grupo de referencia', () => {
    expect(sesion('4º PPDC', 1).profeCodigos).toEqual(['CCCC0']);
    expect(sesion('4ESOB', 1).profeCodigos).toEqual(['BBBB0']);
    expect(prep.ajustes.some((a) => a.includes('CCCC0 da clase al PDC'))).toBe(true);
  });

  it("y el 'NG' del PDC toma la materia del grupo de referencia (es la misma celda)", () => {
    expect(sesion('4º PPDC', 2).materiaCodigo).toBe('ING');
    expect(sesion('4º PPDC', 2).profeCodigos).toEqual(['CCCC0']);
    expect(sesion('4ESOB', 2).profeCodigos).toEqual(['BBBB0']);
  });

  it('una celda de PDC con dos profes que NO está en el grupo de referencia no se toca', () => {
    const solo: BloqueEntrada[] = [
      clase('4ESOB: 4º ESO-B', [['De 08:00 a 08:55', 'TUT - BBBB0', '', '', '', '']], LEYENDA_COMUN),
      clase('4º PPDC: 4º ESO-PDC', [['De 08:00 a 08:55', 'ING - BBBB0\nCCCC0', '', '', '', '']], LEYENDA_COMUN),
    ];
    const p = prepararImportacion(solo);
    expect(p.clases[1].sesiones[0].profeCodigos).toEqual(['BBBB0', 'CCCC0']);
  });

  it('las horas que no son clase, con todas las formas de escribirlas', () => {
    const ana = horasDe('AAAA0');
    const padres = ana.find((h) => h.actividadCodigo === 'atencion_padres')!;
    expect(padres.sesiones).toHaveLength(4); // AT. PADRES · AT.PADRES · Ate. padres · ATENCIÓN FAMILIAS
    expect(ana.find((h) => h.etiqueta === 'Jefatura de estudios')?.actividadCodigo).toBe('coordinacion');
    expect(ana.find((h) => h.actividadCodigo === 'departamento')).toBeDefined();
    // Las clases de su hoja no se convierten en horas suyas: ya salen de la hoja de la clase.
    expect(ana.every((h) => h.actividadCodigo !== 'clase')).toBe(true);
  });

  it('una reunión a la misma hora es UNA asignación con todos sus profes', () => {
    const tic = prep.horasProfe.filter((h) => h.etiqueta === 'TIC' && h.sesiones.some((s) => s.dia === 1));
    expect(tic).toHaveLength(1);
    expect(tic[0].profeCodigos).toEqual(['AAAA0', 'BBBB0', 'DDDD0']);
    const pastoral = prep.horasProfe.find((h) => h.etiqueta === 'Pastoral')!;
    expect(pastoral.profeCodigos).toEqual(['BBBB0', 'DDDD0']);
  });

  it('pero la atención a familias de dos profes a la misma hora NO se junta', () => {
    const p = prepararImportacion([
      FICHERO[0],
      profe('ANA ALVAREZ ALONSO', [['De 08:00 a 08:55', 'AT. PADRES', '', '', '', '']]),
      profe('BEATRIZ BLANCO BAEZA', [['De 08:00 a 08:55', 'AT.PADRES', '', '', '', '']]),
    ]);
    expect(p.horasProfe).toHaveLength(2);
  });

  it("celdas con asterisco: 'COCOPE*' + 'DPTO' es UNA hora con las dos cosas", () => {
    const b = horasDe('BBBB0').find((h) => h.etiqueta?.includes('COCOPE'))!;
    expect(b.actividadCodigo).toBe('departamento');
    expect(b.etiqueta).toBe('Departamento | COCOPE');
    const d = horasDe('DDDD0').find((h) => h.actividadCodigo === 'oratorio')!;
    expect(d.etiqueta).toBe('Oratorio | TYD3: 1ESOA');
  });

  it('lo que no se reconoce entra como Otros con su texto, y se avisa', () => {
    const rara = horasDe('BBBB0').find((h) => h.etiqueta === 'CosaRara')!;
    expect(rara.actividadCodigo).toBe('otros');
    expect(prep.incidencias.some((i) => i.tipo === 'actividad_desconocida' && i.crudo === 'CosaRara')).toBe(true);
  });

  it('una profe que se apunta una clase que la hoja de la clase no nombra entra de segunda profe', () => {
    expect(sesion('1ESOA', 1).profeCodigos).toEqual(['AAAA0', 'FFER0']);
    expect(bloque('1ESOA').sesiones.find((s) => s.dia === 2)!.profeCodigos).toEqual(['AAAA0', 'FFER0']);
    expect(prep.ajustes.some((a) => a.startsWith('FABIOLA FERRER entra como segundo profe en MATE de 1ESO A (2 h/semana)'))).toBe(true);
  });

  it('…y si a esa hora no hay ninguna clase que case, entra como hora suya y se avisa', () => {
    // 'TUT 4ºB' el viernes, y 4º B el viernes a esa hora no tiene nada.
    expect(horasDe('FFER0').find((h) => h.etiqueta === 'TUT 4ºB')?.actividadCodigo).toBe('otros');
    expect(prep.incidencias.some((i) => i.tipo === 'solo_en_hoja_profe')).toBe(true);
  });

  it('si lo que se apunta no casa con la clase que hay a esa hora, NO se mete en ella', () => {
    const p = prepararImportacion([
      clase('1ESOA: 1º ESO-A', [['De 08:00 a 08:55', 'TUT - AAAA0', '', '', '', '']], LEYENDA_COMUN),
      profe('FABIOLA FERRER', [['De 08:00 a 08:55', 'FIS 1ºA', '', '', '', '']]),
    ], CLAUSTRO);
    expect(p.clases[0].sesiones[0].profeCodigos).toEqual(['AAAA0']);
    expect(p.horasProfe[0].etiqueta).toBe('FIS 1ºA');
    expect(p.incidencias[0].tipo).toBe('solo_en_hoja_profe');
  });

  it('el titular sigue siendo el primero de la celda, no el primero por orden alfabético', () => {
    // 'TYD3 - EEEE0' + 'DDDD0': EEEE0 es la titular aunque DDDD0 vaya antes en el alfabeto.
    const asig = agruparSesiones(prep.clases, (c) => c);
    expect(asig.find((a) => a.materiaCodigo === 'TYD3')!.profeCodigos).toEqual(['EEEE0', 'DDDD0']);
    // Y lo mismo con quien entra desde su hoja: FFER0 va detrás de AAAA0.
    expect(asig.find((a) => a.materiaCodigo === 'MAT1')!.profeCodigos).toEqual(['AAAA0', 'FFER0']);
  });

  it('una hoja que no casa con nadie se avisa y no se importa', () => {
    const p = prepararImportacion([FICHERO[0], profe('PERSONA DESCONOCIDA', [['De 08:00 a 08:55', 'TIC', '', '', '', '']])]);
    expect(p.horasProfe).toHaveLength(0);
    expect(p.incidencias[0].tipo).toBe('profe_desconocido');
  });
});

describe('Google Calendar: horas seguidas de lo mismo = un evento', () => {
  const celda = (asignacionId: string, dia: number, horaInicio: string, horaFin: string) =>
    ({ asignacionId, dia, horaInicio, horaFin, sesionId: `${asignacionId}-${horaInicio}` }) as unknown as CeldaHorario;
  const franja = (dia: number, horaInicio: string, horaFin: string, tipo: Franja['tipo'] = 'sesion') =>
    ({ tramoId: `${dia}-${horaInicio}`, dia, horaInicio, horaFin, tipo }) as Franja;
  const rejilla = [
    franja(4, '08:55', '09:50'), franja(4, '09:50', '10:45'), franja(4, '10:45', '11:05', 'recreo'),
    franja(4, '11:05', '12:10'), franja(4, '12:10', '13:05'),
  ];

  it('la pastoral de antes y de después del patio es UNA reunión de 09:50 a 12:10', () => {
    const r = unirSesionesSeguidas([celda('past', 4, '09:50', '10:45'), celda('past', 4, '11:05', '12:10')], rejilla);
    expect(r).toHaveLength(1);
    expect([r[0].horaInicio, r[0].horaFin]).toEqual(['09:50', '12:10']);
  });

  it('con una hora lectiva en medio (libre o de otra cosa) no se juntan', () => {
    const r = unirSesionesSeguidas([celda('mat', 4, '08:55', '09:50'), celda('mat', 4, '11:05', '12:10')], rejilla);
    expect(r).toHaveLength(2);
  });

  it('cosas distintas pegadas no se juntan, y no se toca la celda original', () => {
    const a = celda('a', 4, '08:55', '09:50');
    const r = unirSesionesSeguidas([a, celda('b', 4, '09:50', '10:45')], rejilla);
    expect(r).toHaveLength(2);
    unirSesionesSeguidas([a, celda('a', 4, '09:50', '10:45')], rejilla);
    expect(a.horaFin).toBe('09:50');
  });
});
