import { describe, expect, it } from 'vitest';
import {
  analizarPegado,
  codigosDeColumna,
  duplicadosEn,
  elegirColumna,
  emparejar,
  esCabecera,
  limpiarCodigo,
  pareceCodigo,
  pareceIsbn,
} from '@/lib/licencias-codigos';

// Códigos inventados con la FORMA de los reales (nunca recortes de ficheros con datos reales).
const CAMBRIDGE = ['ZGU6DX67', 'A2EAAXW7', 'YJBLYWR7'];
const ANAYA = ['CGJC-CDAF-S9S4-UWRR', 'CGKY-ZBCN-USTE-YYXT'];
const SM = ['D6F2W-1W1SM-AJGXD', 'DT74X-HJYSM-AZ18D'];
const EDEBE = ['8354033acd', '1a36b87b9e'];
const BROMERA = ['S3E49B88', 'Z6K6H7H8'];

describe('pareceCodigo', () => {
  it('reconoce las formas de las cinco editoriales', () => {
    for (const c of [...CAMBRIDGE, ...ANAYA, ...SM, ...EDEBE, ...BROMERA]) {
      expect(pareceCodigo(c), c).toBe(true);
    }
  });

  it('descarta ISBN, títulos y celdas de relleno', () => {
    expect(pareceCodigo('9788490369340')).toBe(false); // ISBN de 13
    expect(pareceCodigo('978-84-683-6461-2')).toBe(false); // ISBN con guiones
    expect(pareceCodigo('Prepare 2nd 3 SB')).toBe(false); // lleva espacios
    expect(pareceCodigo('')).toBe(false);
    expect(pareceCodigo('Std')).toBe(false); // demasiado corto
  });

  it('pareceIsbn no confunde un código de Cambridge con un ISBN', () => {
    expect(pareceIsbn('9788413221076')).toBe(true);
    expect(pareceIsbn('ZGU6DX67')).toBe(false);
  });
});

describe('limpiarCodigo', () => {
  it('quita el relleno que mete Excel sin tocar la caja', () => {
    expect(limpiarCodigo('  ZGU6DX67  ')).toBe('ZGU6DX67');
    expect(limpiarCodigo(' 8354033acd​')).toBe('8354033acd'); // Edebé va en minúsculas
  });
});

describe('esCabecera', () => {
  it('reconoce las cabeceras que se copian sin querer', () => {
    expect(esCabecera('Licencia Activación')).toBe(true);
    expect(esCabecera('Code')).toBe(true);
    expect(esCabecera('CÓDIGO')).toBe(true);
    expect(esCabecera('ZGU6DX67')).toBe(false);
  });
});

describe('analizarPegado', () => {
  it('una columna pegada de Excel, un código por línea', () => {
    const r = analizarPegado(CAMBRIDGE.join('\r\n'));
    expect(r.codigos).toEqual(CAMBRIDGE);
    expect(r.columnaSugerida).toBe(0);
  });

  it('se come la cabecera si viene en el pegado', () => {
    expect(analizarPegado(['Licencia Activación', ...ANAYA].join('\n')).codigos).toEqual(ANAYA);
  });

  it('ignora líneas en blanco y espacios sueltos', () => {
    expect(analizarPegado(`\n ${SM[0]} \n\n${SM[1]}\n  \n`).codigos).toEqual(SM);
  });

  it('con varias columnas elige la de los códigos, no la del título ni la del ISBN', () => {
    const texto = [
      'Nombre Producto\tLicencias Alumno\tISBN',
      `SDA Français A2.2\t${SM[0]}\t9788498564693`,
      `SDA Français A2.2\t${SM[1]}\t9788498564693`,
    ].join('\n');
    const r = analizarPegado(texto);
    expect(r.columnaSugerida).toBe(1);
    expect(r.codigos).toEqual(SM);
  });

  it('deja elegir otra columna a mano', () => {
    const r = analizarPegado(`Guess What\t${CAMBRIDGE[0]}\nGuess What\t${CAMBRIDGE[1]}`);
    expect(codigosDeColumna(r.columnas, 0)).toEqual(['Guess What', 'Guess What']);
  });

  it('al forzar una columna, una cabecera desconocida no se cuela como código', () => {
    const texto = ['Referencia\tClau', `REF-00001\t${BROMERA[0]}`, `REF-00002\t${BROMERA[1]}`].join('\n');
    const r = analizarPegado(texto);
    expect(r.codigos).toEqual(BROMERA); // la columna buena, sin su cabecera
    // Forzar una columna que no son códigos la devuelve entera, cabecera incluida: ahí avisa
    // la vista previa, no el adivinador.
    expect(codigosDeColumna(r.columnas, 0)).toEqual(['Referencia', 'REF-00001', 'REF-00002']);
  });

  it('texto vacío no revienta', () => {
    expect(analizarPegado('').codigos).toEqual([]);
    expect(analizarPegado('   \n \n').codigos).toEqual([]);
  });
});

describe('elegirColumna', () => {
  it('con dos columnas de códigos gana la de la izquierda', () => {
    const filas = [
      [CAMBRIDGE[0], BROMERA[0]],
      [CAMBRIDGE[1], BROMERA[1]],
    ];
    expect(elegirColumna(filas)).toBe(0);
  });

  it('si ninguna tiene pinta de código, gana la que más valores distintos tenga', () => {
    const filas = [
      ['Alumno uno', 'lo que sea 1'],
      ['Alumno uno', 'lo que sea 2'],
      ['Alumno uno', 'lo que sea 3'],
    ];
    expect(elegirColumna(filas)).toBe(1);
  });
});

describe('duplicadosEn', () => {
  it('avisa del código repetido dentro del propio pegado', () => {
    expect(duplicadosEn([CAMBRIDGE[0], CAMBRIDGE[1], CAMBRIDGE[0]])).toEqual([
      { codigo: CAMBRIDGE[0], veces: 2 },
    ]);
    expect(duplicadosEn(CAMBRIDGE)).toEqual([]);
  });
});

describe('emparejar', () => {
  const huecos = [
    { id: 'a', alumno: 'Alumna A', curso: '2ESO' },
    { id: 'b', alumno: 'Alumno B', curso: '2ESO' },
    { id: 'c', alumno: 'Alumna C', curso: '2ESO' },
  ];

  it('empareja en el orden recibido, sin reordenar nada', () => {
    const r = emparejar(huecos, CAMBRIDGE);
    expect(r.parejas.map((p) => [p.hueco.id, p.codigo])).toEqual([
      ['a', CAMBRIDGE[0]],
      ['b', CAMBRIDGE[1]],
      ['c', CAMBRIDGE[2]],
    ]);
    expect(r.sinCodigo).toEqual([]);
    expect(r.sobrantes).toEqual([]);
  });

  it('faltan códigos: los alumnos de abajo se quedan pendientes', () => {
    const r = emparejar(huecos, CAMBRIDGE.slice(0, 2));
    expect(r.parejas).toHaveLength(2);
    expect(r.sinCodigo.map((h) => h.id)).toEqual(['c']);
    expect(r.sobrantes).toEqual([]);
  });

  it('sobran códigos: los de más van al almacén', () => {
    const r = emparejar(huecos.slice(0, 1), CAMBRIDGE);
    expect(r.parejas).toHaveLength(1);
    expect(r.sinCodigo).toEqual([]);
    expect(r.sobrantes).toEqual([CAMBRIDGE[1], CAMBRIDGE[2]]);
  });

  it('sin huecos, todo sobra (llegaron licencias de un libro que nadie pidió)', () => {
    expect(emparejar([], CAMBRIDGE).sobrantes).toEqual(CAMBRIDGE);
  });
});
