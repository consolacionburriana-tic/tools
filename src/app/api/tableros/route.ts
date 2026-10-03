import { after, NextResponse } from 'next/server';
import { crearEquipoSchema } from '@/lib/tableros';
import { avisarEquipo, crearEquipo, datosInicio } from '@/lib/tableros-server';
import { fallo, guardTableros, isGuardResponse, leer } from './respuesta';

// Mis equipos con sus tableros, y lo que tengo asignado.
export async function GET() {
  const user = await guardTableros();
  if (isGuardResponse(user)) return user;
  try {
    return NextResponse.json(await datosInicio(user.email));
  } catch (error) {
    return fallo(error, 'inicio');
  }
}

// Crear un equipo (quien lo crea queda de admin).
export async function POST(request: Request) {
  const user = await guardTableros();
  if (isGuardResponse(user)) return user;
  const datos = await leer(request, crearEquipoSchema);
  if (datos instanceof NextResponse) return datos;
  try {
    const { id, nuevos } = await crearEquipo(datos, user);
    if (nuevos.length) after(() => avisarEquipo(id, nuevos, user));
    return NextResponse.json({ id });
  } catch (error) {
    return fallo(error, 'crear equipo');
  }
}
