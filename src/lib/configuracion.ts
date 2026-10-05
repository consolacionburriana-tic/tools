// Parámetros del centro: CÓMO funciona tu colegio, en un solo sitio.
//
// `colegio.ts` dice QUIÉN eres (dominio, nombre, buzones). Este fichero dice cómo es tu centro:
// qué cursos tiene cada etapa, cómo se promociona, desde dónde hay banco de libros, a qué hora
// se cierran las puertas, cuándo empiezan los trimestres… Antes eran constantes repartidas por
// el código; ahora se cambian aquí y el resto las lee.
//
// Reglas para tocar esto:
//   · Sin imports de valores (solo tipos): lo usan servidor y cliente.
//   · Cambiar un valor cambia el comportamiento de TODOS los módulos que lo leen; cada bloque
//     dice cuáles. Los tests (`pnpm test`) fijan los valores de Consolación: si cambias uno a
//     propósito, el test correspondiente te lo dirá y lo actualizas.
//   · Lo que aún NO está aquí (porque va atado a datos, a la base de datos o a plantillas de
//     terceros) está listado en `docs/09-parametros-del-centro.md`, con su ubicación.
//
// Guía de despliegue: docs/08-despliegue-y-fork.md · inventario: docs/09-parametros-del-centro.md.
import type { Etapa } from './cursos';

export type TipoPromocion =
  /** Rota dentro de la etapa: el último curso vuelve al primero (Infantil: 3→4→5→3). */
  | 'rota'
  /** Cursos de dos en dos: 1↔2, 3↔4, 5↔6, misma letra (Primaria por ciclos). */
  | 'parejas'
  /** Sube de verdad de curso y el último egresa (ESO, Bachillerato). */
  | 'sube';

/**
 * Etapas que se OFRECEN en los selectores vacíos (marcar etapas de un profe, de un tipo de Oratorios,
 * de una plantilla…). Sale de la variable de entorno `NEXT_PUBLIC_ETAPAS_VISIBLES` (lista separada
 * por comas, p. ej. `EI,EP,ESO,BACH`); sin fijar, `EI,EP,ESO`. Se cambia en Vercel → Environment
 * Variables y se redespliega (es `NEXT_PUBLIC_` para que la lea también el cliente).
 */
function etapasVisiblesDeEntorno(): readonly Etapa[] {
  const validas: readonly Etapa[] = ['EI', 'EP', 'ESO', 'BACH'];
  const crudo = (process.env.NEXT_PUBLIC_ETAPAS_VISIBLES ?? 'EI,EP,ESO').split(',').map((e) => e.trim().toUpperCase());
  const lista = validas.filter((e) => crudo.includes(e));
  return lista.length > 0 ? lista : ['EI', 'EP', 'ESO'];
}

export const CONFIGURACION = {
  /**
   * Etapas que se ofrecen en los **selectores** (ver `etapasVisiblesDeEntorno`). Consolación no tiene
   * Bachillerato, así que por defecto no sale en ningún selector vacío (lo contrario es «feísimo»).
   * Esto NO impide trabajar con él: si llega en un import de Educamos o de Horarios, se reconoce, se
   * guarda y sale en lo que se pinta a partir de datos (Alumnado, Números, Banco de libros, Horarios…).
   * Para ofrecerlo también en los selectores: `NEXT_PUBLIC_ETAPAS_VISIBLES=EI,EP,ESO,BACH`.
   * Lo lee: `ETAPAS_VISIBLES` (`cursos.ts`).
   */
  etapasVisibles: etapasVisiblesDeEntorno(),

  /**
   * Estructura de cursos: el primer y el último nivel de cada etapa (`3INF`…`5INF`, `1PRI`…`6PRI`).
   * Lo leen: promoción de curso (tutorías y Cuaderno), banco de libros.
   */
  niveles: {
    EI: { min: 3, max: 5 },
    EP: { min: 1, max: 6 },
    ESO: { min: 1, max: 4 },
    BACH: { min: 1, max: 2 },
  } satisfies Record<Etapa, { min: number; max: number }>,

  /**
   * Qué pasa con un curso al cambiar de año (botón «Promocionar +1 curso» de `/gestion/profes`).
   * Reglas fijadas por David el 1-sep-2026. Un colegio que promociona Primaria de 1º a 2º
   * «de verdad» pone `'sube'` en `EP` (y `'sube'` en `EI` si su Infantil sube de 3 a 4 a 5).
   * Bachillerato: por defecto, sin decidir con David.
   */
  promocion: {
    EI: 'rota',
    EP: 'parejas',
    ESO: 'sube',
    BACH: 'sube',
  } satisfies Record<Etapa, TipoPromocion>,

  /**
   * Banco de libros: desde qué nivel de cada etapa participa. Una etapa que no está aquí no
   * entra en el banco. Hoy: de 3º de Primaria a 2º de Bachillerato (David, 30-sep-2026: «Bachillerato
   * sí tiene banco de libros»).
   * Lo leen: Banco de libros, Alumnado, el sync de Educamos (casilla `banco_libros` de un alta).
   */
  bancoLibros: {
    EP: { desdeNivel: 3 },
    ESO: { desdeNivel: 1 },
    BACH: { desdeNivel: 1 },
  } satisfies Partial<Record<Etapa, { desdeNivel: number }>>,

  /**
   * Etapas que van juntas a efectos de **quién ve a quién** en Alumnado, Banco de libros y
   * Números: quien tiene una de las de un grupo las tiene todas. Hoy ESO y Bachillerato son una
   * etapa conjunta (David, 30-sep-2026). Un profe de ESO ve a Bachillerato y al revés.
   */
  etapasConjuntas: [['ESO', 'BACH']] as readonly (readonly Etapa[])[],

  /**
   * Puntualidad (retrasos de entrada). Lo leen: el formulario, el panel, el aviso al tutor y el
   * resumen semanal.
   */
  puntualidad: {
    /** A qué etapas afecta. Hoy ESO (con su PDC) y Bachillerato (David, 30-sep-2026). */
    etapas: ['ESO', 'BACH'] as readonly Etapa[],
    /** Hora a la que se cierran las puertas: a partir de aquí es retraso. */
    horaLimite: '08:05',
    /** Cada cuántos retrasos NO justificados se avisa al tutor y se pone consecuencia. */
    retrasosPorConsecuencia: 3,
  },

  /**
   * Calendario escolar. Lo leen: el curso académico en vigor (`academicYearActual`), los
   * trimestres de Oratorios y todas las fechas «de hoy» que se pintan.
   */
  calendario: {
    /** Zona horaria del colegio (el servidor va en UTC). */
    zonaHoraria: 'Europe/Madrid',
    /** Mes (1-12) en que empieza el curso: de septiembre en adelante ya es el curso nuevo. */
    mesInicioCurso: 9,
    /**
     * Trimestres de partida de un curso (se retocan cada año en Ajustes de Oratorios).
     * `finT1` e `inicioT2` son `MM-DD`; T2 acaba y T3 empieza según la Pascua de ese año.
     */
    trimestres: {
      finT1: '12-22',
      inicioT2: '01-07',
      /** T2 acaba tantos días antes del Domingo de Pascua (-9 = el viernes antes de Ramos). */
      finT2DiasDesdePascua: -9,
      /** T3 empieza tantos días después del Domingo de Pascua (2 = el martes). */
      inicioT3DiasDesdePascua: 2,
      finT3: '06-19',
    },
  },

  /** Horarios. Ver `docs/07-horarios.md`. */
  horarios: {
    /**
     * La reunión de etapa de todo el profesorado. No suele venir en el fichero de Educamos,
     * así que al importar se pregunta si se añade (marcada por defecto). Días 1=lunes…5=viernes.
     */
    reunionesEtapa: {
      ESO: { dias: [1], horaInicio: '16:00', horaFin: '17:00', etiqueta: 'Reunión de etapa' },
      EP: { dias: [2, 4], horaInicio: '12:30', horaFin: '13:30', etiqueta: 'Reunión de etapa' },
    } as Record<string, { dias: readonly number[]; horaInicio: string; horaFin: string; etiqueta: string }>,
  },

  /** Sesión del claustro (Auth.js). Ver `src/auth.ts`. */
  sesion: {
    /** Cuánto dura sin volver a pedir Google: un curso, para que no se cuelgue a mitad de año. */
    duracionDias: 300,
    /** Cada cuánto se vuelve a leer el rol y los módulos de la persona (minutos). */
    refrescoRolMinutos: 15,
  },

  /** Tamaño máximo de un fichero que se sube (justificantes, Excel de licencias, horarios). */
  archivos: {
    maxMB: 10,
  },
} as const;
