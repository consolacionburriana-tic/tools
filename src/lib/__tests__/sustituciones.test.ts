// Tests de la lógica pura de Sustituciones (docs/32, §4.4). Fixtures INVENTADAS: tres rejillas con
// horas distintas (EI, EP y ESO) que solapan a medias, como pasa de verdad.
import { describe, expect, it } from 'vitest';
import {
  agruparCandidatos,
  agruparMotivo,
  aplicarCoberturas,
  aulaVisible,
  claveSesion,
  cuandoYDonde,
  cubreDentro,
  diasLectivos,
  disponibilidadDeNivel,
  enlaceGoogleCalendar,
  etapasDePersona,
  etiquetaGrupo,
  evaluar,
  excedeTope,
  horarioDeFecha,
  leerPlantillas,
  mapaSemana,
  nivelDe,
  notasDeHorario,
  PeticionAusencia,
  pintarPlantilla,
  PLANTILLAS_DE_FABRICA,
  proponerSustitutos,
  puedeVerMisSustituciones,
  rangoLargo,
  rangoNivel,
  recortarHorario,
  rejillaDisponibilidad,
  resumir,
  sesionesDelAusente,
  siguienteEstado,
  solapa,
  textoAHtml,
  type ConfigSustituciones,
  type EntradaPropuesta,
  type PeriodoHorario,
  type RejillaHorario,
  type Retoque,
  type SesionDia,
} from '@/lib/sustituciones';
import { CONFIGURACION } from '@/lib/configuracion';

const MAR = '2026-11-17'; // martes
const MIE = '2026-11-18';

let n = 0;
function ses(p: Partial<SesionDia> & Pick<SesionDia, 'horaInicio' | 'horaFin' | 'profes'>): SesionDia {
  n++;
  return {
    sesionId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    fecha: MAR,
    tramo: null,
    actividad: 'clase',
    etiqueta: null,
    grupos: [],
    materia: null,
    aula: null,
    ...p,
  };
}
const pr = (id: string, principal = true, rol = 'titular') => ({ id, principal, rol });

const PERSONAS = ['marta', 'lucia', 'pere', 'ana', 'joan', 'rosa', 'tomas', 'eva'].map((id) => ({ id, nombre: id[0].toUpperCase() + id.slice(1) }));

function entrada(horario: SesionDia[], ausenteId: string, extra: Partial<EntradaPropuesta> = {}): EntradaPropuesta {
  const porFecha = new Map<string, SesionDia[]>();
  for (const s of horario) porFecha.set(s.fecha, [...(porFecha.get(s.fecha) ?? []), s]);
  const sesiones = [...porFecha.values()].flatMap((dia) => sesionesDelAusente(dia, ausenteId)).filter((s) => s.hayQueCubrir);
  return { sesiones, ausenteId, horario: porFecha, profes: PERSONAS, ausencias: [], cubriendo: [], oratorios: [], deBaja: new Map(), retoques: [], ...extra };
}

describe('solape por horas, no por tramo', () => {
  it('la 2ª de EP (09:45-10:30) solapa con la 1ª de EI (09:00-10:10) y no con la de las 10:30', () => {
    expect(solapa({ horaInicio: '09:45', horaFin: '10:30' }, { horaInicio: '09:00', horaFin: '10:10' })).toBe(true);
    expect(solapa({ horaInicio: '09:45', horaFin: '10:30' }, { horaInicio: '10:30', horaFin: '11:15' })).toBe(false);
  });
});

describe('días lectivos y tope', () => {
  const festivos = [{ inicio: '2026-12-07', fin: '2026-12-08', nombre: 'Puente' }];
  it('se saltan el fin de semana y los festivos del medio', () => {
    const r = diasLectivos('2026-12-04', '2026-12-09', festivos);
    expect(r.lectivos).toEqual(['2026-12-04', '2026-12-09']);
    expect(r.saltados.map((s) => s.porque)).toEqual(['finde', 'finde', 'festivo', 'festivo']);
    expect(r.saltados[2].nombre).toBe('Puente');
  });
  it('16 días lectivos pasan del tope (15): es una cobertura por baja', () => {
    const r = diasLectivos('2026-11-02', '2026-11-23', []);
    expect(r.lectivos).toHaveLength(16);
    expect(excedeTope(r.lectivos)).toBe(true);
    expect(excedeTope(r.lectivos.slice(0, 15))).toBe(false);
  });
  it('un rango al revés no da días', () => {
    expect(diasLectivos(MIE, MAR, []).lectivos).toEqual([]);
  });
  it('rango en palabras', () => {
    expect(rangoLargo(MAR, MAR)).toBe('el martes 17 de noviembre');
    expect(rangoLargo(MAR, '2026-11-19')).toBe('del martes 17 al jueves 19 de noviembre');
  });
});

describe('qué horario manda en una fecha (decisión 4)', () => {
  const periodos: PeriodoHorario[] = [
    { id: 'ord', nombre: 'Ordinario', fechaInicio: '2026-09-01', fechaFin: '2027-05-31', prioridad: 0, esOrdinario: true },
    { id: 'sep', nombre: 'Septiembre', fechaInicio: '2026-09-01', fechaFin: '2026-09-30', prioridad: 10, esOrdinario: false },
    { id: 'jun', nombre: 'Junio', fechaInicio: '2027-06-01', fechaFin: '2027-06-18', prioridad: 10, esOrdinario: false },
  ];
  const rejillas: RejillaHorario[] = [
    { id: 'r-ei', periodoId: 'ord', ambitos: [{ etapa: 'EI', curso: null }] },
    { id: 'r-ep', periodoId: 'ord', ambitos: [{ etapa: 'EP', curso: null }] },
    { id: 'r-eso', periodoId: 'ord', ambitos: [{ etapa: 'ESO', curso: '1ESO' }, { etapa: 'ESO', curso: '2ESO' }] },
    { id: 'r-centro', periodoId: 'ord', ambitos: [{ etapa: null, curso: null }] },
    { id: 'r-ep-sep', periodoId: 'sep', ambitos: [{ etapa: 'EP', curso: null }] },
    { id: 'r-ep-jun', periodoId: 'jun', ambitos: [{ etapa: 'EP', curso: null }] },
  ];
  it('un lunes de octubre: todo el ordinario', () => {
    const h = horarioDeFecha('2026-10-05', periodos, rejillas);
    expect([...h.rejillas].sort()).toEqual(['r-centro', 'r-ei', 'r-ep', 'r-eso']);
    expect(notasDeHorario(h, periodos, '2026-10-05')).toEqual([]);
  });
  it('en septiembre, primaria con el suyo; infantil y ESO con el ordinario, y se dice', () => {
    const h = horarioDeFecha('2026-09-15', periodos, rejillas);
    expect(h.rejillas.has('r-ep-sep')).toBe(true);
    expect(h.rejillas.has('r-ep')).toBe(false);
    expect(h.rejillas.has('r-ei')).toBe(true);
    expect(h.rejillas.has('r-eso')).toBe(true);
    expect(notasDeHorario(h, periodos, '2026-09-15')).toEqual([
      'Infantil: horario ordinario, no hay de septiembre',
      'Secundaria: horario ordinario, no hay de septiembre',
    ]);
  });
  it('en junio, fuera del ordinario, infantil sigue con el ordinario del curso', () => {
    const h = horarioDeFecha('2027-06-08', periodos, rejillas);
    expect(h.rejillas.has('r-ep-jun')).toBe(true);
    expect(h.rejillas.has('r-ei')).toBe(true);
  });
  it('una rejilla de «centro entero» en septiembre no hace que mande en infantil ni en la ESO', () => {
    const conCentro = [...rejillas, { id: 'r-centro-sep', periodoId: 'sep', ambitos: [{ etapa: null, curso: null }] }];
    const h = horarioDeFecha('2026-09-15', periodos, conCentro);
    expect(h.porEtapa.map((e) => [e.etapa, e.periodo?.id])).toEqual([['EI', 'ord'], ['EP', 'sep'], ['ESO', 'ord']]);
    expect(h.rejillas.has('r-ei')).toBe(true);
    expect(h.rejillas.has('r-eso')).toBe(true);
    expect(h.rejillas.has('r-centro-sep')).toBe(true); // sus horas sueltas sí cuentan
  });
  it('cuando se suba el de septiembre de infantil, manda solo', () => {
    const h = horarioDeFecha('2026-09-15', periodos, [...rejillas, { id: 'r-ei-sep', periodoId: 'sep', ambitos: [{ etapa: 'EI', curso: null }] }]);
    expect(h.rejillas.has('r-ei-sep')).toBe(true);
    expect(h.rejillas.has('r-ei')).toBe(false);
  });
});

describe('niveles (decisión 7)', () => {
  it('codocencia: clase con grupo y el candidato no es el principal', () => {
    const s = ses({ horaInicio: '09:00', horaFin: '09:45', grupos: ['3º A'], profes: [pr('marta'), pr('lucia', false, 'apoyo')] });
    expect(nivelDe(s, 'lucia')).toBe('codocencia');
    expect(nivelDe(s, 'marta')).toBeNull(); // su clase propia
  });
  it('Reunión Orientación | Tutoría individual cae en Tut. indiv.; atención a familias en Otras', () => {
    expect(nivelDe(ses({ horaInicio: '09:00', horaFin: '09:45', actividad: 'reunion', etiqueta: 'Reunión Orientación | Tutoría individual', profes: [pr('ana')] }), 'ana')).toBe('tut_indiv');
    expect(nivelDe(ses({ horaInicio: '09:00', horaFin: '09:45', actividad: 'atencion_padres', profes: [pr('ana')] }), 'ana')).toBe('otras');
  });
  it('J.E., Dirección, TIC, Godly, Pastoral y Gabinete por etiqueta', () => {
    const n = (actividad: string, etiqueta: string) => nivelDe(ses({ horaInicio: '09:00', horaFin: '09:45', actividad, etiqueta, profes: [pr('x')] }), 'x');
    expect(n('coordinacion', 'Jefatura de estudios')).toBe('je');
    expect(n('coordinacion', 'Dirección')).toBe('direccion');
    expect(n('reunion', 'TIC')).toBe('tic');
    expect(n('reunion', 'TIC | TYD1: 1ESOB')).toBe('otras'); // no es «TIC» a secas
    expect(n('oratorio', 'Lu: 5INFB | Godly Play')).toBe('godly');
    expect(n('coordinacion', 'Coordinación de pastoral')).toBe('pastoral');
    expect(n('departamento', 'DPTO. ORIENTACIÓN')).toBe('gabinete');
  });
  it('el Huerto se libera (nivel propio, detrás de Godly; David, 23-nov-2026)', () => {
    const n = (actividad: string, etiqueta: string) => nivelDe(ses({ horaInicio: '11:00', horaFin: '11:30', actividad, etiqueta, grupos: [], profes: [pr('x')] }), 'x');
    expect(n('oratorio', 'Huerto')).toBe('huerto');
    expect(rangoNivel('huerto')).toBe(rangoNivel('godly') + 1);
    expect(disponibilidadDeNivel('huerto')).toBe('si_hace_falta');
  });
  it('el Almuerzo, el Taller de Pensamiento y un oratorio que no es Godly no se liberan', () => {
    const n = (actividad: string, etiqueta: string, grupos: string[] = []) => nivelDe(ses({ horaInicio: '11:00', horaFin: '11:30', actividad, etiqueta, grupos, profes: [pr('x')] }), 'x');
    expect(n('otros', 'Almuerzo', ['3 años A'])).toBeNull();
    expect(n('otros', 'Almuerzo')).toBeNull();
    expect(n('otros', 'Taller de Pensamiento Computacional · 3ºA')).toBeNull();
    expect(n('oratorio', 'Oratorio | TECNO 3ºB')).toBeNull();
  });
});

describe('sesiones del ausente (decisión 5)', () => {
  it('hay que cubrir sus clases con grupo; su codocencia en clase ajena y sus reuniones, no', () => {
    const horario = [
      ses({ horaInicio: '09:00', horaFin: '09:45', grupos: ['2º B'], profes: [pr('marta')] }),
      ses({ horaInicio: '09:45', horaFin: '10:30', grupos: ['3º A'], profes: [pr('lucia'), pr('marta', false, 'apoyo')] }),
      ses({ horaInicio: '12:00', horaFin: '13:00', actividad: 'reunion', etiqueta: 'Coordinación', profes: [pr('marta'), pr('lucia')] }),
      ses({ horaInicio: '10:30', horaFin: '11:15', grupos: ['2º A'], profes: [pr('marta'), pr('pere', false, 'apoyo')] }),
    ];
    const r = sesionesDelAusente(horario, 'marta');
    expect(r.map((s) => [s.horaInicio, s.hayQueCubrir])).toEqual([
      ['09:00', true],
      ['09:45', false],
      ['10:30', true],
      ['12:00', false],
    ]);
    expect(r[2].otrosEnAula).toEqual(['pere']);
  });
  it('en el Almuerzo, el otro adulto que ya está es «Ya está en el aula»', () => {
    const h = [ses({ horaInicio: '10:35', horaFin: '10:45', actividad: 'otros', etiqueta: 'Almuerzo', profes: [pr('marta'), pr('eva', false, 'apoyo')] })];
    const [p] = proponerSustitutos(entrada(h, 'marta'));
    expect(p.elegido).toMatchObject({ id: 'eva', nivel: 'en_aula', disponibilidad: 'si' });
  });
  it('el Almuerzo sin grupo también hay que cubrirlo: son horas con alumnos', () => {
    const r = sesionesDelAusente([ses({ horaInicio: '10:35', horaFin: '10:45', actividad: 'otros', etiqueta: 'Almuerzo', profes: [pr('marta')] })], 'marta');
    expect(r[0].hayQueCubrir).toBe(true);
  });
});

describe('proponer sustitutos (decisiones 6 y 8)', () => {
  // Rejillas: EI 09:00-10:10, EP 09:45-10:30, ESO 08:00-08:55 y 08:55-09:50.
  function base() {
    return [
      ses({ horaInicio: '09:45', horaFin: '10:30', grupos: ['2º B'], materia: 'Matemáticas', aula: '2B', profes: [pr('marta')] }), // a cubrir (EP)
      ses({ horaInicio: '09:00', horaFin: '10:10', grupos: ['4 años A'], profes: [pr('rosa'), pr('lucia', false, 'apoyo')] }), // codocencia EI, solapa a medias
      ses({ horaInicio: '09:45', horaFin: '10:30', actividad: 'coordinacion', etiqueta: 'Dirección', profes: [pr('pere')] }),
      ses({ horaInicio: '08:55', horaFin: '09:50', actividad: 'atencion_padres', profes: [pr('ana')] }), // ESO, solapa 5 min
      ses({ horaInicio: '09:45', horaFin: '10:30', grupos: ['5º A'], profes: [pr('joan')] }), // clase propia
      ses({ horaInicio: '08:00', horaFin: '09:00', grupos: ['1º A'], profes: [pr('tomas')] }), // antes
      ses({ horaInicio: '11:00', horaFin: '12:00', grupos: ['1º A'], profes: [pr('tomas')] }), // después → libre
    ];
  }

  it('«Si hace falta» de nivel 11 va antes que «Solo urgencia»; dentro del estado manda el nivel', () => {
    const [p] = proponerSustitutos(entrada(base(), 'marta'));
    expect(p.candidatos.map((c) => [c.id, c.disponibilidad, c.nivel])).toEqual([
      ['lucia', 'si_hace_falta', 'codocencia'],
      ['pere', 'si_hace_falta', 'direccion'],
      ['ana', 'si_hace_falta', 'otras'],
      ['tomas', 'urgencia', 'libre'],
      ['eva', 'no', null], // no tiene nada ese día: no está en el colegio
      ['joan', 'no', null],
      ['rosa', 'no', null],
    ]);
    expect(p.elegido?.id).toBe('lucia');
  });

  it('el mismo candidato no sale dos veces a la misma hora del mismo día', () => {
    const h = base();
    // Otra clase de Marta a la misma hora (desdoble) que también hay que cubrir.
    h.push(ses({ horaInicio: '09:45', horaFin: '10:30', grupos: ['2º B'], materia: 'Desdoble', profes: [pr('marta')] }));
    const r = proponerSustitutos(entrada(h, 'marta'));
    expect(r[0].elegido?.id).toBe('lucia');
    expect(r[1].elegido?.id).toBe('pere');
    expect(r[1].candidatos.some((c) => c.id === 'lucia')).toBe(false);
  });

  it('otro ausente, quien ya cubre, el responsable de un Oratorio y el titular de una baja quedan fuera', () => {
    const b = (profeId: string) => ({ profeId, fecha: MAR, horaInicio: '09:30', horaFin: '10:00' });
    const [p] = proponerSustitutos(
      entrada(base(), 'marta', { ausencias: [b('lucia')], cubriendo: [b('pere')], oratorios: [b('ana')], deBaja: new Map([[MAR, ['tomas']]]) }),
    );
    expect(p.candidatos.map((c) => c.id)).not.toContain('lucia');
    expect(p.candidatos.map((c) => c.id)).not.toContain('pere');
    expect(p.candidatos.map((c) => c.id)).not.toContain('ana');
    expect(p.candidatos.map((c) => c.id)).not.toContain('tomas');
    // Quien está de baja sale aparte, para enseñarlo deshabilitado en el desplegable.
    expect(p.deBaja).toEqual(['Tomas']);
    expect(p.elegido).toBeNull(); // nadie en Sí ni Si hace falta: «Sin cubrir» es normal
  });

  it('«Solo urgencia» nunca se elige sola', () => {
    const h = base().filter((s) => ['marta', 'tomas'].includes(s.profes[0].id));
    const [p] = proponerSustitutos(entrada(h, 'marta'));
    expect(p.candidatos[0]).toMatchObject({ id: 'tomas', disponibilidad: 'urgencia' });
    expect(p.elegido).toBeNull();
  });

  it('codocente en el aula → nivel 0 («Ya está en el aula»), antes que nadie', () => {
    const h = base();
    h[0] = { ...h[0], profes: [pr('marta'), pr('eva', false, 'apoyo')] };
    const [p] = proponerSustitutos(entrada(h, 'marta'));
    expect(p.elegido).toMatchObject({ id: 'eva', nivel: 'en_aula', disponibilidad: 'si' });
  });

  it('a igual nivel, el del cuadro va primero; y la continuidad, antes que el reparto', () => {
    const h = [
      ses({ horaInicio: '09:00', horaFin: '10:00', grupos: ['3 años A'], profes: [pr('marta')] }),
      ses({ horaInicio: '10:00', horaFin: '11:00', grupos: ['3 años A'], profes: [pr('marta')] }),
      ses({ horaInicio: '09:00', horaFin: '11:00', actividad: 'departamento', profes: [pr('pere')] }),
      ses({ horaInicio: '09:00', horaFin: '11:00', actividad: 'departamento', profes: [pr('ana')] }),
    ];
    const cargas = new Map([['ana', 0], ['pere', 5]]);
    const cuadro = [{ profeId: 'pere', fecha: MAR, horaInicio: '09:00', horaFin: '10:00' }];
    const r = proponerSustitutos(entrada(h, 'marta', { cargas, cuadro }));
    expect(r[0].elegido?.id).toBe('pere'); // en el cuadro, aunque haya cubierto más
    expect(r[0].enCuadro).toEqual(['Pere']);
    expect(r[1].elegido?.id).toBe('pere'); // continúa con el grupo toda la mañana
    const sinCuadro = proponerSustitutos(entrada(h, 'marta', { cargas }));
    expect(sinCuadro[0].elegido?.id).toBe('ana'); // menos cubiertas
  });

  it('un retoque a «No» saca a alguien de la elección; un retoque también sube una clase propia (lo decide Jefatura)', () => {
    const retoques: Retoque[] = [
      { profeId: 'lucia', dia: 2, horaInicio: '09:00', horaFin: '10:10', estado: 'no' },
      { profeId: 'joan', dia: 2, horaInicio: '09:45', horaFin: '10:30', estado: 'si' },
    ];
    const [p] = proponerSustitutos(entrada(base(), 'marta', { retoques }));
    expect(p.candidatos.find((c) => c.id === 'joan')?.disponibilidad).toBe('si');
    expect(p.candidatos.find((c) => c.id === 'lucia')?.disponibilidad).toBe('no');
  });

  it('lo elegido a mano se respeta y se descuenta en las demás', () => {
    const h = base();
    h.push(ses({ horaInicio: '09:45', horaFin: '10:30', grupos: ['2º B'], materia: 'Desdoble', profes: [pr('marta')] }));
    const e = entrada(h, 'marta');
    const k0 = claveSesion(e.sesiones[0]);
    const k1 = claveSesion(e.sesiones[1]);
    const r = proponerSustitutos({ ...e, fijados: { [k1]: 'lucia', [k0]: null } });
    expect(r.find((x) => x.clave === k0)?.elegido).toBeNull();
    expect(r.find((x) => x.clave === k1)?.elegido?.id).toBe('lucia');
    expect(r.find((x) => x.clave === k0)?.candidatos.some((c) => c.id === 'lucia')).toBe(false);
  });

  it('agrupa para el desplegable', () => {
    const [p] = proponerSustitutos(entrada(base(), 'marta'));
    expect(agruparCandidatos(p.candidatos).map((g) => g.etiqueta)).toEqual([
      'Si hace falta · Codocencia',
      'Si hace falta · Dirección',
      'Si hace falta · Otras horas sin alumnado',
      'Solo urgencia',
      'Todo el claustro (tiene clase o no está)',
    ]);
  });
});

describe('horario recortado para la pantalla', () => {
  it('da la misma propuesta que el horario entero', () => {
    const h = [
      ses({ horaInicio: '09:45', horaFin: '10:30', grupos: ['2º B'], profes: [pr('marta')] }),
      ses({ horaInicio: '08:00', horaFin: '09:00', grupos: ['1º A'], profes: [pr('tomas')] }),
      ses({ horaInicio: '09:00', horaFin: '09:30', grupos: ['1º B'], profes: [pr('tomas')] }),
      ses({ horaInicio: '12:00', horaFin: '13:00', grupos: ['1º A'], profes: [pr('tomas')] }),
      ses({ horaInicio: '13:00', horaFin: '14:00', grupos: ['1º A'], profes: [pr('tomas')] }),
      ses({ horaInicio: '09:30', horaFin: '11:00', actividad: 'departamento', profes: [pr('ana')] }),
    ];
    const e = entrada(h, 'marta');
    const recortado = recortarHorario(h, e.sesiones);
    expect(recortado.length).toBeLessThan(h.length);
    const a = proponerSustitutos(e);
    const b = proponerSustitutos({ ...e, horario: new Map([[MAR, recortado]]) });
    expect(b).toEqual(a);
    expect(a[0].candidatos.find((c) => c.id === 'tomas')?.nivel).toBe('libre');
  });
});

describe('quien falta y estaba cubriendo a otra persona', () => {
  it('solo cuentan las horas que cubría dentro de lo que falta ese día', () => {
    const cubre = [
      { id: '1', fecha: MAR, horaInicio: '10:30', horaFin: '11:15' },
      { id: '2', fecha: MAR, horaInicio: '15:30', horaFin: '16:15' },
      { id: '3', fecha: MIE, horaInicio: '10:30', horaFin: '11:15' },
    ];
    const faltas = [
      { fecha: MAR, horaInicio: '09:00', horaFin: '09:45' },
      { fecha: MAR, horaInicio: '11:45', horaFin: '12:30' },
    ];
    expect(cubreDentro(cubre, faltas).map((c) => c.id)).toEqual(['1']);
  });
});

describe('coberturas por baja', () => {
  it('el sustituto hereda el horario del titular; el titular no es candidato', () => {
    const h = [
      ses({ horaInicio: '09:45', horaFin: '10:30', grupos: ['2º B'], profes: [pr('marta')] }),
      ses({ horaInicio: '09:00', horaFin: '11:00', actividad: 'departamento', profes: [pr('rosa')] }),
    ];
    const cob = [{ titularId: 'rosa', sustitutoId: 'eva', desde: '2026-11-01', hasta: null, activa: true }];
    const conCob = aplicarCoberturas(h, cob);
    expect(conCob[1].profes.map((p) => p.id)).toEqual(['eva']);
    const deBaja = new Map([[MAR, ['rosa']]]);
    const [p] = proponerSustitutos(entrada(conCob, 'marta', { deBaja }));
    expect(p.elegido?.id).toBe('eva');
    expect(p.candidatos.some((c) => c.id === 'rosa')).toBe(false);
    // Fuera de fechas, nada cambia.
    expect(aplicarCoberturas(h, [{ ...cob[0], desde: '2026-12-01' }])[1].profes[0].id).toBe('rosa');
  });
});

describe('disponibilidad (decisión 15)', () => {
  const semana = new Map<number, SesionDia[]>([
    [
      2,
      [
        ses({ horaInicio: '09:00', horaFin: '10:00', grupos: ['1º A'], profes: [pr('ana')] }),
        ses({ horaInicio: '10:00', horaFin: '11:00', actividad: 'atencion_padres', profes: [pr('ana')] }),
        ses({ horaInicio: '12:00', horaFin: '13:00', grupos: ['1º A'], profes: [pr('ana')] }),
        ses({ horaInicio: '10:00', horaFin: '11:00', actividad: 'guardia', profes: [pr('pere')] }),
      ],
    ],
  ]);
  const franjas = [
    { horaInicio: '09:00', horaFin: '10:00' },
    { horaInicio: '10:00', horaFin: '11:00' },
    { horaInicio: '11:00', horaFin: '12:00' },
    { horaInicio: '12:00', horaFin: '13:00' },
  ];
  it('la rejilla de un profe: clase propia No (bloqueada), familias Si hace falta, libre en el colegio Solo urgencia', () => {
    const r = rejillaDisponibilidad('ana', semana, franjas, []).filter((c) => c.dia === 2);
    expect(r.map((c) => [c.disponibilidad, c.bloqueada])).toEqual([
      ['no', true],
      ['si_hace_falta', false],
      ['urgencia', false],
      ['no', true],
    ]);
  });
  it('un retoque se ve como retocado y manda', () => {
    const retoques: Retoque[] = [{ profeId: 'ana', dia: 2, horaInicio: '11:00', horaFin: '12:00', estado: 'si', nota: 'piscina' }];
    const c = rejillaDisponibilidad('ana', semana, franjas, retoques).find((x) => x.dia === 2 && x.horaInicio === '11:00');
    expect(c).toMatchObject({ disponibilidad: 'si', automatica: 'urgencia', retocada: true, nota: 'piscina' });
  });
  it('quien da en dos etapas: un retoque de una franja no se cuela en la otra que empieza igual', () => {
    const dos = new Map<number, SesionDia[]>([[2, [ses({ horaInicio: '10:00', horaFin: '11:00', actividad: 'departamento', profes: [pr('ana')] })]]]);
    const ep = { horaInicio: '09:00', horaFin: '09:45' };
    const ei = { horaInicio: '09:00', horaFin: '10:10' };
    const retoques: Retoque[] = [{ profeId: 'ana', dia: 2, ...ep, estado: 'no' }];
    const [cEp, cEi] = rejillaDisponibilidad('ana', dos, [ep, ei], retoques).filter((c) => c.dia === 2);
    expect(cEp).toMatchObject({ retocada: true, disponibilidad: 'no' });
    expect(cEi).toMatchObject({ retocada: false });
  });
  it('tocar cicla Sí → Si hace falta → Solo urgencia → No → Automático', () => {
    expect([null, 'si', 'si_hace_falta', 'urgencia', 'no'].map((e) => siguienteEstado(e as never))).toEqual(['si', 'si_hace_falta', 'urgencia', 'no', null]);
  });
  it('la semana: cuántos hay en cada estado y dónde va a faltar gente', () => {
    const m = mapaSemana([{ id: 'ana', nombre: 'Ana' }, { id: 'pere', nombre: 'Pere' }], semana, franjas, []).filter((c) => c.dia === 2);
    expect(m[1].cuenta).toEqual({ si: 1, si_hace_falta: 1, urgencia: 0, no: 0 });
    expect(m[0].falta).toBe(true);
  });
  it('la semana por etapa: quien no es de la etapa no cuenta ni sale; el equipo directivo, al final y marcado si no es de ella', () => {
    const franja10 = (cs: ReturnType<typeof mapaSemana>) => cs.find((c) => c.dia === 2 && c.horaInicio === '10:00')!;
    // Pere (guardia, «Sí») es del equipo directivo de esta etapa: cuenta, pero va en su línea.
    const propio = franja10(mapaSemana([{ id: 'ana', nombre: 'Ana' }, { id: 'pere', nombre: 'Pere', directivo: true }], semana, franjas, []));
    expect(propio).toMatchObject({ cuenta: { si: 1, si_hace_falta: 1, urgencia: 0, no: 0 }, disponibles: ['Ana'], directivos: ['Pere'], deOtraEtapa: [] });
    // Pere, directivo de OTRA etapa: sale marcado y NO cuenta.
    const otra = franja10(mapaSemana([{ id: 'ana', nombre: 'Ana' }], semana, franjas, [], [], undefined, [{ id: 'pere', nombre: 'Pere' }]));
    expect(otra).toMatchObject({ cuenta: { si: 0, si_hace_falta: 1, urgencia: 0, no: 0 }, disponibles: ['Ana'], directivos: [], deOtraEtapa: ['Pere'] });
    // Si nadie de la etapa pudiera, el directivo de otra no tapa el hueco.
    expect(franja10(mapaSemana([], semana, franjas, [], [], undefined, [{ id: 'pere', nombre: 'Pere' }])).falta).toBe(true);
  });
  it('a qué etapas pertenece alguien: su ficha más su horario; quien da en dos, en las dos; ESO y Bachillerato juntas', () => {
    expect(etapasDePersona(['ESO'], { etapa: 'ESO', etapas: null })).toEqual(['ESO']); // Bárbara: no sale en Infantil
    expect(etapasDePersona(['EI', 'EP'], { etapa: null, etapas: null })).toEqual(['EI', 'EP']);
    expect(etapasDePersona([], { etapa: 'EP', etapas: ['EI', 'EP', 'ESO'] })).toEqual(['EI', 'EP', 'ESO']); // la multiselección manda sobre la etapa única
    expect(etapasDePersona([], { etapa: 'BACH', etapas: null })).toEqual(['ESO']);
    expect(etapasDePersona([], { etapa: null, etapas: null })).toEqual([]);
  });
  it('dos ocupaciones a la vez: manda la peor', () => {
    const delDia = [
      ses({ horaInicio: '09:00', horaFin: '10:00', actividad: 'guardia', profes: [pr('x')] }),
      ses({ horaInicio: '09:30', horaFin: '10:30', grupos: ['1º A'], profes: [pr('x')] }),
    ];
    expect(evaluar('x', { horaInicio: '09:00', horaFin: '10:00' }, delDia, [], 2)).toMatchObject({ disponibilidad: 'no', bloqueada: true, nivel: null });
  });
});

describe('correos', () => {
  it('Google Calendar: hora de Madrid y caracteres raros bien escapados', () => {
    const url = enlaceGoogleCalendar({ titulo: 'Sustitución · 2º B & Mates', fecha: MAR, horaInicio: '09:45', horaFin: '10:30', lugar: 'Aula 2B', detalles: 'Ficha 3 "repaso"' });
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(u.searchParams.get('action')).toBe('TEMPLATE');
    expect(u.searchParams.get('dates')).toBe('20261117T094500/20261117T103000');
    expect(u.searchParams.get('ctz')).toBe('Europe/Madrid');
    expect(u.searchParams.get('text')).toBe('Sustitución · 2º B & Mates');
    expect(u.searchParams.get('details')).toBe('Ficha 3 "repaso"');
  });
  it('el asunto dice cuándo y dónde', () => {
    const h = (fecha: string, horaInicio: string, grupos = '2º B', aula: string | null = 'Música') => ({ fecha, horaInicio, horaFin: '11:15', grupos, aula, materia: null });
    expect(cuandoYDonde([h(MAR, '10:30')])).toBe('mar 17 nov · 10:30 · 2º B (Música)');
    expect(cuandoYDonde([h(MAR, '12:30'), h(MAR, '10:30')])).toBe('mar 17 nov · 10:30 y 12:30 · 2º B');
    expect(cuandoYDonde([h(MAR, '10:30'), h('2026-11-19', '09:00'), h(MIE, '09:00'), h(MIE, '10:00')])).toBe('del 17 al 19 nov · 4 horas');
  });
  it('plantillas: variables, escapado y lo guardado completado con lo de fábrica', () => {
    expect(pintarPlantilla('Hola, {nombre}: {raro}', { nombre: 'Lucía' })).toBe('Hola, Lucía: {raro}');
    expect(textoAHtml('Hola <b>\nadiós\n\nfin')).toBe('<p style="margin:0 0 12px">Hola &lt;b&gt;<br>adiós</p><p style="margin:0 0 12px">fin</p>');
    const p = leerPlantillas({ sustituto: { asunto: '', antes: 'Otro', despues: 3 } });
    expect(p.sustituto).toEqual({ asunto: PLANTILLAS_DE_FABRICA.sustituto.asunto, antes: 'Otro', despues: PLANTILLAS_DE_FABRICA.sustituto.despues });
    expect(p.anulacion).toEqual(PLANTILLAS_DE_FABRICA.anulacion);
  });
  it('grupos y aulas como se dicen', () => {
    expect(etiquetaGrupo('3INF', 'A')).toBe('3 años A');
    expect(etiquetaGrupo('2PRI', 'B')).toBe('2º B');
    expect(etiquetaGrupo('2ESO', 'A', 'Religión')).toBe('2º ESO A (Religión)');
    expect(etiquetaGrupo('3ESO', 'PDC')).toBe('3º PDC');
    expect(aulaVisible('A-2ESOB', null, [{ curso: '2ESO', letra: 'B' }])).toBeNull(); // la suya
    expect(aulaVisible('A-5PRIB', null, [{ curso: '2ESO', letra: 'B' }])).toBe('aula de 5º B');
    expect(aulaVisible('A-3ESOPDC', null, [{ curso: '4ESO', letra: 'A' }])).toBe('aula de 3º PDC');
    expect(aulaVisible('MUS', 'Música', [{ curso: '1ESO', letra: 'A' }])).toBe('Música');
    expect(aulaVisible(null, null, [])).toBeNull();
  });
  it('el motivo no está en ninguna plantilla de fábrica', () => {
    for (const p of Object.values(PLANTILLAS_DE_FABRICA)) expect(JSON.stringify(p)).not.toMatch(/motivo/i);
  });
});

describe('cuentas y datos de salud (decisión 11)', () => {
  it('el motivo se agrupa en escolar / personal', () => {
    expect(agruparMotivo('actividad_escolar')).toBe('escolar');
    expect(['medico', 'medico_familiar', 'enfermedad_leve', 'baja', 'otros'].map((m) => agruparMotivo(m))).toEqual(Array(5).fill('personal'));
  });
  it('cuenta para el ausente cada hora y para el sustituto cada cubierta, con las de urgencia', () => {
    const f = (ausenciaId: string, profeId: string, motivo: string, hayQueCubrir: boolean, sustitutoId: string | null, disponibilidad: string | null = 'si') => ({
      ausenciaId, profeId, profeNombre: profeId, motivo, fecha: MAR, hayQueCubrir, sustitutoId, sustitutoNombre: sustitutoId, disponibilidad,
    });
    const r = resumir([
      f('a1', 'marta', 'medico', true, 'lucia'),
      f('a1', 'marta', 'medico', true, null),
      f('a1', 'marta', 'medico', false, null),
      f('a2', 'pere', 'actividad_escolar', true, 'lucia', 'urgencia'),
    ]);
    expect(r).toMatchObject({ sesiones: 4, aCubrir: 3, cubiertas: 2, sinCubrir: 1, ausencias: 2 });
    expect(r.porAusente[0]).toMatchObject({ id: 'marta', personal: 3, escolar: 0, total: 3 });
    expect(r.porSustituto).toEqual([{ id: 'lucia', nombre: 'lucia', total: 2, urgencia: 1 }]);
  });
});

describe('«Mis sustituciones» (decisión 16)', () => {
  it('prueba de concepto: solo quien tiene el módulo; abierta, todo el claustro', () => {
    expect(puedeVerMisSustituciones({ role: 'jefe' })).toBe(true);
    expect(puedeVerMisSustituciones({ role: 'tutor' })).toBe(false);
    expect(puedeVerMisSustituciones(null)).toBe(false);
    const abierta: ConfigSustituciones = { ...CONFIGURACION.sustituciones, misSustitucionesParaTodos: true };
    expect(puedeVerMisSustituciones({ role: 'tutor' }, abierta)).toBe(true);
  });
});

describe('peticiones', () => {
  const ok = {
    profeId: '00000000-0000-4000-8000-000000000001',
    desde: MAR,
    hasta: MAR,
    motivo: 'medico',
    avisar: true,
    sesiones: [{ fecha: MAR, horSesionId: '00000000-0000-4000-8000-000000000002', sustitutoId: null }],
  };
  it('valida motivo, fechas y la nota de «Otros»', () => {
    expect(PeticionAusencia.safeParse(ok).success).toBe(true);
    expect(PeticionAusencia.safeParse({ ...ok, motivo: 'vacaciones' }).success).toBe(false);
    expect(PeticionAusencia.safeParse({ ...ok, hasta: '2026-11-16' }).success).toBe(false);
    expect(PeticionAusencia.safeParse({ ...ok, motivo: 'otros' }).success).toBe(false);
    expect(PeticionAusencia.safeParse({ ...ok, motivo: 'otros', nota: 'Juicio' }).success).toBe(true);
  });
});
