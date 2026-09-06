// AUTOASM · subir los seis CSV al FTP de Apple School Manager.
//
// Es el paso que hoy hace David a mano y que aquí es **opcional**: se genera el ZIP y
// luego se elige entre "ya lo subo yo" (que solo lo apunta en el histórico) o "súbelo tú".
//
// Se admiten los tres sabores que puede pedir un servidor: FTP a secas, FTPS (FTP sobre
// TLS, lo normal hoy) y SFTP (que es SSH y no tiene nada que ver con los otros dos, de ahí
// que use otra librería). Los ficheros van SIEMPRE con su nombre canónico y sin ZIP: ASM
// espera los CSV sueltos en la carpeta.

import type { ArchivoAsm } from '@/lib/autoasm';

export interface FicheroASubir {
  nombre: string;
  contenido: string;
  archivo?: ArchivoAsm;
}

export interface DestinoFtp {
  protocolo: 'ftps' | 'ftp' | 'sftp';
  host: string;
  puerto: number | null;
  usuario: string;
  password: string;
  ruta: string;
}

export interface ResultadoSubida {
  ok: boolean;
  subidos: string[];
  destino: string;
  /** Traza corta de la conversación con el servidor, para poder pegarla en un correo. */
  detalle: string;
  error?: string;
}

function rutaRemota(ruta: string, nombre: string): string {
  const base = ruta.replace(/\/+$/, '');
  return `${base}/${nombre}`;
}

export async function subirFicheros(destino: DestinoFtp, ficheros: FicheroASubir[]): Promise<ResultadoSubida> {
  const etiqueta = `${destino.protocolo}://${destino.host}${destino.ruta}`;
  try {
    const subidos = destino.protocolo === 'sftp'
      ? await subirPorSftp(destino, ficheros)
      : await subirPorFtp(destino, ficheros);
    return { ok: true, subidos, destino: etiqueta, detalle: `${subidos.length} ficheros en ${etiqueta}` };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    return { ok: false, subidos: [], destino: etiqueta, detalle: mensaje, error: mensaje };
  }
}

async function subirPorFtp(destino: DestinoFtp, ficheros: FicheroASubir[]): Promise<string[]> {
  const { Client } = await import('basic-ftp');
  const { Readable } = await import('node:stream');
  const cliente = new Client(30_000);
  try {
    await cliente.access({
      host: destino.host,
      port: destino.puerto ?? 21,
      user: destino.usuario,
      password: destino.password,
      secure: destino.protocolo === 'ftps',
    });
    if (destino.ruta && destino.ruta !== '/') await cliente.ensureDir(destino.ruta);
    const subidos: string[] = [];
    for (const fichero of ficheros) {
      await cliente.uploadFrom(Readable.from([fichero.contenido]), fichero.nombre);
      subidos.push(fichero.nombre);
    }
    return subidos;
  } finally {
    cliente.close();
  }
}

async function subirPorSftp(destino: DestinoFtp, ficheros: FicheroASubir[]): Promise<string[]> {
  const { default: Cliente } = await import('ssh2-sftp-client');
  const cliente = new Cliente();
  try {
    await cliente.connect({
      host: destino.host,
      port: destino.puerto ?? 22,
      username: destino.usuario,
      password: destino.password,
      readyTimeout: 30_000,
    });
    if (destino.ruta && destino.ruta !== '/' && !(await cliente.exists(destino.ruta))) {
      await cliente.mkdir(destino.ruta, true);
    }
    const subidos: string[] = [];
    for (const fichero of ficheros) {
      await cliente.put(Buffer.from(fichero.contenido, 'utf8'), rutaRemota(destino.ruta, fichero.nombre));
      subidos.push(fichero.nombre);
    }
    return subidos;
  } finally {
    await cliente.end();
  }
}
