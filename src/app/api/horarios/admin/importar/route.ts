import { NextResponse } from 'next/server';

import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { getSessionUser } from '@/lib/auth-guards';
import { puedeEditarHorarios } from '@/lib/permissions';
import { normalizarBloqueClase, type ResultadoBloque } from '@/lib/horarios-import';
import { leerHorarios } from '@/lib/horarios-lectores';
import { importarBloques } from '@/lib/horarios-server';
import { etapaDeCursoHorario } from '@/lib/horarios';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Sube un .docx/.xlsx de horarios. Con `confirmar=false` (por defecto) SOLO devuelve la
 * vista previa: nada se escribe hasta que quien importa ve qué va a entrar. Es el mismo
 * patrón del sync de Educamos, y aquí importa el doble porque un horario se sobrescribe
 * entero.
 */
export async function POST(req: Request) {
  const guard = await requireModule('horarios');
  if (isGuardResponse(guard)) return guard;
  const user = await getSessionUser();
  if (!puedeEditarHorarios(user?.role ?? null)) {
    return NextResponse.json({ error: 'No tienes permiso para importar horarios' }, { status: 403 });
  }

  const form = await req.formData();
  const fichero = form.get('fichero');
  if (!(fichero instanceof File)) return NextResponse.json({ error: 'Falta el fichero' }, { status: 400 });
  if (fichero.size > MAX_BYTES) return NextResponse.json({ error: 'El fichero pasa de 10 MB' }, { status: 400 });
  if (!/\.(docx|xlsx)$/i.test(fichero.name)) {
    return NextResponse.json({ error: 'Solo .docx o .xlsx de Educamos' }, { status: 400 });
  }

  let bloques;
  try {
    bloques = leerHorarios(new Uint8Array(await fichero.arrayBuffer()), fichero.name);
  } catch (e) {
    // El mensaje sí, la traza no: puede llevar trozos del fichero.
    return NextResponse.json({ error: `No se ha podido leer el fichero: ${(e as Error).message}` }, { status: 400 });
  }

  const deClase = bloques.filter((b) => b.tipo === 'clase');
  const normalizados: ResultadoBloque[] = deClase.map((b) => normalizarBloqueClase(b.filas));
  const utiles = normalizados.filter((r) => r.clase && r.sesiones.length > 0);

  const previa = {
    bloquesTotales: bloques.length,
    deProfesor: bloques.length - deClase.length,
    clases: utiles.map((r) => ({
      codigo: r.clase!.codigo,
      nombre: r.clase!.nombre,
      etapa: etapaDeCursoHorario(r.clase!.curso),
      sesiones: r.sesiones.length,
      tramos: r.tramos.length,
      conAula: r.sesiones.filter((s) => s.aulaCodigo).length,
      apoyos: r.sesiones.filter((s) => s.actividadCodigo !== 'clase').length,
      incidencias: r.incidencias.length,
    })),
    incidencias: agrupar(utiles.flatMap((r) => r.incidencias).map((i) => `${i.tipo} · ${i.crudo ?? i.detalle}`)),
    notas: [...new Set(utiles.flatMap((r) => r.notas))],
    // El fichero no dice si es el horario ordinario o el corto de septiembre/junio, pero
    // se nota: el corto no tiene comedor y baja de 6 franjas. Se sugiere, decide la persona.
    periodoSugerido: sugerirPeriodo(utiles),
  };

  if (form.get('confirmar') !== 'true') return NextResponse.json({ previa });

  const resumen = await importarBloques(utiles, {
    academicYear: String(form.get('academicYear') ?? ''),
    periodoNombre: String(form.get('periodo') ?? 'Ordinario'),
    fechaInicio: String(form.get('desde') ?? ''),
    fechaFin: String(form.get('hasta') ?? ''),
    prioridad: Number(form.get('prioridad') ?? 0),
    esOrdinario: form.get('ordinario') === 'true',
  });
  return NextResponse.json({ previa, resumen });
}

function agrupar(claves: string[]): { clave: string; veces: number }[] {
  const m = new Map<string, number>();
  for (const k of claves) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([clave, veces]) => ({ clave, veces }));
}

function sugerirPeriodo(bloques: ResultadoBloque[]): 'Ordinario' | 'Septiembre/Junio' {
  const conComedor = bloques.some((b) => b.tramos.some((t) => t.tipo === 'comedor'));
  const franjas = Math.max(0, ...bloques.map((b) => b.tramos.filter((t) => t.tipo === 'sesion').length));
  return conComedor || franjas >= 6 ? 'Ordinario' : 'Septiembre/Junio';
}
