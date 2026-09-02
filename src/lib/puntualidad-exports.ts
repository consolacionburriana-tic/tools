// Exportación CSV del módulo Puntualidad (patrón de `licencias-exports.ts`).
import { labelJustificacion } from '@/lib/puntualidad';
import type { RetrasoListado } from '@/lib/puntualidad-server';

function celda(valor: string | number | null | undefined): string {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

const CABECERAS = [
  'Fecha',
  'Hora',
  'Minutos de retraso',
  'Alumno',
  'Clase',
  'Asignatura',
  'Justificado',
  'Tipo de justificación',
  'Nota de justificación',
  'Sube a clase',
  'Observaciones',
  'Registrado por',
];

/** CSV con `;` y BOM, que es lo que abre bien el Excel del cole. */
export function csvRetrasos(filas: readonly RetrasoListado[]): string {
  const lineas = filas.map((f) =>
    [
      f.fecha,
      f.hora,
      f.minutosRetraso,
      f.alumno,
      f.clase,
      f.asignatura ?? '',
      f.justificado ? 'Sí' : 'No',
      f.justificado ? labelJustificacion(f.justificacionTipo) : '',
      f.justificacionNota ?? '',
      f.subeAClase ? 'Sí' : 'No',
      f.observaciones ?? '',
      f.registradoPorEmail ?? '',
    ]
      .map(celda)
      .join(';'),
  );
  return `﻿${[CABECERAS.join(';'), ...lineas].join('\r\n')}`;
}
