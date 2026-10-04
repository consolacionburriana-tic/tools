import { describe, expect, it } from 'vitest';
import {
  compactar,
  emparejarClases,
  fechaLimiteUtc,
  nombreDiceClase,
  rellenarTextoClassroom,
  TEMA_CLASSROOM,
  TEXTO_CLASSROOM_POR_DEFECTO,
  tituloSinAudiencia,
} from '../evaluaciones-classroom';

const c = (id: string, nombre: string) => ({ id, nombre, enlace: null });

describe('compactar', () => {
  it('quita acentos, º, espacios y signos', () => {
    expect(compactar('Tutoría 1º ESO-A')).toBe('TUTORIA1ESOA');
    expect(compactar(null)).toBe('');
  });
});

describe('nombreDiceClase', () => {
  const eso1b = { curso: '1ESO', letra: 'B' };
  it('reconoce las formas habituales del nombre', () => {
    for (const n of ['1ESOB (2026/2027)', 'Tutoría 1º ESO B', '1 ESO-B', 'tutoria 1ESOB']) {
      expect(nombreDiceClase(n, eso1b)).toBe(true);
    }
  });
  it('no confunde un curso con otro ni una letra con otra', () => {
    expect(nombreDiceClase('11ESOB', eso1b)).toBe(false);
    expect(nombreDiceClase('1ESOBC', eso1b)).toBe(false);
    expect(nombreDiceClase('1ESOA', eso1b)).toBe(false);
    expect(nombreDiceClase('2ESOB', eso1b)).toBe(false);
  });
  it('una clase sin letra no casa con la que sí la tiene', () => {
    expect(nombreDiceClase('1ESOA', { curso: '1ESO', letra: null })).toBe(false);
    expect(nombreDiceClase('Tutoría 1ESO (2026/2027)', { curso: '1ESO', letra: null })).toBe(true);
  });
  it('1BACH no casa con 1ESO y PDC se lee por el curso', () => {
    expect(nombreDiceClase('1BACHA', { curso: '1ESO', letra: 'A' })).toBe(false);
    expect(nombreDiceClase('Tutoría 3PPDC', { curso: '3ºPPDC', letra: 'PDC' })).toBe(true);
  });
});

describe('emparejarClases', () => {
  const clases = [
    { curso: '1ESO', letra: 'A' },
    { curso: '1ESO', letra: 'B' },
    { curso: '2ESO', letra: 'A' },
  ];
  const deClassroom = [
    c('1', 'Tutoría 1ESOA (2026/2027)'),
    c('2', '1ESOA (2025/2026)'), // curso pasado, sigue activa
    c('3', '1ESOB (2026/2027)'),
    c('4', 'Matemáticas 1ESOB (2026/2027)'),
    c('5', 'Tutoría 1ESOB (2026/2027)'),
  ];
  const r = emparejarClases(clases, deClassroom, '2026-27');

  it('descarta las de otro curso escolar', () => {
    expect(r[0].destino?.id).toBe('1');
  });
  it('si hay varias, gana la que dice tutoría', () => {
    expect(r[1].destino?.id).toBe('5');
  });
  it('sin ninguna, lo dice', () => {
    expect(r[2].destino).toBeNull();
    expect(r[2].motivo).toBe('sin-clase');
  });
  it('varias sin desempate: ambigua, no elige', () => {
    const a = emparejarClases([{ curso: '1ESO', letra: 'B' }], [c('3', '1ESOB'), c('4', 'Música 1ESOB')], '2026-27');
    expect(a[0].destino).toBeNull();
    expect(a[0].motivo).toBe('ambigua');
    expect(a[0].candidatas).toHaveLength(2);
  });
});

describe('rellenarTextoClassroom', () => {
  it('sustituye las variables y deja las desconocidas', () => {
    expect(
      rellenarTextoClassroom('{titulo} · {curso} · {curso_escolar} · {nombre}', {
        titulo: 'Convivencia',
        curso: '1ESO B',
        academicYear: '2026-27',
        enlace: 'x',
      }),
    ).toBe('Convivencia · 1ESO B · 2026-27 · {nombre}');
  });
});

describe('tituloSinAudiencia', () => {
  it('quita el sector de las conjuntas', () => {
    expect(tituloSinAudiencia('Tutoría Paz · Alumnado')).toBe('Tutoría Paz');
    expect(tituloSinAudiencia('Convivencia · Profesorado')).toBe('Convivencia');
  });
  it('deja en paz lo que no lleva sector', () => {
    expect(tituloSinAudiencia('Tutoría Paz')).toBe('Tutoría Paz');
    expect(tituloSinAudiencia('Alumnado · Tutoría')).toBe('Alumnado · Tutoría');
  });
});

describe('formato de las publicaciones', () => {
  it('título y texto de David', () => {
    const vars = { titulo: 'Tutoría Paz', curso: '1ESO B', academicYear: '2026-27', enlace: 'x' };
    expect(rellenarTextoClassroom(TEXTO_CLASSROOM_POR_DEFECTO.titulo, vars)).toBe('Evalúa 🔎 Tutoría Paz');
    expect(TEMA_CLASSROOM).toBe('Evaluamos 🔍 Tu opinión cuenta');
  });
});

describe('fechaLimiteUtc', () => {
  it('separa fecha y hora en UTC', () => {
    expect(fechaLimiteUtc(new Date('2026-10-11T21:59:00Z'))).toEqual({
      dueDate: { year: 2026, month: 10, day: 11 },
      dueTime: { hours: 21, minutes: 59 },
    });
  });
  it('fecha inválida → null', () => {
    expect(fechaLimiteUtc(new Date('nada'))).toBeNull();
  });
});
