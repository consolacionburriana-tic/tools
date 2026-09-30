import { describe, expect, it } from 'vitest';
import {
  acumularEventos,
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
    expect(motivoNoBorrable({ borradoAt: null, propietarios: [], courseOwnerEmail: null })).toMatch(/propietario/);
    expect(motivoNoBorrable({ borradoAt: null, propietarios: [], courseOwnerEmail: 'profe@x.com' })).toBeNull();
    expect(motivoNoBorrable({ borradoAt: '2026-09-30', propietarios: ['a@x.com'], courseOwnerEmail: null })).toMatch(/borrado/);
  });
  it('candidatos: los owner vistos y detrás el dueño de la clase, sin repetir', () => {
    expect(candidatosParaBorrar(['a@x.com'], 'b@x.com')).toEqual(['a@x.com', 'b@x.com']);
    expect(candidatosParaBorrar(['a@x.com'], 'a@x.com')).toEqual(['a@x.com']);
    expect(candidatosParaBorrar([], null)).toEqual([]);
  });
});
