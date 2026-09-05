// Nombres de carpetas y archivos del cuaderno de tutor. Puro y testeado.
//
// Los nombres importan más de lo que parece: son lo que ve el tutor en su Drive y el orden
// en el que se los encuentra. El prefijo `1.1`, `1.2`… es el que hace que aparezcan
// ordenados solos, y el `1.x` / `2.x` es el juego de cada tutor cuando la clase lleva dos.

import { nivelDeCurso } from '@/lib/cursos';

/**
 * Etiqueta corta de una clase: `2ESO` + `A` → `2ºA`; PDC → `3ºPDC`.
 * Solo lleva el nivel y la letra porque siempre se lee dentro de un contexto que ya dice
 * la etapa (la carpeta del curso escolar, o la subcarpeta de etapa si la tirada abarca varias).
 */
export function claseCorta(curso: string, letra: string | null): string {
  const nivel = nivelDeCurso(curso);
  const base = nivel === 99 ? curso : `${nivel}º`;
  return letra ? `${base}${letra}` : base;
}

/** Nombre corto de un tutor: `María Remolar Gil` → `María R`. */
export function tutorCorto(nombre: string | null, apellido1: string | null): string {
  const pila = (nombre ?? '').trim();
  const inicial = (apellido1 ?? '').trim().charAt(0);
  if (!pila) return inicial ? `${inicial}.` : 'Sin tutor';
  return inicial ? `${pila} ${inicial}` : pila;
}

/** Nombre completo de un tutor, para el campo `<<tutor>>`. */
export function tutorCompleto(
  p: { nombre: string | null; apellido1: string | null; apellido2: string | null } | null,
): string {
  if (!p) return '';
  return [p.nombre, p.apellido1, p.apellido2].filter(Boolean).join(' ');
}

/** `2026-27` → `2026-2027`, que es como se escribe en las carpetas y en los documentos. */
export function cursoEscolarLargo(academicYear: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(academicYear);
  if (!m) return academicYear;
  return `${m[1]}-${m[1].slice(0, 2)}${m[2]}`;
}

export function carpetaCursoEscolar(academicYear: string): string {
  return `Cuaderno de tutor ${cursoEscolarLargo(academicYear)}`;
}

export const CARPETA_PLANTILLAS = '# Plantillas';

/**
 * Carpeta de la clase, con los tutores dentro del nombre: `2ºA — María R + Paola G`.
 * Es la carpeta que se comparte, así que el tutor la reconoce de un vistazo en "Compartido
 * conmigo".
 */
export function carpetaClase(curso: string, letra: string | null, tutores: readonly string[]): string {
  const clase = claseCorta(curso, letra);
  return tutores.length > 0 ? `${clase} — ${tutores.join(' + ')}` : `${clase} — sin tutor asignado`;
}

/**
 * Nombre del documento: `1.1 · Dossier Personal — María R — 2ºA`.
 * `indiceTutor` es el orden del tutor dentro de la clase (1, 2…) y `indicePlantilla` el
 * orden de la plantilla; juntos ordenan la carpeta como quiere el colegio: primero el juego
 * completo de un tutor, luego el del otro.
 */
export function nombreDocumento(opciones: {
  indiceTutor: number;
  indicePlantilla: number;
  plantilla: string;
  tutor: string;
  clase: string;
}): string {
  const { indiceTutor, indicePlantilla, plantilla, tutor, clase } = opciones;
  const partes = [plantilla, tutor, clase].filter((p) => p && p.trim() !== '');
  return `${indiceTutor}.${indicePlantilla} · ${partes.join(' — ')}`;
}

/** `aammdd`, para el nombre de la subcarpeta de una regeneración. */
export function fechaCorta(fecha: Date): string {
  const dosDigitos = (n: number) => String(n).padStart(2, '0');
  return `${dosDigitos(fecha.getFullYear() % 100)}${dosDigitos(fecha.getMonth() + 1)}${dosDigitos(fecha.getDate())}`;
}

/**
 * Subcarpeta de una tirada que no es la primera del curso: `260915 - Ejecución Cuaderno 2`.
 * Va DENTRO de la carpeta de la clase, que ya está compartida con sus tutores, así que el
 * alumnado que llega tarde no necesita compartir nada nuevo.
 */
export function carpetaEjecucion(numero: number, fecha: Date): string {
  return `${fechaCorta(fecha)} - Ejecución Cuaderno ${numero}`;
}

/** Nombre del PDF con todo el cuaderno de un tutor junto. */
export function nombreCuadernoCompleto(tutor: string, clase: string): string {
  return `0 · Cuaderno completo — ${tutor} — ${clase}`;
}

/**
 * Nº de lista tal y como se escribe en un listado. El número asignado se congela al
 * generar el cuaderno (lo que está impreso manda), pero el alumnado que llega a mitad de
 * curso entra en la lista por orden alfabético: en esos casos se escribe dónde le toca de
 * verdad, con un asterisco, y entre paréntesis el número que se le dio.
 */
export function numeroListaTexto(asignado: number, posicionAlfabetica: number): string {
  return asignado === posicionAlfabetica ? String(asignado) : `${posicionAlfabetica}* (${asignado})`;
}

/** Nombres de Drive: ni `/` ni saltos, y sin espacios de sobra. */
export function limpiarNombre(nombre: string): string {
  return nombre.replace(/[\\/\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}
