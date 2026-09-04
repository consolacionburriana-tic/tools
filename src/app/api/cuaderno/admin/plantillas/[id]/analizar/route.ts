import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { analizarEtiqueta, avisosDePlantilla, type Repeticion } from '@/lib/cuaderno/campos';
import { exportarDocx, mensajeDeError } from '@/lib/cuaderno/drive';
import { leerEtiquetasDeDocx } from '@/lib/cuaderno/generar';
import { actualizarPlantilla, getMapeo, getPlantilla } from '@/lib/cuaderno-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Relee la plantilla de Google Docs y guarda las etiquetas que usa. Es el botón que hace
 * que cambiar una plantilla no sea un cambio de código: David la edita, le da a Analizar, y
 * el panel le pregunta solo por las etiquetas nuevas.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('cuaderno');
  if (isGuardResponse(guard)) return guard;
  const { id } = await params;
  const plantilla = await getPlantilla(id);
  if (!plantilla) return NextResponse.json({ error: 'No existe esa plantilla' }, { status: 404 });

  try {
    const docx = await exportarDocx(plantilla.googleDocId);
    const { etiquetas, tieneFilas } = await leerEtiquetasDeDocx(docx);
    const actualizada = await actualizarPlantilla(id, { etiquetas, tieneFilas, analizadaAt: new Date() });
    const mapeo = await getMapeo();
    const analizadas = etiquetas.map((e) => analizarEtiqueta(e, mapeo));
    return NextResponse.json({
      plantilla: actualizada,
      etiquetas: analizadas,
      avisos: avisosDePlantilla(analizadas, plantilla.repeticion as Repeticion, tieneFilas),
    });
  } catch (error) {
    return NextResponse.json(
      { error: `No pude leer la plantilla en Drive. ${mensajeDeError(error)}` },
      { status: 400 },
    );
  }
}
