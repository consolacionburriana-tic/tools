// Bachillerato: se reconoce y se importa siempre, pero los selectores vacíos solo lo ofrecen si la
// variable de entorno NEXT_PUBLIC_ETAPAS_VISIBLES lo incluye (Consolación no lo tiene: por defecto no sale).
import { afterEach, describe, expect, it, vi } from 'vitest';

async function cargar(valor?: string) {
  vi.resetModules();
  if (valor === undefined) delete process.env.NEXT_PUBLIC_ETAPAS_VISIBLES;
  else process.env.NEXT_PUBLIC_ETAPAS_VISIBLES = valor;
  return import('@/lib/cursos');
}

afterEach(() => {
  delete process.env.NEXT_PUBLIC_ETAPAS_VISIBLES;
});

describe('etapas visibles en los selectores', () => {
  it('por defecto: Infantil, Primaria y ESO, sin Bachillerato', async () => {
    const c = await cargar();
    expect(c.ETAPAS_VISIBLES).toEqual(['EI', 'EP', 'ESO']);
  });

  it('la variable de entorno lo enciende, en el orden de siempre y sin importar mayúsculas ni espacios', async () => {
    const c = await cargar(' bach, eso ,ei,ep');
    expect(c.ETAPAS_VISIBLES).toEqual(['EI', 'EP', 'ESO', 'BACH']);
  });

  it('una variable vacía o con basura vuelve al valor por defecto', async () => {
    expect((await cargar('')).ETAPAS_VISIBLES).toEqual(['EI', 'EP', 'ESO']);
    expect((await cargar('FP,xx')).ETAPAS_VISIBLES).toEqual(['EI', 'EP', 'ESO']);
  });

  it('aunque no se ofrezca, Bachillerato se reconoce: si se importa, sale', async () => {
    const c = await cargar();
    expect(c.ETAPAS).toContain('BACH');
    expect(c.etapaDeCurso('1BACH')).toBe('BACH');
    expect(c.parseBachillerato('2BACHA')).toEqual({ curso: '2BACH', letra: 'A' });
  });
});
