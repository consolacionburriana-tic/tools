'use client';

// La protección de datos de una clase entera, en una tabla.
//
// Por qué existe: la ficha sirve para consultar a UNA persona, pero llenar esto son 639
// alumnos × 5 casillas. A mano no lo hace nadie, así que la forma real de trabajar es la
// que pidió David: **poner todo a «sí» y luego ir marcando los noes**.
//
// Desde el 23-sep-2026 (David) la tabla se ve con DOS columnas y no con cinco:
//
//  1. **Protección de datos** — un check general sí / no. No es un dato aparte: se deduce de
//     los cuatro permisos (`generalProteccion`), y un toque los pone todos a sí o todos a no.
//     Si la familia ha dicho que no a una sola cosa sale «parcial» en ámbar, que es la señal
//     de que hay que desplegar.
//  2. **Correo del alumno** — la desestimación del correo electrónico. Lo normal es que no
//     se desestime (verde); si la familia lo desestima, rojo.
//
// Las cuatro de detalle (imagen, redes, AMPA, ONG) se despliegan con un toque en la cabecera.
// El «documento firmado» se quitó: no se usaba y en la BBDD estaba a false en las 645 filas.

import { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, FileDown, Minus, X } from 'lucide-react';
import {
  CAMPOS_PROTECCION,
  PROTECCION_LABELS,
  generalProteccion,
  siguienteGeneral,
  type CampoProteccion,
  type GeneralProteccion,
} from '@/lib/alumnado';
import type { ClaveColumna } from '@/lib/alumnado-informe';
import type { AlumnoLista, ProteccionLista } from '@/lib/alumnado-server';
import { BarraTabla, BotonMasivo, Celda, CeldaAlumno, ColumnaBoton, useGuardado, type TonoTabla } from './piezas-tabla';

type Estado = boolean | null;
type Cambios = Partial<Record<CampoProteccion, Estado>> & { desestimaCorreo?: boolean };

/** El ciclo de un toque. «No consta» es el final, no el principio: ya se parte de «sí». */
const SIGUIENTE: Record<string, Estado> = { true: false, false: null, null: true };

const TONO_PERMISO: Record<string, TonoTabla> = { true: 'si', false: 'no', null: 'gris' };
const ICONO: Record<string, React.ReactNode> = {
  true: <Check className="h-4 w-4" />,
  false: <X className="h-4 w-4" />,
  null: <Minus className="h-4 w-4" />,
};

const GENERAL: Record<string, { tono: TonoTabla; texto: React.ReactNode; titulo: string }> = {
  si: { tono: 'si', texto: <Check className="h-4 w-4" />, titulo: 'Autoriza todo' },
  no: { tono: 'no', texto: <X className="h-4 w-4" />, titulo: 'No autoriza nada' },
  parcial: { tono: 'aviso', texto: 'Parcial', titulo: 'Ha dicho que no a algo: despliega para ver a qué' },
  null: { tono: 'gris', texto: <Minus className="h-4 w-4" />, titulo: 'Sin constar' },
};

const todos = (valor: Estado): Cambios => ({ imagen: valor, redes: valor, ampa: valor, ong: valor });

export function TablaProteccion({
  alumnos,
  ambito,
  conClase,
  puedeEditar,
  onCambio,
  onInforme,
}: {
  /** Los que se ven ahora mismo: la clase elegida, o el resultado de la búsqueda. */
  alumnos: AlumnoLista[];
  /** Cómo se llama lo que hay delante («2º ESO B»), para que lo masivo diga a qué afecta. */
  ambito: string;
  /** ¿Se ven varias clases a la vez? Entonces cada fila dice la suya. */
  conClase: boolean;
  puedeEditar: boolean;
  onCambio: (filas: (ProteccionLista & { id: string })[]) => void;
  onInforme: (columnas: ClaveColumna[]) => void;
}) {
  const [detalle, setDetalle] = useState(false);
  const { guardando, confirmando, enviar, confirmarY } = useGuardado();

  const conPd = alumnos.filter((a) => a.proteccion);
  const sinPd = alumnos.length - conPd.length;

  async function guardar(clave: string, ids: string[], cambios: Cambios) {
    if (ids.length === 0) return;
    const datos = await enviar<{ filas: (ProteccionLista & { id: string })[] }>(
      clave,
      '/api/alumnado/proteccion',
      { eduStudentIds: ids, cambios },
      ids.length > 1 ? `${ids.length} alumnos actualizados` : undefined,
    );
    if (datos) onCambio(datos.filas);
  }

  const masivo = (clave: string, cambios: Cambios) =>
    confirmarY(clave, () => void guardar(clave, conPd.map((a) => a.id), cambios));

  if (conPd.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center text-sm text-zinc-400 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        Aquí no hay ningún alumno cuya protección de datos te toque. Un tutor solo ve la de su
        propia tutoría.
      </div>
    );
  }

  const noes = conPd.filter((a) => generalProteccion(a.proteccion!) !== 'si').length;
  const desestiman = conPd.filter((a) => a.proteccion!.desestimaCorreo).length;

  return (
    <div className="space-y-2">
      <BarraTabla
        ambito={ambito}
        cuantos={conPd.length}
        extra={
          <>
            {noes > 0 && <span className="text-amber-600 dark:text-amber-400"> · {noes} con algún no</span>}
            {desestiman > 0 && <span className="text-red-600 dark:text-red-400"> · {desestiman} sin correo</span>}
            {sinPd > 0 && <span className="text-zinc-400"> · {sinPd} fuera de tu tutoría</span>}
          </>
        }
      >
        <button
          type="button"
          onClick={() => onInforme(detalle ? ['pd', 'pd_imagen', 'pd_redes', 'pd_ampa', 'pd_ong', 'pd_correo'] : ['pd', 'pd_correo'])}
          className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          <FileDown className="h-3.5 w-3.5" /> Informe
        </button>
        {puedeEditar && (
          <>
            <BotonMasivo
              activa={confirmando === 'todo-si'}
              ocupada={guardando === 'todo-si'}
              texto="Poner todo a SÍ"
              confirmacion={`Sí: ${conPd.length} alumnos × 4 permisos`}
              tono="verde"
              onClick={() => masivo('todo-si', todos(true))}
            />
            <BotonMasivo
              activa={confirmando === 'limpiar'}
              ocupada={guardando === 'limpiar'}
              texto="Dejar sin constar"
              confirmacion={`Sí: borrar los ${conPd.length}`}
              tono="gris"
              onClick={() => masivo('limpiar', todos(null))}
            />
          </>
        )}
      </BarraTabla>

      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <table className="w-full min-w-[24rem] text-sm">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              <th className="p-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Alumno</th>
              <th className="p-2 align-bottom">
                <span className="flex items-center justify-center gap-1">
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Protección de datos</span>
                  <button
                    type="button"
                    onClick={() => setDetalle((d) => !d)}
                    aria-expanded={detalle}
                    title={detalle ? 'Plegar el detalle' : 'Ver imagen, redes, AMPA y ONG por separado'}
                    className="inline-flex items-center rounded-md px-1 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950"
                  >
                    {detalle ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    {detalle ? 'plegar' : 'detalle'}
                  </button>
                </span>
                {puedeEditar && (
                  <span className="mt-1 flex justify-center gap-0.5">
                    <ColumnaBoton
                      activa={confirmando === 'general-si'}
                      ocupada={guardando === 'general-si'}
                      tono="verde"
                      titulo={`Autoriza todo en ${ambito}`}
                      onClick={() => masivo('general-si', todos(true))}
                    >
                      <Check className="h-3 w-3" />
                    </ColumnaBoton>
                    <ColumnaBoton
                      activa={confirmando === 'general-no'}
                      ocupada={guardando === 'general-no'}
                      tono="rojo"
                      titulo={`No autoriza nada en ${ambito}`}
                      onClick={() => masivo('general-no', todos(false))}
                    >
                      <X className="h-3 w-3" />
                    </ColumnaBoton>
                  </span>
                )}
              </th>
              {detalle &&
                CAMPOS_PROTECCION.map((campo) => (
                  <th key={campo} className="bg-zinc-50/70 p-2 align-bottom dark:bg-zinc-800/30">
                    <span className="block text-center text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {PROTECCION_LABELS[campo].titulo}
                    </span>
                    {puedeEditar && (
                      <span className="mt-1 flex justify-center gap-0.5">
                        <ColumnaBoton
                          activa={confirmando === `${campo}-si`}
                          ocupada={guardando === `${campo}-si`}
                          tono="verde"
                          titulo={`Poner «${PROTECCION_LABELS[campo].titulo}» a sí en ${ambito}`}
                          onClick={() => masivo(`${campo}-si`, { [campo]: true })}
                        >
                          <Check className="h-3 w-3" />
                        </ColumnaBoton>
                        <ColumnaBoton
                          activa={confirmando === `${campo}-no`}
                          ocupada={guardando === `${campo}-no`}
                          tono="rojo"
                          titulo={`Poner «${PROTECCION_LABELS[campo].titulo}» a no en ${ambito}`}
                          onClick={() => masivo(`${campo}-no`, { [campo]: false })}
                        >
                          <X className="h-3 w-3" />
                        </ColumnaBoton>
                      </span>
                    )}
                  </th>
                ))}
              <th className="p-2 align-bottom">
                <span className="block text-center text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  Desestima correo alumno
                </span>
                {puedeEditar && (
                  <span className="mt-1 flex justify-center gap-0.5">
                    <ColumnaBoton
                      activa={confirmando === 'correo-no'}
                      ocupada={guardando === 'correo-no'}
                      tono="verde"
                      titulo={`Nadie desestima el correo en ${ambito}`}
                      onClick={() => masivo('correo-no', { desestimaCorreo: false })}
                    >
                      <Check className="h-3 w-3" />
                    </ColumnaBoton>
                  </span>
                )}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {conPd.map((a) => {
              const pd = a.proteccion!;
              const general: GeneralProteccion = generalProteccion(pd);
              const g = GENERAL[String(general)];
              return (
                <tr key={a.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <CeldaAlumno numero={a.numero} nombre={a.completo} clase={conClase ? a.clase : undefined} />
                  <td className="p-1 text-center">
                    <Celda
                      tono={g.tono}
                      ancho="w-16"
                      editable={puedeEditar}
                      ocupada={guardando === `${a.id}-general`}
                      etiqueta={`${g.titulo} · ${a.completo}`}
                      onTocar={() => guardar(`${a.id}-general`, [a.id], todos(siguienteGeneral(general)))}
                    >
                      {g.texto}
                    </Celda>
                  </td>
                  {detalle &&
                    CAMPOS_PROTECCION.map((campo) => (
                      <td key={campo} className="bg-zinc-50/70 p-1 text-center dark:bg-zinc-800/30">
                        <Celda
                          tono={TONO_PERMISO[String(pd[campo])]}
                          editable={puedeEditar}
                          ocupada={guardando === `${a.id}-${campo}`}
                          etiqueta={`${PROTECCION_LABELS[campo].titulo} de ${a.completo}`}
                          onTocar={() =>
                            guardar(`${a.id}-${campo}`, [a.id], { [campo]: SIGUIENTE[String(pd[campo])] })
                          }
                        >
                          {ICONO[String(pd[campo])]}
                        </Celda>
                      </td>
                    ))}
                  <td className="p-1 text-center">
                    <Celda
                      // Aquí el «sí» es lo raro: desestimar el correo sale en rojo.
                      tono={pd.desestimaCorreo ? 'no' : 'si'}
                      ancho="w-16"
                      editable={puedeEditar}
                      ocupada={guardando === `${a.id}-correo`}
                      etiqueta={`${pd.desestimaCorreo ? 'Desestima' : 'No desestima'} el correo · ${a.completo}`}
                      onTocar={() => guardar(`${a.id}-correo`, [a.id], { desestimaCorreo: !pd.desestimaCorreo })}
                    >
                      {pd.desestimaCorreo ? 'Desestima' : <Check className="h-4 w-4" />}
                    </Celda>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="px-1 text-xs text-zinc-400">
        La columna general pone los cuatro permisos a{' '}
        <strong className="font-medium text-emerald-600 dark:text-emerald-400">sí</strong> o a{' '}
        <strong className="font-medium text-red-600 dark:text-red-400">no</strong> de un toque;
        <strong className="font-medium text-amber-600 dark:text-amber-400"> parcial</strong> es que hay algún no suelto
        (despliega el detalle para verlo). En el correo, verde es lo normal: la familia no lo desestima.
        {!puedeEditar && ' Aquí solo miras: esto lo cambian secretaría, dirección o TIC.'}
      </p>
    </div>
  );
}
