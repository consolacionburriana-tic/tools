import { NextResponse } from 'next/server';
import { and, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { eduStudents, invAulas, invOcupacion } from '@/db/schema';
import { isGuardResponse, requireModule, requireSession } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { herramientasDe } from '@/lib/escritorio';
import { accesoComunActivo } from '@/lib/oratorios-server';
import { alcanceAlumnado } from '@/lib/alumnado-server';
import { academicYearActual } from '@/lib/constants';
import { mayusculasBellas } from '@/lib/personas';
import { cartelClase } from '@/lib/inventario';
import { PRIORIDADES } from '@/lib/tableros';
import { crearTareaRapida, destinosTarea } from '@/lib/tareas-rapidas-server';
import { direccionDeTareas } from '@/lib/tareas-correo-server';

export const dynamic = 'force-dynamic';

// La paleta de ⌘K (docs/34-paleta-y-tareas-por-correo.md). GET sin nada: lo que se puede abrir
// (herramientas, tableros con sus listas y miembros, aulas). GET con `?q=`: alumnos que casan, solo
// del alcance de quien busca. POST: crear una tarea rápida.

export async function GET(request: Request) {
  const user = await requireSession();
  if (isGuardResponse(user)) return user;
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';

  if (q) {
    if (!canAccess(user, 'alumnado') || q.length < 2) return NextResponse.json({ alumnos: [] });
    const alcance = await alcanceAlumnado(user, { conPropias: false });
    if (alcance.clases && alcance.clases.length === 0) return NextResponse.json({ alumnos: [] });
    const palabras = q.split(/\s+/).slice(0, 4);
    // Sin tildes ni mayúsculas, con `translate` (Neon no tiene la extensión `unaccent`).
    const sinTildes = (col: unknown) => sql`translate(lower(coalesce(${col}, '')), 'áéíóúàèìòùüïñç', 'aeiouaeiouuinc')`;
    const casa = (p: string) => {
      const patron = `%${p.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[%_\\]/g, '')}%`;
      return or(
        sql`${sinTildes(eduStudents.nombre)} like ${patron}`,
        sql`${sinTildes(eduStudents.apellido1)} like ${patron}`,
        sql`${sinTildes(eduStudents.apellido2)} like ${patron}`,
        ilike(eduStudents.nia, patron),
      );
    };
    const filas = await db
      .select({ id: eduStudents.id, nombre: eduStudents.nombre, apellido1: eduStudents.apellido1, apellido2: eduStudents.apellido2, curso: eduStudents.curso, letra: eduStudents.letra })
      .from(eduStudents)
      .where(and(eq(eduStudents.active, true), ...palabras.map(casa)))
      .limit(40);
    const visibles = alcance.clases ? new Set(alcance.clases.map((c) => `${c.curso}|${c.letra ?? ''}`)) : null;
    const alumnos = filas
      .filter((a) => !visibles || visibles.has(`${a.curso}|${a.letra ?? ''}`))
      .slice(0, 8)
      .map((a) => ({
        id: a.id,
        nombre: mayusculasBellas([a.nombre, a.apellido1, a.apellido2].filter(Boolean).join(' ')),
        clase: a.curso ? cartelClase(a.curso, a.letra) : '',
      }));
    return NextResponse.json({ alumnos });
  }

  const [oratoriosComun, tableros, aulas] = await Promise.all([
    !canAccess(user, 'oratorios') && canAccess(user, 'oratorios-ver') ? accesoComunActivo().catch(() => false) : false,
    canAccess(user, 'tableros') ? destinosTarea(user.email).catch(() => []) : [],
    canAccess(user, 'inventario')
      ? db
          .select({ id: invAulas.id, numero: invAulas.numero, nombre: invAulas.nombre, piso: invAulas.piso, curso: invOcupacion.curso, letra: invOcupacion.letra })
          .from(invAulas)
          .leftJoin(invOcupacion, and(eq(invOcupacion.aulaId, invAulas.id), eq(invOcupacion.academicYear, academicYearActual())))
          .where(eq(invAulas.activa, true))
          .orderBy(invAulas.piso, invAulas.orden)
          .catch(() => [])
      : [],
  ]);
  const herramientas = herramientasDe(user, { oratoriosComun, nouvinguts: null, dispositivosSinInformar: null, inventario: null, tableros: null })
    .filter((h) => !h.bloqueo)
    .map((h) => ({ clave: h.clave, titulo: h.titulo, desc: h.desc, href: h.href, icono: h.icono, grupo: h.grupo, palabras: h.palabras }));
  return NextResponse.json({
    herramientas,
    tableros,
    aulas: aulas.map((a) => ({
      id: a.id,
      titulo: a.nombre ?? `Aula ${a.numero}`,
      detalle: [a.numero && a.nombre ? `puerta ${a.numero}` : null, a.curso ? cartelClase(a.curso, a.letra) : null, a.piso].filter(Boolean).join(' · '),
      numero: a.numero,
    })),
    alumnado: canAccess(user, 'alumnado'),
    correoTareas: tableros.length ? direccionDeTareas() : null,
  });
}

const tareaSchema = z.object({
  tableroId: z.string().uuid(),
  titulo: z.string().trim().min(1, 'Escribe la tarea').max(200),
  responsables: z.array(z.string().email()).max(10),
  prioridad: z.enum(PRIORIDADES).nullable(),
  vence: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

export async function POST(request: Request) {
  const user = await requireModule('tableros');
  if (isGuardResponse(user)) return user;
  const p = tareaSchema.safeParse(await request.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 });
  try {
    const id = await crearTareaRapida(p.data, { email: user.email, nombre: user.nombre });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error('Paleta · tarea:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se ha podido crear' }, { status: 400 });
  }
}
