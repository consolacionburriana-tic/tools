// Cifrado simétrico para los pocos secretos que la plataforma tiene que guardar en la
// base de datos y volver a usar en claro — hoy, la contraseña del FTP de Apple School
// Manager (`asm_ftp_config`). No es para contraseñas de personas: esas no se descifran
// nunca, se hashean, y aquí no hay ninguna.
//
// AES-256-GCM: cifra y además autentica, así que un valor manipulado en la base de datos
// no se descifra en silencio, revienta. La clave sale de `AUTOASM_CRYPTO_KEY` si existe y,
// si no, de `AUTH_SECRET` (que ya es obligatorio y secreto en esta app) derivada con
// scrypt — así no hace falta añadir una variable nueva en Vercel para estrenarlo.
//
// Formato guardado: `v1.<iv>.<tag>.<datos>`, los tres en base64url.

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const VERSION = 'v1';
const SAL = 'autoasm-cripto-v1';

function clave(): Buffer {
  const secreto = process.env.AUTOASM_CRYPTO_KEY || process.env.AUTH_SECRET;
  if (!secreto) throw new Error('Falta AUTH_SECRET (o AUTOASM_CRYPTO_KEY) para cifrar secretos');
  return scryptSync(secreto, SAL, 32);
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', clave(), iv);
  const datos = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  return [VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), datos.toString('base64url')].join('.');
}

export function descifrar(valor: string): string {
  const [version, iv, tag, datos] = valor.split('.');
  if (version !== VERSION || !iv || !tag || !datos) throw new Error('Secreto guardado con un formato que no reconozco');
  const decipher = createDecipheriv('aes-256-gcm', clave(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(datos, 'base64url')), decipher.final()]).toString('utf8');
}
