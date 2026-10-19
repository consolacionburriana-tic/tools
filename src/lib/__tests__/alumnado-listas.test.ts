import { describe, expect, it } from 'vitest';
import type { AlumnoCuaderno, ClaseCuaderno } from '@/lib/cuaderno-server';
import { libroDeListaRapida, nombreListaRapida, numerosSinCongelar } from '@/lib/alumnado-listas';
import { COLUMNAS } from '@/lib/cuaderno/lista-clase';
import type { Celda, EntradaCelda } from '@/lib/xlsx-escribir';

// Datos inventados con la forma de los reales (docs/04-convenciones-tecnicas.md).
const alumno = (id: string, extra: Partial<AlumnoCuaderno> = {}): AlumnoCuaderno => ({
  id,
  nombre: 'Lidia',
  apellido1: 'Almagro',
  apellido2: 'Prueba',
  nia: '100',
  email: `${id}@alumnos.ejemplo.com`,
  sexo: 'F',
  fechaNacimiento: '2013-01-29',
  tutorPersonalId: null,
  familiares: [],
  ...extra,
});

const clase: ClaseCuaderno = {
  curso: '2ESO',
  letra: 'B',
  etapa: 'ESO',
  clase: '2ºB',
  tutores: [],
  alumnos: [
    alumno('a', {
      nombre: 'Ana',
      familiares: [
        { nombre: 'Luis Uno', telefono: '600', correo: 'familia@ejemplo.com' },
        { nombre: 'Inés Dos', telefono: '', correo: '' },
      ],
    }),
    // Hermano gemelo: la misma dirección de la familia no sale dos veces.
    alumno('b', { nombre: 'Bruno', email: '', familiares: [{ nombre: 'Luis Uno', telefono: '600', correo: 'FAMILIA@ejemplo.com' }] }),
  ],
};

const valor = (e: EntradaCelda) => (e !== null && typeof e === 'object' && !(e instanceof Date) ? (e as Celda).valor : e);

describe('listas rápidas de Alumnado', () => {
  it('numera con lo congelado y da el siguiente libre a quien no tiene, sin escribir nada', () => {
    const n = numerosSinCongelar([{ id: 'a' }, { id: 'b' }, { id: 'c' }], new Map([['b', 7]]));
    expect([...n.entries()]).toEqual([
      ['a', 8],
      ['b', 7],
      ['c', 9],
    ]);
    expect([...numerosSinCongelar([{ id: 'a' }, { id: 'b' }], new Map()).values()]).toEqual([1, 2]);
  });

  it('la lista de clase es la del cuaderno, con sus 18 columnas', () => {
    const libro = libroDeListaRapida('lista', [clase], new Map());
    expect(libro.hojas[0].filas[0].map(valor)).toEqual(COLUMNAS.map((c) => c.titulo));
  });

  it('correos del alumnado: una fila por alumno, en el orden del nº de lista', () => {
    const numeros = new Map([['2ESO|B', new Map([['a', 2], ['b', 1]])]]);
    const hoja = libroDeListaRapida('alumnado', [clase], numeros).hojas[0];
    expect(hoja.filas[0].map(valor)).toEqual(['N', 'Alumno', 'Clase', 'Correo']);
    expect(hoja.filas.slice(1).map((f) => f.map(valor))).toEqual([
      [1, 'Bruno Almagro Prueba', '2º ESO B', null],
      [2, 'Ana Almagro Prueba', '2º ESO B', 'a@alumnos.ejemplo.com'],
    ]);
  });

  it('correos de las familias: una fila por familiar con correo, sin repetir dirección', () => {
    const hoja = libroDeListaRapida('familias', [clase], new Map()).hojas[0];
    expect(hoja.filas.slice(1).map((f) => f.map(valor))).toEqual([
      [1, 'Ana Almagro Prueba', '2º ESO B', 'Luis Uno', 'familia@ejemplo.com'],
    ]);
  });

  it('el nombre del fichero va en ASCII, que es lo que admite la cabecera', () => {
    expect(nombreListaRapida('familias', [clase], '2026-27')).toBe('correos-familias-2-eso-b-2026-2027.xlsx');
    const muchas = Array.from({ length: 5 }, () => clase);
    expect(nombreListaRapida('lista', muchas, '2026-27')).toBe('lista-5-clases-2026-2027.xlsx');
  });
});
