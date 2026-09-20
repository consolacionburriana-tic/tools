import { describe, expect, it } from 'vitest';
import { accesoLicencias, accesoSalidas, accesosPortada } from '@/lib/portada';

const AHORA = new Date('2026-09-01T10:00:00');

const campaña = (over: Partial<{ status: string; orderDeadline: string | null }> = {}) => ({
  status: 'open',
  orderDeadline: '2026-09-12',
  ...over,
});

const salida = { nombre: 'Convivencia', fecha: '2026-09-18' };

describe('accesoLicencias', () => {
  it('lleva al formulario, con su segunda entrada para consultar el pedido', () => {
    const acceso = accesoLicencias(campaña(), AHORA);
    expect(acceso?.href).toBe('/licencias');
    expect(acceso?.secundario?.href).toBe('/licencias');
  });

  it('no sale si la campaña está cerrada, si el plazo venció o si no hay campaña', () => {
    expect(accesoLicencias(campaña({ status: 'closed' }), AHORA)).toBeNull();
    expect(accesoLicencias(campaña({ orderDeadline: '2026-08-30' }), AHORA)).toBeNull();
    expect(accesoLicencias(null, AHORA)).toBeNull();
  });

  it('sin fecha límite sigue valiendo mientras la campaña esté abierta', () => {
    expect(accesoLicencias(campaña({ orderDeadline: null }), AHORA)?.href).toBe('/licencias');
  });
});

describe('accesoSalidas', () => {
  it('sale en cuanto hay una salida abierta, sin contar ni nombrar ninguna', () => {
    const acceso = accesoSalidas([salida, salida, salida]);
    expect(acceso?.href).toBe('/salidas');
    expect(acceso?.titulo).toBe('Subir el justificante de una salida');
  });

  it('no sale si no hay ninguna abierta', () => {
    expect(accesoSalidas([])).toBeNull();
  });
});

describe('accesosPortada', () => {
  it('con campaña y salidas, Licencias va primero', () => {
    const accesos = accesosPortada({ campaign: campaña(), salidas: [salida] }, AHORA);
    expect(accesos.map((a) => a.modulo)).toEqual(['licencias', 'salidas']);
  });

  it('deja solo lo que está activo', () => {
    const accesos = accesosPortada({ campaign: campaña({ status: 'closed' }), salidas: [salida] }, AHORA);
    expect(accesos.map((a) => a.modulo)).toEqual(['salidas']);
  });

  it('sin nada abierto devuelve la lista vacía (la portada enseña su estado vacío)', () => {
    expect(accesosPortada({ campaign: null, salidas: [] }, AHORA)).toEqual([]);
  });
});
