// Queries de horarios (Drizzle). Ficha: docs/07-horarios.md
//
// De momento vive aquí el VOLCADO de una importación. La regla que lo gobierna todo es que
// sea **idempotente y reejecutable**: importar dos veces el mismo fichero tiene que dejar
// la base igual que importarlo una vez. Se consigue borrando y reescribiendo el periodo
// entero por etapa en una transacción, en vez de intentar casar fila a fila: un horario es
// una foto completa de un curso, no un diario de cambios, y "lo que trae el fichero" es
// siempre la verdad.

import { and, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db';
import {
  eduTeachers,
  horActividades,
  horAlias,
  horAsignacionGrupos,
  horAsignacionProfes,
  horAsignaciones,
  horEspacios,
  horMaterias,
  horPeriodos,
  horRejillaAmbitos,
  horRejillas,
  horSesiones,
  horTramos,
} from '@/db/schema';
import { compararClases, nombreClase } from '@/lib/cursos';
import { etapaDeCursoHorario, nombreCorto, nombreProfe, periodoVigente, type CeldaHorario } from '@/lib/horarios';
import { normalizarNombreMateria, raizMateria, type Incidencia, type ResultadoBloque } from '@/lib/horarios-import';

export interface ResumenImportacion {
  periodo: string;
  rejillas: number;
  tramos: number;
  materias: number;
  espacios: number;
  asignaciones: number;
  sesiones: number;
  profesVinculados: number;
  profesNoEncontrados: string[];
  incidencias: Incidencia[];
  notas: string[];
}

export interface OpcionesImportacion {
  academicYear: string;
  periodoNombre: string;
  fechaInicio: string;
  fechaFin: string;
  prioridad?: number;
  esOrdinario?: boolean;
}

/**
 * Vuelca los bloques ya normalizados de un fichero a la BBDD.
 *
 * Una **rejilla por etapa**, construida con los tramos que trae el propio fichero y
 * replicada de lunes a viernes. Se hace así, y no leyendo las rejillas del "Horario
 * general", a propósito: la fuente de dónde va una sesión tiene que ser el mismo fichero
 * que dice qué es esa sesión, o un desajuste de cinco minutos entre dos ficheros deja
 * sesiones sin hueco. Cuando llegue secundaria, que sí tiene días distintos entre sí, esto
 * seguirá valiendo porque el fichero de cada clase trae sus propias horas.
 */
export async function importarBloques(
  bloques: readonly ResultadoBloque[],
  opciones: OpcionesImportacion,
): Promise<ResumenImportacion> {
  const resumen: ResumenImportacion = {
    periodo: opciones.periodoNombre,
    rejillas: 0, tramos: 0, materias: 0, espacios: 0,
    asignaciones: 0, sesiones: 0, profesVinculados: 0,
    profesNoEncontrados: [], incidencias: [], notas: [],
  };

  const utiles = bloques.filter((b) => b.clase && b.sesiones.length > 0);
  if (utiles.length === 0) return resumen;
  for (const b of utiles) {
    resumen.incidencias.push(...b.incidencias);
    resumen.notas.push(...b.notas);
  }

  // ── Periodo (uno por nombre + curso académico) ──────────────────────────────
  const [periodo] = await db
    .select()
    .from(horPeriodos)
    .where(and(eq(horPeriodos.academicYear, opciones.academicYear), eq(horPeriodos.nombre, opciones.periodoNombre)))
    .limit(1);
  const periodoId =
    periodo?.id ??
    (
      await db
        .insert(horPeriodos)
        .values({
          academicYear: opciones.academicYear,
          nombre: opciones.periodoNombre,
          fechaInicio: opciones.fechaInicio,
          fechaFin: opciones.fechaFin,
          prioridad: opciones.prioridad ?? 0,
          esOrdinario: opciones.esOrdinario ?? false,
        })
        .returning()
    )[0].id;

  // ── Catálogos: profes por alias, actividades, materias y espacios ───────────
  // El alias de `edu_teachers` ES el código del export ('MVER0'), verificado contra los
  // ficheros reales: no hace falta tabla de traducción para el profesorado.
  const profes = await db.select({ id: eduTeachers.id, alias: eduTeachers.alias }).from(eduTeachers);
  const profePorAlias = new Map(profes.filter((p) => p.alias).map((p) => [p.alias!.toUpperCase(), p.id]));

  const actividades = await db.select().from(horActividades);
  const actividadPorCodigo = new Map(actividades.map((a) => [a.codigo, a.id]));
  const idClase = actividadPorCodigo.get('clase');
  if (!idClase) throw new Error("Falta la actividad 'clase' en hor_actividades: ¿se ejecutó la semilla?");

  const materiaPorCodigo = await asegurarMaterias(utiles);
  const espacioPorCodigo = await asegurarEspacios(utiles);
  resumen.materias = materiaPorCodigo.size;
  resumen.espacios = espacioPorCodigo.size;

  // ── Rejilla por etapa, con los tramos del propio fichero ────────────────────
  const tramoId = new Map<string, string>(); // `${etapa}|${dia}|${orden}` → id
  const porEtapa = new Map<string, ResultadoBloque[]>();
  for (const b of utiles) {
    const etapa = etapaDeCursoHorario(b.clase!.curso) ?? 'OTRA';
    porEtapa.set(etapa, [...(porEtapa.get(etapa) ?? []), b]);
  }

  for (const [etapa, suyos] of porEtapa) {
    const nombre = `${opciones.periodoNombre} · ${etapa}`;
    await borrarRejilla(periodoId, nombre);
    const [rejilla] = await db.insert(horRejillas).values({ periodoId, nombre }).returning();
    resumen.rejillas++;
    await db.insert(horRejillaAmbitos).values({ rejillaId: rejilla.id, etapa });

    // Los tramos son iguales en todas las clases de la etapa; se coge el bloque con más.
    const plantilla = suyos.reduce((a, b) => (b.tramos.length > a.tramos.length ? b : a)).tramos;
    const filas = [1, 2, 3, 4, 5].flatMap((dia) =>
      plantilla.map((t) => ({
        rejillaId: rejilla.id,
        diaSemana: dia,
        orden: t.orden,
        etiqueta: t.tipo === 'sesion' ? `${t.orden}ª` : t.tipo === 'recreo' ? 'Patio' : 'Comedor',
        horaInicio: t.horaInicio,
        horaFin: t.horaFin,
        tipo: t.tipo,
      })),
    );
    const creados = await db.insert(horTramos).values(filas).returning();
    resumen.tramos += creados.length;
    for (const t of creados) tramoId.set(`${etapa}|${t.diaSemana}|${t.orden}`, t.id);
  }

  // ── Asignaciones y sesiones ─────────────────────────────────────────────────
  await borrarAsignaciones(periodoId);

  for (const b of utiles) {
    const clase = b.clase!;
    const etapa = etapaDeCursoHorario(clase.curso) ?? 'OTRA';

    // Una asignación por (materia|actividad + profes + aula) dentro de la clase: las N
    // sesiones semanales de Matemáticas de 2ESO B son UNA asignación puesta N veces, que
    // es justo lo que hace falta para que "quitarle Mates a este profe" sea un solo cambio.
    const clave = (s: (typeof b.sesiones)[number]) =>
      [s.actividadCodigo, s.materiaCodigo ?? '', [...s.profeCodigos].sort().join('+'), s.aulaCodigo ?? ''].join('|');

    const grupos = new Map<string, typeof b.sesiones>();
    for (const s of b.sesiones) grupos.set(clave(s), [...(grupos.get(clave(s)) ?? []), s]);

    for (const [, sesiones] of grupos) {
      const primera = sesiones[0];
      const actividadId = actividadPorCodigo.get(primera.actividadCodigo) ?? idClase;
      const [asig] = await db
        .insert(horAsignaciones)
        .values({
          periodoId,
          academicYear: opciones.academicYear,
          actividadId,
          materiaId: primera.materiaCodigo ? (materiaPorCodigo.get(primera.materiaCodigo) ?? null) : null,
          // La etiqueta guarda el texto de la celda siempre que NO haya materia que pintar,
          // incluido el caso de una materia que no estaba en la leyenda ('Otros', 'AUX'):
          // sin esto la celda caía en el nombre de la actividad y ponía 'Clase', perdiendo
          // lo único que decía el fichero.
          etiqueta:
            primera.materiaCodigo && materiaPorCodigo.has(primera.materiaCodigo)
              ? null
              : primera.crudo.slice(0, 120),
          espacioId: primera.aulaCodigo ? (espacioPorCodigo.get(primera.aulaCodigo) ?? null) : null,
          aula: primera.aulaCodigo,
          origen: 'importado',
        })
        .returning();
      resumen.asignaciones++;

      await db.insert(horAsignacionGrupos).values({ asignacionId: asig.id, curso: clase.curso, letra: clase.letra });

      const alias = [...new Set(primera.profeCodigos)];
      const filasProfe = alias
        .map((a, i) => {
          const id = profePorAlias.get(a);
          if (!id) { if (!resumen.profesNoEncontrados.includes(a)) resumen.profesNoEncontrados.push(a); return null; }
          return { asignacionId: asig.id, eduTeacherId: id, rol: rolDeActividad(primera.actividadCodigo, i), principal: i === 0 };
        })
        .filter((f): f is NonNullable<typeof f> => f !== null);
      if (filasProfe.length) {
        await db.insert(horAsignacionProfes).values(filasProfe);
        resumen.profesVinculados += filasProfe.length;
      }

      const filasSesion = sesiones
        .map((s) => {
          const id = tramoId.get(`${etapa}|${s.dia}|${s.orden}`);
          return id ? { asignacionId: asig.id, tramoId: id, diaSemana: s.dia, orden: s.orden } : null;
        })
        .filter((f): f is NonNullable<typeof f> => f !== null);
      if (filasSesion.length) {
        await db.insert(horSesiones).values(filasSesion);
        resumen.sesiones += filasSesion.length;
      }
    }
  }

  await limpiarMateriasHuerfanas();

  return resumen;
}

/**
 * Borra las materias que no usa nadie. Aparecen al reimportar después de cambiar cómo se
 * unifican: la vieja "Educación Física" se queda a cero cuando sus asignaciones pasan a
 * "Educació Física". Solo se van las que no tienen NI asignaciones NI alias apuntándolas,
 * así que una materia arreglada a mano nunca se pierde.
 */
async function limpiarMateriasHuerfanas(): Promise<void> {
  const materias = await db.select({ id: horMaterias.id }).from(horMaterias);
  if (materias.length === 0) return;
  const usadas = new Set(
    (await db.selectDistinct({ id: horAsignaciones.materiaId }).from(horAsignaciones))
      .map((a) => a.id)
      .filter((id): id is string => !!id),
  );
  const conAlias = new Set(
    (await db.selectDistinct({ id: horAlias.materiaId }).from(horAlias))
      .map((a) => a.id)
      .filter((id): id is string => !!id),
  );
  const sobran = materias.map((m) => m.id).filter((id) => !usadas.has(id) && !conAlias.has(id));
  if (sobran.length) await db.delete(horMaterias).where(inArray(horMaterias.id, sobran));
}

function rolDeActividad(actividad: string, indice: number): string {
  if (actividad === 'apoyo_pt') return 'pt';
  if (actividad === 'apoyo_al') return 'al';
  return indice === 0 ? 'titular' : 'apoyo';
}

/**
 * Crea las materias que falten y devuelve el mapa **código del fichero → id**.
 *
 * El fichero trae un código por curso (`EFI1`, `EFI3`, `EFI5`) y, peor, el mismo nombre en
 * dos idiomas según la clase (`Educación Física` y `Educació Física`, `Religión` y
 * `Religió`, `Tutoría` y `TutorIa`). Sin unificar salen veinte materias donde hay trece.
 * Se juntan con tres señales, en este orden:
 *
 *  1. **La tabla `hor_alias`** (tipo 'materia'), que es el arreglo A MANO y manda sobre
 *     todo: es donde se resuelven los casos que ninguna regla pilla, como `CEA`
 *     ("Crecimiento en Armonía") y `CEH` ("Creixement en harmonia").
 *  2. **La raíz del código**: `EFI1` y `EFI3` son la misma materia.
 *  3. **El nombre normalizado**: `ENG` e `ING` tienen códigos distintos y los dos son
 *     "English".
 *
 * Del grupo resultante se queda el nombre MÁS REPETIDO (a empate, el primero alfabético):
 * es una elección arbitraria entre castellano y valencià, pero determinista, y se puede
 * cambiar luego sin reimportar.
 */
async function asegurarMaterias(bloques: readonly ResultadoBloque[]): Promise<Map<string, string>> {
  // Todos los códigos vistos, con su nombre y su etapa.
  const vistos = new Map<string, { nombre: string; etapa: string | null; veces: number }>();
  for (const b of bloques) {
    const etapa = etapaDeCursoHorario(b.clase?.curso) ?? null;
    for (const [codigo, nombre] of b.leyendas.materias) {
      const previo = vistos.get(codigo);
      if (previo) previo.veces++;
      else vistos.set(codigo, { nombre, etapa, veces: 1 });
    }
  }

  // Union-find sobre los códigos: misma raíz o mismo nombre normalizado → mismo grupo.
  const padre = new Map<string, string>();
  const raiz = (x: string): string => {
    const p = padre.get(x);
    if (!p || p === x) return x;
    const r = raiz(p);
    padre.set(x, r);
    return r;
  };
  const unir = (a: string, b: string) => {
    const ra = raiz(a);
    const rb = raiz(b);
    if (ra !== rb) padre.set(ra, rb);
  };
  for (const c of vistos.keys()) padre.set(c, c);
  const porRaizCodigo = new Map<string, string>();
  const porNombre = new Map<string, string>();
  for (const [codigo, { nombre }] of vistos) {
    const rc = raizMateria(codigo);
    const primeroRaiz = porRaizCodigo.get(rc);
    if (primeroRaiz) unir(codigo, primeroRaiz);
    else porRaizCodigo.set(rc, codigo);
    const nn = normalizarNombreMateria(nombre);
    const primeroNombre = porNombre.get(nn);
    if (primeroNombre) unir(codigo, primeroNombre);
    else porNombre.set(nn, codigo);
  }

  // hor_alias manda: si dos códigos ya apuntan a la misma materia, van juntos.
  const alias = await db.select().from(horAlias).where(eq(horAlias.tipo, 'materia'));
  const materiaPorAlias = new Map<string, string>();
  const codigosPorMateria = new Map<string, string[]>();
  for (const a of alias) {
    if (!a.materiaId) continue;
    materiaPorAlias.set(a.codigoExterno.toUpperCase(), a.materiaId);
    codigosPorMateria.set(a.materiaId, [...(codigosPorMateria.get(a.materiaId) ?? []), a.codigoExterno.toUpperCase()]);
  }
  for (const codigos of codigosPorMateria.values()) {
    const presentes = codigos.filter((c) => vistos.has(c));
    for (let i = 1; i < presentes.length; i++) unir(presentes[0], presentes[i]);
  }

  // Un nombre y una etapa por grupo.
  const grupos = new Map<string, { codigos: string[]; nombre: string; etapa: string | null }>();
  for (const [codigo, info] of vistos) {
    const g = raiz(codigo);
    const actual = grupos.get(g);
    if (!actual) grupos.set(g, { codigos: [codigo], nombre: info.nombre, etapa: info.etapa });
    else actual.codigos.push(codigo);
  }
  for (const [g, datos] of grupos) {
    const cuenta = new Map<string, number>();
    for (const c of datos.codigos) {
      const n = vistos.get(c)!;
      cuenta.set(n.nombre, (cuenta.get(n.nombre) ?? 0) + n.veces);
    }
    datos.nombre = [...cuenta.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))[0][0];
    grupos.set(g, datos);
  }

  const existentes = await db.select().from(horMaterias);
  const porNombreExistente = new Map(existentes.map((m) => [normalizarNombreMateria(m.nombre), m.id]));

  const mapa = new Map<string, string>();
  for (const [, datos] of grupos) {
    // Si algún código del grupo ya tiene alias a una materia, esa es la buena.
    const porAlias = datos.codigos.map((c) => materiaPorAlias.get(c)).find(Boolean);
    let id = porAlias ?? porNombreExistente.get(normalizarNombreMateria(datos.nombre));
    if (!id) {
      const [creada] = await db
        .insert(horMaterias)
        .values({ nombre: datos.nombre, abreviatura: raizMateria(datos.codigos[0]), etapa: datos.etapa })
        .returning();
      id = creada.id;
      porNombreExistente.set(normalizarNombreMateria(datos.nombre), id);
    }
    for (const c of datos.codigos) mapa.set(c, id);
  }
  return mapa;
}

/**
 * Crea los espacios que falten y devuelve el mapa **código del fichero → id**.
 *
 * Mismo problema que con las materias, y misma solución: el fichero llama `POLI` y `Poli2`
 * a **un solo sitio**, el polideportivo. Interesa que sea uno solo, porque saber que a
 * tercera hay dos grupos en el polideportivo es información útil — y no es un choque: allí
 * caben varios (`admiteSolapes`). Se unifican con dos señales:
 *
 *  1. **`hor_alias`** (tipo 'espacio'), el arreglo a mano, que manda sobre todo.
 *  2. **La raíz del código**: `POLI` y `POLI2` comparten raíz una vez quitados los dígitos
 *     del final, igual que `EFI1`/`EFI3` en materias.
 *
 * Cuando llegue secundaria traerá más espacios (laboratorios, aulas de informática…) y
 * entrarán solos; los que haya que juntar o marcar como compartidos se resuelven con una
 * fila de alias o tocando `admite_solapes`, sin cambiar código.
 */
async function asegurarEspacios(bloques: readonly ResultadoBloque[]): Promise<Map<string, string>> {
  const vistos = new Map<string, string>();
  for (const b of bloques) for (const [codigo, nombre] of b.leyendas.aulas) if (!vistos.has(codigo)) vistos.set(codigo, nombre);
  if (vistos.size === 0) return new Map();

  const alias = await db.select().from(horAlias).where(eq(horAlias.tipo, 'espacio'));
  const espaciosPorAlias = new Map<string, string>();
  for (const a of alias) if (a.espacioId) espaciosPorAlias.set(a.codigoExterno.toUpperCase(), a.espacioId);

  const existentes = await db.select().from(horEspacios);
  const porCodigo = new Map(existentes.map((e) => [e.codigo.toUpperCase(), e.id] as const));
  const porRaiz = new Map(existentes.map((e) => [raizMateria(e.codigo), e.id] as const));

  const mapa = new Map<string, string>();
  for (const [codigo, nombre] of vistos) {
    const cod = codigo.toUpperCase();
    const raiz = raizMateria(cod);
    let id = espaciosPorAlias.get(cod) ?? porCodigo.get(cod) ?? porRaiz.get(raiz);
    if (!id) {
      // Se guarda con la RAÍZ como código ('POLI'), no con el que trajo el fichero
      // ('Poli2'), para que el siguiente import lo encuentre venga como venga.
      const [creado] = await db
        .insert(horEspacios)
        .values({ codigo: raiz, nombre: nombre.replace(/\s*\d+\s*$/, '').trim() || nombre })
        .returning();
      id = creado.id;
      porCodigo.set(raiz, id);
      porRaiz.set(raiz, id);
    }
    mapa.set(codigo, id);
  }
  return mapa;
}

async function borrarRejilla(periodoId: string, nombre: string): Promise<void> {
  const previas = await db
    .select({ id: horRejillas.id })
    .from(horRejillas)
    .where(and(eq(horRejillas.periodoId, periodoId), eq(horRejillas.nombre, nombre)));
  if (previas.length === 0) return;
  const ids = previas.map((r) => r.id);
  const tramos = await db.select({ id: horTramos.id }).from(horTramos).where(inArray(horTramos.rejillaId, ids));
  if (tramos.length) {
    await db.delete(horSesiones).where(inArray(horSesiones.tramoId, tramos.map((t) => t.id)));
    await db.delete(horTramos).where(inArray(horTramos.rejillaId, ids));
  }
  await db.delete(horRejillaAmbitos).where(inArray(horRejillaAmbitos.rejillaId, ids));
  await db.delete(horRejillas).where(inArray(horRejillas.id, ids));
}

/** Borra lo IMPORTADO de un periodo; lo creado a mano se respeta (origen 'manual'). */
async function borrarAsignaciones(periodoId: string): Promise<void> {
  const previas = await db
    .select({ id: horAsignaciones.id })
    .from(horAsignaciones)
    .where(and(eq(horAsignaciones.periodoId, periodoId), eq(horAsignaciones.origen, 'importado')));
  if (previas.length === 0) return;
  const ids = previas.map((a) => a.id);
  await db.delete(horSesiones).where(inArray(horSesiones.asignacionId, ids));
  await db.delete(horAsignacionProfes).where(inArray(horAsignacionProfes.asignacionId, ids));
  await db.delete(horAsignacionGrupos).where(inArray(horAsignacionGrupos.asignacionId, ids));
  await db.delete(horAsignaciones).where(inArray(horAsignaciones.id, ids));
}

// ─── Consultas del navegador ──────────────────────────────────────────────────

export interface PeriodoListado {
  id: string;
  nombre: string;
  academicYear: string;
  fechaInicio: string;
  fechaFin: string;
  prioridad: number;
  esOrdinario: boolean;
}

export async function getPeriodos(): Promise<PeriodoListado[]> {
  const filas = await db.select().from(horPeriodos).where(eq(horPeriodos.active, true));
  return filas
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      academicYear: p.academicYear,
      fechaInicio: p.fechaInicio,
      fechaFin: p.fechaFin,
      prioridad: p.prioridad,
      esOrdinario: p.esOrdinario,
    }))
    .sort((a, b) => b.academicYear.localeCompare(a.academicYear) || a.prioridad - b.prioridad);
}

/** El periodo que manda una fecha; si no hay ninguno, el ordinario más reciente. */
export async function getPeriodoVigente(iso = new Date().toISOString().slice(0, 10)): Promise<PeriodoListado | null> {
  const todos = await getPeriodos();
  const vigente = periodoVigente(todos, iso);
  return vigente ?? todos.find((p) => p.esOrdinario) ?? todos[0] ?? null;
}

export interface OpcionesNavegador {
  clases: { curso: string; letra: string | null; etiqueta: string; etapa: string | null }[];
  profes: { id: string; nombre: string; alias: string | null; etapa: string | null }[];
  espacios: { id: string; codigo: string; nombre: string }[];
}

/** Lo que se puede elegir en el navegador, sacado de lo que REALMENTE tiene horario. */
export async function getOpcionesNavegador(periodoId: string): Promise<OpcionesNavegador> {
  const filas = await db
    .select({
      curso: horAsignacionGrupos.curso,
      letra: horAsignacionGrupos.letra,
    })
    .from(horAsignacionGrupos)
    .innerJoin(horAsignaciones, eq(horAsignaciones.id, horAsignacionGrupos.asignacionId))
    .where(eq(horAsignaciones.periodoId, periodoId));

  const vistas = new Map<string, { curso: string; letra: string | null }>();
  for (const f of filas) vistas.set(`${f.curso}|${f.letra ?? ''}`, { curso: f.curso, letra: f.letra });
  const clases = [...vistas.values()]
    .sort(compararClases)
    .map((c) => ({ ...c, etiqueta: nombreClase(c.curso, c.letra), etapa: etapaDeCursoHorario(c.curso) }));

  const conProfes = await db
    .selectDistinct({
      id: eduTeachers.id,
      nombre: eduTeachers.nombre,
      apellido1: eduTeachers.apellido1,
      apellido2: eduTeachers.apellido2,
      alias: eduTeachers.alias,
      etapa: eduTeachers.etapa,
    })
    .from(horAsignacionProfes)
    .innerJoin(horAsignaciones, eq(horAsignaciones.id, horAsignacionProfes.asignacionId))
    .innerJoin(eduTeachers, eq(eduTeachers.id, horAsignacionProfes.eduTeacherId))
    .where(eq(horAsignaciones.periodoId, periodoId));

  const profes = conProfes
    .map((p) => ({
      id: p.id,
      // Un solo apellido: en un selector 'Alejandro Sánchez' identifica igual que
      // 'ALEJANDRO SÁNCHEZ GIL' y cabe el triple de gente en pantalla.
      nombre: nombreProfe(p.nombre, p.apellido1),
      alias: p.alias,
      etapa: p.etapa,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  const conEspacios = await db
    .selectDistinct({ id: horEspacios.id, codigo: horEspacios.codigo, nombre: horEspacios.nombre })
    .from(horEspacios)
    .innerJoin(horAsignaciones, eq(horAsignaciones.espacioId, horEspacios.id))
    .where(eq(horAsignaciones.periodoId, periodoId));

  return { clases, profes, espacios: conEspacios.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')) };
}

export type VistaHorario = 'clase' | 'profe' | 'aula';

/**
 * Todas las celdas de un horario, ya listas para `construirCuadricula()`.
 *
 * Se hace en UNA consulta ancha con los joins y se agrupa en memoria en vez de ir sesión a
 * sesión: son unos cientos de filas por periodo y así el navegador responde de un tirón
 * (Neon cobra por consulta, no por fila).
 */
export async function getCeldas(
  periodoId: string,
  vista: VistaHorario,
  clave: string,
): Promise<CeldaHorario[]> {
  // Las columnas van en una constante y cada vista arma su cadena completa: compartir un
  // builder "base" y encadenarle joins distintos rompe la inferencia de tipos de Drizzle.
  const columnas = {
    sesionId: horSesiones.id,
    dia: horSesiones.diaSemana,
    tramoId: horTramos.id,
    horaInicio: horTramos.horaInicio,
    horaFin: horTramos.horaFin,
    tipoTramo: horTramos.tipo,
    asignacionId: horAsignaciones.id,
    materiaId: horMaterias.id,
    materia: horMaterias.nombre,
    materiaAbreviatura: horMaterias.abreviatura,
    etiqueta: horAsignaciones.etiqueta,
    notas: horAsignaciones.notas,
    actividad: horActividades.codigo,
    actividadNombre: horActividades.nombre,
    lectivaActividad: horActividades.lectiva,
    lectivaAsignacion: horAsignaciones.lectiva,
    espacio: horEspacios.nombre,
    aulaTexto: horAsignaciones.aula,
  };

  interface FilaAncha {
    sesionId: string; dia: number; tramoId: string; horaInicio: string; horaFin: string;
    tipoTramo: string | null; asignacionId: string; materiaId: string | null; materia: string | null;
    materiaAbreviatura: string | null;
    etiqueta: string | null; notas: string | null; actividad: string; actividadNombre: string;
    lectivaActividad: boolean; lectivaAsignacion: boolean | null;
    espacio: string | null; aulaTexto: string | null;
  }

  const conJoins = () =>
    db
      .select(columnas)
      .from(horSesiones)
      .innerJoin(horTramos, eq(horTramos.id, horSesiones.tramoId))
      .innerJoin(horAsignaciones, eq(horAsignaciones.id, horSesiones.asignacionId))
      .innerJoin(horActividades, eq(horActividades.id, horAsignaciones.actividadId))
      .leftJoin(horMaterias, eq(horMaterias.id, horAsignaciones.materiaId))
      .leftJoin(horEspacios, eq(horEspacios.id, horAsignaciones.espacioId));

  let filas: FilaAncha[];
  if (vista === 'clase') {
    const [curso, letra] = clave.split('|');
    filas = await conJoins()
      .innerJoin(horAsignacionGrupos, eq(horAsignacionGrupos.asignacionId, horAsignaciones.id))
      .where(
        and(
          eq(horAsignaciones.periodoId, periodoId),
          eq(horAsignacionGrupos.curso, curso),
          letra ? eq(horAsignacionGrupos.letra, letra) : isNull(horAsignacionGrupos.letra),
        ),
      );
  } else if (vista === 'profe') {
    filas = await conJoins()
      .innerJoin(horAsignacionProfes, eq(horAsignacionProfes.asignacionId, horAsignaciones.id))
      .where(and(eq(horAsignaciones.periodoId, periodoId), eq(horAsignacionProfes.eduTeacherId, clave)));
  } else {
    filas = await conJoins().where(and(eq(horAsignaciones.periodoId, periodoId), eq(horAsignaciones.espacioId, clave)));
  }

  if (filas.length === 0) return [];

  // Profes y grupos de cada asignación, en dos consultas más (no en el join ancho: un
  // producto cartesiano de profes × grupos duplicaría las sesiones).
  const asignacionIds = [...new Set(filas.map((f) => f.asignacionId))];
  const profesFilas = await db
    .select({
      asignacionId: horAsignacionProfes.asignacionId,
      id: eduTeachers.id,
      nombre: eduTeachers.nombre,
      apellido1: eduTeachers.apellido1,
      rol: horAsignacionProfes.rol,
      principal: horAsignacionProfes.principal,
    })
    .from(horAsignacionProfes)
    .innerJoin(eduTeachers, eq(eduTeachers.id, horAsignacionProfes.eduTeacherId))
    .where(inArray(horAsignacionProfes.asignacionId, asignacionIds));
  const gruposFilas = await db
    .select({ asignacionId: horAsignacionGrupos.asignacionId, curso: horAsignacionGrupos.curso, letra: horAsignacionGrupos.letra, subgrupo: horAsignacionGrupos.subgrupo })
    .from(horAsignacionGrupos)
    .where(inArray(horAsignacionGrupos.asignacionId, asignacionIds));

  const profesPor = new Map<string, CeldaHorario['profes']>();
  for (const p of profesFilas) {
    const lista = profesPor.get(p.asignacionId) ?? [];
    lista.push({
      id: p.id,
      nombre: nombreProfe(p.nombre, p.apellido1),
      corto: nombreCorto(p.nombre, p.apellido1),
      rol: p.rol,
      principal: p.principal,
    });
    profesPor.set(p.asignacionId, lista);
  }
  for (const lista of profesPor.values()) lista.sort((a, b) => Number(b.principal) - Number(a.principal));

  const gruposPor = new Map<string, string[]>();
  for (const g of gruposFilas) {
    const lista = gruposPor.get(g.asignacionId) ?? [];
    lista.push(nombreClase(g.curso, g.letra) + (g.subgrupo ? ` · ${g.subgrupo}` : ''));
    gruposPor.set(g.asignacionId, lista);
  }

  return filas.map((f) => {
    const profes = profesPor.get(f.asignacionId) ?? [];
    const grupos = gruposPor.get(f.asignacionId) ?? [];
    // El subtítulo es lo que NO se está mirando: en el horario de una clase interesa quién
    // la da; en el de un profe, a quién se la da; en el de un aula, las dos cosas.
    const enCorto = profes.map((p) => p.corto).join(', ');
    const subtitulo =
      vista === 'clase'
        ? (enCorto || null)
        : vista === 'profe'
          ? (grupos.join(', ') || null)
          : [grupos.join(', '), enCorto].filter(Boolean).join(' · ') || null;
    return {
      sesionId: f.sesionId,
      dia: f.dia,
      tramoId: f.tramoId,
      horaInicio: f.horaInicio,
      horaFin: f.horaFin,
      tipoTramo: (f.tipoTramo ?? 'sesion') as CeldaHorario['tipoTramo'],
      titulo: f.materia ?? f.etiqueta ?? f.actividadNombre,
      subtitulo,
      materiaId: f.materiaId,
      abreviatura: f.materiaAbreviatura,
      actividad: f.actividad,
      actividadNombre: f.actividadNombre,
      lectiva: f.lectivaAsignacion ?? f.lectivaActividad,
      espacio: f.espacio ?? f.aulaTexto,
      profes,
      grupos,
      notas: f.notas,
    };
  });
}

/** Los recreos y comedores de la rejilla de un grupo, para que el hueco se vea aunque esté vacío. */
export async function getTramosNoLectivos(periodoId: string, etapa: string | null): Promise<CeldaHorario[]> {
  if (!etapa) return [];
  const filas = await db
    .select({ id: horTramos.id, dia: horTramos.diaSemana, horaInicio: horTramos.horaInicio, horaFin: horTramos.horaFin, tipo: horTramos.tipo })
    .from(horTramos)
    .innerJoin(horRejillas, eq(horRejillas.id, horTramos.rejillaId))
    .innerJoin(horRejillaAmbitos, eq(horRejillaAmbitos.rejillaId, horRejillas.id))
    .where(and(eq(horRejillas.periodoId, periodoId), eq(horRejillaAmbitos.etapa, etapa)));
  return filas
    .filter((t) => t.tipo !== 'sesion')
    .map((t) => ({
      sesionId: `tramo-${t.id}-${t.dia}`,
      dia: t.dia,
      tramoId: t.id,
      horaInicio: t.horaInicio,
      horaFin: t.horaFin,
      tipoTramo: t.tipo as CeldaHorario['tipoTramo'],
      titulo: t.tipo === 'recreo' ? 'Patio' : 'Comedor',
      subtitulo: null,
      materiaId: null,
      abreviatura: null,
      actividad: t.tipo,
      actividadNombre: t.tipo === 'recreo' ? 'Patio' : 'Comedor',
      lectiva: false,
      espacio: null,
      profes: [],
      grupos: [],
      notas: null,
    }));
}
