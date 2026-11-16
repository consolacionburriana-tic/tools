import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { cargarInventario } from '@/lib/inventario-server';
import { libroInventario } from '@/lib/inventario-exports';
import { escribirXlsx, MIME_XLSX } from '@/lib/xlsx-escribir';

export const dynamic = 'force-dynamic';

/** Todo el inventario en un Excel, una pestaña por sección. Un GET para descargar con un enlace. */
export async function GET() {
  const g = await requireModule('inventario');
  if (isGuardResponse(g)) return g;
  try {
    const inv = await cargarInventario();
    const xlsx = await escribirXlsx(libroInventario(inv));
    const nombre = `inventario-aulas-${new Date().toISOString().slice(0, 10)}`;
    return new NextResponse(new Uint8Array(xlsx), {
      headers: { 'Content-Type': MIME_XLSX, 'Content-Disposition': `attachment; filename="${nombre}.xlsx"`, 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Inventario · Excel:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'No se ha podido generar el Excel' }, { status: 500 });
  }
}
