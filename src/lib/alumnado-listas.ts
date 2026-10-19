// Las «listas rápidas» de Alumnado: tres Excel de un toque para la clase que se tiene delante.
//
// Jose Miguel (16-oct-2026): «que el profesor pueda descargar un excel con el correo del
// alumno y otro con el correo de los padres». La lista de clase con esos correos YA existía
// —la «Lista en Excel» del cuaderno de tutor, `cuaderno/lista-clase.ts`—, pero el cuaderno
// solo lo tienen secretaría, dirección y TIC, y además la deja en Drive. Así que aquí no se
// inventa otra: se reutiliza tal cual, y al lado van dos hojas cortas solo con los correos,
// que es lo que se pega en el «Para» de Gmail.
//
//  - `lista`     la de siempre, idéntica a la del cuaderno (18 columnas, mismos títulos: los
//                merges del claustro buscan las columnas por título)
//  - `alumnado`  N · Alumno · Clase · Correo del alumno
//  - `familias`  N · Alumno · Clase · Familiar · Correo — una fila por familiar con correo,
//                sin repetir la dirección dentro de una misma clase (hermanos gemelos,
//                padre y madre con el correo compartido)
//
// Puro: entra lo que ya sabe `getClasesCuaderno` y sale el modelo de libro que
// `xlsx-escribir.ts` convierte en fichero. Tests en `__tests__/alumnado-listas.test.ts`.
import type { ClaseCuaderno } from '@/lib/cuaderno-server';
import { claveClase, colorDeClase, libroDeListas, nombreLargoClase } from '@/lib/cuaderno/lista-clase';
import { cursoEscolarLargo } from '@/lib/cuaderno/nombres';
import type { EntradaCelda, EstiloCelda, Hoja, Libro } from '@/lib/xlsx-escribir';

export const TIPOS_LISTA = ['lista', 'alumnado', 'familias'] as const;
export type TipoLista = (typeof TIPOS_LISTA)[number];

export const TIPO_LISTA_LABEL: Record<TipoLista, { titulo: string; ayuda: string; fichero: string }> = {
  lista: {
    titulo: 'Lista de clase',
    ayuda: 'La de siempre: nombre, NIA, nacimiento, tutor, correo del alumno y de dos familiares',
    fichero: 'Lista',
  },
  alumnado: { titulo: 'Correos del alumnado', ayuda: 'Una fila por alumno con su correo del colegio', fichero: 'Correos alumnado' },
  familias: { titulo: 'Correos de las familias', ayuda: 'Una fila por familiar con correo', fichero: 'Correos familias' },
};

/**
 * Nº de lista de cada alumno SIN congelar nada: el que tenga en `cuad_numeracion` y, quien
 * no lo tenga todavía, el siguiente libre por orden alfabético. Es lo mismo que haría
 * `asegurarNumeracion`, pero de solo lectura: descargar una lista no es imprimir el cuaderno,
 * y no tiene por qué fijarle el número a nadie.
 */
export function numerosSinCongelar(
  alumnos: readonly { id: string }[],
  congelados: ReadonlyMap<string, number>,
): Map<string, number> {
  const salida = new Map<string, number>();
  let siguiente = Math.max(0, ...alumnos.map((a) => congelados.get(a.id) ?? 0)) + 1;
  for (const a of alumnos) salida.set(a.id, congelados.get(a.id) ?? siguiente++);
  return salida;
}

const cabecera = (fondo: string): EstiloCelda => ({
  negrita: true,
  color: 'FFFFFF',
  fondo,
  horizontal: 'center',
  vertical: 'center',
});
const NUMERO: EstiloCelda = { negrita: true, fondo: 'FFFF00', horizontal: 'center' };

function hojaCorreos(
  clase: ClaseCuaderno,
  tipo: 'alumnado' | 'familias',
  numeros: ReadonlyMap<string, number> | undefined,
  indice: number,
): Hoja {
  const color = colorDeClase(indice);
  const larga = nombreLargoClase(clase);
  const titulos = tipo === 'alumnado' ? ['N', 'Alumno', 'Clase', 'Correo'] : ['N', 'Alumno', 'Clase', 'Familiar', 'Correo'];
  const ordenados = [...clase.alumnos]
    .map((a, i) => ({ a, n: numeros?.get(a.id) ?? i + 1 }))
    .sort((x, y) => x.n - y.n);

  const filas: EntradaCelda[][] = [titulos.map((t) => ({ valor: t, estilo: cabecera(color.cabecera) }))];
  const vistos = new Set<string>();
  for (const { a, n } of ordenados) {
    const alumno = `${a.nombre} ${a.apellido1} ${a.apellido2}`.trim();
    if (tipo === 'alumnado') {
      filas.push([{ valor: n, estilo: NUMERO }, alumno, larga, a.email || null]);
      continue;
    }
    for (const f of a.familiares) {
      const correo = f.correo.trim();
      if (!correo || vistos.has(correo.toLowerCase())) continue;
      vistos.add(correo.toLowerCase());
      filas.push([{ valor: n, estilo: NUMERO }, alumno, larga, f.nombre || null, correo]);
    }
  }

  return {
    nombre: larga,
    filas,
    columnas: tipo === 'alumnado' ? [{ ancho: 5 }, { ancho: 34 }, { ancho: 14 }, { ancho: 36 }] : [{ ancho: 5 }, { ancho: 34 }, { ancho: 14 }, { ancho: 30 }, { ancho: 36 }],
    colorPestana: color.pestana,
    congelar: 'C2',
    autofiltro: true,
  };
}

/** El libro entero: una pestaña por clase, en el orden en que llegan. */
export function libroDeListaRapida(
  tipo: TipoLista,
  clases: readonly ClaseCuaderno[],
  numerosPorClase: ReadonlyMap<string, Map<string, number>>,
): Libro {
  if (tipo === 'lista') return libroDeListas(clases, { numerosPorClase: new Map(numerosPorClase) });
  return {
    fuente: 'Arial',
    tamano: 10,
    hojas: clases.map((c, i) => hojaCorreos(c, tipo, numerosPorClase.get(claveClase(c)), i)),
  };
}

/**
 * `correos-familias-2-eso-b-2026-2027.xlsx`; con muchas clases, `…-12-clases-…`. En ASCII y
 * sin espacios: va en la cabecera `Content-Disposition`, que no admite otra cosa.
 */
export function nombreListaRapida(tipo: TipoLista, clases: readonly { curso: string; letra: string | null }[], academicYear: string): string {
  const resumen = clases.length <= 3 ? clases.map(nombreLargoClase).join(' ') : `${clases.length} clases`;
  const base = `${TIPO_LISTA_LABEL[tipo].fichero} ${resumen} ${cursoEscolarLargo(academicYear)}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${base}.xlsx`;
}
