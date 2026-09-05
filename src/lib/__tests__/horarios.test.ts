import { describe, expect, it } from 'vitest';

import {
  aHora,
  aMinutos,
  detectarConflictos,
  diaSemanaDeFecha,
  esLectiva,
  etapaDeCursoHorario,
  generarTramosDia,
  periodoVigente,
  rejillaDeGrupo,
  tramoEnHora,
  colorDeCelda,
  construirCuadricula,
  repartirColores,
  situarAhora,
  tramoSiguiente,
  type CeldaHorario,
  type SesionParaConflictos,
  type TramoBasico,
} from '@/lib/horarios';

describe('horas', () => {
  it('convierte HH:mm a minutos y vuelta', () => {
    expect(aMinutos('08:00')).toBe(480);
    expect(aMinutos('8:05')).toBe(485);
    expect(aHora(485)).toBe('08:05');
    expect(aHora(0)).toBe('00:00');
  });

  it('rechaza lo que no es una hora', () => {
    expect(aMinutos('')).toBeNull();
    expect(aMinutos('25:00')).toBeNull();
    expect(aMinutos('08:70')).toBeNull();
    expect(aMinutos('ocho')).toBeNull();
    expect(aMinutos(null)).toBeNull();
  });
});

describe('día de la semana de una fecha', () => {
  it('cuenta lunes = 1 … viernes = 5', () => {
    expect(diaSemanaDeFecha('2026-09-07')).toBe(1); // lunes
    expect(diaSemanaDeFecha('2026-09-11')).toBe(5); // viernes
  });

  it('devuelve null en fin de semana y con basura', () => {
    expect(diaSemanaDeFecha('2026-09-12')).toBeNull(); // sábado
    expect(diaSemanaDeFecha('2026-09-13')).toBeNull(); // domingo
    expect(diaSemanaDeFecha('no es fecha')).toBeNull();
  });

  it('no se va al día anterior por la zona horaria', () => {
    // `new Date('2026-06-01')` es UTC y en España cae el 31 de mayo por la noche.
    expect(diaSemanaDeFecha('2026-06-01')).toBe(1); // lunes de verdad
  });
});

describe('periodo vigente', () => {
  const ordinario = { id: 'ord', fechaInicio: '2026-09-14', fechaFin: '2027-05-31', prioridad: 0 };
  const junio = { id: 'jun', fechaInicio: '2027-06-01', fechaFin: '2027-06-22', prioridad: 10 };
  const septiembre = { id: 'sep', fechaInicio: '2026-09-07', fechaFin: '2026-09-11', prioridad: 10 };
  const periodos = [ordinario, junio, septiembre];

  it('coge el ordinario en el curso normal', () => {
    expect(periodoVigente(periodos, '2027-02-10')?.id).toBe('ord');
  });

  it('junio y septiembre pisan al ordinario en sus fechas', () => {
    expect(periodoVigente(periodos, '2027-06-10')?.id).toBe('jun');
    expect(periodoVigente(periodos, '2026-09-09')?.id).toBe('sep');
  });

  it('el solapamiento lo gana la prioridad, no el orden de la lista', () => {
    // El ordinario abarcando el curso entero y junio recortándole por encima.
    const largo = { id: 'ord', fechaInicio: '2026-09-01', fechaFin: '2027-06-30', prioridad: 0 };
    expect(periodoVigente([largo, junio], '2027-06-10')?.id).toBe('jun');
    expect(periodoVigente([junio, largo], '2027-06-10')?.id).toBe('jun');
    expect(periodoVigente([largo, junio], '2027-03-01')?.id).toBe('ord');
  });

  it('a igual prioridad gana el más corto (la excepción)', () => {
    const a = { id: 'largo', fechaInicio: '2026-09-01', fechaFin: '2027-06-30', prioridad: 5 };
    const b = { id: 'corto', fechaInicio: '2027-06-01', fechaFin: '2027-06-10', prioridad: 5 };
    expect(periodoVigente([a, b], '2027-06-05')?.id).toBe('corto');
  });

  it('devuelve null fuera de todo periodo y salta los inactivos', () => {
    expect(periodoVigente(periodos, '2027-08-15')).toBeNull();
    expect(periodoVigente([{ ...junio, active: false }], '2027-06-10')).toBeNull();
  });
});

describe('rejilla de un grupo (precedencia por especificidad)', () => {
  const ambitos = [
    { rejillaId: 'centro' },
    { rejillaId: 'primaria', etapa: 'EP' },
    { rejillaId: 'secundaria', etapa: 'ESO' },
    { rejillaId: '4eso', curso: '4ESO' },
    { rejillaId: '1priA', curso: '1PRI', letra: 'A' },
  ];

  it('lo normal: la de su etapa', () => {
    expect(rejillaDeGrupo(ambitos, { curso: '3PRI', letra: 'B' })).toBe('primaria');
    expect(rejillaDeGrupo(ambitos, { curso: '2ESO', letra: 'A' })).toBe('secundaria');
  });

  it('el curso pisa a la etapa y el curso+letra pisa al curso', () => {
    expect(rejillaDeGrupo(ambitos, { curso: '4ESO', letra: 'B' })).toBe('4eso');
    expect(rejillaDeGrupo(ambitos, { curso: '1PRI', letra: 'A' })).toBe('1priA');
    expect(rejillaDeGrupo(ambitos, { curso: '1PRI', letra: 'B' })).toBe('primaria');
  });

  it('cae al comodín del centro si su etapa no tiene rejilla', () => {
    expect(rejillaDeGrupo(ambitos, { curso: '4INF', letra: 'A' })).toBe('centro');
  });

  it('los PDC van con secundaria', () => {
    expect(rejillaDeGrupo(ambitos, { curso: '3ºPPDC', letra: 'PDC' })).toBe('secundaria');
  });

  it('devuelve null si no hay ni comodín', () => {
    expect(rejillaDeGrupo([{ rejillaId: 'primaria', etapa: 'EP' }], { curso: '2ESO', letra: 'A' })).toBeNull();
  });
});

describe('tramo que contiene una hora', () => {
  // Primaria: 6 sesiones de 45' desde las 8:00, patio tras la 3ª.
  const tramos: TramoBasico[] = generarTramosDia({
    horaInicio: '08:00',
    duracion: 45,
    sesiones: 6,
    recreoTras: 3,
  }).map((t) => ({ ...t, id: `L${t.orden}`, diaSemana: 1 }));

  it('genera la rejilla regular con su patio', () => {
    expect(tramos).toHaveLength(7);
    expect(tramos[0]).toMatchObject({ etiqueta: '1ª', horaInicio: '08:00', horaFin: '08:45' });
    expect(tramos[3]).toMatchObject({ etiqueta: 'Patio', horaInicio: '10:15', horaFin: '10:45', tipo: 'recreo' });
    expect(tramos[6]).toMatchObject({ etiqueta: '6ª', horaFin: '13:00' });
  });

  it('el intervalo es [inicio, fin): a las 08:45 ya estás en la 2ª', () => {
    expect(tramoEnHora(tramos, 1, '08:00')?.etiqueta).toBe('1ª');
    expect(tramoEnHora(tramos, 1, '08:44')?.etiqueta).toBe('1ª');
    expect(tramoEnHora(tramos, 1, '08:45')?.etiqueta).toBe('2ª');
  });

  it('devuelve el recreo si la hora cae en el patio', () => {
    expect(tramoEnHora(tramos, 1, '10:30')?.tipo).toBe('recreo');
  });

  it('null fuera del horario o en otro día', () => {
    expect(tramoEnHora(tramos, 1, '07:30')).toBeNull();
    expect(tramoEnHora(tramos, 1, '15:00')).toBeNull();
    expect(tramoEnHora(tramos, 3, '09:00')).toBeNull();
  });

  it('el siguiente tramo sirve para el retraso de entrada y el de después del patio', () => {
    expect(tramoSiguiente(tramos, 1, '07:50')?.etiqueta).toBe('1ª');
    expect(tramoSiguiente(tramos, 1, '10:20')?.etiqueta).toBe('4ª');
    expect(tramoSiguiente(tramos, 1, '13:30')).toBeNull();
  });
});

describe('viernes con la misma rejilla y otras horas', () => {
  // El caso real: 6 sesiones también el viernes, pero de 40' — y el horario no se descoloca
  // porque las sesiones se refieren al tramo por ORDEN, no por hora.
  const lunes = generarTramosDia({ horaInicio: '08:00', duracion: 45, sesiones: 6 }).map((t) => ({
    ...t,
    id: `L${t.orden}`,
    diaSemana: 1,
  }));
  const viernes = generarTramosDia({ horaInicio: '08:00', duracion: 40, sesiones: 6 }).map((t) => ({
    ...t,
    id: `V${t.orden}`,
    diaSemana: 5,
  }));
  const rejilla = [...lunes, ...viernes];

  it('mismo número de sesiones, horas distintas', () => {
    expect(lunes).toHaveLength(6);
    expect(viernes).toHaveLength(6);
    expect(tramoEnHora(rejilla, 1, '10:00')?.orden).toBe(3);
    expect(tramoEnHora(rejilla, 5, '10:00')?.orden).toBe(4); // el viernes va más adelantado
  });

  it('la 3ª existe los dos días con horas distintas', () => {
    expect(rejilla.find((t) => t.diaSemana === 1 && t.orden === 3)?.horaInicio).toBe('09:30');
    expect(rejilla.find((t) => t.diaSemana === 5 && t.orden === 3)?.horaInicio).toBe('09:20');
  });
});

describe('lectiva: el catálogo pone el defecto, la asignación lo pisa', () => {
  it('sin override manda la actividad', () => {
    expect(esLectiva({ lectiva: null }, { lectiva: true })).toBe(true);
    expect(esLectiva({}, { lectiva: false })).toBe(false);
  });

  it('la reunión que sí cae en hora lectiva', () => {
    expect(esLectiva({ lectiva: true }, { lectiva: false })).toBe(true);
    expect(esLectiva({ lectiva: false }, { lectiva: true })).toBe(false);
  });
});

describe('conflictos', () => {
  const base = { tramoId: 'T1', grupos: [], profeIds: [] };

  it('un profe en dos sitios a la vez es conflicto', () => {
    const sesiones: SesionParaConflictos[] = [
      { ...base, id: 's1', profeIds: ['ana'], grupos: [{ curso: '2ESO', letra: 'A' }] },
      { ...base, id: 's2', profeIds: ['ana'], grupos: [{ curso: '3ESO', letra: 'B' }] },
    ];
    const c = detectarConflictos(sesiones);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ tipo: 'profe', clave: 'ana' });
  });

  it('dos profes en la misma aula NO es conflicto (entran los dos)', () => {
    const sesiones: SesionParaConflictos[] = [
      { ...base, id: 's1', profeIds: ['ana', 'pep'], grupos: [{ curso: '2ESO', letra: 'A' }] },
    ];
    expect(detectarConflictos(sesiones)).toEqual([]);
  });

  it('un desdoble con subgrupos distintos NO es conflicto', () => {
    const sesiones: SesionParaConflictos[] = [
      { ...base, id: 's1', profeIds: ['ana'], grupos: [{ curso: '2ESO', letra: 'A', subgrupo: 'Religión' }] },
      { ...base, id: 's2', profeIds: ['pep'], grupos: [{ curso: '2ESO', letra: 'A', subgrupo: 'Valores' }] },
    ];
    expect(detectarConflictos(sesiones)).toEqual([]);
  });

  it('el mismo grupo dos veces sin subgrupo sí es conflicto', () => {
    const sesiones: SesionParaConflictos[] = [
      { ...base, id: 's1', profeIds: ['ana'], grupos: [{ curso: '2ESO', letra: 'A' }] },
      { ...base, id: 's2', profeIds: ['pep'], grupos: [{ curso: '2ESO', letra: 'A' }] },
    ];
    const c = detectarConflictos(sesiones);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ tipo: 'grupo', clave: '2ESO A' });
  });

  it('el mismo subgrupo repetido sí es conflicto', () => {
    const sesiones: SesionParaConflictos[] = [
      { ...base, id: 's1', profeIds: ['ana'], grupos: [{ curso: '2ESO', letra: 'A', subgrupo: 'Religión' }] },
      { ...base, id: 's2', profeIds: ['pep'], grupos: [{ curso: '2ESO', letra: 'A', subgrupo: 'Religión' }] },
    ];
    expect(detectarConflictos(sesiones).some((c) => c.tipo === 'grupo')).toBe(true);
  });

  it('el aula doblemente ocupada es conflicto', () => {
    const sesiones: SesionParaConflictos[] = [
      { ...base, id: 's1', profeIds: ['ana'], grupos: [{ curso: '2ESO', letra: 'A' }], aula: '14' },
      { ...base, id: 's2', profeIds: ['pep'], grupos: [{ curso: '3ESO', letra: 'B' }], aula: '14' },
    ];
    expect(detectarConflictos(sesiones).filter((c) => c.tipo === 'aula')).toHaveLength(1);
  });

  it('en tramos distintos no hay conflicto de nada', () => {
    const sesiones: SesionParaConflictos[] = [
      { id: 's1', tramoId: 'T1', profeIds: ['ana'], grupos: [{ curso: '2ESO', letra: 'A' }], aula: '14' },
      { id: 's2', tramoId: 'T2', profeIds: ['ana'], grupos: [{ curso: '2ESO', letra: 'A' }], aula: '14' },
    ];
    expect(detectarConflictos(sesiones)).toEqual([]);
  });
});

describe('etapa para horarios', () => {
  it('delega en la compartida para las tres etapas en uso', () => {
    expect(etapaDeCursoHorario('4INF')).toBe('EI');
    expect(etapaDeCursoHorario('3PRI')).toBe('EP');
    expect(etapaDeCursoHorario('2ESO')).toBe('ESO');
    expect(etapaDeCursoHorario('3ºPPDC')).toBe('ESO');
  });

  it('reconoce las previstas y desactivadas', () => {
    expect(etapaDeCursoHorario('1BACH')).toBe('BACH');
    expect(etapaDeCursoHorario('1CFGM')).toBe('CFGM');
    expect(etapaDeCursoHorario('2CFGS')).toBe('CFGS');
    expect(etapaDeCursoHorario(null)).toBeNull();
  });
});

describe('cuadrícula del navegador', () => {
  const celda = (o: Partial<CeldaHorario> & { dia: number; horaInicio: string; horaFin: string }): CeldaHorario => ({
    sesionId: `${o.dia}-${o.horaInicio}`,
    tramoId: 't',
    tipoTramo: 'sesion',
    titulo: 'Mates',
    subtitulo: null,
    actividad: 'clase',
    lectiva: true,
    espacio: null,
    profes: [],
    grupos: [],
    notas: null,
    ...o,
  });

  it('ordena las filas por hora y numera solo las lectivas', () => {
    const filas = construirCuadricula([
      celda({ dia: 1, horaInicio: '10:30', horaFin: '11:15' }),
      celda({ dia: 1, horaInicio: '09:00', horaFin: '09:45' }),
      celda({ dia: 2, horaInicio: '11:15', horaFin: '11:45', tipoTramo: 'recreo' }),
      celda({ dia: 1, horaInicio: '09:45', horaFin: '10:30' }),
    ]);
    expect(filas.map((f) => f.horaInicio)).toEqual(['09:00', '09:45', '10:30', '11:15']);
    expect(filas.map((f) => f.etiqueta)).toEqual(['1ª', '2ª', '3ª', 'Patio']);
  });

  it('mezcla rejillas distintas: un profe de infantil Y primaria cabe en una sola cuadrícula', () => {
    const filas = construirCuadricula([
      celda({ dia: 1, horaInicio: '09:00', horaFin: '10:10' }), // infantil
      celda({ dia: 2, horaInicio: '09:00', horaFin: '09:45' }), // primaria
      celda({ dia: 2, horaInicio: '09:45', horaFin: '10:30' }),
    ]);
    expect(filas).toHaveLength(3);
    expect(filas.map((f) => `${f.horaInicio}-${f.horaFin}`)).toEqual(['09:00-09:45', '09:00-10:10', '09:45-10:30']);
    expect(filas.map((f) => f.etiqueta)).toEqual(['1ª', '2ª', '3ª']);
  });

  it('no pinta fines de semana ni nada fuera de 08:00-18:00', () => {
    const filas = construirCuadricula([
      celda({ dia: 6, horaInicio: '09:00', horaFin: '09:45' }),
      celda({ dia: 0, horaInicio: '09:00', horaFin: '09:45' }),
      celda({ dia: 1, horaInicio: '07:00', horaFin: '07:45' }),
      celda({ dia: 1, horaInicio: '18:00', horaFin: '19:00' }),
      celda({ dia: 1, horaInicio: '09:00', horaFin: '09:45' }),
    ]);
    expect(filas).toHaveLength(1);
    expect(filas[0].horaInicio).toBe('09:00');
  });

  it('varias celdas en el mismo hueco (desdoble o apoyo) conviven', () => {
    const filas = construirCuadricula([
      celda({ dia: 1, horaInicio: '09:00', horaFin: '09:45', titulo: 'Mates', sesionId: 'a' }),
      celda({ dia: 1, horaInicio: '09:00', horaFin: '09:45', titulo: 'Apoyo PT', actividad: 'apoyo_pt', sesionId: 'b' }),
    ]);
    expect(filas[0].dias[0]).toHaveLength(2);
    expect(filas[0].dias[1]).toEqual([]);
  });

  it('si en una franja hay clase y recreo a la vez, manda la clase', () => {
    const filas = construirCuadricula([
      celda({ dia: 1, horaInicio: '11:15', horaFin: '11:45', tipoTramo: 'recreo', sesionId: 'r' }),
      celda({ dia: 2, horaInicio: '11:15', horaFin: '11:45', tipoTramo: 'sesion', sesionId: 's' }),
    ]);
    expect(filas[0].tipo).toBe('sesion');
  });
});

describe('situar "ahora" en la cuadrícula', () => {
  const filas = construirCuadricula([
    { sesionId: '1', dia: 1, tramoId: 't', horaInicio: '09:00', horaFin: '09:45', tipoTramo: 'sesion', titulo: 'A', subtitulo: null, actividad: 'clase', lectiva: true, espacio: null, profes: [], grupos: [], notas: null },
    { sesionId: '2', dia: 1, tramoId: 't', horaInicio: '09:45', horaFin: '10:30', tipoTramo: 'sesion', titulo: 'B', subtitulo: null, actividad: 'clase', lectiva: true, espacio: null, profes: [], grupos: [], notas: null },
  ]);

  it('encuentra la franja en curso un día lectivo', () => {
    const a = situarAhora(filas, new Date(2026, 8, 7, 10, 0)); // lunes 7-sep-2026, 10:00
    expect(a).toMatchObject({ dia: 1, hora: '10:00', filaActual: 1 });
  });

  it('en fin de semana no hay día que resaltar', () => {
    expect(situarAhora(filas, new Date(2026, 8, 12, 10, 0)).dia).toBeNull(); // sábado
  });

  it('fuera de las franjas no resalta ninguna', () => {
    expect(situarAhora(filas, new Date(2026, 8, 7, 16, 0)).filaActual).toBeNull();
  });
});

describe('colores por categoría', () => {
  const c = (grupos: string[], titulo = 'Mates'): CeldaHorario => ({
    sesionId: `${grupos.join()}-${titulo}`, dia: 1, tramoId: 't', horaInicio: '09:00', horaFin: '09:45',
    tipoTramo: 'sesion', titulo, subtitulo: null, actividad: 'clase', lectiva: true, espacio: null,
    profes: [], grupos, notas: null,
  });

  it('apagado no reparte nada', () => {
    expect(repartirColores([c(['2ESO A'])], 'nada').size).toBe(0);
    expect(colorDeCelda(c(['2ESO A']), new Map(), 'nada')).toBeNull();
  });

  it('el color va con la categoría, no con el orden en que aparece', () => {
    const celdas = [c(['6PRI B']), c(['1PRI A']), c(['3PRI A'])];
    const a = repartirColores(celdas, 'clase');
    const b = repartirColores([...celdas].reverse(), 'clase');
    expect(a.get('1PRI A')).toBe(b.get('1PRI A'));
    expect(a.get('6PRI B')).toBe(b.get('6PRI B'));
    // Y filtrar (quedarse con menos celdas) no repinta a las que quedan.
    const filtrado = repartirColores([c(['6PRI B']), c(['1PRI A']), c(['3PRI A'])].slice(0, 2), 'clase');
    expect(filtrado.get('1PRI A')).toBe(a.get('1PRI A'));
  });

  it('la misma clase siempre el mismo color, aunque cambie la materia', () => {
    const celdas = [c(['2ESO A'], 'Mates'), c(['2ESO A'], 'Lengua')];
    const r = repartirColores(celdas, 'clase');
    expect(colorDeCelda(celdas[0], r, 'clase')).toEqual(colorDeCelda(celdas[1], r, 'clase'));
  });

  it('por materia agrupa por materia, no por clase', () => {
    const celdas = [c(['2ESO A'], 'Mates'), c(['3ESO B'], 'Mates'), c(['2ESO A'], 'Lengua')];
    const r = repartirColores(celdas, 'materia');
    expect(colorDeCelda(celdas[0], r, 'materia')).toEqual(colorDeCelda(celdas[1], r, 'materia'));
    expect(colorDeCelda(celdas[0], r, 'materia')).not.toEqual(colorDeCelda(celdas[2], r, 'materia'));
  });

  it('pasadas 8 categorías las que sobran se quedan SIN color, no se recicla un tono', () => {
    const celdas = Array.from({ length: 11 }, (_, i) => c([`Clase ${String.fromCharCode(65 + i)}`]));
    const r = repartirColores(celdas, 'clase');
    expect(r.size).toBe(8);
    const sinColor = celdas.filter((x) => colorDeCelda(x, r, 'clase') === null);
    expect(sinColor).toHaveLength(3);
  });

  it('una celda sin grupo no se colorea por clase', () => {
    const celdas = [c([], 'Guardia')];
    expect(colorDeCelda(celdas[0], repartirColores(celdas, 'clase'), 'clase')).toBeNull();
  });
});
