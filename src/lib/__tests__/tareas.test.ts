import { describe, expect, it } from 'vitest';
import { canAccess } from '@/lib/permissions';
import {
  checklistDeTexto,
  crearTareaSchema,
  moduloDeRuta,
  promptFallo,
  promptFallosAbiertos,
  promptModulo,
  type Tarea,
} from '@/lib/tareas';

function tarea(p: Partial<Tarea>): Tarea {
  return {
    id: 'x',
    tipo: 'fallo',
    titulo: 'El botón de guardar no hace nada',
    modulo: 'puntualidad',
    descripcion: null,
    checklist: [],
    estado: 'pendiente',
    ruta: '/gestion/puntualidad/registros',
    createdBy: 'ana@example.com',
    createdByNombre: 'Ana Prueba',
    createdAt: '2026-09-24T10:00:00.000Z',
    updatedAt: '2026-09-24T10:00:00.000Z',
    hechoAt: null,
    ...p,
  };
}

describe('permisos de tareas', () => {
  it('TIC y superTIC lo llevan todo; dirección, secretaría y orientación solo reportan', () => {
    for (const role of ['tic', 'supertic'] as const) {
      expect(canAccess({ role }, 'tareas')).toBe(true);
    }
    for (const role of ['direccion', 'secretaria', 'orientacion'] as const) {
      expect(canAccess({ role }, 'tareas')).toBe(false);
      expect(canAccess({ role }, 'tareas-reportar')).toBe(true);
    }
    for (const role of ['profe', 'tutor', 'jefe'] as const) {
      expect(canAccess({ role }, 'tareas-reportar')).toBe(false);
    }
  });
});

describe('moduloDeRuta', () => {
  it('saca el módulo de la pantalla', () => {
    expect(moduloDeRuta('/gestion/puntualidad/registros')).toBe('puntualidad');
    expect(moduloDeRuta('/gestion/alumnado?clase=3A')).toBe('alumnado');
    expect(moduloDeRuta('/gestion')).toBeNull();
    expect(moduloDeRuta('/gestion/tareas')).toBeNull();
    expect(moduloDeRuta(null)).toBeNull();
  });
});

describe('prompts para copiar', () => {
  it('el fallito lleva módulo, pantalla, ficha y el texto', () => {
    const p = promptFallo(tarea({}));
    expect(p).toContain('Puntualidad');
    expect(p).toContain('/gestion/puntualidad/registros');
    expect(p).toContain('docs/17-puntualidad.md');
    expect(p).toContain('El botón de guardar no hace nada');
  });

  it('el módulo lleva definición y checklist con su estado', () => {
    const p = promptModulo(
      tarea({
        tipo: 'modulo',
        titulo: 'Sustituciones',
        descripcion: 'Quién cubre a quién',
        checklist: [
          { id: '1', texto: 'Parte de ausencias', hecho: true },
          { id: '2', texto: 'Aviso al sustituto', hecho: false },
        ],
      }),
    );
    expect(p).toContain('# Módulo nuevo: Sustituciones');
    expect(p).toContain('Quién cubre a quién');
    expect(p).toContain('- [x] Parte de ausencias');
    expect(p).toContain('- [ ] Aviso al sustituto');
  });

  it('todos los abiertos, agrupados y sin los hechos', () => {
    const p = promptFallosAbiertos([
      tarea({ id: '1', titulo: 'Uno' }),
      tarea({ id: '2', titulo: 'Dos', modulo: null, ruta: null }),
      tarea({ id: '3', titulo: 'Tres', estado: 'hecho' }),
    ]);
    expect(p).toContain(': 2.');
    expect(p).toContain('## General');
    expect(p).toContain('- [ ] Uno');
    expect(p).not.toContain('Tres');
    expect(promptFallosAbiertos([])).toBe('');
  });
});

describe('checklistDeTexto', () => {
  it('una línea por item, limpiando viñetas y casillas', () => {
    const l = checklistDeTexto('- Formulario\n\n* [ ] Aviso\n[x] Informe\n   ');
    expect(l.map((i) => i.texto)).toEqual(['Formulario', 'Aviso', 'Informe']);
    expect(l.every((i) => !i.hecho && i.id)).toBe(true);
  });
});

describe('validación', () => {
  it('rechaza módulos inventados en un fallito', () => {
    expect(crearTareaSchema.safeParse({ tipo: 'fallo', titulo: 'Algo falla', modulo: 'nada' }).success).toBe(false);
    expect(crearTareaSchema.safeParse({ tipo: 'fallo', titulo: 'Algo falla', modulo: null }).success).toBe(true);
  });
});
