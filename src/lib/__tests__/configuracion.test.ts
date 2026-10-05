// `configuracion.ts` reúne parámetros que antes estaban repartidos por el código. Estos tests
// prueban que, con los valores de Consolación, todo se comporta EXACTAMENTE como antes.
import { describe, expect, it } from 'vitest';
import { CONFIGURACION } from '@/lib/configuracion';
import { BLOB_MAX_BYTES } from '@/lib/blob';
import { academicYearActual } from '@/lib/constants';
import { cursoEnBanco, cursoSiguiente, etapaDeCurso, nivelDeCurso } from '@/lib/cursos';
import { hoyEnEspana, trimestresPorDefecto } from '@/lib/oratorios';
import { HORA_LIMITE, RETRASOS_POR_CONSECUENCIA } from '@/lib/puntualidad';

// ── Copia literal de la implementación anterior (antes de mover las reglas a la configuración) ──
function siguienteAntes(curso: string | null | undefined): string | null {
  const etapa = etapaDeCurso(curso);
  if (!curso || !etapa || !/^\d/.test(curso)) return null;
  const nivel = nivelDeCurso(curso);
  let destino: number | null;
  if (etapa === 'EI') {
    if (nivel < 3 || nivel > 5) return null;
    destino = nivel === 5 ? 3 : nivel + 1;
  } else if (etapa === 'EP') {
    if (nivel < 1 || nivel > 6) return null;
    destino = nivel % 2 === 1 ? nivel + 1 : nivel - 1;
  } else if (etapa === 'ESO') {
    if (nivel < 1 || nivel > 4) return null;
    destino = nivel === 4 ? null : nivel + 1;
  } else {
    if (nivel < 1 || nivel > 2) return null;
    destino = nivel === 2 ? null : nivel + 1;
  }
  return destino === null ? null : curso.replace(/^\d+/, String(destino));
}
// (Bachillerato entra desde el 30-sep-2026: David, «Bachillerato sí tiene banco de libros».)
function bancoAntes(curso: string | null | undefined): boolean {
  const etapa = etapaDeCurso(curso);
  if (etapa === 'EI') return false;
  if (etapa === 'EP') return nivelDeCurso(curso) >= 3;
  if (etapa === 'ESO' || etapa === 'BACH') return true;
  return false;
}

const SUFIJOS = ['INF', 'PRI', 'ESO', 'BACH', 'ºPPDC', 'ºPDC', 'ESOPDC', 'PDC', 'BAT', 'FP', ''];
const CURSOS = ['', 'BACH1', ...Array.from({ length: 11 }, (_, n) => n).flatMap((n) => SUFIJOS.map((s) => `${n}${s}`))];

describe('las reglas de curso leen de la configuración sin cambiar de comportamiento', () => {
  it('cursoSiguiente: mismo resultado que antes en todos los cursos, formatos y niveles', () => {
    for (const c of CURSOS) expect(cursoSiguiente(c), c).toBe(siguienteAntes(c));
  });

  it('cursoEnBanco: mismo resultado que antes', () => {
    // Del nivel 1 en adelante: `0ESO` no es un curso (antes «todo ESO» entraba, ahora «desde el nivel 1»).
    for (const c of CURSOS.filter((x) => !x.startsWith('0'))) expect(cursoEnBanco(c), c).toBe(bancoAntes(c));
  });

  it('los valores de Consolación', () => {
    expect(CONFIGURACION.promocion).toEqual({ EI: 'rota', EP: 'parejas', ESO: 'sube', BACH: 'sube' });
    expect(CONFIGURACION.niveles).toEqual({
      EI: { min: 3, max: 5 },
      EP: { min: 1, max: 6 },
      ESO: { min: 1, max: 4 },
      BACH: { min: 1, max: 2 },
    });
    expect(CONFIGURACION.bancoLibros).toEqual({ EP: { desdeNivel: 3 }, ESO: { desdeNivel: 1 }, BACH: { desdeNivel: 1 } });
    expect(CONFIGURACION.etapasConjuntas).toEqual([['ESO', 'BACH']]);
    expect(CONFIGURACION.puntualidad.etapas).toEqual(['ESO', 'BACH']);
    // Selectores: sin Bachillerato salvo que NEXT_PUBLIC_ETAPAS_VISIBLES lo pida.
    expect(CONFIGURACION.etapasVisibles).toEqual(['EI', 'EP', 'ESO']);
  });
});

describe('el resto de parámetros, con los valores de Consolación', () => {
  it('puntualidad', () => {
    expect(HORA_LIMITE).toBe('08:05');
    expect(RETRASOS_POR_CONSECUENCIA).toBe(3);
  });

  it('el curso empieza en septiembre', () => {
    expect(academicYearActual(new Date(2026, 7, 31))).toBe('2025-26');
    expect(academicYearActual(new Date(2026, 8, 1))).toBe('2026-27');
    expect(academicYearActual(new Date(2027, 0, 15))).toBe('2026-27');
  });

  it('los trimestres de partida', () => {
    // Pascua 2027: 28 de marzo → T2 acaba el viernes antes de Ramos (19-mar), T3 empieza el martes (30-mar).
    expect(trimestresPorDefecto('2026-27', '2026-09-08')).toEqual([
      { inicio: '2026-09-08', fin: '2026-12-22' },
      { inicio: '2027-01-07', fin: '2027-03-19' },
      { inicio: '2027-03-30', fin: '2027-06-19' },
    ]);
    expect(trimestresPorDefecto('2026-27')[0].inicio).toBe('2026-09-01');
  });

  it('«hoy» se cuenta en la zona horaria del colegio, no en la del servidor (UTC)', () => {
    // 23:30 UTC del 30-sep es 01:30 del 1-oct en Madrid.
    expect(hoyEnEspana(new Date('2026-09-30T23:30:00Z'))).toBe('2026-10-01');
    expect(CONFIGURACION.calendario.zonaHoraria).toBe('Europe/Madrid');
  });

  it('sesión y archivos', () => {
    expect(CONFIGURACION.sesion).toEqual({ duracionDias: 300, refrescoRolMinutos: 15 });
    expect(BLOB_MAX_BYTES).toBe(10 * 1024 * 1024);
  });
});
