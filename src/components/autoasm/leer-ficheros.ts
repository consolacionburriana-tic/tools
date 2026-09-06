'use client';

// Lectura de lo que suelta el usuario: un ZIP (el que se descargó el año pasado, o el
// que exporta ASM) o CSV sueltos. Todo en el navegador.

import {
  archivoDeNombre,
  archivoPorCabeceras,
  leerArchivo,
  parseCsv,
  type ArchivoAsm,
  type FilaCsv,
} from '@/lib/autoasm';

export interface LecturaAsm {
  archivos: Partial<Record<ArchivoAsm, FilaCsv[]>>;
  /** Qué se ha leído de dónde, para contarlo en pantalla. */
  detalle: { archivo: ArchivoAsm; origen: string; filas: number }[];
  avisos: string[];
  ignorados: string[];
}

function esRuidoDeZip(nombre: string): boolean {
  const base = nombre.split('/').pop() ?? '';
  return nombre.startsWith('__MACOSX/') || base.startsWith('.') || base === '' || nombre.endsWith('/');
}

async function textosDe(files: File[]): Promise<{ nombre: string; texto: string }[]> {
  const salida: { nombre: string; texto: string }[] = [];
  for (const file of files) {
    if (/\.zip$/i.test(file.name)) {
      const { default: JSZip } = await import('jszip');
      const zip = await JSZip.loadAsync(file);
      for (const [nombre, entrada] of Object.entries(zip.files)) {
        if (entrada.dir || esRuidoDeZip(nombre) || !/\.csv$/i.test(nombre)) continue;
        salida.push({ nombre, texto: await entrada.async('string') });
      }
    } else {
      salida.push({ nombre: file.name, texto: await file.text() });
    }
  }
  return salida;
}

export async function leerFicherosAsm(files: File[]): Promise<LecturaAsm> {
  const lectura: LecturaAsm = { archivos: {}, detalle: [], avisos: [], ignorados: [] };

  for (const { nombre, texto } of await textosDe(files)) {
    // Primero por nombre (`students.csv`), y si no, por las columnas que trae dentro.
    const archivo = archivoDeNombre(nombre) ?? archivoPorCabeceras(parseCsv(texto).cabeceras);
    if (!archivo) {
      lectura.ignorados.push(nombre);
      continue;
    }
    const resultado = leerArchivo(archivo, texto);
    lectura.archivos[archivo] = resultado.filas;
    lectura.detalle.push({ archivo, origen: nombre, filas: resultado.filas.length });
    for (const aviso of resultado.avisos) lectura.avisos.push(`${nombre}: ${aviso}`);
  }

  return lectura;
}
