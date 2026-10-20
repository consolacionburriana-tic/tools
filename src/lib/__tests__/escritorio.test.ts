import { describe, expect, it } from 'vitest';
import { buscarHerramientas, GRUPOS, herramientasDe, saludo, type ContextoEscritorio } from '@/lib/escritorio';

const CTX: ContextoEscritorio = { oratoriosComun: false, nouvinguts: null, dispositivosSinInformar: null, tableros: null };
const claves = (role: Parameters<typeof herramientasDe>[0]['role'], ctx = CTX) =>
  herramientasDe({ role }, ctx).map((h) => h.clave);

describe('qué ve cada uno en el escritorio', () => {
  it('un profe: su día, el alumnado de su etapa, banco, salidas y horarios; nada de configuración', () => {
    expect(claves('profe')).toEqual(['mi-horario', 'tableros', 'registrar-conducta', 'alumnado', 'bancolibros', 'salidas', 'horarios']);
  });

  it('secretaría ve Correos y grupos (solo ver) pero ni Classrooms ni las tareas de la plataforma', () => {
    const c = claves('secretaria');
    expect(c).toContain('cuentas');
    expect(c).not.toContain('calendarios');
    expect(c).not.toContain('tareas');
  });

  it('Puntualidad no sale para nadie (está apagado)', () => {
    for (const r of ['supertic', 'tic', 'direccion', 'tutor', 'secretaria', 'jefe'] as const) {
      expect(claves(r).some((c) => c.includes('puntualidad'))).toBe(false);
    }
  });

  it('va en el orden de los grupos', () => {
    const grupos = herramientasDe({ role: 'supertic' }, CTX).map((h) => GRUPOS.indexOf(h.grupo));
    expect(grupos).toEqual([...grupos].sort((a, b) => a - b));
  });

  it('Oratorios: quien planifica lo tiene en organización; el resto, solo con el acceso común abierto', () => {
    expect(claves('tic')).toContain('oratorios');
    expect(claves('tic')).not.toContain('oratorios-ver');
    expect(claves('tutor')).not.toContain('oratorios-ver');
    expect(claves('tutor', { ...CTX, oratoriosComun: true })).toContain('oratorios-ver');
  });

  it('los contadores salen como insignia y cambian la descripción de Tableros', () => {
    const lista = herramientasDe(
      { role: 'supertic' },
      { ...CTX, nouvinguts: 3, dispositivosSinInformar: 12, tableros: { pendientes: 2, urgente: { texto: '1 vencida', tono: 'rojo' } } },
    );
    const h = (c: string) => lista.find((x) => x.clave === c)!;
    expect(h('nouvinguts').badge).toEqual({ texto: '3 en curso', tono: 'azul' });
    expect(h('dispositivos').badge).toEqual({ texto: '12 sin informar', tono: 'ambar' });
    expect(h('tableros').badge).toEqual({ texto: '1 vencida', tono: 'rojo' });
    expect(h('tableros').desc).toBe('2 tareas pendientes en tus equipos');
    expect(h('alumnado').badge).toBeNull();
  });
});

describe('buscador', () => {
  const todas = herramientasDe({ role: 'supertic' }, CTX);
  it('encuentra por palabras clave y sin acentos', () => {
    expect(buscarHerramientas(todas, 'excursiones')[0].clave).toBe('salidas');
    expect(buscarHerramientas(todas, 'matricula').map((h) => h.clave)).toContain('nouvinguts');
    expect(buscarHerramientas(todas, 'ipad').map((h) => h.clave)).toEqual(expect.arrayContaining(['dispositivos', 'autoasm']));
  });

  it('lo que casa en el título va primero, y todas las palabras tienen que estar', () => {
    expect(buscarHerramientas(todas, 'horario')[0].clave).toBe('mi-horario');
    expect(buscarHerramientas(todas, 'banco libros').map((h) => h.clave)).toEqual(['bancolibros']);
    expect(buscarHerramientas(todas, 'nada que ver xyz')).toEqual([]);
  });

  it('sin consulta, todas', () => {
    expect(buscarHerramientas(todas, '  ')).toHaveLength(todas.length);
  });
});

describe('saludo', () => {
  it('días, tardes y noches en hora de Madrid', () => {
    expect(saludo(new Date('2026-10-20T07:00:00Z'), 'Europe/Madrid')).toBe('Buenos días');
    expect(saludo(new Date('2026-10-20T14:30:00Z'), 'Europe/Madrid')).toBe('Buenas tardes');
    expect(saludo(new Date('2026-10-20T20:30:00Z'), 'Europe/Madrid')).toBe('Buenas noches');
  });
});
