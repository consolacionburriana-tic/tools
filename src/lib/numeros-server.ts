// Capa de servidor de «Números del cole»: todo lo que toca Neon. Ficha: docs/24-numeros.md
//
// `recuentosPorClase()` saca TODO en una sola tanda de consultas en paralelo (un viaje a Neon
// son ~127 ms, ver docs/04-convenciones-tecnicas.md), cada una agrupando por clase. Devuelve
// los recuentos completos, sin mirar quién pregunta: el recorte por permisos es `recortar()`
// de `numeros.ts`, que es lo mismo que se aplica al leer una foto del histórico.
import { and, asc, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { licCampaigns, numFotos } from '@/db/schema';
import { academicYearActual } from '@/lib/constants';
import { compararClases, cursoEnBanco, esEtapa, etapaDeCurso, type Etapa } from '@/lib/cursos';
import { nombresDe } from '@/lib/personas';
import { aplicaMaterial } from '@/lib/alumnado';
import { listaMateriales } from '@/lib/materiales-server';
import { alcanceAlumnado } from '@/lib/alumnado-server';
import {
  canAccess,
  veBecasMateriales,
  vePerfilAlumnado,
  type Acceso,
  type Role,
} from '@/lib/permissions';
import {
  enAmbito,
  MARCAS_PERFIL,
  recortar,
  type DatosNumeros,
  type FilaClase,
  type Lista,
  type PermisosNumeros,
  type Valores,
} from '@/lib/numeros';

type Clase = { curso: string; letra: string | null };
const claveClase = (curso: string, letra: string | null) => `${curso}|${letra ?? ''}`;
const n = (x: unknown) => Number(x ?? 0) || 0;

type FilaAlumnado = {
  curso: string;
  letra: string | null;
  alumnos: number;
  chicas: number;
  chicos: number;
  nuevos: number;
  hermanos: number;
  papeles: number;
  papeles_etapa: number;
  banco: number;
  ampa: number;
  pd_si: number;
  pd_no: number;
  pd_null: number;
  pd_correo: number;
  edad_suma: number;
  edad_n: number;
  desde3: number;
  mayores: number;
  extranjeros: number;
  fuera: number;
  numerosa: number;
  empleados: number;
  sin_nia: number;
  sin_dni: number;
  sin_sip: number;
  sin_tel: number;
  sin_google: number;
  con_tutor_personal: number;
};

/**
 * Las MARCAS de cada alumno: una columna sí/no por cada cosa que se cuenta. Es la única
 * definición de cada número: el recuento por clase (`alumnadoPorClase`) cuenta marcas y la
 * lista de «quiénes son» (`quienesSon`) filtra por la misma marca, así que el número y la
 * lista no pueden no cuadrar.
 *
 * - **Papeles por familia**: la familia es `familia_id` (o el propio alumno si no lo tiene) y
 *   el papel se lo lleva el mayor —el de curso más alto; si empatan, el mayor de edad—. Se
 *   marca dos veces: el mayor del cole (`papel_cole`) y el mayor dentro de su etapa
 *   (`papel_etapa`), para cuando el papel es solo para Infantil, Primaria o Secundaria.
 * - **Mayores que su curso**: nacidos antes del año que toca (`anioQueToca` de numeros.ts,
 *   repetido aquí en SQL); **desde los 3 años**: alta en Educamos como tarde el año en que
 *   empezó 3 años (`anioDeEmpezar3`).
 * - **De fuera de Burriana**: localidad del primer familiar; Educamos la escribe de las dos
 *   maneras (BURRIANA y BORRIANA).
 *
 * Del `extra` solo se piden las claves que se cuentan: el jsonb entero pesa (ver convenciones).
 */
function conMarcas(inicio: number, academicYear: string) {
  const desdeNuevos = `${inicio}-07-01`;
  return sql`
    WITH s AS (
      SELECT s.id, s.nombre, s.apellido1, s.apellido2, s.curso, s.letra, s.sexo, s.banco_libros, s.ampa,
        s.pd_imagen, s.pd_redes, s.pd_ampa, s.pd_ong, s.pd_desestima_correo,
        s.nia, s.dni, s.email_google, s.fecha_nacimiento,
        coalesce(nullif(trim(s.tel_emergencia), ''), nullif(trim(s.extra->>'TEL EMERGENCIA ALUMNO'), '')) AS tel,
        nullif(trim(s.extra->>'TARJETA SANITARIA'), '') AS sip,
        CASE WHEN s.extra->>'FECHA ALTA' ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}'
          THEN to_date(substring(s.extra->>'FECHA ALTA' from '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}'), 'DD/MM/YYYY') END AS alta,
        upper(trim(coalesce(s.extra->>'NACIONALIDAD ALUMNO', ''))) AS nac,
        upper(coalesce(s.extra->>'FAM.NUMEROSA', '')) AS fnum,
        upper(coalesce(s.extra->>'ESHIJODEEMPLEADO', '')) AS hemp,
        coalesce(nullif(s.familia_id, ''), s.id::text) AS fam,
        CASE WHEN s.curso ILIKE '%INF%' THEN 0 WHEN s.curso ILIKE '%PRI%' THEN 1
             WHEN s.curso ILIKE '%BAC%' OR s.curso ILIKE '%BAT%' OR s.curso ILIKE '%BTO%' THEN 3 ELSE 2 END AS etapa_n,
        coalesce(substring(s.curso from '[0-9]+')::int, 0) AS nivel
      FROM edu_students s
      WHERE s.active AND s.curso IS NOT NULL
    ), r AS (
      SELECT s.*,
        row_number() OVER (PARTITION BY fam ORDER BY etapa_n DESC, nivel DESC, fecha_nacimiento ASC NULLS LAST, letra, id) AS rn_cole,
        row_number() OVER (PARTITION BY fam, etapa_n ORDER BY nivel DESC, fecha_nacimiento ASC NULLS LAST, letra, id) AS rn_etapa,
        count(*) OVER (PARTITION BY fam) AS hijos,
        CASE etapa_n WHEN 0 THEN ${inicio}::int - nivel WHEN 1 THEN ${inicio}::int - (nivel + 5) WHEN 3 THEN ${inicio}::int - (nivel + 15) ELSE ${inicio}::int - (nivel + 11) END AS anio_toca,
        CASE etapa_n WHEN 0 THEN ${inicio}::int - (nivel - 3) WHEN 1 THEN ${inicio}::int - (nivel + 2) WHEN 3 THEN ${inicio}::int - (nivel + 12) ELSE ${inicio}::int - (nivel + 8) END AS anio_3
      FROM s
    ), loc AS (
      SELECT DISTINCT ON (sg.student_id) sg.student_id, upper(trim(coalesce(g.localidad, ''))) AS localidad
      FROM edu_student_guardians sg JOIN edu_guardians g ON g.id = sg.guardian_id
      ORDER BY sg.student_id, sg.orden NULLS LAST
    ), tut AS (
      SELECT curso, coalesce(letra, '') AS letra, count(*) AS tutores FROM edu_tutorias
      WHERE academic_year = ${academicYear} GROUP BY curso, coalesce(letra, '')
    ), m AS (
      SELECT r.id, r.nombre, r.apellido1, r.apellido2, r.curso, r.letra, r.fecha_nacimiento,
        true AS todos,
        r.sexo = 'F' AS chica,
        r.sexo = 'M' AS chico,
        coalesce(r.alta >= ${desdeNuevos}::date, false) AS nuevo,
        r.hijos > 1 AS con_hermanos,
        r.rn_cole = 1 AS papel_cole,
        r.rn_cole > 1 AS pequeno_cole,
        r.rn_etapa = 1 AS papel_etapa,
        r.rn_etapa > 1 AS pequeno_etapa,
        coalesce(r.banco_libros, false) AS banco,
        NOT coalesce(r.banco_libros, false) AS banco_no,
        coalesce(r.ampa, false) AS ampa,
        coalesce(r.pd_imagen AND r.pd_redes AND r.pd_ampa AND r.pd_ong, false) AS pd_si,
        (r.pd_imagen IS FALSE OR r.pd_redes IS FALSE OR r.pd_ampa IS FALSE OR r.pd_ong IS FALSE) AS pd_no,
        (NOT (r.pd_imagen IS FALSE OR r.pd_redes IS FALSE OR r.pd_ampa IS FALSE OR r.pd_ong IS FALSE)
          AND (r.pd_imagen IS NULL OR r.pd_redes IS NULL OR r.pd_ampa IS NULL OR r.pd_ong IS NULL)) AS pd_null,
        coalesce(r.pd_desestima_correo, false) AS pd_correo,
        (r.alta IS NOT NULL AND extract(year FROM r.alta) <= r.anio_3) AS desde3,
        (r.fecha_nacimiento IS NOT NULL AND extract(year FROM r.fecha_nacimiento) < r.anio_toca) AS mayor,
        (r.nac <> '' AND r.nac NOT IN ('ESPAÑA', 'ESPANA')) AS extranjero,
        (coalesce(l.localidad, '') <> '' AND l.localidad NOT LIKE '%BURRIANA%' AND l.localidad NOT LIKE '%BORRIANA%') AS fuera,
        r.fnum = 'TRUE' AS numerosa,
        r.hemp = 'TRUE' AS empleado,
        coalesce(trim(r.nia), '') = '' AS sin_nia,
        coalesce(trim(r.dni), '') = '' AS sin_dni,
        r.sip IS NULL AS sin_sip,
        r.tel IS NULL AS sin_tel,
        coalesce(trim(r.email_google), '') = '' AS sin_google,
        tp.id IS NOT NULL AS con_tp,
        (coalesce(t.tutores, 0) > 1 AND tp.id IS NULL) AS falta_tp
      FROM r
      LEFT JOIN loc l ON l.student_id = r.id
      LEFT JOIN edu_tutor_personal tp ON tp.edu_student_id = r.id AND tp.academic_year = ${academicYear}
      LEFT JOIN tut t ON t.curso = r.curso AND t.letra = coalesce(r.letra, '')
    )`;
}

/** Las marcas por las que se puede pedir «quiénes son». Lista cerrada: van tal cual al SQL. */
export const MARCAS_ALUMNADO = [
  'todos', 'chica', 'chico', 'nuevo', 'con_hermanos', 'papel_cole', 'pequeno_cole', 'papel_etapa', 'pequeno_etapa',
  'banco', 'banco_no', 'ampa', 'pd_si', 'pd_no', 'pd_null', 'pd_correo', 'desde3', 'mayor', 'extranjero', 'fuera',
  'numerosa', 'empleado', 'sin_nia', 'sin_dni', 'sin_sip', 'sin_tel', 'sin_google', 'falta_tp',
] as const;
export type MarcaAlumnado = (typeof MARCAS_ALUMNADO)[number];

async function alumnadoPorClase(inicio: number, academicYear: string): Promise<FilaAlumnado[]> {
  const r = await db.execute<FilaAlumnado>(sql`
    ${conMarcas(inicio, academicYear)}
    SELECT curso, letra,
      count(*)::int AS alumnos,
      count(*) FILTER (WHERE chica)::int AS chicas,
      count(*) FILTER (WHERE chico)::int AS chicos,
      count(*) FILTER (WHERE nuevo)::int AS nuevos,
      count(*) FILTER (WHERE con_hermanos)::int AS hermanos,
      count(*) FILTER (WHERE papel_cole)::int AS papeles,
      count(*) FILTER (WHERE papel_etapa)::int AS papeles_etapa,
      count(*) FILTER (WHERE banco)::int AS banco,
      count(*) FILTER (WHERE ampa)::int AS ampa,
      count(*) FILTER (WHERE pd_si)::int AS pd_si,
      count(*) FILTER (WHERE pd_no)::int AS pd_no,
      count(*) FILTER (WHERE pd_null)::int AS pd_null,
      count(*) FILTER (WHERE pd_correo)::int AS pd_correo,
      coalesce(sum(extract(epoch FROM age(now(), fecha_nacimiento)) / 31557600.0), 0)::float AS edad_suma,
      count(fecha_nacimiento)::int AS edad_n,
      count(*) FILTER (WHERE desde3)::int AS desde3,
      count(*) FILTER (WHERE mayor)::int AS mayores,
      count(*) FILTER (WHERE extranjero)::int AS extranjeros,
      count(*) FILTER (WHERE fuera)::int AS fuera,
      count(*) FILTER (WHERE numerosa)::int AS numerosa,
      count(*) FILTER (WHERE empleado)::int AS empleados,
      count(*) FILTER (WHERE sin_nia)::int AS sin_nia,
      count(*) FILTER (WHERE sin_dni)::int AS sin_dni,
      count(*) FILTER (WHERE sin_sip)::int AS sin_sip,
      count(*) FILTER (WHERE sin_tel)::int AS sin_tel,
      count(*) FILTER (WHERE sin_google)::int AS sin_google,
      count(*) FILTER (WHERE con_tp)::int AS con_tutor_personal
    FROM m
    GROUP BY curso, letra
  `);
  return r.rows;
}

// La campaña de licencias «actual» es la última creada (como `getCurrentCampaign`); va como
// subconsulta para que las dos consultas de licencias salgan en la misma tanda.
const CAMPANA_ACTUAL = sql`(SELECT id FROM lic_campaigns ORDER BY created_at DESC LIMIT 1)`;

async function licenciasPorClase() {
  const [pedidos, licencias] = await Promise.all([
    db.execute<{
      curso: string;
      letra: string | null;
      alumnos: number;
      pedidos: number;
      faltan: number;
      no_pediran: number;
      importe: number;
      cobrado: number;
    }>(sql`
      SELECT e.curso, e.letra,
        count(*)::int AS alumnos,
        count(o.id)::int AS pedidos,
        count(*) FILTER (WHERE o.id IS NULL AND ls.manual_completed_at IS NULL)::int AS faltan,
        count(*) FILTER (WHERE o.id IS NULL AND ls.manual_completed_at IS NOT NULL)::int AS no_pediran,
        coalesce(sum(o.total_price), 0)::float AS importe,
        coalesce(sum(o.total_price) FILTER (WHERE o.paid_at IS NOT NULL), 0)::float AS cobrado
      FROM lic_students ls
      JOIN edu_students e ON e.id = ls.edu_student_id AND e.active
      LEFT JOIN lic_orders o ON o.student_id = ls.id AND NOT o.archived
      WHERE ls.campaign_id = ${CAMPANA_ACTUAL} AND ls.active
      GROUP BY e.curso, e.letra
    `),
    db.execute<{ curso: string; letra: string | null; licencias: number; enviadas: number }>(sql`
      SELECT e.curso, e.letra,
        count(*)::int AS licencias,
        count(*) FILTER (WHERE l.estado = 'enviado')::int AS enviadas
      FROM lic_licencias l
      JOIN lic_students ls ON ls.id = l.student_id
      JOIN edu_students e ON e.id = ls.edu_student_id AND e.active
      WHERE l.campaign_id = ${CAMPANA_ACTUAL} AND l.descartado_at IS NULL
      GROUP BY e.curso, e.letra
    `),
  ]);
  return { pedidos: pedidos.rows, licencias: licencias.rows };
}

/** Todos los recuentos del cole, por clase, sin recortar. Una sola tanda. */
export async function recuentosPorClase(ahora = new Date()): Promise<DatosNumeros> {
  const academicYear = academicYearActual(ahora);
  const inicio = Number(academicYear.slice(0, 4));

  const [alumnado, tutorias, lotes, materiales, estados, lic, campana, profes] = await Promise.all([
    alumnadoPorClase(inicio, academicYear),
    db.execute<{ curso: string; letra: string | null; tutores: number }>(sql`
      SELECT curso, letra, count(*)::int AS tutores FROM edu_tutorias
      WHERE academic_year = ${academicYear} GROUP BY curso, letra
    `),
    db.execute<{ curso: string; letra: string | null; asignados: number; entregados: number }>(sql`
      SELECT e.curso, e.letra, count(*)::int AS asignados, count(*) FILTER (WHERE a.entregado)::int AS entregados
      FROM bl_asignaciones a JOIN edu_students e ON e.id = a.student_id AND e.active
      WHERE a.academic_year = ${academicYear}
      GROUP BY e.curso, e.letra
    `),
    listaMateriales(academicYear),
    db.execute<{ material_id: string; curso: string; letra: string | null; estado: string; n: number }>(sql`
      SELECT me.material_id, e.curso, e.letra, me.estado, count(*)::int AS n
      FROM mat_estados me
      JOIN mat_materiales m ON m.id = me.material_id AND m.activo AND m.academic_year = ${academicYear}
      JOIN edu_students e ON e.id = me.edu_student_id AND e.active
      WHERE me.estado IS NOT NULL
      GROUP BY me.material_id, e.curso, e.letra, me.estado
    `),
    licenciasPorClase(),
    db
      .select({ nombre: licCampaigns.name, estado: licCampaigns.status })
      .from(licCampaigns)
      .orderBy(desc(licCampaigns.createdAt))
      .limit(1),
    db.execute<{ etapa: string | null; n: number }>(sql`
      SELECT etapa, count(*)::int AS n FROM edu_teachers WHERE active GROUP BY etapa
    `),
  ]);

  const porClase = new Map<string, Map<string, number>>();
  const sumarEn = (curso: string, letra: string | null, clave: string, valor: number) => {
    const m = porClase.get(claveClase(curso, letra));
    if (!m) return; // una clase que no tiene alumnado activo no existe para esta pantalla
    m.set(clave, (m.get(clave) ?? 0) + valor);
  };

  const filas: FilaClase[] = [];
  for (const a of alumnado) {
    const etapa = etapaDeCurso(a.curso);
    if (!etapa) continue;
    const alumnos = n(a.alumnos);
    const banco = n(a.banco);
    const v: Valores = {
      alumnos,
      chicas: n(a.chicas),
      chicos: n(a.chicos),
      nuevos: n(a.nuevos),
      hermanos: n(a.hermanos),
      'fam.papeles': n(a.papeles),
      'fam.papelesEtapa': n(a.papeles_etapa),
      'banco.alumnos': cursoEnBanco(a.curso) ? alumnos : 0,
      'banco.si': cursoEnBanco(a.curso) ? banco : 0,
      'banco.fuera': cursoEnBanco(a.curso) ? 0 : banco,
      ampa: n(a.ampa),
      'pd.todoSi': n(a.pd_si),
      'pd.algunNo': n(a.pd_no),
      'pd.sinConstar': n(a.pd_null),
      'pd.sinCorreo': n(a.pd_correo),
      'perfil.edadSuma': Math.round(n(a.edad_suma) * 100) / 100,
      'perfil.edadN': n(a.edad_n),
      'perfil.desde3': n(a.desde3),
      'perfil.mayores': n(a.mayores),
      'perfil.extranjeros': n(a.extranjeros),
      'perfil.fuera': n(a.fuera),
      'perfil.numerosa': n(a.numerosa),
      'perfil.empleados': n(a.empleados),
      'datos.sinNia': n(a.sin_nia),
      'datos.sinDni': n(a.sin_dni),
      'datos.sinSip': n(a.sin_sip),
      'datos.sinTel': n(a.sin_tel),
      'datos.sinGoogle': n(a.sin_google),
      'tut.conPersonal': n(a.con_tutor_personal),
    };
    filas.push({ curso: a.curso, letra: a.letra, etapa: etapa as Etapa, v });
    porClase.set(claveClase(a.curso, a.letra), new Map(Object.entries(v)));
  }

  for (const t of tutorias.rows) sumarEn(t.curso, t.letra, 'tut.tutores', n(t.tutores));
  for (const l of lotes.rows) {
    sumarEn(l.curso, l.letra, 'lotes.asignados', n(l.asignados));
    sumarEn(l.curso, l.letra, 'lotes.entregados', n(l.entregados));
  }
  const materialesVivos = new Map(materiales.map((m) => [m.id, m]));
  for (const e of estados.rows) {
    const m = materialesVivos.get(e.material_id);
    // Una marca de un alumno al que el material no va no cuenta: la API no la deja poner,
    // pero si cambian los destinos después, la marca vieja se queda en la tabla.
    if (!m || !aplicaMaterial(m.destinos, { curso: e.curso, letra: e.letra })) continue;
    sumarEn(e.curso, e.letra, `mat.${m.id}.${e.estado}`, n(e.n));
  }
  for (const p of lic.pedidos) {
    sumarEn(p.curso, p.letra, 'lic.alumnos', n(p.alumnos));
    sumarEn(p.curso, p.letra, 'lic.pedidos', n(p.pedidos));
    sumarEn(p.curso, p.letra, 'lic.faltan', n(p.faltan));
    sumarEn(p.curso, p.letra, 'lic.noPediran', n(p.no_pediran));
    sumarEn(p.curso, p.letra, 'lic.importe', Math.round(n(p.importe) * 100) / 100);
    sumarEn(p.curso, p.letra, 'lic.cobrado', Math.round(n(p.cobrado) * 100) / 100);
  }
  for (const l of lic.licencias) {
    sumarEn(l.curso, l.letra, 'lic.licencias', n(l.licencias));
    sumarEn(l.curso, l.letra, 'lic.enviadas', n(l.enviadas));
  }

  for (const f of filas) {
    const m = porClase.get(claveClase(f.curso, f.letra))!;
    const v = Object.fromEntries(m) as Valores;
    // Clases con dos (o más) tutores: ahí cada alumno debería tener su tutor personal.
    if ((v['tut.tutores'] ?? 0) > 1) {
      v['tut.dosAlumnos'] = v.alumnos;
      v['tut.faltaPersonal'] = Math.max(0, v.alumnos - (v['tut.conPersonal'] ?? 0));
    }
    for (const mat of materiales) {
      if (aplicaMaterial(mat.destinos, f)) v[`mat.${mat.id}.van`] = v.alumnos;
    }
    // Sin ceros de relleno: lo que no está vale 0 (`g()`), y así la foto pesa menos.
    f.v = Object.fromEntries(Object.entries(v).filter(([, x]) => x !== 0));
  }

  const p = { EI: 0, EP: 0, ESO: 0, BACH: 0, sinEtapa: 0 };
  for (const r of profes.rows) {
    if (esEtapa(r.etapa)) p[r.etapa] += n(r.n);
    else p.sinEtapa += n(r.n);
  }

  return {
    version: 1,
    generadoAt: ahora.toISOString(),
    academicYear,
    filas,
    materiales: materiales.map((m) => ({ id: m.id, nombre: m.nombre, importe: m.importe })),
    campana: campana[0] ? { nombre: campana[0].nombre, estado: campana[0].estado } : null,
    profes: p,
  };
}

// ─── Quién ve qué ─────────────────────────────────────────────────────────────

export interface VistaNumeros {
  /** Clases que alcanza, o `null` = todo el cole. */
  clases: Clase[] | null;
  /** Etapas de un tutor (para el aviso de arriba); vacío si ve todo el cole. */
  etapas: Etapa[];
  permisos: PermisosNumeros;
}

/**
 * El alcance es el de Alumnado (la etapa del tutor; el cole entero para dirección y demás), y
 * dentro, cada pestaña con lo suyo. Licencias: solo quien tiene el módulo —TIC, secretaría y
 * dirección— y con la campaña sin cerrar (decisión 3 de la ficha).
 */
export async function vistaNumeros(
  user: Acceso & { email: string; role: Role | null },
  campana: DatosNumeros['campana'],
): Promise<VistaNumeros> {
  const alcance = await alcanceAlumnado(user, { conPropias: false });
  return {
    clases: alcance.clases,
    etapas: alcance.etapas,
    permisos: {
      // Desde el 28-sep-2026 la protección de datos se ve con el alcance de la ficha (la
      // etapa), como en Alumnado: las clases ya vienen recortadas, así que aquí basta el sí.
      proteccion: true,
      licencias: canAccess(user, 'licencias') && campana !== null && campana.estado !== 'closed',
      perfil: vePerfilAlumnado(user.role),
      becas: veBecasMateriales(user.role),
    },
  };
}

/** Los números de hoy tal y como puede verlos esta persona. */
export async function numerosPara(user: Acceso & { email: string; role: Role | null }) {
  const datos = await recuentosPorClase();
  const vista = await vistaNumeros(user, datos.campana);
  return { datos: recortar(datos, vista), vista };
}

// ─── Fotos del histórico ──────────────────────────────────────────────────────

export interface FotoLista {
  id: string;
  tomadaAt: string;
  origen: string;
  nota: string | null;
}

/**
 * Guarda una foto. La mensual es idempotente: si ya hay una de este mes, no hace otra (el cron
 * puede repetirse sin miedo). La manual siempre se guarda.
 */
export async function guardarFoto(
  origen: 'mensual' | 'manual',
  creadaPor: string,
  nota: string | null = null,
  ahora = new Date(),
): Promise<{ id: string; nueva: boolean }> {
  if (origen === 'mensual') {
    const inicioMes = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1));
    const ya = await db
      .select({ id: numFotos.id })
      .from(numFotos)
      .where(and(eq(numFotos.origen, 'mensual'), gte(numFotos.tomadaAt, inicioMes)))
      .limit(1);
    if (ya[0]) return { id: ya[0].id, nueva: false };
  }
  const datos = await recuentosPorClase(ahora);
  const [fila] = await db
    .insert(numFotos)
    .values({
      tomadaAt: ahora,
      academicYear: datos.academicYear,
      origen,
      nota: nota?.trim() || null,
      version: datos.version,
      datos,
      creadaPor,
    })
    .returning({ id: numFotos.id });
  return { id: fila.id, nueva: true };
}

export async function listaFotos(): Promise<FotoLista[]> {
  const filas = await db
    .select({ id: numFotos.id, tomadaAt: numFotos.tomadaAt, origen: numFotos.origen, nota: numFotos.nota })
    .from(numFotos)
    .orderBy(asc(numFotos.tomadaAt));
  return filas.map((f) => ({ ...f, tomadaAt: f.tomadaAt.toISOString() }));
}

/** Todas las fotos con sus números, ya recortadas para quien mira. */
export async function fotosPara(vista: VistaNumeros): Promise<(FotoLista & { datos: DatosNumeros })[]> {
  const filas = await db
    .select({ id: numFotos.id, tomadaAt: numFotos.tomadaAt, origen: numFotos.origen, nota: numFotos.nota, datos: numFotos.datos })
    .from(numFotos)
    .orderBy(asc(numFotos.tomadaAt));
  return filas.map((f) => ({
    id: f.id,
    tomadaAt: f.tomadaAt.toISOString(),
    origen: f.origen,
    nota: f.nota,
    datos: recortar(f.datos as DatosNumeros, vista),
  }));
}

// ─── Quiénes son ──────────────────────────────────────────────────────────────

export interface AlumnoQuien {
  id: string;
  nombre: string;
  curso: string;
  letra: string | null;
}

type FilaQuien = { id: string; nombre: string | null; apellido1: string | null; apellido2: string | null; curso: string; letra: string | null };

/**
 * La lista detrás de un número: los alumnos de esa fila (`ambito`) con esa marca, dentro de
 * lo que puede ver quien pregunta. `null` = no le toca verla (se contesta 404, como Alumnado).
 */
export async function quienesSon(lista: Lista, ambito: string, vista: VistaNumeros): Promise<AlumnoQuien[] | null> {
  const { permisos } = vista;
  if (lista.tipo === 'a' && lista.marca.startsWith('pd_') && !permisos.proteccion) return null;
  if (lista.tipo === 'a' && MARCAS_PERFIL.includes(lista.marca) && !permisos.perfil) return null;
  if (lista.tipo === 'm' && lista.estado === 'becado' && !permisos.becas) return null;
  if (lista.tipo === 'l' && !permisos.licencias) return null;

  const academicYear = academicYearActual();
  const inicio = Number(academicYear.slice(0, 4));
  let filas: FilaQuien[];

  if (lista.tipo === 'a') {
    // La marca viene de una lista cerrada (`leerLista` con MARCAS_ALUMNADO): es seguro ponerla
    // como identificador.
    if (!(MARCAS_ALUMNADO as readonly string[]).includes(lista.marca)) return null;
    const r = await db.execute<FilaQuien>(sql`
      ${conMarcas(inicio, academicYear)}
      SELECT id, nombre, apellido1, apellido2, curso, letra FROM m WHERE ${sql.identifier(lista.marca)}
    `);
    filas = r.rows.filter((f) => !lista.soloBanco || cursoEnBanco(f.curso));
  } else if (lista.tipo === 'm') {
    const [material] = (await listaMateriales(academicYear)).filter((m) => m.id === lista.materialId);
    if (!material) return [];
    const r = await db.execute<FilaQuien & { estado: string | null }>(sql`
      SELECT s.id, s.nombre, s.apellido1, s.apellido2, s.curso, s.letra, me.estado
      FROM edu_students s
      LEFT JOIN mat_estados me ON me.edu_student_id = s.id AND me.material_id = ${material.id}
      WHERE s.active AND s.curso IS NOT NULL
    `);
    const quiere = (estado: string | null) => {
      if (lista.estado === 'van') return true;
      if (lista.estado === 'sin') return !estado;
      // Quien no ve las becas las tiene sumadas a «pagado»: su lista también.
      if (lista.estado === 'pagado' && !permisos.becas) return estado === 'pagado' || estado === 'becado';
      return estado === lista.estado;
    };
    filas = r.rows.filter((f) => aplicaMaterial(material.destinos, f) && quiere(f.estado));
  } else {
    const cond =
      lista.estado === 'pedidos'
        ? sql`o.id IS NOT NULL`
        : lista.estado === 'faltan'
          ? sql`o.id IS NULL AND ls.manual_completed_at IS NULL`
          : lista.estado === 'nop'
            ? sql`o.id IS NULL AND ls.manual_completed_at IS NOT NULL`
            : sql`true`;
    const r = await db.execute<FilaQuien>(sql`
      SELECT e.id, e.nombre, e.apellido1, e.apellido2, e.curso, e.letra
      FROM lic_students ls
      JOIN edu_students e ON e.id = ls.edu_student_id AND e.active
      LEFT JOIN lic_orders o ON o.student_id = ls.id AND NOT o.archived
      WHERE ls.campaign_id = ${CAMPANA_ACTUAL} AND ls.active AND ${cond}
    `);
    filas = r.rows;
  }

  const dentro = (f: FilaQuien) =>
    vista.clases === null || vista.clases.some((c) => c.curso === f.curso && (c.letra ?? null) === (f.letra ?? null));
  return filas
    .filter((f) => dentro(f) && enAmbito(ambito, f.curso, f.letra))
    .map((f) => ({ id: f.id, nombre: nombresDe(f).usual, curso: f.curso, letra: f.letra }))
    .sort((a, b) => compararClases(a, b) || a.nombre.localeCompare(b.nombre, 'es'));
}
