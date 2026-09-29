// Helpers puros de «Números del cole» (sin IO, testeables). Ficha: docs/24-numeros.md
//
// El servidor manda UN recuento por clase (`FilaClase`: un saco de números con nombre) y todo
// lo demás sale de aquí, en el navegador: subtotales de curso y etapa, porcentajes, las
// columnas de cada pestaña, «solo lo básico», las frases para pegar y los formatos de copiar.
// Así cambiar de pestaña o de nivel no cuesta ni una petición, y una foto del histórico se
// lee con las mismas funciones que la tabla de hoy.
import { compararClases, cursoBaseEso, cursoEnBanco, etapaDeCurso, nivelDeCurso, type Etapa } from '@/lib/cursos';

// ─── Los datos ────────────────────────────────────────────────────────────────

/** Recuentos con nombre (`alumnos`, `banco.si`, `mat.<id>.pagado`…). Lo que no está vale 0. */
export type Valores = Record<string, number>;

export interface FilaClase {
  curso: string;
  letra: string | null;
  etapa: Etapa;
  v: Valores;
}

export interface MaterialNumeros {
  id: string;
  nombre: string;
  importe: number | null;
}

export interface CampanaNumeros {
  nombre: string;
  /** 'draft' | 'open' | 'closed' */
  estado: string;
}

/** Lo que quien mira puede ver, ya decidido en el servidor (docs/24-numeros.md, decisión 2). */
export interface PermisosNumeros {
  proteccion: boolean;
  licencias: boolean;
  perfil: boolean;
  becas: boolean;
}

export interface DatosNumeros {
  /** Versión del formato: las fotos guardan esto tal cual, y hay que poder leer las viejas. */
  version: 1;
  generadoAt: string;
  academicYear: string;
  filas: FilaClase[];
  materiales: MaterialNumeros[];
  campana: CampanaNumeros | null;
  profes: { EI: number; EP: number; ESO: number; sinEtapa: number };
}

export const g = (v: Valores, clave: string): number => v[clave] ?? 0;

export function sumar(filas: readonly { v: Valores }[]): Valores {
  const out: Valores = {};
  for (const f of filas) for (const [k, n] of Object.entries(f.v)) out[k] = (out[k] ?? 0) + n;
  return out;
}

// ─── Nombres ──────────────────────────────────────────────────────────────────

export const ETAPA_NOMBRE: Record<Etapa, string> = { EI: 'Infantil', EP: 'Primaria', ESO: 'Secundaria' };
export const ETAPAS_ORDEN: readonly Etapa[] = ['EI', 'EP', 'ESO'];

/** Colores de etapa para SVG y canvas (validados para daltonismo en claro y oscuro). */
export const ETAPA_HEX: Record<Etapa, { claro: string; oscuro: string }> = {
  EI: { claro: '#d97316', oscuro: '#d4772c' },
  EP: { claro: '#2563eb', oscuro: '#4f80ee' },
  ESO: { claro: '#0e9f6e', oscuro: '#1f9f6d' },
};

const esPdc = (curso: string, letra: string | null) => /PDC/i.test(curso) || letra?.toUpperCase() === 'PDC';

/** «3 años A», «1º EP A», «1º ESO A», «3º PDC». */
export function nombreClase(curso: string, letra: string | null): string {
  const etapa = etapaDeCurso(curso);
  const nivel = nivelDeCurso(curso);
  const l = letra ? ` ${letra}` : '';
  if (etapa === 'EI') return `${nivel} años${l}`;
  if (etapa === 'EP') return `${nivel}º EP${l}`;
  if (esPdc(curso, letra)) return `${nivel}º PDC`;
  return `${nivel}º ESO${l}`;
}

/** «Infantil 3 años», «1º Primaria», «3º ESO» (el PDC va dentro de su curso de ESO). */
export function nombreCurso(curso: string): string {
  const etapa = etapaDeCurso(curso);
  const nivel = nivelDeCurso(curso);
  if (etapa === 'EI') return `Infantil ${nivel} años`;
  if (etapa === 'EP') return `${nivel}º Primaria`;
  return `${nivel}º ESO`;
}

// ─── La tabla: filas de clase, curso, etapa y total ───────────────────────────

export type Nivel = 'etapas' | 'cursos' | 'clases';
export type TipoFila = 'clase' | 'curso' | 'etapa' | 'total';

export interface FilaTabla {
  tipo: TipoFila;
  etapa: Etapa | null;
  nombre: string;
  clave: string;
  v: Valores;
  /** Cuántas clases suma: «Clases» y «Media por clase» salen de aquí. */
  clases: number;
}

const conClases = (filas: readonly FilaClase[]): Valores => ({ ...sumar(filas), clases: filas.length });

/**
 * El árbol aplanado en el orden de siempre (infantil → primaria → secundaria). En «clases»
 * se intercala el total de cada curso que tenga más de una, y siempre el de cada etapa;
 * al final, todo el cole si hay más de una etapa.
 */
export function construirTabla(filas: readonly FilaClase[], nivel: Nivel): FilaTabla[] {
  const ordenadas = [...filas].sort(compararClases);
  const out: FilaTabla[] = [];
  const etapas = ETAPAS_ORDEN.filter((e) => ordenadas.some((f) => f.etapa === e));
  for (const e of etapas) {
    const deEtapa = ordenadas.filter((f) => f.etapa === e);
    if (nivel !== 'etapas') {
      const cursos = [...new Set(deEtapa.map((f) => cursoBaseEso(f.curso) ?? f.curso))];
      for (const curso of cursos) {
        const delCurso = deEtapa.filter((f) => (cursoBaseEso(f.curso) ?? f.curso) === curso);
        if (nivel === 'clases') {
          for (const f of delCurso) {
            out.push({
              tipo: 'clase',
              etapa: e,
              nombre: nombreClase(f.curso, f.letra),
              clave: `${f.curso}|${f.letra ?? ''}`,
              v: { ...f.v, clases: 1 },
              clases: 1,
            });
          }
          if (delCurso.length > 1) {
            out.push({ tipo: 'curso', etapa: e, nombre: `Total ${nombreCurso(curso)}`, clave: `c|${curso}`, v: conClases(delCurso), clases: delCurso.length });
          }
        } else {
          out.push({ tipo: 'curso', etapa: e, nombre: nombreCurso(curso), clave: `c|${curso}`, v: conClases(delCurso), clases: delCurso.length });
        }
      }
    }
    out.push({
      tipo: 'etapa',
      etapa: e,
      nombre: nivel === 'etapas' ? ETAPA_NOMBRE[e] : `Total ${ETAPA_NOMBRE[e]}`,
      clave: `e|${e}`,
      v: conClases(deEtapa),
      clases: deEtapa.length,
    });
  }
  if (etapas.length > 1) {
    out.push({ tipo: 'total', etapa: null, nombre: 'Todo el cole', clave: 'total', v: conClases(ordenadas), clases: ordenadas.length });
  }
  return out;
}

/** El nombre para la frase: «1º ESO», «Primaria», «todo el cole». */
export function nombreEnFrase(fila: Pick<FilaTabla, 'tipo' | 'nombre'>): string {
  return fila.tipo === 'total' ? 'todo el cole' : fila.nombre.replace(/^Total /, '');
}

// ─── Columnas y pestañas ──────────────────────────────────────────────────────

export type PestanaId = 'resumen' | 'familias' | 'banco' | 'materiales' | 'proteccion' | 'licencias' | 'perfil' | 'datos';

export interface Columna {
  id: string;
  titulo: string;
  sub?: string;
  valor: (v: Valores) => number;
  /** Denominador del %: sin él, la columna no tiene %. */
  base?: (v: Valores) => number;
  /** `false` = en esa fila no tiene sentido (sale «—»): el banco en Infantil. */
  aplica?: (v: Valores) => boolean;
  basico?: boolean;
  barra?: boolean;
  tono?: 'rojo' | 'ambar';
  formato?: 'entero' | 'decimal' | 'euros';
  /** «Clases», «Media por clase»: en una fila de clase no dicen nada. */
  soloGrupos?: boolean;
  /** Por qué lleva candado, si lo lleva. */
  candado?: string;
  /** Una línea para quien toca el número: de dónde sale. */
  porque?: string;
}

export interface Pestana {
  id: PestanaId;
  titulo: string;
  columnas: Columna[];
  frase: (nombre: string, v: Valores) => string;
}

export interface ContextoPestanas {
  permisos: PermisosNumeros;
  materiales: readonly MaterialNumeros[];
  /** El material que se está mirando en la pestaña de materiales. */
  materialId: string | null;
  /** ¿El papel es para todo el cole o para una etapa? Ver `clavePapeles`. */
  papel: 'cole' | 'etapa';
  hayLicencias: boolean;
}

const pct = (a: number, b: number) => (b ? `${Math.round((a * 100) / b)} %` : '—');
const dec1 = (x: number) => x.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const euros = (x: number) =>
  `${x.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/**
 * Un papel por familia, al hermano mayor. Si el papel es para todo el cole, cuenta el mayor
 * del cole; si es solo para una etapa, el mayor DENTRO de esa etapa (en Primaria, el mayor
 * de Primaria aunque tenga un hermano en la ESO). Con un filtro de etapa puesto, o viendo solo
 * una etapa, siempre es lo segundo.
 */
export function clavePapeles(papel: 'cole' | 'etapa'): 'fam.papeles' | 'fam.papelesEtapa' {
  return papel === 'etapa' ? 'fam.papelesEtapa' : 'fam.papeles';
}

export function pestanas(ctx: ContextoPestanas): Pestana[] {
  const { permisos } = ctx;
  const kp = clavePapeles(ctx.papel);
  const out: Pestana[] = [];

  out.push({
    id: 'resumen',
    titulo: 'Resumen',
    columnas: [
      { id: 'alumnos', titulo: 'Alumnos', valor: (v) => g(v, 'alumnos'), basico: true },
      { id: 'chicas', titulo: 'Chicas', valor: (v) => g(v, 'chicas'), base: (v) => g(v, 'alumnos') },
      { id: 'chicos', titulo: 'Chicos', valor: (v) => g(v, 'chicos'), base: (v) => g(v, 'alumnos') },
      { id: 'clases', titulo: 'Clases', valor: (v) => g(v, 'clases'), soloGrupos: true },
      {
        id: 'media',
        titulo: 'Media',
        sub: 'por clase',
        valor: (v) => (g(v, 'clases') ? g(v, 'alumnos') / g(v, 'clases') : 0),
        formato: 'decimal',
        soloGrupos: true,
      },
      {
        id: 'nuevos',
        titulo: 'Nuevos',
        sub: 'este curso',
        valor: (v) => g(v, 'nuevos'),
        base: (v) => g(v, 'alumnos'),
        porque: 'Fecha de alta en Educamos desde el 1 de julio',
      },
      { id: 'hermanos', titulo: 'Con hermanos', sub: 'en el cole', valor: (v) => g(v, 'hermanos'), base: (v) => g(v, 'alumnos') },
    ],
    frase: (n, v) => {
      const a = g(v, 'alumnos');
      const c = g(v, 'clases');
      const reparto = c > 1 ? ` en ${c} clases, ${dec1(a / c)} de media` : '';
      return `En ${n} hay ${a} alumnos (${g(v, 'chicas')} chicas y ${g(v, 'chicos')} chicos)${reparto}. ${g(v, 'nuevos')} han llegado este curso.`;
    },
  });

  out.push({
    id: 'familias',
    titulo: 'Familias y papeles',
    columnas: [
      { id: 'alumnos', titulo: 'Alumnos', valor: (v) => g(v, 'alumnos'), basico: true },
      {
        id: 'papeles',
        titulo: 'Papeles',
        sub: 'uno por familia, al mayor',
        valor: (v) => g(v, kp),
        base: (v) => g(v, 'alumnos'),
        basico: true,
        barra: true,
        porque: 'Familias cuyo hijo mayor está en esta clase',
      },
      {
        id: 'pequenos',
        titulo: 'Hermanos pequeños',
        sub: 'no se llevan papel',
        valor: (v) => g(v, 'alumnos') - g(v, kp),
        base: (v) => g(v, 'alumnos'),
      },
      { id: 'hermanos', titulo: 'Con hermanos', sub: 'en el cole', valor: (v) => g(v, 'hermanos'), base: (v) => g(v, 'alumnos') },
    ],
    frase: (n, v) => {
      const p = g(v, kp);
      const a = g(v, 'alumnos');
      return `Para dar un papel por familia en ${n} hacen falta ${p} copias, no ${a}: ${a - p} alumnos tienen un hermano mayor que ya se lo lleva${ctx.papel === 'etapa' ? ' dentro de la etapa' : ''}.`;
    },
  });

  const conBanco = (v: Valores) => g(v, 'banco.alumnos') > 0;
  out.push({
    id: 'banco',
    titulo: 'Banco de libros y AMPA',
    columnas: [
      { id: 'banco.alumnos', titulo: 'Alumnos', sub: 'en cursos con banco', valor: (v) => g(v, 'banco.alumnos'), aplica: conBanco },
      {
        id: 'banco.si',
        titulo: 'En el banco',
        valor: (v) => g(v, 'banco.si'),
        base: (v) => g(v, 'banco.alumnos'),
        aplica: conBanco,
        basico: true,
        barra: true,
      },
      { id: 'banco.no', titulo: 'No están', valor: (v) => g(v, 'banco.alumnos') - g(v, 'banco.si'), base: (v) => g(v, 'banco.alumnos'), aplica: conBanco },
      { id: 'lotes', titulo: 'Lotes', sub: 'asignados', valor: (v) => g(v, 'lotes.asignados'), aplica: conBanco },
      { id: 'lotes.entregados', titulo: 'Entregados', valor: (v) => g(v, 'lotes.entregados'), base: (v) => g(v, 'lotes.asignados'), aplica: conBanco },
      { id: 'ampa', titulo: 'AMPA', sub: 'familia socia', valor: (v) => g(v, 'ampa'), basico: true },
    ],
    frase: (n, v) => {
      const a = g(v, 'banco.alumnos');
      const si = g(v, 'banco.si');
      return a
        ? `En ${n}, ${si} de ${a} alumnos están en el banco de libros (${pct(si, a)}) y ${g(v, 'ampa')} son de familias socias del AMPA.`
        : `En ${n} no hay banco de libros (empieza en 3º de Primaria). ${g(v, 'ampa')} alumnos son de familias socias del AMPA.`;
    },
  });

  if (ctx.materiales.length) {
    const m = ctx.materiales.find((x) => x.id === ctx.materialId) ?? ctx.materiales[0];
    const k = (e: string) => `mat.${m.id}.${e}`;
    const van = (v: Valores) => g(v, k('van'));
    const aplica = (v: Valores) => van(v) > 0;
    const sinMarcar = (v: Valores) =>
      van(v) - g(v, k('pagado')) - g(v, k('no')) - g(v, k('becado')) - g(v, k('no_aplica'));
    const columnas: Columna[] = [
      { id: 'van', titulo: 'Van', sub: 'alumnos a los que va', valor: van, aplica },
      { id: 'pagado', titulo: 'Pagado', valor: (v) => g(v, k('pagado')), base: van, aplica, basico: true, barra: true },
      { id: 'no', titulo: 'No', sub: 'sin pagar', valor: (v) => g(v, k('no')), base: van, aplica, tono: 'rojo' },
    ];
    if (permisos.becas) {
      columnas.push({
        id: 'becado',
        titulo: 'Becado',
        valor: (v) => g(v, k('becado')),
        base: van,
        aplica,
        candado: 'Solo dirección, secretaría, orientación y TIC',
      });
    }
    columnas.push(
      { id: 'no_aplica', titulo: 'No aplica', valor: (v) => g(v, k('no_aplica')), aplica },
      { id: 'sin', titulo: 'Sin marcar', valor: sinMarcar, base: van, aplica, basico: true, tono: 'ambar' },
    );
    if (m.importe) {
      columnas.push({
        id: 'recaudado',
        titulo: 'Recaudado',
        sub: `pagados × ${euros(m.importe)}`,
        valor: (v) => g(v, k('pagado')) * (m.importe ?? 0),
        aplica,
        formato: 'euros',
      });
    }
    out.push({
      id: 'materiales',
      titulo: ctx.materiales.length === 1 ? `Materiales · ${m.nombre}` : 'Materiales',
      columnas,
      frase: (n, v) =>
        aplica(v)
          ? `${m.nombre} en ${n}: ${g(v, k('pagado'))} de ${van(v)} pagados (${pct(g(v, k('pagado')), van(v))}), ${g(v, k('no'))} sin pagar y ${sinMarcar(v)} todavía sin marcar.`
          : `${m.nombre} no va a ${n}.`,
    });
  }

  if (permisos.proteccion) {
    out.push({
      id: 'proteccion',
      titulo: 'Protección de datos',
      columnas: [
        { id: 'alumnos', titulo: 'Alumnos', valor: (v) => g(v, 'alumnos') },
        { id: 'pd.si', titulo: 'Todo sí', valor: (v) => g(v, 'pd.todoSi'), base: (v) => g(v, 'alumnos'), basico: true, barra: true },
        { id: 'pd.no', titulo: 'Algún no', valor: (v) => g(v, 'pd.algunNo'), base: (v) => g(v, 'alumnos'), basico: true, tono: 'rojo' },
        { id: 'pd.null', titulo: 'Sin constar', valor: (v) => g(v, 'pd.sinConstar'), tono: 'ambar' },
        { id: 'pd.correo', titulo: 'Sin correo', sub: 'del alumno (desestima)', valor: (v) => g(v, 'pd.sinCorreo'), tono: 'rojo' },
      ],
      frase: (n, v) => {
        const no = g(v, 'pd.algunNo');
        const c = g(v, 'pd.sinCorreo');
        return `En ${n}, ${g(v, 'pd.todoSi')} de ${g(v, 'alumnos')} alumnos lo tienen todo autorizado. ${no ? `${no} tienen algún «no»` : 'Nadie ha dicho que no a nada'} y ${c ? `${c} no quieren correo del cole` : 'todos pueden tener correo del cole'}.`;
      },
    });
  }

  if (permisos.licencias && ctx.hayLicencias) {
    const en = (v: Valores) => g(v, 'lic.alumnos') > 0;
    out.push({
      id: 'licencias',
      titulo: 'Licencias',
      columnas: [
        { id: 'lic.alumnos', titulo: 'Alumnos', sub: 'en la campaña', valor: (v) => g(v, 'lic.alumnos'), aplica: en },
        { id: 'lic.pedidos', titulo: 'Con pedido', valor: (v) => g(v, 'lic.pedidos'), base: (v) => g(v, 'lic.alumnos'), aplica: en, basico: true, barra: true },
        { id: 'lic.faltan', titulo: 'Faltan', valor: (v) => g(v, 'lic.faltan'), aplica: en, basico: true, tono: 'rojo' },
        { id: 'lic.nop', titulo: 'No pedirán', sub: 'marcados a mano', valor: (v) => g(v, 'lic.noPediran'), aplica: en },
        { id: 'lic.importe', titulo: 'Importe', sub: 'pedidos de pago', valor: (v) => g(v, 'lic.importe'), aplica: en, formato: 'euros' },
        { id: 'lic.cobrado', titulo: 'Cobrado', valor: (v) => g(v, 'lic.cobrado'), aplica: en, formato: 'euros' },
        { id: 'lic.licencias', titulo: 'Licencias', valor: (v) => g(v, 'lic.licencias'), aplica: en },
        { id: 'lic.enviadas', titulo: 'Enviadas', valor: (v) => g(v, 'lic.enviadas'), base: (v) => g(v, 'lic.licencias'), aplica: en },
      ],
      frase: (n, v) =>
        en(v)
          ? `Licencias en ${n}: ${g(v, 'lic.pedidos')} de ${g(v, 'lic.alumnos')} alumnos tienen pedido (${pct(g(v, 'lic.pedidos'), g(v, 'lic.alumnos'))}), faltan ${g(v, 'lic.faltan')}. ${euros(g(v, 'lic.importe'))} en pedidos y ${g(v, 'lic.enviadas')} de ${g(v, 'lic.licencias')} licencias ya enviadas.`
          : `En ${n} no hay licencias digitales en esta campaña.`,
    });
  }

  if (permisos.perfil) {
    const edad = (v: Valores) => (g(v, 'perfil.edadN') ? g(v, 'perfil.edadSuma') / g(v, 'perfil.edadN') : 0);
    out.push({
      id: 'perfil',
      titulo: 'Perfil del alumnado',
      columnas: [
        { id: 'alumnos', titulo: 'Alumnos', valor: (v) => g(v, 'alumnos'), basico: true },
        { id: 'edad', titulo: 'Edad media', valor: edad, formato: 'decimal', basico: true },
        {
          id: 'desde3',
          titulo: 'Desde 3 años',
          sub: 'con nosotros desde Infantil',
          valor: (v) => g(v, 'perfil.desde3'),
          base: (v) => g(v, 'alumnos'),
          barra: true,
          porque: 'Según la fecha de alta de Educamos',
        },
        {
          id: 'mayores',
          titulo: 'Mayores',
          sub: 'que su curso',
          valor: (v) => g(v, 'perfil.mayores'),
          candado: 'Información académica: equipo directivo, orientación, secretaría y TIC',
          porque: 'Nacidos antes del año que toca a su curso: casi siempre, repetición',
        },
        { id: 'extranjeros', titulo: 'Otra', sub: 'nacionalidad', valor: (v) => g(v, 'perfil.extranjeros'), base: (v) => g(v, 'alumnos') },
        { id: 'fuera', titulo: 'De fuera', sub: 'de Burriana', valor: (v) => g(v, 'perfil.fuera'), porque: 'Localidad del primer familiar' },
        { id: 'numerosa', titulo: 'Fam. numerosa', valor: (v) => g(v, 'perfil.numerosa') },
        { id: 'empleados', titulo: 'Hijos de', sub: 'empleados', valor: (v) => g(v, 'perfil.empleados') },
      ],
      frase: (n, v) =>
        `En ${n} la edad media es de ${dec1(edad(v))} años; ${g(v, 'perfil.desde3')} de ${g(v, 'alumnos')} están con nosotros desde los 3 años (${pct(g(v, 'perfil.desde3'), g(v, 'alumnos'))}), ${g(v, 'perfil.extranjeros')} son de otra nacionalidad y ${g(v, 'perfil.fuera')} viven fuera de Burriana.`,
    });
  }

  const dosTutores = (v: Valores) => g(v, 'tut.dosAlumnos') > 0;
  out.push({
    id: 'datos',
    titulo: 'Datos que faltan',
    columnas: [
      { id: 'alumnos', titulo: 'Alumnos', valor: (v) => g(v, 'alumnos') },
      { id: 'nia', titulo: 'Sin NIA', valor: (v) => g(v, 'datos.sinNia'), basico: true, tono: 'rojo' },
      { id: 'dni', titulo: 'Sin DNI', valor: (v) => g(v, 'datos.sinDni'), base: (v) => g(v, 'alumnos') },
      { id: 'sip', titulo: 'Sin tarjeta', sub: 'sanitaria (SIP)', valor: (v) => g(v, 'datos.sinSip'), base: (v) => g(v, 'alumnos'), tono: 'ambar' },
      { id: 'tel', titulo: 'Sin teléfono', sub: 'de emergencia', valor: (v) => g(v, 'datos.sinTel'), base: (v) => g(v, 'alumnos'), basico: true, tono: 'ambar' },
      { id: 'google', titulo: 'Sin cuenta', sub: 'Google', valor: (v) => g(v, 'datos.sinGoogle'), porque: 'En Infantil es lo normal: no tienen cuenta' },
      {
        id: 'tp',
        titulo: 'Sin tutor personal',
        sub: 'clases con 2 tutores',
        valor: (v) => g(v, 'tut.faltaPersonal'),
        aplica: dosTutores,
        tono: 'rojo',
      },
    ],
    frase: (n, v) =>
      `En ${n} faltan ${g(v, 'datos.sinNia')} NIA, ${g(v, 'datos.sinSip')} tarjetas sanitarias y ${g(v, 'datos.sinTel')} teléfonos de emergencia${dosTutores(v) ? `, y hay ${g(v, 'tut.faltaPersonal')} alumnos sin tutor personal en clases con dos tutores` : ''}.`,
  });

  return out;
}

/** Las columnas que se ven: con «solo lo básico», solo las marcadas. */
export function columnasVisibles(p: Pestana, basico: boolean): Columna[] {
  return basico ? p.columnas.filter((c) => c.basico) : p.columnas;
}

// ─── Celdas ───────────────────────────────────────────────────────────────────

export interface Celda {
  /** Lo que se pinta: «1.234», «93 %», «23,5», «1.234,50 €», «—». */
  texto: string;
  /** Lo que se copia a una hoja de cálculo: sin puntos de miles y con coma decimal. */
  crudo: string;
  valor: number | null;
  /** Porcentaje sobre su base (0-100), si la columna tiene base. */
  pct: number | null;
  vacia: boolean;
}

const VACIA: Celda = { texto: '—', crudo: '', valor: null, pct: null, vacia: true };

export function celda(col: Columna, fila: Pick<FilaTabla, 'tipo' | 'v'>, modo: 'n' | 'p'): Celda {
  if (col.soloGrupos && fila.tipo === 'clase') return { ...VACIA, texto: '', crudo: '' };
  if (col.aplica && !col.aplica(fila.v)) return VACIA;
  const valor = col.valor(fila.v);
  const base = col.base ? col.base(fila.v) : null;
  const p = base ? (valor * 100) / base : null;
  if (modo === 'p' && col.base) {
    if (!base) return VACIA;
    const r = Math.round(p ?? 0);
    return { texto: `${r} %`, crudo: `${r}%`, valor, pct: p, vacia: false };
  }
  if (col.formato === 'euros') {
    return { texto: euros(valor), crudo: valor.toFixed(2).replace('.', ','), valor, pct: p, vacia: false };
  }
  if (col.formato === 'decimal') return { texto: dec1(valor), crudo: dec1(valor), valor, pct: p, vacia: false };
  return { texto: valor.toLocaleString('es-ES'), crudo: String(Math.round(valor)), valor, pct: p, vacia: false };
}

// ─── Copiar: hoja de cálculo, documento y (en el cliente) imagen ─────────────

export interface TablaCopiable {
  titulo: string;
  subtitulo: string;
  cabecera: string[];
  filas: { tipo: TipoFila; etapa: Etapa | null; celdas: string[]; crudas: string[] }[];
}

export function tablaCopiable(
  titulo: string,
  subtitulo: string,
  nivel: Nivel,
  columnas: readonly Columna[],
  filas: readonly FilaTabla[],
  modo: 'n' | 'p',
): TablaCopiable {
  const primera = nivel === 'etapas' ? 'Etapa' : nivel === 'cursos' ? 'Curso' : 'Clase';
  return {
    titulo,
    subtitulo,
    cabecera: [primera, ...columnas.map((c) => (c.sub ? `${c.titulo} ${c.sub}` : c.titulo))],
    filas: filas.map((f) => {
      const cs = columnas.map((c) => celda(c, f, modo));
      return {
        tipo: f.tipo,
        etapa: f.etapa,
        celdas: [f.nombre, ...cs.map((c) => c.texto)],
        crudas: [f.nombre, ...cs.map((c) => c.crudo)],
      };
    }),
  };
}

/** Texto separado por tabuladores: se pega en A1 y cada número cae en su celda. */
export function aTSV(t: TablaCopiable): string {
  const limpio = (s: string) => s.replace(/[\t\r\n]+/g, ' ');
  return [t.cabecera, ...t.filas.map((f) => f.crudas)].map((r) => r.map(limpio).join('\t')).join('\n');
}

const escaparHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Tabla HTML con estilos en línea: Docs, Gmail y Sheets la respetan al pegar. */
export function aHTML(t: TablaCopiable): string {
  const borde = 'border:1px solid #cfd6e0;padding:4px 8px';
  const cab = t.cabecera.map((c) => `<th style="${borde};background:#eef2f8;text-align:left;font-weight:600">${escaparHtml(c)}</th>`).join('');
  const cuerpo = t.filas
    .map((f) => {
      const grupo = f.tipo !== 'clase' && f.tipo !== 'curso' ? true : f.tipo === 'curso' && f.celdas[0].startsWith('Total');
      const fondo = f.tipo === 'total' ? '#e3e9f3' : grupo ? '#f4f6fa' : '#ffffff';
      const celdas = f.celdas
        .map(
          (c, i) =>
            `<td style="${borde};background:${fondo};${i ? 'text-align:right;' : ''}${grupo ? 'font-weight:600' : ''}">${escaparHtml(c)}</td>`,
        )
        .join('');
      return `<tr>${celdas}</tr>`;
    })
    .join('');
  return `<p><b>${escaparHtml(t.titulo)}</b> · ${escaparHtml(t.subtitulo)}</p><table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px"><tr>${cab}</tr>${cuerpo}</table>`;
}

// ─── Lo que llama la atención ─────────────────────────────────────────────────
// Reglas sencillas sobre lo que se está viendo. Devuelven texto con **negritas** (el
// componente las pinta); el día que haya un «Pedir análisis» con IA, esto sigue siendo lo
// que sale sin pedir nada.

export function llamaLaAtencion(
  pestana: PestanaId,
  filas: readonly FilaClase[],
  ctx: { papel: 'cole' | 'etapa'; materialId: string | null; materiales: readonly MaterialNumeros[] },
): string[] {
  if (!filas.length) return [];
  const t = sumar(filas);
  const nom = (f: FilaClase) => nombreClase(f.curso, f.letra);
  const out: string[] = [];
  const max = <T>(xs: readonly T[], f: (x: T) => number) => xs.reduce((a, b) => (f(b) > f(a) ? b : a));

  if (pestana === 'resumen') {
    const grande = max(filas, (f) => g(f.v, 'alumnos'));
    const pequena = max(filas, (f) => -g(f.v, 'alumnos'));
    if (filas.length > 1) {
      out.push(`La clase más llena es **${nom(grande)}** (${g(grande.v, 'alumnos')}) y la más pequeña **${nom(pequena)}** (${g(pequena.v, 'alumnos')}).`);
    }
    const nuevos = g(t, 'nuevos');
    const de3 = sumar(filas.filter((f) => f.etapa === 'EI' && nivelDeCurso(f.curso) === 3)).nuevos ?? 0;
    if (nuevos && de3) out.push(`De los **${nuevos}** nuevos, **${de3}** son los de 3 años; en el resto han entrado ${nuevos - de3}.`);
    else if (nuevos) out.push(`**${nuevos}** alumnos nuevos este curso.`);
  } else if (pestana === 'familias') {
    const k = clavePapeles(ctx.papel);
    const a = g(t, 'alumnos');
    const p = g(t, k);
    out.push(`Con **${p}** copias llegas a todas las familias; una por alumno serían ${a}, **${a - p} de más**.`);
    const m = max(filas, (f) => g(f.v, 'alumnos') - g(f.v, k));
    const dif = g(m.v, 'alumnos') - g(m.v, k);
    if (dif > 0) out.push(`Donde más se nota es en **${nom(m)}**: ${dif} de sus ${g(m.v, 'alumnos')} alumnos tienen un hermano mayor.`);
  } else if (pestana === 'banco') {
    const conBanco = filas.filter((f) => g(f.v, 'banco.alumnos') > 0);
    if (conBanco.length) {
      out.push(`**${pct(g(t, 'banco.si'), g(t, 'banco.alumnos'))}** del alumnado de cursos con banco está dentro.`);
      const baja = max(conBanco, (f) => -(g(f.v, 'banco.si') / g(f.v, 'banco.alumnos')));
      out.push(`Menos participación: **${nom(baja)}**, ${g(baja.v, 'banco.si')} de ${g(baja.v, 'banco.alumnos')}.`);
    }
    const ampa = g(t, 'ampa');
    if (ampa > 2) {
      const top = max(filas, (f) => g(f.v, 'ampa'));
      if (g(top.v, 'ampa') / ampa > 0.6) out.push(`De los **${ampa}** del AMPA, ${g(top.v, 'ampa')} están en **${nom(top)}**. ¿Está a medio marcar?`);
    }
    if (g(t, 'banco.fuera') > 0) out.push(`Hay **${g(t, 'banco.fuera')}** alumnos marcados en el banco en cursos que no lo tienen.`);
  } else if (pestana === 'materiales') {
    const m = ctx.materiales.find((x) => x.id === ctx.materialId) ?? ctx.materiales[0];
    if (m) {
      const k = (e: string) => `mat.${m.id}.${e}`;
      const van = g(t, k('van'));
      const marcados = g(t, k('pagado')) + g(t, k('no')) + g(t, k('becado')) + g(t, k('no_aplica'));
      if (van) out.push(`${m.nombre}: **${marcados} de ${van}** ya marcados; faltan ${van - marcados}.`);
      const sinNada = filas.filter((f) => g(f.v, k('van')) > 0 && g(f.v, k('pagado')) + g(f.v, k('no')) + g(f.v, k('becado')) + g(f.v, k('no_aplica')) === 0);
      if (sinNada.length && sinNada.length < filas.filter((f) => g(f.v, k('van')) > 0).length) {
        out.push(`Clases sin ninguna marca todavía: **${sinNada.length}**.`);
      }
    }
  } else if (pestana === 'proteccion') {
    const no = g(t, 'pd.algunNo');
    out.push(no ? `**${no}** alumnos tienen algún «no» en la protección de datos.` : 'Nadie ha dicho que no a nada todavía: los noes se marcan según llegan.');
    if (g(t, 'pd.sinCorreo')) out.push(`**${g(t, 'pd.sinCorreo')}** familias no quieren correo del cole para su hijo.`);
  } else if (pestana === 'licencias') {
    const faltan = g(t, 'lic.faltan');
    if (faltan) {
      const peor = max(filas, (f) => g(f.v, 'lic.faltan'));
      out.push(`Faltan **${faltan}** pedidos; la clase con más es **${nom(peor)}** (${g(peor.v, 'lic.faltan')}).`);
    } else if (g(t, 'lic.alumnos')) out.push('No falta ningún pedido.');
    const sinEnviar = g(t, 'lic.licencias') - g(t, 'lic.enviadas');
    if (sinEnviar > 0) out.push(`Quedan **${sinEnviar}** licencias por enviar.`);
  } else if (pestana === 'perfil') {
    out.push(`**${pct(g(t, 'perfil.desde3'), g(t, 'alumnos'))}** del alumnado está con nosotros desde los 3 años.`);
    if (g(t, 'perfil.fuera')) out.push(`**${g(t, 'perfil.fuera')}** alumnos viven fuera de Burriana.`);
  } else if (pestana === 'datos') {
    const tel = g(t, 'datos.sinTel');
    if (tel) {
      const peores = [...filas].sort((a, b) => g(b.v, 'datos.sinTel') - g(a.v, 'datos.sinTel')).slice(0, 4);
      const suma = peores.reduce((s, f) => s + g(f.v, 'datos.sinTel'), 0);
      if (suma / tel > 0.4 && filas.length > 4) {
        out.push(`De los **${tel}** teléfonos de emergencia que faltan, ${suma} son de ${peores.map(nom).join(', ')}.`);
      } else out.push(`Faltan **${tel}** teléfonos de emergencia.`);
    }
    for (const f of filas) {
      if (g(f.v, 'tut.faltaPersonal') > 0 && g(f.v, 'tut.faltaPersonal') === g(f.v, 'tut.dosAlumnos')) {
        out.push(`**${nom(f)}** tiene dos tutores y nadie repartido: ${g(f.v, 'tut.faltaPersonal')} alumnos sin tutor personal.`);
      }
    }
  }
  return out.slice(0, 4);
}

// ─── Histórico ────────────────────────────────────────────────────────────────

export interface MetricaHistorico {
  id: string;
  titulo: string;
  valor: (v: Valores) => number;
}

export const METRICAS_HISTORICO: readonly MetricaHistorico[] = [
  { id: 'alumnos', titulo: 'Alumnos', valor: (v) => g(v, 'alumnos') },
  { id: 'familias', titulo: 'Familias', valor: (v) => g(v, 'fam.papeles') },
  { id: 'banco', titulo: 'Banco de libros', valor: (v) => g(v, 'banco.si') },
  { id: 'ampa', titulo: 'AMPA', valor: (v) => g(v, 'ampa') },
  { id: 'nuevos', titulo: 'Nuevos', valor: (v) => g(v, 'nuevos') },
];

/** Un número por etapa (y el total) de una foto. */
export function porEtapa(filas: readonly FilaClase[], valor: (v: Valores) => number): Record<Etapa | 'total', number> {
  const out = { EI: 0, EP: 0, ESO: 0, total: 0 } as Record<Etapa | 'total', number>;
  for (const f of filas) {
    const n = valor(f.v);
    out[f.etapa] += n;
    out.total += n;
  }
  return out;
}

// ─── Utilidades para el servidor ──────────────────────────────────────────────

/** Alumnos «en cursos con banco»: la columna de base del banco. */
export function alumnosEnCursoConBanco(curso: string, alumnos: number): number {
  return cursoEnBanco(curso) ? alumnos : 0;
}

/**
 * Año de nacimiento que toca a un curso en un curso académico que empieza en `inicio`
 * (2026 para 2026-27): 3 años → 2023, 1º EP → 2020, 1º ESO → 2014. Nacer antes es ir
 * «mayor que su curso», que casi siempre quiere decir que ha repetido.
 */
export function anioQueToca(curso: string, inicio: number): number | null {
  const etapa = etapaDeCurso(curso);
  const nivel = nivelDeCurso(curso);
  if (!etapa || nivel === 99) return null;
  if (etapa === 'EI') return inicio - nivel;
  if (etapa === 'EP') return inicio - (nivel + 5);
  return inicio - (nivel + 11);
}

/** «Con nosotros desde los 3 años»: dado de alta, como tarde, el año en que empezó 3 años. */
export function anioDeEmpezar3(curso: string, inicio: number): number | null {
  const etapa = etapaDeCurso(curso);
  const nivel = nivelDeCurso(curso);
  if (!etapa || nivel === 99) return null;
  if (etapa === 'EI') return inicio - (nivel - 3);
  if (etapa === 'EP') return inicio - (nivel + 2);
  return inicio - (nivel + 8);
}

// ─── Recorte por permisos ─────────────────────────────────────────────────────

/**
 * Lo que puede ver quien mira, a partir de los recuentos completos (los de hoy o los de una
 * foto): solo sus clases, las becas sumadas a «pagado» si no las ve, y fuera los números de
 * protección de datos, licencias o perfil si no le tocan. Se hace en el SERVIDOR: lo que no
 * te toca no viaja (docs/24-numeros.md, decisión 2).
 */
export function recortar(
  datos: DatosNumeros,
  opciones: { clases: readonly { curso: string; letra: string | null }[] | null; permisos: PermisosNumeros },
): DatosNumeros {
  const { clases, permisos } = opciones;
  const dentro = (f: FilaClase) =>
    clases === null || clases.some((c) => c.curso === f.curso && (c.letra ?? null) === (f.letra ?? null));
  const filas = datos.filas.filter(dentro).map((f) => {
    const v: Valores = {};
    for (const [k, n] of Object.entries(f.v)) {
      if (!permisos.proteccion && k.startsWith('pd.')) continue;
      if (!permisos.licencias && k.startsWith('lic.')) continue;
      if (!permisos.perfil && k.startsWith('perfil.')) continue;
      v[k] = n;
    }
    if (!permisos.becas) {
      for (const k of Object.keys(v)) {
        if (!k.startsWith('mat.') || !k.endsWith('.becado')) continue;
        const pagado = k.replace(/\.becado$/, '.pagado');
        v[pagado] = (v[pagado] ?? 0) + v[k];
        delete v[k];
      }
    }
    return { ...f, v };
  });
  return { ...datos, filas, campana: permisos.licencias ? datos.campana : null };
}

// ─── Preferencias de quien mira ───────────────────────────────────────────────
// Se recuerdan por persona en una cookie que lee el servidor: así la página sale ya como la
// dejaste («solo lo básico», la pestaña, el nivel), sin parpadear al cargar.

export const COOKIE_PREFERENCIAS = 'numeros-prefs';

export interface Preferencias {
  pestana: PestanaId;
  nivel: Nivel;
  modo: 'n' | 'p';
  basico: boolean;
}

export const PREFERENCIAS_INICIALES: Preferencias = {
  pestana: 'resumen',
  nivel: 'cursos',
  modo: 'n',
  // Se entra viendo lo básico: quien quiere más lo pide con «Ver más datos» (y se recuerda).
  basico: true,
};

const PESTANAS_IDS: readonly PestanaId[] = ['resumen', 'familias', 'banco', 'materiales', 'proteccion', 'licencias', 'perfil', 'datos'];

/** Lee la cookie sin fiarse de ella: lo que no sea válido se queda en lo de siempre. */
export function leerPreferencias(crudo: string | undefined | null): Preferencias {
  let o: Record<string, unknown> = {};
  try {
    const p: unknown = crudo ? JSON.parse(crudo) : {};
    if (p && typeof p === 'object') o = p as Record<string, unknown>;
  } catch {
    // cookie rota: se ignora
  }
  const de = <T extends string>(v: unknown, validos: readonly T[], def: T): T =>
    typeof v === 'string' && (validos as readonly string[]).includes(v) ? (v as T) : def;
  return {
    pestana: de(o.pestana, PESTANAS_IDS, PREFERENCIAS_INICIALES.pestana),
    nivel: de(o.nivel, ['etapas', 'cursos', 'clases'] as const, PREFERENCIAS_INICIALES.nivel),
    modo: de(o.modo, ['n', 'p'] as const, PREFERENCIAS_INICIALES.modo),
    basico: typeof o.basico === 'boolean' ? o.basico : PREFERENCIAS_INICIALES.basico,
  };
}

// ─── Quiénes son: la lista detrás de cada número ──────────────────────────────
// Tocar un número abre la lista de esos alumnos. La lista se pide al servidor con dos cosas:
// QUÉ (una marca del alumnado, un estado de un material o de licencias) y DÓNDE (la fila:
// una clase, un curso, una etapa o todo el cole). El servidor filtra por la misma marca con
// la que contó, así que la lista y el número siempre cuadran.

export type Lista =
  | { tipo: 'a'; marca: string; soloBanco?: boolean }
  | { tipo: 'm'; materialId: string; estado: 'van' | 'pagado' | 'no' | 'becado' | 'no_aplica' | 'sin' }
  | { tipo: 'l'; estado: 'alumnos' | 'pedidos' | 'faltan' | 'nop' };

const LISTAS_ALUMNADO: Record<string, string> = {
  'resumen:alumnos': 'todos',
  'resumen:chicas': 'chica',
  'resumen:chicos': 'chico',
  'resumen:nuevos': 'nuevo',
  'resumen:hermanos': 'con_hermanos',
  'familias:alumnos': 'todos',
  'familias:hermanos': 'con_hermanos',
  'banco:ampa': 'ampa',
  'proteccion:alumnos': 'todos',
  'proteccion:pd.si': 'pd_si',
  'proteccion:pd.no': 'pd_no',
  'proteccion:pd.null': 'pd_null',
  'proteccion:pd.correo': 'pd_correo',
  'perfil:alumnos': 'todos',
  'perfil:desde3': 'desde3',
  'perfil:mayores': 'mayor',
  'perfil:extranjeros': 'extranjero',
  'perfil:fuera': 'fuera',
  'perfil:numerosa': 'numerosa',
  'perfil:empleados': 'empleado',
  'datos:alumnos': 'todos',
  'datos:nia': 'sin_nia',
  'datos:dni': 'sin_dni',
  'datos:sip': 'sin_sip',
  'datos:tel': 'sin_tel',
  'datos:google': 'sin_google',
  'datos:tp': 'falta_tp',
};

/** La lista que hay detrás de una columna, o `null` si esa columna no es de personas (euros, medias). */
export function listaDeColumna(
  pestana: PestanaId,
  columna: string,
  ctx: { papel: 'cole' | 'etapa'; materialId: string | null },
): Lista | null {
  const marca = LISTAS_ALUMNADO[`${pestana}:${columna}`];
  if (marca) return { tipo: 'a', marca };
  if (pestana === 'familias' && columna === 'papeles') return { tipo: 'a', marca: ctx.papel === 'etapa' ? 'papel_etapa' : 'papel_cole' };
  if (pestana === 'familias' && columna === 'pequenos') return { tipo: 'a', marca: ctx.papel === 'etapa' ? 'pequeno_etapa' : 'pequeno_cole' };
  if (pestana === 'banco') {
    if (columna === 'banco.alumnos') return { tipo: 'a', marca: 'todos', soloBanco: true };
    if (columna === 'banco.si') return { tipo: 'a', marca: 'banco', soloBanco: true };
    if (columna === 'banco.no') return { tipo: 'a', marca: 'banco_no', soloBanco: true };
  }
  if (pestana === 'materiales' && ctx.materialId) {
    const estados = { van: 'van', pagado: 'pagado', no: 'no', becado: 'becado', no_aplica: 'no_aplica', sin: 'sin' } as const;
    const estado = estados[columna as keyof typeof estados];
    if (estado) return { tipo: 'm', materialId: ctx.materialId, estado };
  }
  if (pestana === 'licencias') {
    const estados = { 'lic.alumnos': 'alumnos', 'lic.pedidos': 'pedidos', 'lic.faltan': 'faltan', 'lic.nop': 'nop' } as const;
    const estado = estados[columna as keyof typeof estados];
    if (estado) return { tipo: 'l', estado };
  }
  return null;
}

/** Para la URL: `a:chica`, `a:banco:b`, `m:<id>:pagado`, `l:faltan`. */
export function escribirLista(l: Lista): string {
  if (l.tipo === 'a') return `a:${l.marca}${l.soloBanco ? ':b' : ''}`;
  if (l.tipo === 'm') return `m:${l.materialId}:${l.estado}`;
  return `l:${l.estado}`;
}

/** Lo contrario, sin fiarse: lo que no sea exactamente una lista válida es `null`. */
export function leerLista(texto: string | null | undefined, marcasValidas: readonly string[]): Lista | null {
  if (!texto) return null;
  const p = texto.split(':');
  if (p[0] === 'a' && (p.length === 2 || (p.length === 3 && p[2] === 'b')) && marcasValidas.includes(p[1])) {
    return { tipo: 'a', marca: p[1], ...(p.length === 3 ? { soloBanco: true } : {}) };
  }
  if (p[0] === 'm' && p.length === 3 && /^[0-9a-f-]{36}$/i.test(p[1]) && ['van', 'pagado', 'no', 'becado', 'no_aplica', 'sin'].includes(p[2])) {
    return { tipo: 'm', materialId: p[1], estado: p[2] as 'van' };
  }
  if (p[0] === 'l' && p.length === 2 && ['alumnos', 'pedidos', 'faltan', 'nop'].includes(p[1])) {
    return { tipo: 'l', estado: p[1] as 'alumnos' };
  }
  return null;
}

/** ¿Está esta clase dentro de la fila? La fila es su `clave` de `construirTabla`. */
export function enAmbito(ambito: string, curso: string, letra: string | null): boolean {
  if (ambito === 'total') return true;
  if (ambito.startsWith('e|')) return etapaDeCurso(curso) === ambito.slice(2);
  if (ambito.startsWith('c|')) return (cursoBaseEso(curso) ?? curso) === ambito.slice(2);
  return ambito === `${curso}|${letra ?? ''}`;
}

/** Marcas que son información de perfil (solo quien ve la pestaña de perfil). */
export const MARCAS_PERFIL: readonly string[] = ['desde3', 'mayor', 'extranjero', 'fuera', 'numerosa', 'empleado'];
