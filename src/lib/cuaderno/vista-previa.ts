// Vista previa de una plantilla contra una clase de verdad.
//
// Es la respuesta a la pregunta que nadie podía contestar sin generar el documento: «¿qué
// va a salir exactamente donde pone `<<nom>>`?». Se construye con el MISMO `construirPlan()`
// que usa el worker, así que lo que se ve aquí es literalmente lo que se va a imprimir —
// no una imitación que se pueda desincronizar.
import type { CuadAjustes, CuadPlantilla } from '@/db/schema';
import { analizarEtiqueta, normalizarEtiqueta, type Ambito } from '@/lib/cuaderno/campos';
import { CAMPOS } from '@/lib/cuaderno/campos';
import { construirPlan } from '@/lib/cuaderno/generar';
import { cursoEscolarLargo } from '@/lib/cuaderno/nombres';
import type { AlumnoCuaderno, AsignaturaCuaderno, ClaseCuaderno, NumeroAlumno, TutorCuaderno } from '@/lib/cuaderno-server';

export interface CampoPrevisto {
  /** La etiqueta tal cual está escrita en la plantilla: `nom`, `tlf1`, `#alumnos`… */
  etiqueta: string;
  /** El campo del catálogo al que apunta, o null si nadie sabe qué es. */
  campo: string | null;
  ambito: Ambito | null;
  label: string | null;
  tipo: 'campo' | 'filas' | 'condicion';
  /** Lo que va a salir impreso. Vacío = el dato existe pero está en blanco. */
  valor: string;
  /** Sin campo al que apuntar: hay que arreglar la plantilla o mapear la etiqueta. */
  problema: boolean;
}

export interface VistaPrevia {
  /** De quién son los datos del ejemplo: el primer alumno del primer tutor. */
  ejemplo: { alumno: string | null; tutor: string | null; clase: string };
  campos: CampoPrevisto[];
  /** Los tutores de la clase, con sus cuatro nombres, para poder retocarlos. */
  tutores: { teacherId: string; completo: string; usual: string; corto: string }[];
  /** Etiquetas de la plantilla que no casan con ningún campo. */
  sinMapear: string[];
}

export interface DatosVistaPrevia {
  plantilla: CuadPlantilla;
  ajustes: CuadAjustes;
  academicYear: string;
  clase: ClaseCuaderno;
  tutor: TutorCuaderno | null;
  alumnos: AlumnoCuaderno[];
  asignaturas: readonly Pick<AsignaturaCuaderno, 'enLaHoja'>[];
  numeros: Map<string, NumeroAlumno>;
  mapeo: Map<string, string>;
  /** Etiquetas leídas del .docx. Si la plantilla no se ha analizado aún, va vacío. */
  etiquetas: string[];
  hoy?: Date;
}

const CAMPO_POR_ID = new Map(CAMPOS.map((c) => [c.id, c]));

/**
 * Resuelve cada etiqueta de la plantilla con los datos reales de la clase. Para lo que se
 * repite (alumnos, trimestres) enseña UN ejemplo —el primero de la lista—, porque ver
 * treinta veces lo mismo no aclara nada; para lo que hay poco (los tutores) se enseña todo.
 */
export function construirVistaPrevia(datos: DatosVistaPrevia): VistaPrevia {
  const { plantilla, clase, tutor, alumnos, etiquetas, mapeo } = datos;
  const plan = construirPlan({
    plantilla,
    ajustes: datos.ajustes,
    cursoEscolar: cursoEscolarLargo(datos.academicYear),
    clase,
    tutor,
    alumnos,
    asignaturas: datos.asignaturas,
    numeros: datos.numeros,
    mapeo,
    hoy: datos.hoy,
  });

  // Los valores de la primera copia, más los de su primera fila: entre las dos está todo
  // lo que una plantilla puede pedir, sea cual sea su tipo de repetición.
  const primera = plan.copias[0];
  const valores: Record<string, string> = { ...(primera?.valores ?? {}), ...(primera?.filas?.[0]?.valores ?? {}) };

  const campos: CampoPrevisto[] = etiquetas.map((etiqueta) => {
    const analisis = analizarEtiqueta(etiqueta, mapeo);
    const campo = analisis.campo;
    const ficha = campo ? CAMPO_POR_ID.get(campo) : undefined;
    const valor = analisis.tipo === 'campo' ? (valores[normalizarEtiqueta(etiqueta)] ?? valores[campo ?? ''] ?? '') : '';
    return {
      etiqueta,
      campo,
      ambito: ficha?.ambito ?? null,
      label: ficha?.label ?? null,
      tipo: analisis.tipo,
      valor,
      problema: analisis.tipo === 'campo' && !campo,
    };
  });

  return {
    ejemplo: {
      alumno: alumnos[0] ? [alumnos[0].nombre, alumnos[0].apellido1, alumnos[0].apellido2].filter(Boolean).join(' ') : null,
      tutor: tutor?.nombre ?? null,
      clase: clase.clase,
    },
    campos,
    tutores: clase.tutores.map((t) => ({
      teacherId: t.teacherId,
      completo: t.completo,
      usual: t.nombre,
      corto: t.corto,
    })),
    sinMapear: campos.filter((c) => c.problema).map((c) => c.etiqueta),
  };
}
