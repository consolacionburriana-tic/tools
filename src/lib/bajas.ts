// Bajas del profesorado — lógica PURA (sin IO), con tests en `__tests__/bajas.test.ts`. Las consultas
// viven en `bajas-server.ts`. Ficha: docs/32-sustituciones.md, «Bajas» (David, 23-nov-2026).
//
// Una baja es: quién, desde cuándo, un alta PREVISTA (posible: una enfermedad) o REAL (segura: una
// paternidad, o la que ya ha llegado), el motivo y si es ampliable. Dos tipos:
//  - **con sustituto**: la persona «desaparece» del radar; quien la sustituye hereda su horario (es
//    una Cobertura por baja, `edu_sustituciones` con `baja_id`) y recibe sustituciones como uno más.
//  - **sin sustituto**: sus horas se cubren con ausencias del día a día (y se elige a mano si se le
//    escribe a ella).
// En los dos casos, mientras dura, NO recibe sustituciones. Fuera de esas fechas, sí: una baja futura
// o una sustitución de hace tres meses, antes de la baja, cuentan como siempre.
import { z } from 'zod';
import { CONFIGURACION } from '@/lib/configuracion';
import { esVigente, type CoberturaBajaBase } from '@/lib/coberturas-baja';

const CFG = CONFIGURACION.sustituciones;

export interface BajaBase {
  profeId: string;
  /** Primer día de baja (`yyyy-MM-dd`). */
  desde: string;
  /** Alta posible: NO cierra la baja, solo avisa de que hay que confirmarla o ampliarla. */
  altaPrevista: string | null;
  /** Alta segura o ya llegada: el primer día de vuelta (ese día ya no está de baja). */
  altaReal: string | null;
}

const sumarDias = (iso: string, n: number): string => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** ¿Está de baja ese día? Desde `desde` hasta el día antes del alta real (sin alta real, sigue). */
export function bajaVigente(b: Pick<BajaBase, 'desde' | 'altaReal'>, fecha: string): boolean {
  return b.desde <= fecha && (!b.altaReal || fecha < b.altaReal);
}

/** Último día de baja (inclusive), o null si sigue abierta. Es el `hasta` de sus coberturas. */
export function ultimoDiaDeBaja(b: Pick<BajaBase, 'altaReal'>): string | null {
  return b.altaReal ? sumarDias(b.altaReal, -1) : null;
}

export type EstadoBaja = 'en_curso' | 'proxima' | 'terminada';

export function estadoBaja(b: Pick<BajaBase, 'desde' | 'altaReal'>, hoy: string): EstadoBaja {
  if (b.desde > hoy) return 'proxima';
  if (b.altaReal && b.altaReal <= hoy) return 'terminada';
  return 'en_curso';
}

/** El alta prevista ya ha pasado y no hay alta real: hay que confirmarla o ampliarla. */
export function altaPorConfirmar(b: Pick<BajaBase, 'desde' | 'altaPrevista' | 'altaReal'>, hoy: string): boolean {
  return !b.altaReal && Boolean(b.altaPrevista) && b.altaPrevista! <= hoy;
}

/**
 * Quién está de baja un día: las bajas vigentes y, además, los titulares de una cobertura vigente
 * sin baja anotada (lo que viene de Educamos sin fechas de baja). Nadie de aquí recibe sustituciones.
 */
export function deBajaEn(fecha: string, bajas: readonly Pick<BajaBase, 'profeId' | 'desde' | 'altaReal'>[], coberturas: readonly CoberturaBajaBase[]): Set<string> {
  const ids = new Set<string>();
  for (const b of bajas) if (bajaVigente(b, fecha)) ids.add(b.profeId);
  for (const c of coberturas) if (esVigente(c, fecha)) ids.add(c.titularId);
  return ids;
}

/**
 * Las fechas de la cobertura de un sustituto dentro de su baja: empieza cuando empieza la baja o
 * cuando llega el sustituto (lo que sea más tarde: Paula está de baja desde el 10 y Alba llega el 19)
 * y acaba con el alta real (sin alta real, abierta).
 */
export function fechasCobertura(b: Pick<BajaBase, 'desde' | 'altaReal'>, llegada: string | null): { desde: string; hasta: string | null } {
  const desde = llegada && llegada > b.desde ? llegada : b.desde;
  return { desde, hasta: ultimoDiaDeBaja(b) };
}

export function nombreMotivoBaja(clave: string): string {
  return CFG.motivosBaja.find((m) => m.clave === clave)?.nombre ?? clave;
}

/** Dos bajas de la misma persona no se pisan (la vigencia, con el alta real como fin; abierta = sin fin). */
export function seSolapan(a: Pick<BajaBase, 'desde' | 'altaReal'>, b: Pick<BajaBase, 'desde' | 'altaReal'>): boolean {
  return a.desde < (b.altaReal ?? '9999-12-31') && b.desde < (a.altaReal ?? '9999-12-31');
}

// ─── Peticiones (Zod, compartidas cliente/servidor) ──────────────────────────

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida');

export const PeticionBaja = z
  .object({
    profeId: z.string().uuid(),
    desde: fecha,
    altaPrevista: fecha.nullable().default(null),
    altaReal: fecha.nullable().default(null),
    motivo: z.string().refine((m) => CFG.motivosBaja.some((x) => x.clave === m), 'Motivo no válido'),
    ampliable: z.boolean().default(false),
    nota: z.string().trim().max(300).nullable().default(null),
    /** Quién la cubre y desde cuándo (vacío = baja sin sustituto). */
    sustitutos: z.array(z.object({ id: z.string().uuid(), desde: fecha.nullable().default(null) })).max(4).default([]),
  })
  .refine((p) => !p.altaPrevista || p.altaPrevista > p.desde, { message: 'El alta prevista va después del primer día de baja', path: ['altaPrevista'] })
  .refine((p) => !p.altaReal || p.altaReal > p.desde, { message: 'El alta va después del primer día de baja', path: ['altaReal'] })
  .refine((p) => !CFG.motivosBaja.find((m) => m.clave === p.motivo)?.pideNota || (p.nota ?? '').length > 0, { message: 'Con «Otros», escribe una nota corta', path: ['nota'] })
  .refine((p) => p.sustitutos.every((s) => s.id !== p.profeId), { message: 'Nadie se sustituye a sí mismo', path: ['sustitutos'] })
  .refine((p) => new Set(p.sustitutos.map((s) => s.id)).size === p.sustitutos.length, { message: 'Hay un sustituto repetido', path: ['sustitutos'] });

export type EntradaBaja = z.infer<typeof PeticionBaja>;
