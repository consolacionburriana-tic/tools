import { NextResponse } from 'next/server';
import { cursoBase } from '@/lib/licencias';
import { getCurrentCampaign, identifyStudents } from '@/lib/licencias-server';

export async function POST(request: Request) {
  try {
    const { curso, birthYear, apellidos } = (await request.json()) as {
      curso: string;
      birthYear: number;
      apellidos: string;
    };
    if (!curso || !birthYear || !apellidos?.trim()) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    }
    const campaign = await getCurrentCampaign();
    if (!campaign) return NextResponse.json({ error: 'No hay campaña' }, { status: 404 });

    const candidates = await identifyStudents(campaign.id, cursoBase(curso), Number(birthYear), apellidos);
    return NextResponse.json({ candidates });
  } catch (error) {
    console.error('Error en identify:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
