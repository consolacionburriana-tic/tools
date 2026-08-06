import { describe, expect, it } from 'vitest';

// Caracteriza el cálculo de total de pedido, duplicado hoy en dos sitios de
// src/lib/licencias-server.ts: upsertOrder (~línea 476-477) y
// updateOrderItemsAdmin (~línea 635-636). Misma expresión exacta en ambos:
//
//   const valid = cods.filter((c) => byCod.has(c));
//   const total = valid.reduce((sum, c) => sum + parseFloat(byCod.get(c)!.precio || '0'), 0);
//   const totalStr = total.toFixed(2);
//
// Este test pinnea el comportamiento actual sobre un catálogo inventado para
// poder extraer la función compartida `totalPedido` sin cambiar el resultado.
function totalPedidoInline(cods: string[], byCod: Map<string, { precio: string | null }>) {
  const valid = cods.filter((c) => byCod.has(c));
  const total = valid.reduce((sum, c) => sum + parseFloat(byCod.get(c)!.precio || '0'), 0);
  return { valid, total, totalStr: total.toFixed(2) };
}

const catalogo = new Map<string, { precio: string | null }>([
  ['MAT3-CAS', { precio: '12.50' }],
  ['FIS3-CAS', { precio: '3.95' }],
  ['REL3', { precio: '0.05' }],
  ['GRATIS3', { precio: null }],
]);

describe('cálculo del total de pedido (licencias)', () => {
  it('sin códigos seleccionados, el total es 0', () => {
    expect(totalPedidoInline([], catalogo)).toEqual({ valid: [], total: 0, totalStr: '0.00' });
  });

  it('los códigos que no están en el catálogo se filtran sin romper', () => {
    const r = totalPedidoInline(['MAT3-CAS', 'NO-EXISTE'], catalogo);
    expect(r.valid).toEqual(['MAT3-CAS']);
    expect(r.totalStr).toBe('12.50');
  });

  it('un precio null cuenta como 0', () => {
    expect(totalPedidoInline(['GRATIS3'], catalogo).totalStr).toBe('0.00');
  });

  it('suma varios precios en coma flotante y redondea a 2 decimales', () => {
    expect(totalPedidoInline(['MAT3-CAS', 'FIS3-CAS', 'REL3'], catalogo).totalStr).toBe('16.50');
  });
});
