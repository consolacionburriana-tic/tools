import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { MARCAS_ALUMNADO, quienesSon, vistaNumeros } from '@/lib/numeros-server';
import { leerLista } from '@/lib/numeros';
import { db } from '@/db';
import { licCampaigns } from '@/db/schema';
import { desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// «Quiénes son»: los alumnos que hay detrás de un número de la tabla (docs/24-numeros.md).
// `?lista=a:chica&ambito=3ESO|B`. Fuera de lo que puede ver quien pregunta, 404 (no 403),
// como la ficha de Alumnado: quién está en cada lista tampoco es cosa de esta ruta.
export async function GET(request: Request) {
  const user = await requireModule('numeros');
  if (isGuardResponse(user)) return user;
  const url = new URL(request.url);
  const lista = leerLista(url.searchParams.get('lista'), MARCAS_ALUMNADO);
  const ambito = url.searchParams.get('ambito') ?? '';
  if (!lista || !ambito || ambito.length > 40) return NextResponse.json({ error: 'Petición no válida' }, { status: 400 });
  try {
    const [campana] = await db
      .select({ nombre: licCampaigns.name, estado: licCampaigns.status })
      .from(licCampaigns)
      .orderBy(desc(licCampaigns.createdAt))
      .limit(1);
    const vista = await vistaNumeros(user, campana ?? null);
    const alumnos = await quienesSon(lista, ambito, vista);
    if (alumnos === null) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ alumnos });
  } catch (error) {
    console.error('Números · error en quiénes son:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'No se pudo sacar la lista' }, { status: 500 });
  }
}
