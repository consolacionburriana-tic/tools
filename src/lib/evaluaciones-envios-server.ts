// Envío de Evaluaciones EN SEGUNDO PLANO. El route no manda nada: guarda una cola (una fila por
// correo en `eval_envio_destinos`) y se va; el trabajo sigue en el servidor con `after()` hasta
// el `maxDuration` de la función y, si queda cola, se pide otra invocación (mismo patrón que el
// worker del Cuaderno de tutor). Nadie tiene que tener la ventana abierta: el panel solo MIRA el
// progreso (`eval_envios.total` / `errores` contra `previstos`) cada par de segundos.
//
// Garantías que importan:
//  · Cada correo se reclama de forma atómica (`FOR UPDATE SKIP LOCKED`): dos pases a la vez no
//    mandan el mismo.
//  · Lo reclamado y no resuelto en 90 s (la función murió) vuelve a la cola.
//  · La invitación del alumno se marca como enviada SOLO si su correo ha salido.
//  · Lo que sale se borra de la cola (lleva el magic link, que es una credencial); solo quedan
//    las filas con error, que son las que se pueden reintentar.
import { after } from 'next/server';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { evalEnvioDestinos, evalEnvios } from '@/db/schema';
import { appBaseUrl } from '@/lib/constants';
import { armarMensaje, type BlastItem } from '@/lib/correos';
import { enviar } from '@/lib/email';
import { varsDeDestinatario } from '@/lib/evaluaciones';
import { CTA_LABEL, type DestinatarioCorreo } from '@/lib/evaluaciones-email';
import { marcarInvitacionesEnviadas } from '@/lib/evaluaciones-server';

/** Tiempo de trabajo por invocación: 45 s del techo de 60 s, el resto para cerrar. */
export const LIMITE_PASE_MS = 45_000;
/** Un correo reclamado y sin resolver tras esto es de un pase que murió: se reencola. */
const RECLAMO_CADUCA_MS = 90_000;

function concurrencia(): number {
  return Math.max(1, Math.min(10, Number(process.env.GMAIL_CONCURRENCIA ?? 3)));
}

const mensajeDe = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ─── Crear el envío ──────────────────────────────────────────────────────────

export async function crearEnvioEnCola(input: {
  formId: string;
  asunto: string;
  cuerpo: string;
  titulo: string;
  academicYear: string;
  replyTo: string | null;
  soloPendientes: boolean;
  createdByEmail: string | null;
  destinatarios: DestinatarioCorreo[];
}): Promise<string> {
  const [envio] = await db
    .insert(evalEnvios)
    .values({
      formId: input.formId,
      estado: 'enviando',
      asunto: input.asunto,
      cuerpo: input.cuerpo,
      titulo: input.titulo,
      academicYear: input.academicYear,
      replyTo: input.replyTo,
      previstos: input.destinatarios.length,
      soloPendientes: input.soloPendientes,
      createdByEmail: input.createdByEmail,
      ultimaActividadAt: new Date(),
    })
    .returning({ id: evalEnvios.id });
  try {
    for (let i = 0; i < input.destinatarios.length; i += 200) {
      await db.insert(evalEnvioDestinos).values(
        input.destinatarios.slice(i, i + 200).map((d) => ({
          envioId: envio.id,
          email: d.email,
          nombre: d.nombre,
          curso: d.curso ?? null,
          enlace: d.enlace,
          tokenInvitacion: d.tokenInvitacion ?? null,
        })),
      );
    }
  } catch (e) {
    // Una cola a medias mandaría solo a una parte sin avisar: mejor no crear nada.
    await db.delete(evalEnvios).where(eq(evalEnvios.id, envio.id));
    throw e;
  }
  return envio.id;
}

// ─── Procesar la cola ────────────────────────────────────────────────────────

type Reclamado = {
  id: string;
  email: string;
  nombre: string;
  curso: string | null;
  enlace: string;
  token_invitacion: string | null;
};

async function reclamar(envioId: string, n: number): Promise<Reclamado[]> {
  const r = await db.execute<Reclamado>(sql`
    UPDATE eval_envio_destinos SET estado = 'haciendo', claimed_at = now()
    WHERE id IN (
      SELECT id FROM eval_envio_destinos
      WHERE envio_id = ${envioId} AND estado = 'pendiente'
      ORDER BY id LIMIT ${n} FOR UPDATE SKIP LOCKED
    )
    RETURNING id, email, nombre, curso, enlace, token_invitacion
  `);
  return r.rows;
}

interface Resultado {
  id: string;
  token: string | null;
  error: string | null;
}

async function enviarTanda(
  lote: Reclamado[],
  envio: { asunto: string; cuerpo: string; titulo: string | null; academicYear: string | null; replyTo: string | null },
): Promise<Resultado[]> {
  const resultados: Resultado[] = [];
  let siguiente = 0;
  async function trabajador(): Promise<void> {
    while (siguiente < lote.length) {
      const d = lote[siguiente++];
      try {
        const item: BlastItem = {
          email: d.email,
          vars: varsDeDestinatario({
            nombre: d.nombre,
            curso: d.curso,
            titulo: envio.titulo ?? '',
            enlace: d.enlace,
            academicYear: envio.academicYear ?? '',
          }),
          cta: { url: d.enlace, label: CTA_LABEL },
        };
        await enviar(
          'evaluaciones',
          armarMensaje(item, envio.asunto, envio.cuerpo, { perfil: 'evaluaciones', replyTo: envio.replyTo ?? undefined }),
        );
        resultados.push({ id: d.id, token: d.token_invitacion, error: null });
      } catch (e) {
        resultados.push({ id: d.id, token: d.token_invitacion, error: mensajeDe(e).slice(0, 300) });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrencia(), lote.length) }, trabajador));
  return resultados;
}

/** Apunta lo que ha pasado en la tanda: de golpe, para que el progreso del panel sea real. */
async function anotarTanda(envioId: string, resultados: Resultado[]): Promise<void> {
  const bien = resultados.filter((r) => !r.error);
  const mal = resultados.filter((r) => r.error);
  const tareas: Promise<unknown>[] = [];
  if (bien.length) {
    tareas.push(
      db
        .update(evalEnvioDestinos)
        .set({ estado: 'enviado', claimedAt: null })
        .where(inArray(evalEnvioDestinos.id, bien.map((r) => r.id))),
      marcarInvitacionesEnviadas(bien.map((r) => r.token).filter((t): t is string => !!t)),
    );
  }
  for (const r of mal) {
    tareas.push(
      db
        .update(evalEnvioDestinos)
        .set({ estado: 'error', error: r.error, claimedAt: null })
        .where(eq(evalEnvioDestinos.id, r.id)),
    );
  }
  await Promise.all(tareas);
  await db
    .update(evalEnvios)
    .set({
      total: sql`${evalEnvios.total} + ${bien.length}`,
      errores: sql`${evalEnvios.errores} + ${mal.length}`,
      ultimaActividadAt: new Date(),
      ...(mal.length ? { aviso: `${mal.length} correo(s) fallaron en la última tanda: ${mal[0].error!.slice(0, 160)}` } : {}),
    })
    .where(eq(evalEnvios.id, envioId));
}

/** Deja la cola sin nada que lleve un magic link, salvo los que fallaron (se pueden reintentar). */
async function limpiarCola(envioId: string): Promise<void> {
  await db
    .delete(evalEnvioDestinos)
    .where(and(eq(evalEnvioDestinos.envioId, envioId), inArray(evalEnvioDestinos.estado, ['pendiente', 'enviado', 'cancelado'])));
}

/**
 * Un pase: manda correos hasta `limiteMs` y devuelve si la cola está acabada. Idempotente y
 * seguro con pases simultáneos.
 */
export async function procesarEnvio(envioId: string, limiteMs = LIMITE_PASE_MS): Promise<{ terminada: boolean }> {
  const inicio = Date.now();
  const [envio] = await db.select().from(evalEnvios).where(eq(evalEnvios.id, envioId)).limit(1);
  if (!envio || envio.estado !== 'enviando' || !envio.cuerpo) return { terminada: true };

  await db
    .update(evalEnvioDestinos)
    .set({ estado: 'pendiente', claimedAt: null })
    .where(
      and(
        eq(evalEnvioDestinos.envioId, envioId),
        eq(evalEnvioDestinos.estado, 'haciendo'),
        lt(evalEnvioDestinos.claimedAt, new Date(Date.now() - RECLAMO_CADUCA_MS)),
      ),
    );

  const tanda = concurrencia() * 3;
  const sigueEnMarcha = async () => {
    const [actual] = await db.select({ estado: evalEnvios.estado }).from(evalEnvios).where(eq(evalEnvios.id, envioId)).limit(1);
    return actual?.estado === 'enviando';
  };
  while (Date.now() - inicio < limiteMs) {
    // Si alguien lo ha parado desde el panel, se corta entre tanda y tanda.
    if (!(await sigueEnMarcha())) break;
    const lote = await reclamar(envioId, tanda);
    if (lote.length === 0) break;
    await anotarTanda(envioId, await enviarTanda(lote, { ...envio, cuerpo: envio.cuerpo }));
  }

  if (!(await sigueEnMarcha())) {
    await limpiarCola(envioId);
    return { terminada: true };
  }
  const [cola] = await db
    .select({
      pendientes: sql<number>`count(*) filter (where ${evalEnvioDestinos.estado} = 'pendiente')::int`,
      haciendo: sql<number>`count(*) filter (where ${evalEnvioDestinos.estado} = 'haciendo')::int`,
    })
    .from(evalEnvioDestinos)
    .where(eq(evalEnvioDestinos.envioId, envioId));
  if (cola.pendientes > 0) return { terminada: false };
  // Lo que queda «haciendo» es de otro pase que sigue vivo (o muerto: el rescate lo recoge).
  if (cola.haciendo > 0) return { terminada: true };

  await db
    .update(evalEnvios)
    .set({ estado: 'enviado', terminadoAt: new Date(), ultimaActividadAt: new Date() })
    .where(and(eq(evalEnvios.id, envioId), eq(evalEnvios.estado, 'enviando')));
  await limpiarCola(envioId);
  return { terminada: true };
}

// ─── Arrancar, seguir, reintentar, parar ─────────────────────────────────────

async function anotarAviso(envioId: string, aviso: string): Promise<void> {
  await db.update(evalEnvios).set({ aviso }).where(eq(evalEnvios.id, envioId)).catch(() => {});
}

/**
 * Pide otra invocación del worker para seguir con la cola (una función de Vercel no puede
 * alargarse sola). El worker contesta al momento —trabaja en su propio `after()`—, así que
 * aquí no se espera a que acabe. Si el aviso no entra, se apunta en el envío y el panel
 * ofrece «Seguir ahora»; el cron diario es la última red.
 */
async function pedirOtraVuelta(envioId: string): Promise<void> {
  const url = `${appBaseUrl()}/api/evaluaciones/worker?envio=${encodeURIComponent(envioId)}`;
  const secreto = process.env.CRON_SECRET;
  try {
    const respuesta = await fetch(url, {
      method: 'POST',
      headers: secreto ? { authorization: `Bearer ${secreto}` } : undefined,
      cache: 'no-store',
    });
    if (!respuesta.ok) {
      await anotarAviso(envioId, `Queda cola y el aviso al servidor no entró (HTTP ${respuesta.status}). Pulsa «Seguir ahora».`);
    }
  } catch (e) {
    await anotarAviso(envioId, `Queda cola y no se pudo avisar al servidor (${mensajeDe(e)}). Pulsa «Seguir ahora».`);
  }
}

async function ejecutarPase(envioId: string): Promise<void> {
  try {
    const { terminada } = await procesarEnvio(envioId);
    if (!terminada) await pedirOtraVuelta(envioId);
  } catch (e) {
    await anotarAviso(envioId, `El envío se cortó: ${mensajeDe(e)}. Pulsa «Seguir ahora».`);
  }
}

/** Pone el envío a trabajar tras responder (también vale para «Seguir ahora»). Solo desde un route handler. */
export function arrancarEnvio(envioId: string): void {
  after(() => ejecutarPase(envioId));
}

/** Los envíos que dicen estar en marcha pero llevan rato sin dar señales (para el cron). */
export async function enviosParados(minutos = 3): Promise<string[]> {
  const filas = await db
    .select({ id: evalEnvios.id })
    .from(evalEnvios)
    .where(and(eq(evalEnvios.estado, 'enviando'), lt(evalEnvios.ultimaActividadAt, new Date(Date.now() - minutos * 60_000))));
  return filas.map((f) => f.id);
}

/** Vuelve a poner en cola los correos que fallaron de un envío ya acabado. */
export async function reintentarFallidos(envioId: string): Promise<{ ok: boolean; motivo?: string; reintentados?: number }> {
  const [envio] = await db.select().from(evalEnvios).where(eq(evalEnvios.id, envioId)).limit(1);
  if (!envio) return { ok: false, motivo: 'Envío no encontrado' };
  if (envio.estado === 'enviando') return { ok: false, motivo: 'Ese envío sigue en marcha' };
  if (envio.estado !== 'enviado') return { ok: false, motivo: 'Ese envío no se puede reintentar' };
  const vueltos = await db
    .update(evalEnvioDestinos)
    .set({ estado: 'pendiente', error: null, claimedAt: null })
    .where(and(eq(evalEnvioDestinos.envioId, envioId), eq(evalEnvioDestinos.estado, 'error')))
    .returning({ id: evalEnvioDestinos.id });
  if (vueltos.length === 0) {
    return { ok: false, motivo: 'No queda ningún correo fallido que reintentar (los envíos antiguos no guardan la lista)' };
  }
  await db
    .update(evalEnvios)
    .set({
      estado: 'enviando',
      errores: sql`greatest(${evalEnvios.errores} - ${vueltos.length}, 0)`,
      aviso: null,
      terminadoAt: null,
      ultimaActividadAt: new Date(),
    })
    .where(eq(evalEnvios.id, envioId));
  return { ok: true, reintentados: vueltos.length };
}

/** Para un envío en marcha: lo que no ha salido se queda sin enviar. */
export async function pararEnvio(envioId: string): Promise<{ ok: boolean; motivo?: string }> {
  const parado = await db
    .update(evalEnvios)
    .set({ estado: 'cancelado', canceladoAt: new Date(), aviso: null })
    .where(and(eq(evalEnvios.id, envioId), eq(evalEnvios.estado, 'enviando')))
    .returning({ id: evalEnvios.id });
  if (parado.length === 0) return { ok: false, motivo: 'Ese envío ya no está en marcha' };
  await limpiarCola(envioId);
  return { ok: true };
}
