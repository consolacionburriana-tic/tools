import { describe, expect, it } from 'vitest';
import {
  autocompletar,
  avisoAlConfirmar,
  avisoTrasCambio,
  candidatosHueco,
  chipEstado,
  claveHorario,
  clasesDeTipo,
  crearContexto,
  diaSemana,
  etiquetaClase,
  franjasDeEtapas,
  horaDeClase,
  indexarHorario,
  lunesDe,
  molestiasPorProfe,
  nivelEn,
  pascua,
  progresoTipo,
  sesionDePropuesta,
  siguienteNivel,
  siguienteNumero,
  tituloEvento,
  trimestreDe,
  trimestresPorDefecto,
  unidadesCurso,
  type ContextoPlan,
  type HuecoHorario,
  type SesionOra,
  type TipoMomento,
} from '@/lib/oratorios';
import { correoProfe } from '@/lib/oratorios-email';
import { cuerpoEvento } from '@/lib/oratorios-google';
import { conComo, type Remitente } from '@/lib/email';

// ─── Datos inventados ─────────────────────────────────────────────────────────

const ORATORIO: TipoMomento = {
  id: 't-ora',
  codigo: 'oratorio',
  nombre: 'Oratorio',
  nombreCorreo: 'oratorio',
  emoji: '🙏',
  calendarioId: 'cal-ora',
  frecuencia: 'mes',
  cantidad: 1,
  etapas: ['ESO'],
  clases: null,
  textoCorreo: 'Será primero la mitad de la clase y luego la otra mitad.',
  avisoDias: 7,
  orden: 0,
  activo: true,
};
const GODLY: TipoMomento = { ...ORATORIO, id: 't-godly', codigo: 'godly', nombre: 'Godly Play', nombreCorreo: 'Godly Play', frecuencia: 'trimestre', etapas: ['EP'], textoCorreo: null };

const TRIMESTRES = trimestresPorDefecto('2026-27', '2026-09-08');
const PERIODOS = [{ id: 'p1', fechaInicio: '2026-09-01', fechaFin: '2027-05-31', prioridad: 0, esOrdinario: true }];

const ANA = { id: '11111111-1111-4111-8111-111111111111', nombre: 'Ana García', titular: true };
const PEPE = { id: '22222222-2222-4222-8222-222222222222', nombre: 'Pepe Ruiz', titular: true };
const LUIS = { id: '33333333-3333-4333-8333-333333333333', nombre: 'Luis Mora', titular: true };

function h(curso: string, letra: string, dia: number, horaInicio: string, horaFin: string, materia: string, profes = [ANA]): HuecoHorario {
  return { periodoId: 'p1', curso, letra, dia, horaInicio, horaFin, materia, actividad: 'clase', profes };
}

// Lunes 9:50: 1ESO A Mates con Ana, 1ESO B Lengua con Pepe. Martes 9:50: 1ESO A Inglés con Luis.
const HORARIO: HuecoHorario[] = [
  h('1ESO', 'A', 1, '09:50', '10:45', 'Matemáticas', [ANA]),
  h('1ESO', 'B', 1, '09:50', '10:45', 'Lengua', [PEPE]),
  h('1ESO', 'A', 2, '09:50', '10:45', 'Inglés', [LUIS]),
  h('1ESO', 'B', 2, '09:50', '10:45', 'Matemáticas', [ANA]),
];

let n = 0;
function sesion(p: Partial<SesionOra>): SesionOra {
  n++;
  return {
    ...sesionDePropuesta(
      { tipoId: ORATORIO.id, curso: '1ESO', letra: 'A', fecha: '2026-10-05', horaInicio: '09:50', horaFin: '10:45', profes: [{ id: ANA.id, nombre: ANA.nombre, materia: 'Matemáticas' }] },
      'yo@consolacionburriana.com',
      `s${n}`,
    ),
    estado: 'confirmado',
    numero: 1,
    ...p,
  };
}

function ctx(sesiones: SesionOra[] = [], extra: Partial<ContextoPlan> = {}): ContextoPlan {
  return crearContexto({
    tipos: [ORATORIO, GODLY],
    sesiones,
    horario: HORARIO,
    periodos: PERIODOS,
    trimestres: TRIMESTRES,
    festivos: [{ inicio: '2026-10-12', fin: '2026-10-12' }],
    salidas: [],
    hoy: '2026-09-30',
    ...extra,
  });
}

const CLASES_ESO = [
  { curso: '1ESO', letra: 'A' },
  { curso: '1ESO', letra: 'B' },
];

// ─── Fechas y trimestres ─────────────────────────────────────────────────────

describe('fechas', () => {
  it('día de la semana sin líos de zona horaria', () => {
    expect(diaSemana('2026-10-05')).toBe(1); // lunes
    expect(diaSemana('2026-10-11')).toBe(7); // domingo
    expect(lunesDe('2026-10-08')).toBe('2026-10-05');
  });

  it('Pascua', () => {
    expect(pascua(2027)).toBe('2027-03-28');
    expect(pascua(2026)).toBe('2026-04-05');
  });

  it('trimestres por defecto: T2 acaba el viernes antes de Ramos y T3 empieza tras Pascua', () => {
    expect(TRIMESTRES).toEqual([
      { inicio: '2026-09-08', fin: '2026-12-22' },
      { inicio: '2027-01-07', fin: '2027-03-19' },
      { inicio: '2027-03-30', fin: '2027-06-19' },
    ]);
    expect(trimestreDe('2026-12-23', TRIMESTRES)).toBe(-1); // Navidad
    expect(trimestreDe('2027-02-01', TRIMESTRES)).toBe(1);
  });

  it('unidades del objetivo: meses lectivos recortados, o trimestres', () => {
    const meses = unidadesCurso('mes', TRIMESTRES);
    expect(meses[0]).toEqual({ clave: '2026-09', etiqueta: 'sep', inicio: '2026-09-08', fin: '2026-09-30' });
    expect(meses.at(-1)).toEqual({ clave: '2027-06', etiqueta: 'jun', inicio: '2027-06-01', fin: '2027-06-19' });
    expect(meses).toHaveLength(10);
    expect(unidadesCurso('trimestre', TRIMESTRES).map((u) => u.clave)).toEqual(['T1', 'T2', 'T3']);
  });
});

// ─── Clases ──────────────────────────────────────────────────────────────────

describe('clases', () => {
  it('etiqueta del evento con espacio: [4 ESO B]', () => {
    expect(etiquetaClase({ curso: '4ESO', letra: 'B' })).toBe('4 ESO B');
    expect(etiquetaClase({ curso: '3PRI', letra: 'A' })).toBe('3 PRI A');
  });

  it('el PDC se busca en el horario como 3ESO + PDC', () => {
    expect(claveHorario({ curso: '3ºPPDC', letra: 'PDC' })).toBe('3ESO|PDC');
    expect(claveHorario({ curso: '2ESO', letra: 'B' })).toBe('2ESO|B');
  });

  it('clases de un tipo: sus etapas con el PDC dentro, o su lista fija', () => {
    const alumnado = [
      { curso: '1ESO', letra: 'A' },
      { curso: '3ºPPDC', letra: 'PDC' },
      { curso: '3PRI', letra: 'A' },
    ];
    expect(clasesDeTipo(ORATORIO, alumnado)).toEqual([
      { curso: '1ESO', letra: 'A' },
      { curso: '3ºPPDC', letra: 'PDC' },
    ]);
    expect(etiquetaClase({ curso: '4ºPPDC', letra: 'PDC' })).toBe('4º PDC');
    expect(clasesDeTipo({ ...ORATORIO, clases: ['3ºPPDC|PDC'] }, alumnado)).toEqual([{ curso: '3ºPPDC', letra: 'PDC' }]);
  });

  it('número de sesión: el primer hueco libre, sin contar las anuladas', () => {
    const s = [sesion({ numero: 1 }), sesion({ numero: 2, estado: 'anulado' }), sesion({ numero: 3 })];
    expect(siguienteNumero(s, ORATORIO.id, { curso: '1ESO', letra: 'A' })).toBe(2);
    expect(siguienteNumero(s, ORATORIO.id, { curso: '1ESO', letra: 'B' })).toBe(1);
    expect(siguienteNumero(s, GODLY.id, { curso: '1ESO', letra: 'A' })).toBe(1);
  });
});

// ─── Horario y disponibilidad ──────────────────────────────────────────────────

describe('horario', () => {
  it('qué tiene una clase a esa hora, con la hora de SU tramo', () => {
    const idx = indexarHorario(HORARIO);
    const r = horaDeClase(idx, PERIODOS, { curso: '1ESO', letra: 'A' }, '2026-10-05', { horaInicio: '10:00', horaFin: '10:30' });
    expect(r).toMatchObject({ horaInicio: '09:50', horaFin: '10:45', materias: ['Matemáticas'] });
    expect(r?.profes.map((p) => p.nombre)).toEqual(['Ana García']);
    expect(horaDeClase(idx, PERIODOS, { curso: '1ESO', letra: 'A' }, '2026-10-05', { horaInicio: '12:00', horaFin: '13:00' })).toBeNull();
  });

  it('en un desdoble pierden la hora todos los titulares; los apoyos no', () => {
    const apoyo = { id: '44444444-4444-4444-8444-444444444444', nombre: 'PT', titular: false };
    const idx = indexarHorario([h('2ESO', 'A', 1, '08:00', '08:55', 'Religión', [ANA, apoyo]), h('2ESO', 'A', 1, '08:00', '08:55', 'Valores', [PEPE])]);
    const r = horaDeClase(idx, PERIODOS, { curso: '2ESO', letra: 'A' }, '2026-10-05', { horaInicio: '08:00', horaFin: '08:55' });
    expect(r?.profes.map((p) => p.nombre)).toEqual(['Ana García', 'Pepe Ruiz']);
  });

  it('franjas de la rejilla de unas etapas, sin recreos ni repetidas', () => {
    const f = franjasDeEtapas(
      [
        { etapa: 'ESO', dia: 1, horaInicio: '08:55', horaFin: '09:50', tipo: 'sesion' },
        { etapa: 'ESO', dia: 1, horaInicio: '08:00', horaFin: '08:55', tipo: 'sesion' },
        { etapa: 'ESO', dia: 2, horaInicio: '08:00', horaFin: '08:55', tipo: 'sesion' },
        { etapa: 'ESO', dia: 1, horaInicio: '10:45', horaFin: '11:05', tipo: 'recreo' },
        { etapa: 'EP', dia: 1, horaInicio: '09:00', horaFin: '09:45', tipo: 'sesion' },
      ],
      ['ESO'],
    );
    expect(f).toEqual([
      { horaInicio: '08:00', horaFin: '08:55' },
      { horaInicio: '08:55', horaFin: '09:50' },
    ]);
  });

  it('niveles: el toque cicla ⭐ → 👍 → 🤏 → nada', () => {
    expect(siguienteNivel(null)).toBe('optima');
    expect(siguienteNivel('optima')).toBe('alternativa');
    expect(siguienteNivel('alternativa')).toBe('ultima');
    expect(siguienteNivel('ultima')).toBeNull();
    expect(nivelEn([{ dia: 1, horaInicio: '09:50', horaFin: '10:45', nivel: 'optima' }], 1, { horaInicio: '09:50', horaFin: '10:45' })).toBe('optima');
  });
});

// ─── Avisos y candidatos ──────────────────────────────────────────────────────

describe('candidatos de un hueco', () => {
  const LUNES_950 = { horaInicio: '09:50', horaFin: '10:45' };

  it('sin nada planificado, salen las dos clases que tienen clase a esa hora, con su profe', () => {
    const c = candidatosHueco(ctx(), ORATORIO, CLASES_ESO, '2026-10-05', LUNES_950);
    expect(c.map((x) => x.clave)).toEqual(['1ESO|A', '1ESO|B']);
    expect(c[0].hora.profes[0].nombre).toBe('Ana García');
    expect(c[0].avisos).toEqual([]);
    expect(c[0].necesita).toBe(1);
  });

  it('🔴 misma clase, mismo profe, misma hora de la semana que la sesión anterior', () => {
    const previa = sesion({ fecha: '2026-10-05', numero: 1 }); // lunes 9:50 1ESO A con Ana
    const c = candidatosHueco(ctx([previa]), ORATORIO, CLASES_ESO, '2026-11-02', LUNES_950); // otro lunes 9:50
    const a = c.find((x) => x.clave === '1ESO|A')!;
    expect(a.avisos.map((x) => x.codigo)).toContain('mismo_hueco');
    // Y por eso sale detrás de 1ESO B, que está limpia.
    expect(c[0].clave).toBe('1ESO|B');
  });

  it('🔴 también mirando la SIGUIENTE (si se planifica hacia atrás)', () => {
    const despues = sesion({ fecha: '2026-11-02' });
    const a = candidatosHueco(ctx([despues]), ORATORIO, CLASES_ESO, '2026-10-05', LUNES_950).find((x) => x.clave === '1ESO|A')!;
    expect(a.avisos.map((x) => x.codigo)).toContain('mismo_hueco');
  });

  it('🟡 mismo profe que la anterior pero a otra hora no es rojo', () => {
    const previa = sesion({ fecha: '2026-10-06', curso: '1ESO', letra: 'B', profes: [{ id: ANA.id, nombre: ANA.nombre, materia: 'Matemáticas' }] }); // martes
    const b = candidatosHueco(ctx([previa]), ORATORIO, CLASES_ESO, '2026-11-02', LUNES_950).find((x) => x.clave === '1ESO|B')!;
    // El lunes 1ESO B tiene a Pepe: no comparte profe con la anterior (Ana).
    expect(b.avisos.map((x) => x.codigo)).not.toContain('mismo_profe');
    const b2 = candidatosHueco(ctx([previa]), ORATORIO, CLASES_ESO, '2026-11-03', LUNES_950).find((x) => x.clave === '1ESO|B')!;
    // Martes 9:50 1ESO B vuelve a ser Ana a la misma hora → rojo, no amarillo.
    expect(b2.avisos.map((x) => x.codigo)).toContain('mismo_hueco');
  });

  it('×N: cuántas lleva ya ese profe este trimestre, en cualquier clase y tipo', () => {
    const otras = [
      sesion({ fecha: '2026-10-06', curso: '1ESO', letra: 'B' }),
      sesion({ fecha: '2026-10-20', curso: '2ESO', letra: 'A', tipoId: GODLY.id }),
      sesion({ fecha: '2027-02-01', curso: '2ESO', letra: 'A' }), // otro trimestre: no cuenta
    ];
    const a = candidatosHueco(ctx(otras), ORATORIO, CLASES_ESO, '2026-11-02', LUNES_950).find((x) => x.clave === '1ESO|A')!;
    const aviso = a.avisos.find((x) => x.codigo === 'profe_trimestre')!;
    expect(aviso.simbolo).toBe('×2');
    expect(aviso.nivel).toBe('naranja');
  });

  it('✓ si la clase ya tiene cubierto el mes, va al final', () => {
    const yaEsteMes = sesion({ fecha: '2026-10-20', curso: '1ESO', letra: 'A', profes: [{ id: LUIS.id, nombre: LUIS.nombre, materia: 'Inglés' }] });
    const c = candidatosHueco(ctx([yaEsteMes]), ORATORIO, CLASES_ESO, '2026-10-05', LUNES_950);
    expect(c.map((x) => x.clave)).toEqual(['1ESO|B', '1ESO|A']);
    expect(c[1].necesita).toBe(0);
    expect(c[1].avisos.map((x) => x.codigo)).toContain('cubierta');
  });

  it('🚌 salida ese día y 📅 otra sesión el mismo día', () => {
    const mismoDia = sesion({ fecha: '2026-10-05', horaInicio: '12:10', horaFin: '13:05', tipoId: GODLY.id, profes: [] });
    const c = candidatosHueco(
      ctx([mismoDia], { salidas: [{ fecha: '2026-10-05', nombre: 'Museo', clases: ['1ESO|A'] }] }),
      ORATORIO,
      CLASES_ESO,
      '2026-10-05',
      LUNES_950,
    ).find((x) => x.clave === '1ESO|A')!;
    expect(c.avisos.map((x) => x.codigo)).toEqual(expect.arrayContaining(['salida', 'mismo_dia']));
  });

  it('si quien lo lleva da esa clase a esa hora, no cuenta como profe molestado', () => {
    const c = candidatosHueco({ ...ctx(), responsableProfeId: ANA.id }, ORATORIO, CLASES_ESO, '2026-10-05', LUNES_950);
    const a = c.find((x) => x.clave === '1ESO|A')!;
    expect(a.hora.profes).toEqual([]);
  });

  it('al mover una sesión no se compara consigo misma', () => {
    const s = sesion({ fecha: '2026-10-05' });
    const a = candidatosHueco(ctx([s]), ORATORIO, CLASES_ESO, '2026-10-19', LUNES_950, s.id).find((x) => x.clave === '1ESO|A')!;
    expect(a.avisos).toEqual([]);
    expect(a.necesita).toBe(1);
  });
});

// ─── Autocompletar ───────────────────────────────────────────────────────────

describe('autocompletar', () => {
  const DISP = [
    { dia: 1, horaInicio: '09:50', horaFin: '10:45', nivel: 'optima' as const },
    { dia: 2, horaInicio: '09:50', horaFin: '10:45', nivel: 'alternativa' as const },
  ];

  it('cubre una sesión por clase y mes, primero en los huecos ⭐', () => {
    const p = autocompletar(ctx(), ORATORIO, CLASES_ESO, { inicio: '2026-10-01', fin: '2026-10-31' }, DISP, { email: 'yo@consolacionburriana.com', profeId: null });
    expect(p).toHaveLength(2);
    // Los dos primeros lunes lectivos de octubre (el 12 es festivo, da igual: no hace falta).
    // Lunes 5 → 1ESO A; el 12 es festivo; lunes 19 → 1ESO B. Los martes 👍 no hacen falta.
    expect(p.map((x) => `${x.fecha} ${x.curso}${x.letra}`)).toEqual(['2026-10-05 1ESOA', '2026-10-19 1ESOB']);
  });

  it('no pone dos el mismo día al responsable en el mismo hueco, ni salta festivos', () => {
    const p = autocompletar(ctx(), ORATORIO, CLASES_ESO, { inicio: '2026-10-12', fin: '2026-10-12' }, DISP, { email: 'yo@consolacionburriana.com', profeId: null });
    expect(p).toEqual([]); // 12-oct festivo
  });

  it('nunca propone un 🔴', () => {
    const previa = sesion({ fecha: '2026-09-28', numero: 1 }); // lunes 9:50 1ESO A, septiembre
    const p = autocompletar(ctx([previa], { hoy: '2026-09-30' }), ORATORIO, [{ curso: '1ESO', letra: 'A' }], { inicio: '2026-10-01', fin: '2026-10-31' }, [DISP[0]], {
      email: 'yo@consolacionburriana.com',
      profeId: null,
    });
    expect(p).toEqual([]); // el único hueco ⭐ es su misma hora de siempre
  });

  it('usa los 👍 cuando los ⭐ no bastan, y 🤏 nunca', () => {
    const p = autocompletar(ctx(), ORATORIO, CLASES_ESO, { inicio: '2026-10-05', fin: '2026-10-06' }, DISP, { email: 'yo@consolacionburriana.com', profeId: null });
    expect(p.map((x) => diaSemana(x.fecha)).sort()).toEqual([1, 2]);
    const soloUltima = autocompletar(ctx(), ORATORIO, CLASES_ESO, { inicio: '2026-10-05', fin: '2026-10-31' }, [{ ...DISP[0], nivel: 'ultima' }], {
      email: 'yo@consolacionburriana.com',
      profeId: null,
    });
    expect(soloUltima).toEqual([]);
  });
});

// ─── Progreso y molestias ──────────────────────────────────────────────────────

describe('números', () => {
  it('progreso por clase y mes: hechas, programadas, borradores y por hacer', () => {
    const s = [
      sesion({ fecha: '2026-09-21', estado: 'confirmado' }), // hecha (hoy es 30-sep)
      sesion({ fecha: '2026-10-05', estado: 'borrador' }),
      sesion({ fecha: '2026-11-02', estado: 'confirmado' }), // programada
      sesion({ fecha: '2026-12-01', estado: 'anulado' }), // no cuenta
    ];
    const unidades = unidadesCurso('mes', TRIMESTRES).slice(0, 4);
    const [fila] = progresoTipo(ORATORIO, [{ curso: '1ESO', letra: 'A' }], s, unidades, '2026-09-30');
    expect(fila.celdas.map((c) => [c.hechas, c.programadas, c.borradores, c.porHacer])).toEqual([
      [1, 0, 0, 0],
      [0, 0, 1, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 1],
    ]);
    expect(fila.total.porHacer).toBe(1);
  });

  it('a quién se ha molestado más, por trimestre; los borradores aparte', () => {
    const s = [
      sesion({ fecha: '2026-10-05' }),
      sesion({ fecha: '2027-02-01' }),
      sesion({ fecha: '2026-10-06', estado: 'borrador' }),
      sesion({ fecha: '2026-10-07', profes: [{ id: PEPE.id, nombre: PEPE.nombre, materia: null }] }),
    ];
    const m = molestiasPorProfe(s, TRIMESTRES);
    expect(m[0]).toMatchObject({ nombre: 'Ana García', total: 2, porTrimestre: [1, 1, 0], borradores: 1 });
    expect(m[1]).toMatchObject({ nombre: 'Pepe Ruiz', total: 1 });
  });
});

// ─── Estados y avisos ────────────────────────────────────────────────────────

describe('estados y avisos', () => {
  it('confirmar programa el aviso N días antes; si ya pasó, queda pendiente', () => {
    expect(avisoAlConfirmar('2026-10-20', 7, '2026-09-30')).toEqual({ avisoEstado: 'programado', avisoProgramadoPara: '2026-10-13' });
    expect(avisoAlConfirmar('2026-10-03', 7, '2026-09-30')).toEqual({ avisoEstado: 'pendiente', avisoProgramadoPara: null });
  });

  it('mover o anular algo ya avisado deja pendiente el correo de cambio o anulación', () => {
    expect(avisoTrasCambio({ avisoEstado: 'enviado' }, 'mover')).toEqual({ avisoEstado: 'pendiente', avisoTipo: 'cambio' });
    expect(avisoTrasCambio({ avisoEstado: 'programado' }, 'mover')).toBeNull();
    expect(avisoTrasCambio({ avisoEstado: 'enviado' }, 'anular')).toEqual({ avisoEstado: 'pendiente', avisoTipo: 'anulacion' });
    expect(avisoTrasCambio({ avisoEstado: 'programado' }, 'anular')).toEqual({ avisoEstado: 'no', avisoTipo: 'aviso' });
  });

  it('una confirmada con fecha pasada es una hecha', () => {
    expect(chipEstado({ estado: 'confirmado', fecha: '2026-09-01' }, '2026-09-30').texto).toBe('Hecha');
    expect(chipEstado({ estado: 'confirmado', fecha: '2026-10-01' }, '2026-09-30').texto).toBe('Confirmada');
  });
});

// ─── Evento y correo ─────────────────────────────────────────────────────────

describe('evento de Google Calendar', () => {
  it('título [4 ESO B] Oratorio - Ana García', () => {
    const s = sesion({ curso: '4ESO', letra: 'B' });
    expect(tituloEvento(ORATORIO, s)).toBe('[4 ESO B] Oratorio - Ana García');
    expect(tituloEvento(ORATORIO, { ...s, profes: [], profeId: null })).toBe('[4 ESO B] Oratorio');
  });

  it('invita al profe y a quien lo lleva, en hora de Madrid y con la marca de origen', () => {
    const s = sesion({ curso: '4ESO', letra: 'B', numero: 2 });
    const ev = cuerpoEvento({ tipo: ORATORIO, sesion: s, correos: new Map([[ANA.id, 'ana@consolacionburriana.com']]) });
    expect(ev.start).toEqual({ dateTime: '2026-10-05T09:50:00', timeZone: 'Europe/Madrid' });
    expect(ev.attendees?.map((a) => a.email)).toEqual(['ana@consolacionburriana.com', 'yo@consolacionburriana.com']);
    expect(ev.extendedProperties?.private).toEqual({ origen: 'tools-oratorios', sesionId: s.id });
    expect(ev.description).toContain('Sesión 2');
  });
});

describe('correo al profe', () => {
  const item = { fecha: '2026-10-13', horaInicio: '09:50', horaFin: '10:45', clase: '4 ESO B', materia: 'Matemáticas' };

  it('aviso: saludo, bloque con día/hora/clase/asignatura, texto del tipo y firma a secas', () => {
    const { subject, html } = correoProfe({ tipoCorreo: 'aviso', nombreCorreo: 'oratorio', textoExtra: ORATORIO.textoCorreo, saludo: 'Ana', firma: 'David', items: [item] });
    expect(subject).toBe('Oratorio con 4 ESO B · martes, 13 de octubre');
    expect(html).toContain('Hola Ana,');
    expect(html).toContain('Tengo previsto un momento de oratorio:');
    expect(html).toContain('Martes, 13 de octubre · 9:50 – 10:45');
    expect(html).toContain('4 ESO B · Matemáticas');
    expect(html).toContain('Será primero la mitad');
    expect(html).toContain('Gracias por tu colaboración.<br>David');
    expect(html).not.toMatch(/<img/);
  });

  it('varios momentos en un solo correo; cambio con el antes tachado; anulación sin el texto extra', () => {
    const varios = correoProfe({ tipoCorreo: 'aviso', nombreCorreo: 'oratorio', textoExtra: null, saludo: 'Ana', firma: 'David', items: [item, { ...item, fecha: '2026-11-10' }] });
    expect(varios.subject).toBe('Oratorio · 2 momentos');
    expect(varios.html).toContain('unos momentos de oratorio');
    const cambio = correoProfe({ tipoCorreo: 'cambio', nombreCorreo: 'oratorio', textoExtra: null, saludo: 'Ana', firma: 'David', items: [{ ...item, antes: { fecha: '2026-10-06', horaInicio: '08:00', horaFin: '08:55' } }] });
    expect(cambio.subject.startsWith('Cambio:')).toBe(true);
    expect(cambio.html).toContain('line-through');
    const anul = correoProfe({ tipoCorreo: 'anulacion', nombreCorreo: 'oratorio', textoExtra: 'Mitades', saludo: 'Ana', firma: 'David', items: [item] });
    expect(anul.html).not.toContain('Mitades');
    expect(anul.html).toContain('Gracias igualmente.');
  });

  it('escapa lo que venga de la BBDD', () => {
    const { html } = correoProfe({ tipoCorreo: 'aviso', nombreCorreo: 'oratorio', textoExtra: null, saludo: '<b>Ana</b>', firma: 'D', items: [item] });
    expect(html).toContain('&lt;b&gt;Ana&lt;/b&gt;');
  });
});

describe('correo «como» una persona', () => {
  const base: Remitente = { nombre: 'Oratorios', email: 'no-responder@consolacionburriana.com', buzon: 'no-responder@consolacionburriana.com', transporte: 'gmail' };

  it('con Gmail sale del buzón de la persona si es del dominio', () => {
    expect(conComo(base, { nombre: 'David Soler', email: 'david@consolacionburriana.com' })).toMatchObject({
      nombre: 'David Soler',
      email: 'david@consolacionburriana.com',
      buzon: 'david@consolacionburriana.com',
    });
  });

  it('fuera del dominio o con Resend: el remitente del perfil con su nombre y su Reply-To', () => {
    expect(conComo(base, { nombre: 'X', email: 'x@gmail.com' })).toMatchObject({ email: base.email, buzon: base.buzon, replyTo: 'x@gmail.com' });
    expect(conComo({ ...base, transporte: 'resend' }, { nombre: 'David', email: 'david@consolacionburriana.com' })).toMatchObject({
      nombre: 'David',
      email: base.email,
      replyTo: 'david@consolacionburriana.com',
    });
  });
});
