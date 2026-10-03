// Tableros (kanban por equipos): helpers puros, tipos y validación. Ficha: docs/27-tableros.md.
//
// La regla que manda sobre todo el módulo: **se entra por ser miembro del equipo, nunca por el
// rol**. Por eso aquí no hay nada de permisos de rol: lo único que se mira es si alguien es
// `admin` o `miembro` de un equipo (`tab_miembros`).
//
// Todo lo de fechas va en días (`YYYY-MM-DD`) y en hora de Madrid: un deadline es «el viernes»,
// no «el viernes a las 23:59 UTC».
import { z } from 'zod';
import { CONFIGURACION } from '@/lib/configuracion';

// ─── Catálogos ───────────────────────────────────────────────────────────────

export const PRIORIDADES = ['baja', 'media', 'alta', 'urgente'] as const;
export type Prioridad = (typeof PRIORIDADES)[number];

export const PRIORIDAD_LABELS: Record<Prioridad, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  urgente: 'Urgente',
};

/** Peso para ordenar «lo tuyo»: lo urgente primero. */
export const PRIORIDAD_PESO: Record<Prioridad, number> = { urgente: 0, alta: 1, media: 2, baja: 3 };

/** Colores de fondo de equipos y tableros (las clases de Tailwind viven en el componente). */
export const COLORES_TABLERO = ['azul', 'violeta', 'verde', 'naranja', 'rosa', 'teal', 'ambar', 'gris'] as const;
export type ColorTablero = (typeof COLORES_TABLERO)[number];

/** Colores de las etiquetas de las tarjetas. */
export const COLORES_ETIQUETA = ['rojo', 'naranja', 'ambar', 'verde', 'teal', 'azul', 'violeta', 'rosa', 'gris'] as const;
export type ColorEtiqueta = (typeof COLORES_ETIQUETA)[number];

export const ROLES_EQUIPO = ['admin', 'miembro'] as const;
export type RolEquipo = (typeof ROLES_EQUIPO)[number];

/** Las columnas con las que nace un tablero. La última es la de «terminado». */
export const COLUMNAS_INICIALES: readonly { nombre: string; hecho: boolean }[] = [
  { nombre: 'Por hacer', hecho: false },
  { nombre: 'En curso', hecho: false },
  { nombre: 'Hecho', hecho: true },
];

// ─── Tipos que viajan a la interfaz ──────────────────────────────────────────

export interface Persona {
  email: string;
  nombre: string;
}

export interface Miembro extends Persona {
  rol: RolEquipo;
}

export interface Etiqueta {
  id: string;
  nombre: string;
  color: ColorEtiqueta;
}

export interface ItemChecklist {
  id: string;
  texto: string;
  hecho: boolean;
}

export interface Enlace {
  id: string;
  url: string;
  titulo: string | null;
}

export interface TableroResumen {
  id: string;
  equipoId: string;
  nombre: string;
  emoji: string;
  color: ColorTablero;
  descripcion: string | null;
  archivado: boolean;
  orden: number;
  /** Tarjetas sin terminar ni archivar. */
  abiertas: number;
  /** De esas, las que tienen el deadline pasado. */
  vencidas: number;
}

export interface Equipo {
  id: string;
  nombre: string;
  emoji: string;
  color: ColorTablero;
  descripcion: string | null;
  miRol: RolEquipo;
  miembros: Miembro[];
  tableros: TableroResumen[];
}

export interface Columna {
  id: string;
  nombre: string;
  orden: number;
  hecho: boolean;
}

export interface Tarjeta {
  id: string;
  tableroId: string;
  columnaId: string;
  titulo: string;
  descripcion: string | null;
  prioridad: Prioridad | null;
  vence: string | null; // YYYY-MM-DD
  orden: number;
  responsables: string[];
  etiquetas: string[];
  checklist: ItemChecklist[];
  enlaces: Enlace[];
  completadaAt: string | null;
  archivadaAt: string | null;
  createdBy: string | null;
  createdByNombre: string | null;
  createdAt: string;
  updatedAt: string;
  comentarios: number;
}

export interface Tablero {
  id: string;
  equipoId: string;
  nombre: string;
  emoji: string;
  color: ColorTablero;
  descripcion: string | null;
  etiquetas: Etiqueta[];
  archivado: boolean;
}

export interface DatosTablero {
  tablero: Tablero;
  equipo: { id: string; nombre: string; emoji: string; color: ColorTablero; miRol: RolEquipo };
  columnas: Columna[];
  tarjetas: Tarjeta[];
  miembros: Miembro[];
  /** Los demás tableros del equipo, para moverse entre ellos de un toque. */
  hermanos: { id: string; nombre: string; emoji: string }[];
  yo: string;
  hoy: string;
}

export interface Seguimiento {
  id: string;
  tipo: 'comentario' | 'actividad';
  texto: string;
  autorEmail: string | null;
  autorNombre: string | null;
  createdAt: string;
}

/** Una tarjeta mía, vista desde fuera de su tablero (avisos, escritorio, «lo tuyo»). */
export interface TarjetaMia {
  id: string;
  titulo: string;
  prioridad: Prioridad | null;
  vence: string | null;
  tableroId: string;
  tableroNombre: string;
  tableroEmoji: string;
  equipoNombre: string;
  columnaNombre: string;
  checklistHechos: number;
  checklistTotal: number;
}

export interface Preferencias {
  correoAsignacion: boolean;
  correoVencimientos: boolean;
}

// ─── Fechas ──────────────────────────────────────────────────────────────────

/** Hoy en Madrid, `YYYY-MM-DD` (el servidor va en UTC). */
export function hoyISO(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CONFIGURACION.calendario.zonaHoraria }).format(ahora);
}

function aUTC(iso: string): number {
  const [a, m, d] = iso.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
}

/** Días de `desde` a `hasta` (negativo si `hasta` ya pasó). */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aUTC(hasta) - aUTC(desde)) / 86_400_000);
}

export function sumarDias(iso: string, dias: number): string {
  return new Date(aUTC(iso) + dias * 86_400_000).toISOString().slice(0, 10);
}

/** El próximo viernes (o hoy si ya es viernes): el «para esta semana» del claustro. */
export function proximoViernes(hoy: string): string {
  const dia = new Date(aUTC(hoy)).getUTCDay(); // 0 domingo … 5 viernes
  return sumarDias(hoy, (5 - dia + 7) % 7);
}

export type EstadoVence = 'sin' | 'hecha' | 'vencida' | 'hoy' | 'manana' | 'pronto' | 'futura';

/** Días que se consideran «pronto» (aviso ámbar en la tarjeta). */
export const DIAS_PRONTO = 3;

/** En qué punto está el deadline de una tarjeta. Lo terminado no avisa nunca. */
export function estadoVence(vence: string | null, hoy: string, hecha = false): { estado: EstadoVence; dias: number | null } {
  if (!vence) return { estado: 'sin', dias: null };
  const dias = diasEntre(hoy, vence);
  if (hecha) return { estado: 'hecha', dias };
  if (dias < 0) return { estado: 'vencida', dias };
  if (dias === 0) return { estado: 'hoy', dias };
  if (dias === 1) return { estado: 'manana', dias };
  if (dias <= DIAS_PRONTO) return { estado: 'pronto', dias };
  return { estado: 'futura', dias };
}

/** ¿Esto tiene que saltar a la vista fuera del tablero? Vencidas, de hoy y de mañana. */
export function esUrgente(estado: EstadoVence): boolean {
  return estado === 'vencida' || estado === 'hoy' || estado === 'manana';
}

const FORMATO_DIA = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const FORMATO_DIA_SEMANA = new Intl.DateTimeFormat('es-ES', { weekday: 'long', timeZone: 'UTC' });
const FORMATO_LARGO = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

/** `12 oct` */
export function diaCorto(iso: string): string {
  return FORMATO_DIA.format(new Date(aUTC(iso))).replace('.', '');
}

/** `domingo, 12 de octubre` */
export function diaLargo(iso: string): string {
  return FORMATO_LARGO.format(new Date(aUTC(iso)));
}

/** Cómo se lee un deadline en una tarjeta: «Hoy», «Mañana», «el jueves», «hace 3 días», «12 oct». */
export function textoVence(vence: string, hoy: string): string {
  const dias = diasEntre(hoy, vence);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Mañana';
  if (dias === -1) return 'Ayer';
  if (dias < 0 && dias >= -6) return `Hace ${-dias} días`;
  if (dias > 1 && dias <= 6) return FORMATO_DIA_SEMANA.format(new Date(aUTC(vence))).replace(/^./, (c) => c.toUpperCase());
  return diaCorto(vence);
}

// ─── Orden dentro de una columna ─────────────────────────────────────────────

export const PASO_ORDEN = 1024;

/**
 * El `orden` para dejar una tarjeta entre `antes` y `despues` (cualquiera de los dos puede no
 * existir: principio o final de la columna). Con decimales, para no renumerar nada.
 */
export function ordenEntre(antes: number | null | undefined, despues: number | null | undefined): number {
  const a = antes ?? null;
  const d = despues ?? null;
  if (a === null && d === null) return PASO_ORDEN;
  if (a === null) return (d as number) - PASO_ORDEN;
  if (d === null) return a + PASO_ORDEN;
  return (a + d) / 2;
}

/** Ordena tarjetas como se pintan en su columna. */
export function porOrden<T extends { orden: number; createdAt?: string }>(a: T, b: T): number {
  return a.orden - b.orden || (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
}

// ─── Personas ────────────────────────────────────────────────────────────────

/** `Ana Pérez` → `AP` · `David` → `DA` · correo suelto → sus dos primeras letras. */
export function iniciales(nombre: string | null | undefined, email?: string | null): string {
  const limpio = (nombre ?? '').trim();
  if (limpio) {
    const trozos = limpio.split(/\s+/).filter((t) => /\p{L}/u.test(t));
    if (trozos.length >= 2) return (trozos[0][0] + trozos[1][0]).toUpperCase();
    if (trozos.length === 1) return trozos[0].slice(0, 2).toUpperCase();
  }
  return (email ?? '?').slice(0, 2).toUpperCase();
}

/** Índice de color estable por persona (el mismo círculo de color en todas partes). */
export function indiceColorPersona(email: string, colores: number): number {
  let h = 0;
  for (const c of email.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % colores;
}

/** El nombre que se enseña de alguien: el de la lista de miembros o, si ya no está, su correo. */
export function nombreDe(email: string, personas: readonly Persona[]): string {
  return personas.find((p) => p.email === email)?.nombre || email.split('@')[0];
}

/** `Ana Pérez Gil` → `Ana` (para saludar en un correo). */
export function pilaDe(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre;
}

// ─── Enlaces ─────────────────────────────────────────────────────────────────

export type TipoEnlace = 'tools' | 'drive' | 'doc' | 'hoja' | 'presentacion' | 'formulario' | 'classroom' | 'calendar' | 'web';

/** Pone `https://` a lo que se pega sin él («drive.google.com/…»). Devuelve null si no es una URL. */
export function normalizarUrl(texto: string): string | null {
  const t = texto.trim();
  if (!t) return null;
  // Enlaces internos de la propia plataforma: se guardan tal cual («/gestion/alumnado?…»).
  if (t.startsWith('/')) return t;
  const conProtocolo = /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(conProtocolo);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Qué es un enlace, para ponerle su icono. */
export function tipoEnlace(url: string, hostApp?: string | null): TipoEnlace {
  if (url.startsWith('/')) return 'tools';
  let host = '';
  let ruta = '';
  try {
    const u = new URL(url);
    host = u.hostname.toLowerCase();
    ruta = u.pathname;
  } catch {
    return 'web';
  }
  if (hostApp && host === hostApp.toLowerCase()) return 'tools';
  if (host === 'docs.google.com') {
    if (ruta.startsWith('/document')) return 'doc';
    if (ruta.startsWith('/spreadsheets')) return 'hoja';
    if (ruta.startsWith('/presentation')) return 'presentacion';
    if (ruta.startsWith('/forms')) return 'formulario';
    return 'drive';
  }
  if (host === 'drive.google.com') return 'drive';
  if (host === 'forms.gle') return 'formulario';
  if (host === 'classroom.google.com') return 'classroom';
  if (host === 'calendar.google.com') return 'calendar';
  return 'web';
}

/** El texto de un enlace sin título: el dominio y poco más. */
export function tituloEnlace(e: { url: string; titulo: string | null }): string {
  if (e.titulo?.trim()) return e.titulo.trim();
  if (e.url.startsWith('/')) return e.url;
  try {
    const u = new URL(e.url);
    const ruta = u.pathname.length > 1 ? u.pathname : '';
    const corto = `${u.hostname.replace(/^www\./, '')}${ruta}`;
    return corto.length > 48 ? `${corto.slice(0, 47)}…` : corto;
  } catch {
    return e.url;
  }
}

// ─── Lo tuyo ─────────────────────────────────────────────────────────────────

export type GrupoMio = 'vencidas' | 'hoy' | 'semana' | 'despues' | 'sin';

export const GRUPO_MIO_LABELS: Record<GrupoMio, string> = {
  vencidas: 'Vencidas',
  hoy: 'Hoy y mañana',
  semana: 'Próximos días',
  despues: 'Más adelante',
  sin: 'Sin fecha',
};

export function grupoMio(vence: string | null, hoy: string): GrupoMio {
  if (!vence) return 'sin';
  const dias = diasEntre(hoy, vence);
  if (dias < 0) return 'vencidas';
  if (dias <= 1) return 'hoy';
  if (dias <= 7) return 'semana';
  return 'despues';
}

/** Lo mío agrupado y ordenado: por fecha y, a igual fecha, lo más prioritario arriba. */
export function agruparMias(tarjetas: readonly TarjetaMia[], hoy: string): { grupo: GrupoMio; tarjetas: TarjetaMia[] }[] {
  const orden: GrupoMio[] = ['vencidas', 'hoy', 'semana', 'despues', 'sin'];
  const peso = (p: Prioridad | null) => (p ? PRIORIDAD_PESO[p] : 4);
  const ordenadas = [...tarjetas].sort(
    (a, b) =>
      (a.vence ?? '9999').localeCompare(b.vence ?? '9999') || peso(a.prioridad) - peso(b.prioridad) || a.titulo.localeCompare(b.titulo, 'es'),
  );
  return orden
    .map((grupo) => ({ grupo, tarjetas: ordenadas.filter((t) => grupoMio(t.vence, hoy) === grupo) }))
    .filter((g) => g.tarjetas.length > 0);
}

/** Cuántas hay de cada cosa para el aviso general: vencidas, de hoy y de mañana. */
export function resumenUrgente(tarjetas: readonly Pick<TarjetaMia, 'vence'>[], hoy: string): { vencidas: number; hoy: number; manana: number } {
  const r = { vencidas: 0, hoy: 0, manana: 0 };
  for (const t of tarjetas) {
    const { estado } = estadoVence(t.vence, hoy);
    if (estado === 'vencida') r.vencidas++;
    else if (estado === 'hoy') r.hoy++;
    else if (estado === 'manana') r.manana++;
  }
  return r;
}

/** «2 vencidas · 1 para hoy» — o null si no hay nada que decir. */
export function textoResumenUrgente(r: { vencidas: number; hoy: number; manana: number }): string | null {
  const partes: string[] = [];
  if (r.vencidas) partes.push(`${r.vencidas} vencida${r.vencidas === 1 ? '' : 's'}`);
  if (r.hoy) partes.push(`${r.hoy} para hoy`);
  if (r.manana) partes.push(`${r.manana} para mañana`);
  return partes.length ? partes.join(' · ') : null;
}

// ─── Avisos de vencimiento (cron diario) ─────────────────────────────────────

export interface CandidataAviso {
  id: string;
  vence: string;
  avisoProximoPara: string | null;
  avisoVencidoPara: string | null;
}

/**
 * Qué aviso toca mandar hoy de una tarjeta abierta con deadline. Cada aviso sale UNA vez por
 * deadline: «vence mañana/hoy» (`margen` días antes; el viernes, 3, para que llegue lo del lunes)
 * y, si se pasa, «ha vencido». Si alguien cambia la fecha, los
 * dos vuelven a estar disponibles (se comparan con la fecha que se avisó, no con un sí/no).
 */
export function avisoQueToca(t: CandidataAviso, hoy: string, margen = 1): 'proximo' | 'vencido' | null {
  const dias = diasEntre(hoy, t.vence);
  if (dias < 0) return t.avisoVencidoPara === t.vence ? null : 'vencido';
  if (dias <= margen) return t.avisoProximoPara === t.vence ? null : 'proximo';
  return null;
}

// ─── Checklist ───────────────────────────────────────────────────────────────

export function progresoChecklist(items: readonly ItemChecklist[]): { hechos: number; total: number } {
  return { hechos: items.filter((i) => i.hecho).length, total: items.length };
}

/** Una línea por item, como se escribe rápido en un textarea. */
export function checklistDeTexto(texto: string, nuevoId: () => string): ItemChecklist[] {
  return texto
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*•]|\[ ?\]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
    .map((t) => ({ id: nuevoId(), texto: t.slice(0, 300), hecho: false }));
}

// ─── Validación (cliente y servidor) ─────────────────────────────────────────

const texto = (max: number, msg = 'Escribe algo') => z.string().trim().min(1, msg).max(max);
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v ? v : null)) // vacío = null
    // Lo que no se manda se queda `undefined`: en una edición, «no lo toques».
    .optional();
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida');
const correo = z.string().trim().toLowerCase().email('Correo no válido');
const id = z.string().min(1).max(64);

export const personaSchema = z.object({ email: correo, nombre: z.string().trim().max(120) });

const datosEquipo = {
  nombre: texto(60, 'Ponle nombre al equipo'),
  emoji: z.string().trim().min(1).max(16).default('👥'),
  color: z.enum(COLORES_TABLERO).default('azul'),
  descripcion: textoOpcional(500),
};

export const crearEquipoSchema = z.object({
  ...datosEquipo,
  miembros: z.array(personaSchema).max(100).default([]),
});
export type CrearEquipo = z.infer<typeof crearEquipoSchema>;
export type EntradaCrearEquipo = z.input<typeof crearEquipoSchema>;

const etiquetaSchema = z.object({ id, nombre: z.string().trim().max(40), color: z.enum(COLORES_ETIQUETA) });

export const accionEquipoSchema = z.discriminatedUnion('accion', [
  z.object({
    accion: z.literal('editar'),
    nombre: datosEquipo.nombre.optional(),
    emoji: z.string().trim().min(1).max(16).optional(),
    color: z.enum(COLORES_TABLERO).optional(),
    descripcion: textoOpcional(500),
    archivado: z.boolean().optional(),
  }),
  z.object({ accion: z.literal('anadirMiembros'), miembros: z.array(personaSchema).min(1).max(100) }),
  z.object({ accion: z.literal('quitarMiembro'), email: correo }),
  z.object({ accion: z.literal('rolMiembro'), email: correo, rol: z.enum(ROLES_EQUIPO) }),
  z.object({ accion: z.literal('salir') }),
  z.object({
    accion: z.literal('crearTablero'),
    nombre: texto(60, 'Ponle nombre al tablero'),
    emoji: z.string().trim().min(1).max(16).default('📋'),
    color: z.enum(COLORES_TABLERO).default('azul'),
    descripcion: textoOpcional(500),
  }),
  z.object({ accion: z.literal('ordenTableros'), ids: z.array(id).max(200) }),
]);
export type AccionEquipo = z.infer<typeof accionEquipoSchema>;
export type EntradaAccionEquipo = z.input<typeof accionEquipoSchema>;

export const accionTableroSchema = z.discriminatedUnion('accion', [
  z.object({
    accion: z.literal('editar'),
    nombre: texto(60, 'Ponle nombre al tablero').optional(),
    emoji: z.string().trim().min(1).max(16).optional(),
    color: z.enum(COLORES_TABLERO).optional(),
    descripcion: textoOpcional(500),
    archivado: z.boolean().optional(),
  }),
  z.object({ accion: z.literal('etiquetas'), etiquetas: z.array(etiquetaSchema).max(30) }),
  z.object({ accion: z.literal('crearColumna'), nombre: texto(40, 'Ponle nombre a la lista'), hecho: z.boolean().default(false) }),
  z.object({
    accion: z.literal('editarColumna'),
    columnaId: id,
    nombre: texto(40).optional(),
    hecho: z.boolean().optional(),
  }),
  z.object({ accion: z.literal('borrarColumna'), columnaId: id }),
  z.object({ accion: z.literal('ordenColumnas'), ids: z.array(id).min(1).max(50) }),
  z.object({
    accion: z.literal('crearTarjeta'),
    columnaId: id,
    titulo: texto(200, 'Escribe la tarea'),
    responsables: z.array(correo).max(20).default([]),
    prioridad: z.enum(PRIORIDADES).nullable().default(null),
    vence: fecha.nullable().default(null),
  }),
]);
export type AccionTablero = z.infer<typeof accionTableroSchema>;
export type EntradaAccionTablero = z.input<typeof accionTableroSchema>;

const itemChecklistSchema = z.object({ id, texto: z.string().trim().min(1).max(300), hecho: z.boolean() });
const enlaceSchema = z.object({ id, url: z.string().trim().min(1).max(2000), titulo: z.string().trim().max(120).nullable() });

export const accionTarjetaSchema = z.discriminatedUnion('accion', [
  z.object({
    accion: z.literal('editar'),
    titulo: texto(200, 'La tarea necesita un título').optional(),
    descripcion: textoOpcional(10_000),
    prioridad: z.enum(PRIORIDADES).nullable().optional(),
    vence: fecha.nullable().optional(),
    responsables: z.array(correo).max(20).optional(),
    etiquetas: z.array(id).max(30).optional(),
    checklist: z.array(itemChecklistSchema).max(100).optional(),
    enlaces: z.array(enlaceSchema).max(30).optional(),
  }),
  z.object({ accion: z.literal('mover'), columnaId: id, orden: z.number().finite() }),
  z.object({ accion: z.literal('archivar'), archivada: z.boolean() }),
  z.object({ accion: z.literal('comentar'), texto: texto(4000, 'Escribe el comentario') }),
  z.object({ accion: z.literal('borrarComentario'), comentarioId: id }),
]);
export type AccionTarjeta = z.infer<typeof accionTarjetaSchema>;
export type EntradaAccionTarjeta = z.input<typeof accionTarjetaSchema>;

export const preferenciasSchema = z.object({
  correoAsignacion: z.boolean(),
  correoVencimientos: z.boolean(),
});
