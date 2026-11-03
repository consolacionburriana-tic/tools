import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { entradasDeLote, restaurarEntradas } from '@/lib/auditoria-server';
import { guardarProteccionMasiva, guardarServicios, leerCursosDe } from '@/lib/alumnado-server';
import { setAmpa, setBancoVarios } from '@/lib/bancolibros-server';
import { canAccess, puedeEditarProteccionDatos, puedeGestionarParticipantesBanco, puedeGestionarServicios, puedeVerHistorialAlumnado } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const cuerpo = z
  .object({
    /** Líneas sueltas. */
    ids: z.array(z.string().uuid()).min(1).max(3000).optional(),
    /** O un cambio entero (lote). */
    lote: z.string().uuid().optional(),
  })
  .refine((c) => Boolean(c.ids) !== Boolean(c.lote), { message: 'Manda `ids` o `lote`, no los dos' });

/**
 * Restaura casillas a como estaban antes de un cambio. Vuelve a comprobar TODO en el servidor
 * (permiso por tipo de casilla, que el valor siga siendo el que dejó ese cambio) y cada
 * restauración queda anotada en el libro como un cambio más, origen «Restauración»: se puede
 * deshacer a su vez. Lo que ya se tocó después, o viene de Educamos, se salta y se dice por qué.
 */
export async function POST(request: Request) {
  const guard = await requireModule('alumnado');
  if (isGuardResponse(guard)) return guard;
  if (!puedeVerHistorialAlumnado(guard.role)) {
    return NextResponse.json({ error: 'Restaurar lo cambian secretaría, dirección y TIC' }, { status: 403 });
  }
  try {
    const { ids, lote } = cuerpo.parse(await request.json());
    const idsLineas = ids ?? (await entradasDeLote(lote!)).map((e) => e.id);

    const puede = (grupo: string) =>
      grupo === 'proteccion'
        ? puedeEditarProteccionDatos(guard.role)
        : grupo === 'participacion'
          ? canAccess(guard, 'bancolibros') && puedeGestionarParticipantesBanco(guard.role)
          : grupo === 'servicios'
            ? puedeGestionarServicios(guard.role)
            : false;

    const ctx = { por: guard.email, origen: 'restauracion' as const, lote: crypto.randomUUID() };
    const resultado = await restaurarEntradas(idsLineas, puede, {
      // Sin alcance por clase: quien restaura ya es de los que ven y editan todo el centro.
      proteccion: async (alumnos, campo, valor) => {
        const claves: Record<string, 'imagen' | 'redes' | 'ampa' | 'ong' | 'desestimaCorreo'> = {
          pd_imagen: 'imagen',
          pd_redes: 'redes',
          pd_ampa: 'ampa',
          pd_ong: 'ong',
          pd_correo: 'desestimaCorreo',
        };
        const clave = claves[campo];
        await guardarProteccionMasiva(
          alumnos,
          { [clave]: clave === 'desestimaCorreo' ? valor === true : valor },
          guard.email,
          { general: null, proteccion: { todo: true, clases: [], edita: true } },
          ctx,
        );
      },
      participacion: async (alumnos, campo, valor) => {
        if (campo === 'banco') await setBancoVarios(alumnos, valor, ctx);
        else await setAmpa(alumnos, valor, ctx);
      },
      servicios: async (alumnos, campo, valor) => {
        await guardarServicios(await leerCursosDe(alumnos), { [campo]: valor }, ctx);
      },
    });
    return NextResponse.json(resultado);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
