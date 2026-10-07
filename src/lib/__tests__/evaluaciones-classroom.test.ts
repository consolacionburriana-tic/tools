import { describe, expect, it } from 'vitest';
import {
  claveClase,
  compactar,
  courseIdDeEnlace,
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

describe('emparejarClases · curso en la sección', () => {
  const cs = (id: string, nombre: string, seccion: string) => ({ id, nombre, seccion, enlace: null });
  const lista = [
    cs('1', 'Tutoría', '2ESOB (2026/2027)'),
    cs('2', '3°B Tutoría 26/27', '3ESOB (2026/2027)'),
    cs('3', 'Tutoría', '2ESOB (2025/2026)'), // curso pasado
    cs('4', 'Tutoría 1 ESO A', ''),
  ];
  it('casa por la sección cuando el nombre es solo «Tutoría»', () => {
    const r = emparejarClases([{ curso: '2ESO', letra: 'B' }], lista, '2026-27');
    expect(r[0].destino?.id).toBe('1');
  });
  it('un «26/27» en el nombre no estropea el curso de la sección', () => {
    const r = emparejarClases([{ curso: '3ESO', letra: 'B' }], lista, '2026-27');
    expect(r[0].destino?.id).toBe('2');
  });
  it('sigue casando por el nombre cuando no hay sección', () => {
    const r = emparejarClases([{ curso: '1ESO', letra: 'A' }], lista, '2026-27');
    expect(r[0].destino?.id).toBe('4');
  });
});

describe('emparejarClases · descripción y formas cortas', () => {
  const cd = (id: string, nombre: string, descripcion: string) => ({ id, nombre, descripcion, enlace: null });
  it('casa por la descripción', () => {
    const r = emparejarClases([{ curso: '1ESO', letra: 'A' }], [cd('1', 'Tutoría', '1 ESO A (2026/2027)')], '2026-27');
    expect(r[0].destino?.id).toBe('1');
  });
  it.each(['Tutoría 3B', '3°B Tutoría', 'Tutoria 3 B', 'Tutoría 3º ESO B', 'tutoría 3 eso-b'])('forma corta: %s', (nombre) => {
    const r = emparejarClases([{ curso: '3ESO', letra: 'B' }], [cd('1', nombre, '')], '2026-27');
    expect(r[0].destino?.id).toBe('1');
  });
  it('la forma corta exige «tutoría» y no confunde 13B, 3BACH ni 3 A', () => {
    const l = [cd('1', '3B Matemáticas', ''), cd('2', 'Tutoría 13B', ''), cd('3', 'Tutoría 3BACH B', ''), cd('4', 'Tutoría 3 A', '')];
    expect(emparejarClases([{ curso: '3ESO', letra: 'B' }], l, '2026-27')[0].destino).toBeNull();
  });
});

describe('emparejarClases · fijadas a mano', () => {
  const clase = { curso: '2ESO', letra: 'A' };
  const lista = [c('10', 'Algo raro de la tutora'), c('11', 'Tutoría 2ESOA')];
  it('lo fijado manda sobre el nombre', () => {
    const r = emparejarClases([clase], lista, '2026-27', new Map([[claveClase(clase), '10']]));
    expect(r[0].destino?.id).toBe('10');
    expect(r[0].origen).toBe('manual');
  });
  it('si lo fijado ya no está entre las de la cuenta, lo dice y no deduce otra', () => {
    const r = emparejarClases([clase], lista, '2026-27', new Map([[claveClase(clase), '99']]));
    expect(r[0].destino).toBeNull();
    expect(r[0].motivo).toBe('fijada-sin-acceso');
  });
  it('sin fijar, deduce por el nombre', () => {
    const r = emparejarClases([clase], lista, '2026-27');
    expect(r[0].destino?.id).toBe('11');
    expect(r[0].origen).toBe('auto');
  });
  it('la clave distingue letra y sin letra', () => {
    expect(claveClase({ curso: '1ESO', letra: null })).not.toBe(claveClase({ curso: '1ESO', letra: 'A' }));
  });
});

describe('courseIdDeEnlace', () => {
  const id = '741234567890';
  const b64 = Buffer.from(id).toString('base64').replace(/=+$/, '');
  it('saca el id del enlace de la clase', () => {
    expect(courseIdDeEnlace(`https://classroom.google.com/c/${b64}`)).toBe(id);
    expect(courseIdDeEnlace(`https://classroom.google.com/u/1/c/${b64}?cjc=abc123`)).toBe(id);
    expect(courseIdDeEnlace(`  https://classroom.google.com/c/${b64}  `)).toBe(id);
  });
  it('vale también el id numérico', () => {
    expect(courseIdDeEnlace(id)).toBe(id);
  });
  it('lo que no es de una clase, null', () => {
    expect(courseIdDeEnlace('https://example.com/c/abc')).toBeNull();
    expect(courseIdDeEnlace('hola')).toBeNull();
    expect(courseIdDeEnlace('')).toBeNull();
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
