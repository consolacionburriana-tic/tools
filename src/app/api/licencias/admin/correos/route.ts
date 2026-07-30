import { NextResponse } from 'next/server';
import { hasModule } from '@/lib/auth-guards';

const isAdmin = () => hasModule('licencias');
import { appBaseUrl } from '@/lib/constants';
import { urlAccesoFamilia } from '@/lib/familias';
import { ensureTokens, marcarTokensEnviados } from '@/lib/fam-tokens-server';
import { getCurrentCampaign, getFamiliaRecipients, getRecipients, type ClaseLic } from '@/lib/licencias-server';
import { varsDeFamilia } from '@/lib/licencias';
import {
  sendBlast,
  sendBlastTest,
  sendFamilyBlast,
  sendFamilyBlastTest,
  type FamilyBlastItem,
} from '@/lib/licencias-email';

interface Payload {
  accion: 'count' | 'test' | 'send';
  /** 'alumnos' = envío clásico al correo del alumno · 'familias' = al tutor, con magic link */
  modo?: 'alumnos' | 'familias';
  grupo?: 'faltan' | 'tienen';
  clases?: ClaseLic[];
  soloFaltan?: boolean;
  subject?: string;
  body?: string;
  testEmail?: string;
  /** Enviar de verdad, pero solo a este correo de la lista (prueba con una familia real). */
  soloEmail?: string;
  /** Días de validez de los enlaces nuevos (por defecto 120). */
  diasValidez?: number;
}

const DIAS_VALIDEZ_DEFECTO = 120;

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const p = (await request.json()) as Payload;
  const campaign = await getCurrentCampaign();
  if (!campaign) return NextResponse.json({ error: 'Sin campaña' }, { status: 404 });

  const faltaTexto = () => !p.subject?.trim() || !p.body?.trim();

  // ── Modo familias: un correo por familia con su enlace de acceso ─────────────
  if (p.modo === 'familias') {
    const resumen = await getFamiliaRecipients(campaign.id, {
      clases: p.clases ?? [],
      soloFaltan: !!p.soloFaltan,
    });

    if (p.accion === 'count') {
      return NextResponse.json({
        count: resumen.familias.length,
        alumnos: resumen.alumnosObjetivo,
        hijosAlcanzados: resumen.familias.reduce((n, f) => n + f.hijos.length, 0),
        sinCorreo: resumen.alumnosSinCorreo,
        sinEnlaceCentral: resumen.alumnosSinEnlaceCentral,
      });
    }
    if (faltaTexto()) return NextResponse.json({ error: 'Asunto y mensaje obligatorios' }, { status: 400 });

    const destinatarias =
      p.accion === 'send' && p.soloEmail?.trim()
        ? resumen.familias.filter((f) => f.email === p.soloEmail!.trim().toLowerCase())
        : p.accion === 'test'
          ? resumen.familias.slice(0, 1)
          : resumen.familias;
    if (destinatarias.length === 0) {
      return NextResponse.json({ error: 'No hay familias con correo en esa selección' }, { status: 400 });
    }

    // Los tokens se generan aquí mismo si no existen: el gestor no tiene que acordarse de
    // nada. Es idempotente — reutiliza los enlaces ya enviados (ver fam-tokens-server.ts).
    const dias = p.diasValidez && p.diasValidez > 0 ? p.diasValidez : DIAS_VALIDEZ_DEFECTO;
    const expiresAt = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
    const tokens = await ensureTokens(destinatarias, { proposito: 'licencias', expiresAt });

    const base = appBaseUrl();
    const items: FamilyBlastItem[] = [];
    for (const f of destinatarias) {
      const asignado = tokens.get(f.email);
      if (!asignado) continue;
      const enlace = urlAccesoFamilia(base, 'licencias', asignado.token);
      items.push({
        email: f.email,
        enlace,
        vars: varsDeFamilia({
          tutorNombre: f.tutorNombre,
          hijos: f.hijos,
          enlace,
          deadline: campaign.orderDeadline,
          academicYear: campaign.academicYear,
        }),
      });
    }

    if (p.accion === 'test') {
      if (!p.testEmail?.trim()) return NextResponse.json({ error: 'Falta el correo de prueba' }, { status: 400 });
      const status = await sendFamilyBlastTest(p.testEmail.trim(), p.subject!, p.body!, items[0]);
      return NextResponse.json({ ok: status === 'sent', status, enlace: items[0].enlace });
    }

    const res = await sendFamilyBlast(items, p.subject!, p.body!);
    if (res.sent > 0) await marcarTokensEnviados(items.map((i) => tokens.get(i.email)!.token));
    const nuevos = [...tokens.values()].filter((t) => t.nuevo).length;
    return NextResponse.json({ ok: true, ...res, tokensNuevos: nuevos, familias: items.length });
  }

  // ── Modo clásico: un correo por alumno, al correo del alumno ─────────────────
  const recipients = await getRecipients(campaign.id, p.grupo === 'tienen' ? 'tienen' : 'faltan');
  const sample = recipients[0] ?? { email: '', nombre: 'Alumno', apellidos: 'Ejemplo', curso: '1ESO' };

  if (p.accion === 'count') return NextResponse.json({ count: recipients.length });
  if (faltaTexto()) return NextResponse.json({ error: 'Asunto y mensaje obligatorios' }, { status: 400 });
  if (p.accion === 'test') {
    if (!p.testEmail?.trim()) return NextResponse.json({ error: 'Falta el correo de prueba' }, { status: 400 });
    const status = await sendBlastTest(p.testEmail.trim(), p.subject!, p.body!, sample);
    return NextResponse.json({ ok: status === 'sent', status });
  }
  if (p.accion === 'send') {
    const res = await sendBlast(recipients, p.subject!, p.body!);
    return NextResponse.json({ ok: true, ...res });
  }
  return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
}
