import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { alcanceAlumnado, puedeConAlumno } from '@/lib/alumnado-server';
import { guardarEstadosMaterial } from '@/lib/materiales-server';
import { puedeGestionarMateriales } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const cuerpo = z.object({
  eduStudentIds: z.array(z.string().uuid()).min(1).max(800),
  // `null` = «—», todavía no hay información.
  estado: z.enum(['pagado', 'no', 'becado', 'no_aplica']).nullable(),
});

/**
 * Marca el pago de un material para un alumno (un toque en la celda) o para una clase
 * entera. Secretaría, dirección y TIC. `guardarEstadosMaterial` descarta a quien quede fuera
 * del alcance o a quien el material no vaya dirigido.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('alumnado');
  if (isGuardResponse(guard)) return guard;
  if (!puedeGestionarMateriales(guard.role)) {
    return NextResponse.json({ error: 'Los pagos los marcan secretaría, dirección o TIC' }, { status: 403 });
  }
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Identificador no válido' }, { status: 400 });

  try {
    const { eduStudentIds, estado } = cuerpo.parse(await request.json());
    const alcance = await alcanceAlumnado(guard, { conPropias: false });
    const hecho = await guardarEstadosMaterial(id, eduStudentIds, estado, guard.email, (a) =>
      puedeConAlumno(alcance.clases, a),
    );
    if (!hecho) return NextResponse.json({ error: 'Ese material no existe' }, { status: 404 });
    if (hecho.ids.length === 0) return NextResponse.json({ error: 'Ninguno de esos alumnos tiene este material' }, { status: 404 });
    return NextResponse.json({ ids: hecho.ids, estado });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
