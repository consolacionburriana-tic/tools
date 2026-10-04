// Calendarios del dominio · adaptador de Google. Ficha: docs/25-calendarios.md
//
// MISMA cuenta de servicio y MISMA delegación de dominio que `email-gmail.ts` y
// `mihorario-google.ts`: un JWT con `subject` = el buzón que se suplanta. Tres APIs:
//
//   · Admin SDK Directory → la lista de usuarios del dominio (suplantando a un ADMIN).
//   · Classroom           → todas las clases del dominio con su `calendarId` (a un ADMIN).
//   · Calendar            → el calendarList de cada usuario, contar eventos y borrar (a
//                           cada usuario, o al propietario del calendario).
//
// Workspace no tiene un "lista todos los calendarios secundarios del dominio": un
// calendario secundario solo se ve desde la cuenta de quien lo tiene. Por eso el inventario
// se arma en dos pasadas: Classroom da de golpe los de las clases que siguen existiendo, y
// el barrido por usuarios encuentra el resto (los de clases ya borradas y los hechos a mano).
//
// ⚠️ Escrito contra la documentación de las APIs (v1/v3) sin poder ejecutarlo en vivo desde
// la sesión que lo hizo. La pantalla tiene un botón «Comprobar permisos» que dice qué falta.
import { google } from 'googleapis';
import type { admin_directory_v1, calendar_v3, classroom_v1 } from 'googleapis';
import { acumularEventos, esCalendarioSecundario, RESUMEN_VACIO, type ResumenEventos } from '@/lib/calendarios';

export const SCOPE_DIRECTORY = 'https://www.googleapis.com/auth/admin.directory.user.readonly';
export const SCOPE_CLASSROOM = 'https://www.googleapis.com/auth/classroom.courses.readonly';
// Cada acción de Classroom con su scope, para que falte lo que falte, lo demás siga funcionando:
// leer (el escaneo) no deja de ir porque todavía no se haya delegado el de borrar.
export const SCOPE_CLASSROOM_GESTION = 'https://www.googleapis.com/auth/classroom.courses';
export const SCOPE_CLASSROOM_ROSTERS = 'https://www.googleapis.com/auth/classroom.rosters';
export const SCOPE_CALENDAR = 'https://www.googleapis.com/auth/calendar';
// Evaluaciones → Classroom: publicar como la cuenta que es profe de la tutoría (ver `publicarEnClase`).
export const SCOPE_CLASSROOM_TAREAS = 'https://www.googleapis.com/auth/classroom.coursework.students';
export const SCOPE_CLASSROOM_ANUNCIOS = 'https://www.googleapis.com/auth/classroom.announcements';
export const SCOPE_CLASSROOM_TEMAS = 'https://www.googleapis.com/auth/classroom.topics';

function credenciales(): { clientEmail: string; privateKey: string } | null {
  const clientEmail = process.env.GOOGLE_SA_CLIENT_EMAIL ?? process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = (process.env.GOOGLE_SA_PRIVATE_KEY ?? process.env.GOOGLE_SHEETS_PRIVATE_KEY)?.replace(
    /\\n/g,
    '\n',
  );
  if (!clientEmail || !privateKey) return null;
  return { clientEmail, privateKey };
}

export function googleConfigurado(): boolean {
  return credenciales() !== null;
}

function jwt(scope: string, subject: string) {
  const cred = credenciales();
  if (!cred) throw new Error('Faltan GOOGLE_SA_CLIENT_EMAIL / GOOGLE_SA_PRIVATE_KEY en el entorno');
  return new google.auth.JWT({ email: cred.clientEmail, key: cred.privateKey, scopes: [scope], subject });
}

// Un cliente por buzón suplantado (el JWT lleva el `subject` dentro). Se cachean: el barrido
// por usuarios abre cientos, pero cada uno solo una vez por instancia.
const calendarios = new Map<string, calendar_v3.Calendar>();
function cal(buzon: string): calendar_v3.Calendar {
  let c = calendarios.get(buzon);
  if (!c) {
    c = google.calendar({ version: 'v3', auth: jwt(SCOPE_CALENDAR, buzon) });
    calendarios.set(buzon, c);
  }
  return c;
}
function directory(admin: string): admin_directory_v1.Admin {
  return google.admin({ version: 'directory_v1', auth: jwt(SCOPE_DIRECTORY, admin) });
}
function classroom(admin: string, scope = SCOPE_CLASSROOM): classroom_v1.Classroom {
  return google.classroom({ version: 'v1', auth: jwt(scope, admin) });
}

// ── Errores y reintentos (mismo criterio que email-gmail.ts: 429 y 5xx) ─────────

export function statusDe(e: unknown): number | null {
  const x = e as { status?: unknown; code?: unknown; response?: { status?: unknown } };
  for (const v of [x?.status, x?.response?.status, x?.code]) if (typeof v === 'number') return v;
  return null;
}

export function mensajeDe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function esReintentable(e: unknown): boolean {
  const s = statusDe(e);
  if (s !== null && (s === 429 || s >= 500)) return true;
  return /rateLimitExceeded|userRateLimitExceeded|backendError|Quota exceeded/i.test(mensajeDe(e));
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function conReintentos<T>(fn: () => Promise<T>, intentos = 4): Promise<T> {
  let ultimo: unknown;
  for (let i = 0; i < intentos; i++) {
    try {
      return await fn();
    } catch (e) {
      ultimo = e;
      if (!esReintentable(e) || i === intentos - 1) throw e;
      await espera(500 * 2 ** i);
    }
  }
  throw ultimo;
}

/** Traduce los errores típicos de delegación a algo que se pueda arreglar en la consola. */
export function explicarError(e: unknown): string {
  const m = mensajeDe(e);
  if (/unauthorized_client/i.test(m))
    return 'Falta el scope en la delegación de todo el dominio (consola de admin → Seguridad → Control de API)';
  if (/accessNotConfigured|has not been used in project|is disabled/i.test(m))
    return 'La API no está habilitada en el proyecto de Google Cloud de la cuenta de servicio';
  if (/invalid_grant/i.test(m)) return 'No se puede suplantar a ese buzón (¿no existe, está suspendido o no tiene el servicio?)';
  if (/Not Authorized to access this resource|insufficient permissions|forbidden/i.test(m) || statusDe(e) === 403)
    return 'Ese buzón no tiene permiso para esto (si es Directory o Classroom, tiene que ser administrador)';
  return m.slice(0, 300);
}

// ── Diagnóstico ────────────────────────────────────────────────────────────────

export interface ComprobacionPermiso {
  clave:
    | 'directory'
    | 'classroom'
    | 'classroom-gestion'
    | 'classroom-rosters'
    | 'classroom-tareas'
    | 'classroom-anuncios'
    | 'classroom-temas'
    | 'calendar';
  nombre: string;
  scope: string;
  api: string;
  ok: boolean;
  detalle: string;
}

/**
 * Una llamada mínima de lectura a cada API, suplantando al admin. Lo que falla dice
 * exactamente qué tocar: el scope en la delegación o habilitar la API en Cloud.
 */
export async function comprobarPermisos(admin: string): Promise<ComprobacionPermiso[]> {
  const pruebas: [ComprobacionPermiso['clave'], string, string, string, () => Promise<string>][] = [
    [
      'directory',
      'Usuarios del dominio (Admin SDK)',
      SCOPE_DIRECTORY,
      'Admin SDK API',
      async () => {
        const { data } = await directory(admin).users.list({ customer: 'my_customer', maxResults: 1, fields: 'users(primaryEmail)' });
        return data.users?.length ? 'Se leen los usuarios del dominio' : 'Responde, pero sin usuarios';
      },
    ],
    [
      'classroom',
      'Clases de Classroom',
      SCOPE_CLASSROOM,
      'Google Classroom API',
      async () => {
        const { data } = await classroom(admin).courses.list({ pageSize: 1, fields: 'courses(id)' });
        return data.courses?.length ? 'Se leen las clases' : 'Responde, pero no ve ninguna clase';
      },
    ],
    [
      'classroom-gestion',
      'Classroom · borrar clases',
      SCOPE_CLASSROOM_GESTION,
      'Google Classroom API',
      // Sin llamada de verdad (sería escribir): basta con que Google dé el token con ese scope.
      async () => {
        await jwt(SCOPE_CLASSROOM_GESTION, admin).authorize();
        return 'Se pueden archivar y borrar clases';
      },
    ],
    [
      'classroom-rosters',
      'Classroom · añadir profes',
      SCOPE_CLASSROOM_ROSTERS,
      'Google Classroom API',
      async () => {
        await jwt(SCOPE_CLASSROOM_ROSTERS, admin).authorize();
        return 'Se puede matricular profesorado';
      },
    ],
    [
      'classroom-tareas',
      'Classroom · publicar tareas (Evaluaciones)',
      SCOPE_CLASSROOM_TAREAS,
      'Google Classroom API',
      async () => {
        await jwt(SCOPE_CLASSROOM_TAREAS, admin).authorize();
        return 'Se pueden publicar tareas en las tutorías';
      },
    ],
    [
      'classroom-anuncios',
      'Classroom · publicar anuncios (Evaluaciones)',
      SCOPE_CLASSROOM_ANUNCIOS,
      'Google Classroom API',
      async () => {
        await jwt(SCOPE_CLASSROOM_ANUNCIOS, admin).authorize();
        return 'Se pueden publicar anuncios en las tutorías';
      },
    ],
    [
      'classroom-temas',
      'Classroom · temas de las tareas (Evaluaciones)',
      SCOPE_CLASSROOM_TEMAS,
      'Google Classroom API',
      async () => {
        await jwt(SCOPE_CLASSROOM_TEMAS, admin).authorize();
        return 'Se crea el tema «Evaluamos» en cada tutoría';
      },
    ],
    [
      'calendar',
      'Google Calendar',
      SCOPE_CALENDAR,
      'Google Calendar API',
      async () => {
        await cal(admin).calendarList.list({ maxResults: 1, fields: 'items(id)' });
        return 'Se lee el calendario';
      },
    ],
  ];
  return Promise.all(
    pruebas.map(async ([clave, nombre, scope, api, fn]) => {
      try {
        return { clave, nombre, scope, api, ok: true, detalle: await fn() };
      } catch (e) {
        return { clave, nombre, scope, api, ok: false, detalle: explicarError(e) };
      }
    }),
  );
}

// ── Directory ──────────────────────────────────────────────────────────────────

export interface UsuarioDominio {
  id: string;
  email: string;
  suspendido: boolean;
}

function aUsuario(u: admin_directory_v1.Schema$User): UsuarioDominio | null {
  if (!u.id || !u.primaryEmail) return null;
  return { id: u.id, email: u.primaryEmail.toLowerCase(), suspendido: u.suspended === true || u.archived === true };
}

export async function paginaUsuarios(
  admin: string,
  pageToken: string | null,
  tamano: number,
): Promise<{ usuarios: UsuarioDominio[]; siguiente: string | null }> {
  const { data } = await conReintentos(() =>
    directory(admin).users.list({
      customer: 'my_customer',
      maxResults: tamano,
      orderBy: 'email',
      pageToken: pageToken ?? undefined,
      fields: 'nextPageToken,users(id,primaryEmail,suspended,archived)',
    }),
  );
  return {
    usuarios: (data.users ?? []).map(aUsuario).filter((u): u is UsuarioDominio => u !== null),
    siguiente: data.nextPageToken ?? null,
  };
}

/** id de Google → correo, de todo el dominio (Classroom da el `ownerId`, no el correo). */
export async function mapaUsuarios(admin: string): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  let token: string | null = null;
  do {
    const { usuarios, siguiente } = await paginaUsuarios(admin, token, 500);
    for (const u of usuarios) mapa.set(u.id, u.email);
    token = siguiente;
  } while (token);
  return mapa;
}

// ── Classroom ──────────────────────────────────────────────────────────────────

export interface ClaseClassroom {
  id: string;
  nombre: string | null;
  seccion: string | null;
  estado: string | null;
  creadaAt: Date | null;
  actualizadaAt: Date | null;
  ownerId: string | null;
  calendarId: string | null;
  /** El enlace a la clase en la web de Classroom. */
  enlace: string | null;
}

export async function paginaClases(
  admin: string,
  pageToken: string | null,
): Promise<{ clases: ClaseClassroom[]; siguiente: string | null }> {
  // Sin `courseStates`: salen TODAS (activas, archivadas, sin aceptar…). Es justo lo que
  // se quiere: las archivadas son las que más calendarios muertos dejan.
  const { data } = await conReintentos(() =>
    classroom(admin).courses.list({
      pageSize: 200,
      pageToken: pageToken ?? undefined,
      fields: 'nextPageToken,courses(id,name,section,courseState,creationTime,updateTime,ownerId,calendarId,alternateLink)',
    }),
  );
  return {
    clases: (data.courses ?? [])
      .filter((c) => c.id)
      .map((c) => ({
        id: c.id!,
        nombre: c.name ?? null,
        seccion: c.section ?? null,
        estado: c.courseState ?? null,
        creadaAt: c.creationTime ? new Date(c.creationTime) : null,
        actualizadaAt: c.updateTime ? new Date(c.updateTime) : null,
        ownerId: c.ownerId ?? null,
        calendarId: c.calendarId ?? null,
        enlace: c.alternateLink ?? null,
      })),
    siguiente: data.nextPageToken ?? null,
  };
}

export type ResultadoBorrarClase = { ok: true; yaNoExistia: boolean } | { ok: false; error: string };

/**
 * Elimina una clase de Classroom suplantando al admin (David lo pidió el 30-sep-2026 para
 * limpiar las de hace años). Classroom solo deja eliminar clases ARCHIVADAS —en la web es
 * igual: primero archivar, luego eliminar—, así que si no lo está se archiva antes. Aquí el
 * 404 sí es fiable: un admin ve todas las clases del dominio.
 *
 * No se lleva la carpeta de la clase en Drive (se queda en el Drive del profe) ni su
 * calendario, que se borra aparte (ver `borrarClases` en calendarios-server.ts).
 */
export async function borrarClase(admin: string, courseId: string, estado: string | null): Promise<ResultadoBorrarClase> {
  const c = classroom(admin, SCOPE_CLASSROOM_GESTION);
  try {
    if (estado !== 'ARCHIVED') {
      await conReintentos(() =>
        c.courses.patch({ id: courseId, updateMask: 'courseState', requestBody: { courseState: 'ARCHIVED' } }),
      );
    }
    await conReintentos(() => c.courses.delete({ id: courseId }));
    return { ok: true, yaNoExistia: false };
  } catch (e) {
    if (statusDe(e) === 404) return { ok: true, yaNoExistia: true };
    return { ok: false, error: explicarError(e) };
  }
}

export type ResultadoProfe = { ok: true; yaEstaba: boolean } | { ok: false; error: string };

/**
 * Mete a `email` como PROFE de una clase, suplantando al admin. Un administrador del dominio
 * puede añadir directamente (sin invitación) a cualquier cuenta del dominio. Si ya era profe,
 * Google da 409 y se cuenta como hecho.
 */
export async function anadirProfe(admin: string, courseId: string, email: string): Promise<ResultadoProfe> {
  try {
    await conReintentos(() =>
      classroom(admin, SCOPE_CLASSROOM_ROSTERS).courses.teachers.create({ courseId, requestBody: { userId: email } }),
    );
    return { ok: true, yaEstaba: false };
  } catch (e) {
    if (statusDe(e) === 409) return { ok: true, yaEstaba: true };
    return { ok: false, error: explicarError(e) };
  }
}

// ── Publicar en Classroom (Evaluaciones) ───────────────────────────────────────

/**
 * Las clases ACTIVAS de las que `profe` es profe, suplantándolo a él. Una cuenta solo puede
 * publicar en las clases donde es profe, así que esta lista ES el universo de tutorías
 * donde se puede publicar: quien las da de alta es quien decide dónde sale la evaluación.
 */
export async function clasesDondeEsProfe(profe: string): Promise<ClaseClassroom[]> {
  const c = classroom(profe);
  const out: ClaseClassroom[] = [];
  let token: string | undefined;
  do {
    const { data } = await conReintentos(() =>
      c.courses.list({
        teacherId: 'me',
        courseStates: ['ACTIVE'],
        pageSize: 200,
        pageToken: token,
        fields: 'nextPageToken,courses(id,name,section,courseState,creationTime,updateTime,ownerId,calendarId,alternateLink)',
      }),
    );
    for (const x of data.courses ?? []) {
      if (!x.id) continue;
      out.push({
        id: x.id,
        nombre: x.name ?? null,
        seccion: x.section ?? null,
        estado: x.courseState ?? null,
        creadaAt: x.creationTime ? new Date(x.creationTime) : null,
        actualizadaAt: x.updateTime ? new Date(x.updateTime) : null,
        ownerId: x.ownerId ?? null,
        calendarId: x.calendarId ?? null,
        enlace: x.alternateLink ?? null,
      });
    }
    token = data.nextPageToken ?? undefined;
  } while (token);
  return out;
}

export interface PublicacionClassroom {
  tipo: 'tarea' | 'anuncio';
  titulo: string;
  texto: string;
  /** El enlace va como material adjunto (sale como tarjeta clicable en Classroom). */
  enlace: string;
  /** Solo tarea: fecha límite en UTC. */
  limite?: { dueDate: { year: number; month: number; day: number }; dueTime: { hours: number; minutes: number } } | null;
  /** Si va en el futuro, Classroom la guarda como borrador programado y la publica él. */
  programadoPara?: Date | null;
  /** Solo tarea: nombre del tema donde colgarla (los anuncios no tienen temas). */
  tema?: string | null;
}

export type ResultadoPublicar =
  | { ok: true; id: string | null; enlace: string | null; /** Qué ha fallado sin impedir publicar (p. ej. el tema). */ aviso?: string }
  | { ok: false; error: string };

/**
 * El id del tema `nombre` en la clase (se crea si no existe), suplantando a `profe`. El tema es
 * orden, no contenido: si falla (falta el scope `classroom.topics`, por ejemplo) devuelve el
 * motivo y la tarea se publica igualmente, sin tema.
 */
async function temaDeClase(profe: string, courseId: string, nombre: string): Promise<{ id: string } | { error: string }> {
  try {
    const c = classroom(profe, SCOPE_CLASSROOM_TEMAS);
    let token: string | undefined;
    do {
      const { data } = await conReintentos(() =>
        c.courses.topics.list({ courseId, pageSize: 100, pageToken: token, fields: 'nextPageToken,topic(topicId,name)' }),
      );
      const hay = (data.topic ?? []).find((t) => t.name === nombre && t.topicId);
      if (hay?.topicId) return { id: hay.topicId };
      token = data.nextPageToken ?? undefined;
    } while (token);
    const { data } = await conReintentos(() => c.courses.topics.create({ courseId, requestBody: { name: nombre } }));
    return data.topicId ? { id: data.topicId } : { error: 'Classroom no devolvió el tema creado' };
  } catch (e) {
    return { error: explicarError(e) };
  }
}

/**
 * Publica la evaluación en una clase suplantando a `profe`, que tiene que ser profe de ella. Una
 * TAREA sin nota ni entrega: el alumno ve «Marcar como hecha» y el profe, quién la ha marcado.
 * Un ANUNCIO es un aviso en el tablón, sin fecha ni seguimiento.
 *
 * Ojo: Classroom solo deja modificar o borrar lo creado por el mismo proyecto de Google Cloud
 * (el de la cuenta de servicio), y de eso no hay nada que hacer desde aquí; lo que se publique
 * se retira a mano desde Classroom.
 */
export async function publicarEnClase(profe: string, courseId: string, p: PublicacionClassroom): Promise<ResultadoPublicar> {
  const programada = p.programadoPara && p.programadoPara.getTime() > Date.now() + 60_000 ? p.programadoPara : null;
  const estado = programada ? { state: 'DRAFT', scheduledTime: programada.toISOString() } : { state: 'PUBLISHED' };
  const materials = [{ link: { url: p.enlace, title: p.titulo.slice(0, 200) } }];
  try {
    if (p.tipo === 'tarea') {
      let topicId: string | undefined;
      let aviso: string | undefined;
      if (p.tema) {
        const t = await temaDeClase(profe, courseId, p.tema);
        if ('id' in t) topicId = t.id;
        else aviso = `Publicada sin tema «${p.tema}»: ${t.error}`;
      }
      const { data } = await conReintentos(() =>
        classroom(profe, SCOPE_CLASSROOM_TAREAS).courses.courseWork.create({
          courseId,
          requestBody: {
            title: p.titulo.slice(0, 3000),
            description: p.texto,
            workType: 'ASSIGNMENT',
            materials,
            topicId,
            ...(p.limite ?? {}),
            ...estado,
          },
        }),
      );
      return { ok: true, id: data.id ?? null, enlace: data.alternateLink ?? null, aviso };
    }
    const { data } = await conReintentos(() =>
      classroom(profe, SCOPE_CLASSROOM_ANUNCIOS).courses.announcements.create({
        courseId,
        requestBody: { text: `${p.titulo}\n\n${p.texto}`.slice(0, 30000), materials, ...estado },
      }),
    );
    return { ok: true, id: data.id ?? null, enlace: data.alternateLink ?? null };
  } catch (e) {
    // Los fallos de delegación (scope sin dar, API apagada…) ya los traduce `explicarError`; un
    // 403/404 que llega de verdad a Classroom es casi siempre «esta cuenta no es profe de esa clase».
    const delegacion = /unauthorized_client|accessNotConfigured|has not been used in project|is disabled|invalid_grant/i.test(mensajeDe(e));
    if (!delegacion && (statusDe(e) === 403 || statusDe(e) === 404)) {
      return { ok: false, error: `${profe} no es profe de esta clase (o la clase ya no está activa)` };
    }
    return { ok: false, error: explicarError(e) };
  }
}

export type ResultadoRetirar = { ok: true; yaNoExistia: boolean } | { ok: false; error: string };

/**
 * Borra de Classroom una tarea o un anuncio publicados por la app, suplantando a `profe`. Un
 * 404 se cuenta como hecho (ya la habían borrado a mano); un 403 casi siempre es que lo creó
 * otra cuenta u otro proyecto, y Classroom solo deja borrar lo propio.
 */
export async function retirarPublicacion(
  profe: string,
  courseId: string,
  tipo: 'tarea' | 'anuncio',
  postId: string,
): Promise<ResultadoRetirar> {
  try {
    if (tipo === 'tarea') {
      await conReintentos(() => classroom(profe, SCOPE_CLASSROOM_TAREAS).courses.courseWork.delete({ courseId, id: postId }));
    } else {
      await conReintentos(() => classroom(profe, SCOPE_CLASSROOM_ANUNCIOS).courses.announcements.delete({ courseId, id: postId }));
    }
    return { ok: true, yaNoExistia: false };
  } catch (e) {
    if (statusDe(e) === 404) return { ok: true, yaNoExistia: true };
    const delegacion = /unauthorized_client|accessNotConfigured|has not been used in project|is disabled|invalid_grant/i.test(mensajeDe(e));
    if (!delegacion && statusDe(e) === 403) {
      return { ok: false, error: 'Classroom no deja borrarla desde aquí (la creó otra cuenta o no es de esta app): se quita desde la propia clase' };
    }
    return { ok: false, error: explicarError(e) };
  }
}

// ── Calendar ───────────────────────────────────────────────────────────────────

export interface EntradaLista {
  id: string;
  nombre: string | null;
  descripcion: string | null;
  rol: string;
}

/** Los calendarios SECUNDARIOS que tiene alguien en su lista (ocultos incluidos). */
export async function calendariosDeUsuario(email: string): Promise<EntradaLista[]> {
  const c = cal(email);
  const salida: EntradaLista[] = [];
  let pageToken: string | undefined;
  do {
    const { data } = await conReintentos(() =>
      c.calendarList.list({
        showHidden: true,
        maxResults: 250,
        pageToken,
        fields: 'nextPageToken,items(id,summary,description,accessRole)',
      }),
    );
    for (const it of data.items ?? []) {
      if (!it.id || !esCalendarioSecundario(it.id)) continue;
      salida.push({ id: it.id, nombre: it.summary ?? null, descripcion: it.description ?? null, rol: it.accessRole ?? 'reader' });
    }
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);
  return salida;
}

/**
 * Cuántos eventos tiene un calendario, leyéndolo como `buzon`. Sin `singleEvents`: un evento
 * recurrente cuenta como uno, que es lo que se ve al borrarlo. Classroom solo mete fechas de
 * entrega, así que en la práctica son decenas, no miles.
 */
export async function contarEventos(buzon: string, calendarId: string, ahora = new Date()): Promise<ResumenEventos> {
  const c = cal(buzon);
  let r = RESUMEN_VACIO;
  let pageToken: string | undefined;
  do {
    const { data } = await conReintentos(() =>
      c.events.list({
        calendarId,
        maxResults: 2500,
        showDeleted: false,
        pageToken,
        fields: 'nextPageToken,items(status,start)',
      }),
    );
    r = acumularEventos(r, data.items ?? [], ahora);
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);
  return r;
}

export type ResultadoBorrado = { ok: true } | { ok: false; status: number | null; error: string };

/**
 * Borra un calendario secundario suplantando a `buzon`. Solo funciona si `buzon` es su
 * propietario. OJO con el 404: Calendar lo devuelve tanto si el calendario ya no existe
 * como si `buzon` no tiene acceso, así que aquí NO se interpreta; lo decide quien llama
 * (ver `borrarCalendarios` en calendarios-server.ts).
 */
export async function borrarCalendario(buzon: string, calendarId: string): Promise<ResultadoBorrado> {
  try {
    await conReintentos(() => cal(buzon).calendars.delete({ calendarId }));
    return { ok: true };
  } catch (e) {
    // Aquí un 403 no es cosa de administradores: es que ese buzón no es el dueño.
    const status = statusDe(e);
    const error = status === 403 ? 'No es el propietario del calendario (Google no le deja borrarlo)' : explicarError(e);
    return { ok: false, status, error };
  }
}

/** Reparte `fn` sobre `items` con `n` a la vez. Los errores los maneja `fn`. */
export async function enParalelo<T, R>(items: readonly T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const salida: R[] = new Array(items.length);
  let siguiente = 0;
  async function trabajador() {
    while (siguiente < items.length) {
      const i = siguiente++;
      salida[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, items.length)) }, trabajador));
  return salida;
}
