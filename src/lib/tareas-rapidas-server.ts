// Tareas rápidas: crear una tarjeta de Tableros en una línea, desde la paleta de ⌘K o desde un
// correo reenviado (docs/34-paleta-y-tareas-por-correo.md). Las dos entradas acaban aquí, y aquí
// se usa la misma acción de Tableros que el botón «Añadir tarjeta» (permisos, orden, avisos).
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { tabColumnas, tabMiembros, tabTableros, tabTarjetas, tabEquipos, type EnlaceTab } from '@/db/schema';
import { accionTablero, avisarAsignacion, type Yo } from '@/lib/tableros-server';
import type { Prioridad } from '@/lib/tableros';

export interface DestinoTarea {
  id: string;
  nombre: string;
  emoji: string | null;
  equipo: string;
  /** La primera lista que no es de «hecho»: ahí entra la tarjeta. */
  columnaId: string;
  miembros: { email: string; nombre: string | null }[];
}

/** Los tableros de los equipos de alguien (sin archivar y con alguna lista abierta), en orden. */
export async function destinosTarea(email: string): Promise<DestinoTarea[]> {
  const misEquipos = db.select({ id: tabMiembros.equipoId }).from(tabMiembros).where(eq(tabMiembros.email, email));
  const [tableros, columnas, miembros] = await Promise.all([
    db
      .select({ id: tabTableros.id, nombre: tabTableros.nombre, emoji: tabTableros.emoji, equipoId: tabTableros.equipoId, equipo: tabEquipos.nombre })
      .from(tabTableros)
      .innerJoin(tabEquipos, eq(tabEquipos.id, tabTableros.equipoId))
      .where(and(inArray(tabTableros.equipoId, misEquipos), eq(tabTableros.archivado, false)))
      .orderBy(asc(tabEquipos.nombre), asc(tabTableros.orden), asc(tabTableros.createdAt)),
    db
      .select({ id: tabColumnas.id, tableroId: tabColumnas.tableroId })
      .from(tabColumnas)
      .where(
        and(
          eq(tabColumnas.hecho, false),
          inArray(tabColumnas.tableroId, db.select({ id: tabTableros.id }).from(tabTableros).where(inArray(tabTableros.equipoId, misEquipos))),
        ),
      )
      .orderBy(asc(tabColumnas.orden), asc(tabColumnas.createdAt)),
    db
      .select({ equipoId: tabMiembros.equipoId, email: tabMiembros.email, nombre: tabMiembros.nombre })
      .from(tabMiembros)
      .where(inArray(tabMiembros.equipoId, misEquipos)),
  ]);
  const primera = new Map<string, string>();
  for (const c of columnas) if (!primera.has(c.tableroId)) primera.set(c.tableroId, c.id);
  return tableros
    .filter((t) => primera.has(t.id))
    .map((t) => ({
      id: t.id,
      nombre: t.nombre,
      emoji: t.emoji,
      equipo: t.equipo,
      columnaId: primera.get(t.id)!,
      miembros: miembros.filter((m) => m.equipoId === t.equipoId).map((m) => ({ email: m.email, nombre: m.nombre })),
    }));
}

export interface NuevaTareaRapida {
  tableroId: string;
  titulo: string;
  responsables: string[];
  prioridad: Prioridad | null;
  vence: string | null;
  descripcion?: string | null;
  enlaces?: { url: string; titulo: string | null }[];
}

/**
 * Crea la tarjeta en la primera lista abierta del tablero, como si la añadiera `yo` (que tiene que
 * ser del equipo: lo comprueba la acción de Tableros), y avisa a los responsables por correo.
 * Devuelve el id de la tarjeta.
 */
export async function crearTareaRapida(t: NuevaTareaRapida, yo: Yo): Promise<string> {
  const destinos = await destinosTarea(yo.email);
  const destino = destinos.find((d) => d.id === t.tableroId);
  if (!destino) throw new Error('No estás en el equipo de ese tablero');
  const r = await accionTablero(
    destino.id,
    { accion: 'crearTarjeta', columnaId: destino.columnaId, titulo: t.titulo.slice(0, 200), responsables: t.responsables, prioridad: t.prioridad, vence: t.vence },
    yo,
  );
  if (!r.tarjeta) throw new Error('No se ha podido crear la tarjeta');
  const enlaces: EnlaceTab[] = (t.enlaces ?? []).map((e) => ({ id: crypto.randomUUID(), url: e.url, titulo: e.titulo }));
  if (t.descripcion || enlaces.length) {
    await db
      .update(tabTarjetas)
      .set({ descripcion: t.descripcion?.slice(0, 5000) ?? null, enlaces, updatedAt: new Date() })
      .where(and(eq(tabTarjetas.id, r.tarjeta.id), isNull(tabTarjetas.archivadaAt)));
  }
  if (r.avisar) await avisarAsignacion(r.avisar, yo).catch((e) => console.error('Tarea rápida · aviso:', e instanceof Error ? e.message : e));
  return r.tarjeta.id;
}
