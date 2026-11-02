// «Guardar en mi Drive»: deja un Excel recién hecho en el Drive de QUIEN lo pide.
//
// David (2-nov-2026): «las listas e informes de alumnado, que si las quieren en Drive se creen
// con un click, de tipo Google Sheets o de tipo Excel». Y que se les recuerde que lo muevan
// donde quieran.
//
// La cuenta de servicio SUPLANTA a quien pulsa el botón (delegación de todo el dominio, como
// Calendario o Gmail): el archivo nace en su «Mi unidad», es suyo y de nadie más, y no queda
// ninguna copia con datos de alumnado en una carpeta del colegio. Se pide solo el scope
// `drive.file` —la cuenta de servicio solo ve lo que ella misma crea—, nunca `drive` entero.
//
// Con el truco de siempre (docs/04): se sube el .xlsx y Drive lo CONVIERTE a Google Sheet. La
// API de Sheets no está habilitada en el proyecto y aquí no hace falta.
//
// Quién llama (la ruta) ya ha comprobado permisos y alcance; esto solo sube lo que le dan.
import { Readable } from 'node:stream';
import { google } from 'googleapis';
import { MIME_GSHEET, MIME_XLSX, urlArchivo, urlHojaDeCalculo } from '@/lib/cuaderno/drive';
import { conReintentos, esErrorDeDelegacion, googleConfigurado, jwtGoogle, statusDe } from '@/lib/google-sa';

/** El permiso que hay que dar en la consola de admin (Seguridad → Control de API → Delegación). */
export const SCOPE_DRIVE_ARCHIVOS = 'https://www.googleapis.com/auth/drive.file';

export const FORMATOS_DRIVE = ['sheet', 'xlsx'] as const;
export type FormatoDrive = (typeof FORMATOS_DRIVE)[number];

export interface ArchivoEnDrive {
  id: string;
  /** Con el nombre que se ve en Drive (con acentos y espacios, no el del fichero que se descarga). */
  nombre: string;
  url: string;
  formato: FormatoDrive;
}

/** Un fallo que se le puede explicar a quien pulsó el botón, con el código HTTP que le toca. */
export class ErrorDrive extends Error {
  constructor(
    mensaje: string,
    readonly status: number,
  ) {
    super(mensaje);
    this.name = 'ErrorDrive';
  }
}

/** `2026-11-02` en hora de Madrid (a las 00:30 de allí no puede salir el día anterior). */
export function fechaParaNombre(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(ahora);
}

/**
 * El nombre que verá en su Drive: lo que es, y de cuándo es. La fecha va para que, si saca la
 * misma lista dos veces, se vea cuál es la buena (es una foto de ese día, no una hoja viva).
 */
export function nombreEnDrive(base: string, ahora: Date = new Date()): string {
  const limpio = base.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150) || 'Exportación';
  return `${limpio} · ${fechaParaNombre(ahora)}`;
}

/** Lo que se le dice a la persona cuando Google dice que no. Sin datos personales. */
export function explicarFalloDrive(e: unknown): ErrorDrive {
  if (e instanceof ErrorDrive) return e;
  if (esErrorDeDelegacion(e)) {
    // Es lo único que arregla TIC una vez y para siempre: el mensaje lo dice entero.
    return new ErrorDrive(
      'Guardar en Drive todavía no está activado en el colegio. Descarga el Excel mientras tanto y avisa a TIC: ' +
        'falta dar a la cuenta de servicio el permiso de Drive de archivos propios.',
      503,
    );
  }
  const status = statusDe(e);
  if (status === 403 && /storageQuotaExceeded|quota/i.test(String((e as Error)?.message ?? ''))) {
    return new ErrorDrive('Tu Drive está lleno: no hay sitio para guardar el archivo. Libera espacio o descárgalo.', 507);
  }
  if (status === 429 || (status !== null && status >= 500)) {
    return new ErrorDrive('Google no responde ahora mismo. Prueba otra vez en un minuto.', 503);
  }
  return new ErrorDrive('No se ha podido guardar en tu Drive. Descárgalo y vuelve a intentarlo más tarde.', 502);
}

/**
 * Sube `xlsx` a la «Mi unidad» de `email` (que tiene que ser una cuenta del dominio) y
 * devuelve dónde ha quedado. `sheet` lo convierte a Google Sheet; `xlsx` lo deja como Excel.
 * Cada vez crea un archivo nuevo: no pisa nada que ya tuviera.
 */
export async function guardarEnDriveDe(
  email: string,
  opciones: { nombre: string; xlsx: Buffer; formato: FormatoDrive },
): Promise<ArchivoEnDrive> {
  if (!googleConfigurado()) {
    throw new ErrorDrive('Guardar en Drive no está configurado en este entorno. Descarga el archivo.', 503);
  }
  const esSheet = opciones.formato === 'sheet';
  const nombre = esSheet ? opciones.nombre : `${opciones.nombre}.xlsx`;
  try {
    const drive = google.drive({ version: 'v3', auth: jwtGoogle(SCOPE_DRIVE_ARCHIVOS, email) });
    const res = await conReintentos(() =>
      drive.files.create({
        // Sin `parents`: va a la raíz de «Mi unidad», que es donde se lo vamos a decir.
        requestBody: { name: nombre, mimeType: esSheet ? MIME_GSHEET : MIME_XLSX },
        media: { mimeType: MIME_XLSX, body: Readable.from(opciones.xlsx) },
        fields: 'id',
      }),
    );
    const id = res.data.id;
    if (!id) throw new Error('Drive no devolvió el id del archivo creado');
    return { id, nombre, url: esSheet ? urlHojaDeCalculo(id) : urlArchivo(id), formato: opciones.formato };
  } catch (e) {
    throw explicarFalloDrive(e);
  }
}
