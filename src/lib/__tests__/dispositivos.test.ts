import { describe, expect, it } from 'vitest';
import {
  altaAparatosSchema,
  categoriaSchema,
  categoriasVisibles,
  claveDeNombre,
  compararCodigos,
  cuotaDe,
  cursosDeCompra,
  esCursoEscolar,
  estadoAlumnoSchema,
  etiquetaModelo,
  noSeLoLlevaACasa,
  numeroDeCodigo,
  parsearSeries,
  profeLeToca,
  resumenCuotas,
  seguroDe,
  siguientesCodigos,
  sugerirPrefijo,
  textoEstado,
  USO_PROFESORADO,
  USO_SUSTITUCION,
  USOS_FIJOS,
  type CategoriaDis,
} from '@/lib/dispositivos';

const CURSO = '2026-27';

describe('cursos escolares', () => {
  it('reconoce un curso bien escrito y seguido', () => {
    expect(esCursoEscolar('2022-23')).toBe(true);
    expect(esCursoEscolar('2099-00')).toBe(true);
    expect(esCursoEscolar('2022-24')).toBe(false);
    expect(esCursoEscolar('22-23')).toBe(false);
    expect(esCursoEscolar('2022')).toBe(false);
    expect(esCursoEscolar(null)).toBe(false);
  });

  it('ofrece el curso actual y los anteriores, del más nuevo al más viejo', () => {
    expect(cursosDeCompra(CURSO, 3)).toEqual(['2026-27', '2025-26', '2024-25', '2023-24']);
  });
});

describe('el seguro cubre 4 cursos escolares, el de compra incluido', () => {
  it('comprado en 2022-23: cubre hasta 2025-26 y en 2026-27 ha vencido', () => {
    expect(seguroDe('2022-23', '2025-26')).toEqual({ estado: 'ultimo', hasta: '2025-26' });
    expect(seguroDe('2022-23', CURSO)).toEqual({ estado: 'vencido', hasta: '2025-26' });
  });

  it('comprado este curso o hace poco: vigente', () => {
    expect(seguroDe('2026-27', CURSO).estado).toBe('vigente');
    expect(seguroDe('2024-25', CURSO).estado).toBe('vigente');
    expect(seguroDe('2023-24', CURSO).estado).toBe('ultimo');
  });

  it('sin curso de compra no se sabe', () => {
    expect(seguroDe(null, CURSO)).toEqual({ estado: 'sin_dato', hasta: null });
    expect(seguroDe('basura', CURSO).estado).toBe('sin_dato');
  });
});

describe('qué paga cada uno (Jose Miguel, 13-oct-2026)', () => {
  it('de casa: 10 € al mes', () => {
    expect(cuotaDe({ modalidad: 'casa', cursoCompra: null, aCasa: null }, CURSO)).toMatchObject({ concepto: 'mensual', importe: 10 });
  });

  it('prestado: 10 € al mes si se lo lleva a casa, nada si se queda en el cole', () => {
    expect(cuotaDe({ modalidad: 'prestado', cursoCompra: null, aCasa: true }, CURSO)).toMatchObject({ concepto: 'mensual', importe: 10 });
    expect(cuotaDe({ modalidad: 'prestado', cursoCompra: null, aCasa: false }, CURSO)).toMatchObject({ concepto: null, importe: 0 });
    // Sin decidir = no ha firmado: se queda en el cole.
    expect(cuotaDe({ modalidad: 'prestado', cursoCompra: null, aCasa: null }, CURSO).concepto).toBeNull();
  });

  it('comprado: nada con seguro, 30 € al año cuando vence', () => {
    expect(cuotaDe({ modalidad: 'comprado', cursoCompra: '2024-25', aCasa: null }, CURSO)).toMatchObject({ concepto: null, importe: 0, aviso: null });
    expect(cuotaDe({ modalidad: 'comprado', cursoCompra: '2022-23', aCasa: null }, CURSO)).toMatchObject({ concepto: 'anual', importe: 30 });
  });

  it('de hermano: igual que comprado, con el curso de compra heredado', () => {
    const c = cuotaDe({ modalidad: 'hermano', cursoCompra: '2021-22', aCasa: null }, CURSO);
    expect(c).toMatchObject({ concepto: 'anual', importe: 30 });
    expect(c.motivo).toContain('De un hermano');
  });

  it('comprado sin curso de compra: aviso, y no se cobra hasta saberlo', () => {
    expect(cuotaDe({ modalidad: 'comprado', cursoCompra: null, aCasa: null }, CURSO)).toMatchObject({
      concepto: null,
      aviso: 'Falta el curso de compra',
    });
  });

  it('el resumen cuenta por concepto y aparta los avisos', () => {
    const r = resumenCuotas([
      cuotaDe({ modalidad: 'casa', cursoCompra: null, aCasa: null }, CURSO),
      cuotaDe({ modalidad: 'prestado', cursoCompra: null, aCasa: true }, CURSO),
      cuotaDe({ modalidad: 'comprado', cursoCompra: '2020-21', aCasa: null }, CURSO),
      cuotaDe({ modalidad: 'comprado', cursoCompra: '2026-27', aCasa: null }, CURSO),
      cuotaDe({ modalidad: 'comprado', cursoCompra: null, aCasa: null }, CURSO),
    ]);
    expect(r).toEqual({ mensual: { n: 2, total: 20 }, anual: { n: 1, total: 30 }, nada: 1, avisos: 1 });
  });
});

describe('lo que ven los tutores', () => {
  it('solo se destaca el prestado que se queda en el cole', () => {
    expect(noSeLoLlevaACasa({ modalidad: 'prestado', aCasa: false })).toBe(true);
    expect(noSeLoLlevaACasa({ modalidad: 'prestado', aCasa: null })).toBe(true);
    expect(noSeLoLlevaACasa({ modalidad: 'prestado', aCasa: true })).toBe(false);
    expect(noSeLoLlevaACasa({ modalidad: 'comprado', aCasa: null })).toBe(false);
    expect(noSeLoLlevaACasa(null)).toBe(false);
  });
});

describe('textos', () => {
  it('estado en una línea', () => {
    expect(textoEstado({ modalidad: 'casa', cursoCompra: null, aCasa: null }, CURSO)).toBe('De casa');
    expect(textoEstado({ modalidad: 'prestado', cursoCompra: null, aCasa: true, aparato: 'S12' }, CURSO)).toBe('Prestado S12 · a casa');
    expect(textoEstado({ modalidad: 'prestado', cursoCompra: null, aCasa: false }, CURSO)).toBe('Prestado · en el cole');
    expect(textoEstado({ modalidad: 'comprado', cursoCompra: '2022-23', aCasa: null }, CURSO)).toBe('Comprado · 2022-23 · seguro vencido');
    expect(textoEstado({ modalidad: 'hermano', cursoCompra: null, aCasa: null }, CURSO)).toBe('De hermano · sin curso de compra');
  });

  it('modelo con su capacidad', () => {
    expect(etiquetaModelo({ nombre: 'iPad (9.ª generación)', capacidadGb: 64 })).toBe('iPad (9.ª generación) · 64 GB');
    expect(etiquetaModelo({ nombre: 'iPad', capacidadGb: null })).toBe('iPad');
    expect(etiquetaModelo(null)).toBe('');
  });
});

describe('códigos de los iPads del cole', () => {
  it('cada categoría con su prefijo, y el siguiente libre tras el más alto', () => {
    expect(USOS_FIJOS).toEqual([USO_SUSTITUCION, USO_PROFESORADO]);
    expect(siguientesCodigos('S', [])).toEqual(['S1']);
    expect(siguientesCodigos('S', ['S1', 'S7', 'P20'], 3)).toEqual(['S8', 'S9', 'S10']);
    expect(siguientesCodigos('P', ['S1', 'p4'])).toEqual(['P5']);
  });

  it('un código a mano que no sigue la serie no la rompe', () => {
    expect(numeroDeCodigo('S', 'S-ROTO')).toBeNull();
    expect(siguientesCodigos('S', ['S2', 'S-ROTO', 'SX'])).toEqual(['S3']);
  });

  it('prefijos de varias letras no se pisan con los de una: TEC no cuenta como T, AL no cuenta como A', () => {
    expect(siguientesCodigos('TEC', ['TEC1', 'TEC12', 'T3', 'TECX'], 2)).toEqual(['TEC13', 'TEC14']);
    expect(siguientesCodigos('T', ['TEC1', 'TEC12'])).toEqual(['T1']);
    expect(siguientesCodigos('AL', ['AL4', 'A9', 'ALTA2'])).toEqual(['AL5']);
    expect(numeroDeCodigo('al', 'al7')).toBe(7);
  });

  it('orden natural: S2 antes que S10', () => {
    expect(['S10', 'P3', 'S2', 'P12'].sort(compararCodigos)).toEqual(['P3', 'P12', 'S2', 'S10']);
  });

  it('pegar números de serie: uno por línea, sin vacíos ni repetidos', () => {
    expect(parsearSeries(' dmpx1234 \n\nDMPX1234\r\nF9 FJ 22\n')).toEqual(['DMPX1234', 'F9FJ22']);
  });
});

describe('a qué profes les toca iPad del cole (desde 5º EP)', () => {
  it('por sus clases o tutorías', () => {
    expect(profeLeToca(['5PRI'], [])).toBe(true);
    expect(profeLeToca(['6PRI', '3PRI'], ['EP'])).toBe(true);
    expect(profeLeToca(['3ºPPDC'], [])).toBe(true);
    expect(profeLeToca(['4PRI', '1PRI'], ['EP'])).toBe(false);
    expect(profeLeToca(['5INF'], ['EI'])).toBe(false);
  });

  it('por tener la ESO en su ficha, aunque Horarios no diga nada', () => {
    expect(profeLeToca([], ['ESO'])).toBe(true);
    expect(profeLeToca([], [])).toBe(false);
  });
});

describe('schemas', () => {
  const id = '6f1c2a3e-9d1b-4c5e-8a7f-0b2d3e4f5a61';

  it('estado de un alumno: curso de compra bien escrito o nada', () => {
    expect(estadoAlumnoSchema.safeParse({ eduStudentId: id, modalidad: 'comprado', cursoCompra: '2022-23' }).success).toBe(true);
    expect(estadoAlumnoSchema.safeParse({ eduStudentId: id, modalidad: 'comprado', cursoCompra: '2022' }).success).toBe(false);
    expect(estadoAlumnoSchema.safeParse({ eduStudentId: id, modalidad: null }).success).toBe(true);
    expect(estadoAlumnoSchema.safeParse({ eduStudentId: id, modalidad: 'alquilado' }).success).toBe(false);
  });

  it('alta de iPads: o cuántos, o los números de serie, no las dos cosas', () => {
    expect(altaAparatosSchema.safeParse({ uso: 'sustitucion', cantidad: 4 }).success).toBe(true);
    expect(altaAparatosSchema.safeParse({ uso: 'sustitucion', series: ['DMPX1'] }).success).toBe(true);
    expect(altaAparatosSchema.safeParse({ uso: 'sustitucion' }).success).toBe(false);
    expect(altaAparatosSchema.safeParse({ uso: 'sustitucion', cantidad: 2, series: ['X'] }).success).toBe(false);
  });
});

describe('categorías de iPads del cole', () => {
  const cat = (clave: string, nombre: string, orden: number, activo = true): CategoriaDis => ({
    clave,
    nombre,
    prefijo: nombre.slice(0, 2).toUpperCase(),
    titular: 'profe',
    explica: null,
    orden,
    activo,
  });

  it('sugiere el prefijo con las iniciales (las palabras de una letra no cuentan)', () => {
    expect(sugerirPrefijo('Audición y lenguaje')).toBe('AL');
    expect(sugerirPrefijo("Escola d'idiomes")).toBe('EI');
    expect(sugerirPrefijo('TEC')).toBe('TEC');
    expect(sugerirPrefijo('Pastoral')).toBe('PAS');
    expect(sugerirPrefijo('  ')).toBe('');
  });

  it('la clave sale del nombre, sin tildes ni símbolos', () => {
    expect(claveDeNombre('Audición y lenguaje')).toBe('audicion-y-lenguaje');
    expect(claveDeNombre("Escola d'idiomes (TEC)")).toBe('escola-d-idiomes-tec');
    expect(claveDeNombre('¿?')).toBe('');
  });

  it('las pestañas son las activas, en su orden', () => {
    const lista = [cat('tec', 'TEC', 3), cat('p', 'Profesorado', 2), cat('viejo', 'Viejo', 1, false), cat('s', 'Sustitución', 1)];
    expect(categoriasVisibles(lista).map((c) => c.clave)).toEqual(['s', 'p', 'tec']);
  });

  it('el schema pide un prefijo de letras (1 a 4) y lo pasa a mayúsculas', () => {
    const base = { nombre: 'Escuela de idiomas', titular: 'profe' as const };
    expect(categoriaSchema.parse({ ...base, prefijo: ' tec ' }).prefijo).toBe('TEC');
    expect(categoriaSchema.safeParse({ ...base, prefijo: 'TEC1' }).success).toBe(false);
    expect(categoriaSchema.safeParse({ ...base, prefijo: 'TECNO' }).success).toBe(false);
    expect(categoriaSchema.safeParse({ ...base, prefijo: '' }).success).toBe(false);
    expect(categoriaSchema.safeParse({ ...base, prefijo: 'TEC', titular: 'otro' }).success).toBe(false);
    expect(categoriaSchema.safeParse({ nombre: 'X', prefijo: 'X', titular: 'nadie' }).success).toBe(false);
  });

  it('el alta de iPads acepta la clave de cualquier categoría', () => {
    const uso = 'audicion-y-lenguaje';
    expect(altaAparatosSchema.safeParse({ uso, cantidad: 3 }).success).toBe(true);
    expect(altaAparatosSchema.safeParse({ uso: '', cantidad: 3 }).success).toBe(false);
  });
});
