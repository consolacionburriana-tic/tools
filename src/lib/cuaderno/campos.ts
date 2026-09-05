// Catálogo de campos del cuaderno de tutor y traducción etiqueta → campo.
//
// La idea de todo el módulo es que **el código no conoce las etiquetas de las plantillas**:
// las plantillas son de David y las cambia cuando quiere. Lo que el código conoce son los
// CAMPOS (los datos que sabe sacar de `edu_*`), y una tabla de ALIAS que dice qué etiqueta
// de una plantilla corresponde a qué campo. Los alias de aquí son el punto de partida
// (los de las plantillas que ya existen); el panel aprende los nuevos en `cuad_alias`.
//
// Todo es puro y testeado en `src/lib/__tests__/cuaderno-campos.test.ts`.

export const AMBITOS = ['alumno', 'clase', 'familiar', 'centro', 'trimestre'] as const;
export type Ambito = (typeof AMBITOS)[number];

export const AMBITO_LABELS: Record<Ambito, string> = {
  alumno: 'Alumno/a',
  clase: 'Clase y tutor',
  familiar: 'Familias',
  centro: 'Centro y curso',
  trimestre: 'Trimestre',
};

export interface Campo {
  /** Id del campo. Vale también como etiqueta: `<<nombre_completo>>` funciona siempre. */
  id: string;
  ambito: Ambito;
  label: string;
  ejemplo: string;
}

/** Todo lo que el módulo sabe rellenar. Añadir aquí = añadir en `datosDe*` de cuaderno-server. */
export const CAMPOS: readonly Campo[] = [
  // Alumno
  { id: 'nombre', ambito: 'alumno', label: 'Nombre', ejemplo: 'Aitana' },
  { id: 'apellidos', ambito: 'alumno', label: 'Apellidos', ejemplo: 'Pitarch Roldán' },
  { id: 'apellido1', ambito: 'alumno', label: 'Primer apellido', ejemplo: 'Pitarch' },
  { id: 'apellido2', ambito: 'alumno', label: 'Segundo apellido', ejemplo: 'Roldán' },
  { id: 'nombre_completo', ambito: 'alumno', label: 'Nombre y apellidos', ejemplo: 'Aitana Pitarch Roldán' },
  { id: 'nombre_lista', ambito: 'alumno', label: 'Apellidos, Nombre', ejemplo: 'Pitarch Roldán, Aitana' },
  { id: 'numero', ambito: 'alumno', label: 'Nº de lista', ejemplo: '19' },
  {
    id: 'numero_lista',
    ambito: 'alumno',
    label: 'Nº de lista anotado (para listados)',
    ejemplo: '7* (31)',
  },
  { id: 'fecha_nacimiento', ambito: 'alumno', label: 'Fecha de nacimiento', ejemplo: '14/03/2012' },
  { id: 'nia', ambito: 'alumno', label: 'NIA', ejemplo: '12345678' },
  { id: 'email', ambito: 'alumno', label: 'Correo del alumno/a', ejemplo: 'aitana@…' },
  { id: 'sexo', ambito: 'alumno', label: 'Sexo', ejemplo: 'F' },
  // Clase
  { id: 'clase', ambito: 'clase', label: 'Clase', ejemplo: '2º ESO A' },
  { id: 'curso', ambito: 'clase', label: 'Curso', ejemplo: '2º ESO' },
  { id: 'letra', ambito: 'clase', label: 'Letra del grupo', ejemplo: 'A' },
  { id: 'etapa', ambito: 'clase', label: 'Etapa', ejemplo: 'ESO' },
  { id: 'tutor', ambito: 'clase', label: 'Tutor/a', ejemplo: 'María Remolar Gil' },
  { id: 'tutor_corto', ambito: 'clase', label: 'Tutor/a (nombre corto)', ejemplo: 'María R' },
  { id: 'tutores', ambito: 'clase', label: 'Todos los tutores de la clase', ejemplo: 'María R + Paola G' },
  { id: 'tutor_email', ambito: 'clase', label: 'Correo del tutor/a', ejemplo: 'mremolar@…' },
  { id: 'num_alumnos', ambito: 'clase', label: 'Nº de alumnos del tutor/a', ejemplo: '15' },
  // Familias
  { id: 'familiar1_nombre', ambito: 'familiar', label: 'Familiar 1 · nombre', ejemplo: 'Ana Gil Soler' },
  { id: 'familiar1_telefono', ambito: 'familiar', label: 'Familiar 1 · teléfono', ejemplo: '600 11 22 33' },
  { id: 'familiar1_correo', ambito: 'familiar', label: 'Familiar 1 · correo', ejemplo: 'ana@…' },
  { id: 'familiar2_nombre', ambito: 'familiar', label: 'Familiar 2 · nombre', ejemplo: 'Luis Pitarch Mas' },
  { id: 'familiar2_telefono', ambito: 'familiar', label: 'Familiar 2 · teléfono', ejemplo: '600 44 55 66' },
  { id: 'familiar2_correo', ambito: 'familiar', label: 'Familiar 2 · correo', ejemplo: 'luis@…' },
  // Centro
  { id: 'curso_escolar', ambito: 'centro', label: 'Curso escolar', ejemplo: '2026-2027' },
  { id: 'centro', ambito: 'centro', label: 'Nombre del centro', ejemplo: 'Colegio Consolación Burriana' },
  { id: 'fecha_hoy', ambito: 'centro', label: 'Fecha de generación', ejemplo: '3 de septiembre de 2026' },
  // Trimestre
  { id: 'trimestre', ambito: 'trimestre', label: 'Trimestre', ejemplo: '1ª' },
  { id: 'trimestre_num', ambito: 'trimestre', label: 'Trimestre (número)', ejemplo: '1' },
  { id: 'trimestre_nombre', ambito: 'trimestre', label: 'Trimestre (nombre)', ejemplo: 'Primera evaluación' },
];

export const CAMPOS_POR_ID = new Map(CAMPOS.map((c) => [c.id, c]));

export function esCampo(id: string): boolean {
  return CAMPOS_POR_ID.has(id);
}

export function ambitoDeCampo(id: string): Ambito | null {
  return CAMPOS_POR_ID.get(id)?.ambito ?? null;
}

/**
 * Forma canónica de una etiqueta: sin acentos, sin mayúsculas, sin `º`, y con todo lo que
 * no sea letra o número convertido en `_`. Así `<<Nº Clase>>`, `<<nº clase>>` y
 * `<<n_clase>>` son la misma etiqueta y solo hay que mapearla una vez.
 */
export function normalizarEtiqueta(etiqueta: string): string {
  return etiqueta
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ºª]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Alias que vienen de fábrica: las etiquetas de las plantillas que el colegio ya usa
 * (mezcla de valenciano y castellano, con nombres distintos para lo mismo). Los alias
 * guardados en `cuad_alias` tienen prioridad sobre estos.
 */
export const ALIAS_POR_DEFECTO: Readonly<Record<string, string>> = {
  // Clase y tutor
  tutoria: 'clase',
  n_clase: 'clase',
  num_clase: 'clase',
  nombre_de_classe: 'clase',
  nom_de_classe: 'clase',
  grupo: 'clase',
  classe: 'clase',
  tutora: 'tutor',
  tutor_a: 'tutor',
  // Alumno
  nom: 'nombre',
  nom_alumne: 'nombre',
  cognoms: 'apellidos',
  cognom: 'apellidos',
  apellido: 'apellidos',
  nombre_alumno: 'nombre_completo',
  nom_alumne_a: 'nombre_completo',
  nombre_del_alumno: 'nombre_completo',
  nom_de_l_alumne_a: 'nombre_completo',
  alumne: 'nombre_completo',
  alumno: 'nombre_completo',
  naixement: 'fecha_nacimiento',
  data_de_naixement: 'fecha_nacimiento',
  data_naixement: 'fecha_nacimiento',
  nacimiento: 'fecha_nacimiento',
  num: 'numero',
  n: 'numero',
  numero_de_lista: 'numero',
  n_lista: 'numero',
  // Familias
  nom_padre_1: 'familiar1_nombre',
  nom_padre_2: 'familiar2_nombre',
  nom_familiar_1: 'familiar1_nombre',
  nom_familiar_2: 'familiar2_nombre',
  nombre_familiar_1: 'familiar1_nombre',
  nombre_familiar_2: 'familiar2_nombre',
  familiar_1: 'familiar1_nombre',
  familiar_2: 'familiar2_nombre',
  tlf1: 'familiar1_telefono',
  tlf2: 'familiar2_telefono',
  telefon1: 'familiar1_telefono',
  telefon2: 'familiar2_telefono',
  telefono1: 'familiar1_telefono',
  telefono2: 'familiar2_telefono',
  correu1: 'familiar1_correo',
  correu2: 'familiar2_correo',
  correo1: 'familiar1_correo',
  correo2: 'familiar2_correo',
  email1: 'familiar1_correo',
  email2: 'familiar2_correo',
  // Centro y trimestre
  curs: 'curso_escolar',
  curs_escolar: 'curso_escolar',
  any_escolar: 'curso_escolar',
  colegio: 'centro',
  data: 'fecha_hoy',
  fecha: 'fecha_hoy',
  aval: 'trimestre',
  avaluacio: 'trimestre',
  evaluacion: 'trimestre',
};

/** Mapa etiqueta normalizada → campo, con los alias aprendidos por encima de los de fábrica. */
export function construirMapeo(aprendidos: Record<string, string> = {}): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const campo of CAMPOS) mapa.set(campo.id, campo.id);
  for (const [alias, campo] of Object.entries(ALIAS_POR_DEFECTO)) mapa.set(alias, campo);
  for (const [alias, campo] of Object.entries(aprendidos)) {
    const clave = normalizarEtiqueta(alias);
    if (campo) mapa.set(clave, campo);
    else mapa.delete(clave);
  }
  return mapa;
}

// ─── Marcas estructurales ────────────────────────────────────────────────────

export type TipoEtiqueta = 'campo' | 'filas' | 'condicion';

export interface EtiquetaAnalizada {
  /** Tal cual aparece en la plantilla: `nº clase`. */
  cruda: string;
  /** Normalizada: `n_clase`. */
  clave: string;
  tipo: TipoEtiqueta;
  /** Campo al que apunta, o null si nadie la ha mapeado todavía. */
  campo: string | null;
  /** Para `<<?familiar2>>`: el nombre de lo que se comprueba. */
  condicion?: string;
}

export function analizarEtiqueta(cruda: string, mapeo: Map<string, string>): EtiquetaAnalizada {
  const limpia = cruda.trim();
  const filas = /^#\s*(alumnos?|filas?)$/i.exec(limpia);
  if (filas) return { cruda: limpia, clave: 'alumnos', tipo: 'filas', campo: null };
  const condicion = /^\?\s*(.+)$/.exec(limpia);
  if (condicion) {
    const nombre = condicion[1].trim();
    const clave = normalizarEtiqueta(nombre);
    return { cruda: limpia, clave, tipo: 'condicion', campo: mapeo.get(clave) ?? null, condicion: nombre };
  }
  const clave = normalizarEtiqueta(limpia);
  return { cruda: limpia, clave, tipo: 'campo', campo: mapeo.get(clave) ?? null };
}

// ─── Repetición de la plantilla ──────────────────────────────────────────────

export const REPETICIONES = ['alumno', 'trimestre', 'unica'] as const;
export type Repeticion = (typeof REPETICIONES)[number];

export const REPETICION_LABELS: Record<Repeticion, string> = {
  alumno: 'Una copia por alumno/a',
  trimestre: 'Una copia por trimestre',
  unica: 'Una sola copia',
};

export const REPETICION_AYUDA: Record<Repeticion, string> = {
  alumno: 'La plantilla es la hoja de un alumno; el documento sale con la de todos (Dossier, entrevistas).',
  trimestre: 'La plantilla es una hoja; el documento sale con las tres evaluaciones (Registro de entrevistas).',
  unica: 'La plantilla sale una vez tal cual; el alumnado va en una tabla con «#alumnos» (Reunión de familias).',
};

export const TRIMESTRES = [
  { num: '1', corto: '1ª', nombre: 'Primera evaluación' },
  { num: '2', corto: '2ª', nombre: 'Segunda evaluación' },
  { num: '3', corto: '3ª', nombre: 'Tercera evaluación' },
] as const;

/**
 * Avisos de una plantilla analizada: lo que el panel enseña antes de dejar generar.
 * `bloqueante` es lo que impide lanzar la tirada; el resto son advertencias.
 */
export interface AvisoPlantilla {
  bloqueante: boolean;
  texto: string;
}

export function avisosDePlantilla(
  etiquetas: readonly EtiquetaAnalizada[],
  repeticion: Repeticion,
  tieneFilas: boolean,
): AvisoPlantilla[] {
  const avisos: AvisoPlantilla[] = [];
  const sinMapear = etiquetas.filter((e) => e.tipo === 'campo' && !e.campo);
  if (sinMapear.length > 0) {
    avisos.push({
      bloqueante: true,
      texto: `Sin mapear: ${sinMapear.map((e) => `«${e.cruda}»`).join(', ')}. Dile a qué dato corresponde cada una.`,
    });
  }
  const condicionesRaras = etiquetas.filter((e) => e.tipo === 'condicion' && !e.campo && e.clave !== 'familiar2');
  if (condicionesRaras.length > 0) {
    avisos.push({
      bloqueante: false,
      texto: `Condiciones que no apuntan a ningún dato conocido: ${condicionesRaras
        .map((e) => `«${e.cruda}»`)
        .join(', ')}. Esos párrafos se quedarán siempre.`,
    });
  }
  if (etiquetas.length === 0) {
    avisos.push({ bloqueante: false, texto: 'Esta plantilla no tiene ninguna etiqueta: saldrá igual para todos.' });
  }
  // Un campo de alumno en una plantilla que no se repite por alumno solo tiene sentido
  // dentro de una fila `<<#alumnos>>`; si no, saldría el dato del primer alumno y punto.
  if (repeticion !== 'alumno' && !tieneFilas) {
    const deAlumno = etiquetas.filter((e) => e.tipo === 'campo' && e.campo && ambitoDeCampo(e.campo) === 'alumno');
    if (deAlumno.length > 0) {
      avisos.push({
        bloqueante: false,
        texto: `Hay datos de alumno (${deAlumno
          .map((e) => `«${e.cruda}»`)
          .join(', ')}) pero la plantilla no se repite por alumno ni tiene una fila «#alumnos»: saldrán en blanco.`,
      });
    }
  }
  if (repeticion === 'trimestre' && !etiquetas.some((e) => e.campo && ambitoDeCampo(e.campo) === 'trimestre')) {
    avisos.push({
      bloqueante: false,
      texto: 'Se repite por trimestre pero no usa «trimestre» en ningún sitio: las tres copias saldrán idénticas.',
    });
  }
  return avisos;
}
