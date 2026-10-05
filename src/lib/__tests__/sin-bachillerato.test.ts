// Consolación NO tiene Bachillerato: `CONFIGURACION.etapasActivas` lo deja apagado y no debe salir
// en ningún sitio. Estos tests fijan eso con la configuración REAL (sin mocks); el comportamiento
// de la etapa encendida, para quien la active, está en `etapas-bachillerato.test.ts`.
import { describe, expect, it } from 'vitest';
import { CONFIGURACION } from '@/lib/configuracion';
import { ampliarEtapasConjuntas, cursoEnBanco, cursoSiguiente, esEtapa, ETAPAS, etapaDeCurso, parseBachillerato } from '@/lib/cursos';
import { parseClase, parseEducamosFile } from '@/lib/educamos';
import { ETAPAS_HORARIO } from '@/lib/horarios';
import { agruparProfes, claseTutorAKey } from '@/lib/profes';
import { STAGE_LABELS, STAGES } from '@/lib/constants';
import { ETAPAS_ORA } from '@/lib/oratorios';
import { ETAPAS_ORDEN } from '@/lib/numeros';

describe('un colegio sin Bachillerato', () => {
  it('solo hay tres etapas, y ninguna es Bachillerato', () => {
    expect(CONFIGURACION.etapasActivas).toEqual(['EI', 'EP', 'ESO']);
    expect(ETAPAS).toEqual(['EI', 'EP', 'ESO']);
    expect(ETAPAS_ORA).toEqual(['EI', 'EP', 'ESO']);
    expect(ETAPAS_ORDEN).toEqual(['EI', 'EP', 'ESO']);
    expect(esEtapa('BACH')).toBe(false);
  });

  it('ningún código de curso se lee como Bachillerato', () => {
    for (const c of ['1BACH', '2BACHA', '1BAT', '1BTO', '1º Bachillerato', '1BAC']) {
      expect(etapaDeCurso(c), c).toBeNull();
      expect(cursoEnBanco(c), c).toBe(false);
      expect(cursoSiguiente(c), c).toBeNull();
    }
    expect(parseBachillerato('1BACH')).toBeNull();
    expect(claseTutorAKey('1BACHA')).toBeNull();
  });

  it('el resto de etapas no cambia', () => {
    expect(etapaDeCurso('4INF')).toBe('EI');
    expect(etapaDeCurso('6PRI')).toBe('EP');
    expect(etapaDeCurso('4ESO')).toBe('ESO');
    expect(etapaDeCurso('3ºPPDC')).toBe('ESO');
    expect(cursoSiguiente('3ESO')).toBe('4ESO');
    expect(cursoSiguiente('4ESO')).toBeNull();
  });

  it('ESO va sola: no arrastra a ninguna otra etapa', () => {
    expect(ampliarEtapasConjuntas(['ESO'])).toEqual(['ESO']);
  });

  it('el profesorado se agrupa sin grupo de Bachillerato', () => {
    const profe = (id: string, etapa: string | null) => ({ id, nombre: id, etapa, esTutor: false, claseTutor: null });
    const grupos = agruparProfes([profe('a', 'EI'), profe('b', 'EP'), profe('c', 'ESO'), profe('d', null), profe('e', 'BACH')]);
    expect(grupos.map((g) => g.clave)).toEqual(['EI', 'EP', 'ESO', 'General']);
    // Una ficha antigua con etapa `BACH` no desaparece: va a «General».
    expect(grupos.find((g) => g.clave === 'General')?.items.map((p) => p.id)).toEqual(['d', 'e']);
    expect(STAGES.map((s) => s.value)).not.toContain('BACH');
    expect(Object.keys(STAGE_LABELS)).not.toContain('BACH');
  });

  it('Horarios tiene Bachillerato desactivado', () => {
    expect(ETAPAS_HORARIO.find((e) => e.codigo === 'BACH')?.active).toBe(false);
  });

  it('el import de Educamos deja fuera a su alumnado y lo avisa sin nombrar Bachillerato', () => {
    expect(etapaDeCurso(parseClase('1BACHA').curso)).toBeNull();
    const csv = [
      'NIA;NOMBRE;APELLIDO 1;APELLIDO 2;CLASE',
      '1;Ana;Prueba;Uno;1BACHA',
      '2;Bea;Prueba;Dos;2ESOB',
    ].join('\n');
    const r = parseEducamosFile(new TextEncoder().encode(csv).buffer as ArrayBuffer, 'alumnos.csv');
    expect(r.rows).toHaveLength(1);
    const aviso = r.warnings.find((w) => w.includes('no es de ninguna etapa del colegio'));
    expect(aviso).toBeDefined();
    expect(aviso).toContain('Infantil, Primaria o ESO');
    expect(aviso).not.toMatch(/bachillerato/i);
  });
});
