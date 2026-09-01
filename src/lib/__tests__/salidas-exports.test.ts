import { describe, expect, it } from 'vitest';
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
    expect(cuboDe(alumno({ estado: 'no_va', justificanteEstado: 'validado' }))).toBe('no_van');
  });

  it('separa validado de subido/rechazado', () => {
    expect(cuboDe(alumno({ justificanteEstado: 'validado' }))).toBe('validados');
    expect(cuboDe(alumno({ justificanteEstado: 'subido' }))).toBe('entregados');
    expect(cuboDe(alumno({ justificanteEstado: 'rechazado' }))).toBe('entregados');
  });

  it('sin justificante es pendiente, aunque esté apuntado', () => {
    expect(cuboDe(alumno({ estado: 'apuntado' }))).toBe('pendientes');
  });
});

describe('estadoLabel', () => {
  it('en pago en mano, validado se lee pagado', () => {
    expect(estadoLabel('validados', 'mano')).toBe('Pagado');
    expect(estadoLabel('validados', 'transferencia')).toBe('Validado');
  });
});

describe('filasSeguimiento', () => {
  it('saca una fila por alumno con su estado resuelto', () => {
    const filas = filasSeguimiento(
      [
        alumno({ justificanteEstado: 'validado', emailContacto: 'a@b.com' }),
        alumno({ nombre: 'Sin Casar, Luis', manual: true, manualIdentificador: '12345678Z' }),
      ],
      'transferencia',
    );
    expect(filas[0][2]).toBe('Validado');
    expect(filas[0][3]).toBe('Validado');
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
