import { NextResponse } from 'next/server';
import { enviarInformeMensual } from '@/lib/sustituciones-guardias-server';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const secret=process.env.CRON_SECRET; if(!secret || req.headers.get('authorization')!==`Bearer ${secret}`) return NextResponse.json({error:'No autorizado'},{status:401});
  try { return NextResponse.json({ok:true,...await enviarInformeMensual()}); } catch(e) { console.error('Sustituciones · informe mensual',e instanceof Error?e.message:e); return NextResponse.json({error:e instanceof Error?e.message:'Error interno'},{status:500}); }
}
