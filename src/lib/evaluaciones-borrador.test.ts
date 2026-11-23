import { describe, expect, it } from 'vitest';
import {
  BORRADOR_CADUCA_EN_MS,
  BORRADOR_VERSION,
  borradorVacio,
  claveBorrador,
  restaurarBorrador,
  type PreguntaParaBorrador,
} from './evaluaciones-borrador';

const preguntas: PreguntaParaBorrador[] = [
  { id: 'q1', tipo: 'escala', filas: [], opciones: [], permiteOtra: false },
  { id: 'q2', tipo: 'escala', filas: [{ clave: 'a' }, { clave: 'b' }], opciones: [], permiteOtra: false },
  { id: 'q3', tipo: 'texto', filas: [], opciones: [], permiteOtra: false },
  { id: 'q4', tipo: 'varias', filas: [], opciones: [{ clave: 'x' }, { clave: 'y' }], permiteOtra: true },
];
const AHORA = 1_800_000_000_000;
const crudo = (extra: object = {}, guardadoEl = AHORA - 1000) =>
  JSON.stringify({
    version: BORRADOR_VERSION,
    guardadoEl,
    clase: '1º ESO|A',
    etapa: 'ESO',
    escalas: { q1: 4, 'q2::a': 3 },
    opciones: { q4: ['x'] },
    textos: { q3: 'Muy bien' },
    otras: { q4: 'otra cosa' },
    ...extra,
  });
const restaurar = (c: string | null) => restaurarBorrador(c, preguntas, ['1º ESO|A'], ['EI', 'EP', 'ESO'], AHORA);

describe('borrador de evaluación', () => {
  it('la clave distingue formulario e invitación', () => {
    expect(claveBorrador('abc', null)).not.toBe(claveBorrador('abc', 'inv'));
    expect(claveBorrador('abc', null)).not.toBe(claveBorrador('def', null));
  });

  it('restaura todo lo que sigue existiendo', () => {
    expect(restaurar(crudo())).toEqual({
      clase: '1º ESO|A',
      etapa: 'ESO',
      escalas: { q1: 4, 'q2::a': 3 },
      opciones: { q4: ['x'] },
      textos: { q3: 'Muy bien' },
      otras: { q4: 'otra cosa' },
    });
  });

  it('descarta lo que ya no existe en el formulario', () => {
    const r = restaurar(
      crudo({
        clase: '2º ESO|B',
        etapa: 'BACH',
        escalas: { q1: 4, borrada: 2, 'q2::zzz': 1, 'q2::b': 5 },
        opciones: { q4: ['x', 'ya-no-existe'], borrada: ['x'] },
        textos: { q3: '  ', q1: 'texto en una escala' },
      }),
    );
    expect(r?.clase).toBeNull();
    expect(r?.etapa).toBeNull();
    expect(r?.escalas).toEqual({ q1: 4, 'q2::b': 5 });
    expect(r?.opciones).toEqual({ q4: ['x'] });
    expect(r?.textos).toEqual({});
  });

  it('caducado, de otra versión, corrupto o vacío → null', () => {
    expect(restaurar(crudo({}, AHORA - BORRADOR_CADUCA_EN_MS - 1))).toBeNull();
    expect(restaurar(crudo({ version: 99 }))).toBeNull();
    expect(restaurar('{no es json')).toBeNull();
    expect(restaurar(null)).toBeNull();
    expect(restaurar(crudo({ clase: null, etapa: null, escalas: {}, opciones: {}, textos: {}, otras: {} }))).toBeNull();
  });

  it('borradorVacio', () => {
    expect(borradorVacio({ clase: null, etapa: null, escalas: {}, opciones: { q: [] }, textos: { q: ' ' }, otras: {} })).toBe(true);
    expect(borradorVacio({ clase: null, etapa: null, escalas: { q: 1 }, opciones: {}, textos: {}, otras: {} })).toBe(false);
  });
});
