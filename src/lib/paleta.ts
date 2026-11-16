// La paleta de ⌘K (todo /gestion): helpers puros. Lo que hace cada cosa, en docs/34-paleta-y-tareas-por-correo.md.
//
// La tarea rápida se escribe en una línea: `t proyector 3ºB @amparo viernes !alta #mant`
//   · `t ` delante (o `+ `) = crear una tarea;
//   · `@amparo` = responsable (por nombre o correo, de los miembros del equipo del tablero);
//   · `!alta` (`!urgente`, `!media`, `!baja`; `!!` = alta, `!!!` = urgente) = prioridad;
//   · `#mant` = en qué tablero (por el principio de su nombre, sin tildes; sin `#`, el primero);
//   · `hoy`, `mañana`, `lunes`…`domingo`, `15/12` = para cuándo;
//   · el resto, el título.
import { PRIORIDADES, type Prioridad } from './tableros';

export interface TareaRapida {
  titulo: string;
  menciones: string[];
  tablero: string | null;
  prioridad: Prioridad | null;
  vence: string | null;
}

export function normalizar(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** ¿Es una tarea rápida? `t algo` o `+ algo`. */
export function esTareaRapida(texto: string): boolean {
  return /^(t|\+)\s+\S/i.test(texto.trimStart());
}

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

function sumarDias(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Una palabra de fecha a 'YYYY-MM-DD' (o null si no lo es). Los días de la semana, el próximo (hoy no). */
export function fechaDePalabra(palabra: string, hoy: string): string | null {
  const p = normalizar(palabra);
  if (p === 'hoy') return hoy;
  if (p === 'manana') return sumarDias(hoy, 1);
  if (p === 'pasado') return sumarDias(hoy, 2);
  const dia = DIAS.indexOf(p);
  if (dia >= 0) {
    const actual = new Date(`${hoy}T12:00:00Z`).getUTCDay();
    const delta = (dia - actual + 7) % 7 || 7;
    return sumarDias(hoy, delta);
  }
  const m = p.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (m) {
    const [d, mes] = [Number(m[1]), Number(m[2])];
    if (d < 1 || d > 31 || mes < 1 || mes > 12) return null;
    let anio = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : Number(hoy.slice(0, 4));
    const iso = (a: number) => `${a}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    // Sin año, la fecha que viene: el 15/01 escrito en diciembre es del año siguiente.
    if (!m[3] && iso(anio) < hoy) anio++;
    return iso(anio);
  }
  return null;
}

const PRIORIDAD_DE: Record<string, Prioridad> = { '!': 'alta', '!!': 'urgente' };

export function interpretarTarea(texto: string, hoy: string): TareaRapida {
  const sin = texto.trimStart().replace(/^(t|\+)\s+/i, '');
  const titulo: string[] = [];
  const menciones: string[] = [];
  let tablero: string | null = null;
  let prioridad: Prioridad | null = null;
  let vence: string | null = null;
  for (const palabra of sin.split(/\s+/).filter(Boolean)) {
    if (/^@\S+/.test(palabra)) {
      menciones.push(palabra.slice(1));
      continue;
    }
    if (/^#\S+/.test(palabra)) {
      tablero = palabra.slice(1);
      continue;
    }
    if (/^!+$/.test(palabra)) {
      prioridad = PRIORIDAD_DE[palabra.slice(1)] ?? (palabra.length >= 3 ? 'urgente' : 'alta');
      continue;
    }
    const pr = palabra.match(/^!(\S+)$/);
    if (pr && (PRIORIDADES as readonly string[]).includes(normalizar(pr[1]))) {
      prioridad = normalizar(pr[1]) as Prioridad;
      continue;
    }
    const f: string | null = vence === null ? fechaDePalabra(palabra, hoy) : null;
    if (f) {
      vence = f;
      continue;
    }
    titulo.push(palabra);
  }
  const t = titulo.join(' ');
  return { titulo: t ? t[0].toUpperCase() + t.slice(1) : '', menciones, tablero, prioridad, vence };
}

/** El tablero al que va: el que empieza por lo escrito tras `#` (sin tildes ni espacios); si no, el primero. */
export function elegirTablero<T extends { nombre: string }>(tableros: readonly T[], pista: string | null): T | null {
  if (!pista) return tableros[0] ?? null;
  const p = normalizar(pista).replace(/\s+/g, '');
  const sinEsp = (n: string) => normalizar(n).replace(/\s+/g, '');
  return (
    tableros.find((t) => sinEsp(t.nombre).startsWith(p)) ??
    tableros.find((t) => normalizar(t.nombre).split(/\s+/).some((w) => w.startsWith(p))) ??
    tableros.find((t) => sinEsp(t.nombre).includes(p)) ??
    null
  );
}

/** A quién se refiere `@amparo`: el miembro cuyo nombre (alguna palabra) o correo empieza así. Null si no hay o hay dudas. */
export function elegirPersona<T extends { email: string; nombre: string | null }>(miembros: readonly T[], pista: string): T | null {
  const p = normalizar(pista);
  if (!p) return null;
  const casan = miembros.filter(
    (m) => normalizar(m.email).startsWith(p) || normalizar(m.nombre ?? '').split(/\s+/).some((w) => w.startsWith(p)),
  );
  return casan.length === 1 ? casan[0] : null;
}
