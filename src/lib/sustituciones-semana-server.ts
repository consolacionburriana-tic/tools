// La semana de Sustituciones (docs/32, decisiones 28 y 31): cada hora que pide sustituto con su estado
// y su curso, las salidas de cada día, las bajas de la semana y, si se mira una sola etapa, las filas
// de su rejilla (sus tramos de verdad, no un reloj). Una tanda de consultas (docs/04).
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/db';
import { eduCoberturasBaja, eduTeachers, horFestivos, horPeriodos, horRejillaAmbitos, horRejillas, horTramos, sustAusencias, sustSalidas, sustSesiones } from '@/db/schema';
import { bajasEnRango } from '@/lib/bajas-server';
import { bajaVigente } from '@/lib/bajas';
import { esVigente as coberturaVigente } from '@/lib/coberturas-baja';
import { ampliarEtapasConjuntas, esEtapa, etapaDeCurso, type Etapa } from '@/lib/cursos';
import { nombreProfeBreve } from '@/lib/profes';
import { aMin, diaSemana } from '@/lib/oratorios';
import {
  colorDeCurso,
  contarEstados,
  diasDeSemana,
  estadoHora,
  etapaDeGrupoTexto,
  etapasDeVista,
  horarioDeFecha,
  nombreCorto,
  normalizar,
  vistaConRejilla,
  type ColorCurso,
  type EstadoHoraSust,
  type FilaRejilla,
  type VistaSemana,
} from '@/lib/sustituciones';

export interface BloqueSemana {
  id: string;
  ausenciaId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  tramo: string | null;
  grupos: string | null;
  materia: string | null;
  aula: string | null;
  ausente: string;
  sustituto: string | null;
  sustituto2: string | null;
  estado: EstadoHoraSust;
  /** Solo una parte de la hora (llega tarde, se va antes): la franja que se cubre. */
  parcial: { inicio: string; fin: string } | null;
  /** El aviso está programado para más tarde (sale solo). */
  programadoPara: string | null;
  /** Su grupo se ha ido de salida a esa hora: ya no hace falta cubrirla. */
  grupoDeSalida: string | null;
  etapa: Etapa | null;
  /** Para colorear por curso: Infantil, los ciclos de Primaria, los cursos de la ESO. */
  color: ColorCurso | null;
  colorNombre: string | null;
}

export interface SalidaVista {
  id: string;
  fecha: string;
  horaInicio: string | null;
  horaFin: string | null;
  grupos: string[];
  descripcion: string;
  acompanantes: string[];
}

export interface DiaSemana {
  fecha: string;
  festivo: string | null;
  salidas: SalidaVista[];
}

export interface BajaSemana {
  nombre: string;
  /** «Alejandro Sán.» */
  corto: string;
  /** Quién la cubre (corto), o null si no tiene sustituto. */
  cubre: string | null;
  /** Días de esta semana en que está de baja (1-5): si no son todos, se dice. */
  dias: number[];
}

export interface DatosSemana {
  lunes: string;
  vista: VistaSemana;
  dias: DiaSemana[];
  bloques: BloqueSemana[];
  /** Las filas de la rejilla (solo con una etapa): sus tramos de esa semana. */
  filas: FilaRejilla[];
  /** Minutos del primer y el último borde a pintar en el calendario (de hora en punto a hora en punto). */
  inicio: number;
  fin: number;
  cuentas: Record<EstadoHoraSust, number>;
  bajas: BajaSemana[];
}

function etapasDeFicha(p: { etapa: string | null; etapas: string[] | null }): Etapa[] {
  const lista = (p.etapas?.length ? p.etapas : p.etapa ? [p.etapa] : []).filter(esEtapa);
  return ampliarEtapasConjuntas(lista);
}

export async function datosSemana(lunes: string, vista: VistaSemana, hoy: string): Promise<DatosSemana> {
  const etapas = etapasDeVista(vista);
  const deEtapas = new Set<Etapa>(etapas);
  const dias = diasDeSemana(lunes);
  const viernes = dias[4];
  const [filas, salidas, festivos, periodos, rejillas, ambitos, tramos, bajas, coberturas, profes] = await Promise.all([
    db
      .select({
        id: sustSesiones.id,
        ausenciaId: sustSesiones.ausenciaId,
        fecha: sustSesiones.fecha,
        horaInicio: sustSesiones.horaInicio,
        horaFin: sustSesiones.horaFin,
        tramo: sustSesiones.tramo,
        grupos: sustSesiones.grupos,
        materia: sustSesiones.materia,
        aula: sustSesiones.aula,
        hayQueCubrir: sustSesiones.hayQueCubrir,
        sustitutoId: sustSesiones.sustitutoId,
        sustituto2Id: sustSesiones.sustituto2Id,
        sustituto: sustSesiones.sustitutoNombre,
        sustituto2: sustSesiones.sustituto2Nombre,
        sustitutoHoraInicio: sustSesiones.sustitutoHoraInicio,
        sustitutoHoraFin: sustSesiones.sustitutoHoraFin,
        avisoEstado: sustSesiones.avisoEstado,
        avisoProgramadoPara: sustSesiones.avisoProgramadoPara,
        confirmacionEstado: sustSesiones.confirmacionEstado,
        confirmacion2Estado: sustSesiones.confirmacion2Estado,
        ausente: sustAusencias.profeNombre,
        etapaAusencia: sustAusencias.etapa,
      })
      .from(sustSesiones)
      .innerJoin(sustAusencias, eq(sustAusencias.id, sustSesiones.ausenciaId))
      .where(and(eq(sustAusencias.estado, 'confirmada'), gte(sustSesiones.fecha, lunes), lte(sustSesiones.fecha, viernes), eq(sustSesiones.hayQueCubrir, true)))
      .orderBy(asc(sustSesiones.fecha), asc(sustSesiones.horaInicio)),
    db
      .select()
      .from(sustSalidas)
      .where(and(eq(sustSalidas.estado, 'activa'), gte(sustSalidas.fecha, lunes), lte(sustSalidas.fecha, viernes)))
      .orderBy(asc(sustSalidas.horaInicio)),
    db
      .select({ inicio: horFestivos.fechaInicio, fin: horFestivos.fechaFin, nombre: horFestivos.nombre })
      .from(horFestivos)
      .where(and(lte(horFestivos.fechaInicio, viernes), gte(horFestivos.fechaFin, lunes))),
    db
      .select({ id: horPeriodos.id, nombre: horPeriodos.nombre, fechaInicio: horPeriodos.fechaInicio, fechaFin: horPeriodos.fechaFin, prioridad: horPeriodos.prioridad, esOrdinario: horPeriodos.esOrdinario })
      .from(horPeriodos)
      .where(eq(horPeriodos.active, true)),
    db.select({ id: horRejillas.id, periodoId: horRejillas.periodoId }).from(horRejillas).where(eq(horRejillas.active, true)),
    db.select({ rejillaId: horRejillaAmbitos.rejillaId, etapa: horRejillaAmbitos.etapa, curso: horRejillaAmbitos.curso }).from(horRejillaAmbitos),
    db
      .select({ rejillaId: horTramos.rejillaId, dia: horTramos.diaSemana, horaInicio: horTramos.horaInicio, horaFin: horTramos.horaFin, etiqueta: horTramos.etiqueta })
      .from(horTramos)
      .where(eq(horTramos.tipo, 'sesion')),
    bajasEnRango(lunes, viernes),
    db
      .select({ sustitutoId: eduCoberturasBaja.sustitutoId, titularId: eduCoberturasBaja.titularId, desde: eduCoberturasBaja.desde, hasta: eduCoberturasBaja.hasta, activa: eduCoberturasBaja.activa })
      .from(eduCoberturasBaja)
      .where(eq(eduCoberturasBaja.activa, true)),
    db
      .select({ id: eduTeachers.id, nombre: eduTeachers.nombre, apellido1: eduTeachers.apellido1, apellido2: eduTeachers.apellido2, nombreMostrado: eduTeachers.nombreMostrado, etapa: eduTeachers.etapa, etapas: eduTeachers.etapas })
      .from(eduTeachers)
      .where(eq(eduTeachers.active, true)),
  ]);

  const nombre = new Map(profes.map((p) => [p.id, nombreProfeBreve(p)]));
  const etapasDe = new Map(profes.map((p) => [p.id, etapasDeFicha(p)]));

  const vistas: SalidaVista[] = salidas
    .filter((x) => x.grupos.some((g) => deEtapas.has(etapaDeCurso(g.curso) as Etapa)))
    .map((x) => ({ id: x.id, fecha: x.fecha, horaInicio: x.horaInicio, horaFin: x.horaFin, grupos: x.grupos.map((g) => g.etiqueta), descripcion: x.descripcion, acompanantes: x.acompanantes.map((a) => a.nombre) }));

  // Una hora que se iba a cubrir y su grupo se ha ido de salida: se señala (ya no hace falta).
  const deSalida = (f: (typeof filas)[number]): string | null => {
    if (!f.grupos) return null;
    const grupos = f.grupos.split(',').map((g) => normalizar(g.replace(/\s*\(.*\)$/, '')));
    const s = salidas.find(
      (x) =>
        x.fecha === f.fecha &&
        (x.horaInicio === null || x.horaFin === null || (aMin(x.horaInicio) < aMin(f.horaFin) && aMin(f.horaInicio) < aMin(x.horaFin))) &&
        grupos.every((g) => x.grupos.some((sg) => normalizar(sg.etiqueta) === g)),
    );
    return s ? s.descripcion : null;
  };

  // Cada hora es de la etapa de su grupo (lo que pasa con el alumnado de esa etapa); sin grupo, la del ausente.
  const bloques: BloqueSemana[] = filas
    .map((f) => {
      const g = etapaDeGrupoTexto(f.grupos);
      const etapa = g.etapa ?? (esEtapa(f.etapaAusencia) ? f.etapaAusencia : null);
      const c = colorDeCurso(etapa, g.nivel);
      const parcial = f.sustitutoHoraInicio && f.sustitutoHoraFin && (f.sustitutoHoraInicio !== f.horaInicio || f.sustitutoHoraFin !== f.horaFin) ? { inicio: f.sustitutoHoraInicio, fin: f.sustitutoHoraFin } : null;
      return {
        id: f.id,
        ausenciaId: f.ausenciaId,
        fecha: f.fecha,
        horaInicio: f.horaInicio,
        horaFin: f.horaFin,
        tramo: f.tramo,
        grupos: f.grupos,
        materia: f.materia,
        aula: f.aula,
        ausente: f.ausente,
        sustituto: f.sustituto,
        sustituto2: f.sustituto2,
        estado: estadoHora(f, hoy),
        parcial,
        programadoPara: f.avisoEstado === 'programado' && f.avisoProgramadoPara ? f.avisoProgramadoPara.toISOString() : null,
        grupoDeSalida: deSalida(f),
        etapa,
        color: c?.color ?? null,
        colorNombre: c?.nombre ?? null,
        _f: f,
      };
    })
    .filter((b) => b.etapa !== null && deEtapas.has(b.etapa))
    .map(({ _f, ...b }) => {
      void _f;
      return b;
    });

  // Las filas de la rejilla: los tramos de la rejilla que manda cada día para esa etapa.
  const filasRejilla: FilaRejilla[] = [];
  if (vistaConRejilla(vista)) {
    const ambitosPor = new Map<string, { etapa: string | null; curso: string | null }[]>();
    for (const a of ambitos) ambitosPor.set(a.rejillaId, [...(ambitosPor.get(a.rejillaId) ?? []), a]);
    const rejillasConAmbito = rejillas.map((r) => ({ ...r, ambitos: ambitosPor.get(r.id) ?? [] }));
    const dePropia = (rid: string) => (ambitosPor.get(rid) ?? []).some((a) => (a.etapa ?? etapaDeCurso(a.curso)) === vista);
    const porClave = new Map<string, FilaRejilla>();
    for (const fecha of dias) {
      const dia = diaSemana(fecha);
      const h = horarioDeFecha(fecha, periodos, rejillasConAmbito, [vista]);
      for (const t of tramos) {
        if (t.dia !== dia || !h.rejillas.has(t.rejillaId) || !dePropia(t.rejillaId)) continue;
        const k = `${t.horaInicio}-${t.horaFin}`;
        const fila = porClave.get(k) ?? { horaInicio: t.horaInicio, horaFin: t.horaFin, etiqueta: t.etiqueta, dias: [] };
        if (!fila.dias.includes(dia)) fila.dias.push(dia);
        porClave.set(k, fila);
      }
    }
    filasRejilla.push(...[...porClave.values()].sort((a, b) => aMin(a.horaInicio) - aMin(b.horaInicio) || aMin(a.horaFin) - aMin(b.horaFin)));
  }

  // Las horas a pintar en el calendario: las de las rejillas de estas etapas (y lo que se salga).
  const minutos: number[] = [];
  const ambitoEtapa = new Map<string, Etapa[]>();
  for (const a of ambitos) {
    const e = (a.etapa ?? etapaDeCurso(a.curso)) as Etapa | null;
    if (e) ambitoEtapa.set(a.rejillaId, [...(ambitoEtapa.get(a.rejillaId) ?? []), e]);
  }
  for (const t of tramos) {
    const es = ambitoEtapa.get(t.rejillaId) ?? [];
    if (es.length > 0 && !es.some((e) => deEtapas.has(e))) continue;
    minutos.push(aMin(t.horaInicio), aMin(t.horaFin));
  }
  for (const b of bloques) minutos.push(aMin(b.horaInicio), aMin(b.horaFin));
  const inicio = minutos.length ? Math.floor(Math.min(...minutos) / 60) * 60 : 8 * 60;
  const fin = minutos.length ? Math.ceil(Math.max(...minutos) / 60) * 60 : 17 * 60;

  // Las bajas de la semana, de estas etapas: con quién la cubre (si la cubre alguien) y qué días.
  const porPersona = new Map<string, BajaSemana>();
  const lectivos = dias.filter((f) => !festivos.some((x) => x.inicio <= f && f <= x.fin));
  for (const fecha of lectivos) {
    const dia = diaSemana(fecha);
    const anotar = (titularId: string, sustitutoId: string | null) => {
      if (!(etapasDe.get(titularId) ?? []).some((e) => deEtapas.has(e))) return;
      const b = porPersona.get(titularId) ?? { nombre: nombre.get(titularId) ?? '—', corto: nombreCorto(nombre.get(titularId) ?? '—'), cubre: null, dias: [] };
      if (sustitutoId && !b.cubre) b.cubre = nombreCorto(nombre.get(sustitutoId) ?? '—');
      if (!b.dias.includes(dia)) b.dias.push(dia);
      porPersona.set(titularId, b);
    };
    for (const c of coberturas) if (coberturaVigente(c, fecha)) anotar(c.titularId, c.sustitutoId);
    for (const b of bajas) if (bajaVigente(b, fecha)) anotar(b.profeId, null);
  }

  const diasVista: DiaSemana[] = dias.map((fecha) => {
    const fest = festivos.find((x) => x.inicio <= fecha && fecha <= x.fin);
    return { fecha, festivo: fest ? (fest.nombre ?? 'Festivo') : null, salidas: vistas.filter((x) => x.fecha === fecha) };
  });

  return {
    lunes,
    vista,
    dias: diasVista,
    bloques,
    filas: filasRejilla,
    inicio,
    fin,
    cuentas: contarEstados(
      bloques.map((b) => filas.find((f) => f.id === b.id)!),
      hoy,
    ),
    bajas: [...porPersona.values()].sort((a, b) => Number(Boolean(a.cubre)) - Number(Boolean(b.cubre)) || a.nombre.localeCompare(b.nombre, 'es')),
  };
}
