import { describe, expect, it } from 'vitest';

import {
  normalizarBloqueClase,
  parsearCeldaClase,
  parsearCeldaProfe,
  parsearCodigoGrupo,
  parsearLeyendas,
  parsearRangoHoras,
  parsearRejillaDeFila,
  parsearTituloClase,
} from '@/lib/horarios-import';

// Fixtures INVENTADOS que imitan la estructura de los exports de Educamos (nombres y
// códigos de profesorado ficticios, ver docs/04-convenciones-tecnicas.md).
const LEYENDAS = parsearLeyendas([
  'Materias:',
  'LEN1: Lengua Castellana y Literatura',
  'EFI1: Educación Física',
  'MAT1: Matemáticas',
  'Profesores:',
  'AAAA0: ANA ALVAREZ ALONSO',
  'BBBB0: BEATRIZ BLANCO BAEZA',
  'Aulas:',
  'Poli2: Polideportivo 2',
  'MUS: MÚSICA',
]);

describe('leyendas', () => {
  it('separa materias, profesores y aulas', () => {
    expect(LEYENDAS.materias.get('LEN1')).toBe('Lengua Castellana y Literatura');
    expect(LEYENDAS.profes.get('AAAA0')).toBe('ANA ALVAREZ ALONSO');
    expect(LEYENDAS.aulas.get('POLI2')).toBe('Polideportivo 2');
  });

  it('en el horario de profesor, la materia lleva el grupo pegado y se recorta', () => {
    const l = parsearLeyendas(['Materias:', 'LCO5: Valencià: Llengua i Literatura - 5PRIA']);
    expect(l.materias.get('LCO5')).toBe('Valencià: Llengua i Literatura');
  });
});

describe('rangos de horas y grupos', () => {
  it('lee "De 09:00 a 09:45"', () => {
    expect(parsearRangoHoras('De 09:00 a 09:45')).toEqual({ horaInicio: '09:00', horaFin: '09:45' });
    expect(parsearRangoHoras('De 9:00 a 10:10')).toEqual({ horaInicio: '09:00', horaFin: '10:10' });
    expect(parsearRangoHoras('Horas')).toBeNull();
  });

  it('parte el código de grupo en curso y letra', () => {
    expect(parsearCodigoGrupo('2PRIA')).toEqual({ curso: '2PRI', letra: 'A' });
    expect(parsearCodigoGrupo('3INFB')).toEqual({ curso: '3INF', letra: 'B' });
    expect(parsearCodigoGrupo('1ESO')).toEqual({ curso: '1ESO', letra: null });
    expect(parsearCodigoGrupo('no soy un grupo')).toBeNull();
  });

  it('lee el título del bloque', () => {
    expect(parsearTituloClase('1PRIA: 1º EP-A')).toEqual({ codigo: '1PRIA', curso: '1PRI', letra: 'A', nombre: '1º EP-A' });
    expect(parsearTituloClase('3INFA: 3 años-A')?.nombre).toBe('3 años-A');
    expect(parsearTituloClase('Colegio Consolación Burriana')).toBeNull();
  });
});

describe('celdas del horario de clase', () => {
  const una = (t: string) => parsearCeldaClase(t, LEYENDAS).sesiones[0];

  it('materia + profe', () => {
    expect(una('LEN1 - AAAA0')).toMatchObject({ materiaCodigo: 'LEN1', profeCodigos: ['AAAA0'], aulaCodigo: null, actividadCodigo: 'clase' });
  });

  it('materia + profe + aula, distinguiendo aula de profe por la LEYENDA (no por regex)', () => {
    const { sesiones, incidencias } = parsearCeldaClase('EFI1 - AAAA0 - Poli2', LEYENDAS);
    expect(sesiones[0]).toMatchObject({ materiaCodigo: 'EFI1', profeCodigos: ['AAAA0'], aulaCodigo: 'POLI2' });
    expect(incidencias).toEqual([]);
  });

  it('dos profes en la misma hora: la 2ª línea CONTINÚA la anterior, no abre otra sesión', () => {
    const { sesiones } = parsearCeldaClase('MAT1 - AAAA0\nBBBB0', LEYENDAS);
    expect(sesiones).toHaveLength(1);
    expect(sesiones[0].profeCodigos).toEqual(['AAAA0', 'BBBB0']);
  });

  it('una clase Y un apoyo en el mismo hueco son DOS sesiones', () => {
    const { sesiones } = parsearCeldaClase('MAT1 - AAAA0\nPT- BBBB0', LEYENDAS);
    expect(sesiones).toHaveLength(2);
    expect(sesiones[0]).toMatchObject({ materiaCodigo: 'MAT1', actividadCodigo: 'clase', profeCodigos: ['AAAA0'] });
    expect(sesiones[1]).toMatchObject({ actividadCodigo: 'apoyo_pt', profeCodigos: ['BBBB0'] });
  });

  it('recreo, comedor y vacío no son sesiones', () => {
    expect(parsearCeldaClase('Recreo', LEYENDAS).sesiones).toEqual([]);
    expect(parsearCeldaClase('Comedor', LEYENDAS).sesiones).toEqual([]);
    expect(parsearCeldaClase('', LEYENDAS).sesiones).toEqual([]);
  });

  it('un código que no está en ninguna leyenda se reporta, no se adivina', () => {
    const { sesiones, incidencias } = parsearCeldaClase('LEN1 - AAAA0 - ZZZZ', LEYENDAS);
    expect(sesiones[0].aulaCodigo).toBeNull();
    expect(incidencias[0]).toMatchObject({ tipo: 'codigo_desconocido' });
  });

  it('PT y AL: se reconoce la actividad aunque el texto venga sucio', () => {
    expect(una('PT- AAAA0')).toMatchObject({ actividadCodigo: 'apoyo_pt', profeCodigos: ['AAAA0'] });
    expect(una('AL')).toMatchObject({ actividadCodigo: 'apoyo_al', profeCodigos: [] });
    expect(una('PT. 1ºB').actividadCodigo).toBe('apoyo_pt');
    expect(una('AL 5º y 6º').actividadCodigo).toBe('apoyo_al');
    expect(una('AL 4 AÑOS B').actividadCodigo).toBe('apoyo_al');
  });

  it('si una celda de apoyo lleva un nombre de pila, se avisa y NO se importa como dato', () => {
    const { sesiones, incidencias } = parsearCeldaClase('AL Aitana', LEYENDAS);
    expect(sesiones[0].actividadCodigo).toBe('apoyo_al');
    expect(sesiones[0].profeCodigos).toEqual([]);
    expect(incidencias.some((i) => i.tipo === 'dato_personal')).toBe(true);
    // El texto se conserva tal cual para que alguien lo revise, pero no se parsea.
    expect(sesiones[0].crudo).toBe('AL Aitana');
  });
});

describe('celdas del horario de profesor', () => {
  it('materia: grupo', () => {
    expect(parsearCeldaProfe('LCO5: 5PRIA')).toEqual({ materiaCodigo: 'LCO5', curso: '5PRI', letra: 'A' });
  });
  it('recreo y basura devuelven null', () => {
    expect(parsearCeldaProfe('Recreo')).toBeNull();
    expect(parsearCeldaProfe('cualquier cosa')).toBeNull();
  });
});

describe('bloque completo "HORARIO DE CLASE"', () => {
  const bloque = [
    ['Colegio Consolación Burriana'],
    ['HORARIO DE CLASE'],
    ['1PRIA: 1º EP-A'],
    ['Horas', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
    ['De 09:00 a 09:45', 'LEN1 - AAAA0', 'MAT1 - AAAA0', 'LEN1 - AAAA0', 'PT- BBBB0', 'MAT1 - AAAA0\nPT- BBBB0'],
    ['De 09:45 a 10:30', 'MAT1 - AAAA0\nBBBB0', '', 'EFI1 - BBBB0 - Poli2', 'LEN1 - AAAA0', ''],
    ['De 11:15 a 11:45', 'Recreo', 'Recreo', 'Recreo', 'Recreo', 'Recreo'],
    ['De 13:30 a 15:30', 'Comedor', 'Comedor', 'Comedor', 'Comedor', 'Comedor'],
    ['Materias:'],
    ['LEN1: Lengua Castellana y Literatura', 'MAT1: Matemáticas'],
    ['EFI1: Educación Física'],
    ['Profesores:'],
    ['AAAA0: ANA ALVAREZ ALONSO', 'BBBB0: BEATRIZ BLANCO BAEZA'],
    ['Aulas:'],
    ['Poli2: Polideportivo 2'],
    ['Taller Pensamiento Computacional: Lunes 16:15h. 1 sesión mensual'],
  ];

  const r = normalizarBloqueClase(bloque);

  it('saca la clase del título', () => {
    expect(r.clase).toMatchObject({ codigo: '1PRIA', curso: '1PRI', letra: 'A' });
  });

  it('todas las sesiones quedan atadas a su grupo', () => {
    expect(r.sesiones.every((s) => s.grupos[0].curso === '1PRI' && s.grupos[0].letra === 'A')).toBe(true);
  });

  it('coloca cada celda en su día y su orden', () => {
    const lunes1 = r.sesiones.find((s) => s.dia === 1 && s.orden === 1);
    expect(lunes1).toMatchObject({ materiaCodigo: 'LEN1', horaInicio: '09:00', horaFin: '09:45' });
    const miercoles2 = r.sesiones.find((s) => s.dia === 3 && s.orden === 2);
    expect(miercoles2).toMatchObject({ materiaCodigo: 'EFI1', aulaCodigo: 'POLI2' });
  });

  it('el recreo y el comedor no generan sesiones', () => {
    expect(r.sesiones.some((s) => s.tipoTramo !== 'sesion')).toBe(false);
    expect(r.sesiones.filter((s) => s.dia === 1)).toHaveLength(2);
  });

  it('las horas libres no generan sesiones', () => {
    expect(r.sesiones.some((s) => s.dia === 2 && s.orden === 2)).toBe(false);
    expect(r.sesiones.some((s) => s.dia === 5 && s.orden === 2)).toBe(false);
  });

  it('el apoyo de PT entra como actividad, no como clase', () => {
    const pt = r.sesiones.find((s) => s.dia === 4 && s.orden === 1);
    expect(pt).toMatchObject({ actividadCodigo: 'apoyo_pt', profeCodigos: ['BBBB0'] });
  });

  it('una clase con un apoyo encima genera las dos sesiones en el mismo hueco', () => {
    const viernes1 = r.sesiones.filter((s) => s.dia === 5 && s.orden === 1);
    expect(viernes1.map((s) => s.actividadCodigo)).toEqual(['clase', 'apoyo_pt']);
  });

  it('el texto suelto del pie se guarda como nota, sin inventar una recurrencia', () => {
    expect(r.notas.some((n) => n.includes('1 sesión mensual'))).toBe(true);
  });

  it('no hay incidencias con un bloque bien formado', () => {
    expect(r.incidencias).toEqual([]);
  });

  it('un bloque sin fila de días se reporta en vez de reventar', () => {
    const malo = normalizarBloqueClase([['HORARIO DE CLASE'], ['1PRIA: 1º EP-A'], ['nada']]);
    expect(malo.sesiones).toEqual([]);
    expect(malo.incidencias.some((i) => i.tipo === 'sin_tramos')).toBe(true);
  });
});

describe('rejillas del "Horario general del colegio"', () => {
  it('corta los días al detectar que la hora se reinicia, no contando columnas', () => {
    // Imita la fila de ESO: el lunes tiene 3 sesiones y el martes 2.
    const fila = ['HORARIO ESO', '08:00\n08:55', '08:55\n09:50', '09:50\n10:40', '08:00\n08:55', '08:55\n09:50'];
    const r = parsearRejillaDeFila(fila);
    expect(r?.nombre).toBe('HORARIO ESO');
    expect(r?.tramos.filter((t) => t.diaSemana === 1)).toHaveLength(3);
    expect(r?.tramos.filter((t) => t.diaSemana === 2)).toHaveLength(2);
    expect(r?.tramos[0]).toMatchObject({ diaSemana: 1, orden: 1, horaInicio: '08:00', horaFin: '08:55' });
    expect(r?.tramos[3]).toMatchObject({ diaSemana: 2, orden: 1, horaInicio: '08:00' });
  });

  it('una fila sin horas no es una rejilla', () => {
    expect(parsearRejillaDeFila(['Profesor', 'Lunes', 'Martes'])).toBeNull();
  });
});

describe('los tramos del bloque son la rejilla de esa clase', () => {
  const bloque = [
    ['1PRIA: 1º EP-A'],
    ['Horas', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
    ['De 09:00 a 09:45', 'LEN1 - AAAA0', '', '', '', ''],
    ['De 11:15 a 11:45', 'Recreo', 'Recreo', 'Recreo', 'Recreo', 'Recreo'],
    ['De 13:30 a 15:30', 'Comedor', 'Comedor', 'Comedor', 'Comedor', 'Comedor'],
    ['De 15:30 a 16:15', 'MAT1 - AAAA0', '', '', '', ''],
    ['Materias:'],
    ['LEN1: Lengua Castellana y Literatura', 'MAT1: Matemáticas'],
    ['Profesores:'],
    ['AAAA0: ANA ALVAREZ ALONSO'],
  ];
  const r = normalizarBloqueClase(bloque);

  it('incluye recreo y comedor, que no son sesiones pero SÍ son huecos de la rejilla', () => {
    expect(r.tramos.map((t) => t.tipo)).toEqual(['sesion', 'recreo', 'comedor', 'sesion']);
    expect(r.tramos.map((t) => t.orden)).toEqual([1, 2, 3, 4]);
    expect(r.tramos[1]).toMatchObject({ horaInicio: '11:15', horaFin: '11:45' });
  });

  it('el orden de la sesión casa con el del tramo', () => {
    expect(r.sesiones.find((s) => s.materiaCodigo === 'MAT1')?.orden).toBe(4);
  });
});
