import { describe, expect, it } from 'vitest';
import {
  acumularEventos,
  antiguedadCurso,
  cursoDeClase,
  cursoLimite,
  enLimbo,
  esInborrable,
  candidatosParaBorrar,
  cursoAcademicoDeClase,
  cursoEnNombre,
  esCalendarioSecundario,
  grupoDeCalendario,
  motivoNoBorrable,
  pareceDeClassroom,
  RESUMEN_VACIO,
  type DatosClasificar,
} from '@/lib/calendarios';

const HOY = new Date('2026-09-30T10:00:00Z');

function cal(p: Partial<DatosClasificar> = {}): DatosClasificar {
  return {
    esClassroom: true,
    courseId: '123',
    courseNombre: 'Matemáticas 3ESO A',
    nombre: 'Matemáticas 3ESO A',
    courseCreadoAt: new Date('2026-09-05T08:00:00Z'),
    clasePresente: true,
    primerEventoAt: null,
    ...p,
  };
}

describe('cursoAcademicoDeClase', () => {
  it('corta el 1 de julio: lo creado en verano ya es del curso que viene', () => {
    expect(cursoAcademicoDeClase(new Date('2026-07-15T00:00:00Z'))).toBe('2026-27');
    expect(cursoAcademicoDeClase(new Date('2026-06-30T12:00:00Z'))).toBe('2025-26');
    expect(cursoAcademicoDeClase(new Date('2027-01-10T00:00:00Z'))).toBe('2026-27');
  });
});

describe('cursoEnNombre', () => {
  it('reconoce las formas habituales', () => {
    expect(cursoEnNombre('Música 2024-25')).toBe('2024-25');
    expect(cursoEnNombre('Tutoría 24/25')).toBe('2024-25');
    expect(cursoEnNombre('Inglés 2023-2024')).toBe('2023-24');
    expect(cursoEnNombre('Lengua 25 – 26')).toBe('2025-26');
  });
  it('el formato que pone Classroom en el colegio: «1ESOA (2024/2025)»', () => {
    expect(cursoEnNombre('1ESOA (2024/2025)')).toBe('2024-25');
    expect(cursoEnNombre('Matemáticas 3PRIB (2025/2026)')).toBe('2025-26');
  });
  it('no confunde otros números con un curso', () => {
    expect(cursoEnNombre('Matemáticas 3-4 ESO')).toBeNull();
    expect(cursoEnNombre('Grupo 10-12')).toBeNull();
    expect(cursoEnNombre('Aula 101')).toBeNull();
    expect(cursoEnNombre(null)).toBeNull();
  });
});

describe('esCalendarioSecundario / pareceDeClassroom', () => {
  it('distingue secundarios de principales, festivos y salas', () => {
    expect(esCalendarioSecundario('c_classroomabc123@group.calendar.google.com')).toBe(true);
    expect(esCalendarioSecundario('ana@consolacionburriana.com')).toBe(false);
    expect(esCalendarioSecundario('es.spain#holiday@group.v.calendar.google.com')).toBe(false);
    expect(esCalendarioSecundario('c_188abc@resource.calendar.google.com')).toBe(false);
  });
  it('reconoce los de Classroom por el prefijo', () => {
    expect(pareceDeClassroom('c_classroomabc123@group.calendar.google.com')).toBe(true);
    expect(pareceDeClassroom('c_0f1e2d@group.calendar.google.com')).toBe(false);
  });
});

describe('grupoDeCalendario', () => {
  it('este curso por fecha de creación', () => {
    expect(grupoDeCalendario(cal(), HOY)).toBe('este');
  });
  it('cursos anteriores por fecha de creación', () => {
    expect(grupoDeCalendario(cal({ courseCreadoAt: new Date('2024-09-10T00:00:00Z') }), HOY)).toBe('anteriores');
  });
  it('el nombre manda sobre la fecha (clase vieja reutilizada)', () => {
    expect(
      grupoDeCalendario(cal({ courseNombre: 'Tutoría 2026-27', courseCreadoAt: new Date('2023-09-10T00:00:00Z') }), HOY),
    ).toBe('este');
    expect(grupoDeCalendario(cal({ courseNombre: 'Tutoría 24-25' }), HOY)).toBe('anteriores');
  });
  it('huérfano si la clase ya no existe', () => {
    expect(grupoDeCalendario(cal({ clasePresente: false }), HOY)).toBe('huerfano');
    expect(grupoDeCalendario(cal({ courseId: null }), HOY)).toBe('huerfano');
  });
  it('otro si no es de Classroom', () => {
    expect(grupoDeCalendario(cal({ esClassroom: false }), HOY)).toBe('otro');
  });
});

describe('acumularEventos', () => {
  it('cuenta, ignora cancelados y saca primero, último y futuros', () => {
    const r = acumularEventos(
      RESUMEN_VACIO,
      [
        { start: { dateTime: '2025-10-01T09:00:00+02:00' } },
        { start: { date: '2026-11-20' } },
        { status: 'cancelled', start: { date: '2030-01-01' } },
        { start: null },
      ],
      HOY,
    );
    expect(r.total).toBe(3);
    expect(r.futuros).toBe(1);
    expect(r.primero?.toISOString()).toBe('2025-10-01T07:00:00.000Z');
    expect(r.ultimo?.toISOString()).toBe('2026-11-20T00:00:00.000Z');
  });
  it('se puede ir acumulando página a página', () => {
    const a = acumularEventos(RESUMEN_VACIO, [{ start: { date: '2026-01-01' } }], HOY);
    const b = acumularEventos(a, [{ start: { date: '2025-01-01' } }], HOY);
    expect(b.total).toBe(2);
    expect(b.primero?.toISOString()).toBe('2025-01-01T00:00:00.000Z');
  });
});

describe('borrado', () => {
  it('sin propietario conocido no se puede', () => {
    expect(motivoNoBorrable({ borradoAt: null, propietarios: [], courseOwnerEmail: null, borradoError: null })).toMatch(/propietario/);
    expect(motivoNoBorrable({ borradoAt: null, propietarios: [], courseOwnerEmail: 'profe@x.com', borradoError: null })).toBeNull();
    expect(motivoNoBorrable({ borradoAt: '2026-09-30', propietarios: ['a@x.com'], courseOwnerEmail: null, borradoError: null })).toMatch(/borrado/);
  });
  it('candidatos: los owner vistos y detrás el dueño de la clase, sin repetir', () => {
    expect(candidatosParaBorrar(['a@x.com'], 'b@x.com')).toEqual(['a@x.com', 'b@x.com']);
    expect(candidatosParaBorrar(['a@x.com'], 'a@x.com')).toEqual(['a@x.com']);
    expect(candidatosParaBorrar([], null)).toEqual([]);
  });
});

describe('antigüedad de las clases', () => {
  it('cuenta cursos hacia atrás desde el actual (2026-27)', () => {
    expect(antiguedadCurso('2026-27', HOY)).toBe(0);
    expect(antiguedadCurso('2023-24', HOY)).toBe(3);
    expect(antiguedadCurso(null, HOY)).toBeNull();
  });
  it('«3 años o más» llega hasta el 2023-24', () => {
    expect(cursoLimite(3, HOY)).toBe('2023-24');
    expect(cursoLimite(1, HOY)).toBe('2025-26');
  });
  it('el curso de una clase sale del nombre y, si no, de la fecha', () => {
    expect(cursoDeClase('1ESOA (2022/2023)', new Date('2025-09-01T00:00:00Z'))).toBe('2022-23');
    expect(cursoDeClase('Robótica', new Date('2023-10-01T00:00:00Z'))).toBe('2023-24');
    expect(cursoDeClase('Robótica', null)).toBeNull();
  });
});

describe('enLimbo', () => {
  it('falló el borrado y no hay ningún dueño activo', () => {
    expect(enLimbo({ borradoAt: null, borradoError: 'x: no es el propietario', propietarios: [] })).toBe(true);
    expect(
      motivoNoBorrable({ borradoAt: null, borradoError: 'x', propietarios: [], courseOwnerEmail: 'profe@x.com' }),
    ).toMatch(/ninguna cuenta activa/);
  });
  it('no, si hay un dueño visto (puede ser un fallo puntual) o si nunca se intentó', () => {
    expect(enLimbo({ borradoAt: null, borradoError: 'x', propietarios: ['a@x.com'] })).toBe(false);
    expect(enLimbo({ borradoAt: null, borradoError: null, propietarios: [] })).toBe(false);
    expect(enLimbo({ borradoAt: '2026-09-30', borradoError: 'x', propietarios: [] })).toBe(false);
  });
});

describe('esInborrable', () => {
  const base = { borradoAt: null, borradoError: null, propietarios: [] as string[], courseOwnerEmail: null };
  it('sin ningún dueño conocido, aunque no se haya intentado', () => {
    expect(esInborrable(base)).toBe(true);
  });
  it('el limbo también', () => {
    expect(esInborrable({ ...base, borradoError: 'x', courseOwnerEmail: 'profe@x.com' })).toBe(true);
  });
  it('no, si hay a quién suplantar y no ha fallado, o si ya está borrado', () => {
    expect(esInborrable({ ...base, courseOwnerEmail: 'profe@x.com' })).toBe(false);
    expect(esInborrable({ ...base, propietarios: ['a@x.com'] })).toBe(false);
    expect(esInborrable({ ...base, borradoAt: '2026-09-30' })).toBe(false);
  });
});
