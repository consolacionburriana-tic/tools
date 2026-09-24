// Tareas de la plataforma: queries. Ficha: docs/23-tareas.md.
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { tarTareas, type TarTarea } from '@/db/schema';
import type { ActualizarTarea, CrearTarea, EstadoTarea, Tarea, TipoTarea } from '@/lib/tareas';

function aTarea(f: TarTarea): Tarea {
  return {
    id: f.id,
    tipo: f.tipo as TipoTarea,
    titulo: f.titulo,
    modulo: f.modulo,
    descripcion: f.descripcion,
    checklist: f.checklist ?? [],
    estado: f.estado as EstadoTarea,
    ruta: f.ruta,
    createdBy: f.createdBy,
    createdByNombre: f.createdByNombre,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
    hechoAt: f.hechoAt?.toISOString() ?? null,
  };
}

/** Todas (quien lleva el tablero) o solo las que ha apuntado alguien (quien reporta). */
export async function listarTareas(opciones: { soloDe?: string } = {}): Promise<Tarea[]> {
  const q = db.select().from(tarTareas);
  const filas = await (opciones.soloDe ? q.where(eq(tarTareas.createdBy, opciones.soloDe)) : q).orderBy(
    desc(tarTareas.createdAt),
  );
  return filas.map(aTarea);
}

export async function crearTarea(
  datos: CrearTarea,
  autor: { email: string; nombre: string | null },
): Promise<Tarea> {
  const base = {
    tipo: datos.tipo,
    titulo: datos.titulo,
    createdBy: autor.email,
    createdByNombre: autor.nombre,
  };
  const valores =
    datos.tipo === 'fallo'
      ? { ...base, modulo: datos.modulo, ruta: datos.ruta ?? null }
      : { ...base, descripcion: datos.descripcion ?? null, checklist: datos.checklist ?? [] };
  const [fila] = await db.insert(tarTareas).values(valores).returning();
  return aTarea(fila);
}

export async function actualizarTarea(id: string, cambios: ActualizarTarea): Promise<Tarea | null> {
  const extra: Partial<TarTarea> = { updatedAt: new Date() };
  if (cambios.estado) extra.hechoAt = cambios.estado === 'hecho' ? new Date() : null;
  const [fila] = await db
    .update(tarTareas)
    .set({ ...cambios, ...extra })
    .where(eq(tarTareas.id, id))
    .returning();
  return fila ? aTarea(fila) : null;
}

export async function borrarTarea(id: string): Promise<void> {
  await db.delete(tarTareas).where(eq(tarTareas.id, id));
}
