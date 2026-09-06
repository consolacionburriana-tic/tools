import { describe, expect, it } from 'vitest';
import type { CuadAjustes, CuadPlantilla } from '@/db/schema';
import { construirMapeo } from '@/lib/cuaderno/campos';
import { construirVistaPrevia } from '@/lib/cuaderno/vista-previa';
import type { AlumnoCuaderno, ClaseCuaderno } from '@/lib/cuaderno-server';

// La vista previa se calcula con el mismo `construirPlan()` que el worker: si algún día
// dejan de coincidir, es aquí donde tiene que doler. Datos inventados.

const plantilla = {
  id: 'p1',
  nombre: 'Reunión de familias',
  repeticion: 'alumno',
  saltoDePagina: true,
  orden: 1,
} as unknown as CuadPlantilla;

const ajustes = { nombreCentro: 'Colegio Consolación' } as CuadAjustes;

const alumna: AlumnoCuaderno = {
  id: 'a1',
  nombre: 'Aitana',
  apellido1: 'Ros',
  apellido2: 'Mas',
  nia: '1234',
  email: 'aitana@ejemplo.test',
  sexo: 'F',
  fechaNacimiento: null,
  tutorPersonalId: 't1',
  familiares: [{ nombre: 'Marta Mas Gil', telefono: '600000000', correo: 'marta@ejemplo.test' }],
};

const clase: ClaseCuaderno = {
  curso: '2ESO',
  letra: 'A',
  etapa: 'ESO',
  clase: '2ºA',
  tutores: [
    { teacherId: 't1', nombre: 'Carlos Valero Aicart', corto: 'Carlos V', completo: 'Carlos Andres Valero Aicart', pila: 'Carlos', apellido1: 'Valero', apellido2: 'Aicart', email: 'carlos@ejemplo.test' },
  ],
  alumnos: [alumna],
};

const base = {
  plantilla,
  ajustes,
  academicYear: '2026-27',
  clase,
  tutor: clase.tutores[0],
  alumnos: [alumna],
  asignaturas: [{ enLaHoja: 'Mates' }],
  numeros: new Map([['a1', { asignado: 1, alfabetico: 1 }]]),
  mapeo: construirMapeo(),
};

describe('construirVistaPrevia', () => {
  it('resuelve cada etiqueta con el valor que se va a imprimir', () => {
    const vista = construirVistaPrevia({ ...base, etiquetas: ['nom', 'tutoria', 'tutor', 'asignatura1'] });
    const valor = (etiqueta: string) => vista.campos.find((c) => c.etiqueta === etiqueta)?.valor;
    expect(valor('nom')).toBe('Aitana');
    expect(valor('tutoria')).toBe('2ºA');
    expect(valor('tutor')).toBe('Carlos Valero Aicart');
    expect(valor('asignatura1')).toBe('Mates');
  });

  it('marca como problema la etiqueta que no existe, y la lista aparte', () => {
    const vista = construirVistaPrevia({ ...base, etiquetas: ['nom', 'professio1'] });
    expect(vista.campos.find((c) => c.etiqueta === 'professio1')?.problema).toBe(true);
    expect(vista.campos.find((c) => c.etiqueta === 'nom')?.problema).toBe(false);
    expect(vista.sinMapear).toEqual(['professio1']);
  });

  it('las marcas de estructura no son un problema ni tienen valor', () => {
    const vista = construirVistaPrevia({ ...base, etiquetas: ['#alumnos', '?familiar2'] });
    expect(vista.campos.map((c) => c.tipo)).toEqual(['filas', 'condicion']);
    expect(vista.campos.every((c) => !c.problema && c.valor === '')).toBe(true);
  });

  it('un campo sin dato sale en blanco, no como problema', () => {
    const vista = construirVistaPrevia({ ...base, etiquetas: ['familiar2_nombre'] });
    expect(vista.campos[0]).toMatchObject({ valor: '', problema: false });
  });

  it('dice de quién es el ejemplo y trae los tutores para poder retocarlos', () => {
    const vista = construirVistaPrevia({ ...base, etiquetas: ['nom'] });
    expect(vista.ejemplo).toEqual({ alumno: 'Aitana Ros Mas', tutor: 'Carlos Valero Aicart', clase: '2ºA' });
    expect(vista.tutores).toEqual([
      { teacherId: 't1', completo: 'Carlos Andres Valero Aicart', usual: 'Carlos Valero Aicart', corto: 'Carlos V' },
    ]);
  });

  it('la plantilla que no se repite por alumno también enseña los datos de la fila', () => {
    const unica = { ...plantilla, repeticion: 'unica' } as CuadPlantilla;
    const vista = construirVistaPrevia({ ...base, plantilla: unica, etiquetas: ['nom', 'tutoria'] });
    expect(vista.campos.find((c) => c.etiqueta === 'nom')?.valor).toBe('Aitana');
    expect(vista.campos.find((c) => c.etiqueta === 'tutoria')?.valor).toBe('2ºA');
  });
});
