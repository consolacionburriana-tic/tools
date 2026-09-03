import { describe, expect, it } from 'vitest';
import {
  canAccess,
  diffModulos,
  modulosDe,
  origenModulo,
  MODULES,
  ROLE_MODULES,
  vePuntualidadCompleta,
  type Module,
} from '@/lib/permissions';

describe('módulos efectivos de una persona', () => {
  it('sin rol no hay acceso a nada', () => {
    expect(modulosDe({ role: null })).toEqual([]);
    expect(canAccess({ role: null }, 'salidas')).toBe(false);
    expect(canAccess(null, 'salidas')).toBe(false);
  });

  it('sin ajustes, manda el rol', () => {
    expect(modulosDe({ role: 'tutor' })).toEqual([...ROLE_MODULES.tutor]);
    expect(canAccess({ role: 'tutor' }, 'salidas')).toBe(true);
    expect(canAccess({ role: 'tutor' }, 'evaluaciones')).toBe(false);
  });

  it('el caso real: un tutor al que ADEMÁS se le dan las evaluaciones', () => {
    const tutorPastoral = { role: 'tutor' as const, modulosExtra: ['evaluaciones'] };
    expect(canAccess(tutorPastoral, 'evaluaciones')).toBe(true);
    // …y sigue conservando lo suyo, que era justo el problema del rol dedicado.
    expect(canAccess(tutorPastoral, 'salidas')).toBe(true);
    expect(canAccess(tutorPastoral, 'bancolibros')).toBe(true);
  });

  it('se le puede quitar a alguien un módulo que le venía del rol', () => {
    const secretariaSinLicencias = { role: 'secretaria' as const, modulosBloqueados: ['licencias'] };
    expect(canAccess(secretariaSinLicencias, 'licencias')).toBe(false);
    expect(canAccess(secretariaSinLicencias, 'salidas')).toBe(true);
  });

  it('si algo está a la vez en extra y en bloqueados, gana bloqueado', () => {
    const raro = { role: 'tutor' as const, modulosExtra: ['evaluaciones'], modulosBloqueados: ['evaluaciones'] };
    expect(canAccess(raro, 'evaluaciones')).toBe(false);
    expect(modulosDe(raro)).not.toContain('evaluaciones');
  });

  it('modulosDe y canAccess nunca se contradicen', () => {
    const casos = [
      { role: 'profe' as const },
      { role: 'direccion' as const, modulosBloqueados: ['educamos'] },
      { role: 'tutor' as const, modulosExtra: ['evaluaciones', 'abc'] },
      { role: 'supertic' as const, modulosBloqueados: ['usuarios'] },
    ];
    for (const caso of casos) {
      const lista = modulosDe(caso);
      for (const m of MODULES) expect(canAccess(caso, m)).toBe(lista.includes(m));
    }
  });

  it('ignora módulos inventados guardados en la BBDD', () => {
    const conBasura = { role: 'tutor' as const, modulosExtra: ['modulo_que_no_existe'] };
    expect(modulosDe(conBasura)).toEqual([...ROLE_MODULES.tutor]);
  });

  it('devuelve siempre los módulos en el mismo orden, no en el de inserción', () => {
    const a = modulosDe({ role: 'tutor', modulosExtra: ['evaluaciones', 'abc'] });
    const b = modulosDe({ role: 'tutor', modulosExtra: ['abc', 'evaluaciones'] });
    expect(a).toEqual(b);
    expect(a).toEqual(MODULES.filter((m) => a.includes(m)));
  });
});

describe('de dónde le viene cada módulo (para pintarlo en la interfaz)', () => {
  it('distingue rol, dado a mano, quitado a mano y nada', () => {
    const acceso = {
      role: 'tutor' as const,
      modulosExtra: ['evaluaciones'],
      modulosBloqueados: ['salidas'],
    };
    expect(origenModulo(acceso, 'bancolibros')).toBe('rol');
    expect(origenModulo(acceso, 'evaluaciones')).toBe('extra');
    expect(origenModulo(acceso, 'salidas')).toBe('bloqueado');
    expect(origenModulo(acceso, 'licencias')).toBe('no');
  });

  it('un módulo bloqueado que el rol no daba no se enseña como "quitado"', () => {
    // Sería confuso: nunca lo tuvo. Es simplemente "no".
    expect(origenModulo({ role: 'tutor', modulosBloqueados: ['licencias'] }, 'licencias')).toBe('no');
  });
});

describe('guardar la selección como diferencia respecto al rol', () => {
  it('lo que ya da el rol no se guarda como extra', () => {
    const { modulosExtra, modulosBloqueados } = diffModulos('tutor', [...ROLE_MODULES.tutor]);
    expect(modulosExtra).toEqual([]);
    expect(modulosBloqueados).toEqual([]);
  });

  it('marcar uno de más lo guarda como extra; desmarcar uno del rol, como bloqueado', () => {
    const r = diffModulos('tutor', ['salidas', 'evaluaciones'] as Module[]);
    expect(r.modulosExtra).toEqual(['evaluaciones']);
    // El rol tutor trae salidas, bancolibros, puntualidad y horarios: lo que no se marca,
    // bloqueado.
    expect(r.modulosBloqueados).toEqual(['bancolibros', 'puntualidad', 'horarios']);
  });

  it('ida y vuelta: guardar la diferencia y volver a resolverla da lo mismo que se marcó', () => {
    const seleccion: Module[] = ['salidas', 'evaluaciones', 'abc'];
    const diff = diffModulos('tutor', seleccion);
    expect(modulosDe({ role: 'tutor', ...diff }).sort()).toEqual([...seleccion].sort());
  });

  it('desmarcarlo todo deja a la persona sin módulos, no con los del rol', () => {
    const diff = diffModulos('tutor', []);
    expect(modulosDe({ role: 'tutor', ...diff })).toEqual([]);
  });

  it('sin rol, cualquier selección se guarda como extra', () => {
    expect(diffModulos(null, ['salidas'] as Module[]).modulosExtra).toEqual(['salidas']);
  });
});

describe('alcance dentro de Puntualidad', () => {
  it('dirección, jefatura, orientación y TIC ven todo el centro', () => {
    for (const role of ['direccion', 'jefe', 'orientacion', 'tic', 'supertic'] as const) {
      expect(vePuntualidadCompleta(role)).toBe(true);
    }
  });

  it('un tutor tiene el módulo pero solo ve sus clases', () => {
    expect(canAccess({ role: 'tutor' }, 'puntualidad')).toBe(true);
    expect(vePuntualidadCompleta('tutor')).toBe(false);
  });

  it('un profe sin el módulo no entra al panel (pero sí puede registrar: eso solo pide sesión)', () => {
    expect(canAccess({ role: 'profe' }, 'puntualidad')).toBe(false);
    expect(vePuntualidadCompleta('profe')).toBe(false);
  });
});
