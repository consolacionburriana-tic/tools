import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { guardarAjustes } from '@/lib/cuentas-server';

export const dynamic = 'force-dynamic';

// El mapa de unidades (clase → unidad), las raíces, el archivo y los meses de espera.
export async function PUT(request: Request) {
  const user = await requireModule('cuentas');
  if (isGuardResponse(user)) return user;
  try {
    return NextResponse.json({ ajustes: await guardarAjustes(await request.json(), user.email) });
  } catch {
    return NextResponse.json({ error: 'Ajustes incorrectos' }, { status: 400 });
  }
}
