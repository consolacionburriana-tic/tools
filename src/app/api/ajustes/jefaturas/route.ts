// Quién lleva cada Jefatura de estudios (Ajustes del colegio).
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { autorDe, isGuardResponse, requireModule } from '@/lib/auth-guards';
import { guardarJefaturas } from '@/lib/jefaturas-server';

const Peticion = z.record(z.string(), z.string().email().nullable());

export async function PUT(request: Request) {
  const guard = await requireModule('ajustes');
  if (isGuardResponse(guard)) return guard;
  const parsed = Peticion.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 });
  await guardarJefaturas(parsed.data, autorDe(guard));
  return NextResponse.json({ ok: true });
}
