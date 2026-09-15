import { describe, expect, it } from 'vitest';
import { agruparPorNivel } from '@/lib/salidas';
import {
  type AlumnoSeguimientoExport,
  csvSeguimiento,
  cuboDe,
  estadoLabel,
  filasSeguimiento,
  nombreFicheroSalida,
} from '@/lib/salidas-exports';

const alumno = (extra: Partial<AlumnoSeguimientoExport> = {}): AlumnoSeguimientoExport => ({
  nombre: 'Pérez Gil, Ana',
  clase: '3º ESO A',
  estado: 'pendiente',
  justificanteEstado: null,
  justificanteSubidoAt: null,
  emailContacto: null,
  manual: false,
  manualIdentificador: null,
  ...extra,
});

describe('cuboDe', () => {
  it('el "no va" manda sobre el justificante', () => {
    expect(cuboDe(alumno({ estado: 'no_va', justificanteEstado: 'subido' }))).toBe('no_van');
  });

  it('no hay validación: enviado es enviado', () => {
    expect(cuboDe(alumno({ justificanteEstado: 'subido' }))).toBe('entregados');
  });

  it('sin justificante es pendiente, aunque esté apuntado', () => {
    expect(cuboDe(alumno({ estado: 'apuntado' }))).toBe('pendientes');
  });
});

describe('estadoLabel', () => {
  it('en pago en mano, entregado se lee pagado', () => {
    expect(estadoLabel('entregados', 'mano')).toBe('Pagado');
    expect(estadoLabel('entregados', 'transferencia')).toBe('Entregado');
  });
});

describe('filasSeguimiento', () => {
  it('saca una fila por alumno con su estado resuelto', () => {
    const filas = filasSeguimiento(
      [
        alumno({ justificanteEstado: 'subido', emailContacto: 'a@b.com' }),
        alumno({ nombre: 'Sin Casar, Luis', manual: true, manualIdentificador: '12345678Z' }),
      ],
      'transferencia',
    );
    expect(filas[0][2]).toBe('Entregado');
    expect(filas[0][3]).toBe('Enviado');
    expect(filas[0][5]).toBe('a@b.com');
    expect(filas[1][2]).toBe('Pendiente');
    expect(filas[1][6]).toBe('Sí');
    expect(filas[1][7]).toBe('12345678Z');
  });

  it('formatea la fecha del justificante en es-ES y deja vacío si no hay', () => {
    const [conFecha] = filasSeguimiento([alumno({ justificanteSubidoAt: '2026-09-01T10:00:00Z' })], 'mano');
    expect(conFecha[4]).toBe('1/9/2026');
    const [sinFecha] = filasSeguimiento([alumno()], 'mano');
    expect(sinFecha[4]).toBe('');
  });
});

describe('csvSeguimiento', () => {
  it('lleva BOM, cabeceras y separador ;', () => {
    const csv = csvSeguimiento([alumno()], 'transferencia');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.slice(1).split('\n')[0]).toBe(
      '"Clase";"Alumno/a";"Estado";"Justificante";"Fecha justificante";"Email de contacto";"Entrada manual";"Identificador tecleado"',
    );
    expect(csv.split('\n')).toHaveLength(2);
  });

  it('escapa las comillas dobles del contenido', () => {
    const csv = csvSeguimiento([alumno({ nombre: 'El "Rubio", Juan' })], 'transferencia');
    expect(csv).toContain('"El ""Rubio"", Juan"');
  });
});

describe('nombreFicheroSalida', () => {
  it('slugifica sin acentos y añade la fecha', () => {
    expect(nombreFicheroSalida('Excursión al Museo', new Date('2026-09-01T12:00:00Z'))).toBe(
      'salida-excursion-al-museo-2026-09-01.csv',
    );
  });

  it('aguanta un nombre que se quede sin letras', () => {
    expect(nombreFicheroSalida('¿¡!?', new Date('2026-09-01T12:00:00Z'))).toBe('salida-sin-nombre-2026-09-01.csv');
  });
});

describe('agrupar las salidas por nivel', () => {
  const salida = (nombre: string, fecha: string | null, clases: { curso: string; letra: string | null }[]) => ({
    nombre,
    fecha,
    clases,
  });

  it('ordena los grupos de menos a más nivel', () => {
    const grupos = agruparPorNivel([
      salida('Termet 4ºA', '2026-10-02', [{ curso: '4ESO', letra: 'A' }]),
      salida('Termet 1ºA', '2026-09-18', [{ curso: '1ESO', letra: 'A' }]),
      salida('Museo 2ºB', '2026-11-05', [{ curso: '2ESO', letra: 'B' }]),
    ]);
    expect(grupos.map((g: { etiqueta: string }) => g.etiqueta)).toEqual(['1º ESO', '2º ESO', '4º ESO']);
  });

  it('junta en un grupo las salidas del mismo nivel, por fecha y luego por nombre', () => {
    const grupos = agruparPorNivel([
      salida('Termet — 1ESO B', '2026-09-18', [{ curso: '1ESO', letra: 'B' }]),
      salida('Termet — 1ESO A', '2026-09-18', [{ curso: '1ESO', letra: 'A' }]),
      salida('Otra de septiembre', '2026-09-10', [{ curso: '1ESO', letra: 'A' }]),
    ]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].salidas.map((x: { nombre: string }) => x.nombre)).toEqual([
      'Otra de septiembre',
      'Termet — 1ESO A',
      'Termet — 1ESO B',
    ]);
  });

  it('una salida de varios niveles cae en el más bajo', () => {
    const grupos = agruparPorNivel([
      salida('Convivencia de toda la ESO', '2026-10-01', [
        { curso: '4ESO', letra: 'A' },
        { curso: '1ESO', letra: 'A' },
        { curso: '2ESO', letra: null },
      ]),
    ]);
    expect(grupos.map((g: { etiqueta: string }) => g.etiqueta)).toEqual(['1º ESO']);
  });

  it('respeta el orden de etapas: infantil antes que primaria y que la ESO', () => {
    const grupos = agruparPorNivel([
      salida('De la ESO', null, [{ curso: '1ESO', letra: 'A' }]),
      salida('De infantil', null, [{ curso: '5INF', letra: 'A' }]),
      salida('De primaria', null, [{ curso: '2PRI', letra: 'A' }]),
    ]);
    expect(grupos.map((g: { etiqueta: string }) => g.etiqueta)).toEqual(['5º INF', '2º PRI', '1º ESO']);
  });

  it('las salidas sin clase no se pierden: van a un grupo al final', () => {
    const grupos = agruparPorNivel([
      salida('Sin clase', null, []),
      salida('De 1º', null, [{ curso: '1ESO', letra: 'A' }]),
    ]);
    expect(grupos.map((g: { etiqueta: string }) => g.etiqueta)).toEqual(['1º ESO', 'Sin clase asignada']);
    expect(grupos[1].salidas).toHaveLength(1);
  });

  it('sin salidas, ningún grupo', () => {
    expect(agruparPorNivel([])).toEqual([]);
  });
});

describe('el empate entre un nivel y su PDC', () => {
  it('pone el nivel ordinario antes que el PDC, y no al azar', () => {
    // '3ESO' y '3ºPPDC' tienen el mismo `ordenCurso` (misma etapa, mismo nivel): sin
    // desempate salían en el orden en que llegaran de la BBDD.
    const de = (curso: string, letra: string | null) => ({ nombre: curso, fecha: null, clases: [{ curso, letra }] });
    const alReves = agruparPorNivel([de('3ºPPDC', 'PDC'), de('3ESO', 'A'), de('4ºPPDC', 'PDC'), de('4ESO', 'A')]);
    expect(alReves.map((g: { etiqueta: string }) => g.etiqueta)).toEqual(['3º ESO', '3º PDC', '4º ESO', '4º PDC']);
  });
});
