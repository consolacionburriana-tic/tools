// Cuando un sustituto confirma (docs/32, decisión 26, 23-nov-2026): quien lo quiera de Jefatura
// recibe un correo como RESPUESTA al aviso que salió (mismo hilo: `In-Reply-To` al Message-ID del
// envío) y con todo en el asunto, para enterarse sin abrirlo. Cada uno se lo activa o no en
// Sustituciones › Ajustes; se guarda en `cfg_ajustes` (clave `sustituciones.avisoConfirmacion`,
// una lista de correos). También: confirmar desde «Mis sustituciones», sin pasar por el correo.
import { and, arrayOverlaps, desc, eq, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { cfgAjustes, eduTeachers, sustAusencias, sustEnvios, sustSesiones } from '@/db/schema';
import { appBaseUrl } from '@/lib/constants';
import { enviar } from '@/lib/email';
import { getJefaturas, jefaturasDe } from '@/lib/jefaturas-server';
import { escaparHtml, etapasDeGrupo, fechaLarga, hora, lugarDe, mayuscula } from '@/lib/sustituciones';
import { buzonDeEtapa, confirmarPorEnlace, messageIdDeEnvio } from '@/lib/sustituciones-server';

const CLAVE = 'sustituciones.avisoConfirmacion';

async function listaAvisados(): Promise<string[]> {
  const [fila] = await db.select({ valor: cfgAjustes.valor }).from(cfgAjustes).where(eq(cfgAjustes.clave, CLAVE));
  return Array.isArray(fila?.valor) ? (fila.valor as unknown[]).filter((x): x is string => typeof x === 'string').map((x) => x.toLowerCase()) : [];
}

export async function quiereAvisoConfirmacion(email: string): Promise<boolean> {
  return (await listaAvisados()).includes(email.toLowerCase());
}

export async function guardarAvisoConfirmacion(email: string, activo: boolean): Promise<void> {
  const e = email.toLowerCase();
  const lista = new Set(await listaAvisados());
  if (activo) lista.add(e);
  else lista.delete(e);
  const valor = [...lista].sort();
  await db
    .insert(cfgAjustes)
    .values({ clave: CLAVE, valor, updatedByEmail: e, updatedAt: new Date() })
    .onConflictDoUpdate({ target: cfgAjustes.clave, set: { valor, updatedByEmail: e, updatedAt: new Date() } });
}

/** El correo de quien creó la ausencia (sin la nota de emulación de `autorDe`). */
const correoDe = (firma: string) => firma.replace(/\s*\(emulando a .*\)$/, '').toLowerCase();

/**
 * Avisa a Jefatura de que un sustituto ha confirmado. Va a quien lo tiene activado y además es la
 * jefatura de la etapa de la ausencia o quien la apuntó. Nunca rompe la confirmación: si falla, al log.
 */
export async function avisarConfirmacion(token: string): Promise<void> {
  try {
    const horas = await db
      .select({
        id: sustSesiones.id,
        fecha: sustSesiones.fecha,
        horaInicio: sustSesiones.horaInicio,
        horaFin: sustSesiones.horaFin,
        grupos: sustSesiones.grupos,
        materia: sustSesiones.materia,
        aula: sustSesiones.aula,
        token2: sustSesiones.confirmacion2Token,
        sustituto: sustSesiones.sustitutoNombre,
        sustituto2: sustSesiones.sustituto2Nombre,
        ausente: sustAusencias.profeNombre,
        etapa: sustAusencias.etapa,
        creadaPor: sustAusencias.creadaPorEmail,
        ausenciaId: sustAusencias.id,
      })
      .from(sustSesiones)
      .innerJoin(sustAusencias, eq(sustAusencias.id, sustSesiones.ausenciaId))
      .where(or(eq(sustSesiones.confirmacionToken, token), eq(sustSesiones.confirmacion2Token, token)))
      .orderBy(sustSesiones.fecha, sustSesiones.horaInicio);
    if (horas.length === 0) return;
    const h0 = horas[0];
    const quien = (h0.token2 === token ? h0.sustituto2 : h0.sustituto) ?? 'El sustituto';

    const [avisados, jefaturas] = await Promise.all([listaAvisados(), getJefaturas()]);
    if (avisados.length === 0) return;
    const responsables = new Set([correoDe(h0.creadaPor)]);
    for (const email of avisados) for (const j of jefaturasDe(jefaturas, email)) if (etapasDeGrupo(j).includes(h0.etapa as never)) responsables.add(email);
    const para = avisados.filter((e) => responsables.has(e));
    if (para.length === 0) return;

    // El aviso que se le mandó (para contestar en su hilo).
    const ids = horas.map((h) => h.id);
    const [envio] = await db
      .select({ id: sustEnvios.id, asunto: sustEnvios.asunto })
      .from(sustEnvios)
      .where(and(eq(sustEnvios.ausenciaId, h0.ausenciaId), eq(sustEnvios.tipo, 'sustituto'), arrayOverlaps(sustEnvios.sesionesIds, ids)))
      .orderBy(desc(sustEnvios.createdAt))
      .limit(1);

    const cuando = horas.map((h) => `${mayuscula(fechaLarga(h.fecha))} · ${hora(h.horaInicio)}-${hora(h.horaFin)} · ${lugarDe(h) || '—'}`);
    const base = envio?.asunto ?? `Sustitución · ${fechaLarga(h0.fecha)}`;
    const subject = `Re: ${base} · Confirmada: ${quien} cubre a ${h0.ausente}`;
    const enlace = `${appBaseUrl()}/gestion/sustituciones?semana=${h0.fecha}`;
    const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#18181b">
<p style="margin:0 0 12px"><strong>${escaparHtml(quien)}</strong> ha confirmado que cubre a <strong>${escaparHtml(h0.ausente)}</strong>:</p>
<ul style="margin:0 0 12px;padding-left:20px">${cuando.map((c) => `<li>${escaparHtml(c)}</li>`).join('')}</ul>
<p style="margin:0"><a href="${escaparHtml(enlace)}" style="color:#1d4ed8">Ver la semana en Sustituciones</a></p>
<p style="margin:16px 0 0;font-size:12px;color:#71717a">Te llega porque tienes activado «Avisarme cuando un sustituto confirme» en Sustituciones › Ajustes.</p>
</div>`;
    const cabeceras = envio ? { 'In-Reply-To': messageIdDeEnvio(envio.id), References: messageIdDeEnvio(envio.id) } : undefined;
    await enviar('sustituciones', { to: para, subject, html, cabeceras, desde: buzonDeEtapa(h0.etapa) });
  } catch (e) {
    console.error('Sustituciones · aviso de confirmación:', e instanceof Error ? e.message : 'error');
  }
}

/**
 * «Confirmar» desde «Mis sustituciones»: la hora tiene que ser SUYA (por su correo) y el aviso tiene
 * que haber salido. Es lo mismo que pulsar el enlace del correo.
 */
export async function confirmarMia(sesionId: string, email: string): Promise<'confirmada' | 'ya_confirmada' | 'no_encontrada'> {
  const [fila] = await db
    .select({ token: sustSesiones.confirmacionToken, token2: sustSesiones.confirmacion2Token, s1: sustSesiones.sustitutoId, s2: sustSesiones.sustituto2Id, yo: eduTeachers.id })
    .from(sustSesiones)
    .innerJoin(eduTeachers, sql`lower(${eduTeachers.email}) = ${email.toLowerCase()}`)
    .where(eq(sustSesiones.id, sesionId))
    .limit(1);
  if (!fila) return 'no_encontrada';
  const token = fila.s1 === fila.yo ? fila.token : fila.s2 === fila.yo ? fila.token2 : null;
  if (!token) return 'no_encontrada';
  const r = await confirmarPorEnlace(token);
  if (r === 'confirmada') await avisarConfirmacion(token);
  return r;
}
