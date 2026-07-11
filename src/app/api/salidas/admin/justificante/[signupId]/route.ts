import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { salSignups } from '@/db/schema';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { leerPrivado } from '@/lib/blob';

// Sirve el archivo del justificante (Blob privado) tras comprobar el módulo.
export async function GET(_req: Request, { params }: { params: Promise<{ signupId: string }> }) {
  const guard = await requireModule('salidas');
  if (isGuardResponse(guard)) return guard;
  try {
    const { signupId } = await params;
    const [signup] = await db.select().from(salSignups).where(eq(salSignups.id, signupId)).limit(1);
    if (!signup?.justificanteUrl) return NextResponse.json({ error: 'Sin justificante' }, { status: 404 });
    const res = await leerPrivado(signup.justificanteUrl);
    const headers = new Headers();
    res.headers.forEach((v, k) => headers.set(k, v));
    return new Response(res.stream as unknown as ReadableStream, { headers });
  } catch (error) {
    console.error('Error sirviendo justificante:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
