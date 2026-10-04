import { describe, expect, it } from 'vitest';
import {
  autocompletar,
  avisoAlConfirmar,
  avisoTrasCambio,
  candidatosHueco,
  chipEstado,
  claveHorario,
  clasesDeTipo,
  clasesSinHorario,
  crearContexto,
  cursosAcademicosElegibles,
  describirUsos,
  diaSemana,
  esEnlaceSeguro,
  etiquetaClase,
  etiquetaNivel,
  franjasDeEtapas,
  generacion,
  horaDeClase,
  indexarHorario,
  lunesDe,
  molestiasPorProfe,
  nivelEn,
  nivelesDeTipo,
  nuevaSesionSchema,
  opcionesSesion,
  ordenarOpciones,
  ordinalNivel,
  pascua,
  progresoTipo,
  sesionCatalogoSchema,
  sesionDePropuesta,
  sesionPorDefecto,
  siguienteNivel,
  siguienteNumero,
  tituloEvento,
  trimestreDe,
  trimestresPorDefecto,
  unidadesCurso,
  usosDeSesiones,
  usosHistoricos,
  usosQueChocan,
  type ContextoPlan,
  type HuecoHorario,
  type SesionCatalogo,
  type SesionOra,
  type TipoMomento,
  type UsoSesion,
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
  sinRepetir: true,
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

// ─── El abanico de sesiones ───────────────────────────────────────────────────

describe('el abanico de sesiones', () => {
  const NIVELES = ['1ESO', '2ESO', '3ESO', '4ESO'];
  const ANIO = '2026-27';
  let nc = 0;
  function cat(p: Partial<SesionCatalogo> = {}): SesionCatalogo {
    nc++;
    return { id: `c${nc}`, tipoId: ORATORIO.id, nombre: `Sesión ${nc}`, enlace: null, academicYear: null, cursos: null, orden: nc, activo: true, ...p };
  }
  function uso(catalogoId: string, academicYear: string, curso: string, letra: string | null = null): UsoSesion {
    return { catalogoId, academicYear, curso, letra };
  }
  const clase = (curso: string, letra: string | null = null) => ({ curso, letra });
  function ctxAbanico(catalogo: SesionCatalogo[], sesiones: SesionOra[] = [], extra: Partial<ContextoPlan> = {}): ContextoPlan {
    return ctx(sesiones, { academicYear: ANIO, catalogo, nivelesPorTipo: { [ORATORIO.id]: NIVELES }, ...extra });
  }

  describe('generaciones: la vida escolar del alumno', () => {
    it('los niveles son un solo camino de infantil a bachillerato', () => {
      expect(ordinalNivel('4ESO')! - ordinalNivel('1ESO')!).toBe(3);
      expect(ordinalNivel('1PRI')! - ordinalNivel('5INF')!).toBe(1);
      expect(ordinalNivel('1ESO')! - ordinalNivel('6PRI')!).toBe(1);
      expect(ordinalNivel('1BACH')! - ordinalNivel('4ESO')!).toBe(1);
      expect(ordinalNivel('7ESO')).toBeNull();
      expect(ordinalNivel('XYZ')).toBeNull();
    });

    it('el PDC cuenta como el curso de ESO que le corresponde', () => {
      expect(ordinalNivel('3ºPPDC')).toBe(ordinalNivel('3ESO'));
      expect(etiquetaNivel('3ºPPDC')).toBe('3º ESO');
      expect(etiquetaNivel('4INF')).toBe('4º Inf.');
    });

    it('un grupo que avanza junto conserva su generación', () => {
      expect(generacion('1ESO', '2023-24')).toBe(generacion('4ESO', '2026-27'));
      expect(generacion('1ESO', '2026-27')).not.toBe(generacion('1ESO', '2025-26'));
      expect(generacion('1ESO', 'sin curso')).toBeNull();
    });

    it('los niveles de un tipo salen en orden, con el PDC dentro de su curso', () => {
      const alumnado = [clase('4ESO', 'B'), clase('3ºPPDC', 'PDC'), clase('1ESO', 'A'), clase('3ESO', 'A'), clase('2ESO', 'A')];
      expect(nivelesDeTipo(ORATORIO, alumnado)).toEqual(['1ESO', '2ESO', '3ESO', '4ESO']);
    });
  });

  describe('qué choca con una clase', () => {
    it('una sesión hecha por todos los cursos la han visto los que siguen aquí', () => {
      // En 2025-26 la hicieron 1º, 2º, 3º y 4º. Hoy (2026-27) siguen 2º, 3º y 4º: los que estaban en 1º, 2º y 3º.
      const usos = NIVELES.map((n) => uso('a', '2025-26', n));
      expect(usosQueChocan(usos, 'a', clase('2ESO', 'A'), ANIO)).toHaveLength(1); // venían de 1º
      expect(usosQueChocan(usos, 'a', clase('4ESO', 'B'), ANIO)).toHaveLength(1); // venían de 3º
      // 1º son alumnos nuevos: no la han visto.
      expect(usosQueChocan(usos, 'a', clase('1ESO', 'A'), ANIO)).toEqual([]);
    });

    it('«la primera vez» se puede repetir cada año en 1º, pero no en 2º', () => {
      const usos = [uso('primera', '2025-26', '1ESO')];
      expect(usosQueChocan(usos, 'primera', clase('1ESO', 'A'), ANIO)).toEqual([]);
      expect(usosQueChocan(usos, 'primera', clase('2ESO', 'A'), ANIO)).toHaveLength(1);
      expect(usosQueChocan(usos, 'primera', clase('3ESO', 'A'), ANIO)).toEqual([]);
    });

    it('«dentro de 4 años»: cuando los alumnos se han ido, vuelve a estar libre', () => {
      const usos = NIVELES.map((n) => uso('a', '2022-23', n));
      for (const n of NIVELES) expect(usosQueChocan(usos, 'a', clase(n, 'A'), '2026-27')).toEqual([]);
      // Un curso antes todavía quedaba alguien: el de 4º de 2022-23 se fue, pero el de 1º llegaba a 4º en 2025-26.
      expect(usosQueChocan(usos, 'a', clase('4ESO', 'A'), '2025-26')).toHaveLength(1);
    });

    it('en el mismo curso, A y B son alumnos distintos; la misma clase sí choca consigo misma', () => {
      const usos = [uso('a', ANIO, '1ESO', 'A')];
      expect(usosQueChocan(usos, 'a', clase('1ESO', 'A'), ANIO)).toHaveLength(1);
      expect(usosQueChocan(usos, 'a', clase('1ESO', 'B'), ANIO)).toEqual([]);
      expect(usosQueChocan(usos, 'a', clase('2ESO', 'A'), ANIO)).toEqual([]);
    });

    it('un alumno de PDC ya vio lo del curso anterior de su curso de ESO', () => {
      const usos = [uso('a', '2025-26', '2ESO')];
      expect(usosQueChocan(usos, 'a', clase('3ºPPDC', 'PDC'), ANIO)).toHaveLength(1);
    });

    it('cada sesión va por separado y se describe quién la vio', () => {
      const usos = [uso('a', '2025-26', '2ESO'), uso('b', '2025-26', '2ESO')];
      expect(usosQueChocan(usos, 'b', clase('3ESO', 'A'), ANIO).map((u) => u.catalogoId)).toEqual(['b']);
      expect(describirUsos([uso('a', '2025-26', '3ESO'), uso('a', '2026-27', '1ESO', 'B')])).toBe('3º ESO (2025-26) · 1º ESO B (2026-27)');
    });
  });

  describe('de dónde salen los usos', () => {
    it('una sesión de un curso anterior cuenta como hecha por todos los niveles del tipo (o por los suyos)', () => {
      const a = cat({ academicYear: '2024-25' });
      const solo1 = cat({ academicYear: '2025-26', cursos: ['1ESO'] });
      const hoy = cat({ academicYear: ANIO });
      const sin = cat({ academicYear: null });
      const usos = usosHistoricos([a, solo1, hoy, sin], { [ORATORIO.id]: NIVELES }, ANIO);
      expect(usos.filter((u) => u.catalogoId === a.id).map((u) => u.curso)).toEqual(NIVELES);
      expect(usos.filter((u) => u.catalogoId === solo1.id)).toEqual([uso(solo1.id, '2025-26', '1ESO')]);
      // El curso en marcha cuenta por lo que se planifica, no por el curso de creación.
      expect(usos.some((u) => u.catalogoId === hoy.id || u.catalogoId === sin.id)).toBe(false);
    });

    it('lo planificado cuenta, salvo lo anulado o lo que no tiene sesión elegida', () => {
      const lista = [
        sesion({ catalogoId: 'a', estado: 'confirmado', academicYear: ANIO, curso: '3ºPPDC', letra: 'PDC' }),
        sesion({ catalogoId: 'a', estado: 'borrador', academicYear: '', curso: '1ESO', letra: 'A' }),
        sesion({ catalogoId: 'a', estado: 'anulado', academicYear: ANIO, curso: '2ESO', letra: 'A' }),
        sesion({ catalogoId: null, estado: 'confirmado', academicYear: ANIO, curso: '4ESO', letra: 'A' }),
      ];
      expect(usosDeSesiones(lista, ANIO)).toEqual([uso('a', ANIO, '3ESO', 'PDC'), uso('a', ANIO, '1ESO', 'A')]);
    });
  });

  describe('cuál se propone', () => {
    it('sin abanico, todo sigue como antes', () => {
      expect(opcionesSesion(ctx(), ORATORIO, clase('1ESO', 'A'), '2026-10-05')).toEqual([]);
      expect(sesionPorDefecto([])).toBeNull();
    });

    it('la que no han visto los alumnos de esa clase; las vistas, avisadas y al final', () => {
      const vista = cat({ nombre: 'Vista', academicYear: '2025-26' }); // la hicieron todos el curso pasado
      const nueva = cat({ nombre: 'Nueva' });
      const c = ctxAbanico([vista, nueva]);
      const para4 = ordenarOpciones(opcionesSesion(c, ORATORIO, clase('4ESO', 'A'), '2026-10-05'));
      expect(para4.map((o) => o.sesion.nombre)).toEqual(['Nueva', 'Vista']);
      expect(para4[1].choques).toHaveLength(1);
      expect(sesionPorDefecto(para4)?.nombre).toBe('Nueva');
      // 1º son alumnos nuevos: para ellos «Vista» está tan libre como «Nueva» (gana la que lleva más sin hacerse).
      const para1 = opcionesSesion(c, ORATORIO, clase('1ESO', 'A'), '2026-10-05');
      expect(para1.every((o) => o.choques.length === 0)).toBe(true);
      expect(sesionPorDefecto(para1)?.nombre).toBe('Nueva');
    });

    it('la hecha a medida para un nivel («la primera vez») gana en ese nivel y no existe para los demás', () => {
      const primera = cat({ nombre: 'Primera vez', cursos: ['1ESO'] });
      const general = cat({ nombre: 'General' });
      const c = ctxAbanico([general, primera]);
      expect(sesionPorDefecto(opcionesSesion(c, ORATORIO, clase('1ESO', 'B'), '2026-10-05'))?.nombre).toBe('Primera vez');
      expect(sesionPorDefecto(opcionesSesion(c, ORATORIO, clase('2ESO', 'B'), '2026-10-05'))?.nombre).toBe('General');
      expect(opcionesSesion(c, ORATORIO, clase('2ESO', 'B'), '2026-10-05').find((o) => o.sesion.nombre === 'Primera vez')?.aplicable).toBe(false);
    });

    it('una vez hecha «la primera vez» por 1º A, 1º A pasa a la general y 1º B todavía puede hacerla ese curso', () => {
      const primera = cat({ nombre: 'Primera vez', cursos: ['1ESO'] });
      const general = cat({ nombre: 'General' });
      const hecha = sesion({ catalogoId: primera.id, estado: 'confirmado', academicYear: ANIO, curso: '1ESO', letra: 'A', fecha: '2026-10-05' });
      const c = ctxAbanico([general, primera], [hecha]);
      expect(sesionPorDefecto(opcionesSesion(c, ORATORIO, clase('1ESO', 'A'), '2026-11-02'))?.nombre).toBe('General');
      expect(sesionPorDefecto(opcionesSesion(c, ORATORIO, clase('1ESO', 'B'), '2026-10-12'))?.nombre).toBe('Primera vez');
    });

    it('lo normal es repetir la misma en todas las clases de la unidad: gana la ya elegida', () => {
      const a = cat({ nombre: 'A' });
      const b = cat({ nombre: 'B' });
      expect(sesionPorDefecto(opcionesSesion(ctxAbanico([a, b]), ORATORIO, clase('2ESO', 'A'), '2026-10-05'))?.nombre).toBe('A');
      const yaEnOctubre = sesion({ catalogoId: b.id, estado: 'borrador', academicYear: ANIO, curso: '1ESO', letra: 'B', fecha: '2026-10-19' });
      const c = ctxAbanico([a, b], [yaEnOctubre]);
      expect(sesionPorDefecto(opcionesSesion(c, ORATORIO, clase('2ESO', 'A'), '2026-10-05'))?.nombre).toBe('B');
      // En otro mes ya no cuenta como «la de este mes».
      expect(sesionPorDefecto(opcionesSesion(c, ORATORIO, clase('2ESO', 'A'), '2026-11-02'))?.nombre).toBe('A');
    });

    it('si todas las del abanico las ha visto esa clase, no propone ninguna, salvo que el tipo no revise', () => {
      const a = cat({ academicYear: '2025-26' });
      expect(sesionPorDefecto(opcionesSesion(ctxAbanico([a]), ORATORIO, clase('4ESO', 'A'), '2026-10-05'))).toBeNull();
      const libre = { ...ORATORIO, sinRepetir: false };
      expect(sesionPorDefecto(opcionesSesion(ctxAbanico([a]), libre, clase('4ESO', 'A'), '2026-10-05'))?.id).toBe(a.id);
    });

    it('las archivadas no se proponen, pero lo que se hizo con ellas sigue contando', () => {
      const archivada = cat({ activo: false, academicYear: '2025-26' });
      const otra = cat({ nombre: 'Otra' });
      const opciones = opcionesSesion(ctxAbanico([archivada, otra]), ORATORIO, clase('4ESO', 'A'), '2026-10-05');
      expect(opciones.map((o) => o.sesion.id)).toEqual([otra.id]);
      expect(usosQueChocan([uso(archivada.id, '2025-26', '3ESO')], archivada.id, clase('4ESO', 'A'), ANIO)).toHaveLength(1);
    });

    it('las de otro tipo no mezclan', () => {
      const delGodly = cat({ tipoId: GODLY.id });
      expect(opcionesSesion(ctxAbanico([delGodly]), ORATORIO, clase('1ESO', 'A'), '2026-10-05')).toEqual([]);
    });

    it('los usos de otros cursos (momentos de años anteriores) también cuentan', () => {
      const a = cat({ nombre: 'A' });
      const b = cat({ nombre: 'B' });
      const c = ctxAbanico([a, b], [], { usosPrevios: [uso(a.id, '2025-26', '3ESO', 'A')] });
      expect(sesionPorDefecto(opcionesSesion(c, ORATORIO, clase('4ESO', 'A'), '2026-10-05'))?.nombre).toBe('B');
    });
  });

  describe('el autocompletar y el abanico', () => {
    const DISP = [
      { dia: 1, horaInicio: '09:50', horaFin: '10:45', nivel: 'optima' as const },
      { dia: 2, horaInicio: '09:50', horaFin: '10:45', nivel: 'alternativa' as const },
    ];
    const YO = { email: 'yo@consolacionburriana.com', profeId: null };

    it('cada propuesta lleva su sesión, la misma para todas las clases del mes', () => {
      const a = cat({ nombre: 'A' });
      const b = cat({ nombre: 'B' });
      const p = autocompletar(ctxAbanico([a, b]), ORATORIO, CLASES_ESO, { inicio: '2026-10-01', fin: '2026-10-31' }, DISP, YO);
      expect(p).toHaveLength(2);
      expect(new Set(p.map((x) => x.catalogoId))).toEqual(new Set([a.id]));
    });

    it('una sesión forzada manda sobre las de por defecto', () => {
      const a = cat({ nombre: 'A' });
      const b = cat({ nombre: 'B' });
      const p = autocompletar(ctxAbanico([a, b]), ORATORIO, CLASES_ESO, { inicio: '2026-10-01', fin: '2026-10-31' }, DISP, YO, b);
      expect(p.map((x) => x.catalogoId)).toEqual([b.id, b.id]);
    });

    it('lo que se propone cuenta para lo siguiente: «la primera vez» no se repite en la misma clase al mes siguiente', () => {
      const primera = cat({ nombre: 'Primera vez', cursos: ['1ESO'] });
      const general = cat({ nombre: 'General' });
      const p = autocompletar(ctxAbanico([general, primera]), ORATORIO, CLASES_ESO, { inicio: '2026-10-01', fin: '2026-11-30' }, DISP, YO);
      const secuencia = (letra: string) => p.filter((x) => x.letra === letra).map((x) => x.catalogoId);
      // Cada clase tiene una en octubre y otra en noviembre: la primera es «la primera vez»; la segunda ya no.
      expect(secuencia('A')).toEqual([primera.id, general.id]);
      expect(secuencia('B')).toEqual([primera.id, general.id]);
    });

    it('sin abanico, las propuestas salen sin sesión', () => {
      const p = autocompletar(ctx(), ORATORIO, CLASES_ESO, { inicio: '2026-10-01', fin: '2026-10-31' }, DISP, YO);
      expect(p.every((x) => x.catalogoId === null)).toBe(true);
    });
  });

  describe('cursos que se pueden elegir', () => {
    it('los 4 anteriores, el actual y el siguiente', () => {
      expect(cursosAcademicosElegibles('2026-27')).toEqual(['2022-23', '2023-24', '2024-25', '2025-26', '2026-27', '2027-28']);
    });

    it('un camino más largo (Godly Play, infantil y primaria) pide más cursos atrás', () => {
      const cursos = cursosAcademicosElegibles('2026-27', 9);
      expect(cursos[0]).toBe('2018-19');
      expect(cursos.at(-1)).toBe('2027-28');
    });
  });

  describe('clases sin horario', () => {
    it('el PDC (sin horario importado) y las que no están en ningún horario', () => {
      const alumnado = [clase('1ESO', 'A'), clase('3ºPPDC', 'PDC'), clase('2ESO', 'B')];
      expect(clasesSinHorario(alumnado, HORARIO)).toEqual([clase('3ºPPDC', 'PDC'), clase('2ESO', 'B')]);
    });

    it('cuando el PDC ya tiene horario, deja de salir', () => {
      const conPdc = [...HORARIO, h('3ESO', 'PDC', 1, '09:50', '10:45', 'Ámbito científico')];
      expect(clasesSinHorario([clase('3ºPPDC', 'PDC')], conPdc)).toEqual([]);
    });
  });

  describe('lo que entra por la red', () => {
    const base = { tipoId: '11111111-1111-4111-8111-111111111111', nombre: ' La primera vez ', enlace: 'https://docs.google.com/document/d/abc', academicYear: '2024-25', cursos: ['1ESO'], activo: true };

    it('acepta una sesión con nombre, enlace y curso, y recorta el nombre', () => {
      const r = sesionCatalogoSchema.parse(base);
      expect(r.nombre).toBe('La primera vez');
      expect(sesionCatalogoSchema.safeParse({ ...base, enlace: null, academicYear: null, cursos: null }).success).toBe(true);
      expect(sesionCatalogoSchema.safeParse({ ...base, enlace: '' }).success).toBe(true);
    });

    it('rechaza enlaces que no son web (nunca javascript:), nombres vacíos y niveles raros', () => {
      expect(sesionCatalogoSchema.safeParse({ ...base, enlace: 'javascript:alert(1)' }).success).toBe(false);
      expect(sesionCatalogoSchema.safeParse({ ...base, enlace: 'docs.google.com/x' }).success).toBe(false);
      expect(sesionCatalogoSchema.safeParse({ ...base, nombre: '   ' }).success).toBe(false);
      expect(sesionCatalogoSchema.safeParse({ ...base, cursos: ['primero'] }).success).toBe(false);
      expect(esEnlaceSeguro('https://a.es/x')).toBe(true);
      expect(esEnlaceSeguro('data:text/html,<b>x</b>')).toBe(false);
    });

    it('un momento nuevo puede llevar sesión del abanico, o ninguna', () => {
      const m = { tipoId: base.tipoId, curso: '1ESO', letra: 'A', fecha: '2026-10-05', horaInicio: '09:50', horaFin: '10:45', profes: [], responsableEmail: 'yo@consolacionburriana.com' };
      expect(nuevaSesionSchema.safeParse({ ...m, catalogoId: base.tipoId }).success).toBe(true);
      expect(nuevaSesionSchema.safeParse({ ...m, catalogoId: null }).success).toBe(true);
      expect(nuevaSesionSchema.safeParse(m).success).toBe(true);
      expect(nuevaSesionSchema.safeParse({ ...m, catalogoId: 'no-es-un-uuid' }).success).toBe(false);
    });
  });
});
