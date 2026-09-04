// Quién entra a qué. Dos capas, a propósito:
//
//   1. El ROL es el punto de partida de un clic: "eres tutor" → salidas y banco de
//      libros. Vive en código porque cambiarlo es cambiar una línea y afecta a todos.
//   2. Los AJUSTES POR PERSONA son la excepción: "este tutor además lleva las
//      evaluaciones". Viven en `auth_users` y se guardan como DIFERENCIA respecto al
//      rol (extra / bloqueados), no como lista cerrada. Así, si mañana se le añade un
//      módulo al rol tutor, les llega a todos los tutores menos a quien lo tuviera
//      bloqueado explícitamente — que es lo que uno espera.

export const MODULES = [
  'abc',
  'licencias',
  'salidas',
  'bancolibros',
  'evaluaciones',
  'puntualidad',
  'horarios',
  'horarios-profes',
  'educamos',
  'cuaderno',
  'usuarios',
  'profes',
] as const;
export type Module = (typeof MODULES)[number];

export const MODULE_LABELS: Record<Module, string> = {
  abc: 'Registro ABC',
  licencias: 'Licencias',
  salidas: 'Salidas y pagos',
  bancolibros: 'Banco de libros',
  evaluaciones: 'Evaluaciones',
  puntualidad: 'Puntualidad',
  horarios: 'Horarios de clase',
  'horarios-profes': 'Horarios del profesorado',
  educamos: 'BBDD central',
  cuaderno: 'Cuaderno de tutor',
  usuarios: 'Usuarios y roles',
  profes: 'Tutorías',
};

/**
 * Módulos que conviene pensárselo dos veces antes de dar a dedo: `usuarios` permite
 * repartir permisos (incluidos los propios) y `educamos` toca la BBDD de alumnado y
 * familias entera. La interfaz los marca; no están prohibidos.
 */
export const MODULOS_SENSIBLES: readonly Module[] = ['usuarios', 'educamos'];

export const ROLES = [
  'profe',
  'tutor',
  'jefe',
  'direccion',
  'tic',
  'orientacion',
  'secretaria',
  'evaluaciones',
  'supertic',
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  profe: 'Profe',
  tutor: 'Tutor/a',
  jefe: 'Jefatura/Coord.',
  direccion: 'Dirección',
  tic: 'TIC',
  orientacion: 'Orientación',
  secretaria: 'Secretaría',
  evaluaciones: 'Evaluaciones',
  supertic: 'SuperTIC',
};

export const ROLE_MODULES: Record<Role, readonly Module[]> = {
  supertic: [...MODULES],
  tic: [...MODULES],
  direccion: [
    'abc',
    'licencias',
    'salidas',
    'bancolibros',
    'evaluaciones',
    'puntualidad',
    'horarios',
    'horarios-profes',
    'educamos',
    'cuaderno',
    'profes',
  ],
  jefe: ['salidas', 'bancolibros', 'puntualidad', 'horarios', 'horarios-profes', 'profes'],
  orientacion: ['abc', 'puntualidad', 'horarios', 'horarios-profes'],
  secretaria: ['licencias', 'salidas', 'bancolibros', 'horarios', 'cuaderno'],
  tutor: ['salidas', 'bancolibros', 'puntualidad', 'horarios'],
  profe: ['salidas', 'bancolibros', 'horarios'],
  // Rol "de una sola cosa": quien lleva las evaluaciones sin tener por qué ver
  // pedidos ni la BBDD central. Para alguien que ADEMÁS es tutor, mejor dejarle
  // 'tutor' y darle 'evaluaciones' como módulo extra.
  evaluaciones: ['evaluaciones'],
};
// Nota: el FORMULARIO del ABC lo puede enviar cualquier persona autenticada del claustro
// (basta sesión); el módulo 'abc' de esta matriz es su panel de gestión.

/** Lo que hace falta saber de alguien para decidir si entra. */
export interface Acceso {
  role: Role | null;
  modulosExtra?: readonly string[] | null;
  modulosBloqueados?: readonly string[] | null;
}

function esModulo(m: string): m is Module {
  return (MODULES as readonly string[]).includes(m);
}

/** Módulos efectivos de alguien: los de su rol, más los extra, menos los bloqueados. */
export function modulosDe(acceso: Acceso | null | undefined): Module[] {
  if (!acceso?.role) return [];
  const base = new Set<Module>(ROLE_MODULES[acceso.role] ?? []);
  for (const m of acceso.modulosExtra ?? []) if (esModulo(m)) base.add(m);
  for (const m of acceso.modulosBloqueados ?? []) if (esModulo(m)) base.delete(m);
  // Se devuelve en el orden de MODULES, no en el de inserción: la interfaz los
  // pinta siempre igual sin tener que ordenar en cada sitio.
  return MODULES.filter((m) => base.has(m));
}

export function canAccess(acceso: Acceso | null | undefined, modulo: Module): boolean {
  if (!acceso?.role) return false;
  const bloqueados = acceso.modulosBloqueados ?? [];
  if (bloqueados.includes(modulo)) return false;
  if ((acceso.modulosExtra ?? []).includes(modulo)) return true;
  return ROLE_MODULES[acceso.role]?.includes(modulo) ?? false;
}

/** ¿Este módulo le viene del rol, se lo han dado a mano, o se lo han quitado a mano? */
export type OrigenModulo = 'rol' | 'extra' | 'bloqueado' | 'no';

export function origenModulo(acceso: Acceso | null | undefined, modulo: Module): OrigenModulo {
  if (!acceso?.role) return 'no';
  const delRol = ROLE_MODULES[acceso.role]?.includes(modulo) ?? false;
  if ((acceso.modulosBloqueados ?? []).includes(modulo)) return delRol ? 'bloqueado' : 'no';
  if ((acceso.modulosExtra ?? []).includes(modulo)) return delRol ? 'rol' : 'extra';
  return delRol ? 'rol' : 'no';
}

/**
 * Traduce "quiero que esta persona tenga exactamente estos módulos" a la diferencia
 * que se guarda. La interfaz marca casillas y no tiene que saber nada de esto.
 */
export function diffModulos(
  role: Role | null,
  seleccionados: readonly Module[],
): { modulosExtra: Module[]; modulosBloqueados: Module[] } {
  const base = new Set<Module>(role ? (ROLE_MODULES[role] ?? []) : []);
  const quiere = new Set(seleccionados);
  return {
    modulosExtra: MODULES.filter((m) => quiere.has(m) && !base.has(m)),
    modulosBloqueados: MODULES.filter((m) => !quiere.has(m) && base.has(m)),
  };
}

/**
 * Dentro del módulo `bancolibros`, dos cosas quedan reservadas a dirección/TIC (no a
 * tutores, de momento): marcar quién participa en el banco/AMPA, y configurar a mano el
 * catálogo de libros por curso. El resto del módulo (lotes, checks, pasar lista) lo sigue
 * llevando cualquier rol con acceso al módulo, sin cambios.
 */
export function puedeGestionarParticipantesBanco(role: Role | null): boolean {
  return role === 'direccion' || role === 'tic' || role === 'supertic';
}

/**
 * Dentro del módulo `puntualidad`, quién ve TODO el centro y quién solo lo suyo.
 * Dirección, jefatura, orientación y TIC ven todos los retrasos; un tutor con el módulo
 * ve únicamente el alumnado de las clases que tutoriza (se filtra contra `edu_tutorias`
 * del curso académico en vigor). Registrar, en cambio, lo puede hacer cualquier persona
 * del claustro con sesión: basta `requireSession()`, como el formulario del ABC.
 */
export function vePuntualidadCompleta(role: Role | null): boolean {
  return role === 'direccion' || role === 'jefe' || role === 'orientacion' || role === 'tic' || role === 'supertic';
}

/**
 * Los horarios van en DOS módulos a propósito, no en uno:
 *
 *   - `horarios`         → ver el horario de las CLASES. Abierto a todo el claustro: un
 *                          profe tiene que poder mirar qué tiene 2ESO B a 3ª.
 *   - `horarios-profes`  → ver el horario de un PROFESOR concreto. Va aparte para poder
 *                          quitárselo a alguien sin quitarle lo anterior (decisión de
 *                          David: el horario de los demás invita al "a mí me has puesto…").
 *
 * Y encima, quién puede EDITAR (rejillas, importar, tocar asignaciones) es cuestión de rol,
 * como `vePuntualidadCompleta()`: tener el módulo da vista, no lápiz.
 */
export function puedeEditarHorarios(role: Role | null): boolean {
  return role === 'direccion' || role === 'jefe' || role === 'tic' || role === 'supertic';
}

export const DOMINIO_LOGIN = 'consolacionburriana.com';
