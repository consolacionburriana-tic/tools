// Tareas de la plataforma: helpers puros (sin IO). Ficha: docs/23-tareas.md.
//
// Dos tipos de tarjeta en la misma tabla:
//   - `fallo`  → un fallito de una línea, con el módulo donde se vio. Lo puede apuntar
//                quien tenga `tareas-reportar` (dirección, secretaría, orientación) o `tareas`.
//   - `modulo` → la idea de un módulo nuevo: nombre, definición funcional y checklist de lo
//                que tendrá. Solo `tareas` (TIC y superTIC).
//
// Lo importante de este fichero es `promptTarea`: el texto que se copia de un toque para
// pegárselo tal cual a un agente, con el contexto que necesita para no empezar a ciegas.
import { z } from 'zod';
import { MODULES, MODULE_LABELS, type Module } from '@/lib/permissions';

export const TIPOS_TAREA = ['fallo', 'modulo'] as const;
export type TipoTarea = (typeof TIPOS_TAREA)[number];

// Las cuatro columnas del futuro kanban.
export const ESTADOS_TAREA = ['pendiente', 'en_curso', 'hecho', 'descartado'] as const;
export type EstadoTarea = (typeof ESTADOS_TAREA)[number];

export const ESTADO_LABELS: Record<EstadoTarea, string> = {
  pendiente: 'Pendiente',
  en_curso: 'En curso',
  hecho: 'Hecho',
  descartado: 'Descartado',
};

/** Abiertas = lo que queda por hacer; lo que se ve por defecto. */
export function estaAbierta(estado: string): boolean {
  return estado === 'pendiente' || estado === 'en_curso';
}

export interface ItemChecklist {
  id: string;
  texto: string;
  hecho: boolean;
}

export interface Tarea {
  id: string;
  tipo: TipoTarea;
  titulo: string;
  modulo: string | null;
  descripcion: string | null;
  checklist: ItemChecklist[];
  estado: EstadoTarea;
  ruta: string | null;
  createdBy: string | null;
  createdByNombre: string | null;
  createdAt: string; // ISO
  updatedAt: string;
  hechoAt: string | null;
}

// Los módulos que tiene sentido elegir al apuntar un fallito: todos menos los del propio
// sistema de tareas y los que son una parte de otro (horarios-profes va con horarios).
const NO_ELEGIBLES: readonly Module[] = ['tareas', 'tareas-reportar', 'horarios-profes'];
export const MODULOS_FALLO: readonly Module[] = MODULES.filter((m) => !NO_ELEGIBLES.includes(m));

export function etiquetaModulo(modulo: string | null | undefined): string {
  if (!modulo) return 'General';
  return (MODULE_LABELS as Record<string, string>)[modulo] ?? modulo;
}

// Rutas de /gestion que no se llaman igual que su módulo.
const RUTA_A_MODULO: Record<string, Module> = {
  'mi-horario': 'mi-horario',
};

/**
 * Qué módulo es la pantalla en la que está la persona, para dejarlo elegido al abrir el
 * formulario: casi siempre el fallito es de lo que tiene delante.
 */
export function moduloDeRuta(ruta: string | null | undefined): Module | null {
  if (!ruta) return null;
  const partes = ruta.split('?')[0].split('/').filter(Boolean);
  const i = partes[0] === 'gestion' ? 1 : 0;
  const seg = partes[i];
  if (!seg) return null;
  if (RUTA_A_MODULO[seg]) return RUTA_A_MODULO[seg];
  return (MODULOS_FALLO as readonly string[]).includes(seg) ? (seg as Module) : null;
}

// Ficha de docs/ de cada módulo, para que el agente sepa qué leer antes de tocar nada.
const FICHAS: Partial<Record<Module, string>> = {
  abc: 'docs/10-registro-abc.md',
  licencias: 'docs/11-licencias-v2.md',
  salidas: 'docs/15-salidasypagos.md',
  bancolibros: 'docs/12-bancolibros.md',
  evaluaciones: 'docs/16-evaluaciones.md',
  puntualidad: 'docs/17-puntualidad.md',
  horarios: 'docs/07-horarios.md',
  'horarios-profes': 'docs/07-horarios.md',
  'mi-horario': 'docs/20-mi-horario.md',
  educamos: 'docs/02-integracion-educamos.md',
  alumnado: 'docs/21-alumnado.md',
  cuaderno: 'docs/18-cuaderno-tutor.md',
  usuarios: 'docs/01-auth-roles.md',
  profes: 'docs/02-integracion-educamos.md',
  autoasm: 'docs/19-autoasm.md',
  tareas: 'docs/23-tareas.md',
};

export function fichaDeModulo(modulo: string | null | undefined): string | null {
  if (!modulo) return null;
  return FICHAS[modulo as Module] ?? null;
}

const FORMATO_FECHA = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Europe/Madrid',
});

export function fechaCorta(iso: string): string {
  return FORMATO_FECHA.format(new Date(iso));
}

function quien(t: Pick<Tarea, 'createdByNombre' | 'createdBy'>): string {
  return t.createdByNombre || t.createdBy || 'alguien';
}

/** Texto listo para pegar a un agente: el fallito con todo su contexto. */
export function promptFallo(t: Tarea): string {
  const ficha = fichaDeModulo(t.modulo);
  const lineas = [
    'Fallito en la plataforma Tools Consolación (repo consolacionburriana-tic/tools).',
    '',
    `- **Módulo:** ${etiquetaModulo(t.modulo)}${t.modulo ? ` (\`${t.modulo}\`)` : ''}`,
  ];
  if (t.ruta) lineas.push(`- **Pantalla donde se vio:** \`${t.ruta}\``);
  lineas.push(`- **Apuntado por:** ${quien(t)}, el ${fechaCorta(t.createdAt)}`);
  lineas.push('', '**Qué pasa:**', '', t.titulo.trim());
  if (t.descripcion?.trim()) lineas.push('', t.descripcion.trim());
  lineas.push(
    '',
    '---',
    `Antes de tocar nada, lee \`AGENTS.md\`, \`docs/plataforma.md\` y \`docs/04-convenciones-tecnicas.md\`${
      ficha ? `, y la ficha del módulo (\`${ficha}\`)` : ''
    }. Encuentra la causa, arréglalo, verifícalo y cuéntame qué era.`,
  );
  return lineas.join('\n');
}

/** Texto listo para pegar a un agente: la definición funcional completa del módulo nuevo. */
export function promptModulo(t: Tarea): string {
  const lineas = [
    `# Módulo nuevo: ${t.titulo.trim()}`,
    '',
    'Idea de módulo para la plataforma Tools Consolación (repo consolacionburriana-tic/tools).',
    `Estado: ${ESTADO_LABELS[t.estado] ?? t.estado} · apuntado por ${quien(t)} el ${fechaCorta(t.createdAt)}.`,
    '',
    '## Definición funcional',
    '',
    t.descripcion?.trim() || '_(sin descripción todavía)_',
  ];
  if (t.checklist.length > 0) {
    lineas.push('', '## Qué tiene que tener', '');
    for (const item of t.checklist) lineas.push(`- [${item.hecho ? 'x' : ' '}] ${item.texto.trim()}`);
  }
  lineas.push(
    '',
    '## Cómo trabajar',
    '',
    'Lee `AGENTS.md`, `docs/plataforma.md` y `docs/04-convenciones-tecnicas.md`. Antes de escribir',
    'código, crea la ficha `docs/<nn>-<modulo>.md` con plan funcional, plan técnico y checklist por',
    'fases (formato de las fichas existentes), añade su fila a la tabla maestra de',
    '`docs/plataforma.md` y pregúntame lo que no esté decidido aquí antes de suponerlo.',
  );
  return lineas.join('\n');
}

export function promptTarea(t: Tarea): string {
  return t.tipo === 'modulo' ? promptModulo(t) : promptFallo(t);
}

/** Todos los fallitos abiertos de una vez, agrupados por módulo, para una sesión de arreglos. */
export function promptFallosAbiertos(tareas: readonly Tarea[]): string {
  const abiertos = tareas.filter((t) => t.tipo === 'fallo' && estaAbierta(t.estado));
  if (abiertos.length === 0) return '';
  const grupos = new Map<string, Tarea[]>();
  for (const t of abiertos) {
    const k = t.modulo ?? '';
    grupos.set(k, [...(grupos.get(k) ?? []), t]);
  }
  const lineas = [
    `Fallitos pendientes en la plataforma Tools Consolación (repo consolacionburriana-tic/tools): ${abiertos.length}.`,
  ];
  const claves = [...grupos.keys()].sort((a, b) => etiquetaModulo(a || null).localeCompare(etiquetaModulo(b || null), 'es'));
  for (const k of claves) {
    const ficha = fichaDeModulo(k || null);
    lineas.push('', `## ${etiquetaModulo(k || null)}${ficha ? ` · \`${ficha}\`` : ''}`, '');
    for (const t of grupos.get(k)!) {
      lineas.push(`- [ ] ${t.titulo.trim()}${t.ruta ? ` _(en \`${t.ruta}\`)_` : ''}`);
    }
  }
  lineas.push(
    '',
    '---',
    'Lee `AGENTS.md`, `docs/plataforma.md` y `docs/04-convenciones-tecnicas.md` antes de empezar.',
    'Arréglalos de uno en uno, verificando cada uno, y al terminar dime cuáles quedan y por qué.',
  );
  return lineas.join('\n');
}

/** Una línea por item: así se escribe una checklist rápida desde el formulario. */
export function checklistDeTexto(texto: string): ItemChecklist[] {
  return texto
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*•]\s*)?(?:\[[ xX]?\]\s*)?/, '').trim())
    .filter(Boolean)
    .map((t) => ({ id: crypto.randomUUID(), texto: t, hecho: false }));
}

// ─── Validación (compartida por cliente y servidor) ──────────────────────────
const itemChecklist = z.object({
  id: z.string().min(1).max(64),
  texto: z.string().trim().min(1).max(500),
  hecho: z.boolean(),
});

const moduloFallo = z
  .string()
  .nullable()
  .refine((m) => m === null || (MODULOS_FALLO as readonly string[]).includes(m), 'Módulo desconocido');

export const crearTareaSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('fallo'),
    titulo: z.string().trim().min(3, 'Cuéntalo en una línea').max(500),
    modulo: moduloFallo,
    ruta: z.string().max(300).nullable().optional(),
  }),
  z.object({
    tipo: z.literal('modulo'),
    titulo: z.string().trim().min(2, 'Ponle un nombre').max(200),
    descripcion: z.string().max(20000).nullable().optional(),
    checklist: z.array(itemChecklist).max(200).optional(),
  }),
]);
export type CrearTarea = z.infer<typeof crearTareaSchema>;

export const actualizarTareaSchema = z.object({
  titulo: z.string().trim().min(2).max(500).optional(),
  modulo: moduloFallo.optional(),
  descripcion: z.string().max(20000).nullable().optional(),
  checklist: z.array(itemChecklist).max(200).optional(),
  estado: z.enum(ESTADOS_TAREA).optional(),
});
export type ActualizarTarea = z.infer<typeof actualizarTareaSchema>;
