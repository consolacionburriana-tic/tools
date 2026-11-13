import type { Role } from '@/lib/permissions';

export const MOTIVOS_SUSTITUCION = ['Actividad escolar', 'Médico', 'Médico Familiar', 'Enfermedad Leve', 'Baja', 'Otros'] as const;
export const ROLES_SUSTITUCIONES: readonly Role[] = ['jefe', 'tic', 'secretaria', 'direccion'];
export const puedeGestionarSustituciones = (role: Role | null | undefined) => !!role && ROLES_SUSTITUCIONES.includes(role);
