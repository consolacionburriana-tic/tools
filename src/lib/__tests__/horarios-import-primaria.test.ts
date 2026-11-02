import { describe, expect, it } from 'vitest';

import {
  horasFueraDeFranja,
  normalizarBloqueClase,
  parsearCeldaClase,
  parsearClaseHojaProfe,
  parsearLeyendaReuniones,
  parsearLeyendas,
  prepararImportacion,
  reconocerHoraProfe,
  type BloqueEntrada,
} from '@/lib/horarios-import';

// Fixtures INVENTADOS que imitan el fichero de infantil y primaria de Educamos 2026-27: nombres
// y códigos de profesorado ficticios (docs/04-convenciones-tecnicas.md). La forma de cada celda
// —y de las leyendas del pie— sí es la del fichero real.

const DIAS = ['Horas', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

function clase(titulo: string, filas: string[][], leyenda: string[]): BloqueEntrada {
  return { tipo: 'clase', titulo, filas: [[titulo], DIAS, ...filas, ...leyenda.map((l) => [l])] };
}
function profe(nombre: string, filas: string[][], leyenda: string[] = []): BloqueEntrada {
  return { tipo: 'profe', titulo: nombre, filas: [[nombre], DIAS, ...filas, ...leyenda.map((l) => [l])] };
}

const LEY_EP = [
  'Materias:', 'MAT4: Matemáticas', 'LEN4: Lengua', 'MYD4: Music', 'EFI4: Educació Física',
  'Profesores:', 'AAAA0: ANA ALVAREZ ALONSO', 'BBBB0: BEATRIZ BLANCO BAEZA', 'CCCC0: CARMEN CASTRO CANO',
  'Aulas:', 'MUS: MÚSICA', 'POLI: POLIDEPORTIVO',
];
const LEY_INF = [
  'Materias:', 'Lu: Ludiletras', 'eMat: eMat',
  'Profesores:', 'DDDD0: DIANA DIAZ DURAN', 'EEEE0: ELENA ESTEVE',
];

// Primaria: rejilla 09:00-09:45 / 09:45-10:30 / 12:30-13:30. Infantil: 09:00-10:10 / 10:35-10:45 (almuerzo).
const FICHERO: BloqueEntrada[] = [
  clase('4PRIB: 4º EP-B', [
    ['De 09:00 a 09:45', 'MAT4 - AAAA0 BBBB0', 'MYD4 - BBBB0 - MUS', 'LEN4 - AAAA0', '', ''],
    ['De 09:45 a 10:30', 'LEN4 - AAAA0', 'MAT4 - AAAA0', '', '', ''],
    ['De 12:30 a 13:30', '', '', '', '', ''],
  ], LEY_EP),
  clase('4INFB: 4 años-B', [
    ['De 09:00 a 10:10', '', '', 'Lu - EEEE0', '', ''],
  ], LEY_INF),
  clase('3INFA: 3 años-A', [
    ['De 09:00 a 10:10', 'Lu - DDDD0\nPT', 'Lu - DDDD0', '', '', ''],
    ['De 10:35 a 10:45', 'Otros', 'Otros', 'Otros', 'Otros', 'Otros'],
    ['De 10:45 a 11:35', 'eMat - DDDD0', 'eMat - DDDD0', '', '', ''],
  ], LEY_INF),
  // Una profe de primaria que también da en la ESO: su hoja trae líneas de ESO, que no son de este fichero.
  profe('ANA ALVAREZ ALONSO', [
    ['De 09:00 a 09:45', 'MAT4: 4PRIB', 'MYD4: 4PRIB - MUS', 'LEN4: 4PRIB - POLI', 'REL 2º B ESO\n(08:55-9:50)', 'PATIO ESO\n(10:40-11:00)'],
    ['De 09:45 a 10:30', 'LEN4: 4PRIB -', '', '', 'PAST', ''],
    ['De 12:30 a 13:30', '', 'COORDINACIÓN', '', 'CICLOS', 'AT. PADRES/R. ESO'],
  ], ['Reuniones:', 'PAST: Pastoral (AAAA0, DDDD0)', 'Materias:']),
  // Una de infantil: su pastoral va escrita en la rejilla de infantil, con la hora real entre paréntesis.
  profe('DIANA DIAZ DURAN', [
    ['De 09:00 a 10:10', 'Lu: 3INFA', '', 'Cod. 4 años B', '', ''],
    ['De 10:35 a 10:45', 'Otros', 'Almuerzo', '', 'PAST\n(09:45 - 10:30)', ''],
    ['De 12:30 a 13:30', '', 'COORDINACIÓN', '', 'CICLO', ''],
  ], ['Reuniones:', 'PAST: Pastoral (AAAA0, DDDD0)', 'Materias:']),
];

describe('celdas de las clases', () => {
  const ley = parsearLeyendas(LEY_EP);
  it('dos profes en la misma línea, sin salto: cuentan los dos', () => {
    const { sesiones, incidencias } = parsearCeldaClase('MAT4 - AAAA0 BBBB0', ley);
    expect(sesiones[0].profeCodigos).toEqual(['AAAA0', 'BBBB0']);
    expect(incidencias).toEqual([]);
  });
  it("'Otros' no es un código que falte en la leyenda", () => {
    const { sesiones, incidencias } = parsearCeldaClase('Otros', ley);
    expect(incidencias).toEqual([]);
    expect(sesiones[0]).toMatchObject({ materiaCodigo: null, actividadCodigo: 'otros', crudo: 'Otros' });
  });
  it("'Otros' de diez minutos es el almuerzo; en una franja larga se queda como Otros", () => {
    const largo = normalizarBloqueClase([
      ['4PRIB: 4º EP-B'], DIAS,
      ['De 10:35 a 10:45', 'Otros', '', '', '', ''],
      ['De 10:45 a 11:35', 'Otros', '', '', '', ''],
    ]);
    expect(largo.sesiones.map((s) => s.crudo)).toEqual(['Almuerzo', 'Otros']);
    expect(largo.incidencias).toEqual([]);
  });
});

describe('la leyenda Reuniones: del pie de la hoja de un profe', () => {
  const l = parsearLeyendaReuniones(['Reuniones:', 'INNOV: Innovación (MAGU0, CPAR0)', 'COM: Comunicación (MGUE0, NCRO0)', 'Materias:', 'LEN6: Lengua - 6PRIA']);
  it('lee el código, el nombre y quién va', () => {
    expect(l.get('INNOV')).toEqual({ nombre: 'Innovación', miembros: ['MAGU0', 'CPAR0'] });
    expect(l.get('COM')?.nombre).toBe('Comunicación');
    expect(l.has('LEN6')).toBe(false); // lo de Materias: no es una reunión
  });
  it("'Reuniones:' no se cuela en la leyenda de materias o profesores", () => {
    const ley = parsearLeyendas(['Profesores:', 'AAAA0: ANA', 'Reuniones:', 'PAST: Pastoral (AAAA0)']);
    expect([...ley.profes.keys()]).toEqual(['AAAA0']);
  });
  it('con ella se reconoce lo que no se reconocería, por código y por nombre', () => {
    expect(reconocerHoraProfe('COM')).toBeNull();
    expect(reconocerHoraProfe('COM', l)).toEqual({ actividadCodigo: 'reunion', etiqueta: 'Comunicación' });
    expect(reconocerHoraProfe('COMUNICACIÓN', l)?.etiqueta).toBe('Comunicación');
    expect(reconocerHoraProfe('INNOV', l)?.etiqueta).toBe('Innovación');
  });
});

describe('lo escrito a mano que antes salía como «no se sabe qué es»', () => {
  it.each([
    ['COORDINACIÓN', 'reunion', 'Coordinación'],
    ['CICLO', 'reunion', 'Reunión de ciclo'],
    ['CICLOS', 'reunion', 'Reunión de ciclo'],
    ['PAST', 'reunion', 'Pastoral'],
    ['EQ. DIRECTIVO', 'reunion', 'Equipo directivo'],
    ['R. ETE', 'reunion', 'Reunión ETE'],
    ['R. ORIENTACIÓN', 'reunion', 'Reunión Orientación'],
    ['REUNIONES E.T.E', 'reunion', 'Reunión ETE'],
    ['R. E.T.E', 'reunion', 'Reunión ETE'],
    ['TUT. INDIV.', 'tutoria', 'Tutoría individual'],
    ['GODLY', 'oratorio', 'Godly Play'],
    ['HUERTO', 'oratorio', 'Huerto'], // será otra sección de Oratorios, Godly Play y Talleres
    ['EUCARISTÍA', 'otros', 'Eucaristía'],
    ['Almuerzo', 'otros', 'Almuerzo'],
    ['PATIO ESO', 'guardia', 'PATIO ESO'],
    ['T. PENS. COMP. 3ºA', 'otros', 'Taller de Pensamiento Computacional · 3ºA'],
    ['T. PENS. COMP. 3ER CICLO', 'otros', 'Taller de Pensamiento Computacional · 3ER CICLO'],
  ])('%s → %s · %s', (texto, actividad, etiqueta) => {
    const r = reconocerHoraProfe(texto);
    expect(r?.actividadCodigo).toBe(actividad);
    expect(r?.etiqueta).toBe(etiqueta);
  });

  it("'COORDINACIÓN' a secas es una reunión, pero un cargo con nombre sigue siendo cargo", () => {
    expect(reconocerHoraProfe('COORD. TIC')?.actividadCodigo).toBe('coordinacion');
    expect(reconocerHoraProfe('C. PASTORAL')?.actividadCodigo).toBe('coordinacion');
  });

  it('un apoyo con nombre de alumno dentro lo pierde y avisa, y el resto de apoyos no se toca', () => {
    const r = reconocerHoraProfe('AL Aitana 2º ESO A');
    expect(r).toEqual({ actividadCodigo: 'apoyo_al', etiqueta: 'AL 2º ESO A', datoPersonal: true });
    expect(reconocerHoraProfe('AL ROBERTO 3ºPDC NATALIA 2º ESO A')?.etiqueta).toBe('AL 3ºPDC 2º ESO A');
    for (const t of ['AL 4 AÑOS B', 'PT 1ºB', 'AL 5ºA/5ºB-6ºB', 'AL 2ºB/3ºA', 'AL 5º y 6º']) {
      expect(reconocerHoraProfe(t)).toEqual({ actividadCodigo: t.startsWith('PT') ? 'apoyo_pt' : 'apoyo_al', etiqueta: t });
    }
  });
});

describe('clases en la hoja de un profe: lo nuevo de primaria', () => {
  it('formato de Educamos con aula y con dos grupos', () => {
    expect(parsearClaseHojaProfe('MYD1: 1PRIB - MUS')).toEqual({ materiaTexto: 'MYD1', curso: '1PRI', letra: 'B', aMano: false });
    expect(parsearClaseHojaProfe('EFI6: 6PRIB - POLI')?.curso).toBe('6PRI');
    expect(parsearClaseHojaProfe('EFI4: 4PRIB -')).toEqual({ materiaTexto: 'EFI4', curso: '4PRI', letra: 'B', aMano: false });
    expect(parsearClaseHojaProfe('LEN3: 3PRIA y B')).toEqual({ materiaTexto: 'LEN3', curso: '3PRI', letra: null, aMano: false });
  });

  it("'COD.' es codocencia: la materia va sin el prefijo", () => {
    expect(parsearClaseHojaProfe('COD. LCO5: 5PRIA')).toEqual({ materiaTexto: 'LCO5', curso: '5PRI', letra: 'A', aMano: false, codocencia: true });
    expect(parsearClaseHojaProfe('Cod. 4 años B', 'PRI')).toEqual({ materiaTexto: '', curso: '4INF', letra: 'B', aMano: true, codocencia: true });
    expect(parsearClaseHojaProfe('COD. 3º', 'PRI')).toEqual({ materiaTexto: '', curso: '3PRI', letra: null, aMano: true, codocencia: true });
  });

  it('el grupo escrito de otras maneras (ESO, infantil, dos grupos a la vez)', () => {
    expect(parsearClaseHojaProfe('REL 2º B ESO')).toMatchObject({ materiaTexto: 'REL', curso: '2ESO', letra: 'B' });
    expect(parsearClaseHojaProfe('4º A ESO')).toMatchObject({ materiaTexto: '', curso: '4ESO', letra: 'A' });
    expect(parsearClaseHojaProfe('3º  B ESO')).toMatchObject({ curso: '3ESO', letra: 'B' });
    expect(parsearClaseHojaProfe('3º ESO A+PDC')).toMatchObject({ curso: '3ESO', letra: null });
    expect(parsearClaseHojaProfe('4º B ESO +PDC')).toMatchObject({ curso: '4ESO', letra: null });
    expect(parsearClaseHojaProfe('REL 3º A+ PDC ESO')).toMatchObject({ materiaTexto: 'REL', curso: '3ESO', letra: null });
    expect(parsearClaseHojaProfe('INFANTIL 3 AÑOS')).toEqual({ materiaTexto: '', curso: '3INF', letra: null, aMano: true });
    expect(parsearClaseHojaProfe('5ºB', 'PRI')).toEqual({ materiaTexto: '', curso: '5PRI', letra: 'B', aMano: true });
  });

  it('lo que no es un grupo sigue sin serlo', () => {
    expect(parsearClaseHojaProfe('REUNIÓN 1')).toBeNull();
    expect(parsearClaseHojaProfe('COORDINACIÓN')).toBeNull();
    expect(parsearClaseHojaProfe('AT. PADRES/R. ESO')).toBeNull();
  });
});

describe('prepararImportacion con un fichero de primaria e infantil', () => {
  const prep = prepararImportacion(FICHERO, []);
  const horas = (alias: string) => prep.horasProfe.filter((h) => h.profeCodigos.includes(alias));

  it('no queda ningún aviso por lo que ya se sabe qué es', () => {
    expect(prep.incidencias).toEqual([]);
    expect(prep.clases.flatMap((c) => c.incidencias)).toEqual([]);
  });

  it('la celda con dos profes en la misma línea los tiene a los dos', () => {
    const b = prep.clases.find((c) => c.clase?.codigo === '4PRIB')!;
    expect(b.sesiones.find((s) => s.dia === 1 && s.orden === 1)!.profeCodigos).toEqual(['AAAA0', 'BBBB0']);
  });

  it("las clases de la propia hoja (con aula, o con el '-' colgando) no se repiten como horas sueltas", () => {
    expect(horas('AAAA0').some((h) => /MYD4|LEN4|MAT4/.test(h.etiqueta ?? ''))).toBe(false);
    expect(horas('AAAA0').some((h) => h.actividadCodigo === 'otros')).toBe(false);
  });

  it('lo de otra etapa que lleva en su hoja no se importa y se cuenta como ajuste, sin avisar', () => {
    expect(horas('AAAA0').some((h) => /ESO/.test(h.etiqueta ?? ''))).toBe(false);
    expect(prep.ajustes.some((a) => a.includes('ANA ALVAREZ ALONSO') && a.includes('otra etapa') && a.includes('REL 2º B ESO'))).toBe(true);
  });

  it('la pastoral de infantil, con su hora real entre paréntesis, es UNA reunión con la de primaria', () => {
    const pastoral = prep.horasProfe.filter((h) => h.etiqueta === 'Pastoral');
    expect(pastoral).toHaveLength(1);
    expect(pastoral[0].profeCodigos).toEqual(['AAAA0', 'DDDD0']);
    expect(pastoral[0].sesiones).toEqual([{ dia: 4, horaInicio: '09:45', horaFin: '10:30' }]);
  });

  it('coordinación del martes y ciclo del jueves: una reunión para todos, no una hora por profe', () => {
    const coord = prep.horasProfe.filter((h) => h.etiqueta === 'Coordinación');
    expect(coord).toHaveLength(1);
    expect(coord[0].profeCodigos).toEqual(['AAAA0', 'DDDD0']);
    const ciclo = prep.horasProfe.filter((h) => h.etiqueta === 'Reunión de ciclo');
    expect(ciclo).toHaveLength(1);
    expect(ciclo[0].sesiones.every((s) => s.dia === 4)).toBe(true);
  });

  it("'AT. PADRES/R. ESO' en un fichero sin ESO se queda en la atención a familias", () => {
    const padres = horas('AAAA0').find((h) => h.actividadCodigo === 'atencion_padres');
    expect(padres?.sesiones).toEqual([{ dia: 5, horaInicio: '12:30', horaFin: '13:30' }]);
  });

  it('el Almuerzo de diez minutos: lo que pone Otros y lo que pone Almuerzo es lo mismo', () => {
    const alm = horas('DDDD0').filter((h) => h.etiqueta === 'Almuerzo');
    expect(alm).toHaveLength(1);
    expect(alm[0].sesiones.map((s) => s.dia)).toEqual([1, 2]);
  });

  it("'Cod. 4 años B' entra como segundo profe en la clase de 4 años B a esa hora, y se dice", () => {
    const b = prep.clases.find((c) => c.clase?.codigo === '4INFB')!;
    expect(b.sesiones[0].profeCodigos).toEqual(['EEEE0', 'DDDD0']);
    expect(prep.ajustes.some((a) => a.includes('DIANA DIAZ DURAN entra como segundo profe en 4INF B (codocencia'))).toBe(true);
  });

  it('las horas que no caen en ninguna franja se dicen antes de importar (entran en una franja del centro)', () => {
    const p = prepararImportacion([
      ...FICHERO.slice(0, 2),
      profe('ANA ALVAREZ ALONSO', [['De 08:00 a 09:00', 'DIRECCIÓN', '', '', '', ''], ['De 09:00 a 09:45', 'COORDINACIÓN', '', '', '', '']]),
    ], []);
    const avisos = horasFueraDeFranja(p.horasProfe, p.clases);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain('AAAA0');
    expect(avisos[0]).toContain('08:00-09:00');
    expect(p.fueraDeFranja).toEqual(avisos);
  });

  it('una hoja de dos personas es de la que sale en las leyendas', () => {
    const p = prepararImportacion([
      FICHERO[0],
      profe('ANA ALVAREZ ALONSO/SANDRA OTRA', [['De 09:00 a 09:45', 'COORDINACIÓN', '', '', '', '']]),
    ], []);
    expect(p.incidencias).toEqual([]);
    expect(p.horasProfe[0].profeCodigos).toEqual(['AAAA0']);
    expect(p.ajustes.some((a) => a.includes('es de dos personas'))).toBe(true);
  });

  it('un grupo suelto sin materia (lo que hace una profe de apoyo) no la mete de segunda profe en la clase', () => {
    const p = prepararImportacion([
      FICHERO[0],
      profe('BEATRIZ BLANCO BAEZA', [['De 09:00 a 09:45', '4ºB', '', '', '', '']]),
    ], []);
    const b = p.clases[0];
    expect(b.sesiones.find((s) => s.dia === 1 && s.orden === 1)!.profeCodigos).toEqual(['AAAA0', 'BBBB0']); // ya estaba en la clase
    const solo = prepararImportacion([
      clase('4PRIB: 4º EP-B', [['De 09:00 a 09:45', 'MAT4 - AAAA0', '', '', '', '']], LEY_EP),
      profe('BEATRIZ BLANCO BAEZA', [['De 09:00 a 09:45', '4ºB', '', '', '', '']]),
    ], []);
    expect(solo.clases[0].sesiones[0].profeCodigos).toEqual(['AAAA0']);
    expect(solo.horasProfe[0].etiqueta).toBe('4ºB');
    expect(solo.incidencias).toEqual([]);
  });

  it('la PT de infantil: su 5ºB / INFANTIL 3 AÑOS suelto es la celda PT sin nombre de esa clase', () => {
    const leyOrientacion = ['Reuniones:', 'ORIE: Dpto. Orientación (BBBB0, GGGG0)', 'Materias:'];
    const clasesPt = [
      clase('3INFA: 3 años-A', [['De 09:00 a 10:10', 'Lu - DDDD0\nPT', 'Lu - DDDD0\nPT', '', '', '']], LEY_INF),
      clase('3INFB: 3 años-B', [['De 09:00 a 10:10', 'Lu - EEEE0\nPT', '', '', '', '']], LEY_INF),
      clase('4PRIB: 4º EP-B', [['De 09:00 a 09:45', '', '', 'MAT4 - AAAA0\nPT', '', '']], LEY_EP),
    ];
    const p = prepararImportacion([
      ...clasesPt,
      // Es de Orientación (sale en la leyenda de ORIE): el grupo suelto es de la PT.
      profe('BEATRIZ BLANCO BAEZA', [['De 09:00 a 09:45', 'INFANTIL 3 AÑOS', 'INFANTIL 3 AÑOS', '4º EP B', '', '']], leyOrientacion),
    ], []);
    const pt = (codigo: string, dia: number) => p.clases.find((c) => c.clase?.codigo === codigo)!.sesiones.find((s) => s.dia === dia && s.actividadCodigo === 'apoyo_pt')!;
    expect(pt('3INFA', 1).profeCodigos).toEqual(['BBBB0']);
    expect(pt('3INFB', 1).profeCodigos).toEqual(['BBBB0']);
    expect(pt('3INFA', 2).profeCodigos).toEqual(['BBBB0']); // el martes
    expect(pt('4PRIB', 3).profeCodigos).toEqual(['BBBB0']); // '4ºB' suelto en primaria, también
    expect(p.horasProfe).toEqual([]); // no queda además como hora suelta suya
    expect(p.ajustes.some((a) => a.includes('BEATRIZ BLANCO BAEZA entra como PT en 3INF A y 3INF B'))).toBe(true);
    expect(p.incidencias).toEqual([]);
  });

  it('…pero el mismo grupo suelto de alguien que NO es de Orientación sigue siendo una hora suya', () => {
    const p = prepararImportacion([
      clase('3INFA: 3 años-A', [['De 09:00 a 10:10', 'Lu - DDDD0\nPT', '', '', '', '']], LEY_INF),
      profe('ELENA ESTEVE', [['De 09:00 a 09:45', 'INFANTIL 3 AÑOS', '', '', '', '']]),
    ], []);
    expect(p.clases[0].sesiones.find((s) => s.actividadCodigo === 'apoyo_pt')!.profeCodigos).toEqual([]);
    expect(p.horasProfe[0].etiqueta).toBe('INFANTIL 3 AÑOS');
  });

  it('la codocencia sí entra como segundo profe, y solo si hay UNA clase a esa hora', () => {
    const p = prepararImportacion([
      clase('4PRIB: 4º EP-B', [['De 09:00 a 09:45', 'MAT4 - AAAA0', '', '', '', '']], LEY_EP),
      profe('BEATRIZ BLANCO BAEZA', [['De 09:00 a 09:45', 'COD. MAT4: 4PRIB', '', '', '', '']]),
    ], []);
    expect(p.clases[0].sesiones[0].profeCodigos).toEqual(['AAAA0', 'BBBB0']);
    expect(p.ajustes.some((a) => a.includes('BEATRIZ BLANCO BAEZA entra como segundo profe en MAT4 de 4PRI B'))).toBe(true);
  });
});
