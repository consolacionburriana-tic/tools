import { NextResponse } from 'next/server';
import { requireModule, isGuardResponse } from '@/lib/auth-guards';
import { confirmar } from '@/lib/sustituciones-guardias-server';
import { puedeGestionarSustituciones } from '@/lib/sustituciones-diarias';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  const user = await requireModule('sustituciones'); if (isGuardResponse(user)) return user; if(!puedeGestionarSustituciones(user.role)) return NextResponse.json({error:'Sin permiso para este módulo.'},{status:403});
  try { const body=await req.json(); if (!Array.isArray(body.sesiones) || typeof body.fecha!=='string' || typeof body.motivo!=='string' || typeof body.ausenteId!=='string') return NextResponse.json({error:'Datos incompletos.'},{status:400}); return NextResponse.json(await confirmar({...body, autor:user.email})); }
  catch(e) { return NextResponse.json({error:e instanceof Error?e.message:'No se pudo guardar la sustitución.'},{status:400}); }
}
