import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { actualizarForm, borrarForm, getHuecosPendientes } from '@/lib/evaluaciones-server';

const patchSchema = z.object({
  titulo: z.string().min(3).optional(),
  descripcion: z.string().nullable().optional(),
  estado: z.enum(['borrador', 'abierto', 'cerrado']).optional(),
  academicYear: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  anonimo: z.boolean().optional(),
  identificaAlumno: z.boolean().optional(),
  pedirClase: z.boolean().optional(),
  pedirEtapa: z.boolean().optional(),
  requiereLogin: z.boolean().optional(),
  avisoAnonimato: z.string().nullable().optional(),
  mensajeFinal: z.string().nullable().optional(),
  clases: z.array(z.object({ curso: z.string(), letra: z.string().nullable() })).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('evaluaciones');
  if (isGuardResponse(guard)) return guard;
  try {
    const { id } = await params;
    const cambios = patchSchema.parse(await request.json());

    // Abrir una evaluación con las frases del preset a medias equivale a mandar una
    // encuesta genérica: se bloquea aquí, no solo en la interfaz.
    if (cambios.estado === 'abierto') {
      const huecos = await getHuecosPendientes(id);
      if (huecos.length > 0) {
        return NextResponse.json(
          {
            error:
              huecos.length === 1
                ? 'Falta terminar una frase antes de abrir la evaluación'
                : `Faltan ${huecos.length} frases por terminar antes de abrir la evaluación`,
            huecos,
          },
          { status: 409 },
        );
      }
    }

    await actualizarForm(id, cambios);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('evaluaciones');
  if (isGuardResponse(guard)) return guard;
  const { id } = await params;
  const res = await borrarForm(id);
  if (!res.ok) return NextResponse.json({ error: res.motivo }, { status: 409 });
  return NextResponse.json({ ok: true });
}
