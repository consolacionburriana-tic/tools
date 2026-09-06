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
import { aMinutos, diaSemanaDeFecha, type CeldaHorario } from '@/lib/horarios';

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
export function datosPlantillaDeCelda(celda: CeldaHorario, emoji: string): DatosPlantilla {
  const abrev = celda.abreviatura || generarAbreviatura(celda.titulo);
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
  };
}

// ─── Fechas del evento recurrente ──────────────────────────────────────────────

export interface RangoFechas {
  fechaInicio: string; // 'YYYY-MM-DD'
  fechaFin: string;
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
  opciones: { plantillaTitulo: string; plantillaDescripcion?: string; emoji: string; periodo: RangoFechas; festivos: readonly RangoFechas[]; periodoId: string; timeZone?: string },
): { evento: Record<string, unknown>; primeraFecha: string | null } {
  const tz = opciones.timeZone ?? 'Europe/Madrid';
  const { primeraFecha, fechasExcluidas } = ocurrenciasSemanales(celda.dia, opciones.periodo, opciones.festivos);
  const datos = datosPlantillaDeCelda(celda, opciones.emoji);
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
