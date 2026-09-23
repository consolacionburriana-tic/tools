// Informes a medida de Alumnado: eliges columnas (banco de libros, AMPA, protección de datos,
// cada material…), un ámbito y un formato, y sale un PDF, un Excel o un CSV.
// Ficha: docs/21-alumnado.md (fase 3).
//
// Este fichero es PURO: decide qué columnas hay, qué se pone en cada celda, cómo se filtra y
// cómo se agrupa. Los formatos (PDF con pdf-lib, Excel con `xlsx-escribir`) solo pintan lo
// que sale de `construirInforme`, así que los tres dicen exactamente lo mismo.
//
// Lo que ya viene recortado de fuera, y aquí no se vuelve a mirar: el alcance (quién ve a
// quién), la protección de datos que no te toca (llega como `null` y sale en blanco) y las
// becas (llegan ya cambiadas por «pagado» para quien no deba verlas).
import {
  CAMPOS_PROTECCION,
  ESTADO_MATERIAL_LABEL,
  PROTECCION_LABELS,
  aplicaMaterial,
  generalProteccion,
  type CampoProteccion,
  type DestinoMaterial,
  type EstadoMaterial,
} from '@/lib/alumnado';

/** Cómo se pinta una celda: el formato decide el color, el informe decide el significado. */
export type TonoCelda = 'si' | 'no' | 'aviso' | 'beca' | 'gris' | 'nada';

export interface CeldaInforme {
  texto: string;
  tono: TonoCelda;
  /** Valor canónico, el que usa el filtro («si», «no», «pagado», «sin»…). */
  clave: string;
}

export interface AlumnoInforme {
  id: string;
  completo: string;
  apellidos: string;
  nombre: string;
  curso: string;
  letra: string | null;
  clase: string;
  numero: number | null;
  nia: string | null;
  bancoLibros: boolean;
  ampa: boolean;
  proteccion: (Record<CampoProteccion, boolean | null> & { desestimaCorreo: boolean }) | null;
  materiales: Record<string, EstadoMaterial>;
}

export interface MaterialInforme {
  id: string;
  nombre: string;
  destinos: DestinoMaterial[];
}

export type ClaveColumna =
  | 'nia'
  | 'banco'
  | 'ampa'
  | 'pd'
  | `pd_${CampoProteccion}`
  | 'pd_correo'
  | `mat:${string}`;

export interface ColumnaInforme {
  clave: ClaveColumna;
  titulo: string;
  /** Grupo en el selector de la pantalla. */
  grupo: 'Datos' | 'Participación' | 'Protección de datos' | 'Materiales';
  /** Valores por los que se puede filtrar, en el orden del desplegable. */
  valores: { clave: string; texto: string }[];
  /** ¿Cuenta como «sí» para el total de la clase? (null = esta columna no se totaliza). */
  cuenta: ((c: CeldaInforme) => boolean) | null;
}

const SI_NO = [
  { clave: 'si', texto: 'Sí' },
  { clave: 'no', texto: 'No' },
];
const esSi = (c: CeldaInforme) => c.clave === 'si';

/** Todas las columnas posibles, con los materiales que haya este curso. */
export function columnasDisponibles(materiales: readonly MaterialInforme[]): ColumnaInforme[] {
  return [
    { clave: 'nia', titulo: 'NIA', grupo: 'Datos', valores: [], cuenta: null },
    { clave: 'banco', titulo: 'Banco de libros', grupo: 'Participación', valores: SI_NO, cuenta: esSi },
    { clave: 'ampa', titulo: 'AMPA', grupo: 'Participación', valores: SI_NO, cuenta: esSi },
    {
      clave: 'pd',
      titulo: 'Protección de datos',
      grupo: 'Protección de datos',
      valores: [...SI_NO, { clave: 'parcial', texto: 'Parcial' }],
      cuenta: esSi,
    },
    ...CAMPOS_PROTECCION.map(
      (c): ColumnaInforme => ({
        clave: `pd_${c}`,
        titulo: PROTECCION_LABELS[c].titulo,
        grupo: 'Protección de datos',
        valores: SI_NO,
        cuenta: esSi,
      }),
    ),
    {
      clave: 'pd_correo',
      titulo: 'Desestima correo',
      grupo: 'Protección de datos',
      valores: SI_NO,
      cuenta: esSi,
    },
    ...materiales.map(
      (m): ColumnaInforme => ({
        clave: `mat:${m.id}`,
        titulo: m.nombre,
        grupo: 'Materiales',
        valores: [
          { clave: 'pagado', texto: 'Pagado' },
          { clave: 'no', texto: 'No pagado' },
          { clave: 'becado', texto: 'Becado' },
          { clave: 'no_aplica', texto: 'No aplica' },
          { clave: 'sin', texto: 'Sin información' },
        ],
        // Becado cuenta como pagado: lo tiene y no lo debe.
        cuenta: (c) => c.clave === 'pagado' || c.clave === 'becado',
      }),
    ),
  ];
}

const VACIA: CeldaInforme = { texto: '', tono: 'nada', clave: '' };

/**
 * `alReves`: en «desestima correo» el sí es lo raro, y va en rojo. `neutro`: en banco de
 * libros y AMPA un «no» no es ningún problema, y pintarlo en rojo llenaría la hoja de alarmas.
 */
function siNo(valor: boolean | null, modo: 'normal' | 'alReves' | 'neutro' = 'normal'): CeldaInforme {
  if (valor === null) return { texto: '—', tono: 'gris', clave: 'sin' };
  const bueno = modo === 'alReves' ? !valor : valor;
  const tono: TonoCelda = bueno ? 'si' : modo === 'neutro' ? 'gris' : 'no';
  return { texto: valor ? 'Sí' : 'No', tono, clave: valor ? 'si' : 'no' };
}

/** Lo que va en una celda. */
export function celda(
  alumno: AlumnoInforme,
  clave: ClaveColumna,
  materiales: ReadonlyMap<string, MaterialInforme>,
): CeldaInforme {
  if (clave === 'nia') return { texto: alumno.nia ?? '', tono: 'nada', clave: alumno.nia ?? '' };
  if (clave === 'banco') return siNo(alumno.bancoLibros, 'neutro');
  if (clave === 'ampa') return siNo(alumno.ampa, 'neutro');

  if (clave.startsWith('pd')) {
    // La protección de datos que no te toca llega como null: sale en blanco, no como «no».
    const pd = alumno.proteccion;
    if (!pd) return VACIA;
    if (clave === 'pd') {
      const g = generalProteccion(pd);
      if (g === 'si') return { texto: 'Sí', tono: 'si', clave: 'si' };
      if (g === 'no') return { texto: 'No', tono: 'no', clave: 'no' };
      if (g === 'parcial') return { texto: 'Parcial', tono: 'aviso', clave: 'parcial' };
      return { texto: '—', tono: 'gris', clave: 'sin' };
    }
    if (clave === 'pd_correo') return siNo(pd.desestimaCorreo, 'alReves');
    return siNo(pd[clave.slice(3) as CampoProteccion]);
  }

  const id = clave.slice(4);
  const material = materiales.get(id);
  // A quien el material no va dirigido se le deja la celda vacía: no es «no aplica» marcado a
  // mano, es que esa columna no es suya.
  if (!material || !aplicaMaterial(material.destinos, alumno)) return VACIA;
  const estado = alumno.materiales[id] ?? null;
  if (estado === null) return { texto: ESTADO_MATERIAL_LABEL.sin.corto, tono: 'gris', clave: 'sin' };
  const tono: TonoCelda = estado === 'pagado' ? 'si' : estado === 'no' ? 'no' : estado === 'becado' ? 'beca' : 'gris';
  return { texto: ESTADO_MATERIAL_LABEL[estado].texto, tono, clave: estado };
}

export interface FiltroInforme {
  columna: ClaveColumna;
  valor: string;
}

export interface GrupoInforme {
  clase: string;
  /** Tutores de la clase, para el encabezado de su folio. */
  tutores: string[];
  filas: { numero: number | null; alumno: string; celdas: CeldaInforme[] }[];
  /** `n/total` por columna, o null si esa columna no se totaliza o no aplica a nadie. */
  totales: (string | null)[];
}

export interface Informe {
  titulo: string;
  ambito: string;
  columnas: ColumnaInforme[];
  grupos: GrupoInforme[];
  total: number;
}

/**
 * El informe entero: filtra, agrupa por clase (en el orden en que llegan, que es el de
 * `listaAlumnado`) y saca los totales de cada clase. Un grupo que se queda sin nadie tras el
 * filtro desaparece: en un listado de «quién NO ha pagado la agenda», una clase vacía es
 * ruido.
 */
export function construirInforme(opciones: {
  alumnos: readonly AlumnoInforme[];
  columnas: readonly ClaveColumna[];
  materiales: readonly MaterialInforme[];
  filtro?: FiltroInforme | null;
  titulo?: string;
  ambito: string;
  /** `true` = una sola tabla con la clase como columna, en vez de un bloque por clase. */
  sinAgrupar?: boolean;
  /** Nombre de la clase → sus tutores. */
  tutores?: Record<string, string[]>;
}): Informe {
  const disponibles = columnasDisponibles(opciones.materiales);
  const porClave = new Map(disponibles.map((c) => [c.clave, c]));
  const columnas = opciones.columnas
    .map((c) => porClave.get(c))
    .filter((c): c is ColumnaInforme => Boolean(c));
  const materiales = new Map(opciones.materiales.map((m) => [m.id, m]));

  const filtro = opciones.filtro && porClave.has(opciones.filtro.columna) ? opciones.filtro : null;
  const pasan = filtro
    ? opciones.alumnos.filter((a) => celda(a, filtro.columna, materiales).clave === filtro.valor)
    : opciones.alumnos;

  const grupos: GrupoInforme[] = [];
  const indice = new Map<string, GrupoInforme>();
  for (const a of pasan) {
    const clave = opciones.sinAgrupar ? '' : a.clase;
    let grupo = indice.get(clave);
    if (!grupo) {
      grupo = { clase: clave, tutores: opciones.tutores?.[clave] ?? [], filas: [], totales: [] };
      indice.set(clave, grupo);
      grupos.push(grupo);
    }
    grupo.filas.push({
      numero: a.numero,
      alumno: opciones.sinAgrupar ? `${a.completo} · ${a.clase}` : a.completo,
      celdas: columnas.map((c) => celda(a, c.clave, materiales)),
    });
  }

  for (const g of grupos) {
    g.totales = columnas.map((c, i) => {
      if (!c.cuenta) return null;
      const aplican = g.filas.filter((f) => f.celdas[i].tono !== 'nada');
      if (aplican.length === 0) return null;
      return `${aplican.filter((f) => c.cuenta!(f.celdas[i])).length}/${aplican.length}`;
    });
  }

  const filtroTexto = filtro
    ? ` · solo ${porClave.get(filtro.columna)!.titulo}: ${
        porClave.get(filtro.columna)!.valores.find((v) => v.clave === filtro.valor)?.texto ?? filtro.valor
      }`
    : '';

  // Título automático: el nombre de las columnas si son pocas; si no, uno genérico (con ocho
  // columnas, la lista de nombres no cabe ni se lee).
  const nombres = columnas.filter((c) => c.clave !== 'nia').map((c) => c.titulo);
  const automatico = nombres.length === 0 ? 'Listado' : nombres.length <= 3 ? nombres.join(' · ') : 'Informe de alumnado';
  return {
    titulo: opciones.titulo?.trim() || automatico,
    ambito: `${opciones.ambito}${filtroTexto}`,
    columnas,
    grupos,
    total: pasan.length,
  };
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

/** CSV con `;` y BOM, como el resto de exportaciones de la casa (Excel en español lo abre bien). */
export function informeCsv(informe: Informe): string {
  const esc = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const cabecera = ['Clase', 'Nº', 'Alumno', ...informe.columnas.map((c) => c.titulo)];
  const lineas = [cabecera.map(esc).join(';')];
  for (const g of informe.grupos) {
    for (const f of g.filas) {
      lineas.push([g.clase, f.numero ?? '', f.alumno, ...f.celdas.map((c) => c.texto)].map(esc).join(';'));
    }
  }
  return '﻿' + lineas.join('\n');
}

/** Nombre de fichero sin sorpresas: «informe-banco-de-libros-2eso-b». */
export function nombreFichero(informe: Pick<Informe, 'titulo' | 'ambito'>, extension: string): string {
  const base = `informe ${informe.titulo} ${informe.ambito.split(' · ')[0]}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return `${base || 'informe'}.${extension}`;
}
