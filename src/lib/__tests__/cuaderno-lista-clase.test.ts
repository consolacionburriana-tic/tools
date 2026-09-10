import { describe, expect, it } from 'vitest';
import type { AlumnoCuaderno, ClaseCuaderno } from '@/lib/cuaderno-server';
import {
  COLUMNAS,
  colorDeClase,
  fechaNacimiento,
  filaAlumno,
  hojaDeClase,
  libroDeListas,
  nombreArchivoLista,
  nombreArchivoVarias,
  nombreLargoClase,
} from '@/lib/cuaderno/lista-clase';
import { fechaASerie } from '@/lib/xlsx-escribir';

// Datos inventados con la forma de los reales (docs/04-convenciones-tecnicas.md).
const alumna = (extra: Partial<AlumnoCuaderno> = {}): AlumnoCuaderno => ({
  id: 'a1',
  nombre: 'Lidia',
  apellido1: 'Almagro',
  apellido2: 'Buforn',
  nia: '11430523',
  email: 'lidiaalmagro@ejemplo.com',
  sexo: 'F',
  fechaNacimiento: '2013-01-29',
  tutorPersonalId: null,
  familiares: [
    { nombre: 'Luis Almagro', telefono: '600 11 22 33', correo: 'luis@ejemplo.com' },
    { nombre: 'Inés Buforn', telefono: '605 35 18 64', correo: 'ines@ejemplo.com' },
  ],
  ...extra,
});

const clase = (extra: Partial<ClaseCuaderno> = {}): ClaseCuaderno => ({
  curso: '1ESO',
  letra: 'B',
  etapa: 'ESO',
  clase: '1ºB',
  tutores: [
    {
      teacherId: 't1',
      nombre: 'María Tomás Gil',
      corto: 'María T',
      completo: 'Maria Teresa Tomas Gil',
      pila: 'María',
      apellido1: 'Tomás',
      apellido2: 'Gil',
      email: 'maria@ejemplo.com',
    },
  ],
  alumnos: [alumna()],
  ...extra,
});

describe('las columnas son las del Sheet de siempre', () => {
  it('mantiene los 18 títulos y su orden (los merges los buscan por nombre)', () => {
    expect(COLUMNAS.map((c) => c.titulo)).toEqual([
      'N',
      'Nombre',
      'Apellido 1',
      'Apellido 2',
      'Apellidos',
      'Nombre apellido',
      'Nombre apellido Lista',
      'Clase',
      'Tutor',
      'Mail',
      'NIA',
      'Nacimiento',
      'Familiar 1',
      'TLF Fam 1',
      'Mail Familiar 1',
      'Familiar 2',
      'TLF Fam 2',
      'Mail Fam 2',
    ]);
  });
});

describe('la fila de un alumno', () => {
  const fila = filaAlumno(alumna(), { numero: 1, clase: '1º ESO B', tutor: 'María', indice: 0 });

  it('tiene una celda por columna', () => {
    expect(fila).toHaveLength(COLUMNAS.length);
  });

  it('deja las derivadas como fórmula, apuntando a su propia fila', () => {
    expect(fila[4]).toMatchObject({ formula: 'CONCATENATE(C2," ",D2)' });
    expect(fila[5]).toMatchObject({ formula: 'CONCATENATE(B2," ",C2)' });
    expect(fila[6]).toMatchObject({ formula: 'CONCATENATE(A2,". ",B2," ",C2)' });
  });

  it('apunta a la fila correcta cuando el alumno no es el primero', () => {
    const decimo = filaAlumno(alumna(), { numero: 10, clase: '1º ESO B', tutor: 'María', indice: 9 });
    expect(decimo[4]).toMatchObject({ formula: 'CONCATENATE(C11," ",D11)' });
  });

  it('escribe el NIA como texto, para no perder los ceros de la izquierda', () => {
    const con0 = filaAlumno(alumna({ nia: '011430523' }), { numero: 1, clase: '1º ESO B', tutor: 'M', indice: 0 });
    expect(con0[10]).toBe('011430523');
  });

  it('pone el nacimiento como fecha de verdad, no como texto', () => {
    expect(fila[11]).toBeInstanceOf(Date);
    expect(fechaASerie(fila[11] as Date)).toBe(fechaASerie(new Date(2013, 0, 29)));
  });

  it('deja vacías las celdas del familiar 2 cuando la familia solo tiene uno', () => {
    const soloUno = filaAlumno(alumna({ familiares: [{ nombre: 'Luis', telefono: '', correo: '' }] }), {
      numero: 1,
      clase: '1º ESO B',
      tutor: 'M',
      indice: 0,
    });
    expect(soloUno.slice(15)).toEqual(['', '', '']);
  });

  it('el nº de lista va en amarillo y centrado, como en el original', () => {
    expect(fila[0]).toMatchObject({ valor: 1, estilo: { fondo: 'FFFF00', negrita: true, horizontal: 'center' } });
  });
});

describe('la hoja de una clase', () => {
  it('lleva cabecera + una fila por alumno', () => {
    const hoja = hojaDeClase(clase({ alumnos: [alumna({ id: 'a1' }), alumna({ id: 'a2', nombre: 'Lucía' })] }));
    expect(hoja.filas).toHaveLength(3);
    expect(hoja.filas[0].map((c) => (c as { valor: string }).valor)).toEqual(COLUMNAS.map((c) => c.titulo));
  });

  it('congela la cabecera y las dos primeras columnas, y filtra', () => {
    const hoja = hojaDeClase(clase());
    expect(hoja.congelar).toBe('C2');
    expect(hoja.autofiltro).toBe(true);
  });

  it('usa el nº de lista congelado cuando lo hay, y el alfabético cuando no', () => {
    const alumnos = [alumna({ id: 'a1' }), alumna({ id: 'a2' })];
    const conNumeros = hojaDeClase(clase({ alumnos }), { numeros: new Map([['a2', 31]]) });
    expect((conNumeros.filas[1][0] as { valor: number }).valor).toBe(1); // sin número: alfabético
    expect((conNumeros.filas[2][0] as { valor: number }).valor).toBe(31); // el que llegó tarde
  });

  it('escribe la clase larga en la columna «Clase» y la junta de tutores en «Tutor»', () => {
    const dos = clase({
      tutores: [
        { ...clase().tutores[0] },
        { ...clase().tutores[0], teacherId: 't2', nombre: 'Paola Gómez Ros', corto: 'Paola G' },
      ],
    });
    const hoja = hojaDeClase(dos);
    expect((hoja.filas[1][7] as { valor: string }).valor).toBe('1º ESO B');
    expect((hoja.filas[1][8] as { valor: string }).valor).toBe('María / Paola');
  });
});

describe('nombres', () => {
  it('escribe la clase como la escribe el colegio', () => {
    expect(nombreLargoClase({ curso: '1ESO', letra: 'B' })).toBe('1º ESO B');
    expect(nombreLargoClase({ curso: '3INF', letra: 'A' })).toBe('3º INF A');
    expect(nombreLargoClase({ curso: '2ESO', letra: null })).toBe('2º ESO');
  });

  it('nombra el archivo de una clase y el de varias', () => {
    expect(nombreArchivoLista({ curso: '1ESO', letra: 'B' }, ['María T'], '2026-27')).toBe(
      'Lista 1ºB — María T — 2026-2027',
    );
    expect(nombreArchivoVarias([{ curso: '1ESO', letra: 'A' }, { curso: '1ESO', letra: 'B' }], '2026-27')).toBe(
      'Listas 1ºA + 1ºB — 2026-2027',
    );
    const muchas = Array.from({ length: 9 }, (_, i) => ({ curso: '1ESO', letra: String(i) }));
    expect(nombreArchivoVarias(muchas, '2026-27')).toBe('Listas 9 clases — 2026-2027');
  });
});

describe('colores', () => {
  it('da un color distinto a cada clase y da la vuelta al agotarlos', () => {
    expect(colorDeClase(0)).not.toEqual(colorDeClase(1));
    expect(colorDeClase(0)).toEqual(colorDeClase(8));
  });
});

describe('fechaNacimiento', () => {
  it('lee la fecha ISO como día local', () => {
    const fecha = fechaNacimiento('2013-01-29')!;
    expect([fecha.getFullYear(), fecha.getMonth(), fecha.getDate()]).toEqual([2013, 0, 29]);
  });

  it('devuelve null si no hay fecha o no se entiende', () => {
    expect(fechaNacimiento(null)).toBeNull();
    expect(fechaNacimiento('no es una fecha')).toBeNull();
  });
});

describe('el libro entero', () => {
  it('saca una hoja por clase, cada una de su color', () => {
    const libro = libroDeListas([clase(), clase({ letra: 'A', clase: '1ºA' })]);
    expect(libro.hojas).toHaveLength(2);
    expect(libro.hojas[0].colorPestana).not.toBe(libro.hojas[1].colorPestana);
    expect(libro.hojas.map((h) => h.nombre)).toEqual(['1º ESO B', '1º ESO A']);
  });
});
