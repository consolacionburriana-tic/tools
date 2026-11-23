// «Marta falta mañana a 3ª y 4ª, médico»: una sustitución escrita como se dice, en la paleta ⌘K
// (David, 23-nov-2026). Lógica PURA, con tests: entiende quién, cuándo, a qué horas y por qué sin
// llamar a nadie. Si algo se le escapa, el servidor puede pedir ayuda a Claude
// (`sustituciones-interpretar-server.ts`), que devuelve lo mismo y se vuelve a casar aquí.
// Nunca guarda nada: lo entendido abre la propuesta ya rellenada y Jefatura confirma.
import { diaSemana, sumarDias } from '@/lib/oratorios';

export interface ProfeNombre {
  id: string;
  nombre: string;
}

export interface Interpretacion {
  profe: ProfeNombre | null;
  /** Varios casan igual de bien (dos Martas): que elija. */
  dudas: ProfeNombre[];
  desde: string | null;
  hasta: string | null;
  /** Ordinales de las horas («3ª», «4ª»), tal como se llaman en el horario. */
  tramos: string[];
  /** O una franja en horas de reloj. */
  horaInicio: string | null;
  horaFin: string | null;
  motivo: string | null;
  /** Lo que ha entendido, en trocitos para enseñarlo. */
  entendido: string[];
}

export const sinAcentos = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const ORDINALES: Record<string, number> = { primera: 1, segunda: 2, tercera: 3, cuarta: 4, quinta: 5, sexta: 6, septima: 7, octava: 8 };

/** Palabras que nunca son un nombre (para no casar «falta» con nadie). */
const VACIAS = new Set(
  [
    'falta', 'faltara', 'faltan', 'no', 'esta', 'estara', 'viene', 'vendra', 'hoy', 'manana', 'pasado', 'el', 'la', 'los', 'las', 'de', 'del', 'al', 'a', 'y', 'e', 'por', 'para', 'con', 'en', 'que', 'se', 'va', 'hora', 'horas', 'toda', 'todo', 'dia', 'semana', 'proximo', 'proxima', 'siguiente', 'que', 'viene', 'esta', 'medico', 'medica', 'familiar', 'enfermo', 'enferma', 'baja', 'salida', 'excursion', 'curso', 'formacion', 'reunion', 'otros', 'sustitucion', 'sustituir', 'cubrir', 'su', 'sus', 'hijo', 'hija', 'madre', 'padre', 'mañana', 'tarde', 'primera', 'segunda', 'tercera', 'cuarta', 'quinta', 'sexta', 'septima',
    ...DIAS,
    ...MESES,
  ].map(sinAcentos),
);

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** El próximo día de la semana `dia` (1-7) desde hoy (hoy incluido). */
function proximo(hoy: string, dia: number, saltarSemana = false): string {
  let f = hoy;
  for (let i = 0; i < 7 && diaSemana(f) !== dia; i++) f = sumarDias(f, 1);
  return saltarSemana && f === hoy ? sumarDias(f, 7) : f;
}

/** Una fecha suelta escrita a mano: «hoy», «mañana», «el jueves», «15/12», «3 de diciembre». */
function fechaDe(token: string, hoy: string, proximoMarcado: boolean): string | null {
  const t = sinAcentos(token).trim();
  if (t === 'hoy') return hoy;
  if (t === 'manana') return sumarDias(hoy, 1);
  if (t === 'pasado manana') return sumarDias(hoy, 2);
  const i = DIAS.indexOf(t);
  if (i >= 0) return proximo(hoy, i + 1, proximoMarcado);
  const num = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/.exec(t);
  const largo = /^(\d{1,2}) de ([a-z]+)$/.exec(t);
  let d: number | null = null;
  let m: number | null = null;
  let y = Number(hoy.slice(0, 4));
  if (num) {
    d = Number(num[1]);
    m = Number(num[2]);
    if (num[3]) y = Number(num[3].length === 2 ? `20${num[3]}` : num[3]);
  } else if (largo && MESES.includes(largo[2])) {
    d = Number(largo[1]);
    m = MESES.indexOf(largo[2]) + 1;
  }
  if (!d || !m || m > 12 || d > 31) return null;
  let f = iso(y, m, d);
  // Sin año, una fecha que ya ha pasado (en diciembre, «15/01») es del año que viene.
  if (!num?.[3] && f < hoy) f = iso(y + 1, m, d);
  return f;
}

const RE_FECHA = '(?:pasado manana|manana|hoy|lunes|martes|miercoles|jueves|viernes|\\d{1,2}[/-]\\d{1,2}(?:[/-]\\d{2,4})?|\\d{1,2} de (?:' + MESES.join('|') + '))';

function hhmm(h: string): string | null {
  const m = /^(\d{1,2})(?:[:.h](\d{2}))?$/.exec(h);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2] ?? 0);
  if (hh < 7 || hh > 20 || mm > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Los ordinales de un rango «de 2ª a 4ª» o una lista «3ª y 4ª», «1a, 2a». */
function tramosDe(texto: string): number[] {
  const t = texto.replace(/\b(primera|segunda|tercera|cuarta|quinta|sexta|septima|octava)\b/g, (w) => `${ORDINALES[w]}ª`);
  const rango = /(?:de|desde)\s+(?:la\s+)?(\d)\s*(?:ª|º|°|a\b)?\s*(?:a|hasta)\s+(?:la\s+)?(\d)(?!\d)/.exec(t);
  if (rango) {
    const a = Number(rango[1]);
    const b = Number(rango[2]);
    if (b >= a && b - a < 10) return Array.from({ length: b - a + 1 }, (_, i) => a + i);
  }
  const sueltos = [...t.matchAll(/(?:^|[\s,(])(\d)\s*(?:ª|º|°|a(?=[\s,.)y]|$))/g)].map((m) => Number(m[1]));
  return [...new Set(sueltos)].filter((n) => n >= 1 && n <= 10).sort((a, b) => a - b);
}

/** El motivo por palabras clave (lo de salud solo se apunta, no sale en ningún correo). */
export function motivoDe(texto: string): string | null {
  const t = sinAcentos(texto);
  if (/\bbaja\b/.test(t)) return 'baja';
  if (/\bmedic[oa]s?\b|\bconsulta\b|\bdentista\b|\banalisis\b/.test(t)) {
    return /\b(familiar|hij[oa]s?|madre|padre|marido|mujer|pareja|abuel[oa]|acompana)\b/.test(t) ? 'medico_familiar' : 'medico';
  }
  if (/\b(enferm[oa]|fiebre|gripe|malo|mala|malestar|covid|resfriad[oa])\b/.test(t)) return 'enfermedad_leve';
  if (/\b(salida|excursion|convivencia|formacion|curso|jornada|actividad|reunion|claustro|visita|viaje de estudios|colonias)\b/.test(t)) return 'actividad_escolar';
  return null;
}

function puntuar(palabras: string[], nombre: string): number {
  const partes = sinAcentos(nombre).split(/[\s.-]+/).filter(Boolean);
  let p = 0;
  for (const w of palabras) {
    if (partes.includes(w)) p += 3;
    else if (w.length >= 3 && partes.some((x) => x.startsWith(w))) p += 1;
  }
  return p;
}

/** Quién: el profe cuyo nombre casa mejor con las palabras sueltas del texto. */
export function profeDe(texto: string, profes: readonly ProfeNombre[]): { profe: ProfeNombre | null; dudas: ProfeNombre[] } {
  const palabras = sinAcentos(texto)
    .replace(/[^a-z0-9ñ\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !VACIAS.has(w) && !/^\d/.test(w));
  if (palabras.length === 0) return { profe: null, dudas: [] };
  const puntos = profes.map((p) => ({ p, n: puntuar(palabras, p.nombre) })).filter((x) => x.n > 0);
  if (puntos.length === 0) return { profe: null, dudas: [] };
  const max = Math.max(...puntos.map((x) => x.n));
  const mejores = puntos.filter((x) => x.n === max).map((x) => x.p);
  return mejores.length === 1 ? { profe: mejores[0], dudas: [] } : { profe: null, dudas: mejores.slice(0, 6) };
}

export function interpretar(texto: string, hoy: string, profes: readonly ProfeNombre[]): Interpretacion {
  const t = sinAcentos(texto).replace(/\s+/g, ' ').trim();
  const entendido: string[] = [];

  // Cuándo
  let desde: string | null = null;
  let hasta: string | null = null;
  const proximoMarcado = /\b(proximo|proxima|que viene|siguiente)\b/.test(t);
  if (/\b(toda la semana|esta semana)\b/.test(t)) {
    desde = hoy;
    hasta = proximo(hoy, 5);
  } else if (/\bla semana que viene\b|\bla proxima semana\b/.test(t)) {
    desde = proximo(hoy, 1, true);
    hasta = sumarDias(desde, 4);
  } else {
    const rango = new RegExp(`(?:del?|desde)\\s+(?:el\\s+)?(${RE_FECHA})\\s+(?:al?|hasta)\\s+(?:el\\s+)?(${RE_FECHA})`).exec(t);
    if (rango) {
      desde = fechaDe(rango[1], hoy, proximoMarcado);
      hasta = desde ? fechaDe(rango[2], desde, false) : null;
    } else {
      const una = new RegExp(`\\b(${RE_FECHA})\\b`).exec(t);
      if (una) desde = hasta = fechaDe(una[1], hoy, proximoMarcado);
    }
  }
  if (desde && hasta && hasta < desde) hasta = desde;

  // A qué horas: ordinales («3ª y 4ª») o reloj («de 9 a 11», «a las 10:30»).
  let tramos: string[] = [];
  let horaInicio: string | null = null;
  let horaFin: string | null = null;
  const todoElDia = /\btodo el dia\b|\btoda la (?:manana|jornada)\b/.test(t);
  if (!todoElDia) {
    const reloj = /(?:de|desde)\s+(?:las\s+)?(\d{1,2}(?:[:.h]\d{2})?)\s*(?:h\b)?\s*(?:a|hasta)\s+(?:las\s+)?(\d{1,2}(?:[:.h]\d{2})?)(?!\s*[ªº°])/.exec(t);
    const aLas = /a las (\d{1,2}(?:[:.h]\d{2})?)/.exec(t);
    if (reloj && hhmm(reloj[1]) && hhmm(reloj[2])) {
      horaInicio = hhmm(reloj[1]);
      horaFin = hhmm(reloj[2]);
    } else if (aLas && hhmm(aLas[1])) {
      horaInicio = hhmm(aLas[1]);
    } else {
      tramos = tramosDe(t).map((n) => `${n}ª`);
    }
  }

  const motivo = motivoDe(t);
  const { profe, dudas } = profeDe(texto, profes);

  if (profe) entendido.push(profe.nombre);
  if (desde) entendido.push(desde === hasta ? desde : `${desde} → ${hasta}`);
  if (tramos.length) entendido.push(tramos.join(', '));
  if (horaInicio) entendido.push(horaFin ? `${horaInicio}-${horaFin}` : `a las ${horaInicio}`);
  if (todoElDia) entendido.push('todo el día');
  if (motivo) entendido.push(motivo);
  return { profe, dudas, desde, hasta, tramos, horaInicio, horaFin, motivo, entendido };
}

/** ¿Parece una sustitución? (para que la paleta lo ofrezca sin prefijo). */
export function pareceSustitucion(texto: string): boolean {
  const t = sinAcentos(texto);
  return /^\s*s\s+\S/.test(t) || /\b(falta|faltara|no viene|no esta|no vendra|sustituci|sustituir|cubrir a)\b/.test(t);
}

/** La URL que abre el calendario con la nueva sustitución ya rellenada. */
export function urlNueva(i: Pick<Interpretacion, 'profe' | 'desde' | 'hasta' | 'tramos' | 'horaInicio' | 'horaFin' | 'motivo'>): string {
  const p = new URLSearchParams({ nueva: '1' });
  if (i.profe) p.set('profe', i.profe.id);
  if (i.desde) {
    p.set('desde', i.desde);
    p.set('hasta', i.hasta ?? i.desde);
    p.set('semana', i.desde);
  }
  if (i.tramos.length) p.set('tramos', i.tramos.join(','));
  if (i.horaInicio) p.set('hi', i.horaInicio);
  if (i.horaFin) p.set('hf', i.horaFin);
  if (i.motivo) p.set('motivo', i.motivo);
  return `/gestion/sustituciones?${p.toString()}`;
}
