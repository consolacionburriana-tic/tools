import { describe, expect, it } from 'vitest';
import {
  baseCod,
  campaignAbierta,
  cursoEfectivo,
  esTemporadaLicencias,
  normalize,
  plazoVencido,
  resolveBilingual,
} from '@/lib/licencias';

describe('cursoEfectivo', () => {
  it('un alumno PDC usa siempre su curso PDC, ignore el seleccionado', () => {
    expect(cursoEfectivo('3ESO', 'PDC')).toBe('3PDC');
    expect(cursoEfectivo('4ESO', 'PDC', '3ESO')).toBe('4PDC');
  });

  it('un alumno no-PDC usa el curso seleccionado si lo hay', () => {
    expect(cursoEfectivo('3ESO', 'A', '4ESO')).toBe('4ESO');
  });

  it('sin selección, usa el curso base del alumno', () => {
    expect(cursoEfectivo('1PRI', null)).toBe('1PRI');
  });
});

describe('resolveBilingual', () => {
  const par = [{ cod: 'MAT3-CAS' }, { cod: 'MAT3-VAL' }];

  it('con lengua valenciana, resuelve al libro -VAL', () => {
    expect(resolveBilingual(par, 'Valencià')).toEqual([{ cod: 'MAT3-VAL' }]);
  });

  it('con lengua castellana, resuelve al libro -CAS', () => {
    expect(resolveBilingual(par, 'Castellano')).toEqual([{ cod: 'MAT3-CAS' }]);
  });

  it('sin lengua (null), por defecto resuelve a -CAS', () => {
    expect(resolveBilingual(par, null)).toEqual([{ cod: 'MAT3-CAS' }]);
  });

  it('si solo existe un lado del par, se mantiene tal cual', () => {
    expect(resolveBilingual([{ cod: 'FIS3-CAS' }], 'Valencià')).toEqual([{ cod: 'FIS3-CAS' }]);
  });

  it('un libro sin sufijo de idioma no se toca', () => {
    expect(resolveBilingual([{ cod: 'REL3' }], 'Valencià')).toEqual([{ cod: 'REL3' }]);
  });
});

describe('baseCod', () => {
  it('quita el sufijo de idioma', () => {
    expect(baseCod('MAT3-CAS')).toBe('MAT3');
    expect(baseCod('MAT3-VAL')).toBe('MAT3');
  });

  it('deja intacto un código sin sufijo', () => {
    expect(baseCod('MAT3')).toBe('MAT3');
  });
});

describe('plazoVencido', () => {
  it('sin fecha límite, nunca vence', () => {
    expect(plazoVencido(null)).toBe(false);
  });

  it('antes de las 23:59:59 del día fijado, no ha vencido', () => {
    expect(plazoVencido('2026-09-12', new Date('2026-09-12T23:59:00'))).toBe(false);
  });

  it('pasadas las 23:59:59 del día fijado, ha vencido', () => {
    expect(plazoVencido('2026-09-12', new Date('2026-09-13T00:00:01'))).toBe(true);
  });
});

describe('campaignAbierta', () => {
  it('abierta si el status es open y no hay fecha límite', () => {
    expect(campaignAbierta({ status: 'open', orderDeadline: null })).toBe(true);
  });

  it('cerrada si el status no es open, aunque el plazo no haya vencido', () => {
    expect(campaignAbierta({ status: 'closed', orderDeadline: null })).toBe(false);
    expect(campaignAbierta({ status: 'draft', orderDeadline: '2099-01-01' })).toBe(false);
  });

  it('cerrada automáticamente si el status es open pero el plazo ya venció', () => {
    expect(
      campaignAbierta({ status: 'open', orderDeadline: '2026-09-12' }, new Date('2026-09-13T00:00:01')),
    ).toBe(false);
  });

  it('abierta si el status es open y el plazo todavía no ha vencido', () => {
    expect(
      campaignAbierta({ status: 'open', orderDeadline: '2026-09-12' }, new Date('2026-09-12T10:00:00')),
    ).toBe(true);
  });
});

describe('normalize', () => {
  it('quita acentos, pasa a minúsculas y colapsa espacios', () => {
    expect(normalize('  Válencia  ')).toBe('valencia');
  });

  it('con cadena vacía o nula no falla', () => {
    expect(normalize('')).toBe('');
  });
});

describe('temporada fuerte de licencias (orden del escritorio)', () => {
  it('junio y septiembre son temporada', () => {
    expect(esTemporadaLicencias(new Date('2026-06-15T10:00:00'))).toBe(true);
    expect(esTemporadaLicencias(new Date('2026-09-03T10:00:00'))).toBe(true);
  });

  it('el resto del año, no', () => {
    for (const mes of ['01', '02', '03', '04', '05', '07', '08', '10', '11', '12']) {
      expect(esTemporadaLicencias(new Date(`2026-${mes}-15T10:00:00`))).toBe(false);
    }
  });
});
