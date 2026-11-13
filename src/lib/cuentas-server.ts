// Correos y grupos · lo que toca Neon y orquesta Google. Ficha: docs/30-cuentas.md
//
// La pantalla se pinta desde la foto que hay en Neon: es rápido y secretaría la ve sin tocar
// Google. «Leer de Google» rehace la foto entera y cada acción actualiza las filas que toca.
//
// Antes de cada acción se vuelve a hacer el cruce con Educamos aquí, en el servidor: el
// navegador manda ids, y a dónde va cada cuenta (su clase, el archivo) lo decide el cruce.
// Todo lo que se hace queda en `cue_registro`, firmado.
import { and, desc, eq, inArray, lt, notInArray, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { db } from '@/db';
import {
  cfgAjustes,
  cueGrupos,
  cueMarcas,
  cueRegistro,
  cueUnidades,
  cueUsuarios,
  eduStudents,
  eduTeachers,
  eduTutorias,
} from '@/db/schema';
import { COLEGIO } from '@/lib/colegio';
import { academicYearActual } from '@/lib/constants';
import {
  ajustesCuentasSchema,
  ajustesEfectivos,
  conAscendientes,
  cruzar,
  describirFuente,
  generarContrasena,
  leerAjustesCuentas,
  leerReglas,
  miembrosDeseados,
  motivoCorreoNoValido,
  motivoGrupoBloqueado,
  planGrupo,
  uoArchivo,
  uoDentroDe,
  type AjustePropuesto,
  type AjustesCuentas,
  type AlumnoCruce,
  type CruceCuentas,
  type CuentaGoogle,
  type DatosGrupos,
  type FilaCuenta,
  type MarcaCuenta,
  type PeticionCrear,
  type PlanGrupo,
  type ProfeCruce,
  type ReglasGrupo,
  type TipoMarca,
} from '@/lib/cuentas';
import {
  anadirMiembro,
  cambiarCuenta,
  crearCuenta,
  crearGrupo,
  crearUnidad,
  leerCuentas,
  leerGrupos,
  leerMiembros,
  gruposDeMiembro,
  leerUnidades,
  quitarMiembro,
  type CambiosCuenta,
} from '@/lib/cuentas-google';
import { esEtapa, type Etapa } from '@/lib/cursos';
import { enParalelo, explicarError } from '@/lib/google-sa';
import { listarCoberturasBaja } from '@/lib/coberturas-baja-server';
import { hoyISO } from '@/lib/tableros';

const AJUSTES_CLAVE = 'cuentas';
/** Llamadas a Google a la vez en las tandas: holgado frente a la cuota de Directory. */
const A_LA_VEZ = 4;

// ─── Cargar y cruzar ──────────────────────────────────────────────────────────

export interface UnidadFila {
  ruta: string;
  nombre: string;
  /** Cuentas que están justo en esa unidad (sin contar las de dentro). */
  cuentas: number;
  activas: number;
  deGoogle: boolean;
}

export interface GrupoFila {
  email: string;
  googleId: string | null;
  nombre: string | null;
  descripcion: string | null;
  miembros: number | null;
  gestionado: boolean;
  reglas: ReglasGrupo;
  fuentes: string[];
  ultimaSyncAt: string | null;
  ultimaSyncPor: string | null;
  ultimaSync: { anadidos: number; quitados: number; errores: number } | null;
  /** Salió en la última lectura de Google. */
  enGoogle: boolean;
}

export interface EstadoCuentas {
  cruce: CruceCuentas;
  /** Los ajustes con lo propuesto rellenado (lo que usa el cruce). */
  ajustes: AjustesCuentas;
  /** Tal y como están guardados. */
  guardados: AjustesCuentas;
  propuestos: AjustePropuesto[];
  unidades: UnidadFila[];
  /** Las unidades se han leído de Google (si no, se deducen de las cuentas y faltan las vacías). */
  unidadesDeGoogle: boolean;
  grupos: GrupoFila[];
  /** Coberturas por baja vigentes hoy: para sugerir meter al sustituto en los grupos del titular. */
  coberturasBaja: { id: string; sustituto: string; titular: string }[];
  leidoAt: string | null;
  dominio: string;
}

interface Cargado {
  cuentas: CuentaGoogle[];
  rutas: string[];
  alumnos: AlumnoCruce[];
  profes: ProfeCruce[];
  marcas: MarcaCuenta[];
  guardados: AjustesCuentas;
  grupos: (typeof cueGrupos.$inferSelect)[];
  unidades: (typeof cueUnidades.$inferSelect)[];
  /** La última vez que se leyó Google (la fila más reciente de la foto). */
  leidoAt: string | null;
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

async function cargar(): Promise<Cargado> {
  const [usuarios, unidades, alumnos, profes, marcas, ajustes, grupos, ultima] = await Promise.all([
    db.select().from(cueUsuarios),
    db.select().from(cueUnidades),
    db
      .select({
        id: eduStudents.id,
        nombre: eduStudents.nombre,
        apellido1: eduStudents.apellido1,
        apellido2: eduStudents.apellido2,
        curso: eduStudents.curso,
        letra: eduStudents.letra,
        emailGoogle: eduStudents.emailGoogle,
        email: eduStudents.email,
        active: eduStudents.active,
        lastSyncedAt: eduStudents.lastSyncedAt,
        updatedAt: eduStudents.updatedAt,
        desestima: eduStudents.pdDesestimaCorreo,
      })
      .from(eduStudents),
    db
      .select({
        id: eduTeachers.id,
        nombre: eduTeachers.nombre,
        apellido1: eduTeachers.apellido1,
        apellido2: eduTeachers.apellido2,
        email: eduTeachers.email,
        emailOtro: eduTeachers.emailOtro,
        active: eduTeachers.active,
        fechaBaja: eduTeachers.fechaBaja,
        etapa: eduTeachers.etapa,
        etapas: eduTeachers.etapas,
        nombreMostrado: eduTeachers.nombreMostrado,
      })
      .from(eduTeachers),
    db.select().from(cueMarcas),
    db.select({ valor: cfgAjustes.valor }).from(cfgAjustes).where(eq(cfgAjustes.clave, AJUSTES_CLAVE)),
    db.select().from(cueGrupos),
    db.select({ at: sql<string | null>`max(${cueUsuarios.vistoAt})` }).from(cueUsuarios),
  ]);

  const cuentas: CuentaGoogle[] = usuarios.map((u) => ({
    id: u.googleId,
    email: u.email,
    alias: u.alias ?? [],
    nombre: u.nombre,
    apellidos: u.apellidos,
    uo: u.uo,
    suspendida: u.suspendida,
    archivada: u.archivada,
    admin: u.admin,
    creadaAt: iso(u.creadaAt),
    ultimoAccesoAt: iso(u.ultimoAccesoAt),
  }));
  return {
    cuentas,
    rutas: conAscendientes([...unidades.map((u) => u.ruta), ...cuentas.map((c) => c.uo)]),
    alumnos: alumnos.map((a) => ({
      id: a.id,
      nombre: a.nombre,
      apellido1: a.apellido1,
      apellido2: a.apellido2,
      curso: a.curso,
      letra: a.letra,
      emailGoogle: a.emailGoogle,
      email: a.email,
      activo: a.active,
      // La última sincronización en la que salía; si no la hay, cuándo se tocó su ficha.
      salidaAt: iso(a.lastSyncedAt ?? a.updatedAt),
      desestimaCorreo: a.desestima,
    })),
    profes: profes.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      apellido1: p.apellido1,
      apellido2: p.apellido2,
      email: p.email,
      emailOtro: p.emailOtro,
      activo: p.active,
      fechaBaja: p.fechaBaja,
      nombreMostrado: p.nombreMostrado,
      etapas: [...new Set([p.etapa, ...(p.etapas ?? [])].filter((e): e is Etapa => esEtapa(e)))],
    })),
    marcas: marcas.map((m) => ({ googleId: m.googleId, tipo: m.tipo as TipoMarca, nota: m.nota, por: m.por, at: m.at.toISOString() })),
    guardados: leerAjustesCuentas(ajustes[0]?.valor),
    grupos,
    unidades,
    leidoAt: ultima[0]?.at ? new Date(ultima[0].at).toISOString() : null,
  };
}

function cruzarCargado(c: Cargado, hoy = new Date()): { cruce: CruceCuentas; ajustes: AjustesCuentas; propuestos: AjustePropuesto[] } {
  const { ajustes, propuestos } = ajustesEfectivos(c.guardados, c.rutas);
  const cruce = cruzar({
    cuentas: c.cuentas,
    rutas: c.rutas,
    alumnos: c.alumnos,
    profes: c.profes,
    marcas: c.marcas,
    ajustes,
    dominio: COLEGIO.dominio,
    hoy,
  });
  return { cruce, ajustes, propuestos };
}

function aGrupoFila(g: typeof cueGrupos.$inferSelect): GrupoFila {
  const reglas = leerReglas(g.reglas);
  return {
    email: g.email,
    googleId: g.googleId,
    nombre: g.nombre,
    descripcion: g.descripcion,
    miembros: g.miembros,
    gestionado: g.gestionado,
    reglas,
    fuentes: reglas.fuentes.map(describirFuente),
    ultimaSyncAt: iso(g.ultimaSyncAt),
    ultimaSyncPor: g.ultimaSyncPor,
    ultimaSync: g.ultimaSync ?? null,
    enGoogle: g.vistoAt !== null,
  };
}

/** Todo lo que pinta la pantalla, en una tanda de consultas. */
export async function estadoCuentas(hoy = new Date()): Promise<EstadoCuentas> {
  const [c, sustituciones] = await Promise.all([cargar(), listarCoberturasBaja(hoyISO(hoy))]);
  const { cruce, ajustes, propuestos } = cruzarCargado(c, hoy);
  const porRuta = new Map<string, { cuentas: number; activas: number }>();
  for (const cu of c.cuentas) {
    const v = porRuta.get(cu.uo) ?? { cuentas: 0, activas: 0 };
    v.cuentas++;
    if (!cu.suspendida && !cu.archivada) v.activas++;
    porRuta.set(cu.uo, v);
  }
  const deGoogle = new Set(c.unidades.filter((u) => u.origen === 'google').map((u) => u.ruta));
  const unidades: UnidadFila[] = ['/', ...c.rutas].map((ruta) => ({
    ruta,
    nombre: ruta === '/' ? 'Raíz del dominio' : (ruta.split('/').at(-1) ?? ruta),
    cuentas: porRuta.get(ruta)?.cuentas ?? 0,
    activas: porRuta.get(ruta)?.activas ?? 0,
    deGoogle: ruta === '/' || deGoogle.has(ruta),
  }));
  return {
    cruce,
    ajustes,
    guardados: c.guardados,
    propuestos,
    unidades,
    unidadesDeGoogle: deGoogle.size > 0,
    grupos: c.grupos.map(aGrupoFila).sort((a, b) => Number(b.gestionado) - Number(a.gestionado) || a.email.localeCompare(b.email)),
    coberturasBaja: sustituciones
      .filter((x) => x.estado === 'vigente')
      .map((x) => ({ id: x.id, sustituto: x.sustitutoNombre, titular: x.titularNombre })),
    leidoAt: c.leidoAt,
    dominio: COLEGIO.dominio,
  };
}

// ─── Leer de Google ───────────────────────────────────────────────────────────

function filaUsuario(c: CuentaGoogle, ahora: Date): typeof cueUsuarios.$inferInsert {
  return {
    googleId: c.id,
    email: c.email,
    alias: c.alias,
    nombre: c.nombre,
    apellidos: c.apellidos,
    uo: c.uo,
    suspendida: c.suspendida,
    archivada: c.archivada,
    admin: c.admin,
    creadaAt: c.creadaAt ? new Date(c.creadaAt) : null,
    ultimoAccesoAt: c.ultimoAccesoAt ? new Date(c.ultimoAccesoAt) : null,
    vistoAt: ahora,
  };
}

const SET_USUARIO = {
  email: sql`excluded.email`,
  alias: sql`excluded.alias`,
  nombre: sql`excluded.nombre`,
  apellidos: sql`excluded.apellidos`,
  uo: sql`excluded.uo`,
  suspendida: sql`excluded.suspendida`,
  archivada: sql`excluded.archivada`,
  admin: sql`excluded.admin`,
  creadaAt: sql`excluded.creada_at`,
  ultimoAccesoAt: sql`excluded.ultimo_acceso_at`,
  vistoAt: sql`excluded.visto_at`,
};

/** Actualiza (o mete) la foto de unas cuentas: lo que devuelve Google tras cada acción. */
async function guardarCuentas(cuentas: CuentaGoogle[], ahora = new Date()): Promise<void> {
  for (let i = 0; i < cuentas.length; i += 400) {
    await db
      .insert(cueUsuarios)
      .values(cuentas.slice(i, i + 400).map((c) => filaUsuario(c, ahora)))
      .onConflictDoUpdate({ target: cueUsuarios.googleId, set: SET_USUARIO });
  }
}

/**
 * Rehace la foto: cuentas (siempre), unidades y grupos (si sus scopes están delegados). Lo que
 * no se puede leer se dice en `avisos` y no rompe lo demás. Sin el scope de unidades, se
 * deducen de dónde están las cuentas.
 */
export async function leerDeGoogle(admin: string): Promise<{ avisos: string[]; cuentas: number }> {
  const inicio = new Date();
  const [cuentasR, unidadesR, gruposR] = await Promise.allSettled([leerCuentas(admin), leerUnidades(admin), leerGrupos(admin)]);
  if (cuentasR.status === 'rejected') throw cuentasR.reason;
  const avisos: string[] = [];
  const cuentas = cuentasR.value;

  await guardarCuentas(cuentas, inicio);
  await db.delete(cueUsuarios).where(lt(cueUsuarios.vistoAt, inicio));

  if (unidadesR.status === 'fulfilled') {
    const filas = unidadesR.value.map((u) => ({
      ruta: u.ruta,
      googleId: u.id,
      nombre: u.nombre,
      descripcion: u.descripcion,
      origen: 'google',
      vistoAt: inicio,
    }));
    if (filas.length > 0) {
      await db
        .insert(cueUnidades)
        .values(filas)
        .onConflictDoUpdate({
          target: cueUnidades.ruta,
          set: {
            googleId: sql`excluded.google_id`,
            nombre: sql`excluded.nombre`,
            descripcion: sql`excluded.descripcion`,
            origen: sql`excluded.origen`,
            vistoAt: sql`excluded.visto_at`,
          },
        });
    }
  } else {
    avisos.push(`Unidades: ${explicarError(unidadesR.reason)}. Se deducen de dónde están las cuentas (no salen las vacías).`);
    const rutas = conAscendientes(cuentas.map((c) => c.uo));
    if (rutas.length > 0) {
      await db
        .insert(cueUnidades)
        .values(rutas.map((ruta) => ({ ruta, nombre: ruta.split('/').at(-1) ?? ruta, origen: 'usuarios', vistoAt: inicio })))
        .onConflictDoUpdate({ target: cueUnidades.ruta, set: { origen: sql`excluded.origen`, vistoAt: sql`excluded.visto_at` } });
    }
  }
  await db.delete(cueUnidades).where(lt(cueUnidades.vistoAt, inicio));

  if (gruposR.status === 'fulfilled') {
    const grupos = gruposR.value;
    if (grupos.length > 0) {
      await db
        .insert(cueGrupos)
        .values(
          grupos.map((g) => ({
            email: g.email,
            googleId: g.id,
            nombre: g.nombre,
            descripcion: g.descripcion,
            miembros: g.miembros,
            vistoAt: inicio,
          })),
        )
        .onConflictDoUpdate({
          target: cueGrupos.email,
          set: {
            googleId: sql`excluded.google_id`,
            nombre: sql`excluded.nombre`,
            descripcion: sql`excluded.descripcion`,
            miembros: sql`excluded.miembros`,
            vistoAt: sql`excluded.visto_at`,
          },
        });
    }
    // Los que ya no están en Google: fuera, salvo los gestionados (se quedan avisando).
    const emails = grupos.map((g) => g.email);
    await db
      .delete(cueGrupos)
      .where(and(eq(cueGrupos.gestionado, false), emails.length ? notInArray(cueGrupos.email, emails) : sql`true`));
    await db
      .update(cueGrupos)
      .set({ vistoAt: null })
      .where(and(eq(cueGrupos.gestionado, true), emails.length ? notInArray(cueGrupos.email, emails) : sql`true`));
  } else {
    avisos.push(`Grupos: ${explicarError(gruposR.reason)}`);
  }
  return { avisos, cuentas: cuentas.length };
}

// ─── Registro ─────────────────────────────────────────────────────────────────

export const ACCION_LABEL: Record<string, string> = {
  crear: 'Creada',
  mover: 'Movida',
  suspender: 'Suspendida',
  reactivar: 'Reactivada',
  contrasena: 'Contraseña nueva',
  vincular: 'Vinculada a Educamos',
  marcar: 'Marcada',
  desmarcar: 'Marca quitada',
  ajustes: 'Ajustes',
  'crear-uo': 'Unidad creada',
  'grupo-crear': 'Grupo creado',
  'grupo-reglas': 'Reglas del grupo',
  'grupo-anadir': 'Añadida al grupo',
  'grupo-quitar': 'Quitada del grupo',
};

type NuevaEntrada = Omit<typeof cueRegistro.$inferInsert, 'id' | 'at'>;

async function anotar(entradas: NuevaEntrada[]): Promise<void> {
  if (entradas.length === 0) return;
  await db.insert(cueRegistro).values(entradas.map((e) => ({ ...e, id: crypto.randomUUID() })));
}

export interface EntradaRegistro {
  id: string;
  at: string;
  por: string | null;
  accion: string;
  objetivo: string;
  detalle: string | null;
  ok: boolean;
  error: string | null;
}

export async function leerRegistro(limite = 300): Promise<EntradaRegistro[]> {
  const filas = await db.select().from(cueRegistro).orderBy(desc(cueRegistro.at)).limit(limite);
  return filas.map((f) => ({ ...f, at: f.at.toISOString() }));
}

// ─── Acciones sobre cuentas ───────────────────────────────────────────────────

export interface ResultadoAccion {
  clave: string;
  email: string | null;
  ok: boolean;
  error?: string;
  /** Solo al crear o cambiar la contraseña: se enseña una vez y no se guarda. */
  contrasena?: string;
  detalle?: string;
}

function filaPorCuenta(cruce: CruceCuentas, googleId: string): FilaCuenta | undefined {
  return cruce.filas.find((f) => f.cuenta?.id === googleId);
}

/** Lo que nunca se toca desde aquí: administradores, tu cuenta y la que se suplanta. */
function motivoIntocable(f: FilaCuenta, quien: string, admin: string): string | null {
  if (!f.cuenta) return 'No tiene cuenta';
  if (f.cuenta.admin) return 'Es administrador del dominio: desde la consola';
  if (f.cuenta.email === quien || f.cuenta.email === admin) return 'Es tu cuenta (o la que usa la app)';
  return null;
}

/**
 * Se asegura de que existe una unidad que ha calculado el cruce (la subunidad de archivo de un
 * curso, «…/Promoción 2025-26»): crea los trozos que falten. Las que escribe alguien a mano no
 * pasan por aquí, para que una errata no cree unidades.
 */
async function asegurarUnidad(admin: string, ruta: string, conocidas: Set<string>): Promise<string | null> {
  if (ruta === '/' || conocidas.has(ruta)) return null;
  const partes = ruta.split('/').filter(Boolean);
  for (let i = 1; i <= partes.length; i++) {
    const tramo = `/${partes.slice(0, i).join('/')}`;
    if (conocidas.has(tramo)) continue;
    const padre = i === 1 ? '/' : `/${partes.slice(0, i - 1).join('/')}`;
    const r = await crearUnidad(admin, partes[i - 1], padre);
    if (!r.ok) return `No se ha podido crear la unidad ${tramo}: ${r.error}`;
    conocidas.add(tramo);
    await db
      .insert(cueUnidades)
      .values({ ruta: tramo, googleId: r.unidad.id, nombre: r.unidad.nombre, origen: 'google', vistoAt: new Date() })
      .onConflictDoNothing();
  }
  return null;
}

/** Guarda en la BBDD central el correo nuevo de una persona (la fuente de verdad de los demás módulos). */
async function apuntarCorreo(tipo: 'alumno' | 'profe', personaId: string, email: string): Promise<void> {
  const ahora = new Date();
  if (tipo === 'alumno') {
    await db.update(eduStudents).set({ emailGoogle: email, updatedAt: ahora }).where(eq(eduStudents.id, personaId));
    return;
  }
  // El del profe es el que casa con el login. Si tenía uno personal (de fuera), pasa a «otro».
  const [p] = await db.select({ email: eduTeachers.email, emailOtro: eduTeachers.emailOtro }).from(eduTeachers).where(eq(eduTeachers.id, personaId));
  const anterior = p?.email?.trim().toLowerCase() ?? null;
  const set: Partial<typeof eduTeachers.$inferInsert> = { email, updatedAt: ahora };
  if (anterior && !anterior.endsWith(`@${COLEGIO.dominio}`) && !p?.emailOtro) set.emailOtro = anterior;
  await db.update(eduTeachers).set(set).where(eq(eduTeachers.id, personaId));
}

export async function crearCuentas(admin: string, peticion: PeticionCrear, quien: string): Promise<ResultadoAccion[]> {
  const c = await cargar();
  const { cruce } = cruzarCargado(c);
  const usados = new Set<string>();
  for (const cu of c.cuentas) {
    usados.add(cu.email);
    for (const a of cu.alias) usados.add(a);
  }
  const vistos = new Set<string>();
  const resultados = await enParalelo(peticion.cuentas, A_LA_VEZ, async (p): Promise<ResultadoAccion> => {
    const clave = `${p.tipo === 'alumno' ? 'a' : 'p'}:${p.id}`;
    const email = p.email.trim().toLowerCase();
    const fila = cruce.filas.find((f) => f.clave === clave);
    const motivo = !fila
      ? 'No está en Educamos'
      : fila.estado === 'no-le-toca'
        ? 'La familia desestimó el correo (protección de datos)'
        : fila.estado !== 'sin-correo'
          ? 'Ya tiene cuenta'
          : (motivoCorreoNoValido(email, COLEGIO.dominio) ??
            (usados.has(email) ? 'Ese correo ya existe en Google' : vistos.has(email) ? 'Correo repetido en la tanda' : null));
    vistos.add(email);
    if (motivo) return { clave, email, ok: false, error: motivo };
    const contrasena = peticion.contrasena.modo === 'comun' ? peticion.contrasena.valor : generarContrasena();
    const r = await crearCuenta(admin, {
      email,
      nombre: p.nombre,
      apellidos: p.apellidos,
      contrasena,
      cambiarAlEntrar: peticion.cambiarAlEntrar,
      uo: p.uo,
    });
    if (!r.ok) return { clave, email, ok: false, error: r.error };
    await guardarCuentas([r.cuenta]);
    await apuntarCorreo(p.tipo, p.id, r.cuenta.email);
    return { clave, email: r.cuenta.email, ok: true, contrasena, detalle: p.uo };
  });
  await anotar(
    resultados.map((r) => ({
      por: quien,
      accion: 'crear',
      objetivo: r.email ?? r.clave,
      detalle: r.ok ? `En ${r.detalle}` : null,
      ok: r.ok,
      error: r.error ?? null,
    })),
  );
  return resultados;
}

/**
 * Mueve cuentas de unidad. Sin `uo`, a la que les toca según el cruce: su clase (alumnado
 * activo) o su archivo (bajas y cuentas sueltas ya suspendidas).
 */
export async function moverCuentas(
  admin: string,
  items: { id: string; uo?: string }[],
  quien: string,
): Promise<ResultadoAccion[]> {
  const c = await cargar();
  const { cruce } = cruzarCargado(c);
  const conocidas = new Set(c.rutas);
  const resultados: ResultadoAccion[] = [];
  // De uno en uno los que necesitan crear unidad; el resto, en paralelo.
  const preparados: { item: { id: string; uo?: string }; fila: FilaCuenta; destino: string }[] = [];
  for (const item of items) {
    const fila = filaPorCuenta(cruce, item.id);
    if (!fila) {
      resultados.push({ clave: `g:${item.id}`, email: null, ok: false, error: 'No está en la foto: vuelve a leer de Google' });
      continue;
    }
    const intocable = motivoIntocable(fila, quien, admin);
    const destino = item.uo ?? fila.uoDestino;
    if (intocable || !destino) {
      resultados.push({ clave: fila.clave, email: fila.cuenta!.email, ok: false, error: intocable ?? 'No hay unidad de destino' });
      continue;
    }
    if (!item.uo) {
      const fallo = await asegurarUnidad(admin, destino, conocidas);
      if (fallo) {
        resultados.push({ clave: fila.clave, email: fila.cuenta!.email, ok: false, error: fallo });
        continue;
      }
    }
    preparados.push({ item, fila, destino });
  }
  const hechos = await enParalelo(preparados, A_LA_VEZ, async ({ fila, destino }): Promise<ResultadoAccion> => {
    const r = await cambiarCuenta(admin, fila.cuenta!.id, { uo: destino });
    if (!r.ok) return { clave: fila.clave, email: fila.cuenta!.email, ok: false, error: r.error };
    await guardarCuentas([r.cuenta]);
    return { clave: fila.clave, email: r.cuenta.email, ok: true, detalle: `${fila.cuenta!.uo} → ${destino}` };
  });
  resultados.push(...hechos);
  await anotar(
    resultados.map((r) => ({ por: quien, accion: 'mover', objetivo: r.email ?? r.clave, detalle: r.detalle ?? null, ok: r.ok, error: r.error ?? null })),
  );
  return resultados;
}

export async function suspenderCuentas(
  admin: string,
  ids: string[],
  archivar: boolean,
  quien: string,
): Promise<ResultadoAccion[]> {
  const c = await cargar();
  const { cruce, ajustes } = cruzarCargado(c);
  const conocidas = new Set(c.rutas);
  const hoy = new Date().toISOString().slice(0, 10);
  const resultados: ResultadoAccion[] = [];
  const preparados: { fila: FilaCuenta; destino: string | null }[] = [];
  for (const id of ids) {
    const fila = filaPorCuenta(cruce, id);
    if (!fila) {
      resultados.push({ clave: `g:${id}`, email: null, ok: false, error: 'No está en la foto: vuelve a leer de Google' });
      continue;
    }
    const motivo = motivoIntocable(fila, quien, admin) ?? (fila.estado === 'marcada' ? 'Está marcada como que se queda' : null);
    if (motivo) {
      resultados.push({ clave: fila.clave, email: fila.cuenta!.email, ok: false, error: motivo });
      continue;
    }
    let destino: string | null = null;
    if (archivar) {
      // Bajas y sueltas ya traen su archivo del cruce; a alguien que sigue en el centro se le
      // calcula como si se fuera hoy.
      destino = fila.activo
        ? uoArchivo(ajustes, { zona: fila.tipo === 'alumno' ? 'alumnado' : 'profesorado', salidaAt: hoy, graduado: false })
        : fila.uoDestino;
      if (destino && uoDentroDe(fila.cuenta!.uo, destino)) destino = null;
      if (destino) {
        const fallo = await asegurarUnidad(admin, destino, conocidas);
        if (fallo) destino = null;
      }
    }
    preparados.push({ fila, destino });
  }
  const hechos = await enParalelo(preparados, A_LA_VEZ, async ({ fila, destino }): Promise<ResultadoAccion> => {
    const cambios: CambiosCuenta = { suspendida: true };
    if (destino) cambios.uo = destino;
    const r = await cambiarCuenta(admin, fila.cuenta!.id, cambios);
    if (!r.ok) return { clave: fila.clave, email: fila.cuenta!.email, ok: false, error: r.error };
    await guardarCuentas([r.cuenta]);
    return { clave: fila.clave, email: r.cuenta.email, ok: true, detalle: destino ? `Archivada en ${destino}` : 'Sin mover de unidad' };
  });
  resultados.push(...hechos);
  await anotar(
    resultados.map((r) => ({ por: quien, accion: 'suspender', objetivo: r.email ?? r.clave, detalle: r.detalle ?? null, ok: r.ok, error: r.error ?? null })),
  );
  return resultados;
}

export async function reactivarCuentas(admin: string, ids: string[], aSuSitio: boolean, quien: string): Promise<ResultadoAccion[]> {
  const c = await cargar();
  const { cruce } = cruzarCargado(c);
  const resultados = await enParalelo(ids, A_LA_VEZ, async (id): Promise<ResultadoAccion> => {
    const fila = filaPorCuenta(cruce, id);
    if (!fila) return { clave: `g:${id}`, email: null, ok: false, error: 'No está en la foto: vuelve a leer de Google' };
    const motivo = motivoIntocable(fila, quien, admin) ?? (!fila.cuenta!.suspendida ? 'No está suspendida' : null);
    if (motivo) return { clave: fila.clave, email: fila.cuenta!.email, ok: false, error: motivo };
    const cambios: CambiosCuenta = { suspendida: false };
    // Su sitio: la unidad de su clase (o de su etapa, si es profe). A una baja no se la mueve.
    if (aSuSitio && fila.activo && fila.uoDestino && !uoDentroDe(fila.cuenta!.uo, fila.uoDestino)) cambios.uo = fila.uoDestino;
    const r = await cambiarCuenta(admin, id, cambios);
    if (!r.ok) return { clave: fila.clave, email: fila.cuenta!.email, ok: false, error: r.error };
    await guardarCuentas([r.cuenta]);
    return { clave: fila.clave, email: r.cuenta.email, ok: true, detalle: cambios.uo ? `En ${cambios.uo}` : undefined };
  });
  await anotar(
    resultados.map((r) => ({ por: quien, accion: 'reactivar', objetivo: r.email ?? r.clave, detalle: r.detalle ?? null, ok: r.ok, error: r.error ?? null })),
  );
  return resultados;
}

export async function nuevaContrasena(
  admin: string,
  id: string,
  contrasena: { modo: 'aleatoria' } | { modo: 'comun'; valor: string },
  cambiarAlEntrar: boolean,
  quien: string,
): Promise<ResultadoAccion> {
  const c = await cargar();
  const { cruce } = cruzarCargado(c);
  const fila = filaPorCuenta(cruce, id);
  let resultado: ResultadoAccion;
  const motivo = fila ? motivoIntocable(fila, quien, admin) : 'No está en la foto: vuelve a leer de Google';
  if (!fila || motivo) {
    resultado = { clave: `g:${id}`, email: fila?.cuenta?.email ?? null, ok: false, error: motivo ?? undefined };
  } else {
    const valor = contrasena.modo === 'comun' ? contrasena.valor : generarContrasena();
    const r = await cambiarCuenta(admin, id, { contrasena: { valor, cambiarAlEntrar } });
    resultado = r.ok
      ? { clave: fila.clave, email: r.cuenta.email, ok: true, contrasena: valor }
      : { clave: fila.clave, email: fila.cuenta!.email, ok: false, error: r.error };
  }
  // Nunca la contraseña en el registro: solo que se cambió.
  await anotar([
    {
      por: quien,
      accion: 'contrasena',
      objetivo: resultado.email ?? resultado.clave,
      detalle: resultado.ok ? (cambiarAlEntrar ? 'Tendrá que cambiarla al entrar' : null) : null,
      ok: resultado.ok,
      error: resultado.error ?? null,
    },
  ]);
  return resultado;
}

/** «Esta cuenta es de esta persona»: se apunta su correo en la BBDD central. Google no se toca. */
export async function vincular(tipo: 'alumno' | 'profe', personaId: string, googleId: string, quien: string): Promise<ResultadoAccion> {
  const c = await cargar();
  const { cruce } = cruzarCargado(c);
  const persona = cruce.filas.find((f) => f.clave === `${tipo === 'alumno' ? 'a' : 'p'}:${personaId}`);
  const cuenta = c.cuentas.find((x) => x.id === googleId);
  const dueña = filaPorCuenta(cruce, googleId);
  let error: string | null = null;
  if (!persona || !persona.activo) error = 'Esa persona no está en Educamos';
  else if (!cuenta) error = 'Esa cuenta no está en la foto: vuelve a leer de Google';
  else if (persona.cuenta) error = 'Ya tiene una cuenta';
  else if (dueña && dueña.tipo !== 'cuenta') error = `Esa cuenta ya es de ${dueña.nombre}`;
  if (!error) await apuntarCorreo(tipo, personaId, cuenta!.email);
  await anotar([
    {
      por: quien,
      accion: 'vincular',
      objetivo: cuenta?.email ?? googleId,
      detalle: persona ? `Con ${persona.nombre}${persona.clase ? ` (${persona.clase})` : ''}` : null,
      ok: !error,
      error,
    },
  ]);
  return { clave: persona?.clave ?? `${tipo}:${personaId}`, email: cuenta?.email ?? null, ok: !error, error: error ?? undefined };
}

export async function marcarCuenta(googleId: string, tipo: TipoMarca | null, nota: string | null, quien: string): Promise<void> {
  const [cuenta] = await db.select({ email: cueUsuarios.email }).from(cueUsuarios).where(eq(cueUsuarios.googleId, googleId));
  if (!cuenta) throw new Error('Esa cuenta no está en la foto: vuelve a leer de Google');
  if (tipo) {
    await db
      .insert(cueMarcas)
      .values({ googleId, email: cuenta.email, tipo, nota, por: quien, at: new Date() })
      .onConflictDoUpdate({ target: cueMarcas.googleId, set: { tipo, nota, por: quien, at: new Date() } });
  } else {
    await db.delete(cueMarcas).where(eq(cueMarcas.googleId, googleId));
  }
  await anotar([{ por: quien, accion: tipo ? 'marcar' : 'desmarcar', objetivo: cuenta.email, detalle: nota, ok: true, error: null }]);
}

export async function guardarAjustes(valor: unknown, quien: string): Promise<AjustesCuentas> {
  const ajustes = ajustesCuentasSchema.parse(valor);
  await db
    .insert(cfgAjustes)
    .values({ clave: AJUSTES_CLAVE, valor: ajustes, updatedByEmail: quien, updatedAt: new Date() })
    .onConflictDoUpdate({ target: cfgAjustes.clave, set: { valor: ajustes, updatedByEmail: quien, updatedAt: new Date() } });
  await anotar([{ por: quien, accion: 'ajustes', objetivo: 'Unidades', detalle: null, ok: true, error: null }]);
  return ajustes;
}

export async function crearUnidadOrganizativa(admin: string, nombre: string, padre: string, quien: string): Promise<{ ruta: string }> {
  const r = await crearUnidad(admin, nombre, padre);
  const ruta = `${padre === '/' ? '' : padre}/${nombre}`;
  await anotar([{ por: quien, accion: 'crear-uo', objetivo: ruta, detalle: null, ok: r.ok, error: r.ok ? null : r.error }]);
  if (!r.ok) throw new Error(r.error);
  await db
    .insert(cueUnidades)
    .values({ ruta: r.unidad.ruta, googleId: r.unidad.id, nombre: r.unidad.nombre, origen: 'google', vistoAt: new Date() })
    .onConflictDoUpdate({ target: cueUnidades.ruta, set: { origen: 'google', vistoAt: new Date() } });
  return { ruta: r.unidad.ruta };
}

// ─── Grupos ───────────────────────────────────────────────────────────────────

/** Las fuentes de los grupos, a partir del cruce: el correo de cada uno es el de su cuenta activa. */
async function datosGrupos(c: Cargado, cruce: CruceCuentas): Promise<{ datos: DatosGrupos; idPorCorreo: Map<string, string> }> {
  const correoActivo = (f: FilaCuenta | undefined) => (f?.cuenta && !f.cuenta.suspendida ? f.cuenta.email : null);
  const porClave = new Map(cruce.filas.map((f) => [f.clave, f]));
  const tutorias = await db
    .select({ profeId: eduTutorias.eduTeacherId, curso: eduTutorias.curso, letra: eduTutorias.letra })
    .from(eduTutorias)
    .where(eq(eduTutorias.academicYear, academicYearActual()));
  const datos: DatosGrupos = {
    profes: c.profes
      .filter((p) => p.activo)
      .map((p) => ({ nombre: porClave.get(`p:${p.id}`)?.nombre ?? '', email: correoActivo(porClave.get(`p:${p.id}`)), etapas: p.etapas })),
    tutores: tutorias.map((t) => {
      const f = porClave.get(`p:${t.profeId}`);
      return { nombre: f?.nombre ?? '', email: f?.activo ? correoActivo(f) : null, curso: t.curso, letra: t.letra };
    }),
    alumnos: c.alumnos
      .filter((a) => a.activo && a.curso)
      .map((a) => ({ nombre: porClave.get(`a:${a.id}`)?.nombre ?? '', email: correoActivo(porClave.get(`a:${a.id}`)), curso: a.curso!, letra: a.letra })),
    cuentas: c.cuentas,
  };
  const idPorCorreo = new Map<string, string>();
  for (const cu of c.cuentas) {
    idPorCorreo.set(cu.email, cu.id);
    for (const a of cu.alias) idPorCorreo.set(a, cu.id);
  }
  return { datos, idPorCorreo };
}

export interface PreviaGrupo {
  email: string;
  plan: PlanGrupo;
  deseados: number;
  actuales: number;
  sinCorreo: { nombre: string; motivo: string }[];
}

async function planDeGrupo(admin: string, email: string): Promise<{ previa: PreviaGrupo; reglas: ReglasGrupo }> {
  const c = await cargar();
  const grupo = c.grupos.find((g) => g.email === email);
  if (!grupo) throw new Error('Ese grupo no está en la lista: vuelve a leer de Google');
  const reglas = leerReglas(grupo.reglas);
  const { cruce } = cruzarCargado(c);
  const [{ datos, idPorCorreo }, actuales] = await Promise.all([datosGrupos(c, cruce), leerMiembros(admin, email)]);
  const deseados = miembrosDeseados(reglas, datos);
  const plan = planGrupo(deseados, actuales, reglas.modo, idPorCorreo);
  return {
    reglas,
    previa: { email, plan, deseados: deseados.miembros.length, actuales: actuales.length, sinCorreo: deseados.sinCorreo },
  };
}

export async function previaGrupo(admin: string, email: string): Promise<PreviaGrupo> {
  return (await planDeGrupo(admin, email)).previa;
}

/** Cambios de miembros por llamada: lo que cabe holgado en el tiempo de una función. */
const CAMBIOS_POR_TANDA = 120;

/**
 * Aplica lo que diga el plan, recalculado aquí (nunca el que trae la pantalla). Si hay más de
 * `CAMBIOS_POR_TANDA` cambios, hace una tanda y dice cuántos quedan: la pantalla vuelve a
 * llamar. Google tarda unos segundos en enseñar los cambios, pero repetir no rompe nada: un
 * 409 al añadir y un 404 al quitar cuentan como hechos.
 */
export async function aplicarGrupo(
  admin: string,
  email: string,
  confirmacion: string | null,
  quien: string,
): Promise<{ anadidos: number; quitados: number; errores: { email: string; error: string }[]; quedan: number }> {
  const { previa } = await planDeGrupo(admin, email);
  const { plan } = previa;
  if (plan.muchasBajas && confirmacion !== 'QUITAR') throw new Error(`Son ${plan.quitar.length} bajas: escribe QUITAR para confirmarlas`);
  const anadir = plan.anadir.slice(0, CAMBIOS_POR_TANDA);
  const quitar = plan.quitar.slice(0, Math.max(0, CAMBIOS_POR_TANDA - anadir.length));
  const quedan = plan.anadir.length + plan.quitar.length - anadir.length - quitar.length;

  const altas = await enParalelo(anadir, A_LA_VEZ, async (m) => ({ email: m.email, motivo: m.motivo, r: await anadirMiembro(admin, email, m.email) }));
  const bajas = await enParalelo(quitar, A_LA_VEZ, async (m) => ({ email: m.email, motivo: m.motivo, r: await quitarMiembro(admin, email, m.id ?? m.email) }));
  const errores = [...altas, ...bajas].filter((x) => !x.r.ok).map((x) => ({ email: x.email, error: (x.r as { error: string }).error }));
  const anadidos = altas.filter((x) => x.r.ok).length;
  const quitados = bajas.filter((x) => x.r.ok).length;

  const ahora = new Date();
  const statements: BatchItem<'pg'>[] = [
    db
      .update(cueGrupos)
      .set({
        ultimaSyncAt: ahora,
        ultimaSyncPor: quien,
        ultimaSync: { anadidos, quitados, errores: errores.length },
        miembros: previa.actuales + anadidos - quitados,
      })
      .where(eq(cueGrupos.email, email)),
  ];
  const entradas: NuevaEntrada[] = [
    ...altas.map((x) => ({
      por: quien,
      accion: 'grupo-anadir',
      objetivo: email,
      detalle: `${x.email} · ${x.motivo}`,
      ok: x.r.ok,
      error: x.r.ok ? null : (x.r as { error: string }).error,
    })),
    ...bajas.map((x) => ({
      por: quien,
      accion: 'grupo-quitar',
      objetivo: email,
      detalle: `${x.email} · ${x.motivo}`,
      ok: x.r.ok,
      error: x.r.ok ? null : (x.r as { error: string }).error,
    })),
  ];
  if (entradas.length > 0) statements.push(db.insert(cueRegistro).values(entradas.map((e) => ({ ...e, id: crypto.randomUUID() }))));
  await db.batch(statements as [BatchItem<'pg'>, ...BatchItem<'pg'>[]]);
  return { anadidos, quitados, errores, quedan };
}

// ─── Coberturas por baja: meter al sustituto en los grupos del titular ───────────────

export interface SugerenciaGrupo {
  email: string;
  nombre: string | null;
  gestionado: boolean;
  /** `null` = no es un grupo gestionado. */
  modo: ReglasGrupo['modo'] | null;
  yaEsta: boolean;
  /** Por qué no se puede marcar (ver `motivoGrupoBloqueado`), o `null` si se puede. */
  bloqueado: string | null;
}

export interface SugerenciasCoberturaBaja {
  coberturaId: string;
  sustituto: { nombre: string; correo: string | null };
  titular: { nombre: string; correo: string | null };
  /** Los grupos donde está el titular, para que se elija a mano en cuáles entra el sustituto. */
  grupos: SugerenciaGrupo[];
  avisos: string[];
}

/** La cuenta activa (no suspendida) de un profe, por el cruce con Educamos. */
function correoActivoDeProfe(cruce: CruceCuentas, profeId: string): string | null {
  const f = cruce.filas.find((x) => x.clave === `p:${profeId}`);
  return f?.cuenta && !f.cuenta.suspendida ? f.cuenta.email : null;
}

async function cargarCoberturaBaja(id: string) {
  const fila = (await listarCoberturasBaja(hoyISO())).find((x) => x.id === id);
  if (!fila) throw new Error('Esa cobertura por baja ya no existe');
  if (fila.estado !== 'vigente') throw new Error('Esa cobertura por baja no está vigente: enciéndela o revisa sus fechas');
  return fila;
}

/**
 * Los grupos de Google donde está el titular, para sugerir que el sustituto entre en ellos.
 * No se mete a nadie: la persona de TIC elige a mano en cuáles. Si el sustituto o el titular no
 * tienen cuenta activa, se dice (sin cuenta no hay grupos que mirar).
 */
export async function sugerirGruposCoberturaBaja(admin: string, coberturaId: string): Promise<SugerenciasCoberturaBaja> {
  const [fila, c] = await Promise.all([cargarCoberturaBaja(coberturaId), cargar()]);
  const { cruce } = cruzarCargado(c);
  const sustitutoCorreo = correoActivoDeProfe(cruce, fila.sustitutoId);
  const titularCorreo = correoActivoDeProfe(cruce, fila.titularId);
  const salida: SugerenciasCoberturaBaja = {
    coberturaId,
    sustituto: { nombre: fila.sustitutoNombre, correo: sustitutoCorreo },
    titular: { nombre: fila.titularNombre, correo: titularCorreo },
    grupos: [],
    avisos: [],
  };
  if (!sustitutoCorreo) salida.avisos.push(`${fila.sustitutoNombre} no tiene cuenta activa en Google: créala en «Por hacer» y vuelve aquí.`);
  if (!titularCorreo) salida.avisos.push(`${fila.titularNombre} no tiene cuenta activa en Google, así que no hay grupos que mirar.`);
  if (!sustitutoCorreo || !titularCorreo) return salida;

  const [delTitular, delSustituto] = await Promise.all([gruposDeMiembro(admin, titularCorreo), gruposDeMiembro(admin, sustitutoCorreo)]);
  const yaEsta = new Set(delSustituto.map((g) => g.email));
  const conocidos = new Map(c.grupos.map((g) => [g.email, g]));
  salida.grupos = delTitular
    .map((g): SugerenciaGrupo => {
      const k = conocidos.get(g.email);
      const modo = k?.gestionado ? leerReglas(k.reglas).modo : null;
      const base = { gestionado: Boolean(k?.gestionado), modo, yaEsta: yaEsta.has(g.email) };
      return { email: g.email, nombre: k?.nombre ?? g.nombre, ...base, bloqueado: motivoGrupoBloqueado(base) };
    })
    .sort((a, b) => Number(Boolean(a.bloqueado)) - Number(Boolean(b.bloqueado)) || (a.nombre ?? a.email).localeCompare(b.nombre ?? b.email, 'es'));
  if (salida.grupos.length === 0) salida.avisos.push(`${fila.titularNombre} no está en ningún grupo.`);
  return salida;
}

export interface ResultadoGrupoSustituto {
  grupo: string;
  ok: boolean;
  /** Ya estaba dentro. */
  sinCambio: boolean;
  error: string | null;
}

/**
 * Mete al sustituto en los grupos que se hayan marcado. Se vuelve a comprobar aquí, sin fiarse de
 * la pantalla: cada grupo tiene que ser uno donde esté el titular y que no esté bloqueado.
 */
export async function anadirSustitutoAGrupos(
  admin: string,
  coberturaId: string,
  grupos: string[],
  quien: string,
): Promise<ResultadoGrupoSustituto[]> {
  const previa = await sugerirGruposCoberturaBaja(admin, coberturaId);
  const correo = previa.sustituto.correo;
  if (!correo) throw new Error(previa.avisos[0] ?? 'El sustituto no tiene cuenta activa en Google');
  const permitidos = new Map(previa.grupos.map((g) => [g.email, g]));
  const pedidos = [...new Set(grupos.map((g) => g.trim().toLowerCase()))];

  const resultados = await enParalelo(pedidos, A_LA_VEZ, async (grupo): Promise<ResultadoGrupoSustituto> => {
    const g = permitidos.get(grupo);
    if (!g) return { grupo, ok: false, sinCambio: false, error: `${previa.titular.nombre} no está en ese grupo` };
    if (g.yaEsta) return { grupo, ok: true, sinCambio: true, error: null };
    if (g.bloqueado) return { grupo, ok: false, sinCambio: false, error: g.bloqueado };
    const r = await anadirMiembro(admin, grupo, correo);
    return r.ok ? { grupo, ok: true, sinCambio: r.sinCambio, error: null } : { grupo, ok: false, sinCambio: false, error: r.error };
  });
  await anotar(
    resultados.map((r) => ({
      por: quien,
      accion: 'grupo-anadir',
      objetivo: r.grupo,
      detalle: `${correo} · sustituye a ${previa.titular.nombre}`,
      ok: r.ok,
      error: r.error,
    })),
  );
  return resultados;
}

export async function guardarGrupo(
  email: string,
  datos: { gestionado: boolean; reglas: ReglasGrupo },
  quien: string,
): Promise<void> {
  const r = await db
    .update(cueGrupos)
    .set({ gestionado: datos.gestionado, reglas: datos.reglas as unknown as Record<string, unknown>, updatedAt: new Date(), updatedBy: quien })
    .where(eq(cueGrupos.email, email))
    .returning({ email: cueGrupos.email });
  if (r.length === 0) throw new Error('Ese grupo no está en la lista: vuelve a leer de Google');
  await anotar([
    {
      por: quien,
      accion: 'grupo-reglas',
      objetivo: email,
      detalle: datos.gestionado ? datos.reglas.fuentes.map(describirFuente).join(' + ') || 'Sin fuentes' : 'Deja de gestionarse desde aquí',
      ok: true,
      error: null,
    },
  ]);
}

export async function crearGrupoNuevo(
  admin: string,
  datos: { email: string; nombre: string; descripcion: string; reglas: ReglasGrupo },
  quien: string,
): Promise<void> {
  const email = datos.email.trim().toLowerCase();
  const motivo = motivoCorreoNoValido(email, COLEGIO.dominio);
  if (motivo) throw new Error(motivo);
  const r = await crearGrupo(admin, { email, nombre: datos.nombre, descripcion: datos.descripcion });
  await anotar([{ por: quien, accion: 'grupo-crear', objetivo: email, detalle: datos.nombre, ok: r.ok, error: r.ok ? null : r.error }]);
  if (!r.ok) throw new Error(r.error);
  await db
    .insert(cueGrupos)
    .values({
      email: r.grupo.email,
      googleId: r.grupo.id,
      nombre: r.grupo.nombre,
      descripcion: r.grupo.descripcion,
      miembros: 0,
      gestionado: true,
      reglas: datos.reglas as unknown as Record<string, unknown>,
      vistoAt: new Date(),
      updatedBy: quien,
    })
    .onConflictDoNothing();
}

/** Para la ficha de Nouvinguts: ¿tiene cuenta este alumno? (sin tocar Google). */
export async function cuentaDeAlumno(eduStudentId: string): Promise<{ email: string; suspendida: boolean } | null> {
  const [a] = await db.select({ emailGoogle: eduStudents.emailGoogle }).from(eduStudents).where(eq(eduStudents.id, eduStudentId));
  const email = a?.emailGoogle?.trim().toLowerCase();
  if (!email) return null;
  const [u] = await db
    .select({ email: cueUsuarios.email, suspendida: cueUsuarios.suspendida })
    .from(cueUsuarios)
    .where(inArray(cueUsuarios.email, [email]));
  return u ?? null;
}
