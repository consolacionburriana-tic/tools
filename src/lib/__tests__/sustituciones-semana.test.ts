// Estados de una hora, salidas que liberan profes y el calendario (docs/32, 23-nov-2026). Datos inventados.
import { describe, expect, it } from 'vitest';
import {
  colocarBloques,
  contarEstados,
  diasDeSemana,
  estadoHora,
  etapasDeGrupo,
  evaluar,
  lunesDe,
  marcarGruposFuera,
  nivelDe,
  NIVEL_GRUPO_FUERA,
  proponerSustitutos,
  rotuloSemana,
  sesionesDelAusente,
  type SesionDia,
} from '@/lib/sustituciones';

const HOY = '2026-11-24';
const base = { fecha: HOY, hayQueCubrir: true, sustitutoId: 'lucia', sustituto2Id: null, avisoEstado: 'no', confirmacionEstado: 'pendiente', confirmacion2Estado: 'pendiente' };

describe('estado de una hora', () => {
  it('confirmada > cubierta > borrador; sin cubrir; error; no hace falta', () => {
    expect(estadoHora({ ...base, avisoEstado: 'enviado', confirmacionEstado: 'confirmada' }, HOY)).toBe('confirmada');
    expect(estadoHora({ ...base, avisoEstado: 'enviado' }, HOY)).toBe('cubierta');
    expect(estadoHora({ ...base, avisoEstado: 'programado' }, HOY)).toBe('cubierta');
    expect(estadoHora(base, HOY)).toBe('borrador');
    expect(estadoHora({ ...base, sustitutoId: null }, HOY)).toBe('sin_cubrir');
    expect(estadoHora({ ...base, avisoEstado: 'error' }, HOY)).toBe('error');
    expect(estadoHora({ ...base, hayQueCubrir: false, sustitutoId: null }, HOY)).toBe('no_hace_falta');
  });
  it('lo apuntado a posteriori sin avisar no es un borrador: ya pasó', () => {
    expect(estadoHora({ ...base, fecha: '2026-11-20' }, HOY)).toBe('cubierta');
  });
  it('con dos sustitutos, confirmada solo si confirman los dos', () => {
    const dos = { ...base, sustituto2Id: 'pere', avisoEstado: 'enviado', confirmacionEstado: 'confirmada' };
    expect(estadoHora(dos, HOY)).toBe('cubierta');
    expect(estadoHora({ ...dos, confirmacion2Estado: 'confirmada' }, HOY)).toBe('confirmada');
  });
  it('cuenta por estado', () => {
    const c = contarEstados([base, { ...base, sustitutoId: null }, { ...base, avisoEstado: 'enviado' }], HOY);
    expect(c).toMatchObject({ borrador: 1, sin_cubrir: 1, cubierta: 1 });
  });
});

const s = (p: Partial<SesionDia> & Pick<SesionDia, 'sesionId' | 'horaInicio' | 'horaFin' | 'profes'>): SesionDia => ({
  fecha: HOY, tramo: null, actividad: 'clase', etiqueta: null, grupos: [], materia: null, aula: null, ...p,
});

describe('salidas: el grupo se va y su profe queda libre', () => {
  const clase4A = s({ sesionId: 'a', horaInicio: '10:00', horaFin: '11:00', grupos: ['4º ESO A'], gruposClave: ['4ESO|A'], profes: [{ id: 'pere', principal: true, rol: 'titular' }] });
  const juntos = s({ sesionId: 'b', horaInicio: '10:00', horaFin: '11:00', grupos: ['4º ESO A', '4º ESO B'], gruposClave: ['4ESO|A', '4ESO|B'], profes: [{ id: 'ana', principal: true, rol: 'titular' }] });
  const otra = s({ sesionId: 'c', horaInicio: '12:00', horaFin: '13:00', grupos: ['4º ESO A'], gruposClave: ['4ESO|A'], profes: [{ id: 'pere', principal: true, rol: 'titular' }] });
  const salida = { fecha: HOY, horaInicio: '09:00', horaFin: '11:30', grupos: ['4ESO|A'] };

  it('marca solo las sesiones con TODOS sus grupos fuera y dentro de las horas', () => {
    const [a, b, c] = marcarGruposFuera([clase4A, juntos, otra], [salida]);
    expect(a.grupoFuera).toBe(true);
    expect(b.grupoFuera).toBeUndefined();
    expect(c.grupoFuera).toBeUndefined();
    expect(marcarGruposFuera([otra], [{ ...salida, horaInicio: null, horaFin: null }])[0].grupoFuera).toBe(true);
    expect(marcarGruposFuera([clase4A], [{ ...salida, fecha: '2026-11-25' }])[0].grupoFuera).toBeUndefined();
  });

  it('quien falta no necesita sustituto en esa hora; quien la da queda libre y el primero', () => {
    const [a] = marcarGruposFuera([clase4A], [salida]);
    expect(sesionesDelAusente([a], 'pere')[0].hayQueCubrir).toBe(false);
    expect(nivelDe(a, 'pere')).toBe(NIVEL_GRUPO_FUERA);
    expect(evaluar('pere', { horaInicio: '10:00', horaFin: '11:00' }, [a], [], 2).disponibilidad).toBe('si');
  });

  it('en la propuesta va por delante de una codocencia', () => {
    const [a] = marcarGruposFuera([clase4A], [salida]);
    const falta = s({ sesionId: 'x', horaInicio: '10:00', horaFin: '11:00', grupos: ['2º B'], profes: [{ id: 'marta', principal: true, rol: 'titular' }] });
    const codo = s({ sesionId: 'y', horaInicio: '10:00', horaFin: '11:00', grupos: ['3º A'], profes: [{ id: 'joan', principal: true, rol: 'titular' }, { id: 'rosa', principal: false, rol: 'apoyo' }] });
    const delDia = [a, falta, codo];
    const [p] = proponerSustitutos({
      sesiones: sesionesDelAusente(delDia, 'marta').filter((x) => x.hayQueCubrir),
      ausenteId: 'marta',
      horario: new Map([[HOY, delDia]]),
      profes: ['marta', 'pere', 'joan', 'rosa'].map((id) => ({ id, nombre: id })),
      ausencias: [], cubriendo: [], oratorios: [], deBaja: new Map(), retoques: [],
    });
    expect(p.elegido?.id).toBe('pere');
    expect(p.candidatos[1].id).toBe('rosa');
  });
});

describe('calendario', () => {
  it('lunes, días y rótulo de la semana', () => {
    expect(lunesDe('2026-11-26')).toBe('2026-11-23');
    expect(lunesDe('2026-11-29')).toBe('2026-11-23');
    expect(diasDeSemana('2026-11-23')).toEqual(['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27']);
    expect(rotuloSemana('2026-11-23')).toBe('23 – 27 nov 2026');
    expect(rotuloSemana('2026-11-30')).toBe('30 nov – 4 dic 2026');
  });

  it('los bloques que se pisan van en columnas; los que no, a todo lo ancho', () => {
    const r = colocarBloques([
      { id: 'a', horaInicio: '09:00', horaFin: '10:00' },
      { id: 'b', horaInicio: '09:30', horaFin: '10:30' },
      { id: 'c', horaInicio: '10:00', horaFin: '11:00' },
      { id: 'd', horaInicio: '12:00', horaFin: '13:00' },
    ]);
    const por = Object.fromEntries(r.map((x) => [x.id, x]));
    expect(por.a).toMatchObject({ columna: 0, columnas: 2 });
    expect(por.b).toMatchObject({ columna: 1, columnas: 2 });
    expect(por.c).toMatchObject({ columna: 0, columnas: 2 });
    expect(por.d).toMatchObject({ columna: 0, columnas: 1 });
  });

  it('las etapas de cada jefatura', () => {
    expect(etapasDeGrupo('infantil-primaria')).toEqual(['EI', 'EP']);
    expect(etapasDeGrupo('eso')).toEqual(['ESO']);
    expect(etapasDeGrupo(null)).toEqual(['EI', 'EP', 'ESO']);
  });
});

import { colorDeCurso, etapaDeGrupoTexto, etapasDeVista, filaDe, jefaturaDeVista, nombreCorto, vistaPorDefecto } from '@/lib/sustituciones';

describe('vistas y colores por curso', () => {
  it('etapa y nivel del grupo guardado', () => {
    expect(etapaDeGrupoTexto('3 años A, 3 años B')).toEqual({ etapa: 'EI', nivel: 3 });
    expect(etapaDeGrupoTexto('5º A')).toEqual({ etapa: 'EP', nivel: 5 });
    expect(etapaDeGrupoTexto('4º ESO B, 4º PDC')).toEqual({ etapa: 'ESO', nivel: 4 });
    expect(etapaDeGrupoTexto('3º PDC')).toEqual({ etapa: 'ESO', nivel: 3 });
    expect(etapaDeGrupoTexto(null)).toEqual({ etapa: null, nivel: null });
  });
  it('cuatro colores: Infantil y los tres ciclos; en la ESO, cada curso', () => {
    expect(colorDeCurso('EI', 4)?.color).toBe('c4');
    expect([1, 2, 3, 4, 5, 6].map((n) => colorDeCurso('EP', n)?.color)).toEqual(['c1', 'c1', 'c2', 'c2', 'c3', 'c3']);
    expect(colorDeCurso('EP', 3)?.nombre).toBe('2.º ciclo');
    expect([1, 2, 3, 4].map((n) => colorDeCurso('ESO', n)?.color)).toEqual(['c1', 'c2', 'c3', 'c4']);
    expect(colorDeCurso(null, null)).toBeNull();
  });
  it('vistas: por defecto cada jefatura su etapa en rejilla', () => {
    expect(vistaPorDefecto('infantil-primaria')).toBe('EP');
    expect(vistaPorDefecto('eso')).toBe('ESO');
    expect(vistaPorDefecto(null)).toBe('todas');
    expect(etapasDeVista('infantil-primaria')).toEqual(['EI', 'EP']);
    expect(jefaturaDeVista('EI')).toBe('infantil-primaria');
  });
  it('nombre corto y fila de la rejilla', () => {
    expect(nombreCorto('Alejandro Sánchez')).toBe('Alejandro Sán.');
    expect(nombreCorto('Ana Gil')).toBe('Ana Gil');
    const filas = [
      { horaInicio: '09:00', horaFin: '09:45', etiqueta: '1ª', dias: [1, 2, 3, 4, 5] },
      { horaInicio: '09:45', horaFin: '10:30', etiqueta: '2ª', dias: [1, 2, 3, 4, 5] },
      { horaInicio: '15:00', horaFin: '16:00', etiqueta: '6ª', dias: [1, 2] },
    ];
    expect(filaDe({ horaInicio: '09:50', horaFin: '10:30' }, 2, filas)).toBe(1);
    expect(filaDe({ horaInicio: '15:00', horaFin: '16:00' }, 5, filas)).toBe(-1);
  });
});
