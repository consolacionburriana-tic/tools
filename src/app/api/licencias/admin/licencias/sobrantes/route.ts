import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser, hasModule } from '@/lib/auth-guards';
import { getCurrentCampaign } from '@/lib/licencias-server';
import { borrarSobrantes, colocarSobrante, guardarSobrantes } from '@/lib/licencias-envios-server';

// El almacén de licencias que sobran: «se equivocan los comerciales y mandan 10 de más, y yo
// las guardo porque a lo mejor las puedo asignar a alguien en otro momento».
const schema = z.discriminatedUnion('accion', [
  z.object({
    accion: z.literal('guardar'),
    tipo: z.enum(['pago', 'banco']),
    curso: z.string().min(1),
    cod: z.string().min(1),
    codigos: z.array(z.string().min(3)).min(1).max(2000),
    nota: z.string().max(200).optional(),
  }),
  z.object({ accion: z.literal('colocar'), sobranteId: z.string().uuid(), licenciaId: z.string().uuid() }),
  z.object({ accion: z.literal('borrar'), ids: z.array(z.string().uuid()).min(1).max(2000) }),
]);

export async function POST(request: Request) {
  if (!(await hasModule('licencias'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const campaign = await getCurrentCampaign();
  if (!campaign) return NextResponse.json({ error: 'Sin campaña activa' }, { status: 404 });
  try {
    const datos = schema.parse(await request.json());
    const user = await getSessionUser();
    if (datos.accion === 'guardar') {
      const count = await guardarSobrantes(
        campaign.id,
        datos.tipo,
        datos.curso,
        datos.cod,
        datos.codigos,
        user?.email ?? null,
        datos.nota,
      );
      return NextResponse.json({ ok: true, count });
    }
    if (datos.accion === 'colocar') {
      const r = await colocarSobrante(campaign.id, datos.sobranteId, datos.licenciaId);
      return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.motivo }, { status: 409 });
    }
    const count = await borrarSobrantes(campaign.id, datos.ids);
    return count
      ? NextResponse.json({ ok: true, count })
      : NextResponse.json({ error: 'No se ha borrado nada: ¿ya no estaban en el almacén?' }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
