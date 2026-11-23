import { describe, expect, it } from 'vitest';
import { conDesde, type Remitente } from '@/lib/email';

const base: Remitente = { nombre: 'Sustituciones · Colegio', email: 'jeinfyprim@consolacionburriana.com', buzon: 'jeinfyprim@consolacionburriana.com', transporte: 'gmail' };

describe('remitente por etapa (Sustituciones: la ESO sale de jesecundaria@)', () => {
  it('cambia el buzón y el From si es del dominio', () => {
    expect(conDesde(base, 'jesecundaria@consolacionburriana.com')).toMatchObject({ email: 'jesecundaria@consolacionburriana.com', buzon: 'jesecundaria@consolacionburriana.com', nombre: base.nombre });
  });
  it('fuera del dominio, o sin nada, se queda como estaba', () => {
    expect(conDesde(base, 'alguien@gmail.com')).toEqual(base);
    expect(conDesde(base, undefined)).toEqual(base);
  });
});
