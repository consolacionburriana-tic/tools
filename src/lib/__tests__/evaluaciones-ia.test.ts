import { describe, expect, it } from 'vitest';
import { informeParaIA } from '@/lib/evaluaciones-ia';
import type { Resultados } from '@/lib/evaluaciones-server';

// Datos inventados con la forma de getResultados.
const textos = [
  { id: 't1', valor: 'Más salidas', clase: '2ESO A', etapa: 'ESO', pct: 40 },
  { id: 't2', valor: 'más salidas', clase: '2ESO B', etapa: 'ESO', pct: 80 },
  { id: 't3', valor: 'nada', clase: '1ESO A', etapa: 'ESO', pct: 90 },
  { id: 't4', valor: 'No cambiaría nada', clase: '1ESO B', etapa: 'ESO', pct: 95 },
  { id: 't5', valor: 'Que dure más la convivencia', clase: '3ESO A', etapa: 'ESO', pct: 55 },
];
const r = {
  form: { titulo: 'Convivencia', audiencia: 'alumnos', academicYear: '2026-27' },
  totalRespuestas: 5,
  objetivo: 10,
  mediaPct: 70,
  animo: { bien: 3, regular: 1, flojo: 1 },
  etapas: [{ etapa: 'ESO', respuestas: 5, mediaPct: 70 }],
  clases: [],
  destacadas: ['t5'],
  bloques: [
    {
      titulo: 'Convivencia',
      mediaPct: 70,
      preguntas: [
        {
          tipo: 'escala',
          escala: 'si_no',
          texto: '¿Quitarías el oratorio?',
          filas: [{ texto: '¿Quitarías el oratorio?', n: 4, mediaPct: 25, distribucion: [{ valor: 0, label: 'No', n: 3 }, { valor: 1, label: 'Sí', n: 1 }] }],
          opciones: [],
          textos: [],
        },
        { tipo: 'texto', escala: 'nada_mucho', texto: '¿Qué cambiarías?', filas: [], opciones: [], textos },
      ],
    },
  ],
} as unknown as Resultados;

describe('informeParaIA', () => {
  const informe = informeParaIA(r, { filtro: null, contexto: 'Lema: Sin rodeos' });

  it('lleva el contexto del colegio y las cifras', () => {
    expect(informe).toContain('Lema: Sin rodeos');
    expect(informe).toContain('Respuestas: 5 de 10 posibles');
  });
  it('el Sí/No va como preferencia, en % de Sí', () => {
    expect(informe).toContain('25 % dice Sí');
    expect(informe).toContain('preferencia, no nota');
  });
  it('junta los repetidos, cuenta los "sin cambios" y no manda los vacíos', () => {
    expect(informe).toMatch(/"Más salidas" ×2/);
    expect(informe).toContain('1 dicen que no cambiarían nada');
    expect(informe).not.toContain('- "nada"');
    expect(informe).not.toContain('No cambiaría nada"');
  });
  it('marca los destacados con estrella', () => {
    expect(informe).toContain('★ "Que dure más la convivencia"');
  });
});
