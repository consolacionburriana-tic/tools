// Helper único de Vercel Blob (acceso PRIVADO): los archivos jamás son públicos,
// se sirven por rutas API que comprueban permisos. Requiere BLOB_READ_WRITE_TOKEN.
import { del, get, put } from '@vercel/blob';

export const BLOB_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const TIPOS_PERMITIDOS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heic',
  'application/pdf': 'pdf',
};

export function extensionPermitida(contentType: string): string | null {
  return TIPOS_PERMITIDOS[contentType.toLowerCase()] ?? null;
}

function requireToken() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('Falta BLOB_READ_WRITE_TOKEN (Vercel → Storage → Blob; copia la var a .env.local)');
  }
}

/** Sube un archivo privado. Devuelve el pathname (lo que se guarda en BBDD). */
export async function subirPrivado(pathname: string, file: File): Promise<string> {
  requireToken();
  if (file.size > BLOB_MAX_BYTES) throw new Error('El archivo supera los 10 MB');
  const ext = extensionPermitida(file.type);
  if (!ext) throw new Error('Formato no permitido (usa jpg, png, heic o pdf)');
  const blob = await put(`${pathname}.${ext}`, file, {
    access: 'private',
    contentType: file.type,
    addRandomSuffix: true,
  });
  return blob.pathname;
}

/** Stream de un archivo privado para servirlo tras comprobar permisos. */
export async function leerPrivado(pathname: string) {
  requireToken();
  const res = await get(pathname, { access: 'private' });
  if (!res) throw new Error('Archivo no encontrado');
  return res;
}

export async function borrarPrivado(pathname: string): Promise<void> {
  requireToken();
  await del(pathname);
}
