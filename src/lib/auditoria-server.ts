// Libro de cambios · la parte con Neon. La lógica pura (qué es restaurable, cómo se codifica un
// valor) está en `auditoria.ts`. Ficha: docs/31-auditoria.md.
//
// Los escritores de casillas (`guardarProteccion*`, `guardarServicios`, `setBanco*`, `setAmpa`)
// llaman a `conAuditoria`: lee cómo están las casillas ANTES, escribe, y anota solo lo que de
// verdad ha cambiado. Si la anotación falla se queda en el log del servidor y NO se tumba el
// cambio del usuario: es peor perder lo que acaba de marcar que perder una línea del registro.

import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { audCambios, eduStudents } from '@/db/schema';
import {
  CAMPOS_RESTAURABLES,
  codigoAValor,
  esCampoRestaurable,
  esRestaurable,
  filasDeCambio,
  grupoDeCampo,
  yaEstaComoAntes,
  type CampoRestaurable,
  type ChecksAlumno,
  type FilaAuditoria,
  type GrupoAuditoria,
  type OrigenCambio,
} from '@/lib/auditoria';
import { claseLarga } from '@/lib/alumnado';

export interface AlumnoConChecks {
  id: string;
  nombre: string;
  clase: string;
  checks: ChecksAlumno;
}

const COLUMNAS = {
  id: eduStudents.id,
  nombre: eduStudents.nombre,
  apellido1: eduStudents.apellido1,
  apellido2: eduStudents.apellido2,
  curso: eduStudents.curso,
  letra: eduStudents.letra,
  pd_imagen: eduStudents.pdImagen,
  pd_redes: eduStudents.pdRedes,
  pd_ampa: eduStudents.pdAmpa,
  pd_ong: eduStudents.pdOng,
  pd_correo: eduStudents.pdDesestimaCorreo,
  banco: eduStudents.bancoLibros,
  ampa: eduStudents.ampa,
  comedor: eduStudents.comedor,
  complementarias: eduStudents.complementarias,
};

/** Cómo están las casillas de estos alumnos ahora mismo, con el nombre y la clase de hoy. */
export async function leerChecks(ids: readonly string[]): Promise<Map<string, AlumnoConChecks>> {
  const mapa = new Map<string, AlumnoConChecks>();
  if (ids.length === 0) return mapa;
  const filas = await db.select(COLUMNAS).from(eduStudents).where(inArray(eduStudents.id, [...ids]));
  for (const f of filas) {
    mapa.set(f.id, {
      id: f.id,
      nombre: [f.nombre, f.apellido1, f.apellido2].filter(Boolean).join(' '),
      clase: claseLarga(f.curso, f.letra),
      checks: Object.fromEntries(CAMPOS_RESTAURABLES.map((c) => [c, f[c] ?? null])) as ChecksAlumno,
    });
  }
  return mapa;
}

export interface Contexto {
  por: string | null;
  origen?: OrigenCambio;
  /** Para que varias llamadas de un mismo clic caigan en el mismo lote. */
  lote?: string;
}

export async function registrarFilas(filas: FilaAuditoria[]): Promise<void> {
  if (filas.length === 0) return;
  try {
    // Por tandas: un lote de «todo el centro» son varios miles de filas.
    for (let i = 0; i < filas.length; i += 500) {
      await db.insert(audCambios).values(filas.slice(i, i + 500));
    }
  } catch (error) {
    console.error('[auditoria] No se pudo anotar el cambio (el cambio SÍ se guardó):', error);
  }
}

/**
 * Envuelve una escritura de casillas: lee el antes, escribe, anota la diferencia.
 * `despues` son los valores que la escritura deja (solo las casillas que toca).
 */
export async function conAuditoria<R>(
  ids: readonly string[],
  despues: Partial<ChecksAlumno>,
  ctx: Contexto,
  escribir: () => Promise<R>,
): Promise<R> {
  let antes = new Map<string, AlumnoConChecks>();
  try {
    antes = await leerChecks(ids);
  } catch (error) {
    console.error('[auditoria] No se pudo leer el estado previo:', error);
  }
  const resultado = await escribir();
  const lote = ctx.lote ?? crypto.randomUUID();
  const filas: FilaAuditoria[] = [];
  for (const a of antes.values()) {
    filas.push(
      ...filasDeCambio({ id: a.id, nombre: a.nombre, clase: a.clase }, a.checks, despues, {
        lote,
        por: ctx.por,
        origen: ctx.origen ?? 'usuario',
      }),
    );
  }
  await registrarFilas(filas);
  return resultado;
}

// ─── Leer el historial ────────────────────────────────────────────────────────

export interface LoteResumen {
  lote: string;
  at: string;
  por: string | null;
  origen: string;
  /** Alumnos distintos tocados y casillas distintas. */
  alumnos: number;
  filas: number;
  campos: string[];
  /** Hasta tres nombres, para que la línea diga «Ana Pérez, Luis Gil y 22 más». */
  muestra: string[];
  clases: string[];
}

/** Los últimos lotes, del más reciente al más viejo, opcionalmente de un grupo de casillas. */
export async function lotesRecientes(opciones: {
  limite: number;
  antesDe?: Date;
  grupo?: GrupoAuditoria;
}): Promise<LoteResumen[]> {
  const condGrupo =
    opciones.grupo === 'proteccion'
      ? sql`${audCambios.campo} like 'pd\_%'`
      : opciones.grupo === 'participacion'
        ? sql`${audCambios.campo} in ('banco','ampa')`
        : opciones.grupo === 'servicios'
          ? sql`${audCambios.campo} in ('comedor','complementarias')`
          : opciones.grupo === 'educamos'
            ? sql`${audCambios.origen} = 'educamos'`
            : undefined;
  const condAntes = opciones.antesDe ? sql`${audCambios.at} < ${opciones.antesDe}` : undefined;
  const donde = condGrupo && condAntes ? and(condGrupo, condAntes) : (condGrupo ?? condAntes);

  const filas = await db
    .select({
      lote: audCambios.lote,
      at: sql<Date>`min(${audCambios.at})`,
      por: sql<string | null>`min(${audCambios.por})`,
      origen: sql<string>`min(${audCambios.origen})`,
      alumnos: sql<number>`count(distinct ${audCambios.eduStudentId})::int`,
      filas: sql<number>`count(*)::int`,
      campos: sql<string[]>`array_agg(distinct ${audCambios.campo})`,
      muestra: sql<string[]>`(array_agg(distinct ${audCambios.alumno}))[1:3]`,
      clases: sql<string[]>`array_agg(distinct ${audCambios.clase})`,
    })
    .from(audCambios)
    .where(donde)
    .groupBy(audCambios.lote)
    .orderBy(desc(sql`min(${audCambios.at})`))
    .limit(opciones.limite);

  return filas.map((f) => ({ ...f, at: new Date(f.at).toISOString(), clases: f.clases.filter(Boolean) }));
}

export interface EntradaHistorial {
  id: string;
  lote: string;
  at: string;
  por: string | null;
  origen: string;
  eduStudentId: string;
  alumno: string;
  clase: string;
  campo: string;
  antes: string | null;
  despues: string | null;
  /** Se puede restaurar ahora (valor actual = el que dejó este cambio, no es de Educamos). */
  restaurable: boolean;
  /** Ya está como antes de este cambio. */
  yaRestaurado: boolean;
}

async function conEstado(filas: (typeof audCambios.$inferSelect)[]): Promise<EntradaHistorial[]> {
  const actuales = await leerChecks([...new Set(filas.map((f) => f.eduStudentId))]);
  return filas.map((f) => {
    const actual = actuales.get(f.eduStudentId)?.checks;
    return {
      id: f.id,
      lote: f.lote,
      at: f.at.toISOString(),
      por: f.por,
      origen: f.origen,
      eduStudentId: f.eduStudentId,
      alumno: f.alumno,
      clase: f.clase,
      campo: f.campo,
      antes: f.antes,
      despues: f.despues,
      restaurable: esRestaurable(f, actual),
      yaRestaurado: yaEstaComoAntes(f, actual),
    };
  });
}

export async function entradasDeLote(lote: string, limite = 2000): Promise<EntradaHistorial[]> {
  const filas = await db
    .select()
    .from(audCambios)
    .where(eq(audCambios.lote, lote))
    .orderBy(audCambios.clase, audCambios.alumno, audCambios.campo)
    .limit(limite);
  return conEstado(filas);
}

export async function entradasDeAlumno(eduStudentId: string, limite = 40): Promise<EntradaHistorial[]> {
  const filas = await db
    .select()
    .from(audCambios)
    .where(eq(audCambios.eduStudentId, eduStudentId))
    .orderBy(desc(audCambios.at))
    .limit(limite);
  return conEstado(filas);
}

// ─── Restaurar ────────────────────────────────────────────────────────────────

/** Cómo se escribe cada casilla. Los pasa quien llama, para no importar el ciclo de módulos aquí. */
export interface Escritores {
  /** Protección de datos (pd_*): un campo, un valor, muchos alumnos. */
  proteccion: (ids: string[], campo: CampoRestaurable, valor: boolean | null) => Promise<void>;
  participacion: (ids: string[], campo: 'banco' | 'ampa', valor: boolean) => Promise<void>;
  servicios: (ids: string[], campo: 'comedor' | 'complementarias', valor: boolean) => Promise<void>;
}

export interface ResultadoRestauracion {
  restauradas: number;
  /** Líneas que no se tocaron, con el motivo en cristiano. */
  omitidas: { alumno: string; campo: string; motivo: string }[];
}

/**
 * Restaura las líneas pedidas. Re-lee el estado actual y re-comprueba cada una: la pantalla pudo
 * quedarse vieja. `puede` dice si quien pulsa tiene permiso para ese grupo de casillas.
 */
export async function restaurarEntradas(
  ids: readonly string[],
  puede: (grupo: GrupoAuditoria) => boolean,
  escritores: Escritores,
): Promise<ResultadoRestauracion> {
  const filas = ids.length
    ? await db.select().from(audCambios).where(inArray(audCambios.id, [...ids]))
    : [];
  const actuales = await leerChecks([...new Set(filas.map((f) => f.eduStudentId))]);
  const omitidas: ResultadoRestauracion['omitidas'] = [];

  // Agrupadas por (casilla, valor al que vuelve): una escritura por grupo, no una por alumno.
  const grupos = new Map<string, { campo: CampoRestaurable; valor: boolean | null; ids: string[] }>();
  for (const f of filas) {
    const omitir = (motivo: string) => omitidas.push({ alumno: f.alumno, campo: f.campo, motivo });
    if (f.origen === 'educamos') {
      omitir('Viene de Educamos: solo se anota');
      continue;
    }
    if (!esCampoRestaurable(f.campo)) {
      omitir('Esta línea no se restaura');
      continue;
    }
    if (!puede(grupoDeCampo(f.campo))) {
      omitir('No tienes permiso para cambiar esto');
      continue;
    }
    const actual = actuales.get(f.eduStudentId)?.checks;
    if (!actual) {
      omitir('El alumno ya no existe');
      continue;
    }
    if (yaEstaComoAntes(f, actual)) {
      omitir('Ya estaba como antes');
      continue;
    }
    if (!esRestaurable(f, actual)) {
      omitir('Se ha vuelto a cambiar después');
      continue;
    }
    const valor = codigoAValor(f.antes);
    // Banco, AMPA, comedor y complementarias no tienen «no consta»: sin valor previo, se quedan en no.
    const final = f.campo.startsWith('pd_') ? valor : valor === true;
    const clave = `${f.campo}|${String(final)}`;
    const g = grupos.get(clave) ?? { campo: f.campo, valor: final, ids: [] };
    g.ids.push(f.eduStudentId);
    grupos.set(clave, g);
  }

  let restauradas = 0;
  for (const g of grupos.values()) {
    if (g.campo.startsWith('pd_')) await escritores.proteccion(g.ids, g.campo, g.valor);
    else if (g.campo === 'banco' || g.campo === 'ampa') await escritores.participacion(g.ids, g.campo, g.valor === true);
    else await escritores.servicios(g.ids, g.campo as 'comedor' | 'complementarias', g.valor === true);
    restauradas += g.ids.length;
  }
  return { restauradas, omitidas };
}
