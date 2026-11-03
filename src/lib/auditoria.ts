// Libro de cambios: el registro de auditoría de lo que se marca en Alumnado.
//
// Por qué existe (David, 3-nov-2026): una persona de dirección cambió una protección de datos
// sin querer y no se pudo volver atrás con facilidad. Ahora cada casilla que se toca deja una
// línea —quién, cuándo, antes y después— y se puede restaurar.
//
// Este fichero es PURO (sin BBDD) para poder probarlo; la parte con Neon está en
// `auditoria-server.ts`. Ficha: docs/31-auditoria.md.
//
// Modelo, en tres ideas:
//  1. **Una fila por alumno y casilla.** Un «todos sí» sobre 25 alumnos son 25-100 filas que
//     comparten `lote`: el lote es lo que se ve en la lista y lo que se deshace de un toque.
//  2. **Restaurable = el valor de ahora sigue siendo el que dejó ese cambio.** Sin banderas de
//     «revertido» ni de «superado»: si después alguien lo volvió a tocar, ya no coincide y esa
//     línea no se puede restaurar (se deshace antes el cambio más nuevo y vuelve a valer). Así
//     una restauración nunca pisa un cambio posterior sin que se vea.
//  3. **Lo que viene de Educamos se anota y nada más** (David): sin botón de restaurar.

/** Las casillas que se auditan y se pueden restaurar. */
export const CAMPOS_RESTAURABLES = [
  'pd_imagen',
  'pd_redes',
  'pd_ampa',
  'pd_ong',
  'pd_correo',
  'banco',
  'ampa',
  'comedor',
  'complementarias',
] as const;
export type CampoRestaurable = (typeof CAMPOS_RESTAURABLES)[number];

/** Lo que solo se anota (llega del sync de Educamos, no se puede restaurar desde aquí). */
export const CAMPOS_SOLO_REGISTRO = ['alta', 'baja', 'reactivado', 'clase'] as const;
export type CampoSoloRegistro = (typeof CAMPOS_SOLO_REGISTRO)[number];

export type CampoAuditado = CampoRestaurable | CampoSoloRegistro;

export type OrigenCambio = 'usuario' | 'nouvinguts' | 'educamos' | 'restauracion';

export const ORIGEN_LABEL: Record<OrigenCambio, string> = {
  usuario: 'A mano',
  nouvinguts: 'Nouvinguts',
  educamos: 'Educamos',
  restauracion: 'Restauración',
};

export const CAMPO_LABEL: Record<CampoAuditado, string> = {
  pd_imagen: 'Imagen y voz',
  pd_redes: 'Redes y web',
  pd_ampa: 'AMPA (fotos)',
  pd_ong: 'ONG',
  pd_correo: 'Desestima el correo',
  banco: 'Banco de libros',
  ampa: 'Familia socia del AMPA',
  comedor: 'Comedor',
  complementarias: 'Complementarias',
  alta: 'Alta',
  baja: 'Baja',
  reactivado: 'Reactivado',
  clase: 'Clase',
};

/** Grupo con el que se filtra la lista y se decide el permiso para restaurar. */
export type GrupoAuditoria = 'proteccion' | 'participacion' | 'servicios' | 'educamos';

export const GRUPO_LABEL: Record<GrupoAuditoria, string> = {
  proteccion: 'Protección de datos',
  participacion: 'Banco de libros y AMPA',
  servicios: 'Comedor y complementarias',
  educamos: 'Altas, bajas y clases (Educamos)',
};

export function grupoDeCampo(campo: string): GrupoAuditoria {
  if (campo.startsWith('pd_')) return 'proteccion';
  if (campo === 'banco' || campo === 'ampa') return 'participacion';
  if (campo === 'comedor' || campo === 'complementarias') return 'servicios';
  return 'educamos';
}

export function esCampoRestaurable(campo: string): campo is CampoRestaurable {
  return (CAMPOS_RESTAURABLES as readonly string[]).includes(campo);
}

/** Los valores de las casillas de un alumno, tal como están. `null` = no consta (solo en los pd_). */
export type ChecksAlumno = Record<CampoRestaurable, boolean | null>;

/** Cómo se guarda un valor en el registro: 'si' · 'no' · null (no consta). */
export function valorACodigo(v: boolean | null | undefined): string | null {
  if (v === true) return 'si';
  if (v === false) return 'no';
  return null;
}

/** Y cómo se dice en pantalla. */
export function codigoATexto(campo: string, codigo: string | null): string {
  if (campo === 'clase') return codigo ?? '—';
  if (codigo === 'si') return campo === 'pd_correo' ? 'Desestima' : 'Sí';
  if (codigo === 'no') return campo === 'pd_correo' ? 'No desestima' : 'No';
  if (codigo === null) return 'No consta';
  return codigo;
}

export interface FilaAuditoria {
  lote: string;
  por: string | null;
  origen: OrigenCambio;
  eduStudentId: string;
  alumno: string;
  clase: string;
  campo: CampoAuditado;
  antes: string | null;
  despues: string | null;
}

export interface ContextoCambio {
  lote: string;
  por: string | null;
  origen: OrigenCambio;
}

/**
 * Las filas que salen de pasar de `antes` a `despues` en las casillas que se tocan. Solo las
 * que de verdad cambian: marcar «sí» lo que ya era «sí» no deja ruido en el registro.
 */
export function filasDeCambio(
  alumno: { id: string; nombre: string; clase: string },
  antes: Partial<ChecksAlumno>,
  despues: Partial<ChecksAlumno>,
  ctx: ContextoCambio,
): FilaAuditoria[] {
  const filas: FilaAuditoria[] = [];
  for (const campo of CAMPOS_RESTAURABLES) {
    if (!(campo in despues)) continue;
    const a = valorACodigo(antes[campo]);
    const d = valorACodigo(despues[campo]);
    if (a === d) continue;
    filas.push({
      ...ctx,
      eduStudentId: alumno.id,
      alumno: alumno.nombre,
      clase: alumno.clase,
      campo,
      antes: a,
      despues: d,
    });
  }
  return filas;
}

export interface EntradaRestaurable {
  campo: string;
  antes: string | null;
  despues: string | null;
  origen: string;
}

/**
 * ¿Se puede restaurar esta línea ahora mismo? Solo si es una casilla, no viene de Educamos y el
 * valor actual es todavía el que dejó ese cambio (si no, alguien lo ha tocado después).
 */
export function esRestaurable(entrada: EntradaRestaurable, actual: ChecksAlumno | null | undefined): boolean {
  if (entrada.origen === 'educamos') return false;
  if (!esCampoRestaurable(entrada.campo) || !actual) return false;
  return valorACodigo(actual[entrada.campo]) === entrada.despues;
}

/** ¿Ya está como estaba antes de ese cambio? (Alguien lo restauró, o lo dejó igual a mano.) */
export function yaEstaComoAntes(entrada: EntradaRestaurable, actual: ChecksAlumno | null | undefined): boolean {
  if (!esCampoRestaurable(entrada.campo) || !actual) return false;
  return valorACodigo(actual[entrada.campo]) === entrada.antes;
}

/** Lo que hay que escribir para restaurar: `antes` como valor de la casilla. */
export function codigoAValor(codigo: string | null): boolean | null {
  if (codigo === 'si') return true;
  if (codigo === 'no') return false;
  return null;
}
