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
import {
  etapaDeCursoHorario,
  nombreCorto,
  nombreProfe,
  periodoVigente,
  rejillaDeGrupo,
  resumirGrupos,
  type CeldaHorario,
} from '@/lib/horarios';
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

/** Filas en trozos: Postgres traga miles por INSERT, pero no conviene abusar del tamaño. */
function trozos<T>(filas: readonly T[], tam = 400): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < filas.length; i += tam) out.push(filas.slice(i, i + tam));
  return out;
}

/** Firma de una rejilla: dos cursos con los mismos tramos comparten rejilla. */
function firmaTramos(tramos: readonly { orden: number; horaInicio: string; horaFin: string; tipo: string }[]): string {
  return tramos.map((t) => `${t.orden}:${t.horaInicio}-${t.horaFin}:${t.tipo}`).join('|');
}

/**
 * Vuelca los bloques ya normalizados de un fichero a la BBDD.
 *
 * Tres cosas que no son obvias y han costado un susto cada una:
 *
 * 1. **Solo se sustituye lo que trae el fichero.** El horario de la ESO se importa aparte
 *    del de infantil y primaria, así que borrar "el periodo entero" dejaba a primaria sin
 *    horario en cuanto se subía el de secundaria. Se borran los grupos y las etapas que
 *    vienen en ESTE fichero, y nada más.
 * 2. **Una rejilla por conjunto de cursos con los mismos tramos**, no una por etapa: en la
 *    ESO, 1º y 2º acaban a las 14:00 y 3º y 4º tienen una franja más. Con una sola rejilla
 *    por etapa, 1º ESO salía con una fila fantasma a las 14:10.
 * 3. **Las sesiones se funden entre clases.** Si la misma materia, con el mismo profe, cae
 *    a la misma hora en 4º ESO A y en 4º ESO B, eso es una optativa conjunta: UNA
 *    asignación con dos grupos ('4ESO'), no dos clases simultáneas.
 *
 * Todo se escribe en INSERTs por lotes con ids generados aquí. Antes iba asignación por
 * asignación (cuatro viajes a Neon cada una) y con las 10 clases de la ESO se pasaba de los
 * 60 s de la función: la petición moría, el navegador recibía un HTML de timeout y el
 * `res.json()` del cliente reventaba con un error que no decía nada.
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

  // ── Rejillas: una por conjunto de cursos con los mismos tramos ──────────────
  // La plantilla de cada CURSO es su bloque con más filas de horas: dos clases del mismo
  // curso comparten rejilla, y si una trae menos filas es que ese día se le acababa antes.
  const plantillaPorCurso = new Map<string, ResultadoBloque['tramos']>();
  for (const b of utiles) {
    const previa = plantillaPorCurso.get(b.clase!.curso);
    if (!previa || b.tramos.length > previa.length) plantillaPorCurso.set(b.clase!.curso, b.tramos);
  }

  const cursosPorEtapa = new Map<string, string[]>();
  for (const curso of plantillaPorCurso.keys()) {
    const etapa = etapaDeCursoHorario(curso) ?? 'OTRA';
    cursosPorEtapa.set(etapa, [...(cursosPorEtapa.get(etapa) ?? []), curso]);
  }

  await borrarRejillasDeEtapas(periodoId, [...cursosPorEtapa.keys()]);

  const tramoId = new Map<string, string>(); // `${curso}|${dia}|${orden}` → id
  const filasRejilla: (typeof horRejillas.$inferInsert)[] = [];
  const filasAmbito: (typeof horRejillaAmbitos.$inferInsert)[] = [];
  const filasTramo: (typeof horTramos.$inferInsert)[] = [];

  for (const [etapa, cursos] of cursosPorEtapa) {
    const porFirma = new Map<string, string[]>();
    for (const curso of cursos) {
      const f = firmaTramos(plantillaPorCurso.get(curso)!);
      porFirma.set(f, [...(porFirma.get(f) ?? []), curso]);
    }
    const varias = porFirma.size > 1;

    for (const suyos of porFirma.values()) {
      const cursosOrden = [...suyos].sort((a, b) => compararClases({ curso: a, letra: null }, { curso: b, letra: null }));
      const rejillaId = crypto.randomUUID();
      filasRejilla.push({
        id: rejillaId,
        periodoId,
        nombre: varias ? `${opciones.periodoNombre} · ${etapa} · ${cursosOrden.join('/')}` : `${opciones.periodoNombre} · ${etapa}`,
      });
      // Con una sola rejilla el ámbito es la etapa (el caso normal); cuando hay varias, cada
      // una se ata a sus cursos, que es más específico y gana en `rejillaDeGrupo()`.
      if (varias) for (const curso of cursosOrden) filasAmbito.push({ rejillaId, etapa, curso });
      else filasAmbito.push({ rejillaId, etapa });

      const plantilla = plantillaPorCurso.get(cursosOrden[0])!;
      for (const dia of [1, 2, 3, 4, 5]) {
        for (const t of plantilla) {
          const id = crypto.randomUUID();
          filasTramo.push({
            id,
            rejillaId,
            diaSemana: dia,
            orden: t.orden,
            etiqueta: t.tipo === 'sesion' ? `${t.orden}ª` : t.tipo === 'recreo' ? 'Patio' : 'Comedor',
            horaInicio: t.horaInicio,
            horaFin: t.horaFin,
            tipo: t.tipo,
          });
          for (const curso of cursosOrden) tramoId.set(`${curso}|${dia}|${t.orden}`, id);
        }
      }
    }
  }

  for (const t of trozos(filasRejilla)) await db.insert(horRejillas).values(t);
  for (const t of trozos(filasAmbito)) await db.insert(horRejillaAmbitos).values(t);
  for (const t of trozos(filasTramo)) await db.insert(horTramos).values(t);
  resumen.rejillas = filasRejilla.length;
  resumen.tramos = filasTramo.length;

  // ── Sesiones reales: lo que de verdad pasa a cada hora ──────────────────────
  // Misma materia + mismo profe + misma hora en dos clases del mismo curso = UNA sesión con
  // dos grupos (la optativa que comparten 4º A y 4º B), no dos. La regla es segura porque un
  // profe no puede estar en dos sitios a la vez: si coincide, es que es la misma clase.
  // Las que no llevan profe (un 'PT-' suelto) no se funden nunca: no identifican a nadie.
  interface SesionReal {
    curso: string;
    dia: number;
    orden: number;
    actividadCodigo: string;
    materiaCodigo: string | null;
    materiaId: string | null;
    aulaCodigo: string | null;
    profeCodigos: string[];
    crudo: string;
    grupos: Map<string, { curso: string; letra: string | null }>;
  }

  // Rescate de códigos que el fichero usa pero no define: si a esa hora ese mismo profe
  // está dando una materia conocida en otra clase, es esa. Con esto entra bien el 'NG -
  // MREM0' del fichero real de la ESO, que es un 'ING' al que Educamos se comió la I.
  const materiaPorHueco = new Map<string, Set<string>>();
  for (const b of utiles) {
    for (const s of b.sesiones) {
      const id = s.materiaCodigo ? materiaPorCodigo.get(s.materiaCodigo) : undefined;
      if (!id) continue;
      for (const p of s.profeCodigos) {
        const k = `${s.dia}|${s.orden}|${p.toUpperCase()}`;
        materiaPorHueco.set(k, (materiaPorHueco.get(k) ?? new Set()).add(id));
      }
    }
  }
  const rescatarMateria = (s: { dia: number; orden: number; profeCodigos: string[] }): string | null => {
    const candidatas = new Set<string>();
    for (const p of s.profeCodigos) for (const id of materiaPorHueco.get(`${s.dia}|${s.orden}|${p.toUpperCase()}`) ?? []) candidatas.add(id);
    return candidatas.size === 1 ? [...candidatas][0] : null; // en la duda, no se inventa
  };

  const reales = new Map<string, SesionReal>();
  for (const b of utiles) {
    const clase = b.clase!;
    const claveClase = `${clase.curso}|${clase.letra ?? ''}`;
    for (const s of b.sesiones) {
      const materiaId = s.materiaCodigo
        ? (materiaPorCodigo.get(s.materiaCodigo) ?? rescatarMateria(s))
        : null;
      const profeCodigos = [...new Set(s.profeCodigos)].sort();
      const clave = profeCodigos.length
        ? ['·', clase.curso, s.dia, s.orden, s.actividadCodigo, materiaId ?? s.materiaCodigo ?? '', profeCodigos.join('+')].join('|')
        : ['×', claveClase, s.dia, s.orden, s.actividadCodigo, s.crudo].join('|');
      const previa = reales.get(clave);
      if (previa) {
        previa.grupos.set(claveClase, { curso: clase.curso, letra: clase.letra });
        previa.aulaCodigo ??= s.aulaCodigo;
        continue;
      }
      reales.set(clave, {
        curso: clase.curso,
        dia: s.dia,
        orden: s.orden,
        actividadCodigo: s.actividadCodigo,
        materiaCodigo: s.materiaCodigo,
        materiaId,
        aulaCodigo: s.aulaCodigo,
        profeCodigos,
        crudo: s.crudo,
        grupos: new Map([[claveClase, { curso: clase.curso, letra: clase.letra }]]),
      });
    }
  }

  // ── Asignaciones: las N sesiones semanales de lo mismo, juntas ──────────────
  // Una asignación por (actividad + materia + profes + aula + grupos). Las cuatro horas de
  // Mates de 2ESO B son UNA asignación puesta cuatro veces, que es lo que hace falta para
  // que "quitarle Mates a este profe" sea un solo cambio.
  interface Asignacion {
    id: string;
    real: SesionReal;
    grupos: { curso: string; letra: string | null }[];
    sesiones: { dia: number; orden: number }[];
  }
  const asignaciones = new Map<string, Asignacion>();
  for (const r of reales.values()) {
    const grupos = [...r.grupos.values()].sort(compararClases);
    const clave = [
      r.actividadCodigo,
      r.materiaId ?? r.materiaCodigo ?? '',
      r.profeCodigos.join('+'),
      r.aulaCodigo ?? '',
      grupos.map((g) => `${g.curso}|${g.letra ?? ''}`).join(','),
      // Sin materia el texto de la celda ES la identidad ('PT- MAPI' y 'AL 5º y 6º' no son
      // lo mismo aunque las dos sean apoyo sin profe reconocido).
      r.materiaId ? '' : r.crudo,
    ].join('#');
    const previa = asignaciones.get(clave);
    if (previa) previa.sesiones.push({ dia: r.dia, orden: r.orden });
    else asignaciones.set(clave, { id: crypto.randomUUID(), real: r, grupos, sesiones: [{ dia: r.dia, orden: r.orden }] });
  }

  await borrarAsignaciones(periodoId, [...new Set([...reales.values()].flatMap((r) => [...r.grupos.keys()]))]);

  const filasAsig: (typeof horAsignaciones.$inferInsert)[] = [];
  const filasGrupo: (typeof horAsignacionGrupos.$inferInsert)[] = [];
  const filasProfe: (typeof horAsignacionProfes.$inferInsert)[] = [];
  const filasSesion: (typeof horSesiones.$inferInsert)[] = [];

  for (const a of asignaciones.values()) {
    const r = a.real;
    filasAsig.push({
      id: a.id,
      periodoId,
      academicYear: opciones.academicYear,
      actividadId: actividadPorCodigo.get(r.actividadCodigo) ?? idClase,
      materiaId: r.materiaId,
      // La etiqueta guarda el texto de la celda siempre que NO haya materia que pintar,
      // incluido el caso de una materia que no estaba en la leyenda ('Otros', 'AUX'): sin
      // esto la celda caía en el nombre de la actividad y ponía 'Clase', perdiendo lo único
      // que decía el fichero.
      etiqueta: r.materiaId ? null : r.crudo.slice(0, 120),
      espacioId: r.aulaCodigo ? (espacioPorCodigo.get(r.aulaCodigo) ?? null) : null,
      aula: r.aulaCodigo,
      origen: 'importado',
    });
    for (const g of a.grupos) filasGrupo.push({ asignacionId: a.id, curso: g.curso, letra: g.letra });
    r.profeCodigos.forEach((alias, i) => {
      const id = profePorAlias.get(alias);
      if (!id) {
        if (!resumen.profesNoEncontrados.includes(alias)) resumen.profesNoEncontrados.push(alias);
        return;
      }
      filasProfe.push({ asignacionId: a.id, eduTeacherId: id, rol: rolDeActividad(r.actividadCodigo, i), principal: i === 0 });
    });
    for (const s of a.sesiones) {
      const id = tramoId.get(`${r.curso}|${s.dia}|${s.orden}`);
      if (id) filasSesion.push({ asignacionId: a.id, tramoId: id, diaSemana: s.dia, orden: s.orden });
    }
  }

  for (const t of trozos(filasAsig)) await db.insert(horAsignaciones).values(t);
  for (const t of trozos(filasGrupo)) await db.insert(horAsignacionGrupos).values(t);
  for (const t of trozos(filasProfe)) await db.insert(horAsignacionProfes).values(t);
  for (const t of trozos(filasSesion)) await db.insert(horSesiones).values(t);
  resumen.asignaciones = filasAsig.length;
  resumen.profesVinculados = filasProfe.length;
  resumen.sesiones = filasSesion.length;

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

/**
 * Borra las rejillas de un periodo que son de LAS ETAPAS que trae el fichero.
 *
 * Por etapa y no por nombre: la rejilla de la ESO se llamaba de una forma cuando había una
 * sola por etapa y de otra desde que 1º/2º y 3º/4º tienen tramos distintos, y una rejilla
 * vieja que sobreviva al import deja tramos huérfanos por medio. Lo de otras etapas ni se
 * mira: importar secundaria no puede tocar el horario de primaria.
 */
async function borrarRejillasDeEtapas(periodoId: string, etapas: readonly string[]): Promise<void> {
  if (etapas.length === 0) return;
  const previas = await db
    .selectDistinct({ id: horRejillas.id })
    .from(horRejillas)
    .innerJoin(horRejillaAmbitos, eq(horRejillaAmbitos.rejillaId, horRejillas.id))
    .where(and(eq(horRejillas.periodoId, periodoId), inArray(horRejillaAmbitos.etapa, [...etapas])));
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

/**
 * Borra lo IMPORTADO de **los grupos que trae el fichero** dentro de un periodo. Lo creado a
 * mano se respeta (origen 'manual') y lo de los demás grupos, también: cada etapa se importa
 * de su propio fichero, y borrar el periodo entero era lo que hacía desaparecer el horario de
 * primaria en cuanto se subía el de la ESO.
 */
async function borrarAsignaciones(periodoId: string, clavesGrupo: readonly string[]): Promise<void> {
  if (clavesGrupo.length === 0) return;
  const enFichero = new Set(clavesGrupo);
  const candidatas = await db
    .select({ id: horAsignaciones.id, curso: horAsignacionGrupos.curso, letra: horAsignacionGrupos.letra })
    .from(horAsignaciones)
    .innerJoin(horAsignacionGrupos, eq(horAsignacionGrupos.asignacionId, horAsignaciones.id))
    .where(and(eq(horAsignaciones.periodoId, periodoId), eq(horAsignaciones.origen, 'importado')));
  const ids = [
    ...new Set(candidatas.filter((a) => enFichero.has(`${a.curso}|${a.letra ?? ''}`)).map((a) => a.id)),
  ];
  if (ids.length === 0) return;
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
  const crudosPor = new Map<string, { curso: string; letra: string | null; subgrupo: string | null }[]>();
  for (const g of gruposFilas) {
    crudosPor.set(g.asignacionId, [...(crudosPor.get(g.asignacionId) ?? []), { curso: g.curso, letra: g.letra, subgrupo: g.subgrupo }]);
  }
  // Una optativa de 4º A + 4º B se llama '4ESO', no '4ESO A, 4ESO B' (ver `resumirGrupos`).
  for (const [id, crudos] of crudosPor) gruposPor.set(id, resumirGrupos([...crudos].sort(compararClases)));

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

/**
 * Los recreos y comedores de la rejilla de un grupo, para que el hueco se vea aunque esté
 * vacío.
 *
 * Se resuelve por **ámbito**, no por etapa a secas: en la ESO, 1º y 2º tienen una rejilla y
 * 3º y 4º otra con una franja más, y coger las dos ponía a 1º un patio fantasma a las 14:00.
 */
export async function getTramosNoLectivos(
  periodoId: string,
  grupo: { curso: string | null; letra?: string | null },
): Promise<CeldaHorario[]> {
  if (!grupo.curso) return [];
  const ambitos = await db
    .select({ rejillaId: horRejillaAmbitos.rejillaId, etapa: horRejillaAmbitos.etapa, curso: horRejillaAmbitos.curso, letra: horRejillaAmbitos.letra })
    .from(horRejillaAmbitos)
    .innerJoin(horRejillas, eq(horRejillas.id, horRejillaAmbitos.rejillaId))
    .where(eq(horRejillas.periodoId, periodoId));
  const rejillaId = rejillaDeGrupo(ambitos, grupo);
  if (!rejillaId) return [];

  const filas = await db
    .select({ id: horTramos.id, dia: horTramos.diaSemana, horaInicio: horTramos.horaInicio, horaFin: horTramos.horaFin, tipo: horTramos.tipo })
    .from(horTramos)
    .where(eq(horTramos.rejillaId, rejillaId));
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
