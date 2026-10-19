import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser, hasModule } from '@/lib/auth-guards';
import { getCurrentCampaign } from '@/lib/licencias-server';
import {
  borrarLicenciasProfes,
  editarLicenciaProfe,
  enviarLicenciaProfe,
  guardarLicenciasProfes,
  listarLicenciasProfes,
  profesParaLicencias,
} from '@/lib/licencias-profes-server';

export const dynamic = 'force-dynamic';

// Licencias del profesorado (Fase 5b de docs/11-licencias-v2.md): pegar, poner profe, mandar.
const libro = z.string().trim().max(120).nullable().optional();
const schema = z.discriminatedUnion('accion', [
  z.object({
    accion: z.literal('guardar'),
    items: z
      .array(z.object({ codigo: z.string().trim().min(3).max(80), eduTeacherId: z.string().uuid().nullable() }))
      .min(1)
      .max(200),
    libro,
    nota: z.string().trim().max(200).nullable().optional(),
  }),
  z.object({ accion: z.literal('editar'), id: z.string().uuid(), eduTeacherId: z.string().uuid().nullable().optional(), libro }),
  z.object({ accion: z.literal('enviar'), id: z.string().uuid() }),
  z.object({ accion: z.literal('borrar'), ids: z.array(z.string().uuid()).min(1).max(200) }),
]);

export async function GET() {
  if (!(await hasModule('licencias'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const campaign = await getCurrentCampaign();
  if (!campaign) return NextResponse.json({ error: 'Sin campaña activa' }, { status: 404 });
  const [filas, profes] = await Promise.all([listarLicenciasProfes(campaign.id), profesParaLicencias()]);
  return NextResponse.json({ filas, profes });
}

export async function POST(request: Request) {
  if (!(await hasModule('licencias'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const campaign = await getCurrentCampaign();
  if (!campaign) return NextResponse.json({ error: 'Sin campaña activa' }, { status: 404 });

  const leido = schema.safeParse(await request.json().catch(() => null));
  if (!leido.success) {
    return NextResponse.json({ error: leido.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 });
  }
  const datos = leido.data;
  try {
    if (datos.accion === 'guardar') {
      const user = await getSessionUser();
      const r = await guardarLicenciasProfes({
        campaignId: campaign.id,
        items: datos.items,
        libro: datos.libro || null,
        nota: datos.nota || null,
        porEmail: user?.email ?? null,
      });
      return NextResponse.json({ ok: true, ...r });
    }
    if (datos.accion === 'editar') {
      const cambios: { eduTeacherId?: string | null; libro?: string | null } = {};
      if (datos.eduTeacherId !== undefined) cambios.eduTeacherId = datos.eduTeacherId;
      if (datos.libro !== undefined) cambios.libro = datos.libro || null;
      if (Object.keys(cambios).length === 0) return NextResponse.json({ error: 'Nada que cambiar' }, { status: 400 });
      return (await editarLicenciaProfe(campaign.id, datos.id, cambios))
        ? NextResponse.json({ ok: true })
        : NextResponse.json({ error: 'Esa licencia ya no está anotada' }, { status: 404 });
    }
    if (datos.accion === 'enviar') {
      const r = await enviarLicenciaProfe(campaign.id, datos.id);
      return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.motivo }, { status: 409 });
    }
    const count = await borrarLicenciasProfes(campaign.id, datos.ids);
    return count
      ? NextResponse.json({ ok: true, count })
      : NextResponse.json({ error: 'No se ha borrado nada: ¿ya no estaba?' }, { status: 404 });
  } catch (error) {
    // Solo el mensaje: nada de la fila entera (datos personales).
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
