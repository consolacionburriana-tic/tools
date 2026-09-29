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
import { cursoEnBanco, etapaDeCurso, type Etapa } from '@/lib/cursos';
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
import { recortar, type DatosNumeros, type FilaClase, type PermisosNumeros, type Valores } from '@/lib/numeros';

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
 * Todo lo que sale de `edu_students` en UNA consulta, por clase.
 *
 * - **Papeles por familia**: la familia es `familia_id` (o el propio alumno si no lo tiene) y
 *   el papel se lo lleva el mayor —el de curso más alto; si empatan, el mayor de edad—. Se
 *   cuenta dos veces: el mayor del cole (`rn_cole`) y el mayor dentro de su etapa
 *   (`rn_etapa`), para cuando el papel es solo para Infantil, Primaria o Secundaria.
 * - **Mayores que su curso**: nacidos antes del año que toca (`anioQueToca` de numeros.ts,
 *   repetido aquí en SQL); **desde los 3 años**: alta en Educamos como tarde el año en que
 *   empezó 3 años (`anioDeEmpezar3`).
 * - **De fuera de Burriana**: localidad del primer familiar; Educamos la escribe de las dos
 *   maneras (BURRIANA y BORRIANA).
 *
 * Del `extra` solo se piden las claves que se cuentan: el jsonb entero pesa (ver convenciones).
 */
async function alumnadoPorClase(inicio: number, academicYear: string): Promise<FilaAlumnado[]> {
  const desdeNuevos = `${inicio}-07-01`;
  const r = await db.execute<FilaAlumnado>(sql`
    WITH s AS (
      SELECT s.id, s.curso, s.letra, s.sexo, s.banco_libros, s.ampa,
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
        CASE WHEN s.curso ILIKE '%INF%' THEN 0 WHEN s.curso ILIKE '%PRI%' THEN 1 ELSE 2 END AS etapa_n,
        coalesce(substring(s.curso from '[0-9]+')::int, 0) AS nivel
      FROM edu_students s
      WHERE s.active AND s.curso IS NOT NULL
    ), r AS (
      SELECT s.*,
        row_number() OVER (PARTITION BY fam ORDER BY etapa_n DESC, nivel DESC, fecha_nacimiento ASC NULLS LAST, letra, id) AS rn_cole,
        row_number() OVER (PARTITION BY fam, etapa_n ORDER BY nivel DESC, fecha_nacimiento ASC NULLS LAST, letra, id) AS rn_etapa,
        count(*) OVER (PARTITION BY fam) AS hijos,
        CASE etapa_n WHEN 0 THEN ${inicio}::int - nivel WHEN 1 THEN ${inicio}::int - (nivel + 5) ELSE ${inicio}::int - (nivel + 11) END AS anio_toca,
        CASE etapa_n WHEN 0 THEN ${inicio}::int - (nivel - 3) WHEN 1 THEN ${inicio}::int - (nivel + 2) ELSE ${inicio}::int - (nivel + 8) END AS anio_3
      FROM s
    ), loc AS (
      SELECT DISTINCT ON (sg.student_id) sg.student_id, upper(trim(coalesce(g.localidad, ''))) AS localidad
      FROM edu_student_guardians sg JOIN edu_guardians g ON g.id = sg.guardian_id
      ORDER BY sg.student_id, sg.orden NULLS LAST
    )
    SELECT r.curso, r.letra,
      count(*)::int AS alumnos,
      count(*) FILTER (WHERE r.sexo = 'F')::int AS chicas,
      count(*) FILTER (WHERE r.sexo = 'M')::int AS chicos,
      count(*) FILTER (WHERE r.alta >= ${desdeNuevos}::date)::int AS nuevos,
      count(*) FILTER (WHERE r.hijos > 1)::int AS hermanos,
      count(*) FILTER (WHERE r.rn_cole = 1)::int AS papeles,
      count(*) FILTER (WHERE r.rn_etapa = 1)::int AS papeles_etapa,
      count(*) FILTER (WHERE r.banco_libros)::int AS banco,
      count(*) FILTER (WHERE r.ampa)::int AS ampa,
      count(*) FILTER (WHERE r.pd_imagen AND r.pd_redes AND r.pd_ampa AND r.pd_ong)::int AS pd_si,
      count(*) FILTER (WHERE r.pd_imagen IS FALSE OR r.pd_redes IS FALSE OR r.pd_ampa IS FALSE OR r.pd_ong IS FALSE)::int AS pd_no,
      count(*) FILTER (WHERE NOT (r.pd_imagen IS FALSE OR r.pd_redes IS FALSE OR r.pd_ampa IS FALSE OR r.pd_ong IS FALSE)
        AND (r.pd_imagen IS NULL OR r.pd_redes IS NULL OR r.pd_ampa IS NULL OR r.pd_ong IS NULL))::int AS pd_null,
      count(*) FILTER (WHERE r.pd_desestima_correo)::int AS pd_correo,
      coalesce(sum(extract(epoch FROM age(now(), r.fecha_nacimiento)) / 31557600.0), 0)::float AS edad_suma,
      count(r.fecha_nacimiento)::int AS edad_n,
      count(*) FILTER (WHERE r.alta IS NOT NULL AND extract(year FROM r.alta) <= r.anio_3)::int AS desde3,
      count(*) FILTER (WHERE r.fecha_nacimiento IS NOT NULL AND extract(year FROM r.fecha_nacimiento) < r.anio_toca)::int AS mayores,
      count(*) FILTER (WHERE r.nac <> '' AND r.nac NOT IN ('ESPAÑA', 'ESPANA'))::int AS extranjeros,
      count(*) FILTER (WHERE l.localidad <> '' AND l.localidad NOT LIKE '%BURRIANA%' AND l.localidad NOT LIKE '%BORRIANA%')::int AS fuera,
      count(*) FILTER (WHERE r.fnum = 'TRUE')::int AS numerosa,
      count(*) FILTER (WHERE r.hemp = 'TRUE')::int AS empleados,
      count(*) FILTER (WHERE coalesce(trim(r.nia), '') = '')::int AS sin_nia,
      count(*) FILTER (WHERE coalesce(trim(r.dni), '') = '')::int AS sin_dni,
      count(*) FILTER (WHERE r.sip IS NULL)::int AS sin_sip,
      count(*) FILTER (WHERE r.tel IS NULL)::int AS sin_tel,
      count(*) FILTER (WHERE coalesce(trim(r.email_google), '') = '')::int AS sin_google,
      count(tp.id)::int AS con_tutor_personal
    FROM r
    LEFT JOIN loc l ON l.student_id = r.id
    LEFT JOIN edu_tutor_personal tp ON tp.edu_student_id = r.id AND tp.academic_year = ${academicYear}
    GROUP BY r.curso, r.letra
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

  const p = { EI: 0, EP: 0, ESO: 0, sinEtapa: 0 };
  for (const r of profes.rows) {
    if (r.etapa === 'EI' || r.etapa === 'EP' || r.etapa === 'ESO') p[r.etapa] += n(r.n);
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
