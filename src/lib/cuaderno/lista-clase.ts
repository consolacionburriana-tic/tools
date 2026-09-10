// La «Lista en Excel» de una clase, tal y como la lleva haciendo el colegio a mano cada
// septiembre: una hoja por clase con el alumnado numerado, sus datos y los de sus dos
// familiares de contacto.
//
// El modelo es literal: el Google Sheet «# 1 ESO - 25/26 Lista en Excel» de David. Mismas
// 18 columnas y en el mismo orden, mismos títulos (los que usan como `headerMap` los merges
// de autoCrat), mismas fórmulas en las columnas derivadas y el mismo aire — cabecera de
// color con el texto en blanco, nº de lista en amarillo, fila 1 congelada y con filtro.
// Que sea idéntico no es capricho: los merges y los guiones que el claustro ya tiene
// montados buscan las columnas **por título**, así que renombrar una rompe su trabajo.
//
// Aquí no hay red ni BBDD: entra una `ClaseCuaderno` (lo que ya sabe `cuaderno-server`) y
// sale el modelo de libro que `src/lib/xlsx-escribir.ts` convierte en fichero.
// Testeado en `src/lib/__tests__/cuaderno-lista-clase.test.ts`.
import type { AlumnoCuaderno, ClaseCuaderno } from '@/lib/cuaderno-server';
import { claseCorta, cursoEscolarLargo } from '@/lib/cuaderno/nombres';
import type { EntradaCelda, EstiloCelda, Hoja, Libro } from '@/lib/xlsx-escribir';

/** Las 18 columnas del modelo, en su orden. Los títulos son contrato: no se tocan. */
export const COLUMNAS = [
  { titulo: 'N', ancho: 4.38 },
  { titulo: 'Nombre', ancho: 8.75 },
  { titulo: 'Apellido 1', ancho: 18.88 },
  { titulo: 'Apellido 2', ancho: 14.5 },
  { titulo: 'Apellidos', ancho: 18.88 },
  { titulo: 'Nombre apellido', ancho: 14.5 },
  { titulo: 'Nombre apellido Lista', ancho: 33.38 },
  { titulo: 'Clase', ancho: 12.88 },
  { titulo: 'Tutor', ancho: 14.5 },
  { titulo: 'Mail', ancho: 33.38 },
  { titulo: 'NIA', ancho: 11.88 },
  { titulo: 'Nacimiento', ancho: 12.88 },
  { titulo: 'Familiar 1', ancho: 22 },
  { titulo: 'TLF Fam 1', ancho: 13 },
  { titulo: 'Mail Familiar 1', ancho: 31.25 },
  { titulo: 'Familiar 2', ancho: 22 },
  { titulo: 'TLF Fam 2', ancho: 13 },
  { titulo: 'Mail Fam 2', ancho: 29.63 },
] as const;

/**
 * Colores de cabecera y pestaña, uno por clase. Salen de la paleta del Sheet de David
 * (los `accent` del tema de Google) y se reparten por orden alfabético de clase, así que
 * la misma clase sale siempre del mismo color mientras no cambie el listado del centro.
 */
export const COLORES = [
  { cabecera: '46BDC6', pestana: '9FC5E8' }, // turquesa (1º ESO A en el original)
  { cabecera: 'FBBC04', pestana: 'F1C232' }, // dorado (1º ESO B en el original)
  { cabecera: '34A853', pestana: 'B6D7A8' }, // verde
  { cabecera: '4285F4', pestana: 'A4C2F4' }, // azul
  { cabecera: 'EA4335', pestana: 'EA9999' }, // rojo
  { cabecera: 'FF6D01', pestana: 'F9CB9C' }, // naranja
  { cabecera: '9900FF', pestana: 'B4A7D6' }, // morado
  { cabecera: '795548', pestana: 'D7CCC8' }, // marrón
] as const;

export const colorDeClase = (indice: number) => COLORES[indice % COLORES.length];

const FUENTE_TITULOS = 'PT Sans'; // la del original; si no está, Sheets cae a su sustituta

const estiloCabecera = (fondo: string): EstiloCelda => ({
  fuente: FUENTE_TITULOS,
  negrita: true,
  color: 'FFFFFF',
  fondo,
  horizontal: 'center',
  vertical: 'center',
  ajustarTexto: true,
});

const ESTILO_NUMERO: EstiloCelda = {
  fuente: FUENTE_TITULOS,
  negrita: true,
  fondo: 'FFFF00',
  horizontal: 'center',
  vertical: 'center',
};

const ESTILO_NOMBRE: EstiloCelda = { fuente: FUENTE_TITULOS };

/** El nº de fila real del alumno `i` (fila 1 = cabecera). */
const filaDe = (i: number) => i + 2;

/** Sin familiar 2 la celda va vacía, no con la palabra «null» dentro. */
const dato = (valor: string | null | undefined) => (valor && valor.trim() !== '' ? valor.trim() : '');

/**
 * Un NIA es un identificador, no una cantidad: se escribe como texto. Si fuera número, el
 * `11430523` de un alumno y el `011430523` de otro serían la misma celda, y los ceros a la
 * izquierda que trae Educamos en algunos NIA desaparecerían al primer guardado.
 */
const nia = (valor: string) => dato(valor);

/** `'2013-01-29'` → la fecha local de ese día. Sin hora: es un cumpleaños, no un instante. */
export function fechaNacimiento(iso: string | null): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** La fila de un alumno. `tutor` es el nombre corto del tutor/a de su clase. */
export function filaAlumno(alumno: AlumnoCuaderno, opciones: { numero: number; clase: string; tutor: string; indice: number }): EntradaCelda[] {
  const f = filaDe(opciones.indice);
  const [familiar1, familiar2] = [alumno.familiares[0], alumno.familiares[1]];
  return [
    { valor: opciones.numero, estilo: ESTILO_NUMERO },
    { valor: dato(alumno.nombre), estilo: ESTILO_NOMBRE },
    { valor: dato(alumno.apellido1), estilo: ESTILO_NOMBRE },
    { valor: dato(alumno.apellido2), estilo: ESTILO_NOMBRE },
    // Las tres derivadas van como FÓRMULA, igual que en el original: si el tutor corrige un
    // apellido a mano en su copia, «Apellidos» y los dos «Nombre apellido» se enteran solos.
    { formula: `CONCATENATE(C${f}," ",D${f})`, estilo: ESTILO_NOMBRE },
    { formula: `CONCATENATE(B${f}," ",C${f})`, estilo: ESTILO_NOMBRE },
    { formula: `CONCATENATE(A${f},". ",B${f}," ",C${f})`, estilo: ESTILO_NOMBRE },
    { valor: opciones.clase, estilo: ESTILO_NOMBRE },
    { valor: opciones.tutor, estilo: ESTILO_NOMBRE },
    dato(alumno.email),
    nia(alumno.nia),
    fechaNacimiento(alumno.fechaNacimiento),
    dato(familiar1?.nombre),
    dato(familiar1?.telefono),
    dato(familiar1?.correo),
    dato(familiar2?.nombre),
    dato(familiar2?.telefono),
    dato(familiar2?.correo),
  ];
}

export interface OpcionesLista {
  /** Nº de lista congelado de cada alumno (`cuad_numeracion`); sin él, 1..N alfabético. */
  numeros?: Map<string, number>;
  /** Color a usar; por defecto el que toque por posición en el libro. */
  color?: { cabecera: string; pestana: string };
  /** Nombre de la pestaña; por defecto la clase larga («1º ESO A»). */
  nombreHoja?: string;
}

/**
 * La hoja de una clase. La cabecera de «Clase» lleva el nombre largo («1º ESO A»), que es
 * el que esperan los merges; la pestaña, el corto («1ºA»), que es el que cabe.
 */
export function hojaDeClase(clase: ClaseCuaderno, opciones: OpcionesLista = {}): Hoja {
  const color = opciones.color ?? COLORES[0];
  const cabecera = estiloCabecera(color.cabecera);
  const claseLarga = nombreLargoClase(clase);
  const tutor = clase.tutores.map((t) => t.nombre.split(' ')[0]).join(' / ');

  const filas: EntradaCelda[][] = [
    COLUMNAS.map((c) => ({ valor: c.titulo, estilo: cabecera })),
    ...clase.alumnos.map((alumno, i) =>
      filaAlumno(alumno, {
        numero: opciones.numeros?.get(alumno.id) ?? i + 1,
        clase: claseLarga,
        tutor,
        indice: i,
      }),
    ),
  ];

  return {
    nombre: opciones.nombreHoja ?? claseLarga,
    filas,
    columnas: COLUMNAS.map((c) => ({ ancho: c.ancho })),
    colorPestana: color.pestana,
    // Congelar la fila 1 y las dos primeras columnas: con 18 columnas, sin esto se pierde
    // de vista de quién es la fila en cuanto miras el correo del segundo familiar.
    congelar: 'C2',
    autofiltro: true,
    altoCabecera: 27,
  };
}

/** `2ESO` + `A` → `2º ESO A`, que es como se escribe en la columna «Clase» del original. */
export function nombreLargoClase(clase: { curso: string; letra: string | null }): string {
  const m = /^(\d+)\s*(.*)$/.exec(clase.curso);
  const base = m ? `${m[1]}º ${m[2]}`.trim() : clase.curso;
  return clase.letra ? `${base} ${clase.letra}` : base;
}

/** El libro entero: una hoja por clase, en el orden en que llegan. */
export function libroDeListas(
  clases: readonly ClaseCuaderno[],
  opciones: { numerosPorClase?: Map<string, Map<string, number>> } = {},
): Libro {
  return {
    fuente: 'Arial',
    tamano: 10,
    hojas: clases.map((clase, i) =>
      hojaDeClase(clase, {
        color: colorDeClase(i),
        numeros: opciones.numerosPorClase?.get(claveClase(clase)),
      }),
    ),
  };
}

export const claveClase = (clase: { curso: string; letra: string | null }) => `${clase.curso}|${clase.letra ?? ''}`;

/**
 * Nombre del archivo en Drive: `Lista 2ºA — María R — 2026-2027`. El prefijo «Lista» hace
 * que las listas de varios cursos se agrupen solas en la carpeta del tutor.
 */
export function nombreArchivoLista(
  clase: { curso: string; letra: string | null },
  tutores: readonly string[],
  academicYear: string,
): string {
  const partes = [claseCorta(clase.curso, clase.letra), ...(tutores.length > 0 ? [tutores.join(' + ')] : [])];
  return `Lista ${partes.join(' — ')} — ${cursoEscolarLargo(academicYear)}`;
}

/** Nombre del archivo cuando van varias clases juntas: `Listas 1ºA + 1ºB — 2026-2027`. */
export function nombreArchivoVarias(clases: readonly { curso: string; letra: string | null }[], academicYear: string): string {
  const etiquetas = clases.map((c) => claseCorta(c.curso, c.letra));
  const resumen = etiquetas.length <= 4 ? etiquetas.join(' + ') : `${etiquetas.length} clases`;
  return `Listas ${resumen} — ${cursoEscolarLargo(academicYear)}`;
}
