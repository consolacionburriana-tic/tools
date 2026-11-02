// El escritorio de /gestion: qué herramientas hay, en qué grupo va cada una y quién la ve.
// Puro (sin IO): la página le pasa el acceso de la persona y lo que haya que contar, y la
// pantalla (`components/home/escritorio.tsx`) solo pinta. Ficha: docs/03-escritorio-admin.md
//
// Los grupos van por de qué trata cada cosa, no por quién la hizo ni cuándo: «Tu día» es lo
// que cada uno usa para su trabajo; luego alumnado, familias y cobros, la organización del
// centro, la parte de tecnología y, al final, la configuración, que se toca de mes en mes.
// Un módulo nuevo = una entrada en `HERRAMIENTAS`, en su grupo.
import { canAccess, type Acceso } from '@/lib/permissions';
import { esSolicitable, TEXTO_SOLICITAR } from '@/lib/solicitud-acceso';

export const GRUPOS = ['dia', 'alumnado', 'familias', 'centro', 'tic', 'config'] as const;
export type Grupo = (typeof GRUPOS)[number];

export const GRUPO_TITULO: Record<Grupo, string> = {
  dia: 'Tu día',
  alumnado: 'Alumnado',
  familias: 'Familias y cobros',
  centro: 'Organización del centro',
  tic: 'Tecnología',
  config: 'Configuración',
};

/** Los iconos van por nombre: la lista se pasa del servidor a la pantalla como datos. */
export type IconoHerramienta =
  | 'horario'
  | 'tableros'
  | 'conducta'
  | 'oratorios'
  | 'alumnado'
  | 'nouvinguts'
  | 'numeros'
  | 'cuaderno'
  | 'abc'
  | 'licencias'
  | 'banco'
  | 'salidas'
  | 'horarios'
  | 'evaluaciones'
  | 'profes'
  | 'dispositivos'
  | 'cuentas'
  | 'calendarios'
  | 'autoasm'
  | 'usuarios'
  | 'educamos'
  | 'ajustes'
  | 'tareas'
  | 'incidencias';

export type TonoAviso = 'azul' | 'ambar' | 'rojo';

/**
 * Una herramienta que se enseña en gris y no se abre:
 *   - `proximamente`: todavía no está para esta persona («ya llegará»);
 *   - `solicitar`: existe, pero no la tiene; tocarla avisa a los SuperTIC para que se la den.
 */
export type Bloqueo = 'proximamente' | 'solicitar';

export interface Herramienta {
  clave: string;
  titulo: string;
  desc: string;
  href: string;
  grupo: Grupo;
  icono: IconoHerramienta;
  /** Más palabras con las que se encuentra en el buscador («excursiones» → Salidas). */
  palabras: string[];
  badge: { texto: string; tono: TonoAviso } | null;
  bloqueo: Bloqueo | null;
}

/** Lo que la página sabe y cambia lo que se enseña (contadores, el acceso común de Oratorios). */
export interface ContextoEscritorio {
  oratoriosComun: boolean;
  nouvinguts: number | null;
  dispositivosSinInformar: number | null;
  tableros: { pendientes: number; urgente: { texto: string; tono: TonoAviso } | null } | null;
}

interface Definicion extends Omit<Herramienta, 'badge' | 'desc' | 'bloqueo'> {
  desc: string | ((ctx: ContextoEscritorio) => string);
  visible: (acceso: Acceso, ctx: ContextoEscritorio) => boolean;
  badge?: (ctx: ContextoEscritorio) => Herramienta['badge'];
  /** Si devuelve algo, la herramienta sale en gris aunque `visible` diga que no. */
  bloqueo?: (acceso: Acceso, ctx: ContextoEscritorio) => Bloqueo | null;
}

const tiene = (m: Parameters<typeof canAccess>[1]) => (a: Acceso) => canAccess(a, m);

/**
 * El claustro «de a pie»: profe y tutor/a. Para ellos el escritorio enseña menos y lo que
 * todavía no llega, en gris (David, 2-nov-2026, el día de presentarlo al claustro). Es solo lo
 * que se **ve**: los permisos no cambian, y una salida que ya llevan sigue abriéndose por su enlace.
 */
const esClaustroEstandar = (a: Acceso) => a.role === 'profe' || a.role === 'tutor';

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * Todas las herramientas, en el orden en que salen dentro de su grupo (lo más usado arriba).
 * Puntualidad no está: está apagado (`CONFIGURACION.modulosDesactivados`). Cuando se encienda,
 * vuelve aquí, en «Tu día» (registrar) y en «Alumnado» (su panel).
 */
const HERRAMIENTAS: readonly Definicion[] = [
  // ── Tu día ───────────────────────────────────────────────────────────────
  {
    clave: 'mi-horario',
    titulo: 'Mi horario',
    desc: 'El tuyo, con tus notas, y a tu Google Calendar',
    href: '/mi-horario',
    grupo: 'dia',
    icono: 'horario',
    palabras: ['calendar', 'clases', 'huecos'],
    visible: tiene('mi-horario'),
  },
  {
    clave: 'tableros',
    titulo: 'Tableros',
    desc: (ctx) =>
      ctx.tableros && ctx.tableros.pendientes > 0
        ? `${plural(ctx.tableros.pendientes, 'tarea pendiente', 'tareas pendientes')} en tus equipos`
        : 'Tareas por equipos: por hacer, en curso y hecho',
    href: '/gestion/tableros',
    grupo: 'dia',
    icono: 'tableros',
    palabras: ['tareas', 'kanban', 'trello', 'equipos'],
    visible: tiene('tableros'),
    badge: (ctx) => ctx.tableros?.urgente ?? null,
  },
  {
    // El formulario del ABC lo puede mandar cualquiera del claustro (basta la sesión).
    clave: 'registrar-conducta',
    titulo: 'Registrar conducta',
    desc: 'Una incidencia del Registro ABC, en menos de un minuto',
    href: '/registro-abc',
    grupo: 'dia',
    icono: 'conducta',
    palabras: ['abc', 'incidencia', 'conducta', 'nee'],
    visible: () => true,
  },
  {
    clave: 'oratorios-ver',
    titulo: 'Oratorios y talleres',
    desc: 'Los momentos que te quitan una hora de clase',
    href: '/gestion/oratorios',
    grupo: 'dia',
    icono: 'oratorios',
    palabras: ['godly play', 'taller', 'pastoral'],
    // Quien planifica lo tiene en «Organización»; el resto, solo si está abierto el acceso común.
    visible: (a, ctx) => !canAccess(a, 'oratorios') && canAccess(a, 'oratorios-ver') && ctx.oratoriosComun,
  },

  // ── Alumnado ─────────────────────────────────────────────────────────────
  {
    clave: 'alumnado',
    titulo: 'Alumnado',
    desc: 'La ficha de cada alumno: familia, NIA, banco, licencias y protección de datos',
    href: '/gestion/alumnado',
    grupo: 'alumnado',
    icono: 'alumnado',
    palabras: ['ficha', 'familias', 'contacto', 'comedor', 'materiales'],
    visible: tiene('alumnado'),
  },
  {
    clave: 'nouvinguts',
    titulo: 'Nouvinguts',
    desc: 'Alumnado nuevo, paso a paso hasta cerrar su ciclo',
    href: '/gestion/nouvinguts',
    grupo: 'alumnado',
    icono: 'nouvinguts',
    palabras: ['nuevos', 'altas', 'matrícula'],
    visible: tiene('nouvinguts'),
    badge: (ctx) => (ctx.nouvinguts ? { texto: `${ctx.nouvinguts} en curso`, tono: 'azul' } : null),
  },
  {
    clave: 'numeros',
    titulo: 'Números del cole',
    desc: 'Cuántos hay por clase, curso y etapa, listos para copiar',
    href: '/gestion/numeros',
    grupo: 'alumnado',
    icono: 'numeros',
    palabras: ['estadísticas', 'recuentos', 'cifras'],
    // Oculto para el claustro de a pie hasta que se replantee (docs/24-numeros.md, 2-nov-2026).
    visible: (a) => canAccess(a, 'numeros') && !esClaustroEstandar(a),
  },
  {
    clave: 'cuaderno',
    titulo: 'Cuaderno de tutor',
    desc: 'La documentación de tutoría de cada clase, en el Drive de sus tutores',
    href: '/gestion/cuaderno',
    grupo: 'alumnado',
    icono: 'cuaderno',
    palabras: ['tutoría', 'documentos', 'drive'],
    visible: tiene('cuaderno'),
  },
  {
    clave: 'abc',
    titulo: 'Registro ABC',
    desc: 'Las incidencias de conducta registradas y su análisis',
    href: '/gestion/abc',
    grupo: 'alumnado',
    icono: 'abc',
    palabras: ['conducta', 'incidencias', 'nee'],
    visible: tiene('abc'),
  },

  // ── Familias y cobros ────────────────────────────────────────────────────
  {
    clave: 'licencias',
    titulo: 'Licencias digitales',
    desc: 'Pedidos de las familias, editoriales, códigos y cobro',
    href: '/gestion/licencias',
    grupo: 'familias',
    icono: 'licencias',
    palabras: ['libros digitales', 'editoriales', 'pedidos'],
    visible: tiene('licencias'),
  },
  {
    clave: 'bancolibros',
    titulo: 'Banco de libros',
    desc: 'Participantes, lotes por clase y valoración de cada libro',
    href: '/gestion/bancolibros',
    grupo: 'familias',
    icono: 'banco',
    palabras: ['libros', 'lotes', 'ampa'],
    visible: tiene('bancolibros'),
    bloqueo: (a) => (esClaustroEstandar(a) ? 'proximamente' : null),
  },
  {
    clave: 'salidas',
    titulo: 'Salidas y pagos',
    desc: 'Excursiones, justificantes de pago y seguimiento por clase',
    href: '/gestion/salidas',
    grupo: 'familias',
    icono: 'salidas',
    palabras: ['excursiones', 'pagos', 'justificantes'],
    visible: tiene('salidas'),
    bloqueo: (a) => (esClaustroEstandar(a) ? 'proximamente' : null),
  },

  // ── Organización del centro ──────────────────────────────────────────────
  {
    clave: 'horarios',
    titulo: 'Horarios',
    desc: 'Por clase, por profe y por aula',
    href: '/gestion/horarios',
    grupo: 'centro',
    icono: 'horarios',
    palabras: ['aulas', 'sesiones'],
    visible: tiene('horarios'),
  },
  {
    clave: 'oratorios',
    titulo: 'Oratorios, Godly Play y Talleres',
    desc: 'Planificar por clase sin quitarle siempre la hora al mismo profe',
    href: '/gestion/oratorios',
    grupo: 'centro',
    icono: 'oratorios',
    palabras: ['pastoral', 'taller', 'pensamiento computacional'],
    visible: tiene('oratorios'),
  },
  {
    clave: 'evaluaciones',
    titulo: 'Evaluaciones',
    desc: 'Evaluar actividades con alumnado, claustro y familias',
    href: '/gestion/evaluaciones',
    grupo: 'centro',
    icono: 'evaluaciones',
    palabras: ['encuestas', 'formularios', 'valoración'],
    visible: tiene('evaluaciones'),
    // Quien no lo tiene lo ve en gris y puede pedirlo: el aviso llega a los SuperTIC.
    bloqueo: (a) => (!canAccess(a, 'evaluaciones') ? 'solicitar' : null),
  },
  {
    // Todavía no existe, para nadie: se enseña en gris para que se sepa que viene.
    clave: 'incidencias',
    titulo: 'Incidencias de mantenimiento y TIC',
    desc: 'Avisar de una avería o de un problema técnico, y ver cómo va',
    href: '/gestion/incidencias',
    grupo: 'centro',
    icono: 'incidencias',
    palabras: ['avería', 'arreglo', 'mantenimiento', 'proyector', 'ordenador', 'wifi'],
    visible: () => true,
    bloqueo: () => 'proximamente',
  },
  {
    clave: 'profes',
    titulo: 'Profesorado y tutorías',
    desc: 'Quién tutoriza cada clase y cómo se llama cada profe',
    href: '/gestion/profes',
    grupo: 'centro',
    icono: 'profes',
    palabras: ['tutores', 'claustro', 'profesores'],
    visible: tiene('profes'),
  },

  // ── Tecnología ───────────────────────────────────────────────────────────
  {
    clave: 'dispositivos',
    titulo: 'Dispositivos 1:1',
    desc: 'El iPad de cada alumno, las cuotas y los iPads del cole',
    href: '/gestion/dispositivos',
    grupo: 'tic',
    icono: 'dispositivos',
    palabras: ['ipad', 'cuotas', 'prestados'],
    visible: tiene('dispositivos'),
    badge: (ctx) =>
      ctx.dispositivosSinInformar ? { texto: `${ctx.dispositivosSinInformar} sin informar`, tono: 'ambar' } : null,
  },
  {
    clave: 'cuentas',
    titulo: 'Correos y grupos',
    desc: 'Cuentas de Google cruzadas con Educamos, unidades y grupos',
    href: '/gestion/cuentas',
    grupo: 'tic',
    icono: 'cuentas',
    palabras: ['google', 'correo', 'gmail', 'unidades organizativas', 'suspender'],
    visible: (a) => canAccess(a, 'cuentas') || canAccess(a, 'cuentas-ver'),
  },
  {
    clave: 'calendarios',
    titulo: 'Classrooms y calendarios',
    desc: 'Las clases y calendarios del dominio: limpiar lo viejo en bloque',
    href: '/gestion/calendarios',
    grupo: 'tic',
    icono: 'calendarios',
    palabras: ['classroom', 'google'],
    visible: tiene('calendarios'),
  },
  {
    clave: 'autoasm',
    titulo: 'AUTOASM',
    desc: 'Los ficheros de Apple School Manager, generados y subidos',
    href: '/gestion/autoasm',
    grupo: 'tic',
    icono: 'autoasm',
    palabras: ['apple', 'asm', 'ipad', 'managed apple id'],
    visible: tiene('autoasm'),
  },

  // ── Configuración ────────────────────────────────────────────────────────
  {
    clave: 'usuarios',
    titulo: 'Usuarios y roles',
    desc: 'Quién puede entrar y con qué permisos',
    href: '/gestion/usuarios',
    grupo: 'config',
    icono: 'usuarios',
    palabras: ['permisos', 'roles', 'acceso'],
    visible: tiene('usuarios'),
  },
  {
    clave: 'educamos',
    titulo: 'BBDD central (Educamos)',
    desc: 'Sincronizar alumnado y profesorado desde los exports',
    href: '/gestion/educamos',
    grupo: 'config',
    icono: 'educamos',
    palabras: ['sincronizar', 'importar', 'excel'],
    visible: tiene('educamos'),
  },
  {
    clave: 'ajustes',
    titulo: 'Ajustes del colegio',
    desc: 'Etapas, calendario y variables de entorno',
    href: '/gestion/ajustes',
    grupo: 'config',
    icono: 'ajustes',
    palabras: ['configuración', 'claude'],
    visible: tiene('ajustes'),
  },
  {
    clave: 'tareas',
    titulo: 'Tareas de la plataforma',
    desc: 'Fallitos apuntados e ideas de módulos nuevos',
    href: '/gestion/tareas',
    grupo: 'config',
    icono: 'tareas',
    palabras: ['errores', 'bugs', 'ideas'],
    visible: tiene('tareas'),
  },
];

/** Las herramientas que ve una persona, en el orden de los grupos (las grises, con su `bloqueo`). */
export function herramientasDe(acceso: Acceso, ctx: ContextoEscritorio): Herramienta[] {
  return HERRAMIENTAS.map((h) => ({ h, bloqueo: h.bloqueo?.(acceso, ctx) ?? null }))
    .filter(({ h, bloqueo }) => bloqueo !== null || h.visible(acceso, ctx))
    .map(({ h, bloqueo }) => ({
      clave: h.clave,
      titulo: h.titulo,
      // Lo que explica la tarjeta de «solicitar» es la frase de siempre, no la descripción del módulo.
      desc:
        bloqueo === 'solicitar' && esSolicitable(h.clave)
          ? TEXTO_SOLICITAR[h.clave]
          : typeof h.desc === 'function'
            ? h.desc(ctx)
            : h.desc,
      href: h.href,
      grupo: h.grupo,
      icono: h.icono,
      palabras: h.palabras,
      badge: bloqueo ? null : h.badge ? h.badge(ctx) : null,
      bloqueo,
    }))
    .sort((a, b) => GRUPOS.indexOf(a.grupo) - GRUPOS.indexOf(b.grupo));
}

/** Para comparar sin mayúsculas ni acentos. */
function normal(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * El buscador del escritorio: todas las palabras tienen que salir en el título, la
 * descripción, el grupo o sus palabras clave. Lo que casa en el título va primero.
 */
export function buscarHerramientas(lista: readonly Herramienta[], consulta: string): Herramienta[] {
  const palabras = normal(consulta).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return [...lista];
  const puntuadas = lista
    .map((h) => {
      const titulo = normal(h.titulo);
      const resto = normal([h.desc, GRUPO_TITULO[h.grupo], ...h.palabras].join(' '));
      if (!palabras.every((p) => titulo.includes(p) || resto.includes(p))) return null;
      return { h, puntos: palabras.filter((p) => titulo.includes(p)).length };
    })
    .filter((x): x is { h: Herramienta; puntos: number } => x !== null);
  // A igualdad de puntos, las que se pueden abrir antes que las grises.
  return puntuadas.sort((a, b) => b.puntos - a.puntos || Number(!!a.h.bloqueo) - Number(!!b.h.bloqueo)).map((x) => x.h);
}

/** «Buenos días» hasta las dos, «buenas tardes» hasta las nueve, y luego «buenas noches». */
export function saludo(fecha: Date, zonaHoraria: string): string {
  const hora = Number(new Intl.DateTimeFormat('es-ES', { hour: 'numeric', hourCycle: 'h23', timeZone: zonaHoraria }).format(fecha));
  if (hora >= 6 && hora < 14) return 'Buenos días';
  if (hora >= 14 && hora < 21) return 'Buenas tardes';
  return 'Buenas noches';
}
