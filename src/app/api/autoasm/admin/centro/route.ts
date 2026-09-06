import { NextResponse } from 'next/server';
import { hasModule } from '@/lib/auth-guards';
import { getSnapshotCentro } from '@/lib/autoasm-server';

export const dynamic = 'force-dynamic';

// Alumnado y profesorado activos de la BBDD central, con lo justo para montar los CSV.
// El estudio de AUTOASM vive en el navegador, así que este es su único origen de datos.
export async function GET() {
  if (!(await hasModule('autoasm'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    return NextResponse.json(await getSnapshotCentro());
  } catch (error) {
    console.error('AUTOASM: error leyendo la BBDD central:', error);
    return NextResponse.json({ error: 'No se ha podido leer la BBDD central' }, { status: 500 });
  }
}
