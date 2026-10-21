'use client';

// Comedor y complementarias de una clase entera, en una tabla (Jose Miguel, 16-oct-2026).
//
// Lo que se pidió es «para filtrar y destacada», así que la tabla hace tres cosas:
//
//  1. Marcar: un check por alumno y «todos sí / todos no» por columna, como banco y AMPA.
//  2. Filtrar: «quién come», «quién va a complementarias», «ninguno»… con el número al lado,
//     que es la pregunta de verdad («¿cuántos se quedan hoy a comer en 3º B?»).
//  3. Sacarlo en papel: el botón de informe lleva el filtro puesto, así que «Lista del
//     comedor» es un toque.
//
// Las complementarias solo existen en Infantil y Primaria (`aplicaServicio`): en una fila de
// la ESO la celda dice «—» y no se puede tocar, y si en pantalla no hay nadie de esas etapas
// la columna ni sale. Lo destacado vive fuera de aquí: el icono en la lista y el chip en la
// ficha.

import { useState } from 'react';
import { Check, FileDown, X } from 'lucide-react';
import { aplicaServicio, SERVICIO_LABEL, SERVICIOS, type Servicio } from '@/lib/alumnado';
import type { ClaveColumna } from '@/lib/alumnado-informe';
import type { AlumnoLista } from '@/lib/alumnado-server';
import { BarraTabla, Celda, CeldaAlumno, ColumnaBoton, useGuardado } from './piezas-tabla';
import { Button } from '@/components/ui/button';
import { Filtro, Filtros } from '@/components/ui/filtro';

type Filtro = 'todos' | Servicio | 'ninguno';

export function TablaServicios({
  alumnos,
  ambito,
  conClase,
  puedeEditar,
  onCambio,
  onInforme,
}: {
  alumnos: AlumnoLista[];
  ambito: string;
  conClase: boolean;
  puedeEditar: boolean;
  onCambio: (ids: string[], cambio: Partial<Pick<AlumnoLista, Servicio>>) => void;
  onInforme: (columnas: ClaveColumna[], filtro?: string) => void;
}) {
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const { guardando, pendiente, enviar, pedir, confirmacion } = useGuardado();

  const columnas = SERVICIOS.filter((s) => alumnos.some((a) => aplicaServicio(s, a.curso)));
  const filas = alumnos.filter((a) =>
    filtro === 'todos' ? true : filtro === 'ninguno' ? !a.comedor && !a.complementarias : a[filtro],
  );

  async function guardar(clave: string, objetivo: AlumnoLista[], s: Servicio, valor: boolean) {
    const ids = objetivo.filter((a) => aplicaServicio(s, a.curso)).map((a) => a.id);
    if (ids.length === 0) return;
    const datos = await enviar<{ tocados: Record<Servicio, string[]> }>(
      clave,
      '/api/alumnado/servicios',
      { eduStudentIds: ids, [s]: valor },
      ids.length > 1 ? `${ids.length} alumnos actualizados` : undefined,
    );
    if (datos) onCambio(datos.tocados[s], { [s]: valor });
  }

  if (alumnos.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center text-sm text-zinc-500 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        No hay alumnado aquí.
      </div>
    );
  }

  const cuantos = (s: Servicio) => alumnos.filter((a) => a[s]).length;
  const aplica = (s: Servicio, lista: AlumnoLista[]) => lista.filter((a) => aplicaServicio(s, a.curso)).length;
  const opciones: { id: Filtro; texto: string; n: number }[] = [
    { id: 'todos', texto: 'Todos', n: alumnos.length },
    ...columnas.map((s) => ({ id: s as Filtro, texto: SERVICIO_LABEL[s].titulo, n: cuantos(s) })),
    { id: 'ninguno', texto: 'Ninguno', n: alumnos.filter((a) => !a.comedor && !a.complementarias).length },
  ];

  return (
    <div className="space-y-2">
      <BarraTabla
        ambito={ambito}
        cuantos={alumnos.length}
        extra={
          <span className="text-emerald-600 dark:text-emerald-400">
            {columnas.map((s) => ` · ${cuantos(s)} ${s === 'comedor' ? 'en el comedor' : 'en complementarias'}`).join('')}
          </span>
        }
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onInforme(
              columnas.map((s) => s as ClaveColumna),
              filtro === 'comedor' || filtro === 'complementarias' ? `${filtro}:si` : undefined,
            )
          }
        >
          <FileDown aria-hidden />
          {filtro === 'comedor' ? 'Lista del comedor' : filtro === 'complementarias' ? 'Lista de complementarias' : 'Informe PDF'}
        </Button>
      </BarraTabla>

      {/* ── Filtrar: la pregunta de verdad es «¿quién se queda a comer?» ── */}
      <Filtros etiqueta="Mostrar">
        {opciones.map((o) => (
          <Filtro key={o.id} activo={filtro === o.id} cuenta={o.n} onClick={() => setFiltro(o.id)}>
            {o.texto}
          </Filtro>
        ))}
      </Filtros>

      {confirmacion}

      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <table className="w-full min-w-[20rem] text-sm">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              <th className="p-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Alumno</th>
              {columnas.map((s) => (
                <th key={s} className="p-2 align-bottom">
                  <span className="block text-center text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                    {SERVICIO_LABEL[s].titulo} <span className="font-normal text-zinc-400">{cuantos(s)}</span>
                  </span>
                  {puedeEditar && filas.length > 0 && (
                    <span className="mt-1 flex justify-center gap-0.5">
                      {([true, false] as const).map((valor) => {
                        const clave = `${s}-${valor ? 'si' : 'no'}`;
                        const n = aplica(s, filas);
                        return (
                          <ColumnaBoton
                            key={clave}
                            activa={pendiente?.clave === clave}
                            ocupada={guardando === clave}
                            tono={valor ? 'verde' : 'rojo'}
                            texto={valor ? 'Todos sí' : 'Todos no'}
                            titulo={`${SERVICIO_LABEL[s].titulo}: todos ${valor ? 'sí' : 'no'} en ${ambito} (${n})`}
                            onClick={() =>
                              pedir({
                                clave,
                                pregunta: `¿${SERVICIO_LABEL[s].titulo}: ${valor ? 'SÍ' : 'NO'} a ${n === 1 ? 'el alumno' : `los ${n} alumnos`} que se ven de ${ambito}?`,
                                boton: valor ? 'Sí, todos a SÍ' : 'Sí, todos a NO',
                                tono: valor ? 'verde' : 'rojo',
                                hacer: () => guardar(clave, filas, s, valor),
                              })
                            }
                          >
                            {valor ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          </ColumnaBoton>
                        );
                      })}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filas.length === 0 && (
              <tr>
                <td colSpan={columnas.length + 1} className="p-6 text-center text-sm text-zinc-400">
                  Nadie con ese filtro.
                </td>
              </tr>
            )}
            {filas.map((a) => (
              <tr key={a.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                <CeldaAlumno numero={a.numero} nombre={a.completo} clase={conClase ? a.clase : undefined} />
                {columnas.map((s) => (
                  <td key={s} className="p-1 text-center">
                    {aplicaServicio(s, a.curso) ? (
                      <Celda
                        tono={a[s] ? 'si' : 'gris'}
                        editable={puedeEditar}
                        ocupada={guardando === `${a.id}-${s}`}
                        etiqueta={`${SERVICIO_LABEL[s].titulo}: ${a[s] ? 'sí' : 'no'} · ${a.completo}`}
                        onTocar={() => guardar(`${a.id}-${s}`, [a], s, !a[s])}
                      >
                        {a[s] ? <Check className="h-4 w-4" /> : <X className="h-3.5 w-3.5 opacity-60" />}
                      </Celda>
                    ) : (
                      <span className="text-xs text-zinc-300 dark:text-zinc-600" title="En la ESO no hay complementarias">
                        —
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!puedeEditar && (
        <p className="px-1 text-xs text-zinc-400">Aquí solo miras: esto lo marcan secretaría, dirección o TIC.</p>
      )}
    </div>
  );
}
