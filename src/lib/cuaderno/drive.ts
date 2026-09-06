// Google Drive para el cuaderno de tutor. Es el único fichero del módulo que habla por red.
//
// Usa la MISMA cuenta de servicio que el Sheet de Licencias y el envío por Gmail
// (`GOOGLE_SA_CLIENT_EMAIL` / `GOOGLE_SA_PRIVATE_KEY`), pero **sin delegación de dominio**:
// la carpeta base vive en una unidad compartida donde la cuenta de servicio es miembro, así
// que los archivos son del colegio y no de la cuenta de servicio. Esto es importante: en
// "Mi unidad" una cuenta de servicio no tiene cuota propia, y lo que creara allí quedaría
// en su propiedad y sin poder traspasarse.
//
// Con Drive basta para todo: exportar la plantilla a .docx, subir el relleno CON CONVERSIÓN
// a Google Doc (sale un documento nativo y editable), sacar el PDF y compartir la carpeta.
// La API de Docs no se usa.
import { Readable } from 'node:stream';
import { google } from 'googleapis';
import type { drive_v3 } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/drive'];

export const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const MIME_GDOC = 'application/vnd.google-apps.document';
export const MIME_CARPETA = 'application/vnd.google-apps.folder';
export const MIME_PDF = 'application/pdf';

/** Común a todas las llamadas: sin esto, las unidades compartidas no existen para la API. */
const EN_UNIDADES_COMPARTIDAS = { supportsAllDrives: true } as const;

function credenciales(): { clientEmail: string; privateKey: string } | null {
  const clientEmail = process.env.GOOGLE_SA_CLIENT_EMAIL ?? process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = (process.env.GOOGLE_SA_PRIVATE_KEY ?? process.env.GOOGLE_SHEETS_PRIVATE_KEY)?.replace(
    /\\n/g,
    '\n',
  );
  if (!clientEmail || !privateKey) return null;
  return { clientEmail, privateKey };
}

export function driveConfigurado(): boolean {
  return credenciales() !== null;
}

export function cuentaDeServicio(): string | null {
  return credenciales()?.clientEmail ?? null;
}

let cliente: drive_v3.Drive | null = null;

export function getDrive(): drive_v3.Drive {
  if (cliente) return cliente;
  const cred = credenciales();
  if (!cred) throw new Error('Faltan GOOGLE_SA_CLIENT_EMAIL / GOOGLE_SA_PRIVATE_KEY en el entorno');
  const auth = new google.auth.JWT({ email: cred.clientEmail, key: cred.privateKey, scopes: SCOPES });
  cliente = google.drive({ version: 'v3', auth });
  return cliente;
}

// ─── URLs e ids ───────────────────────────────────────────────────────────────

/**
 * Id de Drive a partir de lo que David pegue: la URL de un documento, la de una carpeta, o
 * el id pelado. Devuelve null si no hay nada reconocible.
 */
export function extraerIdDrive(entrada: string): string | null {
  const texto = entrada.trim();
  if (!texto) return null;
  const patrones = [
    /\/document\/d\/([a-zA-Z0-9_-]{10,})/,
    /\/spreadsheets\/d\/([a-zA-Z0-9_-]{10,})/,
    /\/file\/d\/([a-zA-Z0-9_-]{10,})/,
    /\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]{10,})/,
    /\/folders\/([a-zA-Z0-9_-]{10,})/,
    /[?&]id=([a-zA-Z0-9_-]{10,})/,
  ];
  for (const p of patrones) {
    const m = p.exec(texto);
    if (m) return m[1];
  }
  return /^[a-zA-Z0-9_-]{20,}$/.test(texto) ? texto : null;
}

export const urlDocumento = (id: string) => `https://docs.google.com/document/d/${id}/edit`;
export const urlCarpeta = (id: string) => `https://drive.google.com/drive/folders/${id}`;
export const urlArchivo = (id: string) => `https://drive.google.com/file/d/${id}/view`;

// ─── Reintentos ───────────────────────────────────────────────────────────────

interface ErrorGoogle {
  code?: number;
  status?: number;
  errors?: { reason?: string }[];
  message?: string;
}

function codigoDe(error: unknown): number | null {
  const e = error as ErrorGoogle;
  return e?.code ?? e?.status ?? null;
}

/** ¿Merece la pena reintentar? Cuota, rate limit y errores de servidor: sí. Un 404: no. */
function reintentable(error: unknown): boolean {
  const codigo = codigoDe(error);
  if (codigo === 429 || codigo === 500 || codigo === 502 || codigo === 503 || codigo === 504) return true;
  const razones = (error as ErrorGoogle)?.errors?.map((e) => e.reason ?? '') ?? [];
  return razones.some((r) => r === 'rateLimitExceeded' || r === 'userRateLimitExceeded' || r === 'backendError');
}

/** Mensaje corto y sin datos personales para guardar en `cuad_items.error`. */
export function mensajeDeError(error: unknown): string {
  const e = error as ErrorGoogle;
  const codigo = codigoDe(error);
  const texto = e?.message ?? String(error);
  return codigo ? `${codigo}: ${texto}`.slice(0, 400) : texto.slice(0, 400);
}

async function conReintentos<T>(operacion: () => Promise<T>, intentos = 4): Promise<T> {
  let ultimo: unknown;
  for (let i = 0; i < intentos; i++) {
    try {
      return await operacion();
    } catch (error) {
      ultimo = error;
      if (!reintentable(error) || i === intentos - 1) throw error;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
  throw ultimo;
}

// ─── Operaciones ──────────────────────────────────────────────────────────────

/** Metadatos básicos de un archivo, para comprobar accesos antes de una tirada. */
export async function infoArchivo(fileId: string): Promise<{ id: string; nombre: string; mimeType: string }> {
  const drive = getDrive();
  const res = await conReintentos(() =>
    drive.files.get({ fileId, fields: 'id,name,mimeType', ...EN_UNIDADES_COMPARTIDAS }),
  );
  return { id: res.data.id ?? fileId, nombre: res.data.name ?? '', mimeType: res.data.mimeType ?? '' };
}

/** Exporta un Google Doc a .docx. Se hace una vez por plantilla y tirada, y se reutiliza. */
export async function exportarDocx(fileId: string): Promise<Buffer> {
  const drive = getDrive();
  const res = await conReintentos(() =>
    drive.files.export({ fileId, mimeType: MIME_DOCX }, { responseType: 'arraybuffer' }),
  );
  return Buffer.from(res.data as ArrayBuffer);
}

/** Exporta un Google Doc a PDF. */
export async function exportarPdf(fileId: string): Promise<Buffer> {
  const drive = getDrive();
  const res = await conReintentos(() =>
    drive.files.export({ fileId, mimeType: MIME_PDF }, { responseType: 'arraybuffer' }),
  );
  return Buffer.from(res.data as ArrayBuffer);
}

/** Descarga un archivo binario de Drive (para unir los PDF del cuaderno completo). */
export async function descargarArchivo(fileId: string): Promise<Buffer> {
  const drive = getDrive();
  const res = await conReintentos(() =>
    drive.files.get({ fileId, alt: 'media', ...EN_UNIDADES_COMPARTIDAS }, { responseType: 'arraybuffer' }),
  );
  return Buffer.from(res.data as ArrayBuffer);
}

/**
 * Sube un .docx **convirtiéndolo** a Google Doc. Es el paso que hace que el resultado sea
 * un documento nativo, editable por el tutor, y no un adjunto de Word.
 */
export async function subirComoGoogleDoc(opciones: {
  nombre: string;
  carpetaId: string;
  docx: Buffer;
}): Promise<{ id: string; url: string }> {
  const drive = getDrive();
  const res = await conReintentos(() =>
    drive.files.create({
      requestBody: { name: opciones.nombre, parents: [opciones.carpetaId], mimeType: MIME_GDOC },
      media: { mimeType: MIME_DOCX, body: Readable.from(opciones.docx) },
      fields: 'id',
      ...EN_UNIDADES_COMPARTIDAS,
    }),
  );
  const id = res.data.id;
  if (!id) throw new Error('Drive no devolvió el id del documento creado');
  return { id, url: urlDocumento(id) };
}

/** Sube un PDF tal cual (sin conversión). */
export async function subirPdf(opciones: {
  nombre: string;
  carpetaId: string;
  pdf: Buffer;
}): Promise<{ id: string; url: string }> {
  const drive = getDrive();
  const res = await conReintentos(() =>
    drive.files.create({
      requestBody: { name: opciones.nombre, parents: [opciones.carpetaId], mimeType: MIME_PDF },
      media: { mimeType: MIME_PDF, body: Readable.from(opciones.pdf) },
      fields: 'id',
      ...EN_UNIDADES_COMPARTIDAS,
    }),
  );
  const id = res.data.id;
  if (!id) throw new Error('Drive no devolvió el id del PDF creado');
  return { id, url: urlArchivo(id) };
}

const escaparConsulta = (texto: string) => texto.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

/** Busca un archivo por nombre exacto dentro de una carpeta. */
export async function buscarEnCarpeta(
  nombre: string,
  padreId: string,
  mimeType?: string,
): Promise<{ id: string; nombre: string } | null> {
  const drive = getDrive();
  const filtros = [
    `name = '${escaparConsulta(nombre)}'`,
    `'${escaparConsulta(padreId)}' in parents`,
    'trashed = false',
  ];
  if (mimeType) filtros.push(`mimeType = '${mimeType}'`);
  const res = await conReintentos(() =>
    drive.files.list({
      q: filtros.join(' and '),
      fields: 'files(id,name)',
      pageSize: 5,
      includeItemsFromAllDrives: true,
      ...EN_UNIDADES_COMPARTIDAS,
    }),
  );
  const archivo = res.data.files?.[0];
  return archivo?.id ? { id: archivo.id, nombre: archivo.name ?? nombre } : null;
}

/**
 * Carpeta con ese nombre dentro del padre: la reutiliza si ya existe. Idempotente a
 * propósito — una tirada que se reintenta no debe dejar cinco carpetas "2ºA — María R".
 */
/** `nueva` dice si la ha creado esta llamada o ya estaba: quien lo pregunta decide con eso. */
export async function asegurarCarpeta(
  nombre: string,
  padreId: string,
): Promise<{ id: string; url: string; nueva: boolean }> {
  const existente = await buscarEnCarpeta(nombre, padreId, MIME_CARPETA);
  if (existente) return { id: existente.id, url: urlCarpeta(existente.id), nueva: false };
  const drive = getDrive();
  const res = await conReintentos(() =>
    drive.files.create({
      requestBody: { name: nombre, parents: [padreId], mimeType: MIME_CARPETA },
      fields: 'id',
      ...EN_UNIDADES_COMPARTIDAS,
    }),
  );
  const id = res.data.id;
  if (!id) throw new Error(`No se pudo crear la carpeta «${nombre}»`);
  return { id, url: urlCarpeta(id), nueva: true };
}

/** Copia un archivo (se usa para dejar las plantillas usadas en `# Plantillas`). */
export async function copiarArchivo(
  fileId: string,
  nombre: string,
  carpetaId: string,
): Promise<{ id: string; url: string }> {
  const drive = getDrive();
  const res = await conReintentos(() =>
    drive.files.copy({
      fileId,
      requestBody: { name: nombre, parents: [carpetaId] },
      fields: 'id',
      ...EN_UNIDADES_COMPARTIDAS,
    }),
  );
  const id = res.data.id;
  if (!id) throw new Error('Drive no devolvió el id de la copia');
  return { id, url: urlDocumento(id) };
}

/** Borra de verdad (no a la papelera). Se usa al reintentar un ítem que dejó basura. */
export async function borrarArchivo(fileId: string): Promise<void> {
  const drive = getDrive();
  try {
    await conReintentos(() => drive.files.delete({ fileId, ...EN_UNIDADES_COMPARTIDAS }));
  } catch (error) {
    // Que no exista es el estado deseado: no es un fallo.
    if (codigoDe(error) !== 404) throw error;
  }
}

export type RolDrive = 'reader' | 'writer' | 'commenter';

/**
 * Comparte una carpeta con un correo concreto. **Nunca** por enlace: estos documentos
 * llevan datos de alumnado y de familias, así que siempre permiso nominal.
 * Si ya estaba compartida con esa persona, no hace nada.
 */
export async function compartirCarpeta(
  carpetaId: string,
  email: string,
  rol: RolDrive = 'writer',
  avisarPorCorreo = false,
): Promise<'nuevo' | 'ya-estaba'> {
  const drive = getDrive();
  const permisos = await conReintentos(() =>
    drive.permissions.list({
      fileId: carpetaId,
      fields: 'permissions(id,emailAddress,role)',
      pageSize: 100,
      ...EN_UNIDADES_COMPARTIDAS,
    }),
  );
  const normalizado = email.trim().toLowerCase();
  const ya = permisos.data.permissions?.some((p) => (p.emailAddress ?? '').toLowerCase() === normalizado);
  if (ya) return 'ya-estaba';
  await conReintentos(() =>
    drive.permissions.create({
      fileId: carpetaId,
      requestBody: { type: 'user', role: rol, emailAddress: email },
      sendNotificationEmail: avisarPorCorreo,
      ...EN_UNIDADES_COMPARTIDAS,
    }),
  );
  return 'nuevo';
}

/**
 * Comprobación previa de una tirada: que la carpeta base existe, que se puede escribir en
 * ella y que es de una unidad compartida. Lo que evita descubrir a mitad de las 125
 * carpetas que la cuenta de servicio no tenía permiso.
 */
export async function comprobarCarpetaBase(carpetaBaseId: string): Promise<{
  ok: boolean;
  nombre?: string;
  unidadCompartida: boolean;
  puedeEscribir: boolean;
  error?: string;
}> {
  try {
    const drive = getDrive();
    const res = await conReintentos(() =>
      drive.files.get({
        fileId: carpetaBaseId,
        fields: 'id,name,mimeType,driveId,capabilities(canAddChildren,canShare)',
        ...EN_UNIDADES_COMPARTIDAS,
      }),
    );
    if (res.data.mimeType !== MIME_CARPETA) {
      return { ok: false, unidadCompartida: false, puedeEscribir: false, error: 'Ese enlace no es una carpeta' };
    }
    const unidadCompartida = Boolean(res.data.driveId);
    const puedeEscribir = Boolean(res.data.capabilities?.canAddChildren);
    return {
      ok: unidadCompartida && puedeEscribir,
      nombre: res.data.name ?? undefined,
      unidadCompartida,
      puedeEscribir,
      error: !unidadCompartida
        ? 'La carpeta no está en una unidad compartida: los archivos quedarían en propiedad de la cuenta de servicio, que no tiene cuota. Muévela a una unidad compartida.'
        : !puedeEscribir
          ? 'La cuenta de servicio no puede crear archivos ahí: dale «Administrador de contenido» en la unidad compartida.'
          : undefined,
    };
  } catch (error) {
    return { ok: false, unidadCompartida: false, puedeEscribir: false, error: mensajeDeError(error) };
  }
}
