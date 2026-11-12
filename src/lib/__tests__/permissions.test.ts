import { describe, expect, it } from 'vitest';
import {
  canAccess,
  diffModulos,
  horariosSoloSuTutoria,
  puedeVerHistorialAlumnado,
  puedeGestionarParticipantesBanco,
  ROLES,
  modulosDe,
  origenModulo,
  MODULES,
  ROLE_MODULES,
  vePuntualidadCompleta,
  moduloDesactivado,
  moduloPorGrupo,
  MODULOS_DE_GRUPO,
  veProteccionDatosCompleta,
  type Module,
} from '@/lib/permissions';

describe('módulos efectivos de una persona', () => {
  it('sin rol no hay acceso a nada', () => {
    expect(modulosDe({ role: null })).toEqual([]);
    expect(canAccess({ role: null }, 'salidas')).toBe(false);
    expect(canAccess(null, 'salidas')).toBe(false);
  });

  it('sin ajustes, manda el rol', () => {
    // Lo del rol, menos lo apagado en el colegio (hoy, Puntualidad).
    expect(modulosDe({ role: 'tutor' })).toEqual(ROLE_MODULES.tutor.filter((m) => !moduloDesactivado(m)));
    expect(canAccess({ role: 'tutor' }, 'salidas')).toBe(true);
    expect(canAccess({ role: 'tutor' }, 'evaluaciones')).toBe(false);
  });

  it('el caso real: un tutor al que ADEMÁS se le dan las evaluaciones', () => {
    const tutorPastoral = { role: 'tutor' as const, modulosExtra: ['evaluaciones'] };
    expect(canAccess(tutorPastoral, 'evaluaciones')).toBe(true);
    // …y sigue conservando lo suyo, que era justo el problema del rol dedicado.
    expect(canAccess(tutorPastoral, 'salidas')).toBe(true);
    expect(canAccess(tutorPastoral, 'horarios')).toBe(true);
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
    expect(modulosDe(conBasura)).toEqual(ROLE_MODULES.tutor.filter((m) => !moduloDesactivado(m)));
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
    expect(origenModulo(acceso, 'horarios')).toBe('rol');
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
    // El rol tutor trae salidas, puntualidad, horarios, mi-horario, alumnado,
    // numeros, oratorios-ver, tableros y tareas-reportar: lo que no se marca, bloqueado.
    expect(r.modulosBloqueados).toEqual([
      'puntualidad',
      'horarios',
      'mi-horario',
      'alumnado',
      'numeros',
      'tareas-reportar',
      'oratorios-ver',
      'tableros',
    ]);
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
    // El rol lo sigue trayendo: al encender Puntualidad, vuelve solo. Mientras esté apagado,
    // canAccess dice que no (ver «módulos apagados»).
    expect(ROLE_MODULES.tutor).toContain('puntualidad');
    expect(vePuntualidadCompleta('tutor')).toBe(false);
  });

  it('un profe sin el módulo no entra al panel (pero sí puede registrar: eso solo pide sesión)', () => {
    expect(canAccess({ role: 'profe' }, 'puntualidad')).toBe(false);
    expect(vePuntualidadCompleta('profe')).toBe(false);
  });
});

describe('oratorios', () => {
  it('planificar no va en ningún rol del claustro: se da a mano (salvo TIC y secretaría, que lo tienen todo)', () => {
    for (const r of ['profe', 'tutor', 'jefe', 'direccion', 'orientacion', 'evaluaciones', 'comunicacion'] as const) {
      expect(canAccess({ role: r }, 'oratorios')).toBe(false);
    }
    expect(canAccess({ role: 'tic' }, 'oratorios')).toBe(true);
    expect(canAccess({ role: 'secretaria' }, 'oratorios')).toBe(true);
    expect(canAccess({ role: 'profe', modulosExtra: ['oratorios'] }, 'oratorios')).toBe(true);
  });

  it('ver lo mío lo tiene todo el claustro por rol', () => {
    for (const r of ['profe', 'tutor', 'jefe', 'direccion', 'orientacion'] as const) {
      expect(canAccess({ role: r }, 'oratorios-ver')).toBe(true);
    }
  });
});

describe('nouvinguts', () => {
  it('lo trabajan secretaría, dirección y TIC; el resto del claustro no', () => {
    for (const r of ['secretaria', 'direccion', 'tic', 'supertic'] as const) expect(canAccess({ role: r }, 'nouvinguts')).toBe(true);
    for (const r of ['profe', 'tutor', 'jefe', 'orientacion', 'evaluaciones', 'comunicacion'] as const) {
      expect(canAccess({ role: r }, 'nouvinguts')).toBe(false);
    }
  });

  it('el orden de los pasos solo lo tocan SuperTIC y TIC', () => {
    expect(canAccess({ role: 'tic' }, 'nouvinguts-proceso')).toBe(true);
    expect(canAccess({ role: 'supertic' }, 'nouvinguts-proceso')).toBe(true);
    expect(canAccess({ role: 'secretaria' }, 'nouvinguts-proceso')).toBe(false);
    expect(canAccess({ role: 'direccion' }, 'nouvinguts-proceso')).toBe(false);
  });
});

describe('correos y grupos', () => {
  it('lo gestionan SuperTIC y TIC; secretaría lo ve sin tocar nada', () => {
    for (const r of ['tic', 'supertic'] as const) expect(canAccess({ role: r }, 'cuentas')).toBe(true);
    expect(canAccess({ role: 'secretaria' }, 'cuentas')).toBe(false);
    expect(canAccess({ role: 'secretaria' }, 'cuentas-ver')).toBe(true);
  });

  it('el resto del claustro, ni lo ve', () => {
    for (const r of ['profe', 'tutor', 'jefe', 'direccion', 'orientacion', 'evaluaciones', 'comunicacion'] as const) {
      expect(canAccess({ role: r }, 'cuentas')).toBe(false);
      expect(canAccess({ role: r }, 'cuentas-ver')).toBe(false);
    }
  });
});

describe('dispositivos', () => {
  it('lo llevan TIC, secretaría y dirección; tutores y profes no entran (ven solo el aviso en Alumnado)', () => {
    for (const r of ['secretaria', 'direccion', 'tic', 'supertic'] as const) expect(canAccess({ role: r }, 'dispositivos')).toBe(true);
    for (const r of ['profe', 'tutor', 'jefe', 'orientacion', 'evaluaciones', 'comunicacion'] as const) {
      expect(canAccess({ role: r }, 'dispositivos')).toBe(false);
    }
  });
});

describe('banco de libros', () => {
  it('el módulo es solo de SuperTIC (David, 5-nov-2026): ningún otro rol, ni dado a mano', () => {
    expect(canAccess({ role: 'supertic' }, 'bancolibros')).toBe(true);
    expect(modulosDe({ role: 'supertic' })).toContain('bancolibros');
    for (const r of ROLES.filter((x) => x !== 'supertic')) {
      expect(canAccess({ role: r }, 'bancolibros'), r).toBe(false);
      expect(canAccess({ role: r, modulosExtra: ['bancolibros'] }, 'bancolibros'), `${r} + extra`).toBe(false);
      expect(modulosDe({ role: r, modulosExtra: ['bancolibros'] }), `${r} + extra`).not.toContain('bancolibros');
    }
  });

  it('marcar quién participa desde Alumnado no depende del módulo: secretaría, dirección y TIC sí', () => {
    for (const r of ['secretaria', 'direccion', 'tic', 'supertic'] as const) expect(puedeGestionarParticipantesBanco(r)).toBe(true);
    for (const r of ['tutor', 'profe', 'jefe', 'orientacion'] as const) expect(puedeGestionarParticipantesBanco(r)).toBe(false);
  });
});

describe('módulos apagados (CONFIGURACION.modulosDesactivados)', () => {
  it('Puntualidad está apagado: no lo tiene nadie, ni por rol ni dado a mano', () => {
    expect(moduloDesactivado('puntualidad')).toBe(true);
    for (const r of ['supertic', 'tic', 'direccion', 'jefe', 'tutor', 'orientacion', 'secretaria'] as const) {
      expect(canAccess({ role: r }, 'puntualidad')).toBe(false);
      expect(modulosDe({ role: r })).not.toContain('puntualidad');
    }
    expect(canAccess({ role: 'profe', modulosExtra: ['puntualidad'] }, 'puntualidad')).toBe(false);
  });

  it('lo demás sigue igual', () => {
    expect(moduloDesactivado('abc')).toBe(false);
    expect(canAccess({ role: 'tutor' }, 'salidas')).toBe(true);
  });
});


describe('Horarios: el profe raso solo ve su tutoría', () => {
  it('profe y tutor, sí; quien ve horarios de profes, no', () => {
    expect(horariosSoloSuTutoria({ role: 'profe' })).toBe(true);
    expect(horariosSoloSuTutoria({ role: 'tutor' })).toBe(true);
    for (const role of ['orientacion', 'jefe', 'direccion', 'secretaria', 'tic', 'supertic'] as const) {
      expect(horariosSoloSuTutoria({ role }), role).toBe(false);
    }
  });

  it('un profe al que se le ha dado «horarios de profesorado» lo ve todo; si se le quita, vuelve a su tutoría', () => {
    expect(horariosSoloSuTutoria({ role: 'profe', modulosExtra: ['horarios-profes'] })).toBe(false);
    expect(horariosSoloSuTutoria({ role: 'orientacion', modulosBloqueados: ['horarios-profes'] })).toBe(false); // no es profe ni tutor: no cambia
  });

  it('sin rol o con otro rol (comunicación), nada que restringir', () => {
    expect(horariosSoloSuTutoria(null)).toBe(false);
    expect(horariosSoloSuTutoria({ role: null })).toBe(false);
    expect(horariosSoloSuTutoria({ role: 'comunicacion' })).toBe(false);
  });
});

describe('libro de cambios de Alumnado', () => {
  it('lo ven y restauran secretaría, dirección y TIC; nadie más', () => {
    for (const role of ['secretaria', 'direccion', 'tic', 'supertic'] as const) expect(puedeVerHistorialAlumnado(role), role).toBe(true);
    for (const role of ['tutor', 'profe', 'jefe', 'orientacion', 'comunicacion', 'evaluaciones', null] as const) {
      expect(puedeVerHistorialAlumnado(role), String(role)).toBe(false);
    }
  });
});

describe('grupos de usuarios (Pastoral, Comunicación…)', () => {
  const pastoral = ['numeros', 'evaluaciones'];

  it('un profe en Pastoral suma Números y Evaluaciones sin perder lo suyo', () => {
    const profePastoral = { role: 'profe' as const, modulosGrupos: pastoral };
    expect(canAccess(profePastoral, 'numeros')).toBe(true);
    expect(canAccess(profePastoral, 'evaluaciones')).toBe(true);
    expect(canAccess(profePastoral, 'salidas')).toBe(true);
    expect(canAccess({ role: 'profe' }, 'numeros')).toBe(false);
  });

  it('se puede estar en varios grupos: se suman', () => {
    const dos = { role: 'tutor' as const, modulosGrupos: [...pastoral, 'comunicacion'] };
    expect(canAccess(dos, 'evaluaciones')).toBe(true);
    expect(canAccess(dos, 'comunicacion')).toBe(true);
  });

  it('sin rol, un grupo no da nada', () => {
    expect(canAccess({ role: null, modulosGrupos: pastoral }, 'numeros')).toBe(false);
    expect(modulosDe({ role: null, modulosGrupos: pastoral })).toEqual([]);
  });

  it('lo quitado a mano gana al grupo', () => {
    const quitado = { role: 'profe' as const, modulosGrupos: pastoral, modulosBloqueados: ['numeros'] };
    expect(canAccess(quitado, 'numeros')).toBe(false);
    expect(modulosDe(quitado)).not.toContain('numeros');
    expect(origenModulo(quitado, 'numeros')).toBe('bloqueado');
    expect(moduloPorGrupo(quitado, 'numeros')).toBe(false);
  });

  it('un grupo no puede dar lo reservado a SuperTIC', () => {
    expect(MODULOS_DE_GRUPO).not.toContain('bancolibros');
    expect(canAccess({ role: 'profe', modulosGrupos: ['bancolibros'] }, 'bancolibros')).toBe(false);
  });

  it('origenModulo distingue rol, grupo y a mano', () => {
    const a = { role: 'tutor' as const, modulosGrupos: pastoral, modulosExtra: ['abc'] };
    expect(origenModulo(a, 'salidas')).toBe('rol');
    expect(origenModulo(a, 'evaluaciones')).toBe('grupo');
    expect(origenModulo(a, 'abc')).toBe('extra');
    // Números ya le viene del rol tutor: manda el rol.
    expect(origenModulo(a, 'numeros')).toBe('rol');
    expect(origenModulo(a, 'educamos')).toBe('no');
  });

  it('moduloPorGrupo: el módulo llega por un grupo (y entonces se da entero)', () => {
    const p = { role: 'profe' as const, modulosGrupos: pastoral };
    expect(moduloPorGrupo(p, 'numeros')).toBe(true);
    expect(moduloPorGrupo(p, 'salidas')).toBe(false);
    expect(moduloPorGrupo({ role: 'profe' }, 'numeros')).toBe(false);
  });

  it('Alumnado por un grupo ve la protección de datos de todo el centro', () => {
    expect(veProteccionDatosCompleta({ role: 'tutor', modulosGrupos: ['alumnado'] })).toBe(true);
    expect(veProteccionDatosCompleta({ role: 'tutor' })).toBe(false);
  });

  it('diffModulos guarda la diferencia respecto a rol + grupos', () => {
    // Profe en Pastoral que además quiere ABC y no quiere Números (del grupo).
    const quiere = [...modulosDe({ role: 'profe', modulosGrupos: pastoral }).filter((m) => m !== 'numeros'), 'abc'] as Module[];
    const diff = diffModulos('profe', quiere, pastoral);
    expect(diff.modulosExtra).toEqual(['abc']);
    expect(diff.modulosBloqueados).toEqual(['numeros']);
    // Y aplicándolo, sale justo lo que se marcó.
    expect(modulosDe({ role: 'profe', modulosGrupos: pastoral, ...diff })).toEqual(MODULES.filter((m) => quiere.includes(m) && !moduloDesactivado(m)));
  });

  it('modulosDe y canAccess nunca se contradicen, también con grupos', () => {
    const casos = [
      { role: 'profe' as const, modulosGrupos: pastoral },
      { role: 'tutor' as const, modulosGrupos: pastoral, modulosBloqueados: ['evaluaciones'] },
      { role: 'secretaria' as const, modulosGrupos: ['bancolibros', 'tareas'] },
    ];
    for (const caso of casos) {
      const lista = modulosDe(caso);
      for (const m of MODULES) expect(canAccess(caso, m)).toBe(lista.includes(m));
    }
  });
});
