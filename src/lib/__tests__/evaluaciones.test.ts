import { describe, expect, it } from 'vitest';
import {
  academicYearAnterior,
  aPorcentaje,
  claveUnica,
  desdeCatalogo,
  escalaDe,
  limpiarRespuestas,
  mediaBruta,
  mediaPorcentaje,
  opcionesAcademicYear,
  preguntasIncompletas,
  presetActividad,
  slugClave,
  tonoDe,
  CATALOGO,
  type PreguntaParaValidar,
} from '@/lib/evaluaciones';

describe('escalas y normalización', () => {
  it('lleva cualquier escala a 0-100 con los extremos en 0 y 100', () => {
    expect(aPorcentaje(1, 'nada_mucho')).toBe(0);
    expect(aPorcentaje(4, 'nada_mucho')).toBe(100);
    expect(aPorcentaje(1, '1_5')).toBe(0);
    expect(aPorcentaje(5, '1_5')).toBe(100);
    expect(aPorcentaje(0, 'si_no')).toBe(0);
    expect(aPorcentaje(1, 'si_no')).toBe(100);
  });

  it('hace comparables dos escalas distintas: "Bastante" y un 4 sobre 5 valen lo mismo', () => {
    expect(aPorcentaje(3, 'nada_mucho')).toBeCloseTo(66.67, 1);
    expect(aPorcentaje(4, '1_5')).toBeCloseTo(75, 1);
    // El "Mucho" y el 5 sí coinciden exactamente: es lo que permite la comparativa entre años.
    expect(aPorcentaje(4, 'nada_mucho')).toBe(aPorcentaje(5, '1_5'));
  });

  it('descarta valores fuera de la escala', () => {
    expect(aPorcentaje(9, 'nada_mucho')).toBeNull();
    expect(aPorcentaje(0, 'nada_mucho')).toBeNull();
  });

  it('calcula medias brutas y normalizadas', () => {
    expect(mediaBruta([1, 2, 3, 4])).toBe(2.5);
    expect(mediaBruta([])).toBeNull();
    expect(mediaPorcentaje([4, 4, 4], 'nada_mucho')).toBe(100);
    expect(mediaPorcentaje([], 'nada_mucho')).toBeNull();
  });

  it('escalaDe cae a Nada-Mucho si el valor no existe', () => {
    expect(escalaDe('lo_que_sea').value).toBe('nada_mucho');
    expect(escalaDe('1_5').puntos).toHaveLength(5);
  });

  it('el tono del color sigue los cortes esperados', () => {
    expect(tonoDe(90)).toBe('bien');
    expect(tonoDe(50)).toBe('regular');
    expect(tonoDe(20)).toBe('flojo');
    expect(tonoDe(null)).toBe('sin');
  });
});

describe('claves estables', () => {
  it('convierte el texto en un slug sin acentos ni signos', () => {
    expect(slugClave('¿Te ha gustado el lugar?')).toBe('te_ha_gustado_el_lugar');
    expect(slugClave('Duración')).toBe('duracion');
    expect(slugClave('   ')).toBe('pregunta');
  });

  it('desambigua claves repetidas dentro de un bloque', () => {
    const usadas = new Set(['ambiente']);
    expect(claveUnica('ambiente', usadas)).toBe('ambiente_2');
    usadas.add('ambiente_2');
    expect(claveUnica('ambiente', usadas)).toBe('ambiente_3');
    expect(claveUnica('duracion', usadas)).toBe('duracion');
  });
});

describe('presets', () => {
  it('el preset de profesorado trae objetivos, organización y observaciones', () => {
    const p = presetActividad('Convivencia de inicio', 'profesores');
    expect(p.map((q) => q.clave)).toEqual(['objetivos', 'organizacion', 'observaciones']);
    const organizacion = p[1];
    expect(organizacion.filas?.map((f) => f.texto)).toEqual(['Duración', 'Dinámica propuesta', 'Materiales trabajados', 'Ambiente']);
  });

  it('el preset de alumnado es distinto y usa el tono de siempre', () => {
    const p = presetActividad('Convivencia de inicio', 'alumnos');
    expect(p.map((q) => q.clave)).toEqual(['actividad', 'observaciones']);
    expect(p[0].texto).toContain('Convivencia de inicio');
    expect(p[1].ayuda).toContain('necesitamos escuchar tu opinión');
  });

  it('marca para revisar la pregunta cuya frase hay que adaptar', () => {
    expect(presetActividad('X', 'alumnos').filter((q) => q.revisar)).toHaveLength(1);
    expect(presetActividad('X', 'profesores').filter((q) => q.revisar)).toHaveLength(1);
  });

  it('las observaciones nunca son obligatorias', () => {
    for (const audiencia of ['alumnos', 'profesores', 'familias'] as const) {
      const obs = presetActividad('X', audiencia).find((q) => q.clave === 'observaciones');
      expect(obs?.obligatoria).toBe(false);
    }
  });

  it('el catálogo se materializa con clave única', () => {
    const item = CATALOGO.find((c) => c.id === 'organizacion')!;
    const q = desdeCatalogo(item, new Set(['organizacion']));
    expect(q.clave).toBe('organizacion_2');
    expect(q.tipo).toBe('escala');
  });
});

// Un bloque de ejemplo con las cuatro formas de preguntar que soporta el motor.
const PREGUNTAS: PreguntaParaValidar[] = [
  {
    id: 'q-matriz',
    tipo: 'escala',
    escala: 'nada_mucho',
    obligatoria: true,
    filas: [
      { clave: 'duracion', texto: 'Duración' },
      { clave: 'ambiente', texto: 'Ambiente' },
    ],
    opciones: [],
    permiteOtra: false,
  },
  { id: 'q-texto', tipo: 'texto', escala: 'nada_mucho', obligatoria: false, filas: [], opciones: [], permiteOtra: false },
  {
    id: 'q-opcion',
    tipo: 'opcion',
    escala: 'nada_mucho',
    obligatoria: true,
    filas: [],
    opciones: [
      { clave: 'si', texto: 'Sí, genial' },
      { clave: 'no', texto: 'No me ha gustado' },
    ],
    permiteOtra: true,
  },
];

describe('validación de respuestas', () => {
  it('exige TODAS las filas de una matriz obligatoria', () => {
    const faltaUna = preguntasIncompletas(PREGUNTAS, [
      { questionId: 'q-matriz', filaClave: 'duracion', valorNum: 3 },
      { questionId: 'q-opcion', opcionClave: 'si' },
    ]);
    expect(faltaUna).toEqual(['q-matriz']);
  });

  it('da por buena la matriz completa y no reclama las opcionales', () => {
    const ok = preguntasIncompletas(PREGUNTAS, [
      { questionId: 'q-matriz', filaClave: 'duracion', valorNum: 3 },
      { questionId: 'q-matriz', filaClave: 'ambiente', valorNum: 4 },
      { questionId: 'q-opcion', opcionClave: 'no' },
    ]);
    expect(ok).toEqual([]);
  });

  it('acepta "Otra" con texto como respuesta de una pregunta de opción', () => {
    const ok = preguntasIncompletas(PREGUNTAS, [
      { questionId: 'q-matriz', filaClave: 'duracion', valorNum: 1 },
      { questionId: 'q-matriz', filaClave: 'ambiente', valorNum: 1 },
      { questionId: 'q-opcion', valorTexto: 'Prefiero ir al río' },
    ]);
    expect(ok).toEqual([]);
  });
});

describe('limpieza en servidor', () => {
  it('tira valores fuera de escala, filas inventadas y preguntas que no son del formulario', () => {
    const limpio = limpiarRespuestas(PREGUNTAS, [
      { questionId: 'q-matriz', filaClave: 'duracion', valorNum: 3 },
      { questionId: 'q-matriz', filaClave: 'duracion', valorNum: 99 },
      { questionId: 'q-matriz', filaClave: 'inventada', valorNum: 2 },
      { questionId: 'q-de-otro-form', valorTexto: 'hola' },
    ]);
    expect(limpio).toEqual([{ questionId: 'q-matriz', filaClave: 'duracion', valorNum: 3 }]);
  });

  it('convierte el texto libre de una opción en la opción "otra"', () => {
    const limpio = limpiarRespuestas(PREGUNTAS, [{ questionId: 'q-opcion', valorTexto: '  Al río  ' }]);
    expect(limpio).toEqual([{ questionId: 'q-opcion', opcionClave: 'otra', valorTexto: 'Al río' }]);
  });

  it('no deja pasar una opción que no está entre las definidas', () => {
    const limpio = limpiarRespuestas(PREGUNTAS, [{ questionId: 'q-opcion', opcionClave: 'trampa' }]);
    expect(limpio).toEqual([]);
  });

  it('descarta el texto vacío de una pregunta de texto', () => {
    expect(limpiarRespuestas(PREGUNTAS, [{ questionId: 'q-texto', valorTexto: '   ' }])).toEqual([]);
  });
});

describe('cursos académicos', () => {
  it('calcula el curso anterior', () => {
    expect(academicYearAnterior('2025-26')).toBe('2024-25');
    expect(academicYearAnterior('2000-01')).toBe('1999-00');
  });

  it('ofrece el siguiente, el actual y tres anteriores', () => {
    expect(opcionesAcademicYear('2025-26')).toEqual(['2026-27', '2025-26', '2024-25', '2023-24', '2022-23']);
  });
});
