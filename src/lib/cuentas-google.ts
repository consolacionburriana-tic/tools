// Correos y grupos · adaptador de Google. Ficha: docs/30-cuentas.md
//
// Admin SDK Directory suplantando a un administrador del dominio (`buzonAdmin`), con la misma
// cuenta de servicio que el resto (`google-sa.ts`). Un scope por cosa, para que lo que falte
// en la delegación no impida lo demás:
//
//   · leer las cuentas         admin.directory.user.readonly  (ya estaba: lo usa Calendarios)
//   · crear, mover, suspender  admin.directory.user
//   · unidades organizativas   admin.directory.orgunit        (leerlas y crear las que falten)
//   · grupos y sus miembros    admin.directory.group
//
// Lecciones de asistente-grupos (pfelipm) aplicadas aquí: un 409 al añadir y un 404 al quitar
// cuentan como hechos, y los reintentos solo esperan en los errores de cuota y de servidor.
import { google } from 'googleapis';
import type { admin_directory_v1 } from 'googleapis';
import type { CuentaGoogle, MiembroActual } from '@/lib/cuentas';
import { conReintentos, explicarError, jwtGoogle, mensajeDe, statusDe } from '@/lib/google-sa';

export const SCOPE_LEER_USUARIOS = 'https://www.googleapis.com/auth/admin.directory.user.readonly';
export const SCOPE_USUARIOS = 'https://www.googleapis.com/auth/admin.directory.user';
export const SCOPE_UNIDADES = 'https://www.googleapis.com/auth/admin.directory.orgunit';
export const SCOPE_GRUPOS = 'https://www.googleapis.com/auth/admin.directory.group';

// Un cliente por buzón y scope: el JWT guarda su token, y una tanda de 50 altas no pide 50.
const clientes = new Map<string, admin_directory_v1.Admin>();
function directory(admin: string, scope: string): admin_directory_v1.Admin {
  const clave = `${scope}|${admin}`;
  let c = clientes.get(clave);
  if (!c) {
    c = google.admin({ version: 'directory_v1', auth: jwtGoogle(scope, admin) });
    clientes.set(clave, c);
  }
  return c;
}

const CAMPOS_USUARIO =
  'id,primaryEmail,aliases,nonEditableAliases,name(givenName,familyName),orgUnitPath,suspended,archived,isAdmin,creationTime,lastLoginTime';

function aCuenta(u: admin_directory_v1.Schema$User): CuentaGoogle | null {
  if (!u.id || !u.primaryEmail) return null;
  // Google da 1970-01-01 a quien no ha entrado nunca.
  const acceso = u.lastLoginTime && !u.lastLoginTime.startsWith('1970') ? u.lastLoginTime : null;
  return {
    id: u.id,
    email: u.primaryEmail.toLowerCase(),
    alias: [...(u.aliases ?? []), ...(u.nonEditableAliases ?? [])].map((a) => a.toLowerCase()),
    nombre: u.name?.givenName ?? null,
    apellidos: u.name?.familyName ?? null,
    uo: u.orgUnitPath || '/',
    suspendida: u.suspended === true,
    archivada: u.archived === true,
    admin: u.isAdmin === true,
    creadaAt: u.creationTime ?? null,
    ultimoAccesoAt: acceso,
  };
}

/** Errores de una cuenta dichos para TIC. */
export function explicarErrorCuenta(e: unknown): string {
  const m = mensajeDe(e);
  const s = statusDe(e);
  if (s === 409 || /already exists/i.test(m)) return 'Ese correo ya existe en Google';
  if (/password/i.test(m) && s === 400) return 'La contraseña no cumple la política del dominio';
  if (/org ?unit|orgUnitPath/i.test(m) && (s === 400 || s === 404)) return 'Esa unidad organizativa no existe en Google';
  if (s === 404) return 'La cuenta ya no existe en Google';
  return explicarError(e);
}

// ── Diagnóstico ────────────────────────────────────────────────────────────────

export interface ComprobacionPermiso {
  clave: 'leer' | 'usuarios' | 'unidades' | 'grupos';
  nombre: string;
  scope: string;
  ok: boolean;
  detalle: string;
}

/** Una lectura mínima a cada cosa (o pedir el token, si probarlo sería escribir). */
export async function comprobarPermisos(admin: string): Promise<ComprobacionPermiso[]> {
  const pruebas: [ComprobacionPermiso['clave'], string, string, () => Promise<string>][] = [
    [
      'leer',
      'Leer las cuentas del dominio',
      SCOPE_LEER_USUARIOS,
      async () => {
        await directory(admin, SCOPE_LEER_USUARIOS).users.list({ customer: 'my_customer', maxResults: 1, fields: 'users(id)' });
        return 'Se leen las cuentas';
      },
    ],
    [
      'usuarios',
      'Crear, mover, suspender y cambiar contraseñas',
      SCOPE_USUARIOS,
      async () => {
        await jwtGoogle(SCOPE_USUARIOS, admin).authorize();
        return 'Se pueden crear y tocar cuentas';
      },
    ],
    [
      'unidades',
      'Unidades organizativas',
      SCOPE_UNIDADES,
      async () => {
        const { data } = await directory(admin, SCOPE_UNIDADES).orgunits.list({ customerId: 'my_customer', type: 'all' });
        return `Se leen las unidades (${data.organizationUnits?.length ?? 0})`;
      },
    ],
    [
      'grupos',
      'Grupos y sus miembros',
      SCOPE_GRUPOS,
      async () => {
        await directory(admin, SCOPE_GRUPOS).groups.list({ customer: 'my_customer', maxResults: 1, fields: 'groups(id)' });
        return 'Se leen y se tocan los grupos';
      },
    ],
  ];
  return Promise.all(
    pruebas.map(async ([clave, nombre, scope, fn]) => {
      try {
        return { clave, nombre, scope, ok: true, detalle: await fn() };
      } catch (e) {
        return { clave, nombre, scope, ok: false, detalle: explicarError(e) };
      }
    }),
  );
}

// ── Leer ───────────────────────────────────────────────────────────────────────

/** Todas las cuentas del dominio, también suspendidas (tres o cuatro páginas de 500). */
export async function leerCuentas(admin: string): Promise<CuentaGoogle[]> {
  const d = directory(admin, SCOPE_LEER_USUARIOS);
  const salida: CuentaGoogle[] = [];
  let pageToken: string | undefined;
  do {
    const { data } = await conReintentos(() =>
      d.users.list({
        customer: 'my_customer',
        maxResults: 500,
        orderBy: 'email',
        projection: 'basic',
        pageToken,
        fields: `nextPageToken,users(${CAMPOS_USUARIO})`,
      }),
    );
    for (const u of data.users ?? []) {
      const c = aCuenta(u);
      if (c) salida.push(c);
    }
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);
  return salida;
}

export interface UnidadGoogle {
  id: string | null;
  ruta: string;
  nombre: string;
  descripcion: string | null;
}

/** Las unidades organizativas (sin la raíz). */
export async function leerUnidades(admin: string): Promise<UnidadGoogle[]> {
  const { data } = await conReintentos(() =>
    directory(admin, SCOPE_UNIDADES).orgunits.list({ customerId: 'my_customer', type: 'all' }),
  );
  return (data.organizationUnits ?? [])
    .filter((u) => u.orgUnitPath)
    .map((u) => ({ id: u.orgUnitId ?? null, ruta: u.orgUnitPath!, nombre: u.name ?? u.orgUnitPath!, descripcion: u.description ?? null }));
}

export interface GrupoGoogle {
  id: string;
  email: string;
  nombre: string | null;
  descripcion: string | null;
  miembros: number | null;
}

export async function leerGrupos(admin: string): Promise<GrupoGoogle[]> {
  const d = directory(admin, SCOPE_GRUPOS);
  const salida: GrupoGoogle[] = [];
  let pageToken: string | undefined;
  do {
    const { data } = await conReintentos(() =>
      d.groups.list({
        customer: 'my_customer',
        maxResults: 200,
        pageToken,
        fields: 'nextPageToken,groups(id,email,name,description,directMembersCount)',
      }),
    );
    for (const g of data.groups ?? []) {
      if (!g.id || !g.email) continue;
      salida.push({
        id: g.id,
        email: g.email.toLowerCase(),
        nombre: g.name ?? null,
        descripcion: g.description ?? null,
        miembros: g.directMembersCount != null ? Number(g.directMembersCount) : null,
      });
    }
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);
  return salida;
}

/** Los miembros directos de un grupo (los que vienen por un grupo anidado no cuentan). */
export async function leerMiembros(admin: string, grupo: string): Promise<MiembroActual[]> {
  const d = directory(admin, SCOPE_GRUPOS);
  const salida: MiembroActual[] = [];
  let pageToken: string | undefined;
  do {
    const { data } = await conReintentos(() =>
      d.members.list({
        groupKey: grupo,
        maxResults: 200,
        includeDerivedMembership: false,
        pageToken,
        fields: 'nextPageToken,members(id,email,role,type)',
      }),
    );
    for (const m of data.members ?? []) {
      salida.push({ id: m.id ?? null, email: m.email?.toLowerCase() ?? null, rol: m.role ?? 'MEMBER', tipo: m.type ?? 'USER' });
    }
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);
  return salida;
}

// ── Cuentas ────────────────────────────────────────────────────────────────────

export interface NuevaCuenta {
  email: string;
  nombre: string;
  apellidos: string;
  contrasena: string;
  cambiarAlEntrar: boolean;
  uo: string;
}

export type ResultadoCuenta = { ok: true; cuenta: CuentaGoogle } | { ok: false; error: string };

/**
 * Crea la cuenta. Si Google dice que ya existe, mira si es la que se acaba de crear (un
 * reintento tras un error de red que en realidad había entrado): si es de hace dos minutos,
 * es esta, con esta contraseña. Si es más vieja, es de otra persona y se dice.
 */
export async function crearCuenta(admin: string, n: NuevaCuenta): Promise<ResultadoCuenta> {
  const d = directory(admin, SCOPE_USUARIOS);
  try {
    const { data } = await conReintentos(() =>
      d.users.insert({
        fields: CAMPOS_USUARIO,
        requestBody: {
          primaryEmail: n.email,
          name: { givenName: n.nombre, familyName: n.apellidos },
          password: n.contrasena,
          changePasswordAtNextLogin: n.cambiarAlEntrar,
          orgUnitPath: n.uo,
        },
      }),
    );
    const cuenta = aCuenta(data);
    return cuenta ? { ok: true, cuenta } : { ok: false, error: 'Google no devolvió la cuenta creada' };
  } catch (e) {
    if (statusDe(e) === 409) {
      try {
        const { data } = await d.users.get({ userKey: n.email, fields: CAMPOS_USUARIO });
        const cuenta = aCuenta(data);
        const reciente = cuenta?.creadaAt && Date.now() - new Date(cuenta.creadaAt).getTime() < 2 * 60_000;
        if (cuenta && reciente) return { ok: true, cuenta };
      } catch {
        // Si no se puede leer, se queda en «ya existe».
      }
    }
    return { ok: false, error: explicarErrorCuenta(e) };
  }
}

export interface CambiosCuenta {
  uo?: string;
  suspendida?: boolean;
  contrasena?: { valor: string; cambiarAlEntrar: boolean };
}

/** Mueve, suspende, reactiva o cambia la contraseña: todo es un `users.patch`. */
export async function cambiarCuenta(admin: string, id: string, c: CambiosCuenta): Promise<ResultadoCuenta> {
  const requestBody: admin_directory_v1.Schema$User = {};
  if (c.uo !== undefined) requestBody.orgUnitPath = c.uo;
  if (c.suspendida !== undefined) requestBody.suspended = c.suspendida;
  if (c.contrasena) {
    requestBody.password = c.contrasena.valor;
    requestBody.changePasswordAtNextLogin = c.contrasena.cambiarAlEntrar;
  }
  try {
    const { data } = await conReintentos(() =>
      directory(admin, SCOPE_USUARIOS).users.patch({ userKey: id, fields: CAMPOS_USUARIO, requestBody }),
    );
    const cuenta = aCuenta(data);
    return cuenta ? { ok: true, cuenta } : { ok: false, error: 'Google no devolvió la cuenta' };
  } catch (e) {
    return { ok: false, error: explicarErrorCuenta(e) };
  }
}

// ── Unidades ───────────────────────────────────────────────────────────────────

export type ResultadoUnidad = { ok: true; unidad: UnidadGoogle; yaExistia: boolean } | { ok: false; error: string };

export async function crearUnidad(admin: string, nombre: string, padre: string): Promise<ResultadoUnidad> {
  const ruta = `${padre === '/' ? '' : padre}/${nombre}`;
  try {
    const { data } = await conReintentos(() =>
      directory(admin, SCOPE_UNIDADES).orgunits.insert({
        customerId: 'my_customer',
        requestBody: { name: nombre, parentOrgUnitPath: padre },
      }),
    );
    return {
      ok: true,
      yaExistia: false,
      unidad: { id: data.orgUnitId ?? null, ruta: data.orgUnitPath ?? ruta, nombre: data.name ?? nombre, descripcion: data.description ?? null },
    };
  } catch (e) {
    if (statusDe(e) === 409 || /already exists/i.test(mensajeDe(e))) {
      return { ok: true, yaExistia: true, unidad: { id: null, ruta, nombre, descripcion: null } };
    }
    if (/parent/i.test(mensajeDe(e))) return { ok: false, error: 'La unidad de arriba no existe en Google' };
    return { ok: false, error: explicarError(e) };
  }
}

// ── Grupos ─────────────────────────────────────────────────────────────────────

export type ResultadoGrupo = { ok: true; grupo: GrupoGoogle } | { ok: false; error: string };

export async function crearGrupo(admin: string, g: { email: string; nombre: string; descripcion: string }): Promise<ResultadoGrupo> {
  try {
    const { data } = await conReintentos(() =>
      directory(admin, SCOPE_GRUPOS).groups.insert({
        requestBody: { email: g.email, name: g.nombre, description: g.descripcion || undefined },
      }),
    );
    if (!data.id || !data.email) return { ok: false, error: 'Google no devolvió el grupo creado' };
    return {
      ok: true,
      grupo: { id: data.id, email: data.email.toLowerCase(), nombre: data.name ?? g.nombre, descripcion: data.description ?? null, miembros: 0 },
    };
  } catch (e) {
    if (statusDe(e) === 409) return { ok: false, error: 'Ya existe un grupo o una cuenta con ese correo' };
    return { ok: false, error: explicarError(e) };
  }
}

/** `sinCambio`: ya era miembro (al añadir) o ya no lo era (al quitar). */
export type ResultadoMiembro = { ok: true; sinCambio: boolean } | { ok: false; error: string };

export async function anadirMiembro(admin: string, grupo: string, email: string): Promise<ResultadoMiembro> {
  try {
    await conReintentos(() =>
      directory(admin, SCOPE_GRUPOS).members.insert({ groupKey: grupo, requestBody: { email, role: 'MEMBER' } }),
    );
    return { ok: true, sinCambio: false };
  } catch (e) {
    if (statusDe(e) === 409) return { ok: true, sinCambio: true };
    if (statusDe(e) === 404) return { ok: false, error: 'Google no encuentra esa cuenta o ese grupo' };
    if (/external/i.test(mensajeDe(e))) return { ok: false, error: 'El grupo no admite miembros de fuera del colegio' };
    return { ok: false, error: explicarError(e) };
  }
}

/** `clave`: el id del miembro (mejor: no cambia) o su correo. */
export async function quitarMiembro(admin: string, grupo: string, clave: string): Promise<ResultadoMiembro> {
  try {
    await conReintentos(() => directory(admin, SCOPE_GRUPOS).members.delete({ groupKey: grupo, memberKey: clave }));
    return { ok: true, sinCambio: false };
  } catch (e) {
    if (statusDe(e) === 404) return { ok: true, sinCambio: true };
    return { ok: false, error: explicarError(e) };
  }
}
