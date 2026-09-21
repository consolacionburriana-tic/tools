import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser, hasModule } from '@/lib/auth-guards';
import { getCurrentCampaign } from '@/lib/licencias-server';
import { asignarCodigos } from '@/lib/licencias-envios-server';

export const maxDuration = 60;

const schema = z.object({
  tipo: z.enum(['pago', 'banco']),
  // El ORDEN lo manda el cliente: es el mismo que David ve en la tabla al aprobar la vista
  // previa. Si el servidor reordenara por su cuenta, lo aprobado y lo guardado podrían no
  // coincidir, y eso es mandarle a un alumno el código de otro.
  parejas: z.array(z.object({ licenciaId: z.string().uuid(), codigo: z.string().min(3) })).max(2000),
  sobrantes: z
    .array(z.object({ curso: z.string().min(1), cod: z.string().min(1), codigo: z.string().min(3) }))
    .max(2000),
});

export async function POST(request: Request) {
  if (!(await hasModule('licencias'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const campaign = await getCurrentCampaign();
  if (!campaign) return NextResponse.json({ error: 'Sin campaña activa' }, { status: 404 });
  try {
    const datos = schema.parse(await request.json());
    const user = await getSessionUser();
    const resultado = await asignarCodigos({
      campaignId: campaign.id,
      tipo: datos.tipo,
      parejas: datos.parejas,
      sobrantes: datos.sobrantes,
      porEmail: user?.email ?? null,
    });
    return NextResponse.json({ ok: true, ...resultado });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
