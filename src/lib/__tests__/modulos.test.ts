import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { herramientasDe, type ContextoEscritorio } from '@/lib/escritorio';
import { MODULOS } from '@/lib/modulos';

const CTX: ContextoEscritorio = { oratoriosComun: true, nouvinguts: null, dispositivosSinInformar: null, tableros: null };

describe('identidad de los módulos (cabecera común)', () => {
  it('cada módulo sale en la cabecera con el mismo icono y el mismo grupo que en el escritorio', () => {
    const escritorio = herramientasDe({ role: 'supertic' }, CTX);
    for (const [clave, m] of Object.entries(MODULOS)) {
      const h = escritorio.find((x) => x.href === m.href);
      if (!h) continue; // Puntualidad (apagado) y el escaparate de diseño no están en el escritorio
      expect({ clave, icono: m.icono, grupo: m.grupo }).toEqual({ clave, icono: h.icono, grupo: h.grupo });
    }
  });

  it('la portada de cada módulo es una ruta que existe', () => {
    for (const m of Object.values(MODULOS)) {
      const ruta = m.href.startsWith('/gestion')
        ? join('src/app', m.href, 'page.tsx')
        : join('src/app/(public)', m.href, 'page.tsx');
      expect(existsSync(ruta), ruta).toBe(true);
    }
  });
});
