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
