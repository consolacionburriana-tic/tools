import { describe, expect, it } from 'vitest';
import { receiptTable } from '@/lib/licencias-email';

// Regresión del bug "Total51 €": el recibo usaba display:flex con justify-content, que
// Gmail y compañía ignoran, así que el importe salía pegado al concepto.
describe('receiptTable', () => {
  const items = [
    { asignatura: 'Inglés', precio: '12.50' },
    { asignatura: 'Francés', precio: '9' },
  ];

  it('no usa flexbox (los clientes de correo lo ignoran)', () => {
    expect(receiptTable(items, 21.5)).not.toContain('display:flex');
    expect(receiptTable(items, 21.5)).not.toContain('justify-content');
  });

  it('maqueta con tabla y alinea los importes a la derecha', () => {
    const html = receiptTable(items, 21.5);
    expect(html).toContain('<table role="presentation"');
    // una celda alineada a la derecha por licencia, más la del total
    expect(html.match(/align="right"/g)).toHaveLength(items.length + 1);
  });

  it('saca cada concepto y su importe en celdas separadas', () => {
    const html = receiptTable(items, 21.5);
    expect(html).toContain('Inglés');
    expect(html).toContain('Francés');
    // el concepto cierra su celda antes de que empiece la del importe
    expect(html).toMatch(/Inglés<\/td>\s*<td align="right"/);
    expect(html).toMatch(/Total<\/td>\s*<td align="right"/);
  });

  it('aguanta un pedido sin licencias de pago', () => {
    const html = receiptTable([], 0);
    expect(html).toContain('(sin licencias de pago)');
    expect(html).toContain('colspan="2"');
    expect(html).not.toContain('display:flex');
  });
});

// ─── Correo de entrega de licencias (Fase 5) ──────────────────────────────────
import { cajaCodigos, cuerpoSeguro, htmlLicencia, PLANTILLAS_LICENCIA, varsDeLicencia } from '@/lib/licencias-email';

const DATOS = {
  alumno: 'Ejemplo Prueba, Ana',
  nombre: 'Ana',
  apellidos: 'Ejemplo Prueba',
  curso: '2ESO',
  clase: '2ESO A',
  academicYear: '2026/27',
  licencias: [{ asignatura: 'INGLÉS', libro: 'Libro de prueba 3 SB', plataforma: 'Blinklearning', codigo: 'XQXN1YG7' }],
};

describe('cuerpoSeguro', () => {
  it('mantiene los <b> del texto de siempre (viene pegado de FormMule)', () => {
    expect(cuerpoSeguro('la licencia de <b>INGLÉS</b>')).toBe('la licencia de <b>INGLÉS</b>');
  });

  it('también admite **negrita**', () => {
    expect(cuerpoSeguro('la licencia de **INGLÉS**')).toBe('la licencia de <b>INGLÉS</b>');
  });

  it('escapa cualquier otra etiqueta, con atributos o sin ellos', () => {
    expect(cuerpoSeguro('<script>alert(1)</script>')).toContain('&lt;script&gt;');
    expect(cuerpoSeguro('<b onclick="x">hola</b>')).toContain('&lt;b onclick=');
    expect(cuerpoSeguro('<a href="http://malo">clic</a>')).toContain('&lt;a href=');
  });

  it('los saltos de línea se ven como saltos', () => {
    expect(cuerpoSeguro('uno\ndos')).toBe('uno<br>dos');
  });
});

describe('varsDeLicencia', () => {
  it('con una licencia, la asignatura es la suya', () => {
    expect(varsDeLicencia(DATOS).asignatura).toBe('INGLÉS');
    expect(varsDeLicencia(DATOS).n).toBe('1');
  });

  it('fusionadas, las asignaturas se juntan en una lista legible', () => {
    const v = varsDeLicencia({
      ...DATOS,
      licencias: [
        { asignatura: 'INGLÉS', libro: 'L1', plataforma: 'Blinklearning', codigo: 'A1B2C3D4' },
        { asignatura: 'RELIGIÓN', libro: 'L2', plataforma: 'EdebeOn+', codigo: 'aa11bb22cc' },
        { asignatura: 'VALENCIÀ', libro: 'L3', plataforma: 'Blinklearning', codigo: 'S3E49B88' },
      ],
    });
    expect(v.asignatura).toBe('INGLÉS, RELIGIÓN y VALENCIÀ');
    expect(v.n).toBe('3');
  });

  it('no repite la plataforma cuando es la misma en todas', () => {
    const v = varsDeLicencia({
      ...DATOS,
      licencias: [
        { asignatura: 'INGLÉS', libro: 'L1', plataforma: 'Blinklearning', codigo: 'A1B2C3D4' },
        { asignatura: 'VALENCIÀ', libro: 'L3', plataforma: 'Blinklearning', codigo: 'S3E49B88' },
      ],
    });
    expect(v.plataforma).toBe('Blinklearning');
  });
});

describe('htmlLicencia', () => {
  it('pone el código donde el gestor escribe {codigo}, en su caja', () => {
    const html = htmlLicencia('Toma: {codigo} y ya está', DATOS);
    expect(html).toContain('XQXN1YG7');
    expect(html).toContain('monospace'); // la caja, no texto suelto
    expect(html).not.toContain('{codigo}');
  });

  it('si la plantilla se queda sin {codigo}, la caja se pone igual al final', () => {
    const html = htmlLicencia('Hola, aquí tienes tu licencia.', DATOS);
    expect(html).toContain('XQXN1YG7');
  });

  it('fusionando, sale una caja por licencia y cada una dice su asignatura', () => {
    const licencias = [
      { asignatura: 'INGLÉS', libro: 'L1', plataforma: 'Blinklearning', codigo: 'A1B2C3D4' },
      { asignatura: 'RELIGIÓN', libro: 'L2', plataforma: 'EdebeOn+', codigo: 'aa11bb22cc' },
    ];
    const html = htmlLicencia('{codigo}', { ...DATOS, licencias });
    expect(html).toContain('A1B2C3D4');
    expect(html).toContain('aa11bb22cc');
    expect(html).toContain('RELIGIÓN');
    expect(cajaCodigos(licencias).match(/font-family:ui-monospace/g)).toHaveLength(2);
  });

  it('el alumno y su clase salen en la ficha del pie', () => {
    const html = htmlLicencia('{codigo}', DATOS);
    expect(html).toContain('Ejemplo Prueba, Ana');
    expect(html).toContain('2ESO A');
  });

  it('no usa flexbox (Gmail lo ignora, ver el bug de "Total51 €")', () => {
    expect(htmlLicencia('{codigo}', DATOS)).not.toContain('display:flex');
  });
});

describe('PLANTILLAS_LICENCIA', () => {
  it('hay una de pago y una del banco, y las dos llevan {codigo} y {asignatura}', () => {
    expect(PLANTILLAS_LICENCIA.map((p) => p.clave).sort()).toEqual(['banco', 'pago']);
    for (const p of PLANTILLAS_LICENCIA) {
      expect(p.body).toContain('{codigo}');
      expect(p.subject).toContain('{asignatura}');
    }
  });

  it('las de fábrica se renderizan enteras, sin variables sin sustituir', () => {
    for (const p of PLANTILLAS_LICENCIA) {
      const html = htmlLicencia(p.body, DATOS);
      expect(html).not.toMatch(/\{[a-z_]+\}/);
      expect(html).toContain('Equipo TIC');
    }
  });
});
