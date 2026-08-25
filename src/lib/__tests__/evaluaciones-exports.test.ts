import { describe, expect, it } from 'vitest';
import { construirCsv, nombreFicheroCsv, type FilaExport } from '@/lib/evaluaciones-exports';

const base: FilaExport = {
  respuestaId: 'abcdef12-3456-7890-abcd-ef1234567890',
  fecha: '2026-03-04 10:15',
  curso: '2ESO',
  letra: 'B',
  etapa: 'ESO',
  bloque: 'Convivencia de inicio',
  preguntaClave: 'actividad',
  pregunta: '✅ Actividad · Convivencia',
  fila: 'Duración',
  escala: 'nada_mucho',
  valorNum: 3,
  opcion: null,
  texto: null,
};

describe('CSV de respuestas', () => {
  it('añade cabecera, BOM y traduce el valor a etiqueta y a 0-100', () => {
    const csv = construirCsv([base]);
    expect(csv.startsWith('﻿')).toBe(true);
    const [cabecera, fila] = csv.replace('﻿', '').split('\n');
    expect(cabecera).toContain('clave_pregunta');
    expect(fila).toContain('Bastante');
    expect(fila.split(';')).toContain('67'); // 3 de 4 en Nada-Mucho
  });

  it('escapa los textos con punto y coma, comillas o saltos de línea', () => {
    const csv = construirCsv([{ ...base, fila: null, valorNum: null, texto: 'Me gustó; pero "corto"\ny frío' }]);
    expect(csv).toContain('"Me gustó; pero ""corto""');
  });

  it('deja vacías las columnas sin dato en vez de escribir null', () => {
    const fila = construirCsv([{ ...base, curso: null, letra: null, etapa: null }]).split('\n')[1];
    expect(fila).not.toContain('null');
    expect(fila).toContain(';;;');
  });

  it('un formulario sin respuestas devuelve solo la cabecera', () => {
    expect(construirCsv([]).replace('﻿', '').split('\n')).toHaveLength(1);
  });

  it('el nombre de fichero sale limpio de acentos y con la fecha', () => {
    expect(nombreFicheroCsv('Cuaresma · Alumnado', new Date('2026-03-04T12:00:00Z'))).toBe(
      'evaluacion-cuaresma-alumnado-2026-03-04.csv',
    );
  });
});
