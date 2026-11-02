import { describe, expect, it } from 'vitest';
import { buscarHerramientas, GRUPOS, herramientasDe, saludo, type ContextoEscritorio } from '@/lib/escritorio';

const CTX: ContextoEscritorio = { oratoriosComun: false, nouvinguts: null, dispositivosSinInformar: null, tableros: null };
const claves = (role: Parameters<typeof herramientasDe>[0]['role'], ctx = CTX) =>
  herramientasDe({ role }, ctx).map((h) => h.clave);

describe('qué ve cada uno en el escritorio', () => {
  it('un profe: su día, el alumnado de su etapa y horarios, más lo gris; nada de configuración', () => {
    expect(claves('profe')).toEqual([
      'mi-horario',
      'tableros',
      'registrar-conducta',
      'alumnado',
      'bancolibros',
      'salidas',
      'horarios',
      'evaluaciones',
      'incidencias',
    ]);
  });

  it('Números del cole se oculta al claustro de a pie (profe y tutor) y se queda para el resto', () => {
    expect(claves('profe')).not.toContain('numeros');
    expect(claves('tutor')).not.toContain('numeros');
    for (const r of ['jefe', 'orientacion', 'direccion', 'secretaria', 'tic', 'supertic'] as const) {
      expect(claves(r)).toContain('numeros');
    }
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

describe('herramientas en gris', () => {
  const gris = (role: Parameters<typeof herramientasDe>[0]['role'], clave: string) =>
    herramientasDe({ role }, CTX).find((h) => h.clave === clave)?.bloqueo ?? null;

  it('banco de libros y salidas salen «próximamente» para profe y tutor, y normales para el resto', () => {
    for (const r of ['profe', 'tutor'] as const) {
      expect(gris(r, 'bancolibros')).toBe('proximamente');
      expect(gris(r, 'salidas')).toBe('proximamente');
    }
    for (const r of ['jefe', 'direccion', 'secretaria', 'tic', 'supertic'] as const) {
      expect(gris(r, 'bancolibros')).toBeNull();
      expect(gris(r, 'salidas')).toBeNull();
    }
  });

  it('las incidencias de mantenimiento y TIC no existen todavía: gris para todos, SuperTIC incluido', () => {
    for (const r of ['profe', 'tutor', 'jefe', 'direccion', 'secretaria', 'tic', 'supertic'] as const) {
      expect(gris(r, 'incidencias')).toBe('proximamente');
    }
  });

  it('Evaluaciones: quien no lo tiene lo ve en gris para solicitarlo, con la frase que lo explica', () => {
    for (const r of ['profe', 'tutor', 'jefe', 'orientacion', 'comunicacion'] as const) {
      expect(gris(r, 'evaluaciones')).toBe('solicitar');
    }
    for (const r of ['direccion', 'secretaria', 'evaluaciones', 'tic', 'supertic'] as const) {
      expect(gris(r, 'evaluaciones')).toBeNull();
    }
    const h = herramientasDe({ role: 'profe' }, CTX).find((x) => x.clave === 'evaluaciones')!;
    expect(h.desc).toBe(
      'Si tú o tu equipo necesitáis hacer alguna evaluación al alumnado o profesorado, podéis solicitar el acceso a este módulo.',
    );
  });

  it('a quien se le ha dado Evaluaciones a mano ya no lo ve gris', () => {
    const h = herramientasDe({ role: 'profe', modulosExtra: ['evaluaciones'] }, CTX).find((x) => x.clave === 'evaluaciones')!;
    expect(h.bloqueo).toBeNull();
  });

  it('lo gris no lleva insignias, y en el buscador va detrás de lo que se puede abrir', () => {
    const lista = herramientasDe({ role: 'profe' }, { ...CTX, tableros: { pendientes: 1, urgente: null } });
    expect(lista.filter((h) => h.bloqueo).every((h) => h.badge === null)).toBe(true);
    const r = buscarHerramientas(lista, 'horario');
    const primeraGris = r.findIndex((h) => h.bloqueo);
    if (primeraGris >= 0) expect(r.slice(primeraGris).every((h) => h.bloqueo || r.indexOf(h) > primeraGris)).toBe(true);
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
