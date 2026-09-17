import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { alcanceAlumnado, claseDeAlumno, permisosFicha, alcanceProteccion, puedeConAlumno } from '@/lib/alumnado-server';
import { setAmpa, setBanco } from '@/lib/bancolibros-server';

export const dynamic = 'force-dynamic';

const cuerpo = z
  .object({ bancoLibros: z.boolean().optional(), ampa: z.boolean().optional() })
  .refine((c) => c.bancoLibros !== undefined || c.ampa !== undefined, { message: 'No hay nada que cambiar' });

/**
 * Banco de libros y AMPA desde la ficha de alumnado. **No es un sitio nuevo donde vivan
 * estos datos**: llama a los mismos `setBanco`/`setAmpa` del banco de libros (que además
 * propagan el banco al snapshot de la campaña de Licencias), y exige exactamente el mismo
 * permiso que su propio panel. La ficha condensa la información; la autoridad no cambia.
 *
 * Ojo: el `ampa` de aquí es «la familia es socia del AMPA», no el permiso de que el AMPA
 * publique fotos — ese vive en la protección de datos, en la ruta de al lado.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('alumnado');
  if (isGuardResponse(guard)) return guard;

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Identificador no válido' }, { status: 400 });
  }

  const [alumno, alcance] = await Promise.all([claseDeAlumno(id), alcanceAlumnado(guard)]);
  if (!alumno || !puedeConAlumno(alcance.clases, alumno)) {
    return NextResponse.json({ error: 'Ese alumno no existe' }, { status: 404 });
  }
  if (!permisosFicha(guard, alcanceProteccion(guard, alcance.propias), alumno).participacion) {
    return NextResponse.json(
      { error: 'Solo dirección/TIC pueden cambiar el banco de libros y el AMPA' },
      { status: 403 },
    );
  }

  try {
    const { bancoLibros, ampa } = cuerpo.parse(await request.json());
    if (bancoLibros !== undefined) await setBanco(id, bancoLibros);
    if (ampa !== undefined) await setAmpa([id], ampa);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
