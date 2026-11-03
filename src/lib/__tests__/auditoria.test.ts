import { describe, expect, it } from 'vitest';
import {
  codigoATexto,
  codigoAValor,
  esRestaurable,
  filasDeCambio,
  grupoDeCampo,
  valorACodigo,
  yaEstaComoAntes,
  type ChecksAlumno,
} from '../auditoria';

const ctx = { lote: 'L1', por: 'secretaria@cole.es', origen: 'usuario' as const };
const ana = { id: 'a1', nombre: 'Ana Prueba', clase: '2º ESO B' };
const checks = (parcial: Partial<ChecksAlumno> = {}): ChecksAlumno => ({
  pd_imagen: true,
  pd_redes: true,
  pd_ampa: true,
  pd_ong: true,
  pd_correo: false,
  banco: false,
  ampa: false,
  comedor: false,
  complementarias: false,
  ...parcial,
});

describe('libro de cambios · qué se anota', () => {
  it('anota solo lo que de verdad cambia', () => {
    const filas = filasDeCambio(ana, checks(), { pd_imagen: true, pd_redes: false }, ctx);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ campo: 'pd_redes', antes: 'si', despues: 'no', alumno: 'Ana Prueba', clase: '2º ESO B', lote: 'L1' });
  });

  it('marcar «sí» lo que ya era «sí» no deja ruido', () => {
    expect(filasDeCambio(ana, checks(), { pd_imagen: true, pd_redes: true, pd_ampa: true, pd_ong: true }, ctx)).toEqual([]);
  });

  it('«no consta» se guarda como null, no como «no»', () => {
    const [f] = filasDeCambio(ana, checks(), { pd_ong: null }, ctx);
    expect(f).toMatchObject({ antes: 'si', despues: null });
    expect(codigoATexto('pd_ong', null)).toBe('No consta');
  });

  it('una casilla que no viene en `despues` no se toca', () => {
    expect(filasDeCambio(ana, checks({ banco: true }), { comedor: true }, ctx).map((f) => f.campo)).toEqual(['comedor']);
  });

  it('el correo se dice al revés: «sí» es desestimar', () => {
    expect(codigoATexto('pd_correo', 'si')).toBe('Desestima');
    expect(codigoATexto('banco', 'si')).toBe('Sí');
  });
});

describe('libro de cambios · qué se puede restaurar', () => {
  const entrada = { campo: 'pd_redes', antes: 'si', despues: 'no', origen: 'usuario' };

  it('sí, mientras el valor de ahora sea el que dejó ese cambio', () => {
    expect(esRestaurable(entrada, checks({ pd_redes: false }))).toBe(true);
    expect(yaEstaComoAntes(entrada, checks({ pd_redes: false }))).toBe(false);
  });

  it('no, si alguien lo ha vuelto a tocar después', () => {
    expect(esRestaurable(entrada, checks({ pd_redes: null }))).toBe(false);
  });

  it('si ya está como antes, no hay nada que restaurar y se dice', () => {
    expect(esRestaurable(entrada, checks({ pd_redes: true }))).toBe(false);
    expect(yaEstaComoAntes(entrada, checks({ pd_redes: true }))).toBe(true);
  });

  it('lo que viene de Educamos solo se anota', () => {
    expect(esRestaurable({ ...entrada, origen: 'educamos' }, checks({ pd_redes: false }))).toBe(false);
    expect(esRestaurable({ campo: 'baja', antes: 'activo', despues: 'inactivo', origen: 'educamos' }, checks())).toBe(false);
  });

  it('un alumno que ya no existe no se restaura', () => {
    expect(esRestaurable(entrada, null)).toBe(false);
  });
});

describe('libro de cambios · códigos y grupos', () => {
  it('ida y vuelta de los valores', () => {
    for (const v of [true, false, null]) expect(codigoAValor(valorACodigo(v))).toBe(v);
  });

  it('cada casilla cae en el grupo cuyo permiso hace falta para restaurarla', () => {
    expect(grupoDeCampo('pd_imagen')).toBe('proteccion');
    expect(grupoDeCampo('pd_correo')).toBe('proteccion');
    expect(grupoDeCampo('banco')).toBe('participacion');
    expect(grupoDeCampo('ampa')).toBe('participacion');
    expect(grupoDeCampo('comedor')).toBe('servicios');
    expect(grupoDeCampo('baja')).toBe('educamos');
  });
});
