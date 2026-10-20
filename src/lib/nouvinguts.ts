// Nouvinguts: helpers puros (sin IO). Ficha: docs/28-nouvinguts.md.
//
// Un nouvingut es un alumno nuevo con sus pasos (matrícula, claves de Educamos, protección de
// datos, correo, iPad, ASM…) hasta que alguien cierra su ciclo. Aquí está todo lo que se
// decide sin tocar la BBDD: el catálogo de pasos, cómo queda el proceso con lo que se ha
// ajustado en pantalla, el estado de cada paso a partir de los datos del alumno, el emparejado
// de las altas de Educamos con lo apuntado a mano y quién NO es nouvingut (3 años de verano).
import { z } from 'zod';
import { CONFIGURACION } from '@/lib/configuracion';
import { cursoBaseEso, cursoEnBanco, ETAPAS_VISIBLES, etapaDeCurso, nivelDeCurso, ordenCurso, type Etapa } from '@/lib/cursos';

// ─── Pasos ────────────────────────────────────────────────────────────────────

export const CLAVES_PASO = [
  'educamos',
  'matricula',
  'claves',
  'proteccion',
  'banco',
  'ampa',
  'materiales',
  'foto',
  'correo',
  'vinculo_correo',
  'ipad',
  'asm',
  'licencias',
] as const;
export type ClavePaso = (typeof CLAVES_PASO)[number];

export function esClavePaso(valor: unknown): valor is ClavePaso {
  return typeof valor === 'string' && (CLAVES_PASO as readonly string[]).includes(valor);
}

export const RESPONSABLES = ['secretaria', 'tic'] as const;
export type Responsable = (typeof RESPONSABLES)[number];
export const RESPONSABLE_LABEL: Record<Responsable, string> = { secretaria: 'Secretaría', tic: 'TIC' };

export interface DefinicionPaso {
  clave: ClavePaso;
  titulo: string;
  /** Cabecera de columna en la lista (cabe en 40 px). */
  corto: string;
  responsable: Responsable;
  /** Desde qué curso le toca por defecto (código de la BBDD central); null = a todos. */
  desde: string | null;
  /** Se resuelve marcándolo a mano (no hay ningún dato en otro sitio que lo diga). */
  manual: boolean;
  /** De dónde sale, en pantalla. */
  fuente: string;
  /** El «desde» no se ajusta aquí: lo decide otro sitio (el banco, por los ajustes del centro). */
  desdeFijo?: string;
}

// El orden por defecto es el de esta lista; SuperTIC y TIC lo cambian en Proceso.
export const PASOS: readonly DefinicionPaso[] = [
  { clave: 'educamos', titulo: 'Alta en Educamos', corto: 'Edu', responsable: 'secretaria', desde: null, manual: false, fuente: 'Automático · sincronización de Educamos' },
  { clave: 'matricula', titulo: 'Nº de matrícula', corto: 'Nº', responsable: 'secretaria', desde: null, manual: false, fuente: 'Automático · si falta, se escribe aquí' },
  { clave: 'claves', titulo: 'Claves de Educamos a la familia', corto: 'Claves', responsable: 'secretaria', desde: null, manual: true, fuente: 'A mano' },
  { clave: 'proteccion', titulo: 'Protección de datos', corto: 'PD', responsable: 'secretaria', desde: null, manual: false, fuente: 'Automático · Alumnado' },
  { clave: 'banco', titulo: 'Banco de libros', corto: 'Banco', responsable: 'secretaria', desde: null, manual: false, fuente: 'Se decide aquí · Banco de libros', desdeFijo: 'Según el banco de libros' },
  { clave: 'ampa', titulo: 'AMPA', corto: 'AMPA', responsable: 'secretaria', desde: null, manual: false, fuente: 'Se decide aquí · Alumnado' },
  { clave: 'materiales', titulo: 'Materiales comprados', corto: 'Mat.', responsable: 'secretaria', desde: null, manual: false, fuente: 'Automático · Venta de materiales' },
  { clave: 'foto', titulo: 'Foto en Educamos', corto: 'Foto', responsable: 'secretaria', desde: null, manual: true, fuente: 'A mano' },
  { clave: 'correo', titulo: 'Correo de Google', corto: 'Correo', responsable: 'tic', desde: null, manual: false, fuente: 'Automático · ficha del alumno' },
  { clave: 'vinculo_correo', titulo: 'Correo vinculado en Educamos', corto: 'Vinc.', responsable: 'tic', desde: null, manual: true, fuente: 'A mano' },
  { clave: 'ipad', titulo: 'iPad', corto: 'iPad', responsable: 'tic', desde: '6PRI', manual: false, fuente: 'Automático · Dispositivos 1:1' },
  { clave: 'asm', titulo: 'Apple School Manager', corto: 'ASM', responsable: 'tic', desde: '6PRI', manual: false, fuente: 'Automático · AUTOASM' },
  { clave: 'licencias', titulo: 'Licencias', corto: 'Lic.', responsable: 'tic', desde: '6PRI', manual: false, fuente: 'Automático · Licencias' },
];

const POR_CLAVE = new Map(PASOS.map((p, i) => [p.clave, { ...p, i }]));

export function definicionPaso(clave: ClavePaso): DefinicionPaso {
  return POR_CLAVE.get(clave)!;
}

export interface ConfigPaso {
  clave: string;
  orden: number;
  activo: boolean;
  responsable: string;
  desdeCurso: string | null;
}

export interface PasoProceso extends DefinicionPaso {
  activo: boolean;
}

/**
 * El proceso tal y como lo han dejado en pantalla: lo de por defecto de `PASOS` con lo que
 * diga `nou_pasos` encima. Un paso sin fila sale con lo suyo y en su sitio de la lista (así uno
 * nuevo en código entra solo); una fila de un paso que ya no existe se ignora.
 */
export function procesoEfectivo(config: readonly ConfigPaso[]): PasoProceso[] {
  const porClave = new Map(config.filter((c) => esClavePaso(c.clave)).map((c) => [c.clave, c]));
  return PASOS.map((p, i) => {
    const c = porClave.get(p.clave);
    const responsable = c && (RESPONSABLES as readonly string[]).includes(c.responsable) ? (c.responsable as Responsable) : p.responsable;
    return {
      paso: { ...p, responsable, desde: c ? c.desdeCurso : p.desde, activo: c ? c.activo : true },
      orden: c ? c.orden : i,
      i,
    };
  })
    .sort((a, b) => a.orden - b.orden || a.i - b.i)
    .map((x) => x.paso);
}

// ─── Cursos ───────────────────────────────────────────────────────────────────

const SUFIJO: Record<Etapa, string> = { EI: 'INF', EP: 'PRI', ESO: 'ESO', BACH: 'BACH' };

/** «3 años», «1º EP», «2º ESO», «1º Bach.». */
export function etiquetaCurso(curso: string | null | undefined): string {
  if (!curso) return 'Sin curso';
  const etapa = etapaDeCurso(curso);
  const nivel = nivelDeCurso(curso);
  if (etapa === 'EI') return `${nivel} años`;
  if (etapa === 'EP') return `${nivel}º EP`;
  if (etapa === 'ESO') return /PDC/i.test(curso) ? `${nivel}º PDC` : `${nivel}º ESO`;
  if (etapa === 'BACH') return `${nivel}º Bach.`;
  return curso;
}

/** Los cursos que se ofrecen en los desplegables, en orden (infantil → ESO). */
export function cursosOfrecidos(): { codigo: string; etiqueta: string; etapa: Etapa }[] {
  const lista: { codigo: string; etiqueta: string; etapa: Etapa }[] = [];
  for (const etapa of ETAPAS_VISIBLES) {
    const { min, max } = CONFIGURACION.niveles[etapa];
    for (let n = min; n <= max; n++) {
      const codigo = `${n}${SUFIJO[etapa]}`;
      lista.push({ codigo, etiqueta: etiquetaCurso(codigo), etapa });
    }
  }
  return lista;
}

/** ¿Le toca un paso que va «desde» un curso? Sin «desde», a todos; sin curso, a nadie. */
export function aplicaDesde(curso: string | null | undefined, desde: string | null): boolean {
  if (!desde) return true;
  if (!curso) return false;
  return ordenCurso(cursoBaseEso(curso)) >= ordenCurso(desde);
}

/**
 * Los 3 años matriculados de junio a septiembre NO son nouvinguts: vienen del arranque de
 * curso, que es otro proceso (David, 19-oct-2026). Un 3 años que llega en noviembre sí lo es.
 */
export const MESES_INICIO_CURSO = [6, 7, 8, 9];

export function esInicioDeCurso(curso: string | null | undefined, fechaISO: string): boolean {
  if (etapaDeCurso(curso) !== 'EI' || nivelDeCurso(curso) !== CONFIGURACION.niveles.EI.min) return false;
  const mes = Number(fechaISO.slice(5, 7));
  return MESES_INICIO_CURSO.includes(mes);
}

// ─── Estado de cada paso ──────────────────────────────────────────────────────

export const ESTADOS_PASO = ['hecho', 'pendiente', 'aviso', 'no_aplica'] as const;
export type EstadoPaso = (typeof ESTADOS_PASO)[number];

export interface MarcaPaso {
  valor: string;
  porNombre: string | null;
  at: string; // ISO
}

export type EstadoMaterialNou = 'pagado' | 'no' | 'becado' | 'no_aplica';

/** Todo lo que hace falta saber de un nouvingut para decidir sus pasos. Sale del servidor. */
export interface DatosNouvingut {
  /** Vinculado a su ficha de Educamos. */
  vinculado: boolean;
  /** Sigue activo en la BBDD central (false = dado de baja después de llegar). */
  activo: boolean;
  avisoVinculo: string | null;
  curso: string | null;
  matricula: string | null;
  proteccion: {
    actualizadoAt: string | null;
    imagen: boolean | null;
    redes: boolean | null;
    ampa: boolean | null;
    ong: boolean | null;
  } | null;
  desestimaCorreo: boolean;
  bancoLibros: boolean | null;
  ampa: boolean | null;
  emailGoogle: string | null;
  /** Los materiales vivos que van a su clase, con su estado (null = sin información). */
  materiales: { id: string; nombre: string; estado: EstadoMaterialNou | null }[];
  /** Fecha (ISO) de la subida a ASM que ya le incluye, o null. */
  asmSubidaAt: string | null;
  /**
   * Cómo tiene el iPad, según Dispositivos 1:1 (docs/29-dispositivos.md); null = sin informar.
   * `texto` ya viene escrito («Comprado · 2026-27 · con seguro», «Prestado A3 · en el cole»).
   */
  dispositivo: { modalidad: string; texto: string; cursoCompra: string | null; aCasa: boolean | null } | null;
  licencias: {
    campania: string | null; // nombre de la campaña vigente, null = no hay
    enCampania: boolean; // está en el alumnado de esa campaña
    pedidoAt: string | null;
    noPedira: boolean;
  };
  marcas: Partial<Record<ClavePaso, MarcaPaso>>;
}

export interface ResultadoPaso {
  clave: ClavePaso;
  titulo: string;
  corto: string;
  responsable: Responsable;
  fuente: string;
  manual: boolean;
  estado: EstadoPaso;
  /** La línea de debajo del título: el valor, o qué falta. */
  texto: string;
  marca: MarcaPaso | null;
}

function siNo(v: boolean | null): string {
  return v === true ? 'sí' : v === false ? 'no' : '¿?';
}

/** «Imagen sí · Redes no · AMPA sí · ONG sí». */
export function textoProteccion(pd: NonNullable<DatosNouvingut['proteccion']>): string {
  return `Imagen ${siNo(pd.imagen)} · Redes ${siNo(pd.redes)} · AMPA ${siNo(pd.ampa)} · ONG ${siNo(pd.ong)}`;
}

export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '';
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
}

const ESPERANDO = 'Cuando esté en Educamos';

type Estado = { estado: EstadoPaso; texto: string };

function porMarca(m: MarcaPaso | undefined, hecho: string, pendiente: string): Estado {
  return m ? { estado: 'hecho', texto: `${hecho} el ${fechaCorta(m.at)}${m.porNombre ? ` · ${m.porNombre}` : ''}` } : { estado: 'pendiente', texto: pendiente };
}

/** El estado de un paso. `paso.desde` ya viene del proceso efectivo. */
export function estadoPaso(paso: PasoProceso, d: DatosNouvingut): Estado {
  const m = d.marcas[paso.clave];
  // «Desde» primero: lo que no le toca por curso no le toca, esté vinculado o no.
  if (paso.clave === 'banco') {
    if (d.curso && !cursoEnBanco(d.curso)) return { estado: 'no_aplica', texto: 'Su curso no tiene banco de libros' };
  } else if (!aplicaDesde(d.curso, paso.desde)) {
    return { estado: 'no_aplica', texto: 'No le toca por su curso' };
  }
  if ((paso.clave === 'correo' || paso.clave === 'vinculo_correo') && d.desestimaCorreo) {
    return { estado: 'no_aplica', texto: 'La familia desestima el correo' };
  }

  switch (paso.clave) {
    case 'educamos':
      if (d.vinculado) return d.activo ? { estado: 'hecho', texto: 'Vinculado a su ficha de Educamos' } : { estado: 'aviso', texto: 'Dado de baja en Educamos' };
      if (d.avisoVinculo) return { estado: 'aviso', texto: d.avisoVinculo };
      return { estado: 'pendiente', texto: 'Esperando a la sincronización de Educamos' };
    case 'matricula':
      if (!d.vinculado) return { estado: 'pendiente', texto: ESPERANDO };
      return d.matricula?.trim()
        ? { estado: 'hecho', texto: `Nº ${d.matricula.trim()}` }
        : { estado: 'aviso', texto: 'NO ESTÁ EN EDUCAMOS el número de matrícula' };
    case 'proteccion':
      if (!d.vinculado || !d.proteccion) return { estado: 'pendiente', texto: ESPERANDO };
      return d.proteccion.actualizadoAt
        ? { estado: 'hecho', texto: textoProteccion(d.proteccion) }
        : { estado: 'pendiente', texto: 'Todavía no se sabe' };
    case 'banco':
      if (!d.vinculado) return { estado: 'pendiente', texto: ESPERANDO };
      return m ? { estado: 'hecho', texto: d.bancoLibros ? 'Sí, entra en el banco' : 'No entra en el banco' } : { estado: 'pendiente', texto: 'Todavía no se sabe' };
    case 'ampa':
      if (!d.vinculado) return { estado: 'pendiente', texto: ESPERANDO };
      return m ? { estado: 'hecho', texto: d.ampa ? 'Es del AMPA' : 'No es del AMPA' } : { estado: 'pendiente', texto: 'Todavía no se sabe' };
    case 'materiales': {
      if (!d.vinculado) return { estado: 'pendiente', texto: ESPERANDO };
      if (d.materiales.length === 0) return { estado: 'no_aplica', texto: 'No hay materiales a la venta para su clase' };
      const sin = d.materiales.filter((x) => x.estado === null).length;
      if (sin === 0) return { estado: 'hecho', texto: d.materiales.map((x) => `${x.nombre}: ${TEXTO_MATERIAL[x.estado!]}`).join(' · ') };
      return { estado: 'pendiente', texto: sin === d.materiales.length ? 'Todavía no se sabe' : `Faltan ${sin} de ${d.materiales.length}` };
    }
    case 'correo':
      if (d.emailGoogle?.trim()) return { estado: 'hecho', texto: d.emailGoogle.trim() };
      return { estado: 'pendiente', texto: d.vinculado ? 'Sin correo en su ficha' : ESPERANDO };
    case 'asm':
      if (!d.vinculado) return { estado: 'pendiente', texto: ESPERANDO };
      return d.asmSubidaAt
        ? { estado: 'hecho', texto: `En la subida a ASM del ${fechaCorta(d.asmSubidaAt)}` }
        : { estado: 'aviso', texto: 'No está en Apple School Manager' };
    case 'licencias': {
      if (!d.vinculado) return { estado: 'pendiente', texto: ESPERANDO };
      const l = d.licencias;
      if (l.pedidoAt) return { estado: 'hecho', texto: `Pedido hecho el ${fechaCorta(l.pedidoAt)}` };
      if (l.noPedira || m) return { estado: 'hecho', texto: 'No pedirá licencias' };
      if (!l.campania) return { estado: 'pendiente', texto: 'No hay campaña de licencias' };
      if (!l.enCampania) return { estado: 'aviso', texto: 'No está en el alumnado de la campaña de licencias' };
      return { estado: 'aviso', texto: `Sin pedido en «${l.campania}»` };
    }
    case 'claves':
      return porMarca(m, 'Entregadas', 'Sin entregar');
    case 'foto':
      return porMarca(m, 'Puesta', 'Sin foto');
    case 'vinculo_correo':
      return porMarca(m, 'Vinculado', 'Sin vincular');
    case 'ipad':
      // Lo dice Dispositivos 1:1. La marca a mano queda para quien no tenga ese módulo.
      if (d.dispositivo) return { estado: 'hecho', texto: d.dispositivo.texto };
      if (m) return porMarca(m, 'Resuelto a mano', '');
      return { estado: 'pendiente', texto: d.vinculado ? 'Sin informar en Dispositivos 1:1' : ESPERANDO };
  }
}

const TEXTO_MATERIAL: Record<EstadoMaterialNou, string> = { pagado: 'pagado', no: 'no', becado: 'becado', no_aplica: 'no aplica' };

/** Los pasos activos de un nouvingut, en el orden del proceso, con su estado. */
export function pasosDeNouvingut(proceso: readonly PasoProceso[], d: DatosNouvingut): ResultadoPaso[] {
  return proceso
    .filter((p) => p.activo)
    .map((p) => {
      const { estado, texto } = estadoPaso(p, d);
      return {
        clave: p.clave,
        titulo: p.titulo,
        corto: p.corto,
        responsable: p.responsable,
        fuente: p.fuente,
        manual: p.manual,
        estado,
        texto,
        marca: d.marcas[p.clave] ?? null,
      };
    });
}

export interface ResumenPasos {
  hechos: number;
  /** Los que le tocan (sin los «no le toca»). */
  total: number;
  pendientes: Record<Responsable, number>;
  avisos: number;
  listo: boolean;
  /** El primer paso sin hacer, en el orden del proceso. */
  siguiente: ResultadoPaso | null;
  /** El primer aviso, que es lo que se enseña en la lista. */
  primerAviso: ResultadoPaso | null;
}

export function resumenPasos(pasos: readonly ResultadoPaso[]): ResumenPasos {
  const aplican = pasos.filter((p) => p.estado !== 'no_aplica');
  const abiertos = aplican.filter((p) => p.estado !== 'hecho');
  const pendientes: Record<Responsable, number> = { secretaria: 0, tic: 0 };
  for (const p of abiertos) pendientes[p.responsable]++;
  return {
    hechos: aplican.length - abiertos.length,
    total: aplican.length,
    pendientes,
    avisos: abiertos.filter((p) => p.estado === 'aviso').length,
    listo: abiertos.length === 0,
    siguiente: abiertos[0] ?? null,
    primerAviso: abiertos.find((p) => p.estado === 'aviso') ?? null,
  };
}

/** Días desde una fecha ISO (yyyy-mm-dd) hasta hoy (yyyy-mm-dd). */
export function diasDesde(fechaISO: string, hoyISO: string): number {
  const a = Date.UTC(Number(fechaISO.slice(0, 4)), Number(fechaISO.slice(5, 7)) - 1, Number(fechaISO.slice(8, 10)));
  const b = Date.UTC(Number(hoyISO.slice(0, 4)), Number(hoyISO.slice(5, 7)) - 1, Number(hoyISO.slice(8, 10)));
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

// ─── Emparejar altas de Educamos con lo apuntado a mano ──────────────────────

/** «Marta  Llorens Giménez» → «MARTA LLORENS GIMENEZ»: lo que se compara al emparejar. */
export function claveNombre(...partes: (string | null | undefined)[]): string {
  return partes
    .filter(Boolean)
    .join(' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9Ñ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface Apuntado {
  id: string;
  nombre: string | null;
  apellidos: string | null;
  curso: string | null;
}

export interface AltaEducamos {
  id: string;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  curso: string | null;
}

export interface Emparejado {
  vinculos: { apuntadoId: string; altaId: string }[];
  /** Apuntados con más de una alta que se le parece (o que comparten alta con otro apuntado). */
  dudosos: { apuntadoId: string; candidatos: string[] }[];
}

/**
 * Empareja lo apuntado a mano con las altas de una sincronización por nombre y apellidos
 * normalizados (el curso solo desempata). **Solo vincula si la coincidencia es única en los
 * dos sentidos**: una alta que se parece a dos apuntados, o un apuntado al que se le parecen
 * dos altas (hermanos), no se adivina — se devuelve como dudoso para que lo elija una persona.
 */
export function emparejarAltas(apuntados: readonly Apuntado[], altas: readonly AltaEducamos[]): Emparejado {
  const altasPorClave = new Map<string, AltaEducamos[]>();
  for (const a of altas) {
    const k = claveNombre(a.nombre, a.apellido1, a.apellido2);
    if (!k) continue;
    altasPorClave.set(k, [...(altasPorClave.get(k) ?? []), a]);
  }

  const propuestas: { apuntadoId: string; candidatos: string[] }[] = [];
  for (const ap of apuntados) {
    const k = claveNombre(ap.nombre, ap.apellidos);
    let candidatos = k ? (altasPorClave.get(k) ?? []) : [];
    if (candidatos.length > 1 && ap.curso) {
      const base = cursoBaseEso(ap.curso);
      const mismoCurso = candidatos.filter((c) => cursoBaseEso(c.curso) === base);
      if (mismoCurso.length === 1) candidatos = mismoCurso;
    }
    if (candidatos.length > 0) propuestas.push({ apuntadoId: ap.id, candidatos: candidatos.map((c) => c.id) });
  }

  // Una alta que dos apuntados reclaman como única no es de ninguno de los dos.
  const reclamos = new Map<string, number>();
  for (const p of propuestas) if (p.candidatos.length === 1) reclamos.set(p.candidatos[0], (reclamos.get(p.candidatos[0]) ?? 0) + 1);

  const vinculos: Emparejado['vinculos'] = [];
  const dudosos: Emparejado['dudosos'] = [];
  for (const p of propuestas) {
    if (p.candidatos.length === 1 && reclamos.get(p.candidatos[0]) === 1) vinculos.push({ apuntadoId: p.apuntadoId, altaId: p.candidatos[0] });
    else dudosos.push(p);
  }
  return { vinculos, dudosos };
}

// ─── Avisos por correo ────────────────────────────────────────────────────────

/** A quién se avisa: por rol de la plataforma (TIC incluye SuperTIC). */
export const GRUPOS_AVISO = ['direccion', 'secretaria', 'tic'] as const;
export type GrupoAviso = (typeof GRUPOS_AVISO)[number];
export const GRUPO_AVISO_LABEL: Record<GrupoAviso, string> = { direccion: 'Dirección', secretaria: 'Secretaría', tic: 'TIC' };
export const ROLES_DE_GRUPO: Record<GrupoAviso, readonly string[]> = {
  direccion: ['direccion'],
  secretaria: ['secretaria'],
  tic: ['tic', 'supertic'],
};

/** Los momentos en que sale un correo solo, y a quién va por defecto. */
export const EVENTOS_AVISO = ['alta', 'secretaria_terminada', 'tic_terminada', 'listo'] as const;
export type EventoAviso = (typeof EVENTOS_AVISO)[number];

export const EVENTO_AVISO: Record<EventoAviso, { titulo: string; detalle: string; defecto: GrupoAviso[] }> = {
  alta: {
    titulo: 'Llega uno nuevo',
    detalle: 'Al apuntarlo a mano o cuando entra con la sincronización de Educamos (un correo por sincronización).',
    defecto: ['tic'],
  },
  secretaria_terminada: {
    titulo: 'Secretaría ha terminado su parte',
    detalle: 'Cuando a un alumno ya no le queda nada de secretaría y sí de TIC.',
    defecto: ['tic'],
  },
  tic_terminada: {
    titulo: 'TIC ha terminado su parte',
    detalle: 'Cuando a un alumno ya no le queda nada de TIC y sí de secretaría.',
    defecto: [],
  },
  listo: {
    titulo: 'Listo para cerrar',
    detalle: 'Cuando a un alumno ya no le queda ningún paso: alguien tiene que cerrar su ciclo.',
    defecto: ['secretaria'],
  },
};

export type AvisosNouvinguts = Record<EventoAviso, GrupoAviso[]>;

/**
 * Qué eventos han pasado entre dos resúmenes de un mismo alumno (antes y después de tocar un
 * paso). Solo transiciones: si ya estaba a cero, no se vuelve a avisar.
 */
export function eventosDeCambio(
  antes: Pick<ResumenPasos, 'listo' | 'pendientes'>,
  despues: Pick<ResumenPasos, 'listo' | 'pendientes'>,
): EventoAviso[] {
  if (despues.listo) return antes.listo ? [] : ['listo'];
  const eventos: EventoAviso[] = [];
  if (antes.pendientes.secretaria > 0 && despues.pendientes.secretaria === 0) eventos.push('secretaria_terminada');
  if (antes.pendientes.tic > 0 && despues.pendientes.tic === 0) eventos.push('tic_terminada');
  return eventos;
}

// ─── Ajustes ──────────────────────────────────────────────────────────────────

export interface AjustesNouvinguts {
  /** A partir de cuántos días sin terminar sale el día en naranja. */
  diasAtasco: number;
  /** Correos automáticos: a qué grupos va cada evento (vacío = no sale). */
  avisos: AvisosNouvinguts;
}

function avisosPorDefecto(): AvisosNouvinguts {
  return Object.fromEntries(EVENTOS_AVISO.map((e) => [e, [...EVENTO_AVISO[e].defecto]])) as AvisosNouvinguts;
}

export const AJUSTES_POR_DEFECTO: AjustesNouvinguts = { diasAtasco: 10, avisos: avisosPorDefecto() };

export function leerAjustesNouvinguts(valor: unknown): AjustesNouvinguts {
  const v = (valor ?? {}) as { diasAtasco?: unknown; avisos?: Record<string, unknown> };
  const dias = Number(v.diasAtasco);
  const avisos = avisosPorDefecto();
  for (const e of EVENTOS_AVISO) {
    const guardado = v.avisos?.[e];
    if (Array.isArray(guardado)) avisos[e] = GRUPOS_AVISO.filter((g) => guardado.includes(g));
  }
  return { diasAtasco: Number.isInteger(dias) && dias >= 1 && dias <= 365 ? dias : AJUSTES_POR_DEFECTO.diasAtasco, avisos };
}

/** Correos del dominio sueltos para mandar una nota («a.perez@…, b.gil@…»). */
export function correosSueltos(texto: string, dominio: string): { validos: string[]; malos: string[] } {
  const partes = texto
    .split(/[\s,;]+/)
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  const validos: string[] = [];
  const malos: string[] = [];
  for (const p of partes) {
    if (/^[^@\s]+@[^@\s]+$/.test(p) && p.endsWith(`@${dominio}`)) {
      if (!validos.includes(p)) validos.push(p);
    } else malos.push(p);
  }
  return { validos, malos };
}

// ─── Validación (cliente y servidor) ──────────────────────────────────────────

const fechaISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida');
const mayusculas = (max: number, campo: string) =>
  z
    .string()
    .trim()
    .min(1, `Falta ${campo}`)
    .max(max)
    .transform((s) => s.replace(/\s+/g, ' ').toUpperCase());

export const altaSchema = z.object({
  nombre: mayusculas(60, 'el nombre'),
  apellidos: mayusculas(100, 'los apellidos'),
  curso: z.string().refine((c) => cursosOfrecidos().some((o) => o.codigo === c), 'Elige el curso'),
  fechaMatricula: fechaISO,
  nota: z.string().trim().max(1000).optional(),
});
export type AltaNouvingut = z.infer<typeof altaSchema>;

export const editarSchema = z.union([
  z.object({ accion: z.literal('cerrar') }),
  z.object({ accion: z.literal('reabrir') }),
  z.object({
    accion: z.literal('datos'),
    fechaMatricula: fechaISO.optional(),
    nombre: mayusculas(60, 'el nombre').optional(),
    apellidos: mayusculas(100, 'los apellidos').optional(),
    curso: z.string().refine((c) => cursosOfrecidos().some((o) => o.codigo === c), 'Elige el curso').optional(),
  }),
]);

const pasoManual = z.enum(['claves', 'foto', 'vinculo_correo', 'ipad']);
const permiso = z.boolean().nullable();

export const accionPasoSchema = z.discriminatedUnion('paso', [
  z.object({ paso: pasoManual, hecho: z.boolean() }),
  z.object({ paso: z.literal('matricula'), numero: z.string().trim().min(1, 'Escribe el número').max(40) }),
  z.object({ paso: z.literal('proteccion'), imagen: permiso, redes: permiso, ampa: permiso, ong: permiso }),
  z.object({ paso: z.literal('banco'), valor: z.boolean().nullable() }),
  z.object({ paso: z.literal('ampa'), valor: z.boolean().nullable() }),
  z.object({
    paso: z.literal('materiales'),
    materialId: z.string().uuid(),
    estado: z.enum(['pagado', 'no', 'becado', 'no_aplica']).nullable(),
  }),
  z.object({ paso: z.literal('correo'), email: z.string().trim().toLowerCase().email('Correo no válido').max(200) }),
  z.object({ paso: z.literal('licencias'), noPedira: z.boolean() }),
]);
export type AccionPaso = z.infer<typeof accionPasoSchema>;

export const notaSchema = z.object({
  paso: z.enum(CLAVES_PASO).nullable(),
  texto: z.string().trim().min(1, 'La nota está vacía').max(2000),
  /** Mandarla también por correo (desde el buzón de quien la escribe). */
  correo: z
    .object({
      grupos: z.array(z.enum(GRUPOS_AVISO)).max(GRUPOS_AVISO.length),
      otros: z.array(z.string().trim().toLowerCase().email('Hay un correo que no vale')).max(10),
    })
    .refine((c) => c.grupos.length + c.otros.length > 0, 'Elige a quién mandarla')
    .optional(),
});

export const procesoSchema = z.object({
  pasos: z
    .array(
      z.object({
        clave: z.enum(CLAVES_PASO),
        activo: z.boolean(),
        responsable: z.enum(RESPONSABLES),
        desdeCurso: z.string().max(20).nullable(),
      }),
    )
    .length(CLAVES_PASO.length)
    .refine((p) => new Set(p.map((x) => x.clave)).size === CLAVES_PASO.length, 'Falta algún paso'),
  diasAtasco: z.number().int().min(1).max(365),
  avisos: z.object(
    Object.fromEntries(EVENTOS_AVISO.map((e) => [e, z.array(z.enum(GRUPOS_AVISO)).max(GRUPOS_AVISO.length)])) as Record<
      EventoAviso,
      z.ZodArray<z.ZodEnum<{ direccion: 'direccion'; secretaria: 'secretaria'; tic: 'tic' }>>
    >,
  ),
});

export const importarSchema = z.object({ desde: fechaISO, dry: z.boolean().optional() });
