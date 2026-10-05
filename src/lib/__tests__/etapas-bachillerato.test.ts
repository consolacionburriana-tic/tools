// Etapas extensibles: Bachillerato y las variantes de PDC, de punta a punta.
//
// Consolación NO tiene Bachillerato (`etapasActivas` lo deja apagado), pero la plataforma sigue
// sabiendo trabajarlo para quien lo active. Este fichero lo prueba con la etapa ENCENDIDA (el mock
// de abajo); lo que pasa con ella apagada, que es lo de verdad, está en `sin-bachillerato.test.ts`.
//
// No hay todavía un export de Educamos con Bachillerato; estos tests fijan la CONVENCIÓN que se
// ha deducido (`{1|2}BACH` + letra opcional, ver la cabecera de `src/lib/cursos.ts`) para que,
// cuando llegue un fichero real, el cambio sea de una línea y se vea qué se rompe.
import { describe, expect, it, vi } from 'vitest';
import { claseLarga } from '@/lib/alumnado';
import { entraEnAlcance } from '@/lib/autoasm-construir';
import {
  compararClases,
  cursoBaseEso,
  cursoEnBanco,
  cursoSiguiente,
  ampliarEtapasConjuntas,
  esEtapa,
  esPdc,
  ETAPA_LABEL,
  ETAPAS,
  etapaDeCurso,
  nombreClase as nombreClaseCursos,
  ordenCurso,
  parseBachillerato,
  PATRONES_CURSO_SQL,
} from '@/lib/cursos';
import { computeSyncPlan, parseClase, parseEducamosFile, type ParsedStudentRow, type StudentLike } from '@/lib/educamos';
import { parsearCodigoGrupo } from '@/lib/horarios-import';
import { anioDeEmpezar3, anioQueToca, nombreClase, nombreCurso, porEtapa } from '@/lib/numeros';
import { ETAPA_LABELS, ETAPAS_ORA } from '@/lib/oratorios';
import { claseTutorAKey } from '@/lib/profes';
import { cursoEnPuntualidad } from '@/lib/puntualidad';

// Un colegio con Bachillerato: la etapa encendida, junta con ESO y dentro de Puntualidad.
vi.mock('@/lib/configuracion', async (original) => {
  const real = await original<typeof import('@/lib/configuracion')>();
  return {
    ...real,
    CONFIGURACION: {
      ...real.CONFIGURACION,
      etapasActivas: ['EI', 'EP', 'ESO', 'BACH'],
      etapasConjuntas: [['ESO', 'BACH']],
      puntualidad: { ...real.CONFIGURACION.puntualidad, etapas: ['ESO', 'BACH'] },
    },
  };
});

describe('las etapas', () => {
  it('son cuatro, en orden, y todas tienen nombre', () => {
    expect(ETAPAS).toEqual(['EI', 'EP', 'ESO', 'BACH']);
    for (const e of ETAPAS) expect(ETAPA_LABEL[e]).toBeTruthy();
    expect(ETAPA_LABEL.BACH).toBe('Bachillerato');
  });

  it('esEtapa distingue las conocidas', () => {
    expect(esEtapa('BACH')).toBe(true);
    expect(esEtapa('CFGM')).toBe(false);
    expect(esEtapa(null)).toBe(false);
  });
});

describe('Bachillerato · reconocer el curso', () => {
  it('etapaDeCurso lo lee en todas sus grafías', () => {
    for (const c of ['1BACH', '2BACH', '1ºBACH', '1BAT', '1BTO', '1BACHILLERATO']) {
      expect(etapaDeCurso(c), c).toBe('BACH');
    }
  });

  it('parseBachillerato lo deja siempre como {1|2}BACH', () => {
    expect(parseBachillerato('1BACH')).toEqual({ curso: '1BACH', letra: null });
    expect(parseBachillerato('1ºBACHA')).toEqual({ curso: '1BACH', letra: 'A' });
    expect(parseBachillerato('2BATX')).toEqual({ curso: '2BACH', letra: null });
    expect(parseBachillerato('2BACHILLERATOB')).toEqual({ curso: '2BACH', letra: 'B' });
    expect(parseBachillerato('3ESO')).toBeNull();
    expect(parseBachillerato('')).toBeNull();
  });

  it('los mismos códigos entran por el import de Educamos, el de Horarios y las tutorías', () => {
    expect(parseClase('2BACHA')).toEqual({ curso: '2BACH', letra: 'A' });
    expect(parsearCodigoGrupo('2BACHA')).toEqual({ curso: '2BACH', letra: 'A' });
    expect(parsearCodigoGrupo('1 BAT')).toEqual({ curso: '1BACH', letra: null });
    expect(claseTutorAKey('2º BACH A')).toBe('2BACH|A');
    expect(claseTutorAKey('1BAT')).toBe('1BACH|');
    // ...y coinciden con la clave de un alumno importado
    const { curso, letra } = parseClase('2BACHA');
    expect(claseTutorAKey('2BACHA')).toBe(`${curso}|${letra}`);
  });
});

describe('Bachillerato · reglas', () => {
  it('se ordena después de la ESO', () => {
    expect(ordenCurso('1BACH')).toBeGreaterThan(ordenCurso('4ESO'));
    expect(ordenCurso('2BACH')).toBeGreaterThan(ordenCurso('1BACH'));
    const clases = [
      { curso: '2BACH', letra: 'A' },
      { curso: '4ESO', letra: 'B' },
      { curso: '1BACH', letra: 'A' },
      { curso: '3INF', letra: 'A' },
    ];
    expect([...clases].sort(compararClases).map((c) => c.curso)).toEqual(['3INF', '4ESO', '1BACH', '2BACH']);
  });

  it('promociona 1º → 2º y 2º egresa', () => {
    expect(cursoSiguiente('1BACH')).toBe('2BACH');
    expect(cursoSiguiente('2BACH')).toBeNull();
    expect(cursoSiguiente('3BACH')).toBeNull();
  });

  it('un curso sin número delante no promociona (no devuelve el mismo texto)', () => {
    expect(cursoSiguiente('BACH1')).toBeNull();
  });

  it('entra en el banco de libros (David, 30-sep-2026)', () => {
    expect(cursoEnBanco('1BACH')).toBe(true);
    expect(cursoEnBanco('2BACH')).toBe(true);
    expect(cursoEnBanco('4ESO')).toBe(true);
    expect(cursoEnBanco('2PRI')).toBe(false);
  });

  it('entra en Puntualidad, igual que la ESO y el PDC', () => {
    expect(cursoEnPuntualidad('1BACH')).toBe(true);
    expect(cursoEnPuntualidad('2ESO')).toBe(true);
    expect(cursoEnPuntualidad('3ºPDC')).toBe(true);
    expect(cursoEnPuntualidad('6PRI')).toBe(false);
  });

  it('se puede elegir en Oratorios y Godly Play', () => {
    expect(ETAPAS_ORA).toContain('BACH');
    expect(ETAPA_LABELS.BACH).toBe('Bachillerato');
  });

  it('se escribe como una clase más', () => {
    expect(nombreClaseCursos('1BACH', 'A')).toBe('1BACH A');
  });
});

describe('ESO y Bachillerato son una etapa conjunta (quién ve a quién)', () => {
  it('quien tiene una, tiene las dos', () => {
    expect(ampliarEtapasConjuntas(['ESO'])).toEqual(['ESO', 'BACH']);
    expect(ampliarEtapasConjuntas(['BACH'])).toEqual(['ESO', 'BACH']);
    expect(ampliarEtapasConjuntas(['BACH', 'EI'])).toEqual(['EI', 'ESO', 'BACH']);
  });

  it('no inventa etapas a quien no tiene ninguna de las dos', () => {
    expect(ampliarEtapasConjuntas([])).toEqual([]);
    expect(ampliarEtapasConjuntas(['EI', 'EP'])).toEqual(['EI', 'EP']);
  });

  it('no repite y respeta el orden de las etapas', () => {
    expect(ampliarEtapasConjuntas(['BACH', 'ESO', 'EP'])).toEqual(['EP', 'ESO', 'BACH']);
  });
});

describe('los patrones SQL dicen lo mismo que etapaDeCurso', () => {
  // `ILIKE '%X%'` = «contiene X» sin mirar mayúsculas. Se reproduce aquí para no tener dos criterios.
  const ilike = (texto: string, patron: string) => texto.toUpperCase().includes(patron.replaceAll('%', '').toUpperCase());
  const etapaPorPatrones = (curso: string) => ETAPAS.find((e) => PATRONES_CURSO_SQL[e].some((p) => ilike(curso, p))) ?? null;

  it.each(['3INF', '1PRI', '6PRI', '2ESO', '3ºPPDC', '3ºPDC', '3ESOPDC', '1BACH', '2BACH', '1ºBAT', '1BTO', '2bach'])(
    '%s',
    (curso) => {
      expect(etapaPorPatrones(curso)).toBe(etapaDeCurso(curso));
    },
  );
});

describe('la letra de la clase se ve en TODAS las etapas', () => {
  // `claseLarga` decidía si añadir la letra mirando si estaba «contenida» en el curso, y BACH
  // contiene la A, la B y la C: «1º BACH A» salía como «1º BACH».
  it.each([
    ['3INF', 'A', '3º INF A'],
    ['5PRI', 'B', '5º PRI B'],
    ['2ESO', 'C', '2º ESO C'],
    ['1BACH', 'A', '1º BACH A'],
    ['1BACH', 'B', '1º BACH B'],
    ['2BACH', 'C', '2º BACH C'],
    ['2BACH', 'D', '2º BACH D'],
  ])('%s + %s → %s', (curso, letra, esperado) => {
    expect(claseLarga(curso, letra)).toBe(esperado);
  });

  it('el PDC no repite PDC', () => {
    expect(claseLarga('3ºPPDC', 'PDC')).toBe('3º PDC');
    expect(claseLarga('3ºPDC', 'PDC')).toBe('3º PDC');
  });

  it('Números las nombra bien', () => {
    expect(nombreClase('1BACH', 'A')).toBe('1º Bach A');
    expect(nombreClase('2BACH', null)).toBe('2º Bach');
    expect(nombreCurso('2BACH')).toBe('2º Bachillerato');
    expect(nombreCurso('3INF')).toBe('Infantil 3 años');
  });
});

describe('Bachillerato · Números', () => {
  it('el año de nacimiento que toca sigue a 4º de ESO', () => {
    expect(anioQueToca('4ESO', 2026)).toBe(2011); // 15 años
    expect(anioQueToca('1BACH', 2026)).toBe(2010); // 16 años
    expect(anioQueToca('2BACH', 2026)).toBe(2009); // 17 años
    expect(anioDeEmpezar3('1BACH', 2026)).toBe(2013);
  });

  it('el recuento por etapa lleva BACH aunque no haya nadie', () => {
    const r = porEtapa([], () => 0);
    expect(r).toEqual({ EI: 0, EP: 0, ESO: 0, BACH: 0, total: 0 });
  });
});

describe('Bachillerato · ASM', () => {
  it('queda fuera del alcance aunque «desde 6º» lo incluya por orden', () => {
    expect(entraEnAlcance('4ESO', '6PRI')).toBe(true);
    expect(entraEnAlcance('1BACH', '6PRI')).toBe(false);
    expect(entraEnAlcance('1BACH', null)).toBe(false);
  });
});

describe('PDC · todas las formas', () => {
  const FORMAS = ['3ºPPDC', '3ºPDC', '3ESOPDC', '3PDC', '3 PDC', '3º PPDC'];

  it('se reconocen como PDC y como ESO', () => {
    for (const f of FORMAS) {
      const { curso, letra } = parseClase(f);
      expect(esPdc(curso, letra), f).toBe(true);
      expect(etapaDeCurso(curso), f).toBe('ESO');
      expect(cursoBaseEso(curso), f).toBe('3ESO');
    }
  });

  it('promocionan de 3º a 4º y 4º egresa, sea cual sea la forma', () => {
    expect(cursoSiguiente('3ºPPDC')).toBe('4ºPPDC');
    expect(cursoSiguiente('3ºPDC')).toBe('4ºPDC');
    expect(cursoSiguiente('4ºPDC')).toBeNull();
  });

  it('el horario y las tutorías las unifican', () => {
    for (const f of ['3º PPDC', '3ºPDC', '3PDC']) {
      expect(parsearCodigoGrupo(f), f).toEqual({ curso: '3ESO', letra: 'PDC' });
      expect(claseTutorAKey(f), f).toBe('3ºPPDC|PDC');
    }
  });

  it('esPdc con solo la letra, y no confunde otros cursos', () => {
    expect(esPdc('3ESO', 'PDC')).toBe(true);
    expect(esPdc('3ESO', 'A')).toBe(false);
    expect(esPdc(null)).toBe(false);
  });
});

// ─── Import: etapas desconocidas ─────────────────────────────────────────────

const CSV = [
  'NIA,NOMBRE,APELLIDO1,CLASE',
  '111,Ana,Perez,1BACHA',
  '222,Luis,Gil,CFGM1A',
  '333,Eva,Sol,AULA ENLACE',
  '444,Pau,Mas,3ºPPDC',
  '555,Nora,Paz,',
  '666,Iker,Rey,CFGM1A',
].join('\n');

describe('import de Educamos con una etapa que no sabemos trabajar', () => {
  const parsed = parseEducamosFile(Buffer.from(CSV), 'alumnos.csv');

  it('importa todo lo demás y no falla', () => {
    expect(parsed.rows.map((r) => r.nia)).toEqual(['111', '444', '555']);
    expect(parsed.rows[0]).toMatchObject({ curso: '1BACH', letra: 'A' });
    expect(parsed.rows[1]).toMatchObject({ curso: '3ºPPDC', letra: 'PDC' });
  });

  it('deja fuera solo a quien tiene una clase de etapa desconocida', () => {
    expect(parsed.omitidas.map((r) => r.nia)).toEqual(['222', '333', '666']);
  });

  it('una alumna sin clase se importa como siempre (curso null)', () => {
    expect(parsed.rows[2]).toMatchObject({ nia: '555', curso: null });
  });

  it('avisa una vez por clase, con cuántos son', () => {
    const avisos = parsed.warnings.filter((w) => w.includes('no es de ninguna etapa del colegio'));
    expect(avisos).toHaveLength(2);
    expect(avisos.find((w) => w.includes('CFGM1A'))).toMatch(/^2 alumnos de la clase "CFGM1A" no se importan/);
    expect(avisos.find((w) => w.includes('AULA ENLACE'))).toMatch(/^1 alumno de la clase "AULA ENLACE" no se importa/);
  });
});

describe('vista previa con filas omitidas', () => {
  const fila = (o: Partial<ParsedStudentRow>) =>
    ({ fila: 2, codigo: null, educamosPersonaId: null, nia: null, dni: null, matricula: null, nombre: null, apellido1: null,
      apellido2: null, sexo: null, fechaNacimiento: null, curso: null, letra: null, claseCodigo: null, tutorPersonal: null,
      modeloLinguistico: null, deficit: null, email: null, emailGoogle: null, movil1: null, movil2: null, telEmergencia: null,
      familiaId: null, extra: {}, tutores: [], ...o }) as ParsedStudentRow;
  const alumno = (o: Partial<StudentLike>) =>
    ({ id: 'x', codigo: null, educamosPersonaId: null, nia: null, dni: null, matricula: null, nombre: 'A', apellido1: 'B',
      apellido2: null, sexo: null, fechaNacimiento: null, curso: '1ESO', letra: 'A', claseCodigo: null, tutorPersonal: null,
      modeloLinguistico: null, deficit: null, email: null, emailGoogle: null, movil1: null, movil2: null, telEmergencia: null,
      familiaId: null, active: true, extra: null, ...o }) as StudentLike;

  const existentes = [alumno({ id: 'a', nia: '222' }), alumno({ id: 'b', nia: '999' })];
  const filas = [fila({ nia: '999', curso: '1ESO', letra: 'A' })]; // b está; a no aparece
  const omitida = fila({ fila: 3, nia: '222', curso: 'CFGM1', letra: 'A' });

  it('sin saber de las omitidas, quien casa con una sale como «desaparecido»', () => {
    const plan = computeSyncPlan(filas, existentes, { respetarCursoDe: 'bbdd' });
    expect(plan.desaparecidos.map((d) => d.studentId)).toEqual(['a']);
  });

  it('sabiéndolo, no: que no sepamos leer su clase no quiere decir que se haya ido', () => {
    const plan = computeSyncPlan(filas, existentes, { respetarCursoDe: 'bbdd' }, [], false, [omitida]);
    expect(plan.desaparecidos).toEqual([]);
    expect(plan.altas).toEqual([]); // y tampoco se da de alta a nadie por ellas
  });
});
