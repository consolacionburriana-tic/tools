import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => ({ db: {} }));
vi.mock('@/auth', () => ({ auth: async () => null }));

import { canAccess, modulosDe, veProteccionDatosCompleta } from '@/lib/permissions';
import { cursoEnAlcance } from '@/lib/bancolibros-alcance';

describe('alcance por etapa (28-sep-2026)', () => {
  it('el profe entra en Alumnado', () => {
    expect(canAccess({ role: 'profe' }, 'alumnado')).toBe(true);
  });

  it('comunicación ve la protección de datos de todo el centro, como rol o como extra de un tutor', () => {
    expect(veProteccionDatosCompleta({ role: 'comunicacion' })).toBe(true);
    expect(veProteccionDatosCompleta({ role: 'tutor', modulosExtra: ['comunicacion'] })).toBe(true);
    expect(veProteccionDatosCompleta({ role: 'tutor' })).toBe(false);
    expect(modulosDe({ role: 'comunicacion' })).toContain('alumnado');
  });

  it('banco de libros: solo cursos de sus etapas', () => {
    expect(cursoEnAlcance(null, '1ESO')).toBe(true);
    expect(cursoEnAlcance(['EP', 'ESO'], '1ESO')).toBe(true);
    expect(cursoEnAlcance(['EP'], '1ESO')).toBe(false);
    expect(cursoEnAlcance([], '4PRI')).toBe(false);
  });
});
