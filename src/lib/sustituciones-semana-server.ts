// La semana de Sustituciones, para el calendario (docs/32, «Calendario», 23-nov-2026): cada hora que
// pide sustituto con su estado, las salidas y las bajas de cada día, y el tramo de horas que pintar.
// Una tanda de consultas (lo que cuesta es el viaje, docs/04).
import { and, asc, eq, gte, inArray, isNotNull, lte } from 'drizzle-orm';
import { db } from '@/db';
import { eduCoberturasBaja, eduTeachers, horFestivos, horPeriodos, horRejillaAmbitos, horRejillas, horTramos, sustAusencias, sustSalidas, sustSesiones } from '@/db/schema';
import { bajasEnRango } from '@/lib/bajas-server';
import { bajaVigente } from '@/lib/bajas';
import { esVigente as coberturaVigente } from '@/lib/coberturas-baja';
import { ampliarEtapasConjuntas, esEtapa, etapaDeCurso, type Etapa } from '@/lib/cursos';
import { nombreProfeBreve } from '@/lib/profes';
import { contarEstados, diasDeSemana, estadoHora, normalizar, type EstadoHoraSust } from '@/lib/sustituciones';
import { aMin } from '@/lib/oratorios';

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
  /** El aviso está programado para más tarde (sale solo). */
  programadoPara: string | null;
  /** Su grupo se ha ido de salida a esa hora: ya no hace falta cubrirla. */
  grupoDeSalida: string | null;
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
  /** De baja ese día (de estas etapas): con quién la cubre, o null si no tiene sustituto. */
  bajas: { nombre: string; cubre: string | null }[];
}

export interface DatosSemana {
  lunes: string;
  dias: DiaSemana[];
  bloques: BloqueSemana[];
  /** Minutos del primer y el último borde a pintar (de hora en punto a hora en punto). */
  inicio: number;
  fin: number;
  cuentas: Record<EstadoHoraSust, number>;
}

function etapasDeFicha(p: { etapa: string | null; etapas: string[] | null }): Etapa[] {
  const lista = (p.etapas?.length ? p.etapas : p.etapa ? [p.etapa] : []).filter(esEtapa);
  return ampliarEtapasConjuntas(lista);
}

export async function datosSemana(lunes: string, etapas: readonly Etapa[], hoy: string): Promise<DatosSemana> {
  const dias = diasDeSemana(lunes);
  const viernes = dias[4];
  const [filas, salidas, festivos, tramos, bajas, coberturas, profes] = await Promise.all([
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
        avisoEstado: sustSesiones.avisoEstado,
        avisoProgramadoPara: sustSesiones.avisoProgramadoPara,
        confirmacionEstado: sustSesiones.confirmacionEstado,
        confirmacion2Estado: sustSesiones.confirmacion2Estado,
        ausente: sustAusencias.profeNombre,
      })
      .from(sustSesiones)
      .innerJoin(sustAusencias, eq(sustAusencias.id, sustSesiones.ausenciaId))
      .where(and(eq(sustAusencias.estado, 'confirmada'), gte(sustSesiones.fecha, lunes), lte(sustSesiones.fecha, viernes), inArray(sustAusencias.etapa, [...etapas]), eq(sustSesiones.hayQueCubrir, true)))
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
      .select({ horaInicio: horTramos.horaInicio, horaFin: horTramos.horaFin, etapa: horRejillaAmbitos.etapa, curso: horRejillaAmbitos.curso })
      .from(horTramos)
      .innerJoin(horRejillas, eq(horRejillas.id, horTramos.rejillaId))
      .innerJoin(horPeriodos, eq(horPeriodos.id, horRejillas.periodoId))
      .leftJoin(horRejillaAmbitos, eq(horRejillaAmbitos.rejillaId, horRejillas.id))
      .where(and(eq(horTramos.tipo, 'sesion'), eq(horRejillas.active, true), eq(horPeriodos.active, true))),
    bajasEnRango(lunes, viernes),
    db
      .select({ sustitutoId: eduCoberturasBaja.sustitutoId, titularId: eduCoberturasBaja.titularId, desde: eduCoberturasBaja.desde, hasta: eduCoberturasBaja.hasta, activa: eduCoberturasBaja.activa })
      .from(eduCoberturasBaja)
      .where(and(eq(eduCoberturasBaja.activa, true), isNotNull(eduCoberturasBaja.titularId))),
    db
      .select({ id: eduTeachers.id, nombre: eduTeachers.nombre, apellido1: eduTeachers.apellido1, apellido2: eduTeachers.apellido2, nombreMostrado: eduTeachers.nombreMostrado, etapa: eduTeachers.etapa, etapas: eduTeachers.etapas })
      .from(eduTeachers)
      .where(eq(eduTeachers.active, true)),
  ]);

  const deEtapas = new Set(etapas);
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

  const bloques: BloqueSemana[] = filas.map((f) => ({
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
    programadoPara: f.avisoEstado === 'programado' && f.avisoProgramadoPara ? f.avisoProgramadoPara.toISOString() : null,
    grupoDeSalida: deSalida(f),
  }));

  // Las horas a pintar: las de las rejillas de estas etapas (y lo que se salga, por si acaso).
  const minutos: number[] = [];
  for (const t of tramos) {
    const e = (t.etapa ?? etapaDeCurso(t.curso)) as Etapa | null;
    if (e && !deEtapas.has(e)) continue;
    minutos.push(aMin(t.horaInicio), aMin(t.horaFin));
  }
  for (const b of bloques) minutos.push(aMin(b.horaInicio), aMin(b.horaFin));
  const inicio = minutos.length ? Math.floor(Math.min(...minutos) / 60) * 60 : 8 * 60;
  const fin = minutos.length ? Math.ceil(Math.max(...minutos) / 60) * 60 : 17 * 60;

  const diasVista: DiaSemana[] = dias.map((fecha) => {
    const fest = festivos.find((x) => x.inicio <= fecha && fecha <= x.fin);
    const deBaja: DiaSemana['bajas'] = [];
    const vistos = new Set<string>();
    for (const c of coberturas) {
      if (!coberturaVigente(c, fecha) || vistos.has(c.titularId)) continue;
      if (!(etapasDe.get(c.titularId) ?? []).some((e) => deEtapas.has(e))) continue;
      vistos.add(c.titularId);
      deBaja.push({ nombre: nombre.get(c.titularId) ?? '—', cubre: nombre.get(c.sustitutoId) ?? null });
    }
    for (const b of bajas) {
      if (!bajaVigente(b, fecha) || vistos.has(b.profeId)) continue;
      if (!(etapasDe.get(b.profeId) ?? []).some((e) => deEtapas.has(e))) continue;
      vistos.add(b.profeId);
      deBaja.push({ nombre: nombre.get(b.profeId) ?? '—', cubre: null });
    }
    return { fecha, festivo: fest ? (fest.nombre ?? 'Festivo') : null, salidas: vistas.filter((x) => x.fecha === fecha), bajas: deBaja.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')) };
  });

  return { lunes, dias: diasVista, bloques, inicio, fin, cuentas: contarEstados(filas.map((f) => ({ ...f })), hoy) };
}
