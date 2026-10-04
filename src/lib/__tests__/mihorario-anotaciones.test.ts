import { describe, expect, it } from 'vitest';

import {
  borrarAnotacionSchema,
  crearAnotacionSchema,
  editarAnotacionSchema,
  OPCIONES_ANOTACION,
  opcionDeActividad,
} from '../mihorario-anotaciones';

const UUID = '3f2b8c1e-5a4d-4b7e-9c10-a1b2c3d4e5f6';

describe('anotaciones de Mi horario', () => {
  it('acepta lo mínimo: un hueco y qué es', () => {
    const r = crearAnotacionSchema.parse({ periodoId: UUID, tramoId: UUID, actividad: 'atencion_alumnos' });
    expect(r).toMatchObject({ etiqueta: null, aula: null, notas: null });
  });

  it('recorta los textos y los vacíos pasan a null', () => {
    const r = crearAnotacionSchema.parse({ periodoId: UUID, tramoId: UUID, actividad: 'guardia', etiqueta: '  Patio  ', aula: '   ', notas: '' });
    expect(r.etiqueta).toBe('Patio');
    expect(r.aula).toBeNull();
    expect(r.notas).toBeNull();
  });

  it('solo deja las actividades de la lista: no se puede colar una clase ni un oratorio', () => {
    for (const actividad of ['clase', 'oratorio', 'apoyo_pt', 'inventada']) {
      expect(crearAnotacionSchema.safeParse({ periodoId: UUID, tramoId: UUID, actividad }).success).toBe(false);
    }
  });

  it('los ids tienen que ser uuid y los textos no pasan de su límite', () => {
    expect(crearAnotacionSchema.safeParse({ periodoId: 'x', tramoId: UUID, actividad: 'guardia' }).success).toBe(false);
    expect(crearAnotacionSchema.safeParse({ periodoId: UUID, tramoId: UUID, actividad: 'guardia', etiqueta: 'a'.repeat(121) }).success).toBe(false);
  });

  it('editar y borrar piden la sesión, y editar no deja cambiar el hueco', () => {
    expect(editarAnotacionSchema.safeParse({ actividad: 'guardia' }).success).toBe(false);
    expect(editarAnotacionSchema.parse({ sesionId: UUID, actividad: 'guardia', tramoId: UUID })).not.toHaveProperty('tramoId');
    expect(borrarAnotacionSchema.safeParse({ sesionId: UUID }).success).toBe(true);
  });

  it('cada opción apunta a una actividad distinta y se reconoce al reabrirla', () => {
    const actividades = OPCIONES_ANOTACION.map((o) => o.actividad);
    expect(new Set(actividades).size).toBe(actividades.length);
    expect(opcionDeActividad('atencion_alumnos')?.nombre).toBe('Tutoría individual');
    expect(opcionDeActividad('clase')).toBeNull();
  });
});
