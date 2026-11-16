import { describe, expect, it } from 'vitest';
import {
  antenaPorRenombrar,
  atencionAv,
  avisoAjusteCursos,
  cartelClase,
  claveClase,
  cuadreMobiliario,
  cursoParaAjustar,
  estadoPedido,
  nombreAntenaDeAula,
  nombreAula,
  ordenDeNumero,
  pesoAtencion,
  prefijoSugerido,
  siguientesCodigos,
  sugerirOcupacion,
  textoCuadre,
  tituloDeUrl,
  normalizarUrl,
  type ClaseEnAula,
} from '../inventario';

describe('aulas', () => {
  it('nombra el aula por su número o por su nombre', () => {
    expect(nombreAula({ numero: '12', nombre: null })).toBe('Aula 12');
    expect(nombreAula({ numero: '15', nombre: 'Aula de Música' })).toBe('Aula de Música (15)');
    expect(nombreAula({ numero: null, nombre: 'Informática' })).toBe('Informática');
  });
  it('ordena por el primer número de la puerta', () => {
    expect(ordenDeNumero('17-18')).toBe(17);
    expect(ordenDeNumero('3')).toBe(3);
    expect(ordenDeNumero(null)).toBe(900);
  });
  it('escribe la clase como el cartel de la puerta', () => {
    expect(cartelClase('3PRI', 'B')).toBe('3º EP B');
    expect(cartelClase('4INF', 'A')).toBe('4 años A');
    expect(cartelClase('2ESO', 'A')).toBe('2º ESO A');
    expect(cartelClase('3ºPPDC', 'PDC')).toBe('3º ESO PDC');
  });
});

describe('audiovisual', () => {
  it('un arreglo urgente pendiente manda', () => {
    expect(atencionAv({ accion: 'correcto', valoracion: 5 }, [{ prioridad: 'urgente', hecho: false }])).toBe('urgente');
    expect(atencionAv({ accion: 'correcto', valoracion: 5 }, [{ prioridad: 'urgente', hecho: true }])).toBe('ok');
  });
  it('cambiar, reparar o valoración 0-1 es alta', () => {
    expect(atencionAv({ accion: 'cambiar', valoracion: 4 })).toBe('alta');
    expect(atencionAv({ accion: 'correcto', valoracion: 1 })).toBe('alta');
    expect(atencionAv({ accion: 'correcto', valoracion: null })).toBe('ok');
  });
  it('audio, retirar, 2-3 o algo pendiente es media', () => {
    expect(atencionAv({ accion: 'audio', valoracion: 5 })).toBe('media');
    expect(atencionAv({ accion: 'correcto', valoracion: 3 })).toBe('media');
    expect(atencionAv({ accion: 'correcto', valoracion: 5 }, [{ prioridad: 'normal', hecho: false }])).toBe('media');
    expect(atencionAv({ accion: 'correcto', valoracion: 5 }, [{ prioridad: 'baja', hecho: false }])).toBe('ok');
  });
  it('a igual nivel, la peor valoración primero y sin valorar al final', () => {
    expect(pesoAtencion('alta', 0)).toBeLessThan(pesoAtencion('alta', 2));
    expect(pesoAtencion('alta', 5)).toBeLessThan(pesoAtencion('alta', null));
    expect(pesoAtencion('alta', null)).toBeLessThan(pesoAtencion('media', 0));
  });
});

describe('mesas y sillas', () => {
  it('cuenta lo que falta contra el alumnado', () => {
    expect(cuadreMobiliario({ sillas: 21, mesas: 7 }, 23, '3INF')).toEqual({ sillas: -2, mesas: null });
    expect(cuadreMobiliario({ sillas: 26, mesas: 24 }, 25, '4PRI')).toEqual({ sillas: 1, mesas: -1 });
    expect(cuadreMobiliario(null, 25, '4PRI')).toEqual({ sillas: null, mesas: null });
    expect(cuadreMobiliario({ sillas: null, mesas: 20 }, 20, '1ESO')).toEqual({ sillas: null, mesas: 0 });
  });
  it('lo dice en castellano', () => {
    expect(textoCuadre(-2)).toBe('Faltan 2');
    expect(textoCuadre(-1)).toBe('Falta 1');
    expect(textoCuadre(3)).toBe('Sobran 3');
    expect(textoCuadre(0)).toBe('Justas');
    expect(textoCuadre(-1, 'silla')).toBe('Falta 1 silla');
    expect(textoCuadre(-3, 'silla')).toBe('Faltan 3 sillas');
    expect(textoCuadre(1, 'mesa')).toBe('Sobra 1 mesa');
  });
});

describe('antenas', () => {
  it('está por renombrar mientras el nombre nuevo no sea el actual', () => {
    expect(antenaPorRenombrar({ nombreActual: 'COMUNIDAD', nombreNuevo: 'P3_23' })).toBe(true);
    expect(antenaPorRenombrar({ nombreActual: 'P3_26', nombreNuevo: 'P3_26' })).toBe(false);
    expect(antenaPorRenombrar({ nombreActual: 'X', nombreNuevo: null })).toBe(false);
  });
  it('propone el nombre por piso y número', () => {
    expect(nombreAntenaDeAula({ piso: 'P2', numero: '17-18' })).toBe('P2_17');
    expect(nombreAntenaDeAula({ piso: null, numero: '3' })).toBeNull();
  });
});

describe('aviso de ajustar las clases', () => {
  const nada = () => false;
  it('sale del 10 de julio al 30 de septiembre si no está hecho', () => {
    expect(avisoAjusteCursos('2027-07-09', nada)).toBeNull();
    expect(avisoAjusteCursos('2027-07-10', nada)).toBe('2027-28');
    expect(avisoAjusteCursos('2027-09-30', nada)).toBe('2027-28');
    expect(avisoAjusteCursos('2027-10-01', nada)).toBeNull();
    expect(avisoAjusteCursos('2026-11-16', nada)).toBeNull();
  });
  it('desaparece en cuanto se hace', () => {
    expect(avisoAjusteCursos('2027-08-01', (d) => d === '2027-28')).toBeNull();
  });
  it('en verano se ajusta el curso que viene; desde septiembre, el que corre', () => {
    expect(cursoParaAjustar('2027-07-15', '2026-27')).toBe('2027-28');
    expect(cursoParaAjustar('2027-06-15', '2026-27')).toBe('2026-27');
    expect(cursoParaAjustar('2027-09-10', '2027-28')).toBe('2027-28');
  });
});

describe('qué clase irá en cada aula', () => {
  const sinTutorias = {
    tutores: () => [] as string[],
    destino: () => [] as ClaseEnAula[],
    nombre: (t: string) => t,
  };
  const aula = (id: string, curso: string | null, letra: string | null, etiqueta: string | null = null) => ({
    id,
    actual: curso || etiqueta ? { curso, letra, etiqueta } : null,
  });

  it('sin tutorías, la regla de la etapa: Primaria por parejas, Infantil rota, ESO sube', () => {
    const s = sugerirOcupacion(
      [aula('a', '3PRI', 'B'), aula('b', '4PRI', 'A'), aula('c', '5INF', 'A'), aula('d', '1ESO', 'A'), aula('e', '4ESO', 'B')],
      sinTutorias.tutores,
      sinTutorias.destino,
      sinTutorias.nombre,
    );
    expect(s.map((x) => x.clase && claveClase(x.clase.curso, x.clase.letra))).toEqual(['4PRI|B', '3PRI|A', '3INF|A', '2ESO|A', null]);
    expect(s.map((x) => x.fuente)).toEqual(['regla', 'regla', 'regla', 'revisar', 'revisar']);
  });

  it('con las tutorías del curso que viene, sigue al tutor', () => {
    const s = sugerirOcupacion(
      [aula('a', '2PRI', 'B')],
      () => ['t1'],
      (t) => (t === 't1' ? [{ curso: '6PRI', letra: 'A' }] : []),
      () => 'Reyes',
    );
    expect(s[0]).toMatchObject({ clase: { curso: '6PRI', letra: 'A' }, fuente: 'tutor', motivo: 'Sigue su tutor/a, Reyes' });
  });

  it('las salas y las aulas vacías se quedan como están', () => {
    const s = sugerirOcupacion([aula('a', null, null), aula('b', null, null, 'Apoyo')], sinTutorias.tutores, sinTutorias.destino, sinTutorias.nombre);
    expect(s.map((x) => [x.clase, x.etiqueta, x.fuente])).toEqual([
      [null, null, 'mantener'],
      [null, 'Apoyo', 'mantener'],
    ]);
  });

  it('una clase en dos aulas se marca para revisar', () => {
    const s = sugerirOcupacion([aula('a', '1PRI', 'A'), aula('b', '2PRI', 'A')], () => ['t'], () => [{ curso: '2PRI', letra: 'A' }], () => 'X');
    expect(s.every((x) => x.fuente === 'revisar')).toBe(true);
  });
});

describe('robótica', () => {
  it('numera a continuación del último', () => {
    expect(siguientesCodigos('L', ['L1', 'L2', 'L3', 'L4'], 3)).toEqual(['L5', 'L6', 'L7']);
    expect(siguientesCodigos('cr', [], 2)).toEqual(['CR1', 'CR2']);
    expect(siguientesCodigos('L', ['L2', 'LX'], 1)).toEqual(['L3']);
  });
  it('propone un prefijo con las iniciales', () => {
    expect(prefijoSugerido('Codey Rocky')).toBe('CR');
    expect(prefijoSugerido('Makeblock mBot2 con placa CyberPi')).toBe('MM');
    expect(prefijoSugerido('Robot Kubo Coding')).toBe('KC');
  });
  it('dice cómo va el pedido', () => {
    expect(estadoPedido(null, 0)).toBe('sin_pedir');
    expect(estadoPedido(15, 0)).toBe('falta_todo');
    expect(estadoPedido(15, 4)).toBe('parcial');
    expect(estadoPedido(15, 15)).toBe('completo');
    expect(estadoPedido(null, 2)).toBe('completo');
  });
  it('arregla los enlaces pegados', () => {
    expect(normalizarUrl('education.lego.com/es-es')).toBe('https://education.lego.com/es-es');
    expect(normalizarUrl('  ')).toBeNull();
    expect(tituloDeUrl('https://www.makeblock.com/x')).toBe('makeblock.com');
  });
});
