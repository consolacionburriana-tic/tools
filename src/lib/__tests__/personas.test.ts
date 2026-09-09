import { describe, expect, it } from 'vitest';
import {
  correoBonito,
  mayusculasBellas,
  nombreDePila,
  nombresDe,
  pareceMalEscrito,
} from '@/lib/personas';
import { limpiarAbreviatura } from '@/lib/cuaderno-server';
import { nombreProfe, nombreProfeBreve, pilaProfe } from '@/lib/profes';

// Los nombres de estas pruebas son inventados salvo el patrón que los motiva (el export de
// Educamos llega todo en mayúsculas). Nunca datos reales de alumnado.

describe('mayusculasBellas', () => {
  it('arregla lo que viene a gritos del export', () => {
    expect(mayusculasBellas('CARLOS ANDRES VALERO AICART')).toBe('Carlos Andres Valero Aicart');
    expect(mayusculasBellas('aitana ros')).toBe('Aitana Ros');
  });

  it('deja en minúscula las partículas de en medio, no las de los extremos', () => {
    expect(mayusculasBellas('MARIA DE LA FUENTE')).toBe('Maria de la Fuente');
    expect(mayusculasBellas('DE LA FUENTE PONS')).toBe('De la Fuente Pons');
    expect(mayusculasBellas('MARTI I PONS')).toBe('Marti i Pons');
  });

  it('capitaliza los dos lados de un guion o un apóstrofe', () => {
    expect(mayusculasBellas('MARIA-JOSE SANZ')).toBe('Maria-Jose Sanz');
    expect(mayusculasBellas("O'CONNOR MAS")).toBe("O'Connor Mas");
  });

  it('no toca un nombre que ya está bien escrito', () => {
    expect(mayusculasBellas('María de la O')).toBe('María de la O');
    expect(mayusculasBellas('van Gogh')).toBe('van Gogh');
    expect(mayusculasBellas('McCarthy Ros')).toBe('McCarthy Ros');
  });

  it('no se inventa acentos: lo que no venía con tilde sigue sin ella', () => {
    expect(mayusculasBellas('JOSE MARIA')).toBe('Jose Maria');
  });

  it('quita los espacios de sobra y aguanta lo vacío', () => {
    expect(mayusculasBellas('  ANA   ROS  ')).toBe('Ana Ros');
    expect(mayusculasBellas(null)).toBe('');
    expect(mayusculasBellas('')).toBe('');
  });
});

describe('pareceMalEscrito', () => {
  it('solo es cierto para todo mayúsculas o todo minúsculas', () => {
    expect(pareceMalEscrito('ANA ROS')).toBe(true);
    expect(pareceMalEscrito('ana ros')).toBe(true);
    expect(pareceMalEscrito('Ana Ros')).toBe(false);
    expect(pareceMalEscrito('123 —')).toBe(false); // sin letras no hay nada que arreglar
  });
});

describe('correoBonito', () => {
  it('minúsculas y sin espacios', () => {
    expect(correoBonito('  ANA.ROS@Consolacionburriana.COM ')).toBe('ana.ros@consolacionburriana.com');
    expect(correoBonito(null)).toBe('');
  });
});

describe('nombreDePila', () => {
  it('corta el segundo nombre cuando no forma compuesto (el caso que motivó esto)', () => {
    expect(nombreDePila('CARLOS ANDRES')).toBe('Carlos');
    expect(nombreDePila('AITANA')).toBe('Aitana');
  });

  it('mantiene los compuestos de siempre', () => {
    expect(nombreDePila('MARIA JOSE')).toBe('Maria Jose');
    expect(nombreDePila('JUAN CARLOS')).toBe('Juan Carlos');
    expect(nombreDePila('ANA BELEN')).toBe('Ana Belen');
  });

  it('la partícula arrastra la palabra de detrás', () => {
    expect(nombreDePila('MARIA DEL CARMEN')).toBe('Maria del Carmen');
  });

  it('aguanta lo vacío', () => {
    expect(nombreDePila(null)).toBe('');
  });
});

describe('nombresDe', () => {
  const carlos = { nombre: 'CARLOS ANDRES', apellido1: 'VALERO', apellido2: 'AICART' };

  it('escribe los cuatro nombres de una persona', () => {
    expect(nombresDe(carlos)).toEqual({
      completo: 'Carlos Andres Valero Aicart',
      usual: 'Carlos Valero Aicart',
      corto: 'Carlos V',
      pila: 'Carlos',
      apellidos: 'Valero Aicart',
    });
  });

  it('el nombre de pila puesto a mano manda sobre la heurística', () => {
    const pepe = nombresDe({ nombre: 'JOSE MANUEL', apellido1: 'ROS', apellido2: null }, { pila: 'Pepe' });
    expect(pepe.usual).toBe('Pepe Ros');
    expect(pepe.corto).toBe('Pepe R');
    expect(pepe.completo).toBe('Jose Manuel Ros'); // el entero sigue siendo el del export
  });

  it('el nombre completo puesto a mano manda sobre todo', () => {
    const sor = nombresDe(carlos, { completo: 'Sor Ángeles' });
    expect(sor.usual).toBe('Sor Ángeles');
  });

  it('un nombre a mano en blanco no cuenta como puesto', () => {
    expect(nombresDe(carlos, { pila: '  ', completo: '' }).usual).toBe('Carlos Valero Aicart');
  });

  it('aguanta a quien no tiene apellidos, o no existe', () => {
    expect(nombresDe({ nombre: 'PAOLA', apellido1: null, apellido2: null }).usual).toBe('Paola');
    expect(nombresDe(null)).toEqual({ completo: '', usual: '', corto: '', pila: '', apellidos: '' });
  });
});

describe('limpiarAbreviatura', () => {
  it('le quita el dígito de nivel que trae Untis', () => {
    expect(limpiarAbreviatura('MAT1')).toBe('MAT');
    expect(limpiarAbreviatura('EFI3')).toBe('EFI');
    expect(limpiarAbreviatura('LEN1')).toBe('LEN');
  });

  it('no deja un código de una letra: antes eso que nada', () => {
    expect(limpiarAbreviatura('LU')).toBe('LU');
    expect(limpiarAbreviatura('E1')).toBe('E1'); // quitarle el 1 dejaría solo «E»
  });

  it('aguanta lo vacío', () => {
    expect(limpiarAbreviatura(null)).toBeNull();
    expect(limpiarAbreviatura('  ')).toBeNull();
  });
});

describe('el nombre visible del profesorado (given name)', () => {
  const pepe = { nombre: 'JOSE MANUEL', apellido1: 'SANCHEZ', apellido2: 'GIL', nombreMostrado: 'Pepe' };

  it('el nombre escrito a mano manda sobre lo que diga Educamos', () => {
    expect(pilaProfe(pepe)).toBe('Pepe');
    expect(nombreProfe(pepe)).toBe('Pepe Sanchez Gil');
    expect(nombreProfeBreve(pepe)).toBe('Pepe Sanchez');
    // Los apellidos no se tocan: solo se arregla el nombre de pila.
    expect(nombresDe(pepe).completo).toBe('Jose Manuel Sanchez Gil');
  });

  it('sin nombre a mano se usa la heurística de siempre', () => {
    // «Jose Manuel» es justo el caso que motiva el given name: la heurística respeta el
    // compuesto (no puede saber que a esta persona la llaman «Pepe»).
    const sinMano = { ...pepe, nombreMostrado: null };
    expect(pilaProfe(sinMano)).toBe('Jose Manuel');
    expect(nombreProfe(sinMano)).toBe('Jose Manuel Sanchez Gil');
    expect(nombreProfe({ ...sinMano, nombreMostrado: '   ' })).toBe('Jose Manuel Sanchez Gil');
    expect(pilaProfe({ nombre: 'CARLOS ANDRES', apellido1: 'VALERO', apellido2: null })).toBe('Carlos');
  });

  it('lo que se fija para un módulo (cuad_personas) sigue ganando al de la ficha', () => {
    expect(nombresDe(pepe, { pila: 'Josep' }).usual).toBe('Josep Sanchez Gil');
  });

  it('aguanta a quien no está', () => {
    expect(nombreProfe(null)).toBe('');
    expect(pilaProfe(undefined)).toBe('');
  });
});
