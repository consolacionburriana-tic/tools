import { describe, expect, it } from 'vitest';
import { ASIGNATURAS_MAX, normalizarEtiqueta } from '@/lib/cuaderno/campos';
import { valoresAsignaturas } from '@/lib/cuaderno/generar';
import {
  aplicarContexto,
  etiquetasDeXml,
  localizarBloques,
  rellenarDocumentXml,
  renumerarIds,
  sustituirEnFragmento,
  textoPlano,
  tieneFilasRepetibles,
} from '@/lib/cuaderno/ooxml';

// Los fixtures imitan lo que Google Docs devuelve al exportar a .docx, incluyendo el
// detalle que rompe los buscar/reemplazar ingenuos: las etiquetas troceadas en varios
// `<w:t>` y los `<` escapados como `&lt;`. Datos inventados, nunca reales.

const parrafo = (...runs: string[]) =>
  `<w:p>${runs.map((t) => `<w:r><w:t>${t}</w:t></w:r>`).join('')}</w:p>`;

const documento = (contenido: string) =>
  `<?xml version="1.0"?><w:document><w:body>${contenido}<w:sectPr><w:pgSz w:w="11906"/></w:sectPr></w:body></w:document>`;

const norm = normalizarEtiqueta;

describe('localizarBloques', () => {
  it('encuentra los párrafos de primer nivel', () => {
    const xml = `${parrafo('uno')}${parrafo('dos')}`;
    expect(localizarBloques(xml, 'w:p')).toHaveLength(2);
  });

  it('no confunde una tabla anidada con filas sueltas', () => {
    const interior = '<w:tr><w:tc><w:p><w:r><w:t>dentro</w:t></w:r></w:p></w:tc></w:tr>';
    const xml = `<w:tr><w:tc><w:tbl>${interior}</w:tbl></w:tc></w:tr>`;
    expect(localizarBloques(xml, 'w:tr')).toHaveLength(1);
  });
});

describe('sustituirEnFragmento', () => {
  it('sustituye una etiqueta normal', () => {
    const xml = parrafo('Nom ', '<<nom>>');
    const salida = sustituirEnFragmento(xml, (e) => (norm(e) === 'nom' ? 'Aitana' : null));
    expect(textoPlano(salida)).toBe('Nom Aitana');
  });

  it('sustituye una etiqueta partida en varios runs (el caso del corrector)', () => {
    const xml = parrafo('Tutoria: <<cla', 'se', '>> · fin');
    const salida = sustituirEnFragmento(xml, (e) => (norm(e) === 'clase' ? '2ºA' : null));
    expect(textoPlano(salida)).toBe('Tutoria: 2ºA · fin');
  });

  it('entiende las etiquetas con los signos escapados como XML', () => {
    const xml = '<w:p><w:r><w:t>Nº &lt;&lt;numero&gt;&gt;</w:t></w:r></w:p>';
    const salida = sustituirEnFragmento(xml, () => '14');
    expect(textoPlano(salida)).toBe('Nº 14');
  });

  it('deja intacta —y apunta— la etiqueta que nadie sabe resolver', () => {
    const sinResolver = new Set<string>();
    const xml = parrafo('<<professio1>>');
    const salida = sustituirEnFragmento(xml, () => null, sinResolver);
    expect(textoPlano(salida)).toBe('<<professio1>>');
    expect([...sinResolver]).toEqual(['professio1']);
  });

  it('escapa lo que mete: un apellido con & no rompe el XML', () => {
    const xml = parrafo('<<apellidos>>');
    const salida = sustituirEnFragmento(xml, () => 'Sanz & Mas');
    expect(salida).toContain('Sanz &amp; Mas');
    expect(textoPlano(salida)).toBe('Sanz & Mas');
  });

  it('conserva los espacios de los extremos con xml:space', () => {
    const xml = parrafo('<<nom>> ');
    const salida = sustituirEnFragmento(xml, () => 'Aitana');
    expect(salida).toContain('xml:space="preserve"');
  });
});

describe('etiquetasDeXml', () => {
  it('las devuelve en orden, sin repetir y sin las marcas de estructura', () => {
    const xml = documento(`${parrafo('<<clase>> y <<tutor>>')}${parrafo('<<clase>>')}${parrafo('<<#alumnos>>')}`);
    expect(etiquetasDeXml(xml)).toEqual(['clase', 'tutor', '#alumnos']);
  });
});

describe('aplicarContexto', () => {
  const ctx = {
    valores: { nom: 'Aitana', clase: '2ºA', familiar2_nombre: '' },
    presentes: ['familiar1'],
  };

  it('borra el párrafo cuyo condicional no se cumple', () => {
    const xml = `${parrafo('<<?familiar1>>Familiar 1: <<nom>>')}${parrafo('<<?familiar2>>Familiar 2')}`;
    const salida = aplicarContexto(xml, ctx, norm);
    expect(textoPlano(salida)).toBe('Familiar 1: Aitana');
  });

  it('repite la fila marcada una vez por alumno', () => {
    const fila = '<w:tr><w:tc><w:p><w:r><w:t><<#alumnos>><<numero>> <<nom>></w:t></w:r></w:p></w:tc></w:tr>';
    const xml = `<w:tbl>${fila}</w:tbl>`;
    const salida = aplicarContexto(
      xml,
      {
        valores: {},
        filas: [
          { valores: { numero: '1', nom: 'Ana' } },
          { valores: { numero: '2', nom: 'Iker' } },
        ],
      },
      norm,
    );
    expect(localizarBloques(salida, 'w:tr')).toHaveLength(2);
    expect(textoPlano(salida)).toBe('1 Ana2 Iker');
    expect(textoPlano(salida)).not.toContain('#alumnos');
  });

  it('sin filas en el contexto, deja la tabla como estaba', () => {
    const fila = '<w:tr><w:tc><w:p><w:r><w:t>fijo</w:t></w:r></w:p></w:tc></w:tr>';
    expect(aplicarContexto(`<w:tbl>${fila}</w:tbl>`, ctx, norm)).toContain('fijo');
  });
});

describe('tieneFilasRepetibles', () => {
  it('detecta la marca dentro de una fila', () => {
    const fila = '<w:tr><w:tc><w:p><w:r><w:t><<#alumnos>></w:t></w:r></w:p></w:tc></w:tr>';
    expect(tieneFilasRepetibles(`<w:tbl>${fila}</w:tbl>`)).toBe(true);
    expect(tieneFilasRepetibles(parrafo('<<#alumnos>>'))).toBe(false);
  });
});

describe('renumerarIds', () => {
  it('desplaza los ids que tienen que ser únicos y deja la copia 0 igual', () => {
    const xml = '<w:bookmarkStart w:id="3" w:name="h.x"/><wp:docPr id="1" name="img"/>';
    expect(renumerarIds(xml, 0)).toBe(xml);
    const copia = renumerarIds(xml, 2);
    expect(copia).toContain('w:id="200003"');
    expect(copia).toContain('w:name="h.x_c2"');
    expect(copia).toContain('id="200001"');
  });
});

describe('rellenarDocumentXml', () => {
  const plantilla = documento(parrafo('Alumne: <<nom>> · <<clase>>'));

  it('repite el cuerpo una vez por copia con salto de página', () => {
    const { xml } = rellenarDocumentXml(
      plantilla,
      {
        copias: [
          { valores: { nom: 'Ana', clase: '2ºA' } },
          { valores: { nom: 'Iker', clase: '2ºA' } },
        ],
      },
      norm,
    );
    expect(textoPlano(xml)).toBe('Alumne: Ana · 2ºAAlumne: Iker · 2ºA');
    expect(xml.split('w:type="page"')).toHaveLength(2); // un salto entre las dos copias
  });

  it('deja el sectPr una sola vez y al final', () => {
    const { xml } = rellenarDocumentXml(
      plantilla,
      { copias: [{ valores: { nom: 'Ana', clase: '2ºA' } }, { valores: { nom: 'Iker', clase: '2ºA' } }] },
      norm,
    );
    expect(xml.match(/<w:sectPr>/g)).toHaveLength(1);
    expect(xml.indexOf('<w:sectPr>')).toBeGreaterThan(xml.lastIndexOf('Iker'));
  });

  it('sin copias, no destroza la plantilla', () => {
    const { xml } = rellenarDocumentXml(plantilla, { copias: [] }, norm);
    expect(textoPlano(xml)).toContain('<<nom>>');
  });

  it('reúne las etiquetas sin resolver de todas las copias', () => {
    const { sinResolver } = rellenarDocumentXml(
      documento(parrafo('<<professio1>> <<nom>>')),
      { copias: [{ valores: { nom: 'Ana' } }] },
      norm,
    );
    expect(sinResolver).toEqual(['professio1']);
  });
});

describe('valoresAsignaturas', () => {
  it('coloca cada asignatura en su hueco y deja el resto en blanco', () => {
    const valores = valoresAsignaturas([{ enLaHoja: 'Mates' }, { enLaHoja: 'Valencià' }]);
    expect(valores.asignatura1).toBe('Mates');
    expect(valores.asignatura2).toBe('Valencià');
    expect(valores.asignatura3).toBe('');
    expect(valores[`asignatura${ASIGNATURAS_MAX}`]).toBe('');
    expect(valores.num_asignaturas).toBe('2');
  });

  it('los huecos vacíos borran la etiqueta en vez de imprimirla', () => {
    const plantilla = documento(parrafo('1. <<asignatura1>> · 2. <<asignatura2>>'));
    const { xml } = rellenarDocumentXml(
      plantilla,
      { copias: [{ valores: valoresAsignaturas([{ enLaHoja: 'Mates' }]) }] },
      norm,
    );
    expect(textoPlano(xml)).toBe('1. Mates · 2. ');
  });

  it('pasar del último hueco no rompe nada: las de más no salen', () => {
    const muchas = Array.from({ length: ASIGNATURAS_MAX + 3 }, (_, i) => ({ enLaHoja: `M${i + 1}` }));
    const valores = valoresAsignaturas(muchas);
    expect(valores[`asignatura${ASIGNATURAS_MAX}`]).toBe(`M${ASIGNATURAS_MAX}`);
    expect(valores[`asignatura${ASIGNATURAS_MAX + 1}`]).toBeUndefined();
    expect(valores.num_asignaturas).toBe(String(ASIGNATURAS_MAX + 3));
  });
});

describe('filas de toda la clase', () => {
  const fila = (marca: string) =>
    `<w:tr><w:tc><w:p><w:r><w:t>${marca}<<nom>></w:t></w:r></w:p></w:tc></w:tr>`;

  it('<<#clase>> se repite con la clase entera y <<#alumnos>> solo con los del tutor', () => {
    const xml = `<w:tbl>${fila('<<#alumnos>>')}</w:tbl><w:tbl>${fila('<<#clase>>')}</w:tbl>`;
    const salida = aplicarContexto(
      xml,
      {
        valores: {},
        filas: [{ valores: { nom: 'Ana' } }],
        filasClase: [{ valores: { nom: 'Ana' } }, { valores: { nom: 'Iker' } }, { valores: { nom: 'Lola' } }],
      },
      norm,
    );
    expect(textoPlano(salida)).toBe('AnaAnaIkerLola');
    expect(localizarBloques(salida, 'w:tr')).toHaveLength(4);
    expect(textoPlano(salida)).not.toContain('#');
  });

  it('la marca de clase también cuenta como fila repetible', () => {
    expect(tieneFilasRepetibles(`<w:tbl>${fila('<<#clase>>')}</w:tbl>`)).toBe(true);
  });
});
