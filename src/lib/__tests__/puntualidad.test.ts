import { describe, expect, it } from 'vitest';
import {
  cierraCiclo,
  cursoEnPuntualidad,
  formatoRetraso,
  fraseHistorial,
  horaDeMinutos,
  indiceDiaSemana,
  minutosDeHora,
  minutosRetraso,
  resumenHistorial,
  semanaISO,
  type RetrasoHistorial,
} from '@/lib/puntualidad';

describe('horas y minutos de retraso', () => {
  it('cuenta los minutos desde la hora límite', () => {
    expect(minutosRetraso('08:17')).toBe(12);
    expect(minutosRetraso('08:05')).toBe(0);
    expect(minutosRetraso('09:30')).toBe(85);
  });

  it('no da retrasos negativos si llega antes del límite', () => {
    expect(minutosRetraso('07:58')).toBe(0);
  });

  it('respeta una hora límite distinta de la del centro', () => {
    expect(minutosRetraso('10:20', '10:00')).toBe(20);
  });

  it('con una hora inválida no explota: retraso 0', () => {
    expect(minutosRetraso('ocho y cinco')).toBe(0);
    expect(minutosDeHora('25:00')).toBeNull();
    expect(minutosDeHora('08:75')).toBeNull();
    expect(minutosDeHora('8:07')).toBe(487);
  });

  it('formatea el retraso para pantalla', () => {
    expect(formatoRetraso(0)).toBe('a tiempo');
    expect(formatoRetraso(12)).toBe('12 min');
    expect(formatoRetraso(60)).toBe('1 h');
    expect(formatoRetraso(75)).toBe('1 h 15 min');
  });

  it('horaDeMinutos es la inversa de minutosDeHora', () => {
    expect(horaDeMinutos(487)).toBe('08:07');
    expect(horaDeMinutos(0)).toBe('00:00');
  });
});

describe('alcance del módulo', () => {
  it('solo entra secundaria (ESO y PDC)', () => {
    expect(cursoEnPuntualidad('2ESO')).toBe(true);
    expect(cursoEnPuntualidad('3ºPPDC')).toBe(true);
    expect(cursoEnPuntualidad('5PRI')).toBe(false);
    expect(cursoEnPuntualidad('4INF')).toBe(false);
    expect(cursoEnPuntualidad(null)).toBe(false);
  });
});

const r = (fecha: string, justificado = false, consumido = false): RetrasoHistorial => ({
  fecha,
  justificado,
  consumido,
});

describe('resumen del historial de un alumno', () => {
  it('el primero del curso se nota', () => {
    const res = resumenHistorial([], '2026-09-15');
    expect(res.total).toBe(0);
    expect(res.tono).toBe('primero');
    expect(res.faltanParaConsecuencia).toBe(2);
  });

  it('cuenta el mes natural y los últimos 7 días', () => {
    const res = resumenHistorial(
      [r('2026-09-14'), r('2026-09-10'), r('2026-08-20'), r('2026-09-01')],
      '2026-09-15',
    );
    expect(res.total).toBe(4);
    expect(res.esteMes).toBe(3);
    expect(res.ultimos7).toBe(2);
    expect(res.ultimaFecha).toBe('2026-09-14');
    expect(res.diasDesdeUltimo).toBe(1);
  });

  it('si el último fue hace meses, el tono es lejano', () => {
    const res = resumenHistorial([r('2026-04-12')], '2026-09-15');
    expect(res.esteMes).toBe(0);
    expect(res.tono).toBe('lejano');
    expect(res.diasDesdeUltimo).toBe(156);
  });

  it('avisa cuando el registro que se está guardando cierra el ciclo de tres', () => {
    const res = resumenHistorial([r('2026-09-10'), r('2026-09-12')], '2026-09-15');
    expect(res.enCiclo).toBe(2);
    expect(res.faltanParaConsecuencia).toBe(0);
    expect(res.tono).toBe('alerta');
  });

  it('los justificados suman al total pero no al ciclo', () => {
    const res = resumenHistorial([r('2026-09-10', true), r('2026-09-12', true)], '2026-09-15');
    expect(res.total).toBe(2);
    expect(res.justificados).toBe(2);
    expect(res.enCiclo).toBe(0);
    expect(res.faltanParaConsecuencia).toBe(2);
  });

  it('los que ya motivaron una consecuencia no cuentan para el ciclo siguiente', () => {
    const previos = [r('2026-09-01', false, true), r('2026-09-03', false, true), r('2026-09-05', false, true)];
    const res = resumenHistorial([...previos, r('2026-09-10')], '2026-09-15');
    expect(res.total).toBe(4);
    expect(res.noJustificados).toBe(4);
    expect(res.enCiclo).toBe(1);
    expect(res.faltanParaConsecuencia).toBe(1);
  });
});

describe('frase del historial', () => {
  const fmt = (iso: string) => iso.split('-').reverse().join('/');

  it('lo dice todo en una línea', () => {
    expect(fraseHistorial(resumenHistorial([], '2026-09-15'), fmt)).toBe('Primer retraso del curso.');
    expect(fraseHistorial(resumenHistorial([r('2026-09-14'), r('2026-09-10')], '2026-09-15'), fmt)).toBe(
      '3º retraso del curso · 2 este mes · 2 en los últimos 7 días.',
    );
    expect(fraseHistorial(resumenHistorial([r('2026-04-12')], '2026-09-15'), fmt)).toBe(
      '2º retraso del curso · ninguno este mes; el último fue el 12/04/2026.',
    );
  });
});

describe('cierre de ciclo', () => {
  it('cierra en el tercero no justificado', () => {
    expect(cierraCiclo(0, false)).toBe(false);
    expect(cierraCiclo(1, false)).toBe(false);
    expect(cierraCiclo(2, false)).toBe(true);
  });

  it('un justificado nunca cierra ciclo', () => {
    expect(cierraCiclo(2, true)).toBe(false);
  });
});

describe('semana ISO y días', () => {
  it('identifica la semana del resumen', () => {
    expect(semanaISO(new Date('2026-01-01T10:00:00'))).toBe('2026-W01');
    expect(semanaISO(new Date('2026-09-02T10:00:00'))).toBe('2026-W36');
  });

  it('el lunes es el índice 0', () => {
    expect(indiceDiaSemana('2026-08-31')).toBe(0); // lunes
    expect(indiceDiaSemana('2026-09-04')).toBe(4); // viernes
  });
});
