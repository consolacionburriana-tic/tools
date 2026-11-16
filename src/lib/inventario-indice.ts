// Inventario y aulas: todo lo de cada aula junto (puro, sin IO). Lo usan las pantallas (cliente)
// y los informes de imprimir y el Excel (servidor). Ficha: docs/33-inventario.md.
import { atencionAv, cartelClase, claveClase, compararAulas, nombreAula, type NivelAtencion } from './inventario';
import type { AntenaInv, ArregloInv, AulaInv, AvInv, Inventario, KitRob, MobiliarioInv, OcupacionInv, Tutoria } from './inventario-server';


export interface FilaAula {
  aula: AulaInv;
  nombre: string;
  ocupacion: OcupacionInv | null;
  /** «3º EP B», o la etiqueta, o '' si no hay clase. */
  cartel: string;
  tutores: string[];
  alumnos: number | null;
  av: AvInv | null;
  mob: MobiliarioInv | null;
  antenas: AntenaInv[];
  arreglos: ArregloInv[];
  pendientes: ArregloInv[];
  urgentes: number;
  kits: KitRob[];
  atencionAv: NivelAtencion;
}

function tutoresDe(tutorias: readonly Tutoria[], year: string, curso: string | null, letra: string | null): string[] {
  if (!curso) return [];
  return tutorias.filter((t) => t.academicYear === year && t.curso === curso && (t.letra ?? null) === (letra ?? null)).map((t) => t.nombre);
}

/** Todo lo de cada aula, junto y ordenado por número. Es la base de casi todas las pantallas. */
export function indexar(inv: Inventario): FilaAula[] {
  const porAula = <T extends { aulaId: string | null }>(lista: readonly T[]) => {
    const m = new Map<string, T[]>();
    for (const x of lista) if (x.aulaId) m.set(x.aulaId, [...(m.get(x.aulaId) ?? []), x]);
    return m;
  };
  const ocup = new Map(inv.ocupacion.filter((o) => o.academicYear === inv.cursoActual).map((o) => [o.aulaId, o]));
  const av = new Map(inv.av.map((a) => [a.aulaId, a]));
  const mob = new Map(inv.mobiliario.map((m) => [m.aulaId, m]));
  const antenas = porAula(inv.antenas);
  const arreglos = porAula(inv.arreglos);
  const kits = porAula(inv.kits);
  return [...inv.aulas].sort(compararAulas).map((aula) => {
    const o = ocup.get(aula.id) ?? null;
    const arr = arreglos.get(aula.id) ?? [];
    const pendientes = arr.filter((a) => !a.hechoAt);
    const a = av.get(aula.id) ?? null;
    return {
      aula,
      nombre: nombreAula(aula),
      ocupacion: o,
      cartel: o?.curso ? cartelClase(o.curso, o.letra) : (o?.etiqueta ?? ''),
      tutores: tutoresDe(inv.tutorias, inv.cursoActual, o?.curso ?? null, o?.letra ?? null),
      alumnos: o?.curso ? (inv.alumnos[claveClase(o.curso, o.letra)] ?? 0) : null,
      av: a,
      mob: mob.get(aula.id) ?? null,
      antenas: antenas.get(aula.id) ?? [],
      arreglos: arr,
      pendientes,
      urgentes: pendientes.filter((x) => x.prioridad === 'urgente').length,
      kits: kits.get(aula.id) ?? [],
      atencionAv: atencionAv(
        a,
        pendientes.filter((x) => x.area === 'av').map((x) => ({ prioridad: x.prioridad, hecho: false })),
      ),
    };
  });
}


/** Nombre corto de un aula para chips y desplegables: «12 · 3º EP B», «Informática». */
export function etiquetaAula(f: Pick<FilaAula, 'aula' | 'cartel'>): string {
  if (f.aula.nombre) return nombreAula(f.aula);
  return f.cartel ? `${f.aula.numero} · ${f.cartel}` : `Aula ${f.aula.numero}`;
}

