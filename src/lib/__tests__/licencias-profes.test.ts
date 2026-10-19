import { describe, expect, it } from 'vitest';
import {
  analizarPegadoProfes,
  asuntoLicenciaProfe,
  cuerpoLicenciaProfe,
  filtrarProfes,
  normalizarBusqueda,
  separarConflictos,
  type ProfeOpcion,
} from '@/lib/licencias-profes';

// Datos inventados con la forma de los reales.
const profe = (id: string, nombre: string, email: string | null = null): ProfeOpcion => ({
  id,
  nombre,
  email,
  busca: normalizarBusqueda(`${nombre} ${email ?? ''}`),
});
const PROFES = [
  profe('1', 'José Martínez Gil', 'jmartinez@colegio.test'),
  profe('2', 'Lucía Pérez Ros', 'lperez@colegio.test'),
  profe('3', 'Carlos Valero Aicart'),
];

describe('pegado de códigos para profes', () => {
  it('saca una columna de códigos, sin vacíos ni cabecera', () => {
    expect(analizarPegadoProfes('Licencia\nZGU6DX67\n\n  A2EAAXW7  \n')).toEqual({
      codigos: ['ZGU6DX67', 'A2EAAXW7'],
      repetidos: [],
    });
  });

  it('con dos columnas copiadas del Excel elige la de los códigos', () => {
    const texto = 'Título\tLicencia\nInglés 3º\tCGJC-CDAF-S9S4-UWRR\nInglés 3º\tCGKY-ZBCN-USTE-YYXT';
    expect(analizarPegadoProfes(texto).codigos).toEqual(['CGJC-CDAF-S9S4-UWRR', 'CGKY-ZBCN-USTE-YYXT']);
  });

  it('un repetido se queda una vez y se avisa', () => {
    const r = analizarPegadoProfes('ZGU6DX67\nA2EAAXW7\nZGU6DX67');
    expect(r.codigos).toEqual(['ZGU6DX67', 'A2EAAXW7']);
    expect(r.repetidos).toEqual([{ codigo: 'ZGU6DX67', veces: 2 }]);
  });

  it('vacío no da nada', () => {
    expect(analizarPegadoProfes('  \n ')).toEqual({ codigos: [], repetidos: [] });
  });
});

describe('conflictos con lo ya anotado', () => {
  it('no pisa: lo que ya está en la campaña sale como conflicto y dice dónde', () => {
    const usados = new Map([
      ['A2EAAXW7', 'de Lucía Pérez (1ºESO)'],
      ['YJBLYWR7', 'en el almacén de sobrantes'],
    ]);
    expect(separarConflictos(['ZGU6DX67', 'A2EAAXW7', 'YJBLYWR7'], usados)).toEqual({
      nuevos: ['ZGU6DX67'],
      conflictos: [
        { codigo: 'A2EAAXW7', donde: 'de Lucía Pérez (1ºESO)' },
        { codigo: 'YJBLYWR7', donde: 'en el almacén de sobrantes' },
      ],
    });
  });
});

describe('buscador de profes', () => {
  it('sin acentos, en cualquier orden, y por correo', () => {
    expect(filtrarProfes(PROFES, 'jose').map((p) => p.id)).toEqual(['1']);
    expect(filtrarProfes(PROFES, 'ros lucia').map((p) => p.id)).toEqual(['2']);
    expect(filtrarProfes(PROFES, 'lperez@').map((p) => p.id)).toEqual(['2']);
    expect(filtrarProfes(PROFES, '').length).toBe(3);
    expect(filtrarProfes(PROFES, 'nadie')).toEqual([]);
  });
});

describe('correo al profe', () => {
  it('con libro lo nombra; sin libro, genérico', () => {
    expect(asuntoLicenciaProfe('Inglés 3ºESO')).toBe('[Licencia Digital 📘] Licencia Inglés 3ºESO');
    expect(asuntoLicenciaProfe('  ')).toBe('[Licencia Digital 📘] Tu licencia digital');
  });

  it('el cuerpo saluda por el nombre y lleva el hueco del código', () => {
    const cuerpo = cuerpoLicenciaProfe('Lucía', 'Inglés 3ºESO');
    expect(cuerpo).toContain('Hola Lucía,');
    expect(cuerpo).toContain('<b>Inglés 3ºESO</b>');
    expect(cuerpo).toContain('{codigo}');
    expect(cuerpoLicenciaProfe('', null)).toContain('Hola,');
  });
});
