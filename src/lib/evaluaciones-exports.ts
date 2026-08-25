// Export CSV de respuestas de una evaluación. Función pura (testeable) + helper de
// escapado; la ruta protegida solo se encarga de leer de la BBDD y servir el fichero.
//
// El CSV NO lleva identidad de quien responde, ni siquiera en los formularios con
// enlace personalizado: quien lo abre está analizando resultados, no investigando a
// nadie. La trazabilidad interna se queda en la BBDD.
import { escalaDe } from '@/lib/evaluaciones';

export interface FilaExport {
  respuestaId: string;
  fecha: string;
  curso: string | null;
  letra: string | null;
  etapa: string | null;
  bloque: string;
  preguntaClave: string;
  pregunta: string;
  fila: string | null;
  escala: string;
  valorNum: number | null;
  opcion: string | null;
  texto: string | null;
}

const CABECERAS = [
  'respuesta',
  'fecha',
  'curso',
  'letra',
  'etapa',
  'actividad',
  'clave_pregunta',
  'pregunta',
  'frase',
  'valor',
  'valor_etiqueta',
  'valor_0_100',
  'opcion',
  'texto',
];

function campo(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function construirCsv(filas: FilaExport[]): string {
  const lineas = [CABECERAS.join(';')];
  for (const f of filas) {
    const puntos = escalaDe(f.escala).puntos;
    const etiqueta = f.valorNum === null ? null : (puntos.find((p) => p.valor === f.valorNum)?.label ?? null);
    const min = puntos[0].valor;
    const max = puntos[puntos.length - 1].valor;
    const pct = f.valorNum === null || max === min ? null : Math.round(((f.valorNum - min) / (max - min)) * 100);
    lineas.push(
      [
        f.respuestaId.slice(0, 8),
        f.fecha,
        f.curso,
        f.letra,
        f.etapa,
        f.bloque,
        f.preguntaClave,
        f.pregunta,
        f.fila,
        f.valorNum,
        etiqueta,
        pct,
        f.opcion,
        f.texto,
      ]
        .map(campo)
        .join(';'),
    );
  }
  // BOM para que Excel abra bien los acentos.
  return `﻿${lineas.join('\n')}`;
}

export function nombreFicheroCsv(titulo: string, fecha = new Date()): string {
  const slug = titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  const dia = fecha.toISOString().slice(0, 10);
  return `evaluacion-${slug || 'resultados'}-${dia}.csv`;
}
