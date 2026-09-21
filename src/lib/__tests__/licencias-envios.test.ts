import { describe, expect, it } from 'vitest';
import {
  FILTROS_INICIALES,
  compararLicencias,
  filtrarLicencias,
  librosDe,
  librosDistintos,
  ordenNatural,
  resumir,
  type Filtros,
  type LicenciaFila,
} from '@/lib/licencias-envios';

// Alumnado inventado con la forma del real.
let n = 0;
function fila(p: Partial<LicenciaFila> = {}): LicenciaFila {
  n += 1;
  return {
    id: `id-${n}`,
    tipo: 'pago',
    curso: '2ESO',
    cod: '2ESO-ING',
    studentId: `alu-${n}`,
    alumno: 'Ejemplo Prueba, Ana',
    apellidos: 'Ejemplo Prueba',
    nombre: 'Ana',
    letra: 'A',
    asignatura: 'INGLÉS',
    libro: 'Libro de prueba 3 SB',
    editorial: 'Cambridge',
    plataforma: 'Blinklearning',
    isbn: '9788490369340',
    codigo: null,
    estado: 'pendiente',
    enviadoAt: null,
    enviadoA: null,
    descartadoAt: null,
    descartadoMotivo: null,
    error: null,
    destinatario: 'ana@ejemplo.test',
    correoAlumno: 'ana@ejemplo.test',
    correoFamilia: null,
    nota: null,
    ...p,
  };
}

const filtros = (p: Partial<Filtros> = {}): Filtros => ({ ...FILTROS_INICIALES, tipo: 'pago', ...p });

describe('resumir', () => {
  it('cuenta lo que hace falta para decidir qué hacer', () => {
    const filas = [
      fila(), //                                             sin código
      fila({ codigo: 'AAAA1111' }), //                       lista para enviar
      fila({ codigo: 'BBBB2222', estado: 'enviado', enviadoAt: '2026-09-20T10:00:00Z' }),
      fila({ codigo: 'CCCC3333', estado: 'error', error: 'rebotó' }),
      fila({ codigo: 'DDDD4444', destinatario: null, correoAlumno: null }), // sin correo
    ];
    const r = resumir(filas, 'pago');
    expect(r.total).toBe(5);
    expect(r.sinCodigo).toBe(1);
    expect(r.conCodigo).toBe(4);
    expect(r.enviadas).toBe(1);
    expect(r.listasParaEnviar).toBe(2); // la de error se puede reintentar; la sin correo no
    expect(r.sinCorreo).toBe(1);
  });

  it('las descartadas y los sobrantes no inflan el total', () => {
    const filas = [
      fila(),
      fila({ descartadoAt: '2026-09-01T00:00:00Z', descartadoMotivo: 'no cursa la optativa' }),
      fila({ studentId: null, alumno: '', codigo: 'SOBRA111' }),
    ];
    const r = resumir(filas, 'pago');
    expect(r.total).toBe(1);
    expect(r.descartadas).toBe(1);
    expect(r.sobrantes).toBe(1);
  });

  it('no mezcla las de pago con las del banco: son dos mundos separados', () => {
    const filas = [fila({ tipo: 'pago' }), fila({ tipo: 'banco' }), fila({ tipo: 'banco' })];
    expect(resumir(filas, 'pago').total).toBe(1);
    expect(resumir(filas, 'banco').total).toBe(2);
  });
});

describe('filtrarLicencias', () => {
  const filas = [
    fila({ curso: '1ESO', cod: '1ESO-ING', letra: 'A', alumno: 'Alonso Ruiz, Berta' }),
    fila({ curso: '1ESO', cod: '1ESO-ING', letra: 'B', alumno: 'Bosch Vila, Carla' }),
    fila({ curso: '2ESO', cod: '2ESO-ING', letra: 'A', alumno: 'Costa Mir, Dani' }),
    fila({ curso: '2ESO', cod: '2ESO-REL', letra: 'A', asignatura: 'RELIGIÓN', editorial: 'Edebé' }),
  ];

  it('filtra por curso, que es lo que se hace todo el rato', () => {
    expect(filtrarLicencias(filas, filtros({ curso: '1ESO' }))).toHaveLength(2);
  });

  it('filtra por clase, por libro y por editorial', () => {
    expect(filtrarLicencias(filas, filtros({ clase: 'B' }))).toHaveLength(1);
    expect(filtrarLicencias(filas, filtros({ libro: '2ESO|2ESO-REL' }))).toHaveLength(1);
    expect(filtrarLicencias(filas, filtros({ editorial: 'Edebé' }))).toHaveLength(1);
  });

  it('busca por alumno y también por código', () => {
    const conCodigo = [...filas, fila({ alumno: 'Zafra Gil, Eva', codigo: 'XQXN1YG7' })];
    expect(filtrarLicencias(conCodigo, filtros({ q: 'bosch' }))).toHaveLength(1);
    expect(filtrarLicencias(conCodigo, filtros({ q: 'XQXN1YG7' }))).toHaveLength(1);
  });

  it('la búsqueda ignora acentos y mayúsculas', () => {
    const conTilde = [fila({ alumno: 'Muñoz Pérez, Carla' })];
    expect(filtrarLicencias(conTilde, filtros({ q: 'perez' }))).toHaveLength(1);
  });

  it('los sobrantes nunca salen en la tabla: tienen su propia sección', () => {
    const conSobrante = [...filas, fila({ studentId: null, alumno: '', codigo: 'SOBRA111' })];
    expect(filtrarLicencias(conSobrante, filtros())).toHaveLength(4);
  });

  it('las descartadas se esconden salvo que se pidan', () => {
    const conDescarte = [...filas, fila({ descartadoAt: '2026-09-01T00:00:00Z' })];
    expect(filtrarLicencias(conDescarte, filtros())).toHaveLength(4);
    expect(filtrarLicencias(conDescarte, filtros({ estado: 'descartadas' }))).toHaveLength(1);
  });

  it('«listas para enviar» deja fuera las que no tienen a dónde ir', () => {
    const lista = [
      fila({ codigo: 'AAAA1111' }),
      fila({ codigo: 'BBBB2222', destinatario: null }),
      fila({ codigo: 'CCCC3333', estado: 'enviado' }),
    ];
    expect(filtrarLicencias(lista, filtros({ estado: 'listas' }))).toHaveLength(1);
    expect(filtrarLicencias(lista, filtros({ estado: 'sin-correo' }))).toHaveLength(1);
  });
});

describe('orden', () => {
  it('el natural va por curso escolar, no alfabético (5PRI antes que 1ESO)', () => {
    const filas = [fila({ curso: '1ESO' }), fila({ curso: '5PRI' }), fila({ curso: '4ESO' })];
    expect([...filas].sort(ordenNatural).map((f) => f.curso)).toEqual(['5PRI', '1ESO', '4ESO']);
  });

  it('dentro del curso, por clase y luego por apellidos', () => {
    const filas = [
      fila({ curso: '2ESO', letra: 'B', alumno: 'Alonso Ruiz, Berta' }),
      fila({ curso: '2ESO', letra: 'A', alumno: 'Zafra Gil, Eva' }),
      fila({ curso: '2ESO', letra: 'A', alumno: 'Bosch Vila, Carla' }),
    ];
    expect([...filas].sort(ordenNatural).map((f) => f.alumno)).toEqual([
      'Bosch Vila, Carla',
      'Zafra Gil, Eva',
      'Alonso Ruiz, Berta',
    ]);
  });

  it('por código pone primero las que faltan, que es a lo que se viene', () => {
    const filas = [fila({ codigo: 'AAAA1111' }), fila({ codigo: null }), fila({ codigo: 'BBBB2222' })];
    const ordenadas = [...filas].sort((a, b) => compararLicencias(a, b, 'codigo'));
    expect(ordenadas[0].codigo).toBeNull();
  });
});

describe('librosDe', () => {
  it('agrupa por (curso, cod) y cuenta lo que falta', () => {
    const filas = [
      fila({ curso: '1ESO', cod: '1ESO-ING' }),
      fila({ curso: '1ESO', cod: '1ESO-ING', codigo: 'AAAA1111' }),
      fila({ curso: '2ESO', cod: '2ESO-ING' }),
    ];
    const libros = librosDe(filas);
    expect(libros).toHaveLength(2);
    const primero = libros.find((l) => l.clave === '1ESO|1ESO-ING');
    expect(primero).toMatchObject({ total: 2, pendientes: 1 });
  });

  it('el mismo código en dos cursos son DOS libros (3ESO-REL está en 3ESO y en 3PDC)', () => {
    const filas = [fila({ curso: '3ESO', cod: '3ESO-REL' }), fila({ curso: '3PDC', cod: '3ESO-REL' })];
    expect(librosDe(filas)).toHaveLength(2);
  });
});

describe('librosDistintos', () => {
  it('avisa de que el filtro mezcla libros (pegar ahí reparte los códigos mal)', () => {
    const mezcla = [fila({ cod: '2ESO-ING' }), fila({ cod: '2ESO-REL' })];
    expect(librosDistintos(mezcla)).toHaveLength(2);
  });

  it('con un solo libro, pegar es seguro', () => {
    expect(librosDistintos([fila(), fila()])).toEqual(['2ESO|2ESO-ING']);
  });
});
