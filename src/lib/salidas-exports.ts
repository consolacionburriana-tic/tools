// Export CSV del seguimiento de una salida. Todo son helpers puros (sin IO) para poder
// testearlos, y para que la pantalla de seguimiento y el CSV compartan EL MISMO criterio
// de estado (antes `cuboDe` vivía suelto en el componente).

export type Cubo = 'pendientes' | 'entregados' | 'validados' | 'no_van';

/** Lo mínimo que necesita el export de cada fila del seguimiento. */
export interface AlumnoSeguimientoExport {
  nombre: string;
  clase: string;
  estado: 'pendiente' | 'apuntado' | 'no_va';
  justificanteEstado: string | null;
  justificanteSubidoAt: Date | string | null;
  emailContacto: string | null;
  manual: boolean;
  manualIdentificador: string | null;
}

/** En qué cubo cae un alumno del seguimiento. */
export function cuboDe(a: Pick<AlumnoSeguimientoExport, 'estado' | 'justificanteEstado'>): Cubo {
  if (a.estado === 'no_va') return 'no_van';
  if (a.justificanteEstado === 'validado') return 'validados';
  if (a.justificanteEstado === 'subido' || a.justificanteEstado === 'rechazado') return 'entregados';
  return 'pendientes';
}

/** Etiqueta del estado. En las salidas de pago en mano, "validado" se lee "pagado". */
export function estadoLabel(cubo: Cubo, tipoPago: string): string {
  if (cubo === 'no_van') return 'No va';
  if (cubo === 'validados') return tipoPago === 'mano' ? 'Pagado' : 'Validado';
  if (cubo === 'entregados') return 'Entregado';
  return 'Pendiente';
}

const JUSTIFICANTE_LABEL: Record<string, string> = {
  subido: 'Subido, sin validar',
  validado: 'Validado',
  rechazado: 'Rechazado',
};

const fmtFecha = (f: Date | string | null): string => (f ? new Date(f).toLocaleDateString('es-ES') : '');

export const CABECERAS_SEGUIMIENTO = [
  'Clase',
  'Alumno/a',
  'Estado',
  'Justificante',
  'Fecha justificante',
  'Email de contacto',
  'Entrada manual',
  'Identificador tecleado',
];

export function filasSeguimiento(alumnos: AlumnoSeguimientoExport[], tipoPago: string): string[][] {
  return alumnos.map((a) => [
    a.clase,
    a.nombre,
    estadoLabel(cuboDe(a), tipoPago),
    a.justificanteEstado ? (JUSTIFICANTE_LABEL[a.justificanteEstado] ?? a.justificanteEstado) : '',
    fmtFecha(a.justificanteSubidoAt),
    a.emailContacto ?? '',
    a.manual ? 'Sí' : '',
    a.manualIdentificador ?? '',
  ]);
}

const esc = (v: string | number | null | undefined): string => `"${String(v ?? '').replace(/"/g, '""')}"`;

/** CSV con `;` y BOM, como el resto de exports del repo (para que Excel respete acentos). */
export function csvSeguimiento(alumnos: AlumnoSeguimientoExport[], tipoPago: string): string {
  const filas = [CABECERAS_SEGUIMIENTO, ...filasSeguimiento(alumnos, tipoPago)];
  return '﻿' + filas.map((r) => r.map(esc).join(';')).join('\n');
}

/** `salida-excursion-al-museo-2026-09-01.csv` */
export function nombreFicheroSalida(nombre: string, fecha = new Date()): string {
  const slug = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return `salida-${slug || 'sin-nombre'}-${fecha.toISOString().slice(0, 10)}.csv`;
}
