import { describe, expect, it } from 'vitest';
import { elegirPersona, elegirTablero, esTareaRapida, fechaDePalabra, interpretarTarea } from '../paleta';

// 2026-11-16 es lunes.
const HOY = '2026-11-16';

describe('tarea rápida', () => {
  it('se reconoce por la t o el + delante', () => {
    expect(esTareaRapida('t proyector')).toBe(true);
    expect(esTareaRapida('+ proyector')).toBe(true);
    expect(esTareaRapida('tableros')).toBe(false);
    expect(esTareaRapida('t ')).toBe(false);
  });

  it('saca responsable, fecha, prioridad, tablero y título', () => {
    expect(interpretarTarea('t proyector 3ºB @amparo viernes !alta #mant', HOY)).toEqual({
      titulo: 'Proyector 3ºB',
      menciones: ['amparo'],
      tablero: 'mant',
      prioridad: 'alta',
      vence: '2026-11-20',
    });
  });

  it('!! y !!! son prioridades; sin nada, todo null', () => {
    expect(interpretarTarea('t a !!', HOY).prioridad).toBe('alta');
    expect(interpretarTarea('t a !!!', HOY).prioridad).toBe('urgente');
    expect(interpretarTarea('t comprar cable', HOY)).toEqual({ titulo: 'Comprar cable', menciones: [], tablero: null, prioridad: null, vence: null });
  });

  it('solo la primera fecha cuenta; las demás son título', () => {
    expect(interpretarTarea('t reunión lunes hoy', HOY)).toMatchObject({ titulo: 'Reunión hoy', vence: '2026-11-23' });
  });
});

describe('fechas', () => {
  it('hoy, mañana y los días de la semana (el próximo)', () => {
    expect(fechaDePalabra('hoy', HOY)).toBe(HOY);
    expect(fechaDePalabra('mañana', HOY)).toBe('2026-11-17');
    expect(fechaDePalabra('lunes', HOY)).toBe('2026-11-23');
    expect(fechaDePalabra('Miércoles', HOY)).toBe('2026-11-18');
    expect(fechaDePalabra('proyector', HOY)).toBeNull();
  });
  it('dd/mm, del año que viene si ya ha pasado', () => {
    expect(fechaDePalabra('15/12', HOY)).toBe('2026-12-15');
    expect(fechaDePalabra('15/1', HOY)).toBe('2027-01-15');
    expect(fechaDePalabra('3/2/27', HOY)).toBe('2027-02-03');
    expect(fechaDePalabra('40/2', HOY)).toBeNull();
  });
});

describe('a dónde va', () => {
  const tableros = [{ nombre: 'Desarrollo interno' }, { nombre: 'Mantenimiento de aulas' }];
  it('el tablero por el principio del nombre; sin pista, el primero', () => {
    expect(elegirTablero(tableros, 'mant')?.nombre).toBe('Mantenimiento de aulas');
    expect(elegirTablero(tableros, 'aulas')?.nombre).toBe('Mantenimiento de aulas');
    expect(elegirTablero(tableros, null)?.nombre).toBe('Desarrollo interno');
    expect(elegirTablero(tableros, 'zzz')).toBeNull();
  });
  it('la persona por nombre o correo, y solo si no hay dudas', () => {
    const m = [
      { email: 'amparo@x.com', nombre: 'Amparo Gil' },
      { email: 'ana@x.com', nombre: 'Ana Ruiz' },
    ];
    expect(elegirPersona(m, 'amp')?.email).toBe('amparo@x.com');
    expect(elegirPersona(m, 'ruiz')?.email).toBe('ana@x.com');
    expect(elegirPersona(m, 'a')).toBeNull();
  });
});
