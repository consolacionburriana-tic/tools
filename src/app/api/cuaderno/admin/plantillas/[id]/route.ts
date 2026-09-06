import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { REPETICIONES } from '@/lib/cuaderno/campos';
import { extraerIdDrive } from '@/lib/cuaderno/drive';
import { actualizarPlantilla, borrarPlantilla, historialDePlantilla } from '@/lib/cuaderno-server';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('cuaderno');
  if (isGuardResponse(guard)) return guard;
  try {
    const { id } = await params;
    const datos = z
      .object({
        nombre: z.string().trim().min(2).max(120).optional(),
        url: z.string().trim().max(500).optional(),
        repeticion: z.enum(REPETICIONES).optional(),
        etapa: z.enum(['EI', 'EP', 'ESO']).nullable().optional(),
        orden: z.number().int().min(1).max(99).optional(),
        generaPdf: z.boolean().optional(),
        saltoDePagina: z.boolean().optional(),
        activa: z.boolean().optional(),
      })
      .parse(await request.json());

    const { url, ...resto } = datos;
    const cambios: Parameters<typeof actualizarPlantilla>[1] = { ...resto };
    if (url) {
      const googleDocId = extraerIdDrive(url);
      if (!googleDocId) return NextResponse.json({ error: 'No reconozco ese enlace' }, { status: 400 });
      // Plantilla nueva = análisis viejo inservible: se invalida para que nadie genere con él.
      cambios.googleDocId = googleDocId;
      cambios.etiquetas = [];
      cambios.analizadaAt = undefined;
    }
    const plantilla = await actualizarPlantilla(id, cambios);
    if (!plantilla) return NextResponse.json({ error: 'No existe esa plantilla' }, { status: 404 });
    return NextResponse.json({ plantilla });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}

/** Cuánto historial se lleva por delante quitarla: se pregunta antes de confirmar. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('cuaderno');
  if (isGuardResponse(guard)) return guard;
  const { id } = await params;
  return NextResponse.json(await historialDePlantilla(id));
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('cuaderno');
  if (isGuardResponse(guard)) return guard;
  try {
    const { id } = await params;
    const historial = await historialDePlantilla(id);
    const borrada = await borrarPlantilla(id);
    if (!borrada) return NextResponse.json({ error: 'Esa plantilla ya no está' }, { status: 404 });
    return NextResponse.json({ ok: true, ...historial });
  } catch (error) {
    // Antes esto se perdía: el error salía por el 500 y el panel decía «quitada» igual.
    const mensaje = error instanceof Error ? error.message : 'Error';
    console.error('[cuaderno] no se pudo quitar la plantilla:', mensaje);
    return NextResponse.json({ error: `No se pudo quitar: ${mensaje}` }, { status: 500 });
  }
}
