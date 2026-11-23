import { describe, expect, it } from 'vitest';
import { altaPorConfirmar, bajaVigente, deBajaEn, estadoBaja, fechasCobertura, PeticionBaja, seSolapan, ultimoDiaDeBaja } from '@/lib/bajas';

const ID = '11111111-1111-4111-8111-111111111111';
const OTRO = '22222222-2222-4222-8222-222222222222';

describe('bajas (docs/32, «Bajas»)', () => {
  it('está de baja desde el primer día hasta el día antes del alta real; sin alta real, sigue', () => {
    const b = { desde: '2026-11-10', altaReal: '2026-11-30' };
    expect(bajaVigente(b, '2026-11-09')).toBe(false);
    expect(bajaVigente(b, '2026-11-10')).toBe(true);
    expect(bajaVigente(b, '2026-11-29')).toBe(true);
    expect(bajaVigente(b, '2026-11-30')).toBe(false); // vuelve ese día
    expect(bajaVigente({ desde: '2026-11-10', altaReal: null }, '2027-03-01')).toBe(true);
    expect(ultimoDiaDeBaja(b)).toBe('2026-11-29');
    expect(ultimoDiaDeBaja({ altaReal: null })).toBeNull();
  });

  it('el alta prevista no cierra la baja: avisa cuando pasa sin alta real', () => {
    const b = { desde: '2026-11-10', altaPrevista: '2026-11-20', altaReal: null };
    expect(bajaVigente(b, '2026-11-25')).toBe(true);
    expect(altaPorConfirmar(b, '2026-11-19')).toBe(false);
    expect(altaPorConfirmar(b, '2026-11-20')).toBe(true);
    expect(altaPorConfirmar({ ...b, altaReal: '2026-11-20' }, '2026-11-25')).toBe(false);
  });

  it('estado: próxima, en curso o terminada (una baja futura deja recibir sustituciones antes)', () => {
    expect(estadoBaja({ desde: '2026-12-01', altaReal: null }, '2026-11-23')).toBe('proxima');
    expect(estadoBaja({ desde: '2026-11-01', altaReal: null }, '2026-11-23')).toBe('en_curso');
    expect(estadoBaja({ desde: '2026-11-01', altaReal: '2026-11-23' }, '2026-11-23')).toBe('terminada');
  });

  it('de baja un día: las bajas vigentes y los titulares de una cobertura vigente sin baja anotada', () => {
    const bajas = [{ profeId: 'paula', desde: '2026-11-10', altaReal: null }, { profeId: 'joan', desde: '2026-12-01', altaReal: null }];
    const coberturas = [{ sustitutoId: 'angela', titularId: 'alejandro', desde: '2026-10-19', hasta: null, activa: true }];
    expect([...deBajaEn('2026-11-23', bajas, coberturas)].sort()).toEqual(['alejandro', 'paula']);
    // Hace tres meses nadie estaba de baja: esa sustitución cuenta normal.
    expect([...deBajaEn('2026-08-23', bajas, coberturas)]).toEqual([]);
  });

  it('la cobertura empieza con la baja o con la llegada del sustituto (lo que sea más tarde) y acaba con el alta', () => {
    const b = { desde: '2026-11-10', altaReal: null };
    expect(fechasCobertura(b, '2026-11-19')).toEqual({ desde: '2026-11-19', hasta: null });
    expect(fechasCobertura(b, '2026-11-01')).toEqual({ desde: '2026-11-10', hasta: null });
    expect(fechasCobertura({ desde: '2026-11-10', altaReal: '2026-12-01' }, null)).toEqual({ desde: '2026-11-10', hasta: '2026-11-30' });
  });

  it('dos bajas de la misma persona no se pueden pisar', () => {
    expect(seSolapan({ desde: '2026-11-01', altaReal: '2026-11-10' }, { desde: '2026-11-10', altaReal: null })).toBe(false);
    expect(seSolapan({ desde: '2026-11-01', altaReal: null }, { desde: '2027-01-10', altaReal: null })).toBe(true);
  });

  it('la petición valida fechas, motivo, nota de «Otros» y sustitutos', () => {
    const ok = { profeId: ID, desde: '2026-11-10', motivo: 'enfermedad', sustitutos: [{ id: OTRO, desde: '2026-11-19' }] };
    expect(PeticionBaja.safeParse(ok).success).toBe(true);
    expect(PeticionBaja.safeParse({ ...ok, altaReal: '2026-11-10' }).success).toBe(false);
    expect(PeticionBaja.safeParse({ ...ok, motivo: 'vacaciones' }).success).toBe(false);
    expect(PeticionBaja.safeParse({ ...ok, motivo: 'otros' }).success).toBe(false);
    expect(PeticionBaja.safeParse({ ...ok, motivo: 'otros', nota: 'Cirugía programada' }).success).toBe(true);
    expect(PeticionBaja.safeParse({ ...ok, sustitutos: [{ id: ID, desde: null }] }).success).toBe(false);
  });
});
