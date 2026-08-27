// Matriz rol → módulos. Vive en código a propósito (cambiarla = cambiar una línea);
// los matices DENTRO de un módulo se resuelven en el módulo consultando el rol.

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
  // Rol "de una sola cosa": quien lleva las evaluaciones (pastoral, innovación…) sin
  // tener por qué ver pedidos, salidas ni la BBDD central. Se da a dedo desde /gestion/usuarios.
  evaluaciones: ['evaluaciones'],
};
// Nota: el FORMULARIO del ABC lo puede enviar cualquier persona autenticada del claustro
// (basta sesión); el módulo 'abc' de esta matriz es su panel de gestión.

export function canAccess(role: Role | null | undefined, modulo: Module): boolean {
  if (!role) return false;
  return ROLE_MODULES[role]?.includes(modulo) ?? false;
}

export const DOMINIO_LOGIN = 'consolacionburriana.com';
