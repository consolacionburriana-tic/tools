// Inventario de TODOS los ajustes del centro, con de dónde sale cada uno: la pantalla
// /gestion/ajustes lo pinta para que se sepa qué hay y dónde se cambia, aunque hoy casi todo
// se cambie con código o en Vercel. Solo servidor: lee `process.env` (y nunca devuelve el
// valor de un secreto, solo si está puesto o no).
import { COLEGIO } from '@/lib/colegio';
import { CONFIGURACION } from '@/lib/configuracion';
import { ETAPA_LABEL, type Etapa } from '@/lib/cursos';

/** Dónde vive un ajuste y, por tanto, cómo se cambia. */
export type OrigenAjuste = 'app' | 'codigo' | 'entorno';

export interface AjusteInventario {
  nombre: string;
  valor: string;
  origen: OrigenAjuste;
  /** Fichero o variable donde vive. */
  donde: string;
  nota?: string;
}

export interface SeccionInventario {
  titulo: string;
  descripcion?: string;
  ajustes: AjusteInventario[];
}

const etapas = (lista: readonly Etapa[]) => lista.map((e) => ETAPA_LABEL[e]).join(', ');
const PROMOCION: Record<string, string> = {
  rota: 'rota (el último vuelve al primero)',
  parejas: 'por parejas (1↔2, 3↔4, 5↔6)',
  sube: 'sube y el último egresa',
};

export function inventarioCentro(): SeccionInventario[] {
  const C = CONFIGURACION;
  const etapasDeEntorno = !!process.env.NEXT_PUBLIC_ETAPAS_VISIBLES;
  return [
    {
      titulo: 'Quién es el colegio',
      descripcion: 'Identidad: se fija una vez al desplegar.',
      ajustes: [
        { nombre: 'Nombre', valor: COLEGIO.nombre, origen: 'codigo', donde: 'src/lib/colegio.ts' },
        { nombre: 'Nombre corto', valor: COLEGIO.nombreCorto, origen: 'codigo', donde: 'src/lib/colegio.ts' },
        { nombre: 'Dominio de Google Workspace', valor: COLEGIO.dominio, origen: 'codigo', donde: 'src/lib/colegio.ts' },
        {
          nombre: 'Dirección de la app',
          valor: process.env.APP_BASE_URL || COLEGIO.web,
          origen: process.env.APP_BASE_URL ? 'entorno' : 'codigo',
          donde: process.env.APP_BASE_URL ? 'APP_BASE_URL' : 'src/lib/colegio.ts',
          nota: 'La que se usa en todos los enlaces de los correos.',
        },
        { nombre: 'Buzón de Licencias', valor: COLEGIO.correoLicencias, origen: 'codigo', donde: 'src/lib/colegio.ts' },
        { nombre: 'Buzón genérico (no-responder)', valor: COLEGIO.correoNoResponder, origen: 'codigo', donde: 'src/lib/colegio.ts' },
        { nombre: 'Buzón de soporte TIC', valor: COLEGIO.correoTic, origen: 'codigo', donde: 'src/lib/colegio.ts' },
      ],
    },
    {
      titulo: 'Etapas y cursos',
      ajustes: [
        {
          nombre: 'Etapas que se ofrecen en los selectores',
          valor: etapas(C.etapasVisibles),
          origen: 'entorno',
          donde: 'NEXT_PUBLIC_ETAPAS_VISIBLES',
          nota: etapasDeEntorno
            ? 'Fijada en Vercel. Cambiarla exige redesplegar.'
            : 'Sin fijar: vale Infantil, Primaria y Secundaria. Lo que se importa sale siempre, esté o no aquí.',
        },
        {
          nombre: 'Cursos de cada etapa',
          valor: (Object.entries(C.niveles) as [Etapa, { min: number; max: number }][])
            .map(([e, n]) => `${ETAPA_LABEL[e]} ${n.min}-${n.max}`)
            .join(' · '),
          origen: 'codigo',
          donde: 'configuracion.ts → niveles',
        },
        {
          nombre: 'Promoción de curso',
          valor: (Object.entries(C.promocion) as [Etapa, string][]).map(([e, p]) => `${ETAPA_LABEL[e]}: ${PROMOCION[p] ?? p}`).join(' · '),
          origen: 'codigo',
          donde: 'configuracion.ts → promocion',
          nota: 'Botón «Promocionar +1 curso» de Profesorado.',
        },
        {
          nombre: 'Etapas que van juntas (quién ve a quién)',
          valor: C.etapasConjuntas.map((g) => etapas(g)).join(' · '),
          origen: 'codigo',
          donde: 'configuracion.ts → etapasConjuntas',
        },
        {
          nombre: 'Banco de libros',
          valor: (Object.entries(C.bancoLibros) as [Etapa, { desdeNivel: number }][])
            .map(([e, b]) => `${ETAPA_LABEL[e]} desde ${b.desdeNivel}º`)
            .join(' · '),
          origen: 'codigo',
          donde: 'configuracion.ts → bancoLibros',
        },
      ],
    },
    {
      titulo: 'Puntualidad',
      ajustes: [
        { nombre: 'Etapas', valor: etapas(C.puntualidad.etapas), origen: 'codigo', donde: 'configuracion.ts → puntualidad' },
        { nombre: 'Hora de cierre de puertas', valor: C.puntualidad.horaLimite, origen: 'codigo', donde: 'configuracion.ts → puntualidad' },
        {
          nombre: 'Retrasos sin justificar para avisar',
          valor: String(C.puntualidad.retrasosPorConsecuencia),
          origen: 'codigo',
          donde: 'configuracion.ts → puntualidad',
        },
        {
          nombre: 'Copia del aviso del tercer retraso',
          valor: process.env.PUNTUALIDAD_AVISOS_COPIA || 'nadie más que el tutor/a',
          origen: 'entorno',
          donde: 'PUNTUALIDAD_AVISOS_COPIA',
        },
      ],
    },
    {
      titulo: 'Calendario escolar',
      ajustes: [
        { nombre: 'Zona horaria', valor: C.calendario.zonaHoraria, origen: 'codigo', donde: 'configuracion.ts → calendario' },
        { nombre: 'Mes en que empieza el curso', valor: String(C.calendario.mesInicioCurso), origen: 'codigo', donde: 'configuracion.ts → calendario' },
        {
          nombre: 'Trimestres de partida',
          valor: `T1 acaba el ${C.calendario.trimestres.finT1} · T2 empieza el ${C.calendario.trimestres.inicioT2} · T3 acaba el ${C.calendario.trimestres.finT3} (MM-DD; T2/T3 según la Pascua)`,
          origen: 'codigo',
          donde: 'configuracion.ts → calendario.trimestres',
          nota: 'Los de cada curso se retocan en Ajustes de Oratorios.',
        },
        {
          nombre: 'Reuniones de etapa',
          valor: Object.entries(C.horarios.reunionesEtapa)
            .map(([e, r]) => `${ETAPA_LABEL[e as Etapa] ?? e}: ${r.horaInicio}-${r.horaFin}`)
            .join(' · '),
          origen: 'codigo',
          donde: 'configuracion.ts → horarios',
        },
      ],
    },
    {
      titulo: 'Sesión y archivos',
      ajustes: [
        { nombre: 'Duración de la sesión', valor: `${C.sesion.duracionDias} días`, origen: 'codigo', donde: 'configuracion.ts → sesion' },
        {
          nombre: 'Refresco del rol',
          valor: `cada ${C.sesion.refrescoRolMinutos} min`,
          origen: 'codigo',
          donde: 'configuracion.ts → sesion',
        },
        { nombre: 'Tamaño máximo de un archivo', valor: `${C.archivos.maxMB} MB`, origen: 'codigo', donde: 'configuracion.ts → archivos' },
      ],
    },
  ];
}

export interface VariableEntorno {
  nombre: string;
  para: string;
  puesta: boolean;
  /** Solo si NO es secreta: el valor tal cual. */
  valor: string | null;
  obligatoria: boolean;
}

const VARIABLES: { nombre: string | string[]; para: string; secreta: boolean; obligatoria?: boolean; antes?: string[] }[] = [
  { nombre: 'DATABASE_URL', para: 'Base de datos (Neon)', secreta: true, obligatoria: true },
  { nombre: 'AUTH_SECRET', para: 'Firma de las sesiones', secreta: true, obligatoria: true },
  { nombre: ['AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET'], para: 'Login con Google', secreta: true, obligatoria: true },
  { nombre: 'APP_BASE_URL', para: 'Dirección pública para los enlaces (sin fijar: la de colegio.ts)', secreta: false },
  { nombre: 'ANTHROPIC_API_KEY', para: 'IA (Claude): análisis de evaluaciones', secreta: true },
  {
    nombre: ['GOOGLE_SA_CLIENT_EMAIL', 'GOOGLE_SA_PRIVATE_KEY'],
    para: 'Cuenta de servicio: Gmail, Sheets, Classroom, Calendar',
    secreta: true,
    antes: ['GOOGLE_SHEETS_CLIENT_EMAIL', 'GOOGLE_SHEETS_PRIVATE_KEY'],
  },
  { nombre: 'GOOGLE_SHEETS_SPREADSHEET_ID', para: 'Hoja de Licencias', secreta: false },
  { nombre: 'GOOGLE_ADMIN_BUZON', para: 'Administrador del dominio (Calendarios)', secreta: false },
  { nombre: 'EMAIL_TRANSPORTE', para: 'Correo por Gmail o Resend (sin fijar: Gmail)', secreta: false },
  { nombre: 'GMAIL_CONCURRENCIA', para: 'Correos en paralelo por Gmail (por defecto 3)', secreta: false },
  { nombre: ['RESEND_API_KEY', 'RESEND_FROM'], para: 'Correo por Resend (respaldo)', secreta: true },
  { nombre: 'LICENCIAS_GESTORES', para: 'Avisos de Licencias', secreta: false },
  { nombre: ['LICENCIAS_PLANTILLA_PEDIDO', 'LICENCIAS_CARPETA_PEDIDOS'], para: 'Pedidos a editoriales (Drive)', secreta: false },
  { nombre: 'EVALUACIONES_CLASSROOM_BUZON', para: 'Quién publica las evaluaciones en Classroom', secreta: false },
  { nombre: 'GOOGLE_CALENDAR_CONCURRENCIA', para: 'Llamadas a Calendar en paralelo', secreta: false },
  { nombre: 'AUTOASM_CRYPTO_KEY', para: 'Cifrado del FTP de Apple School Manager', secreta: true },
  { nombre: 'NEXT_PUBLIC_ETAPAS_VISIBLES', para: 'Etapas en los selectores', secreta: false },
  { nombre: 'PUNTUALIDAD_AVISOS_COPIA', para: 'Copia del aviso de retrasos', secreta: false },
  { nombre: 'BLOB_READ_WRITE_TOKEN', para: 'Archivos subidos (Vercel Blob)', secreta: true },
  { nombre: 'CRON_SECRET', para: 'Tareas programadas (crons)', secreta: true },
];

export function inventarioEntorno(): VariableEntorno[] {
  return VARIABLES.map((v) => {
    const nombres = Array.isArray(v.nombre) ? v.nombre : [v.nombre];
    const hay = (lista: string[]) => lista.every((n) => !!process.env[n]?.trim());
    // Algunas tienen nombre antiguo que sigue valiendo (GOOGLE_SHEETS_* = GOOGLE_SA_*).
    const puesta = hay(nombres) || (!!v.antes && hay(v.antes));
    return {
      nombre: nombres.join(' · '),
      para: v.para,
      puesta,
      valor: !v.secreta && puesta ? nombres.map((n) => process.env[n]).join(' · ') : null,
      obligatoria: !!v.obligatoria,
    };
  });
}
