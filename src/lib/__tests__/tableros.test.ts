import { describe, expect, it } from 'vitest';
import {
  accionTarjetaSchema,
  agruparMias,
  avisoQueToca,
  checklistDeTexto,
  diasEntre,
  estadoVence,
  grupoMio,
  hoyISO,
  iniciales,
  normalizarUrl,
  ordenEntre,
  proximoViernes,
  resumenUrgente,
  sumarDias,
  textoResumenUrgente,
  textoVence,
  tipoEnlace,
  tituloEnlace,
  type TarjetaMia,
} from '@/lib/tableros';
import { correoAsignacion, correoVencimientos, fraseVence } from '@/lib/tableros-email';
import { canAccess, ROLES } from '@/lib/permissions';

const HOY = '2026-10-07'; // miércoles

describe('fechas', () => {
  it('hoy va en hora de Madrid, no en UTC', () => {
    // 23:30 UTC del 6 de octubre ya es día 7 en Madrid (UTC+2 en horario de verano).
    expect(hoyISO(new Date('2026-10-06T23:30:00Z'))).toBe('2026-10-07');
  });

  it('cuenta días hacia delante y hacia atrás', () => {
    expect(diasEntre(HOY, '2026-10-08')).toBe(1);
    expect(diasEntre(HOY, '2026-10-01')).toBe(-6);
    expect(sumarDias('2026-10-30', 3)).toBe('2026-11-02');
  });

  it('el próximo viernes, o hoy si es viernes', () => {
    expect(proximoViernes(HOY)).toBe('2026-10-09');
    expect(proximoViernes('2026-10-09')).toBe('2026-10-09');
    expect(proximoViernes('2026-10-10')).toBe('2026-10-16');
  });

  it('clasifica el deadline', () => {
    expect(estadoVence(null, HOY).estado).toBe('sin');
    expect(estadoVence('2026-10-06', HOY).estado).toBe('vencida');
    expect(estadoVence(HOY, HOY).estado).toBe('hoy');
    expect(estadoVence('2026-10-08', HOY).estado).toBe('manana');
    expect(estadoVence('2026-10-10', HOY).estado).toBe('pronto');
    expect(estadoVence('2026-10-20', HOY).estado).toBe('futura');
    // Lo terminado no avisa aunque se haya pasado la fecha.
    expect(estadoVence('2026-10-01', HOY, true).estado).toBe('hecha');
  });

  it('lee el deadline como se dice', () => {
    expect(textoVence(HOY, HOY)).toBe('Hoy');
    expect(textoVence('2026-10-08', HOY)).toBe('Mañana');
    expect(textoVence('2026-10-06', HOY)).toBe('Ayer');
    expect(textoVence('2026-10-04', HOY)).toBe('Hace 3 días');
    expect(textoVence('2026-10-09', HOY)).toBe('Viernes');
    expect(textoVence('2026-11-20', HOY)).toBe('20 nov');
  });
});

describe('orden dentro de una columna', () => {
  it('mete una tarjeta entre dos sin renumerar', () => {
    expect(ordenEntre(1024, 2048)).toBe(1536);
    expect(ordenEntre(null, 1024)).toBe(0);
    expect(ordenEntre(2048, null)).toBe(3072);
    expect(ordenEntre(null, null)).toBe(1024);
  });
});

describe('personas y enlaces', () => {
  it('iniciales', () => {
    expect(iniciales('Ana Pérez Gil')).toBe('AP');
    expect(iniciales('David')).toBe('DA');
    expect(iniciales('', 'tic@colegio.es')).toBe('TI');
  });

  it('normaliza lo que se pega', () => {
    expect(normalizarUrl('drive.google.com/drive/folders/abc')).toBe('https://drive.google.com/drive/folders/abc');
    expect(normalizarUrl('/gestion/alumnado?c=1ESOA')).toBe('/gestion/alumnado?c=1ESOA');
    expect(normalizarUrl('hola')).toBeNull();
    expect(normalizarUrl('javascript:alert(1)')).toBeNull();
    expect(normalizarUrl('')).toBeNull();
  });

  it('reconoce el tipo de enlace para ponerle icono', () => {
    expect(tipoEnlace('https://docs.google.com/document/d/x/edit')).toBe('doc');
    expect(tipoEnlace('https://docs.google.com/spreadsheets/d/x')).toBe('hoja');
    expect(tipoEnlace('https://drive.google.com/drive/folders/x')).toBe('drive');
    expect(tipoEnlace('https://classroom.google.com/c/x')).toBe('classroom');
    expect(tipoEnlace('/gestion/horarios')).toBe('tools');
    expect(tipoEnlace('https://tools.ejemplo.es/gestion', 'tools.ejemplo.es')).toBe('tools');
    expect(tipoEnlace('https://ejemplo.es')).toBe('web');
  });

  it('título de un enlace sin título', () => {
    expect(tituloEnlace({ url: 'https://www.ejemplo.es/pagina', titulo: null })).toBe('ejemplo.es/pagina');
    expect(tituloEnlace({ url: 'https://ejemplo.es', titulo: '  Manual  ' })).toBe('Manual');
  });
});

function mia(id: string, vence: string | null, prioridad: TarjetaMia['prioridad'] = null): TarjetaMia {
  return {
    id,
    titulo: id,
    prioridad,
    vence,
    tableroId: 't',
    tableroNombre: 'Tablero',
    tableroEmoji: '📋',
    equipoNombre: 'Equipo',
    columnaNombre: 'Por hacer',
    checklistHechos: 0,
    checklistTotal: 0,
  };
}

describe('lo tuyo', () => {
  it('agrupa por cercanía de la fecha', () => {
    expect(grupoMio('2026-10-01', HOY)).toBe('vencidas');
    expect(grupoMio('2026-10-08', HOY)).toBe('hoy');
    expect(grupoMio('2026-10-12', HOY)).toBe('semana');
    expect(grupoMio('2026-11-12', HOY)).toBe('despues');
    expect(grupoMio(null, HOY)).toBe('sin');
  });

  it('ordena por fecha y, a igual fecha, lo urgente primero', () => {
    const grupos = agruparMias([mia('b', HOY, 'baja'), mia('a', HOY, 'urgente'), mia('c', null), mia('v', '2026-10-01')], HOY);
    expect(grupos.map((g) => g.grupo)).toEqual(['vencidas', 'hoy', 'sin']);
    expect(grupos[1].tarjetas.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('resume lo urgente para el aviso general', () => {
    const r = resumenUrgente([mia('1', '2026-10-01'), mia('2', HOY), mia('3', '2026-10-08'), mia('4', null), mia('5', '2026-10-20')], HOY);
    expect(r).toEqual({ vencidas: 1, hoy: 1, manana: 1 });
    expect(textoResumenUrgente(r)).toBe('1 vencida · 1 para hoy · 1 para mañana');
    expect(textoResumenUrgente({ vencidas: 0, hoy: 0, manana: 0 })).toBeNull();
  });
});

describe('avisos de vencimiento', () => {
  const t = (vence: string, prox: string | null = null, venc: string | null = null) => ({
    id: 'x',
    vence,
    avisoProximoPara: prox,
    avisoVencidoPara: venc,
  });

  it('avisa una vez de que vence y otra de que ha vencido', () => {
    expect(avisoQueToca(t('2026-10-08'), HOY)).toBe('proximo');
    expect(avisoQueToca(t('2026-10-08', '2026-10-08'), HOY)).toBeNull();
    expect(avisoQueToca(t('2026-10-06', '2026-10-06'), HOY)).toBe('vencido');
    expect(avisoQueToca(t('2026-10-06', '2026-10-06', '2026-10-06'), HOY)).toBeNull();
    expect(avisoQueToca(t('2026-10-12'), HOY)).toBeNull();
  });

  it('si cambia el deadline, vuelve a avisar', () => {
    expect(avisoQueToca(t('2026-10-08', '2026-10-01', '2026-10-01'), HOY)).toBe('proximo');
  });

  it('el viernes avisa también de lo del lunes', () => {
    expect(avisoQueToca(t('2026-10-12'), '2026-10-09', 3)).toBe('proximo');
  });
});

describe('checklist', () => {
  it('una línea por item, sin viñetas', () => {
    let n = 0;
    const items = checklistDeTexto('- Comprar cable\n\n* Probar proyector\n1. Avisar', () => String(++n));
    expect(items.map((i) => i.texto)).toEqual(['Comprar cable', 'Probar proyector', 'Avisar']);
    expect(items.every((i) => !i.hecho)).toBe(true);
  });
});

describe('validación', () => {
  it('una edición sin descripción no la borra', () => {
    const r = accionTarjetaSchema.parse({ accion: 'editar', titulo: 'Hola' });
    expect(r.accion === 'editar' && r.descripcion).toBeUndefined();
    const vacia = accionTarjetaSchema.parse({ accion: 'editar', descripcion: '' });
    expect(vacia.accion === 'editar' && vacia.descripcion).toBeNull();
  });
});

describe('correos', () => {
  it('frases del deadline', () => {
    expect(fraseVence(HOY, HOY)).toBe('vence hoy');
    expect(fraseVence('2026-10-08', HOY)).toBe('vence mañana');
    expect(fraseVence('2026-10-04', HOY)).toBe('venció hace 3 días');
  });

  it('el de asignación escapa el HTML y lleva el enlace', () => {
    const { subject, html } = correoAsignacion({
      saludo: 'Ana',
      quien: 'David Soler',
      hoy: HOY,
      tarjeta: {
        titulo: 'Proyector <roto>',
        tablero: '🛠️ Mantenimiento',
        equipo: 'TIC',
        vence: '2026-10-08',
        prioridad: 'alta',
        url: 'https://tools.ejemplo.es/gestion/tableros/1?t=2',
      },
    });
    expect(subject).toBe('Tarea para ti: Proyector <roto>');
    expect(html).toContain('Proyector &lt;roto&gt;');
    expect(html).toContain('https://tools.ejemplo.es/gestion/tableros/1?t=2');
    expect(html).toContain('vence mañana');
  });

  it('el diario separa lo que vence de lo vencido', () => {
    const base = { tablero: 'T', equipo: 'E', prioridad: null, url: 'u' } as const;
    const { subject, html } = correoVencimientos({
      saludo: 'Ana',
      hoy: HOY,
      url: 'u',
      items: [
        { ...base, titulo: 'Una', vence: '2026-10-08', tipo: 'proximo' },
        { ...base, titulo: 'Otra', vence: '2026-10-01', tipo: 'vencido' },
      ],
    });
    expect(subject).toBe('Tus tareas: 1 vence ya y 1 se ha pasado de fecha');
    expect(html).toContain('Vence ya');
    expect(html).toContain('Se ha pasado de fecha');
  });
});

describe('permisos', () => {
  it('todo el claustro tiene el módulo (lo que se ve lo decide ser miembro del equipo)', () => {
    for (const role of ROLES) expect(canAccess({ role }, 'tableros')).toBe(true);
  });
});
