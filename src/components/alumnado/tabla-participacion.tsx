'use client';

// Banco de libros y AMPA de una clase entera, en una tabla: una columna, un check por alumno.
//
// Es lo que David pidió igual que la tabla de protección de datos, pero «solo marcar el
// check» (23-sep-2026). Y en las dos se puede sacar la OTRA columna al lado —en la del banco,
// el AMPA; en la del AMPA, el banco—, porque a principio de curso las dos listas se piden a
// la vez, y de ahí el botón de informe.
//
// Quién marca: dirección/TIC con el módulo del banco, lo mismo que en la ficha y que antes en
// el panel del banco. El AMPA, desde el 23-sep-2026, ya solo se lleva desde aquí.

import { useState } from 'react';
import { Check, Eye, EyeOff, FileDown, X } from 'lucide-react';
import type { ClaveColumna } from '@/lib/alumnado-informe';
import type { AlumnoLista } from '@/lib/alumnado-server';
import { BarraTabla, Celda, CeldaAlumno, ColumnaBoton, useGuardado } from './piezas-tabla';

type Campo = 'bancoLibros' | 'ampa';

const TITULO: Record<Campo, string> = { bancoLibros: 'Banco de libros', ampa: 'AMPA' };
const COLUMNA_INFORME: Record<Campo, ClaveColumna> = { bancoLibros: 'banco', ampa: 'ampa' };

export function TablaParticipacion({
  campo,
  alumnos,
  ambito,
  conClase,
  puedeEditar,
  onCambio,
  onInforme,
}: {
  campo: Campo;
  alumnos: AlumnoLista[];
  ambito: string;
  conClase: boolean;
  puedeEditar: boolean;
  onCambio: (ids: string[], cambio: Partial<Pick<AlumnoLista, Campo>>) => void;
  onInforme: (columnas: ClaveColumna[]) => void;
}) {
  const otro: Campo = campo === 'bancoLibros' ? 'ampa' : 'bancoLibros';
  const [conOtro, setConOtro] = useState(false);
  const { guardando, confirmando, enviar, confirmarY } = useGuardado();

  const columnas: Campo[] = conOtro ? [campo, otro] : [campo];

  async function guardar(clave: string, ids: string[], c: Campo, valor: boolean) {
    if (ids.length === 0) return;
    const datos = await enviar<{ ids: string[] }>(
      clave,
      '/api/alumnado/participacion',
      { eduStudentIds: ids, [c]: valor },
      ids.length > 1 ? `${ids.length} alumnos actualizados` : undefined,
    );
    if (datos) onCambio(datos.ids, { [c]: valor });
  }

  if (alumnos.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center text-sm text-zinc-400 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        No hay alumnado aquí.
      </div>
    );
  }

  const cuantos = (c: Campo) => alumnos.filter((a) => a[c]).length;

  return (
    <div className="space-y-2">
      <BarraTabla
        ambito={ambito}
        cuantos={alumnos.length}
        extra={
          <span className="text-emerald-600 dark:text-emerald-400">
            {' '}
            · {cuantos(campo)} en {campo === 'ampa' ? 'el AMPA' : 'el banco'}
          </span>
        }
      >
        <button
          type="button"
          onClick={() => setConOtro((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          {conOtro ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {conOtro ? `Quitar ${TITULO[otro]}` : `Ver también ${TITULO[otro]}`}
        </button>
        <button
          type="button"
          onClick={() => onInforme(columnas.map((c) => COLUMNA_INFORME[c]))}
          className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          <FileDown className="h-3.5 w-3.5" /> Informe PDF
        </button>
      </BarraTabla>

      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <table className="w-full min-w-[20rem] text-sm">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              <th className="p-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Alumno</th>
              {columnas.map((c) => (
                <th key={c} className={`p-2 align-bottom ${c === otro ? 'bg-zinc-50/70 dark:bg-zinc-800/30' : ''}`}>
                  <span className="block text-center text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                    {TITULO[c]} <span className="font-normal text-zinc-400">{cuantos(c)}</span>
                  </span>
                  {puedeEditar && (
                    <span className="mt-1 flex justify-center gap-0.5">
                      <ColumnaBoton
                        activa={confirmando === `${c}-si`}
                        ocupada={guardando === `${c}-si`}
                        tono="verde"
                        titulo={`${TITULO[c]}: todos sí en ${ambito} (${alumnos.length})`}
                        onClick={() => confirmarY(`${c}-si`, () => void guardar(`${c}-si`, alumnos.map((a) => a.id), c, true))}
                      >
                        <Check className="h-3 w-3" />
                      </ColumnaBoton>
                      <ColumnaBoton
                        activa={confirmando === `${c}-no`}
                        ocupada={guardando === `${c}-no`}
                        tono="rojo"
                        titulo={`${TITULO[c]}: todos no en ${ambito} (${alumnos.length})`}
                        onClick={() => confirmarY(`${c}-no`, () => void guardar(`${c}-no`, alumnos.map((a) => a.id), c, false))}
                      >
                        <X className="h-3 w-3" />
                      </ColumnaBoton>
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {alumnos.map((a) => (
              <tr key={a.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                <CeldaAlumno numero={a.numero} nombre={a.completo} clase={conClase ? a.clase : undefined} />
                {columnas.map((c) => (
                  <td key={c} className={`p-1 text-center ${c === otro ? 'bg-zinc-50/70 dark:bg-zinc-800/30' : ''}`}>
                    <Celda
                      tono={a[c] ? 'si' : 'gris'}
                      editable={puedeEditar}
                      ocupada={guardando === `${a.id}-${c}`}
                      etiqueta={`${TITULO[c]}: ${a[c] ? 'sí' : 'no'} · ${a.completo}`}
                      onTocar={() => guardar(`${a.id}-${c}`, [a.id], c, !a[c])}
                    >
                      {a[c] ? <Check className="h-4 w-4" /> : <X className="h-3.5 w-3.5 opacity-60" />}
                    </Celda>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!puedeEditar && (
        <p className="px-1 text-xs text-zinc-400">Aquí solo miras: esto lo cambian dirección o TIC.</p>
      )}
    </div>
  );
}
