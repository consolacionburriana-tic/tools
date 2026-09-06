import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { getConfigFtpCompleta, marcarSubida, registrarEntrega } from '@/lib/autoasm-entregas';
import { subirFicheros } from '@/lib/autoasm-ftp';

export const dynamic = 'force-dynamic';
// Seis CSV de un centro entero: el de matrículas es el gordo y ronda las 4.500 líneas.
export const maxDuration = 60;

const cuerpo = z.object({
  ficheros: z.array(z.object({ nombre: z.string().min(1).max(120), contenido: z.string().max(8_000_000) })).min(1).max(10),
  /** La entrega que se apuntó al descargar, si la hubo: se marca como subida. */
  entregaId: z.string().uuid().nullable().optional(),
  desdeCurso: z.string().nullable().optional(),
  recuentos: z.object({
    alumnos: z.number().int().nonnegative(),
    profes: z.number().int().nonnegative(),
    cursos: z.number().int().nonnegative(),
    clases: z.number().int().nonnegative(),
    matriculas: z.number().int().nonnegative(),
  }),
  errores: z.number().int().nonnegative().optional(),
  avisos: z.number().int().nonnegative().optional(),
});

/**
 * Sube los CSV al FTP de Apple School Manager y lo deja apuntado en el histórico. Los
 * ficheros pasan por el servidor solo para eso: no se guardan en ningún sitio.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !canAccess(user, 'autoasm')) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const datos = cuerpo.parse(await request.json());
    const config = await getConfigFtpCompleta();
    if (!config) return NextResponse.json({ error: 'Todavía no hay un FTP configurado' }, { status: 400 });

    const resultado = await subirFicheros(config, datos.ficheros);

    if (datos.entregaId) {
      await marcarSubida(datos.entregaId, 'ftp', resultado.detalle, resultado.destino);
    } else {
      await registrarEntrega({
        modo: 'ftp',
        estado: resultado.ok ? 'ok' : 'error',
        quien: user.email,
        desdeCurso: datos.desdeCurso ?? null,
        recuentos: datos.recuentos,
        errores: datos.errores,
        avisos: datos.avisos,
        destino: resultado.destino,
        detalle: resultado.detalle,
      });
    }

    if (!resultado.ok) return NextResponse.json({ error: resultado.error ?? 'No se ha podido subir' }, { status: 502 });
    return NextResponse.json(resultado);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Datos incorrectos' }, { status: 400 });
    console.error('AUTOASM: error subiendo por FTP:', error);
    return NextResponse.json({ error: 'Error subiendo los ficheros' }, { status: 500 });
  }
}
