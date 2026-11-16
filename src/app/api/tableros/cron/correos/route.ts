import { NextResponse } from 'next/server';
import { procesarCorreosDeTareas } from '@/lib/tareas-correo-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Tareas por correo (docs/34-paleta-y-tareas-por-correo.md): respaldo diario por si nadie ha
// abierto /gestion (que es lo que las lee al momento). Con `CRON_SECRET`; es idempotente: un correo
// hecho queda etiquetado y no se vuelve a leer.
export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get('authorization') !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await procesarCorreosDeTareas()) });
  } catch (error) {
    console.error('Tableros · correos:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
