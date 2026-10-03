import { NextResponse } from 'next/server';
import { hoyISO } from '@/lib/tableros';
import { misTarjetas } from '@/lib/tableros-server';
import { fallo, guardTableros, isGuardResponse } from '../respuesta';

// Lo que tengo asignado y sin terminar: lo pide el aviso general de /gestion.
export async function GET() {
  const user = await guardTableros();
  if (isGuardResponse(user)) return user;
  try {
    return NextResponse.json({ mias: await misTarjetas(user.email), hoy: hoyISO() });
  } catch (error) {
    return fallo(error, 'lo mío');
  }
}
