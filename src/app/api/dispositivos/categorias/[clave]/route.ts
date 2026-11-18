import { NextResponse } from 'next/server';
import { z } from 'zod';
import { categoriaSchema } from '@/lib/dispositivos';
import { guardarCategoria, quitarCategoria, recuperarCategoria } from '@/lib/dispositivos-server';
import { fallo, guard, isGuardResponse, leer } from '../../respuesta';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ clave: string }> };

/** La clave de una categoría es un texto corto: `sustitucion`, `tec`, `audicion-lenguaje`. */
const claveValida = (clave: string) => /^[a-z0-9-]{1,40}$/.test(clave);

const cuerpoSchema = z.union([categoriaSchema, z.object({ recuperar: z.literal(true) })]);

/** Cambiar una categoría (`categoriaSchema`) o recuperar una archivada (`{ recuperar: true }`). */
export async function PATCH(request: Request, { params }: Ctx) {
  const g = await guard();
  if (isGuardResponse(g)) return g;
  const { clave } = await params;
  if (!claveValida(clave)) return NextResponse.json({ error: 'Esa categoría no existe' }, { status: 404 });
  const input = await leer(request, cuerpoSchema);
  if (input instanceof NextResponse) return input;
  try {
    const categorias = 'recuperar' in input ? await recuperarCategoria(clave) : await guardarCategoria(clave, input);
    return NextResponse.json({ categorias });
  } catch (error) {
    return fallo(error, 'editar categoría');
  }
}

/** Sin iPads se borra; con todos de baja se archiva; con iPads vivos, no. */
export async function DELETE(_request: Request, { params }: Ctx) {
  const g = await guard();
  if (isGuardResponse(g)) return g;
  const { clave } = await params;
  if (!claveValida(clave)) return NextResponse.json({ error: 'Esa categoría no existe' }, { status: 404 });
  try {
    return NextResponse.json(await quitarCategoria(clave));
  } catch (error) {
    return fallo(error, 'quitar categoría');
  }
}
