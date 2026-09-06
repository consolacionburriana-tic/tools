'use client';

// Generación de los ficheros en el propio navegador: ni el ZIP ni los CSV pasan por el
// servidor (no hay nada que pasarle: el proyecto ya está en el cliente).

import { ORDEN_ARCHIVOS, serializarArchivo, ESPEC, type ArchivoAsm, type FilaCsv, type OpcionesCsv } from '@/lib/autoasm';
import type { ProyectoAsm } from '@/lib/autoasm-construir';

function descargarBlob(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Se revoca en el siguiente tick: Safari cancela la descarga si se revoca a la vez.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function nombreZip(fecha = new Date()): string {
  const d = fecha.toISOString().slice(0, 10);
  return `asm-consolacion-${d}.zip`;
}

export function descargarCsv(archivo: ArchivoAsm, filas: FilaCsv[], opciones: OpcionesCsv): void {
  const texto = serializarArchivo(archivo, filas, opciones);
  descargarBlob(new Blob([texto], { type: 'text/csv;charset=utf-8' }), ESPEC[archivo].fichero);
}

export async function descargarZip(proyecto: ProyectoAsm): Promise<void> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (const archivo of ORDEN_ARCHIVOS) {
    zip.file(ESPEC[archivo].fichero, serializarArchivo(archivo, proyecto.archivos[archivo], proyecto.opciones.csv));
  }
  zip.file('LEEME.txt', leeme(proyecto));
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  descargarBlob(blob, nombreZip());
}

/** Nota dentro del ZIP: dentro de seis meses, nadie se acuerda de qué era este fichero. */
function leeme(proyecto: ProyectoAsm): string {
  const fecha = new Date().toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' });
  const filas = ORDEN_ARCHIVOS.map((a) => `  ${ESPEC[a].fichero.padEnd(15)} ${String(proyecto.archivos[a].length).padStart(6)} filas — ${ESPEC[a].titulo}`);
  return [
    'Apple School Manager · ficheros SIS del Colegio Consolación Burriana',
    `Generados con AUTOASM (tools.consolacionburriana.com) el ${fecha}.`,
    '',
    'Contenido:',
    ...filas,
    '',
    `Separador: "${proyecto.opciones.csv.delimitador}"  ·  Codificación: UTF-8${proyecto.opciones.csv.bom ? ' con BOM' : ''}`,
    '',
    'Cómo se suben (Apple School Manager → Ajustes → Datos de la institución):',
    '  1. Subir los seis CSV juntos, sin cambiarles el nombre.',
    '  2. ASM valida antes de aplicar: si algo falla, dice en qué fichero y fila.',
    '  3. Al aplicar, actualiza lo que ya existe (empareja por los identificadores) y',
    '     crea lo nuevo. Cambiar un identificador NO renombra: crea otro registro.',
    '',
    'AVISO: contiene datos personales de alumnado y profesorado. No dejar copias sueltas',
    'en Descargas ni en unidades compartidas.',
    '',
  ].join('\n');
}
