import { describe, expect, it } from 'vitest';
import {
  aplicarSustituciones,
  candidatoDeExtra,
  estadoSustitucion,
  esVigente,
  planSustitucionesEducamos,
  resolverTitular,
  sustituirTutores,
  titularesQueCubre,
  type CandidatoSustituto,
  type ProfeParaTitular,
  type SustitucionBase,
  type SustitucionExistente,
} from '@/lib/sustituciones';

const HOY = '2026-11-02';

const s = (o: Partial<SustitucionBase> = {}): SustitucionBase => ({
  sustitutoId: 'ana',
  titularId: 'beto',
  desde: null,
  hasta: null,
  activa: true,
  ...o,
});

describe('estadoSustitucion', () => {
  it('sin fechas y activa: vigente', () => {
    expect(estadoSustitucion(s(), HOY)).toBe('vigente');
  });
  it('apagada a mano: desactivada, aunque las fechas valgan', () => {
    expect(estadoSustitucion(s({ activa: false, desde: '2026-10-01' }), HOY)).toBe('desactivada');
  });
  it('los dos extremos son inclusive', () => {
    expect(estadoSustitucion(s({ desde: HOY }), HOY)).toBe('vigente');
    expect(estadoSustitucion(s({ hasta: HOY }), HOY)).toBe('vigente');
  });
  it('antes del desde: programada · después del hasta: caducada', () => {
    expect(estadoSustitucion(s({ desde: '2026-11-03' }), HOY)).toBe('programada');
    expect(estadoSustitucion(s({ hasta: '2026-11-01' }), HOY)).toBe('caducada');
  });
  it('desactivada gana a caducada (se ve que está apagada)', () => {
    expect(estadoSustitucion(s({ activa: false, hasta: '2026-01-01' }), HOY)).toBe('desactivada');
  });
  it('esVigente solo es true para vigente', () => {
    expect(esVigente(s(), HOY)).toBe(true);
    expect(esVigente(s({ hasta: '2026-01-01' }), HOY)).toBe(false);
  });
});

describe('titularesQueCubre', () => {
  it('solo las vigentes de ese sustituto, sin repetir', () => {
    const lista = [
      s({ titularId: 'beto' }),
      s({ titularId: 'beto' }),
      s({ titularId: 'carla', hasta: '2026-01-01' }),
      s({ titularId: 'dani', activa: false }),
      s({ sustitutoId: 'otra', titularId: 'eva' }),
    ];
    expect(titularesQueCubre('ana', lista, HOY)).toEqual(['beto']);
    expect(titularesQueCubre('nadie', lista, HOY)).toEqual([]);
  });
});

describe('aplicarSustituciones', () => {
  it('cambia al titular por su sustituto y deja a los demás', () => {
    expect(aplicarSustituciones(['beto', 'carla'], [s()], HOY)).toEqual(['ana', 'carla']);
  });
  it('una sustitución caducada, programada o apagada no cambia nada', () => {
    expect(aplicarSustituciones(['beto'], [s({ hasta: '2026-01-01' })], HOY)).toEqual(['beto']);
    expect(aplicarSustituciones(['beto'], [s({ desde: '2027-01-01' })], HOY)).toEqual(['beto']);
    expect(aplicarSustituciones(['beto'], [s({ activa: false })], HOY)).toEqual(['beto']);
  });
  it('dos sustitutos de la misma persona: salen los dos', () => {
    expect(aplicarSustituciones(['beto'], [s(), s({ sustitutoId: 'gus' })], HOY)).toEqual(['ana', 'gus']);
  });
  it('si el sustituto ya era tutor de la clase no se repite', () => {
    expect(aplicarSustituciones(['beto', 'ana'], [s()], HOY)).toEqual(['ana']);
  });
});

describe('candidatoDeExtra', () => {
  it('lee las dos columnas de Educamos y las fechas', () => {
    const c = candidatoDeExtra(
      'ana',
      { 'PROF. SUSTITUTO': 'TRUE', 'PROF. TITULAR': '  BETO   RÍOS  LUNA ' },
      { fechaAlta: '2026-10-19', fechaBaja: null },
    );
    expect(c).toEqual({ sustitutoId: 'ana', esSustituto: true, titularTexto: 'BETO RÍOS LUNA', desde: '2026-10-19', hasta: null });
  });
  it('FALSE, vacío o sin extra: no es sustituto', () => {
    const f = { fechaAlta: null, fechaBaja: null };
    expect(candidatoDeExtra('a', { 'PROF. SUSTITUTO': 'FALSE', 'PROF. TITULAR': 'X' }, f).esSustituto).toBe(false);
    expect(candidatoDeExtra('a', {}, f)).toMatchObject({ esSustituto: false, titularTexto: null });
    expect(candidatoDeExtra('a', null, f).esSustituto).toBe(false);
  });
});

const profes: ProfeParaTitular[] = [
  { id: 'ana', nombre: 'ANA', apellido1: 'LUNA', apellido2: 'PÉREZ', active: true },
  { id: 'beto', nombre: 'BETO', apellido1: 'RÍOS', apellido2: 'LUNA', active: true },
  { id: 'carla', nombre: 'CARLA', apellido1: 'SOL', apellido2: 'MAR', active: true },
  { id: 'carla-vieja', nombre: 'CARLA', apellido1: 'SOL', apellido2: 'MAR', active: false },
  { id: 'dani1', nombre: 'DANI', apellido1: 'PINO', apellido2: 'ROCA', active: true },
  { id: 'dani2', nombre: 'DANI', apellido1: 'PINO', apellido2: 'ROCA', active: true },
];

describe('resolverTitular', () => {
  it('casa sin fijarse en acentos, mayúsculas ni espacios', () => {
    expect(resolverTitular('  beto   rios luna', profes)).toEqual({ tipo: 'ok', id: 'beto' });
  });
  it('con dos fichas del mismo nombre manda la activa', () => {
    expect(resolverTitular('CARLA SOL MAR', profes)).toEqual({ tipo: 'ok', id: 'carla' });
  });
  it('dos activas con el mismo nombre: ambiguo, no adivina', () => {
    expect(resolverTitular('DANI PINO ROCA', profes)).toEqual({ tipo: 'ambiguo', ids: ['dani1', 'dani2'] });
  });
  it('nadie con ese nombre: ninguno', () => {
    expect(resolverTitular('ZOE NADIE', profes)).toEqual({ tipo: 'ninguno' });
    expect(resolverTitular('   ', profes)).toEqual({ tipo: 'ninguno' });
  });
});

describe('planSustitucionesEducamos', () => {
  const cand = (o: Partial<CandidatoSustituto> = {}): CandidatoSustituto => ({
    sustitutoId: 'ana',
    esSustituto: true,
    titularTexto: 'BETO RIOS LUNA',
    desde: '2026-10-19',
    hasta: null,
    ...o,
  });
  const ex = (o: Partial<SustitucionExistente> = {}): SustitucionExistente => ({
    id: 'x1',
    sustitutoId: 'ana',
    titularId: 'beto',
    desde: '2026-10-19',
    hasta: null,
    activa: true,
    origen: 'educamos',
    ...o,
  });

  it('crea la sustitución con la vigencia de alta y baja', () => {
    const plan = planSustitucionesEducamos([cand({ hasta: '2026-12-18' })], profes, [], HOY);
    expect(plan.crear).toEqual([{ sustitutoId: 'ana', titularId: 'beto', desde: '2026-10-19', hasta: '2026-12-18' }]);
    expect(plan.avisos).toEqual([]);
  });

  it('si ya existe igual, no hace nada (idempotente)', () => {
    const plan = planSustitucionesEducamos([cand()], profes, [ex()], HOY);
    expect(plan).toEqual({ crear: [], actualizar: [], apagar: [], avisos: [] });
  });

  it('si cambian las fechas, las actualiza pero no toca el interruptor', () => {
    const plan = planSustitucionesEducamos([cand({ hasta: '2026-12-18' })], profes, [ex({ activa: false })], HOY);
    expect(plan.actualizar).toEqual([{ id: 'x1', desde: '2026-10-19', hasta: '2026-12-18' }]);
    expect(plan.apagar).toEqual([]); // ya estaba apagada: no hay nada que apagar ni se reactiva
  });

  it('una sustitución manual del mismo par no se pisa ni se duplica', () => {
    const plan = planSustitucionesEducamos([cand({ hasta: '2026-12-18' })], profes, [ex({ origen: 'manual' })], HOY);
    expect(plan).toEqual({ crear: [], actualizar: [], apagar: [], avisos: [] });
  });

  it('un sustituto con baja ya pasada (histórico) no crea nada', () => {
    const plan = planSustitucionesEducamos([cand({ hasta: '2025-06-30' })], profes, [], HOY);
    expect(plan.crear).toEqual([]);
  });

  it('PROF. SUSTITUTO = FALSE no crea, aunque quede el titular escrito', () => {
    const plan = planSustitucionesEducamos([cand({ esSustituto: false })], profes, [], HOY);
    expect(plan.crear).toEqual([]);
  });

  it('si Educamos deja de contarlo (ya no es sustituto), se apaga la de origen educamos', () => {
    const plan = planSustitucionesEducamos([cand({ esSustituto: false })], profes, [ex()], HOY);
    expect(plan.apagar).toEqual(['x1']);
  });

  it('si cambia de titular: crea la nueva y apaga la vieja', () => {
    const plan = planSustitucionesEducamos([cand({ titularTexto: 'CARLA SOL MAR' })], profes, [ex()], HOY);
    expect(plan.crear).toEqual([{ sustitutoId: 'ana', titularId: 'carla', desde: '2026-10-19', hasta: null }]);
    expect(plan.apagar).toEqual(['x1']);
  });

  it('nunca apaga una manual', () => {
    const plan = planSustitucionesEducamos([cand({ esSustituto: false })], profes, [ex({ origen: 'manual' })], HOY);
    expect(plan.apagar).toEqual([]);
  });

  it('titular que no existe o ambiguo: avisa y no crea', () => {
    const a = planSustitucionesEducamos([cand({ titularTexto: 'ZOE NADIE' })], profes, [], HOY);
    expect(a.crear).toEqual([]);
    expect(a.avisos[0]).toContain('ZOE NADIE');
    const b = planSustitucionesEducamos([cand({ titularTexto: 'DANI PINO ROCA' })], profes, [], HOY);
    expect(b.crear).toEqual([]);
    expect(b.avisos[0]).toContain('2 fichas');
  });

  it('no se sustituye a sí mismo', () => {
    const plan = planSustitucionesEducamos([cand({ titularTexto: 'ANA LUNA PEREZ' })], profes, [], HOY);
    expect(plan.crear).toEqual([]);
    expect(plan.avisos).toHaveLength(1);
  });
});

describe('sustituirTutores', () => {
  const t = (id: string) => ({ eduTeacherId: id, nombre: id.toUpperCase(), email: `${id}@cole.test` });

  it('sin sustitutos devuelve lo mismo', () => {
    expect(sustituirTutores([t('beto'), t('carla')], [])).toEqual([t('beto'), t('carla')]);
  });
  it('el sustituto ocupa el sitio del titular y anota a quién cubre', () => {
    const r = sustituirTutores([t('beto'), t('carla')], [{ titularId: 'beto', sustituto: t('ana') }]);
    expect(r.map((x) => x.eduTeacherId)).toEqual(['ana', 'carla']);
    expect(r[0].sustituyeA).toEqual(['beto']);
    expect(r[1].sustituyeA).toBeUndefined();
  });
  it('si el sustituto ya era tutor de la clase no se repite, y se le anota a quién cubre', () => {
    const r = sustituirTutores([t('beto'), t('ana')], [{ titularId: 'beto', sustituto: t('ana') }]);
    expect(r.map((x) => x.eduTeacherId)).toEqual(['ana']);
    expect(r[0].sustituyeA).toEqual(['beto']);
  });
  it('no modifica los objetos de entrada', () => {
    const entrada = [t('beto')];
    sustituirTutores(entrada, [{ titularId: 'beto', sustituto: t('ana') }]);
    expect(entrada[0]).toEqual(t('beto'));
  });
});
