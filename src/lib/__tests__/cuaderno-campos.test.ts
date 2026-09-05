import { describe, expect, it } from 'vitest';
import {
  analizarEtiqueta,
  avisosDePlantilla,
  CAMPOS,
  construirMapeo,
  esCampo,
  normalizarEtiqueta,
  ALIAS_POR_DEFECTO,
} from '@/lib/cuaderno/campos';
import {
  carpetaClase,
  carpetaEjecucion,
  claseCorta,
  cursoEscolarLargo,
  fechaCorta,
  limpiarNombre,
  nombreDocumento,
  numeroListaTexto,
  tutorCorto,
} from '@/lib/cuaderno/nombres';

describe('normalizarEtiqueta', () => {
  it('unifica mayúsculas, acentos, "º" y separadores', () => {
    expect(normalizarEtiqueta('Nº Clase')).toBe('n_clase');
    expect(normalizarEtiqueta('nº clase')).toBe('n_clase');
    expect(normalizarEtiqueta('  Tutoría  ')).toBe('tutoria');
    expect(normalizarEtiqueta('nom padre 1')).toBe('nom_padre_1');
    expect(normalizarEtiqueta('nombre_completo')).toBe('nombre_completo');
  });
});

describe('construirMapeo', () => {
  it('reconoce los campos por su propio id', () => {
    const mapeo = construirMapeo();
    for (const campo of CAMPOS) expect(mapeo.get(campo.id)).toBe(campo.id);
  });

  it('trae de fábrica las etiquetas de las plantillas que ya existen', () => {
    const mapeo = construirMapeo();
    expect(mapeo.get('tutoria')).toBe('clase');
    expect(mapeo.get('cognoms')).toBe('apellidos');
    expect(mapeo.get('tlf1')).toBe('familiar1_telefono');
    expect(mapeo.get('correu2')).toBe('familiar2_correo');
  });

  it('todos los alias de fábrica apuntan a un campo que existe', () => {
    for (const campo of Object.values(ALIAS_POR_DEFECTO)) expect(esCampo(campo)).toBe(true);
  });

  it('lo aprendido pisa a lo de fábrica, y un campo vacío borra el alias', () => {
    expect(construirMapeo({ tutoria: 'tutor' }).get('tutoria')).toBe('tutor');
    expect(construirMapeo({ 'Nº Clase': '' }).get('n_clase')).toBeUndefined();
  });
});

describe('analizarEtiqueta', () => {
  const mapeo = construirMapeo();

  it('distingue las tres marcas', () => {
    expect(analizarEtiqueta('nº clase', mapeo)).toMatchObject({ tipo: 'campo', campo: 'clase' });
    expect(analizarEtiqueta('#alumnos', mapeo)).toMatchObject({ tipo: 'filas' });
    expect(analizarEtiqueta('?familiar2', mapeo)).toMatchObject({ tipo: 'condicion', condicion: 'familiar2' });
  });

  it('deja sin campo lo que nadie ha mapeado', () => {
    expect(analizarEtiqueta('professio1', mapeo).campo).toBeNull();
  });
});

describe('avisosDePlantilla', () => {
  const mapeo = construirMapeo();
  const analizar = (etiquetas: string[]) => etiquetas.map((e) => analizarEtiqueta(e, mapeo));

  it('bloquea si queda una etiqueta sin mapear', () => {
    const avisos = avisosDePlantilla(analizar(['nom', 'professio1']), 'alumno', false);
    expect(avisos.some((a) => a.bloqueante)).toBe(true);
  });

  it('no bloquea cuando está todo mapeado', () => {
    const avisos = avisosDePlantilla(analizar(['nom', 'cognoms', 'tutoria']), 'alumno', false);
    expect(avisos.some((a) => a.bloqueante)).toBe(false);
  });

  it('avisa (sin bloquear) de datos de alumno en una plantilla que no se repite por alumno', () => {
    const avisos = avisosDePlantilla(analizar(['nom']), 'unica', false);
    expect(avisos.some((a) => !a.bloqueante && a.texto.includes('no se repite por alumno'))).toBe(true);
  });

  it('avisa si se repite por trimestre pero no usa el trimestre', () => {
    const avisos = avisosDePlantilla(analizar(['tutoria']), 'trimestre', true);
    expect(avisos.some((a) => a.texto.includes('trimestre'))).toBe(true);
  });
});

describe('nombres', () => {
  it('acorta la clase como se lee en la carpeta', () => {
    expect(claseCorta('2ESO', 'A')).toBe('2ºA');
    expect(claseCorta('4ºPPDC', 'PDC')).toBe('4ºPDC');
    expect(claseCorta('1PRI', null)).toBe('1º');
  });

  it('hace el nombre corto del tutor', () => {
    expect(tutorCorto('María', 'Remolar')).toBe('María R');
    expect(tutorCorto('Paola', null)).toBe('Paola');
    expect(tutorCorto(null, null)).toBe('Sin tutor');
  });

  it('nombra la carpeta de clase con sus tutores', () => {
    expect(carpetaClase('2ESO', 'A', ['María R', 'Paola G'])).toBe('2ºA — María R + Paola G');
    expect(carpetaClase('2ESO', 'A', [])).toBe('2ºA — sin tutor asignado');
  });

  it('nombra el documento con su doble índice', () => {
    expect(
      nombreDocumento({ indiceTutor: 2, indicePlantilla: 3, plantilla: 'Entrevista', tutor: 'Paola G', clase: '2ºA' }),
    ).toBe('2.3 · Entrevista — Paola G — 2ºA');
  });

  it('escribe el curso escolar largo', () => {
    expect(cursoEscolarLargo('2026-27')).toBe('2026-2027');
    expect(cursoEscolarLargo('2099-00')).toBe('2099-2000');
  });

  it('nombra la subcarpeta de una regeneración', () => {
    expect(carpetaEjecucion(2, new Date(2026, 8, 15))).toBe('260915 - Ejecución Cuaderno 2');
    expect(fechaCorta(new Date(2026, 0, 3))).toBe('260103');
  });

  it('anota el nº de lista solo cuando el asignado y el alfabético no coinciden', () => {
    expect(numeroListaTexto(14, 14)).toBe('14');
    expect(numeroListaTexto(31, 7)).toBe('7* (31)');
  });

  it('limpia los nombres que Drive no admite', () => {
    expect(limpiarNombre('2ºA / B\n  con   espacios ')).toBe('2ºA B con espacios');
  });
});
