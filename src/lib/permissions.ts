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
  'educamos',
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
  educamos: 'BBDD central',
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
  direccion: ['abc', 'licencias', 'salidas', 'bancolibros', 'evaluaciones', 'educamos', 'profes'],
  jefe: ['salidas', 'bancolibros', 'profes'],
  orientacion: ['abc'],
  secretaria: ['licencias', 'salidas', 'bancolibros'],
  tutor: ['salidas', 'bancolibros'],
  profe: ['salidas', 'bancolibros'],
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

export const DOMINIO_LOGIN = 'consolacionburriana.com';
