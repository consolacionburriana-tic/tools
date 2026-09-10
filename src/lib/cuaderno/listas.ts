// «Lista en Excel»: genera la hoja de cálculo del alumnado de una o varias clases, la deja
// en Drive convertida a Google Sheet nativa y (si se pide) la comparte con sus tutores.
//
// Es la pieza que junta las tres que ya existen y no inventa ninguna: los datos salen de
// `getClasesCuaderno`, el fichero de `lista-clase.ts` + `xlsx-escribir.ts`, y Drive de
// `drive.ts`. No hay cola ni worker como en las tiradas del cuaderno, y a propósito: una
// lista es **una** subida a Drive por clase (un par de segundos), no 125 documentos con
// export, relleno y PDF. Con el techo de `maxDuration` del route sobra de largo.
//
// La numeración es la MISMA que la del cuaderno impreso (`cuad_numeracion`): el nº 14 de la
// lista tiene que ser el nº 14 del dossier, o la lista deja de servir para pasar lista.
// Ficha: docs/18-cuaderno-tutor.md
import { etapaDeCurso, type Etapa } from '@/lib/cursos';
import {
  asegurarCarpeta,
  compartirCarpeta,
  mensajeDeError,
  subirComoGoogleSheet,
  type RolDrive,
} from '@/lib/cuaderno/drive';
import {
  claveClase,
  libroDeListas,
  nombreArchivoLista,
  nombreArchivoVarias,
} from '@/lib/cuaderno/lista-clase';
import { carpetaClase, carpetaCursoEscolar, limpiarNombre } from '@/lib/cuaderno/nombres';
import {
  asegurarNumeracion,
  getAjustes,
  getClasesCuaderno,
  type ClaseCuaderno,
} from '@/lib/cuaderno-server';
import { avisarTutorDeLaLista } from '@/lib/cuaderno-email';
import { escribirXlsx } from '@/lib/xlsx-escribir';

export interface OpcionesListas {
  academicYear: string;
  clases: { curso: string; letra: string | null }[];
  /** `true` = un único archivo con una pestaña por clase; `false` = uno por clase. */
  unSoloArchivo: boolean;
  /** Compartir con los tutores de cada clase (solo tiene sentido con un archivo por clase). */
  compartir: boolean;
  /** Además de compartir, mandarles el correo de aviso. */
  avisarPorCorreo: boolean;
}

export interface ListaGenerada {
  clase: string;
  clases: string[];
  nombre: string;
  url: string;
  alumnos: number;
  reemplazado: boolean;
  compartidoCon: string[];
  avisados: string[];
}

export interface ResultadoListas {
  listas: ListaGenerada[];
  avisos: string[];
  errores: string[];
}

/** Nº de lista congelado de cada clase; si la clase no tiene numeración aún, se le crea. */
async function numeracion(academicYear: string, clases: readonly ClaseCuaderno[]) {
  const porClase = new Map<string, Map<string, number>>();
  for (const clase of clases) {
    const numeros = await asegurarNumeracion(academicYear, clase.curso, clase.letra, clase.alumnos);
    porClase.set(
      claveClase(clase),
      new Map([...numeros].map(([id, n]) => [id, n.asignado])),
    );
  }
  return porClase;
}

/**
 * Genera las listas. Devuelve una entrada por archivo creado y, aparte, los avisos y los
 * errores por clase: que una clase falle (Drive, un permiso) no puede tirar abajo las otras
 * veinte que sí salieron.
 */
export async function generarListas(opciones: OpcionesListas): Promise<ResultadoListas> {
  const ajustes = await getAjustes();
  if (!ajustes.carpetaBaseId) throw new Error('Antes hay que fijar la carpeta base de Drive en los ajustes.');

  const clases = await getClasesCuaderno({ clases: opciones.clases });
  const avisos: string[] = [];
  const errores: string[] = [];
  if (clases.length === 0) return { listas: [], avisos: ['Ninguna de las clases elegidas tiene alumnado activo.'], errores };

  for (const clase of clases) {
    if (clase.alumnos.length === 0) avisos.push(`${clase.clase}: sin alumnado activo, la hoja saldría vacía.`);
    if (clase.tutores.length === 0) avisos.push(`${clase.clase}: sin tutor asignado este curso, no hay con quién compartirla.`);
  }

  const numerosPorClase = await numeracion(opciones.academicYear, clases);
  const carpetaCurso = await asegurarCarpeta(carpetaCursoEscolar(opciones.academicYear), ajustes.carpetaBaseId);
  const etapas = [...new Set(clases.map((c) => c.etapa).filter((e): e is Etapa => Boolean(e)))];
  const variasEtapas = etapas.length > 1;
  const rol = (ajustes.permisoTutores === 'reader' ? 'reader' : 'writer') as RolDrive;

  if (opciones.unSoloArchivo) {
    const lista = await archivoUnico({ clases, numerosPorClase, carpetaCursoId: carpetaCurso.id, opciones });
    return { listas: [lista], avisos, errores };
  }

  const listas: ListaGenerada[] = [];
  const carpetasEtapa = new Map<string, string>();
  for (const clase of clases) {
    try {
      let padre = carpetaCurso.id;
      if (variasEtapas && clase.etapa) {
        const ya = carpetasEtapa.get(clase.etapa);
        if (ya) padre = ya;
        else {
          const carpeta = await asegurarCarpeta(clase.etapa, carpetaCurso.id);
          carpetasEtapa.set(clase.etapa, carpeta.id);
          padre = carpeta.id;
        }
      }
      // La MISMA carpeta que usa el cuaderno: la lista cae junto a los dossieres del tutor,
      // no en un rincón aparte, y si ya estaba compartida no hay que compartir nada nuevo.
      const carpeta = await asegurarCarpeta(
        limpiarNombre(carpetaClase(clase.curso, clase.letra, clase.tutores.map((t) => t.corto))),
        padre,
      );

      const xlsx = await escribirXlsx(
        libroDeListas([clase], { numerosPorClase }),
      );
      const nombre = limpiarNombre(
        nombreArchivoLista(clase, clase.tutores.map((t) => t.corto), opciones.academicYear),
      );
      const subida = await subirComoGoogleSheet({ nombre, carpetaId: carpeta.id, xlsx });

      const compartidoCon: string[] = [];
      const avisados: string[] = [];
      if (opciones.compartir) {
        for (const tutor of clase.tutores) {
          if (!tutor.email) continue;
          const resultado = await compartirCarpeta(carpeta.id, tutor.email, rol);
          if (resultado === 'nuevo') compartidoCon.push(tutor.email);
          if (opciones.avisarPorCorreo) {
            const mandado = await avisarTutorDeLaLista({
              email: tutor.email,
              nombre: tutor.nombre,
              clase: clase.clase,
              academicYear: opciones.academicYear,
              hojaUrl: subida.url,
              alumnos: clase.alumnos.length,
            });
            if (mandado) avisados.push(tutor.email);
          }
        }
      }

      listas.push({
        clase: clase.clase,
        clases: [clase.clase],
        nombre,
        url: subida.url,
        alumnos: clase.alumnos.length,
        reemplazado: subida.reemplazado,
        compartidoCon,
        avisados,
      });
    } catch (error) {
      errores.push(`${clase.clase}: ${mensajeDeError(error)}`);
    }
  }

  return { listas, avisos, errores };
}

/**
 * Todas las clases en un archivo, con una pestaña cada una. Va a la carpeta del curso
 * escolar y **no se comparte con nadie**: un archivo con el alumnado de varias clases no
 * puede acabar en el Drive de un tutor que solo lleva una. Quien lo pide es quien lo
 * reparte, a mano y sabiendo lo que hace.
 */
async function archivoUnico(datos: {
  clases: ClaseCuaderno[];
  numerosPorClase: Map<string, Map<string, number>>;
  carpetaCursoId: string;
  opciones: OpcionesListas;
}): Promise<ListaGenerada> {
  const { clases, numerosPorClase, carpetaCursoId, opciones } = datos;
  const xlsx = await escribirXlsx(libroDeListas(clases, { numerosPorClase }));
  const nombre = limpiarNombre(nombreArchivoVarias(clases, opciones.academicYear));
  const subida = await subirComoGoogleSheet({ nombre, carpetaId: carpetaCursoId, xlsx });
  return {
    clase: clases.map((c) => c.clase).join(' + '),
    clases: clases.map((c) => c.clase),
    nombre,
    url: subida.url,
    alumnos: clases.reduce((n, c) => n + c.alumnos.length, 0),
    reemplazado: subida.reemplazado,
    compartidoCon: [],
    avisados: [],
  };
}

/** Las clases que tienen alumnado activo, para la vista previa del panel. */
export async function previoListas(clases: { curso: string; letra: string | null }[]) {
  const encontradas = await getClasesCuaderno({ clases });
  return encontradas.map((c) => ({
    clase: c.clase,
    etapa: etapaDeCurso(c.curso),
    alumnos: c.alumnos.length,
    tutores: c.tutores.map((t) => t.corto),
    sinCorreo: c.tutores.filter((t) => !t.email).length,
  }));
}
