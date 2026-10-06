// Helpers puros de "Mi horario" (sin IO, testeables). Ficha: docs/20-mi-horario.md
//
// Tres piezas, cada una resuelve un problema concreto de exportar un horario a Google
// Calendar:
//
//   1. Emojis por defecto — para que la pantalla proponga algo razonable antes de que
//      cada uno lo cambie. Van por MATERIA (nombre) o por ACTIVIDAD (código), nunca por
//      clase: el mismo "Matemáticas" lleva el mismo emoji dé la clase que dé.
//   2. La plantilla del título — un motor de huecos ('{emoji} {abrev} · {clase}') que
//      recorta solo los separadores que quedan huérfanos, no cualquier espacio.
//   3. Las fechas del evento recurrente — un evento por sesión semanal, con EXDATE por
//      cada festivo: los festivos no se borran después, no llegan a crearse.

import { normalizarNombreMateria } from '@/lib/horarios-import';
import { aMinutos, diaSemanaDeFecha, type CeldaHorario, type Franja } from '@/lib/horarios';
import { CONFIGURACION } from '@/lib/configuracion';

// ─── Emojis por defecto ────────────────────────────────────────────────────────

/**
 * Uno por materia, keyed por NOMBRE normalizado (no por código: el código cambia de
 * fichero a fichero, el nombre es la identidad real de la materia — ver
 * `asegurarMaterias()` en horarios-server.ts, que unifica exactamente por lo mismo).
 * Cubre las 17 materias de infantil y primaria ya importadas; lo que no esté aquí sale
 * sin emoji propuesto y la persona pone el suyo.
 */
export const EMOJIS_MATERIA_POR_DEFECTO: Record<string, string> = {
  [normalizarNombreMateria('Matemáticas')]: '🔢',
  [normalizarNombreMateria('Lengua Castellana y Literatura')]: '📖',
  [normalizarNombreMateria('Valencià: Llengua i Literatura')]: '📗',
  [normalizarNombreMateria('Coneixement del Medi Natural, Social i Cultural')]: '🌍',
  [normalizarNombreMateria('Educació Física')]: '⚽',
  [normalizarNombreMateria('Educación Física')]: '⚽',
  [normalizarNombreMateria('English')]: '🇬🇧',
  [normalizarNombreMateria('Music')]: '🎵',
  [normalizarNombreMateria('Arts')]: '🎨',
  [normalizarNombreMateria('Religión')]: '✝️',
  [normalizarNombreMateria('Tutoría')]: '🧭',
  [normalizarNombreMateria('Lectura')]: '📚',
  [normalizarNombreMateria('eMat')]: '🧮',
  [normalizarNombreMateria('Ludiletras')]: '🔤',
  [normalizarNombreMateria('Psicomotricidad')]: '🤸',
  [normalizarNombreMateria('Crecimiento En Armonía')]: '🌱',
  [normalizarNombreMateria('Projecte')]: '🛠️',
  [normalizarNombreMateria('Educación en Valores Cívicos y Éticos')]: '⚖️',
};

/**
 * Por ACTIVIDAD (código de `hor_actividades`), para las horas que no son de clase. Solo
 * las que David pidió explícitamente; el resto cae al genérico de abajo.
 */
export const EMOJIS_ACTIVIDAD_POR_DEFECTO: Record<string, string> = {
  atencion_padres: '🗣️',
  atencion_alumnos: '🗣️',
  reunion: '👥',
  departamento: '👥',
  coordinacion: '👥',
  guardia: '🛟',
};

/** El de cualquier hora no lectiva sin emoji propio ("👤 No lectiva" que pidió David). */
export const EMOJI_GENERICO_NO_LECTIVA = '👤';

/** El de cualquier hora LECTIVA sin materia y sin emoji propio (caso raro: clase manual). */
export const EMOJI_GENERICO_LECTIVA = '📌';

/**
 * El emoji que le toca a una celda: primero lo que la persona haya guardado en sus
 * preferencias (`emojis`, clave `materia:<id>` o `actividad:<código>`), si no lo que
 * propone el centro, si no el genérico según sea lectiva o no.
 */
export function emojiDeCelda(celda: CeldaHorario, propios: Record<string, string>): string {
  if (celda.materiaId) {
    const clave = `materia:${celda.materiaId}`;
    if (propios[clave]) return propios[clave];
    const porNombre = EMOJIS_MATERIA_POR_DEFECTO[normalizarNombreMateria(celda.titulo)];
    if (porNombre) return porNombre;
  } else {
    const clave = `actividad:${celda.actividad}`;
    if (propios[clave]) return propios[clave];
    const porActividad = EMOJIS_ACTIVIDAD_POR_DEFECTO[celda.actividad];
    if (porActividad) return porActividad;
  }
  return celda.lectiva ? EMOJI_GENERICO_LECTIVA : EMOJI_GENERICO_NO_LECTIVA;
}

/** Emojis "de colegio" que salen arriba del selector, para no tener que buscar. */
export const EMOJIS_ACADEMICOS = [
  '🔢', '➗', '📐', '📖', '📚', '✏️', '🔤', '🗣️', '🌍', '🔬', '🧪', '💻',
  '🎨', '🎵', '⚽', '🏃', '🇬🇧', '🇪🇸', '✝️', '🧭', '🤸', '🌱', '🛠️', '⚖️',
  '👥', '🛟', '👤', '📌', '🧠', '🎭', '📝', '⭐',
];

// ─── Abreviatura de respaldo ────────────────────────────────────────────────────

const CONECTORES = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'en', 'i', 'e', 'y', 'of', 'a', 'al', 'con', 'per']);

function sinDiacriticos(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Abreviatura tipo 'GeH' cuando NO hay una guardada en `hor_materias.abreviatura` (que ya
 * suele traer una buena, heredada del código de Educamos: `EFI1` → `EFI`). Es el respaldo
 * para asignaciones manuales sin materia (un taller, una actividad suelta).
 *
 * La regla: las palabras "significativas" (no conectores) ponen su inicial en MAYÚSCULA;
 * un conector que quede ENTRE dos significativas pone la suya en minúscula ('Geografía e
 * Historia' → G + e + H = 'GeH'). Los conectores al principio o al final se ignoran. Con
 * una sola palabra significativa, se cogen sus 3 primeras letras ('Matemáticas' → 'MAT').
 */
export function generarAbreviatura(nombre: string): string {
  const palabras = sinDiacriticos(nombre)
    .split(/[\s,.:;()]+/)
    .filter(Boolean);
  if (palabras.length === 0) return '';

  const esConector = (p: string) => CONECTORES.has(p.toLowerCase());
  const significativas = palabras.filter((p) => !esConector(p));

  if (significativas.length <= 1) {
    const base = (significativas[0] ?? palabras[0]).toUpperCase();
    return base.slice(0, 3);
  }

  let letras = '';
  let vistaSignificativa = false;
  for (let i = 0; i < palabras.length; i++) {
    const p = palabras[i];
    if (!esConector(p)) {
      letras += p.charAt(0).toUpperCase();
      vistaSignificativa = true;
    } else if (vistaSignificativa && significativas.length - letras.length > 0 && i < palabras.length - 1) {
      // Un conector solo entra si todavía queda otra significativa después (si no, es el
      // final de la frase y no aporta nada: 'Historia de' no sería 'Hd').
      const quedaSignificativaDespues = palabras.slice(i + 1).some((q) => !esConector(q));
      if (quedaSignificativaDespues) letras += p.charAt(0).toLowerCase();
    }
  }
  return letras.slice(0, 6);
}

/** La abreviatura que le toca a una celda: la de la persona, si no la de la materia, si no la generada. */
export function abreviaturaDeCelda(celda: CeldaHorario, propias: Record<string, string>): string {
  const clave = celda.materiaId ? `materia:${celda.materiaId}` : `actividad:${celda.actividad}`;
  return propias[clave]?.trim() || celda.abreviatura || generarAbreviatura(celda.titulo);
}

// ─── Color del evento en Google Calendar ───────────────────────────────────────
//
// La API solo admite los 11 colores fijos de la paleta de eventos de Google (`colorId`
// '1'..'11'); no hay hexadecimal libre. Cada persona elige uno por materia/actividad (mismas
// claves que `emojis`). Si no ha elegido, se propone el más parecido al de la rejilla de
// «Mi horario», que reparte el círculo de color alfabéticamente por título (ver
// `repartirColores` en horarios.ts), y se evita repetir color mientras queden libres.

export interface ColorGoogle {
  id: string;
  nombre: string;
  hex: string;
}

export const COLORES_GOOGLE: readonly ColorGoogle[] = [
  { id: '1', nombre: 'Lavanda', hex: '#a4bdfc' },
  { id: '2', nombre: 'Salvia', hex: '#7ae7bf' },
  { id: '3', nombre: 'Uva', hex: '#dbadff' },
  { id: '4', nombre: 'Flamenco', hex: '#ff887c' },
  { id: '5', nombre: 'Plátano', hex: '#fbd75b' },
  { id: '6', nombre: 'Mandarina', hex: '#ffb878' },
  { id: '7', nombre: 'Pavo real', hex: '#46d6db' },
  { id: '8', nombre: 'Grafito', hex: '#e1e1e1' },
  { id: '9', nombre: 'Arándano', hex: '#5484ed' },
  { id: '10', nombre: 'Albahaca', hex: '#51b749' },
  { id: '11', nombre: 'Tomate', hex: '#dc2127' },
];

const IDS_COLOR_GOOGLE = new Set(COLORES_GOOGLE.map((c) => c.id));
/** Grafito es gris: no tiene tono, así que no se propone solo (la persona sí puede elegirlo). */
const GRAFITO = '8';

export function esColorGoogle(id: unknown): id is string {
  return typeof id === 'string' && IDS_COLOR_GOOGLE.has(id);
}

/** Tono (0-360) en OKLCH de un color `#rrggbb`, el mismo espacio en el que la rejilla reparte los suyos. */
function tonoOklch(hex: string): number {
  const lin = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [lin(1), lin(3), lin(5)];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
}

const TONOS_GOOGLE = COLORES_GOOGLE.map((c) => ({ id: c.id, tono: tonoOklch(c.hex) }));

const distanciaTono = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/**
 * El `colorId` propuesto para cada título, con el mismo reparto de tonos que la rejilla
 * (alfabético, arrancando en azul). Cada título coge el color de Google más cercano a su
 * tono entre los que aún no se han usado; si se acaban (más de 10 categorías), se repiten.
 */
export function colorIdsPorDefecto(titulos: readonly string[]): Map<string, string> {
  const ordenados = [...new Set(titulos)].sort((a, b) => a.localeCompare(b, 'es'));
  const mapa = new Map<string, string>();
  const usados = new Set<string>();
  ordenados.forEach((titulo, i) => {
    const tono = (255 + (i * 360) / Math.max(ordenados.length, 1)) % 360;
    const candidatos = TONOS_GOOGLE.filter((c) => c.id !== GRAFITO);
    const libres = candidatos.filter((c) => !usados.has(c.id));
    const elegido = (libres.length ? libres : candidatos).reduce((mejor, c) =>
      distanciaTono(c.tono, tono) < distanciaTono(mejor.tono, tono) ? c : mejor,
    );
    usados.add(elegido.id);
    mapa.set(titulo, elegido.id);
  });
  return mapa;
}

/** El `colorId` de una celda: el que la persona haya elegido para su materia/actividad, si no el propuesto. */
export function colorDeCeldaGoogle(
  celda: CeldaHorario,
  propios: Record<string, string>,
  porDefecto: ReadonlyMap<string, string>,
): string | undefined {
  const clave = celda.materiaId ? `materia:${celda.materiaId}` : `actividad:${celda.actividad}`;
  const elegido = propios[clave];
  return esColorGoogle(elegido) ? elegido : porDefecto.get(celda.titulo);
}

// ─── Motor de la plantilla del título ──────────────────────────────────────────

export interface DatosPlantilla {
  emoji: string;
  abrev: string;
  materia: string;
  clase: string; // el primer grupo, o vacío
  clases: string; // todos los grupos, separados por coma
  aula: string;
  profes: string; // nombres cortos, separados por coma
  actividad: string;
  /** A qué va la hora dentro de la materia: 'Matemáticas' en un Ámbito Científico de PDC. */
  detalle: string;
}

export const PLANTILLA_TITULO_DEFECTO = '{emoji} {abrev} · {clase}';

const SEPARADOR_SUELTO = /^[\s·\-–|:,]+$/;

/**
 * Rellena una plantilla de huecos ('{emoji} {abrev} · {clase}') con los datos de una
 * celda, y recorta los separadores que se quedan colgando cuando un hueco sale vacío
 * (una guardia sin clase no deja un '· ' suelto: '🛟 Guardia', no '🛟 Guardia · ').
 *
 * El recorte es local: solo se comen los separadores INMEDIATAMENTE pegados a un hueco
 * vacío, nunca literales que la persona haya escrito a mano en medio de la plantilla.
 */
export function renderizarPlantilla(plantilla: string, datos: DatosPlantilla): string {
  type Parte = { tipo: 'lit'; texto: string; fuera: boolean } | { tipo: 'hueco'; valor: string; fuera: boolean };
  const partes: Parte[] = [];
  const re = /\{(\w+)\}|([^{}]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(plantilla))) {
    if (m[1]) {
      const valor = (datos as unknown as Record<string, string>)[m[1]] ?? '';
      partes.push({ tipo: 'hueco', valor, fuera: valor.trim() === '' });
    } else {
      partes.push({ tipo: 'lit', texto: m[2], fuera: false });
    }
  }

  // Un literal que es SOLO separador se descarta si el hueco vacío está a alguno de sus
  // lados (mirando al vecino no descartado más próximo). Se repite hasta que no cambie
  // nada, porque descartar un separador puede dejar a otro pegado a un hueco vacío.
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (let i = 0; i < partes.length; i++) {
      const p = partes[i];
      if (p.fuera || p.tipo !== 'lit' || !SEPARADOR_SUELTO.test(p.texto)) continue;
      const antes = partes.slice(0, i).reverse().find((x) => !x.fuera);
      const despues = partes.slice(i + 1).find((x) => !x.fuera);
      const pegadoAVacio = (v?: Parte) => v === undefined || (v.tipo === 'hueco' && v.valor.trim() === '');
      if (pegadoAVacio(antes) || pegadoAVacio(despues)) {
        p.fuera = true;
        cambio = true;
      }
    }
  }

  const texto = partes
    .filter((p) => !p.fuera)
    .map((p) => (p.tipo === 'hueco' ? p.valor : p.texto))
    .join('');
  return texto.replace(/\s+/g, ' ').trim();
}

/** Los datos de plantilla que salen de una celda ya resuelta (con su emoji ya decidido). */
export function datosPlantillaDeCelda(celda: CeldaHorario, emoji: string, abreviatura?: string): DatosPlantilla {
  const abrev = abreviatura?.trim() || celda.abreviatura || generarAbreviatura(celda.titulo);
  const grupos = celda.grupos;
  return {
    emoji,
    abrev,
    materia: celda.materiaId ? celda.titulo : '',
    clase: grupos[0] ?? '',
    clases: grupos.join(', '),
    aula: celda.espacio ?? '',
    profes: celda.profes.map((p) => p.corto).join(', '),
    actividad: celda.actividadNombre,
    detalle: celda.detalle ?? '',
  };
}

// ─── Fechas del evento recurrente ──────────────────────────────────────────────

export interface RangoFechas {
  fechaInicio: string; // 'YYYY-MM-DD'
  fechaFin: string;
}

export type RangoCurso = 'sep-jun' | 'oct-may';

export const RANGOS_CURSO: { valor: RangoCurso; etiqueta: string }[] = [
  { valor: 'sep-jun', etiqueta: 'De septiembre a junio' },
  { valor: 'oct-may', etiqueta: 'De octubre a mayo' },
];

/**
 * Las fechas que se exportan: el tramo elegido del curso ('2026-27': septiembre 2026 →
 * junio 2027, u octubre 2026 → mayo 2027) CRUZADO con las del periodo. Nunca amplía el
 * periodo (el de junio no se estira a septiembre); solo lo recorta. Si no se cruzan, sale
 * un rango invertido y no se crea ningún evento.
 */
export function rangoExportacion(academicYear: string, rango: RangoCurso, periodo: RangoFechas): RangoFechas {
  const y0 = Number(academicYear.slice(0, 4));
  if (!Number.isFinite(y0) || y0 < 1900) return periodo;
  const [mIni, mFin, diaFin] = rango === 'oct-may' ? [10, 5, 31] : [9, 6, 30];
  const ini = `${y0}-${String(mIni).padStart(2, '0')}-01`;
  const fin = `${y0 + 1}-${String(mFin).padStart(2, '0')}-${diaFin}`;
  return {
    fechaInicio: ini > periodo.fechaInicio ? ini : periodo.fechaInicio,
    fechaFin: fin < periodo.fechaFin ? fin : periodo.fechaFin,
  };
}

/**
 * La primera fecha (>= fechaInicioPeriodo) que cae en `dia` (1=lunes…5=viernes), y todas
 * las fechas de ese mismo día de la semana dentro del periodo que caen en algún festivo.
 *
 * Es lo que alimenta el evento recurrente: `primeraFecha` es el DTSTART, y
 * `fechasExcluidas` son los EXDATE — los festivos no se borran después de crear el
 * evento, directamente no se crean.
 */
export function ocurrenciasSemanales(
  dia: number,
  periodo: RangoFechas,
  festivos: readonly RangoFechas[],
): { primeraFecha: string | null; fechasExcluidas: string[] } {
  const [y0, m0, d0] = periodo.fechaInicio.split('-').map(Number);
  const [y1, m1, d1] = periodo.fechaFin.split('-').map(Number);
  const inicio = new Date(y0, m0 - 1, d0);
  const fin = new Date(y1, m1 - 1, d1);
  if (fin < inicio) return { primeraFecha: null, fechasExcluidas: [] };

  // Primer día >= inicio cuyo día de la semana coincide.
  const cursor = new Date(inicio);
  while (diaSemanaDeFecha(isoDe(cursor)) !== dia) {
    cursor.setDate(cursor.getDate() + 1);
    if (cursor > fin) return { primeraFecha: null, fechasExcluidas: [] };
  }
  const primeraFecha = isoDe(cursor);

  const fechasExcluidas: string[] = [];
  const it = new Date(cursor);
  it.setDate(it.getDate() + 7);
  while (it <= fin) {
    const iso = isoDe(it);
    if (festivos.some((f) => iso >= f.fechaInicio && iso <= f.fechaFin)) fechasExcluidas.push(iso);
    it.setDate(it.getDate() + 7);
  }
  return { primeraFecha, fechasExcluidas };
}

function isoDe(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DIA_RRULE = ['', 'MO', 'TU', 'WE', 'TH', 'FR'];

/**
 * El evento de Google Calendar (forma del recurso de la API v3) para una celda del
 * horario. Un evento por sesión SEMANAL, no uno por clase física: `RRULE` lo repite y
 * `EXDATE` se salta los festivos.
 *
 * `UNTIL` va en 23:59:59Z del día de fin de periodo — no del último día local exacto en
 * la zona de Madrid, que exigiría convertir con DST correctamente. 23:59:59 UTC de ESE
 * día es siempre posterior a cualquier hora local de ese mismo día en Madrid (que está
 * por delante de UTC), así que el margen es seguro: nunca deja fuera la última semana, y
 * tampoco añade una semana de más, porque `BYDAY` ya limita a esa fecha exacta.
 */
export function construirEventoGoogle(
  celda: CeldaHorario,
  opciones: { plantillaTitulo: string; plantillaDescripcion?: string; emoji: string; abreviatura?: string; colorId?: string; periodo: RangoFechas; festivos: readonly RangoFechas[]; periodoId: string; timeZone?: string },
): { evento: Record<string, unknown>; primeraFecha: string | null } {
  const tz = opciones.timeZone ?? CONFIGURACION.calendario.zonaHoraria;
  const { primeraFecha, fechasExcluidas } = ocurrenciasSemanales(celda.dia, opciones.periodo, opciones.festivos);
  const datos = datosPlantillaDeCelda(celda, opciones.emoji, opciones.abreviatura);
  const summary = renderizarPlantilla(opciones.plantillaTitulo, datos);
  const description = opciones.plantillaDescripcion ? renderizarPlantilla(opciones.plantillaDescripcion, datos) : undefined;

  if (!primeraFecha) return { evento: {}, primeraFecha: null };

  const [yFin, mFin, dFin] = opciones.periodo.fechaFin.split('-');
  const until = `${yFin}${mFin}${dFin}T235959Z`;
  const recurrence = [`RRULE:FREQ=WEEKLY;BYDAY=${DIA_RRULE[celda.dia]};UNTIL=${until}`];
  if (fechasExcluidas.length) {
    const horaSinDosPuntos = celda.horaInicio.replace(':', '');
    const lista = fechasExcluidas.map((f) => `${f.replace(/-/g, '')}T${horaSinDosPuntos}00`).join(',');
    recurrence.push(`EXDATE;TZID=${tz}:${lista}`);
  }

  const evento: Record<string, unknown> = {
    summary,
    ...(description ? { description } : {}),
    ...(celda.espacio ? { location: celda.espacio } : {}),
    ...(opciones.colorId ? { colorId: opciones.colorId } : {}),
    start: { dateTime: `${primeraFecha}T${celda.horaInicio}:00`, timeZone: tz },
    end: { dateTime: `${primeraFecha}T${celda.horaFin}:00`, timeZone: tz },
    recurrence,
    extendedProperties: {
      private: { origen: 'tools-horarios', periodoId: opciones.periodoId, sesionId: celda.sesionId },
    },
  };
  return { evento, primeraFecha };
}

/** Minutos de la sesión, para validar que no se genera un evento de duración 0 o negativa. */
export function duracionMinutos(celda: Pick<CeldaHorario, 'horaInicio' | 'horaFin'>): number {
  const ini = aMinutos(celda.horaInicio) ?? 0;
  const fin = aMinutos(celda.horaFin) ?? 0;
  return fin - ini;
}

/**
 * Junta en UNA las horas seguidas de lo mismo, para que en Google Calendar salgan como un
 * evento largo y no como dos pegados: la reunión de pastoral del jueves de 09:50 a 12:10 es
 * una reunión, no dos (David, 5-oct-2026). Vale igual para una clase doble.
 *
 * "Seguidas" = la misma asignación, el mismo día, y entre una y otra no hay ninguna franja
 * lectiva de la rejilla (el recreo no corta: la pastoral de 2ª y la de después del patio son
 * la misma reunión). Sin franjas, solo se juntan las que se tocan (una acaba cuando empieza
 * la otra). En pantalla se siguen viendo separadas; esto es solo para exportar.
 */
export function unirSesionesSeguidas(celdas: readonly CeldaHorario[], franjas: readonly Franja[] = []): CeldaHorario[] {
  const lectivas = franjas.filter((f) => f.tipo === 'sesion');
  const ordenadas = [...celdas].sort((a, b) => a.dia - b.dia || a.horaInicio.localeCompare(b.horaInicio));
  const salida: CeldaHorario[] = [];
  const ultimaDe = new Map<string, CeldaHorario>();
  for (const c of ordenadas) {
    const clave = c.asignacionId ? `${c.asignacionId}|${c.dia}` : null;
    const previa = clave ? ultimaDe.get(clave) : undefined;
    const pegada =
      !!previa &&
      previa.horaFin <= c.horaInicio &&
      (previa.horaFin === c.horaInicio ||
        (lectivas.some((f) => f.dia === c.dia) &&
          !lectivas.some((f) => f.dia === c.dia && f.horaInicio >= previa.horaFin && f.horaFin <= c.horaInicio)));
    if (previa && pegada) {
      previa.horaFin = c.horaFin;
      continue;
    }
    const copia = { ...c };
    salida.push(copia);
    if (clave) ultimaDe.set(clave, copia);
  }
  return salida;
}
