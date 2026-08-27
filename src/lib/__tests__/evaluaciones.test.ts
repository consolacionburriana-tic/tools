import { describe, expect, it } from 'vitest';
import {
  academicYearAnterior,
  aPorcentaje,
  caritaPara,
  colorAleatorio,
  esEscalaEstrellas,
  estiloEstrellaDe,
  fraseConHueco,
  huecosPendientes,
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
  COLORES_ACTIVIDAD,
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

  it('no ofrece cursos anteriores a que existiera el módulo', () => {
    // El módulo nace en 2025-26: 2024-25 y anteriores serían ruido en el selector.
    expect(opcionesAcademicYear('2025-26')).toEqual(['2026-27', '2025-26']);
  });

  it('va creciendo con los cursos, del más nuevo al más viejo', () => {
    expect(opcionesAcademicYear('2027-28')).toEqual(['2028-29', '2027-28', '2026-27', '2025-26']);
  });

  it('nunca devuelve lista vacía aunque el curso actual sea anterior al primero', () => {
    expect(opcionesAcademicYear('2019-20')).toEqual(['2025-26']);
  });
});

describe('huecos obligatorios', () => {
  it('detecta como hueco solo la frase que TERMINA en puntos suspensivos', () => {
    expect(fraseConHueco('¿Te ha servido para…')).toBe(true);
    expect(fraseConHueco('  ¿Te ha servido para…  ')).toBe(true);
    expect(fraseConHueco('¿Te ha servido para conocer el lema?')).toBe(false);
  });

  it('no confunde los puntos suspensivos de en medio de una frase', () => {
    // Este texto es el de "Observaciones" de siempre: NO es un hueco.
    expect(fraseConHueco('🤔 Observaciones y sugerencias · ¿Qué cambiarías? o… ¿Qué nos propones?')).toBe(false);
  });

  it('encuentra los huecos tanto en la pregunta como en sus filas', () => {
    const pendientes = huecosPendientes([
      {
        id: 'q1',
        texto: '✅ Actividad · Convivencia',
        filas: [
          { clave: 'a', texto: '¿Te ha servido para…' },
          { clave: 'b', texto: '¿Te ha gustado el lugar?' },
        ],
      },
      { id: 'q2', texto: 'Cuéntanos sobre…', filas: [] },
    ]);
    expect(pendientes).toEqual([
      { questionId: 'q1', texto: '¿Te ha servido para…' },
      { questionId: 'q2', texto: 'Cuéntanos sobre…' },
    ]);
  });

  it('un formulario ya adaptado no tiene huecos', () => {
    expect(huecosPendientes([{ id: 'q1', texto: 'Actividad', filas: [{ clave: 'a', texto: '¿Te gustó?' }] }])).toEqual([]);
  });

  it('el preset de alumnado SIEMPRE nace con un hueco: obliga a personalizarlo', () => {
    const matriz = presetActividad('Convivencia', 'alumnos')[0];
    const conHueco = matriz.filas!.filter((f) => fraseConHueco(f.texto));
    expect(conHueco).toHaveLength(1);
    expect(conHueco[0].texto).toBe('¿Te ha servido para…');
  });

  it('los tres presets nacen con hueco, para que nadie mande la genérica', () => {
    for (const audiencia of ['alumnos', 'profesores', 'familias'] as const) {
      const preguntas = presetActividad('X', audiencia).map((q, i) => ({
        id: String(i),
        texto: q.texto,
        filas: q.filas ?? [],
      }));
      expect(huecosPendientes(preguntas).length).toBeGreaterThan(0);
    }
  });
});

describe('escala de estrellitas', () => {
  it('son una escala más, así que normalizan a 0-100 como cualquier otra', () => {
    expect(aPorcentaje(1, 'estrellas_5')).toBe(0);
    expect(aPorcentaje(5, 'estrellas_5')).toBe(100);
    expect(aPorcentaje(1, 'estrellas_4')).toBe(0);
    expect(aPorcentaje(4, 'estrellas_4')).toBe(100);
  });

  it('4 y 5 estrellas son comparables entre sí y con Nada-Mucho', () => {
    // Media estrella de diferencia no debe falsear la comparativa entre cursos.
    expect(aPorcentaje(4, 'estrellas_4')).toBe(aPorcentaje(5, 'estrellas_5'));
    expect(aPorcentaje(4, 'estrellas_4')).toBe(aPorcentaje(4, 'nada_mucho'));
  });

  it('reconoce qué escalas se pintan con estrellas', () => {
    expect(esEscalaEstrellas('estrellas_4')).toBe(true);
    expect(esEscalaEstrellas('estrellas_5')).toBe(true);
    expect(esEscalaEstrellas('nada_mucho')).toBe(false);
    expect(esEscalaEstrellas(null)).toBe(false);
  });

  it('tiene 4 y 5 puntos según la variante', () => {
    expect(escalaDe('estrellas_4').puntos).toHaveLength(4);
    expect(escalaDe('estrellas_5').puntos).toHaveLength(5);
  });

  it('las caritas se reparten de peor a mejor sea cual sea el número de puntos', () => {
    expect(caritaPara(0, 5)).toBe('😖');
    expect(caritaPara(4, 5)).toBe('🤩');
    // Con 4 puntos usa las mismas caras, repartidas
    expect(caritaPara(0, 4)).toBe('😖');
    expect(caritaPara(3, 4)).toBe('🤩');
  });

  it('el estilo cae a estrellas si viene vacío o es desconocido', () => {
    expect(estiloEstrellaDe(null).value).toBe('estrella');
    expect(estiloEstrellaDe('inventado').value).toBe('estrella');
    expect(estiloEstrellaDe('corazon').value).toBe('corazon');
  });

  it('solo las caritas no son acumulativas', () => {
    expect(estiloEstrellaDe('carita').acumulativo).toBe(false);
    expect(estiloEstrellaDe('estrella').acumulativo).toBe(true);
  });
});

describe('color de la actividad', () => {
  it('el catálogo tiene 20 tonos distintos, todos hex válidos', () => {
    expect(COLORES_ACTIVIDAD).toHaveLength(20);
    expect(new Set(COLORES_ACTIVIDAD).size).toBe(20);
    for (const c of COLORES_ACTIVIDAD) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('colorAleatorio siempre devuelve uno del catálogo', () => {
    for (let i = 0; i < 50; i++) {
      expect(COLORES_ACTIVIDAD).toContain(colorAleatorio());
    }
  });

  it('con suficientes tiradas toca más de un color (no está clavado en el primero)', () => {
    const vistos = new Set(Array.from({ length: 200 }, () => colorAleatorio()));
    expect(vistos.size).toBeGreaterThan(1);
  });
});
