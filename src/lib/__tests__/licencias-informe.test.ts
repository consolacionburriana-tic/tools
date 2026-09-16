import { describe, expect, it } from 'vitest';

import { claveLibro, indexarLibros } from '@/lib/licencias-exports';

// El caso real que rompió el informe de editoriales: `3ESO-REL` existe en 3ESO y en 3PDC.
// Indexando por `cod` a secas, los dos cursos se fusionaban en una fila (57 licencias con el
// curso del último que entrara en el mapa) en vez de 46 de 3ESO y 11 de 3PDC.
const LIBROS = [
  { cod: '3ESO-REL', curso: '3ESO', editorial: 'Edebé' },
  { cod: '3ESO-REL', curso: '3PDC', editorial: 'Edebé' },
  { cod: '3ESO-LEN', curso: '3ESO', editorial: 'Anaya' },
];

describe('claveLibro', () => {
  it('distingue el mismo código en cursos distintos', () => {
    expect(claveLibro('3ESO', '3ESO-REL')).not.toBe(claveLibro('3PDC', '3ESO-REL'));
  });

  it('trata null y undefined como el mismo curso vacío', () => {
    expect(claveLibro(null, 'X')).toBe(claveLibro(undefined, 'X'));
  });
});

describe('indexarLibros', () => {
  it('devuelve el libro del curso que se le pide', () => {
    const at = indexarLibros(LIBROS);
    expect(at('3ESO', '3ESO-REL')?.curso).toBe('3ESO');
    expect(at('3PDC', '3ESO-REL')?.curso).toBe('3PDC');
  });

  it('cae al código suelto cuando el curso no cuadra (pedidos sin curso)', () => {
    const at = indexarLibros(LIBROS);
    expect(at(null, '3ESO-LEN')?.curso).toBe('3ESO');
    expect(at('4ESO', '3ESO-REL')?.cod).toBe('3ESO-REL');
  });

  it('al caer al código suelto se queda con el primero, de forma estable', () => {
    expect(indexarLibros(LIBROS)(null, '3ESO-REL')?.curso).toBe('3ESO');
  });

  it('devuelve undefined si el código no existe', () => {
    expect(indexarLibros(LIBROS)('3ESO', 'NO-EXISTE')).toBeUndefined();
  });

  it('agrupar por clave separa los cursos en vez de sumarlos', () => {
    const censo = [
      ...Array(46).fill({ cod: '3ESO-REL', curso: '3ESO' }),
      ...Array(11).fill({ cod: '3ESO-REL', curso: '3PDC' }),
    ];
    const conteo = new Map<string, number>();
    for (const b of censo) conteo.set(claveLibro(b.curso, b.cod), (conteo.get(claveLibro(b.curso, b.cod)) ?? 0) + 1);
    expect([...conteo.values()].sort((a, b) => b - a)).toEqual([46, 11]);
  });
});
