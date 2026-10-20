// Dispositivos 1:1: el listado de cuotas en Excel y CSV. Ficha: docs/29-dispositivos.md.
//
// Es la foto del día: lo que pagaría cada uno según cómo tiene el iPad HOY. Cómo se cobra
// (cada mes, una vez, prorrateo) está pendiente de secretaría y Jose Miguel, así que aquí no
// se decide nada de eso: se lista y se suma.
import { CONCEPTO_LABEL, cuotaDe, textoEstado, type Concepto } from '@/lib/dispositivos';
import type { AlumnoDis, AparatoDis } from '@/lib/dispositivos-server';
import type { EntradaCelda, Libro } from '@/lib/xlsx-escribir';

export interface FilaCuota {
  clase: string;
  alumno: string;
  nia: string;
  estado: string;
  concepto: Concepto | null;
  importe: number;
  motivo: string;
  aviso: string | null;
}

/** Una fila por alumno del alcance con estado; sin informar no se lista (no se sabe qué paga). */
export function filasCuotas(alumnos: readonly AlumnoDis[], aparatos: readonly AparatoDis[], cursoActual: string): FilaCuota[] {
  const prestamo = new Map(
    aparatos.filter((a) => a.uso === 'sustitucion' && a.titular?.tipo === 'alumno').map((a) => [a.titular!.id, a.codigo]),
  );
  return alumnos
    .filter((a) => a.estado)
    .map((a) => {
      const e = a.estado!;
      const c = cuotaDe(e, cursoActual);
      return {
        clase: a.clase,
        alumno: a.nombre,
        nia: a.nia ?? '',
        estado: textoEstado({ ...e, aparato: prestamo.get(a.id) }, cursoActual),
        concepto: c.concepto,
        importe: c.importe,
        motivo: c.motivo,
        aviso: c.aviso,
      };
    });
}

const CABECERA = ['Clase', 'Alumno', 'NIA', 'Concepto', 'Importe (€)', 'Por qué'];

function filaCuota(f: FilaCuota): EntradaCelda[] {
  return [f.clase, f.alumno, f.nia, f.concepto ? CONCEPTO_LABEL[f.concepto] : '', f.importe, f.motivo];
}

const NEGRITA = { negrita: true, fondo: 'EEF2FF' };

export function libroCuotas(filas: readonly FilaCuota[], cursoActual: string): Libro {
  const pagan = filas.filter((f) => f.concepto).sort((a, b) => (a.concepto === b.concepto ? 0 : a.concepto === 'mensual' ? -1 : 1));
  const avisos = filas.filter((f) => f.aviso);
  const cab = (titulos: string[]) => titulos.map((t) => ({ valor: t, estilo: NEGRITA }));
  return {
    hojas: [
      {
        nombre: `Cuotas ${cursoActual}`,
        filas: [cab(CABECERA), ...pagan.map(filaCuota)],
        columnas: [{ ancho: 12 }, { ancho: 34 }, { ancho: 12 }, { ancho: 14 }, { ancho: 11 }, { ancho: 46 }],
        congelar: 'A2',
        autofiltro: true,
      },
      {
        nombre: 'Falta un dato',
        filas: [cab(['Clase', 'Alumno', 'NIA', 'Qué falta', 'Cómo lo tiene']), ...avisos.map((f) => [f.clase, f.alumno, f.nia, f.aviso, f.estado])],
        columnas: [{ ancho: 12 }, { ancho: 34 }, { ancho: 12 }, { ancho: 26 }, { ancho: 40 }],
        congelar: 'A2',
      },
      {
        nombre: 'Todo el alumnado',
        filas: [
          cab(['Clase', 'Alumno', 'NIA', 'Cómo lo tiene', 'Concepto', 'Importe (€)']),
          ...filas.map((f) => [f.clase, f.alumno, f.nia, f.estado, f.concepto ? CONCEPTO_LABEL[f.concepto] : '', f.importe]),
        ],
        columnas: [{ ancho: 12 }, { ancho: 34 }, { ancho: 12 }, { ancho: 42 }, { ancho: 14 }, { ancho: 11 }],
        congelar: 'A2',
        autofiltro: true,
      },
    ],
  };
}

function csvCampo(v: string | number): string {
  const s = String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Solo quien paga, con `;` y coma decimal, que es lo que abre bien el Excel en castellano. */
export function csvCuotas(filas: readonly FilaCuota[]): string {
  const lineas = [CABECERA.join(';')];
  for (const f of filas.filter((x) => x.concepto)) {
    lineas.push(
      [f.clase, f.alumno, f.nia, CONCEPTO_LABEL[f.concepto!], f.importe.toFixed(2).replace('.', ','), f.motivo].map(csvCampo).join(';'),
    );
  }
  return '\uFEFF' + lineas.join('\r\n') + '\r\n';
}

